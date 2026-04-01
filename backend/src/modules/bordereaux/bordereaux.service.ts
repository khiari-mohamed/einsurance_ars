import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Like, Not, IsNull, DataSource } from 'typeorm';
import { Bordereau, BordereauType, BordereauStatus } from './bordereaux.entity';
import { AffaireType, AffaireCategory } from '../affaires/affaires.entity';
import { BordereauLigne, TypeLigne } from './bordereau-line.entity';
import { BordereauDocument, BordereauDocumentType } from './bordereau-document.entity';
import { Affaire } from '../affaires/affaires.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { CreateBordereauDto } from './dto/create-bordereau.dto';
import { UpdateBordereauDto } from './dto/update-bordereau.dto';
import { AddDocumentDto } from './dto/add-document.dto';
import { GenerateBordereauDto } from './dto/generate-bordereau.dto';
import { PdfService } from '../shared/services/pdf.service';
import { EmailService } from '../shared/services/email.service';
import { StorageService } from '../shared/services/storage.service';
import { AccountingService } from '../comptabilite/accounting.service';
import { amountToWords, formatAmountWithWords } from '../../utils/amount-to-words.util';

@Injectable()
export class BordereauxService {
  constructor(
    @InjectRepository(Bordereau) private bordereauRepo: Repository<Bordereau>,
    @InjectRepository(BordereauLigne) private ligneRepo: Repository<BordereauLigne>,
    @InjectRepository(BordereauDocument) private documentRepo: Repository<BordereauDocument>,
    @InjectRepository(Affaire) private affaireRepo: Repository<Affaire>,
    @InjectRepository(Cedante) private cedanteRepo: Repository<Cedante>,
    @InjectRepository(Reassureur) private reassureurRepo: Repository<Reassureur>,
    private pdfService: PdfService,
    private emailService: EmailService,
    private storageService: StorageService,
    @Inject(forwardRef(() => AccountingService))
    private accountingService: AccountingService,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreateBordereauDto, userId: string): Promise<Bordereau> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate unique numero
      const numero = await this.generateNumero(dto.type);
      
      // Verify cedante exists
      const cedante = await this.cedanteRepo.findOne({ where: { id: dto.cedanteId } });
      if (!cedante) throw new NotFoundException(`Cédante ${dto.cedanteId} not found`);

      let reassureur = null;
      if (dto.reassureurId) {
        reassureur = await this.reassureurRepo.findOne({ where: { id: dto.reassureurId } });
        if (!reassureur) throw new NotFoundException(`Réassureur ${dto.reassureurId} not found`);
      }

      // Create bordereau entity
      const bordereau = this.bordereauRepo.create({
        numero,
        type: dto.type,
        status: BordereauStatus.BROUILLON,
        cedante,
        cedanteId: dto.cedanteId,
        reassureur,
        reassureurId: dto.reassureurId,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        dateEmission: new Date(dto.dateEmission),
        dateLimitePaiement: dto.dateLimitePaiement ? new Date(dto.dateLimitePaiement) : null,
        devise: dto.devise || 'TND',
        createdById: userId,
        historique: [{
          date: new Date(),
          action: 'CREATION',
          user: userId,
          details: 'Bordereau créé manuellement'
        }],
      });

      const savedBordereau = await queryRunner.manager.save(bordereau);

      // Process affaires if provided
      if (dto.affaireIds && dto.affaireIds.length > 0) {
        await this.addAffairesToBordereau(savedBordereau.id, dto.affaireIds, userId);
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedBordereau.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async generateFromPeriod(dto: GenerateBordereauDto, userId: string): Promise<Bordereau[]> {
    switch (dto.type) {
      case BordereauType.CESSION:
        return [await this.generateCessionFromPeriod(dto, userId)];
      case BordereauType.REASSUREUR:
        return await this.generateReassureurFromPeriod(dto, userId);
      default:
        throw new BadRequestException(`Type ${dto.type} not supported for period generation`);
    }
  }

  async generateSinistre(sinistreId: string, userId: string): Promise<Bordereau> {
    const sinistre = await this.dataSource.getRepository('Sinistre').findOne({
      where: { id: sinistreId },
      relations: ['affaire', 'affaire.cedante', 'affaire.reinsurers']
    });

    if (!sinistre) throw new NotFoundException('Sinistre not found');

    const affaire = sinistre.affaire;
    const numero = await this.generateNumero(BordereauType.SINISTRE);

    const bordereau = this.bordereauRepo.create({
      numero,
      type: BordereauType.SINISTRE,
      status: BordereauStatus.BROUILLON,
      cedanteId: affaire.cedanteId,
      dateDebut: sinistre.dateSurvenance,
      dateFin: sinistre.dateSurvenance,
      dateEmission: new Date(),
      sinistres: Number(sinistre.montantTotal),
      devise: affaire.devise || 'TND',
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'SINISTRE_GENERATED',
        user: userId,
        details: `Bordereau sinistre pour ${sinistre.numeroSinistre}`
      }]
    });

    const saved = await this.bordereauRepo.save(bordereau);

    // Create lines for each reinsurer
    const lignes = affaire.reinsurers.map((participation, index) => {
      const montantReassureur = Number(sinistre.montantTotal) * (participation.share / 100);
      return this.ligneRepo.create({
        bordereauId: saved.id,
        affaireId: affaire.id,
        reassureurId: participation.reassureurId,
        numLigne: index + 1,
        typeLigne: TypeLigne.SINISTRE,
        description: `Sinistre ${sinistre.numeroSinistre} - Part ${participation.share}%`,
        montantBrut: Number(sinistre.montantTotal),
        partReassureur: participation.share,
        montantSinistre: montantReassureur,
        montantCede: montantReassureur,
        netAPayer: montantReassureur,
        commissionMontant: 0
      });
    });

    await this.ligneRepo.save(lignes);
    return this.findOne(saved.id);
  }

  async generateSituation(entityType: string, entityId: string, periodStart: Date, periodEnd: Date, userId: string): Promise<Bordereau> {
    const numero = await this.generateNumero(BordereauType.SITUATION);

    // Get all bordereaux for entity in period
    const query = this.bordereauRepo.createQueryBuilder('b')
      .where('b.dateDebut >= :start AND b.dateFin <= :end', { start: periodStart, end: periodEnd });

    if (entityType === 'cedante') {
      query.andWhere('b.cedanteId = :entityId', { entityId });
    } else {
      query.andWhere('b.reassureurId = :entityId', { entityId });
    }

    const bordereaux = await query.getMany();

    // Calculate totals
    const totalPrime = bordereaux.reduce((sum, b) => sum + Number(b.primeTotale), 0);
    const totalCommission = bordereaux.reduce((sum, b) => sum + Number(b.commissionCedante) + Number(b.commissionARS), 0);
    const totalSinistres = bordereaux.reduce((sum, b) => sum + Number(b.sinistres), 0);
    const totalAcomptes = bordereaux.reduce((sum, b) => sum + Number(b.acompteRecu), 0);

    const bordereau = this.bordereauRepo.create({
      numero,
      type: BordereauType.SITUATION,
      status: BordereauStatus.BROUILLON,
      cedanteId: entityType === 'cedante' ? entityId : bordereaux[0]?.cedanteId,
      reassureurId: entityType === 'reassureur' ? entityId : null,
      dateDebut: periodStart,
      dateFin: periodEnd,
      dateEmission: new Date(),
      primeTotale: totalPrime,
      commissionCedante: entityType === 'cedante' ? totalCommission : 0,
      commissionARS: entityType === 'reassureur' ? totalCommission : 0,
      sinistres: totalSinistres,
      acompteRecu: totalAcomptes,
      solde: totalPrime - totalCommission - totalSinistres - totalAcomptes,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'SITUATION_GENERATED',
        user: userId,
        details: `Situation ${entityType} pour période ${periodStart} - ${periodEnd}`
      }]
    });

    return this.bordereauRepo.save(bordereau);
  }

  private async generateCessionFromPeriod(dto: GenerateBordereauDto, userId: string): Promise<Bordereau> {
    const affaires = await this.getAffairesForPeriod(dto.periodStart, dto.periodEnd, dto.cedanteId);
    if (affaires.length === 0) throw new NotFoundException('No affaires found for period');
    return this.createCessionBordereau(affaires, dto, userId);
  }

  private async generateReassureurFromPeriod(dto: GenerateBordereauDto, userId: string): Promise<Bordereau[]> {
    const generatedBordereaux: Bordereau[] = [];

    if (dto.treatyId) {
      const treaty = await this.affaireRepo.findOne({
        where: { id: dto.treatyId, category: AffaireCategory.TRAITEE },
        relations: ['reinsurers']
      });

      if (!treaty) throw new NotFoundException(`Traité ${dto.treatyId} not found`);

      for (const participation of treaty.reinsurers) {
        const affaires = await this.getAffairesForPeriod(
          dto.periodStart,
          dto.periodEnd,
          dto.cedanteId,
          participation.reassureurId
        );

        if (affaires.length > 0) {
          const bordereau = await this.createTreatyBordereau(treaty, participation, affaires, dto, userId);
          generatedBordereaux.push(bordereau);
        }
      }
    } else if (dto.reassureurId) {
      const affaires = await this.getAffairesForPeriod(dto.periodStart, dto.periodEnd, dto.cedanteId, dto.reassureurId);
      if (affaires.length > 0) {
        const bordereau = await this.createReassureurBordereau(affaires, dto, userId);
        generatedBordereaux.push(bordereau);
      }
    }

    return generatedBordereaux;
  }

  private async createReassureurBordereau(
    affaires: Affaire[],
    dto: GenerateBordereauDto,
    userId: string
  ): Promise<Bordereau> {
    const numero = await this.generateNumero(BordereauType.REASSUREUR);
    const totalPrime = affaires.reduce((sum, affaire) => sum + Number(affaire.primeCedee), 0);
    const totalCommissionARS = affaires.reduce((sum, affaire) => sum + Number(affaire.montantCommissionARS), 0);

    const bordereau = this.bordereauRepo.create({
      numero,
      type: BordereauType.REASSUREUR,
      status: BordereauStatus.BROUILLON,
      cedanteId: dto.cedanteId,
      reassureurId: dto.reassureurId,
      dateDebut: dto.periodStart,
      dateFin: dto.periodEnd,
      dateEmission: new Date(),
      primeTotale: totalPrime,
      commissionARS: totalCommissionARS,
      solde: totalPrime - totalCommissionARS,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'AUTO_GENERATED',
        user: userId,
        details: 'Bordereau réassureur généré automatiquement'
      }],
    });

    const saved = await this.bordereauRepo.save(bordereau);

    const lignes = affaires.map((affaire, index) => {
      return this.ligneRepo.create({
        bordereauId: saved.id,
        affaireId: affaire.id,
        numLigne: index + 1,
        description: `${affaire.numeroAffaire} - ${affaire.assure?.raisonSociale || 'N/A'}`,
        montantBrut: Number(affaire.prime100),
        tauxCession: Number(affaire.tauxCession),
        montantCede: Number(affaire.primeCedee),
        commissionMontant: Number(affaire.montantCommissionARS),
        netAPayer: Number(affaire.primeCedee) - Number(affaire.montantCommissionARS),
      });
    });

    await this.ligneRepo.save(lignes);
    return this.findOne(saved.id);
  }

  async addAffairesToBordereau(bordereauId: string, affaireIds: string[], userId: string): Promise<void> {
    const bordereau = await this.findOne(bordereauId);
    
    // Validate bordereau is in draft or validation status
    if (![BordereauStatus.BROUILLON, BordereauStatus.EN_VALIDATION].includes(bordereau.status)) {
      throw new BadRequestException('Cannot add affaires to a bordereau that is not in draft or validation status');
    }

    const affaires = await this.affaireRepo.find({
      where: { id: In(affaireIds) },
      relations: ['assure', 'cedante']
    });

    if (affaires.length === 0) throw new NotFoundException('No affaires found');

    // Calculate totals
    let primeTotale = bordereau.primeTotale || 0;
    let commissionCedante = bordereau.commissionCedante || 0;
    let commissionARS = bordereau.commissionARS || 0;
    let sinistres = bordereau.sinistres || 0;

    // Get existing ligne numbers
    const existingLignes = bordereau.lignes || [];
    let ligneNumber = existingLignes.length > 0 
      ? Math.max(...existingLignes.map(l => l.numLigne)) + 1 
      : 1;

    // Create new lignes
    const newLignes = affaires.map(affaire => {
      const ligne = this.ligneRepo.create({
        bordereauId,
        affaireId: affaire.id,
        numLigne: ligneNumber++,
        description: `${affaire.numeroAffaire} - ${affaire.assure?.raisonSociale || 'N/A'}`,
        montantBrut: Number(affaire.prime100),
        tauxCession: Number(affaire.tauxCession),
        montantCede: Number(affaire.primeCedee),
        commissionMontant: bordereau.type === BordereauType.CESSION 
          ? Number(affaire.montantCommissionCedante)
          : Number(affaire.montantCommissionARS),
        netAPayer: Number(affaire.primeCedee) - (bordereau.type === BordereauType.CESSION 
          ? Number(affaire.montantCommissionCedante)
          : Number(affaire.montantCommissionARS)),
      });

      // Update totals
      primeTotale += Number(affaire.primeCedee);
      commissionCedante += Number(affaire.montantCommissionCedante);
      commissionARS += Number(affaire.montantCommissionARS);
      // Note: Sinistres would need separate calculation

      return ligne;
    });

    // Save lignes
    await this.ligneRepo.save(newLignes);

    // Update bordereau totals
    bordereau.primeTotale = primeTotale;
    bordereau.commissionCedante = commissionCedante;
    bordereau.commissionARS = commissionARS;
    bordereau.sinistres = sinistres;
    bordereau.solde = primeTotale - commissionCedante - commissionARS - sinistres;

    // Add history
    bordereau.historique.push({
      date: new Date(),
      action: 'AFFAIRES_ADDED',
      user: userId,
      details: `Added ${affaires.length} affaires: ${affaires.map(a => a.numeroAffaire).join(', ')}`
    });

    await this.bordereauRepo.save(bordereau);
  }

  async addDocument(bordereauId: string, file: any, dto: AddDocumentDto, userId: string): Promise<BordereauDocument> {
    const bordereau = await this.findOne(bordereauId);

    // Validate file
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Only PDF, JPEG, PNG, and Excel allowed');
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds 10MB limit');
    }

    // Upload file to storage
    const filePath = `bordereaux/${bordereauId}/${Date.now()}_${file.originalname}`;
    const uploadResult = await this.storageService.uploadFile(filePath, file.buffer, file.mimetype);

    // Create document record
    const document = this.documentRepo.create({
      bordereauId,
      type: dto.type as BordereauDocumentType,
      nomFichier: file.originalname,
      cheminS3: uploadResult.path,
      taille: file.size,
      mimeType: file.mimetype,
      description: dto.description,
      uploadedById: userId,
      metadata: dto.metadata || {},
    });

    const savedDocument = await this.documentRepo.save(document);

    // Update bordereau documents array
    bordereau.documents = bordereau.documents || [];
    bordereau.documents.push({
      type: dto.type,
      nomFichier: file.originalname,
      cheminS3: uploadResult.path,
      uploadedAt: new Date(),
    });

    // Add history
    bordereau.historique.push({
      date: new Date(),
      action: 'DOCUMENT_ADDED',
      user: userId,
      details: `Document ajouté: ${file.originalname} (${dto.type})`
    });

    await this.bordereauRepo.save(bordereau);

    return savedDocument;
  }

  async validateDocumentCompleteness(bordereauId: string): Promise<{ complete: boolean; missing: string[] }> {
    const bordereau = await this.findOne(bordereauId);
    const documents = await this.documentRepo.find({ where: { bordereauId } });

    const requiredTypes = {
      [BordereauType.CESSION]: [BordereauDocumentType.FACTURE],
      [BordereauType.REASSUREUR]: [BordereauDocumentType.FACTURE],
      [BordereauType.SINISTRE]: [BordereauDocumentType.BULLETIN_SOIN, BordereauDocumentType.AVIS_SINISTRE],
      [BordereauType.SITUATION]: [BordereauDocumentType.RELEVE_BANCAIRE]
    };

    const required = requiredTypes[bordereau.type] || [];
    const existing = documents.map(d => d.type);
    const missing = required.filter(type => !existing.includes(type));

    return { complete: missing.length === 0, missing };
  }

  async generatePdf(bordereauId: string, userId: string): Promise<{ pdfBuffer: Buffer; fileName: string }> {
    const bordereau = await this.findOne(bordereauId);

    // Get all documents
    const documents = await this.documentRepo.find({
      where: { bordereauId },
      order: { uploadedAt: 'ASC' }
    });

    // Add amount in words for legal compliance
    const bordereauWithWords = {
      ...bordereau,
      primeTotaleEnLettres: amountToWords(Number(bordereau.primeTotale)),
      soldeEnLettres: amountToWords(Number(bordereau.solde)),
    };

    // Generate PDF
    const pdfBuffer = await this.pdfService.generateBordereauPdf(bordereauWithWords, documents);

    // Update bordereau with PDF path
    const fileName = `Bordereau_${bordereau.numero}_${Date.now()}.pdf`;
    const pdfPath = `bordereaux/${bordereauId}/pdf/${fileName}`;
    
    await this.storageService.uploadFile(pdfPath, pdfBuffer, 'application/pdf');
    
    bordereau.pdfPath = pdfPath;
    bordereau.historique.push({
      date: new Date(),
      action: 'PDF_GENERATED',
      user: userId,
      details: 'PDF généré'
    });

    await this.bordereauRepo.save(bordereau);

    return { pdfBuffer, fileName };
  }

  async sendBordereau(bordereauId: string, recipients: string[], userId: string): Promise<void> {
    const bordereau = await this.findOne(bordereauId);

    // Validate bordereau can be sent
    if (bordereau.status !== BordereauStatus.VALIDE) {
      throw new BadRequestException('Only validated bordereaux can be sent');
    }

    // Generate PDF
    const { pdfBuffer, fileName } = await this.generatePdf(bordereauId, userId);

    // Send email
    const emailContent = this.getEmailContent(bordereau);
    await this.emailService.sendBordereauEmail(
      recipients,
      `Bordereau ${bordereau.numero} - ARS Tunisie`,
      emailContent,
      pdfBuffer,
      fileName
    );

    // Update status
    await this.updateStatus(bordereauId, BordereauStatus.ENVOYE, userId);

    // Notify internal teams
    await this.notifyInternalTeams(bordereau, 'sent');
  }

  async submitForValidation(bordereauId: string, userId: string): Promise<Bordereau> {
    const bordereau = await this.findOne(bordereauId);

    if (bordereau.status !== BordereauStatus.BROUILLON) {
      throw new BadRequestException('Only draft bordereaux can be submitted for validation');
    }

    // Validate completeness
    if (!bordereau.lignes || bordereau.lignes.length === 0) {
      throw new BadRequestException('Bordereau must have at least one line');
    }

    if (Math.abs(Number(bordereau.primeTotale)) < 0.01) {
      throw new BadRequestException('Bordereau must have non-zero amounts');
    }

    return this.updateStatus(bordereauId, BordereauStatus.EN_VALIDATION, userId);
  }

  async validate(bordereauId: string, userId: string): Promise<Bordereau> {
    const bordereau = await this.findOne(bordereauId);

    if (![BordereauStatus.BROUILLON, BordereauStatus.EN_VALIDATION].includes(bordereau.status)) {
      throw new BadRequestException(`Bordereau cannot be validated from status ${bordereau.status}`);
    }

    // Generate accounting entries
    await this.accountingService.generateBordereauEntries(bordereau, userId);

    return this.updateStatus(bordereauId, BordereauStatus.VALIDE, userId);
  }

  async reject(bordereauId: string, reason: string, userId: string): Promise<Bordereau> {
    const bordereau = await this.findOne(bordereauId);

    if (bordereau.status !== BordereauStatus.EN_VALIDATION) {
      throw new BadRequestException('Only bordereaux in validation can be rejected');
    }

    bordereau.status = BordereauStatus.BROUILLON;
    bordereau.historique.push({
      date: new Date(),
      action: 'REJECTED',
      user: userId,
      details: `Rejeté: ${reason}`
    });

    return this.bordereauRepo.save(bordereau);
  }

  async markAsPaid(bordereauId: string, paymentData: any, userId: string): Promise<Bordereau> {
    const bordereau = await this.findOne(bordereauId);

    if (![BordereauStatus.ENVOYE, BordereauStatus.VALIDE].includes(bordereau.status)) {
      throw new BadRequestException('Only sent or validated bordereaux can receive payments');
    }

    // Handle partial or full payment
    const currentAcompte = Number(bordereau.acompteRecu) || 0;
    const newAcompte = currentAcompte + Number(paymentData.montant);
    bordereau.acompteRecu = newAcompte;

    // Recalculate solde
    const totalDue = Number(bordereau.primeTotale) - Number(bordereau.commissionCedante) - Number(bordereau.commissionARS) - Number(bordereau.sinistres);
    bordereau.solde = totalDue - newAcompte;

    // If fully paid, update status
    if (Math.abs(bordereau.solde) < 0.01) {
      bordereau.status = BordereauStatus.COMPTABILISE;
    }

    // Add payment document if provided
    if (paymentData.paymentDocument) {
      await this.addDocument(
        bordereauId,
        paymentData.paymentDocument,
        {
          type: BordereauDocumentType.RELEVE_BANCAIRE,
          description: `Preuve de paiement - ${paymentData.modePaiement}`
        },
        userId
      );
    }

    bordereau.historique.push({
      date: new Date(),
      action: paymentData.montant >= totalDue ? 'PAYMENT_FULL' : 'PAYMENT_PARTIAL',
      user: userId,
      details: `Paiement ${paymentData.montant} ${bordereau.devise} (${paymentData.modePaiement}) - Solde restant: ${bordereau.solde}`
    });

    return this.bordereauRepo.save(bordereau);
  }

  async getBordereauByNumero(numero: string): Promise<Bordereau> {
    const bordereau = await this.bordereauRepo.findOne({
      where: { numero },
      relations: ['cedante', 'reassureur', 'lignes', 'lignes.affaire', 'createdBy', 'validatedBy']
    });

    if (!bordereau) {
      throw new NotFoundException(`Bordereau ${numero} not found`);
    }

    return bordereau;
  }

  async getDocuments(bordereauId: string): Promise<BordereauDocument[]> {
    return this.documentRepo.find({
      where: { bordereauId },
      order: { uploadedAt: 'ASC' },
      relations: ['uploadedBy']
    });
  }

  async getOverdueBordereaux(): Promise<Bordereau[]> {
    const today = new Date();
    const query = this.bordereauRepo.createQueryBuilder('bordereau')
      .leftJoinAndSelect('bordereau.cedante', 'cedante')
      .leftJoinAndSelect('bordereau.reassureur', 'reassureur')
      .where('bordereau.status = :status', { status: BordereauStatus.ENVOYE })
      .andWhere('bordereau.dateLimitePaiement IS NOT NULL')
      .andWhere('bordereau.dateLimitePaiement < :today', { today })
      .orderBy('bordereau.dateLimitePaiement', 'ASC');

    return query.getMany();
  }

  async getDueSoon(days: number = 7): Promise<Bordereau[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + days);

    return this.bordereauRepo.createQueryBuilder('bordereau')
      .leftJoinAndSelect('bordereau.cedante', 'cedante')
      .leftJoinAndSelect('bordereau.reassureur', 'reassureur')
      .where('bordereau.status = :status', { status: BordereauStatus.ENVOYE })
      .andWhere('bordereau.dateLimitePaiement BETWEEN :today AND :future', { today, future: futureDate })
      .orderBy('bordereau.dateLimitePaiement', 'ASC')
      .getMany();
  }

  async sendPaymentReminder(bordereauId: string, userId: string): Promise<void> {
    const bordereau = await this.findOne(bordereauId);

    if (bordereau.status !== BordereauStatus.ENVOYE) {
      throw new BadRequestException('Only sent bordereaux can have reminders');
    }

    const recipients = bordereau.reassureur 
      ? [bordereau.reassureur.email] 
      : [bordereau.cedante.email];

    const subject = `RAPPEL: Bordereau ${bordereau.numero} - Paiement en attente`;
    const message = `
      <h2>Rappel de Paiement</h2>
      <p>Le bordereau ${bordereau.numero} est en attente de paiement.</p>
      <p><strong>Montant dû:</strong> ${bordereau.solde} ${bordereau.devise}</p>
      <p><strong>Date limite:</strong> ${bordereau.dateLimitePaiement}</p>
      <p>Merci de régulariser dans les plus brefs délais.</p>
    `;

    await this.emailService.sendNotification(recipients[0], subject, message);

    bordereau.historique.push({
      date: new Date(),
      action: 'REMINDER_SENT',
      user: userId,
      details: 'Rappel de paiement envoyé'
    });

    await this.bordereauRepo.save(bordereau);
  }

  // Private helper methods
  private async getAffairesForPeriod(
    startDate: Date,
    endDate: Date,
    cedanteId?: string,
    reassureurId?: string
  ): Promise<Affaire[]> {
    const query = this.affaireRepo.createQueryBuilder('affaire')
      .leftJoinAndSelect('affaire.cedante', 'cedante')
      .leftJoinAndSelect('affaire.assure', 'assure')
      .leftJoinAndSelect('affaire.reinsurers', 'reinsurers')
      .where('affaire.dateEffet BETWEEN :start AND :end', { start: startDate, end: endDate });

    if (cedanteId) {
      query.andWhere('affaire.cedanteId = :cedanteId', { cedanteId });
    }

    if (reassureurId) {
      query.andWhere('reinsurers.reassureurId = :reassureurId', { reassureurId });
    }

    return query.getMany();
  }

  private async createTreatyBordereau(
    treaty: Affaire,
    participation: any,
    affaires: Affaire[],
    dto: GenerateBordereauDto,
    userId: string
  ): Promise<Bordereau> {
    const numero = await this.generateNumero(BordereauType.REASSUREUR);
    const totalPrime = affaires.reduce((sum, affaire) => sum + Number(affaire.primeCedee), 0);
    const share = participation.share / 100;
    const primePartReassureur = totalPrime * share;
    const commissionARSPart = affaires.reduce((sum, affaire) => sum + Number(affaire.montantCommissionARS), 0) * share;
    
    const bordereau = this.bordereauRepo.create({
      numero,
      type: BordereauType.REASSUREUR,
      status: BordereauStatus.BROUILLON,
      cedanteId: dto.cedanteId,
      reassureurId: participation.reassureurId,
      dateDebut: dto.periodStart,
      dateFin: dto.periodEnd,
      dateEmission: new Date(),
      primeTotale: primePartReassureur,
      commissionARS: commissionARSPart,
      solde: primePartReassureur - commissionARSPart,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'AUTO_GENERATED',
        user: userId,
        details: `Bordereau traité généré - Part: ${participation.share}%`
      }],
    });

    const saved = await this.bordereauRepo.save(bordereau);

    const lignes = affaires.map((affaire, index) => {
      const lignePrime = Number(affaire.primeCedee) * share;
      const ligneCommission = Number(affaire.montantCommissionARS) * share;
      return this.ligneRepo.create({
        bordereauId: saved.id,
        affaireId: affaire.id,
        numLigne: index + 1,
        description: `${affaire.numeroAffaire} - ${affaire.assure?.raisonSociale || 'N/A'}`,
        montantBrut: Number(affaire.prime100),
        tauxCession: Number(affaire.tauxCession),
        montantCede: lignePrime,
        partReassureur: participation.share,
        commissionMontant: ligneCommission,
        netAPayer: lignePrime - ligneCommission,
      });
    });

    await this.ligneRepo.save(lignes);
    return this.findOne(saved.id);
  }

  private async createCessionBordereau(
    affaires: Affaire[],
    dto: GenerateBordereauDto,
    userId: string
  ): Promise<Bordereau> {
    const numero = await this.generateNumero(BordereauType.CESSION);
    
    const totalPrime = affaires.reduce((sum, affaire) => sum + Number(affaire.primeCedee), 0);
    const totalCommissionCedante = affaires.reduce((sum, affaire) => sum + Number(affaire.montantCommissionCedante), 0);
    const totalCommissionARS = affaires.reduce((sum, affaire) => sum + Number(affaire.montantCommissionARS), 0);

    const bordereau = this.bordereauRepo.create({
      numero,
      type: BordereauType.CESSION,
      status: BordereauStatus.BROUILLON,
      cedanteId: dto.cedanteId,
      dateDebut: dto.periodStart,
      dateFin: dto.periodEnd,
      dateEmission: new Date(),
      primeTotale: totalPrime,
      commissionCedante: totalCommissionCedante,
      commissionARS: totalCommissionARS,
      solde: totalPrime - totalCommissionCedante - totalCommissionARS,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'AUTO_GENERATED',
        user: userId,
        details: 'Généré automatiquement pour période'
      }],
    });

    const saved = await this.bordereauRepo.save(bordereau);

    // Create lignes
    const lignes = affaires.map((affaire, index) => {
      return this.ligneRepo.create({
        bordereauId: saved.id,
        affaireId: affaire.id,
        numLigne: index + 1,
        description: `${affaire.numeroAffaire} - ${affaire.assure?.raisonSociale || 'N/A'}`,
        montantBrut: Number(affaire.prime100),
        tauxCession: Number(affaire.tauxCession),
        montantCede: Number(affaire.primeCedee),
        commissionMontant: Number(affaire.montantCommissionCedante),
        netAPayer: Number(affaire.primeCedee) - Number(affaire.montantCommissionCedante),
      });
    });

    await this.ligneRepo.save(lignes);

    return this.findOne(saved.id);
  }

  private getEmailContent(bordereau: Bordereau): string {
    const titles = {
      [BordereauType.CESSION]: 'Bordereau de Cession',
      [BordereauType.REASSUREUR]: 'Bordereau Réassureur',
      [BordereauType.SINISTRE]: 'Bordereau Sinistre',
      [BordereauType.SITUATION]: 'Bordereau de Situation',
    };

    return `
      <h1>${titles[bordereau.type]} ${bordereau.numero}</h1>
      <p>Cher partenaire,</p>
      <p>Veuillez trouver ci-joint le bordereau pour la période du ${bordereau.dateDebut} au ${bordereau.dateFin}.</p>
      <h3>Résumé:</h3>
      <ul>
        <li>Prime Totale: ${bordereau.primeTotale} ${bordereau.devise}</li>
        ${bordereau.type === BordereauType.CESSION ? `<li>Commission Cédante: ${bordereau.commissionCedante} ${bordereau.devise}</li>` : ''}
        <li>Commission ARS: ${bordereau.commissionARS} ${bordereau.devise}</li>
        <li>Net à Payer: ${bordereau.solde} ${bordereau.devise}</li>
        <li>Date limite de paiement: ${bordereau.dateLimitePaiement || 'Non spécifiée'}</li>
      </ul>
      <p>Cordialement,<br>ARS Tunisie</p>
    `;
  }

  private async notifyInternalTeams(bordereau: Bordereau, action: string): Promise<void> {
    // Implementation for internal notifications
    // This would typically use a notification service or WebSocket
    console.log(`Notification: Bordereau ${bordereau.numero} ${action}`);
  }

  private async generateNumero(type: BordereauType): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    
    let prefix: string;
    switch (type) {
      case BordereauType.CESSION: prefix = 'BORD-CES'; break;
      case BordereauType.REASSUREUR: prefix = 'BORD-REA'; break;
      case BordereauType.SINISTRE: prefix = 'BORD-SIN'; break;
      case BordereauType.SITUATION: prefix = 'BORD-SIT'; break;
      default: prefix = 'BORD';
    }

    const count = await this.bordereauRepo.count({
      where: { numero: Like(`${prefix}-${year}-${month}-%`) }
    });

    return `${prefix}-${year}-${month}-${String(count + 1).padStart(4, '0')}`;
  }

  async findOne(id: string): Promise<Bordereau> {
    const bordereau = await this.bordereauRepo.findOne({
      where: { id },
      relations: ['cedante', 'reassureur', 'lignes', 'lignes.affaire', 'createdBy', 'validatedBy']
    });

    if (!bordereau) {
      throw new NotFoundException(`Bordereau ${id} not found`);
    }

    return bordereau;
  }

  async findAll(filters: any): Promise<{ data: Bordereau[]; total: number; page: number; limit: number }> {
    const { 
      type, status, cedanteId, reassureurId, startDate, endDate, search, 
      minAmount, maxAmount, overdue, devise, createdById,
      page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'DESC'
    } = filters;

    const query = this.bordereauRepo.createQueryBuilder('bordereau')
      .leftJoinAndSelect('bordereau.cedante', 'cedante')
      .leftJoinAndSelect('bordereau.reassureur', 'reassureur')
      .leftJoinAndSelect('bordereau.createdBy', 'createdBy');

    if (type) query.andWhere('bordereau.type = :type', { type });
    if (status) query.andWhere('bordereau.status = :status', { status });
    if (cedanteId) query.andWhere('bordereau.cedanteId = :cedanteId', { cedanteId });
    if (reassureurId) query.andWhere('bordereau.reassureurId = :reassureurId', { reassureurId });
    if (createdById) query.andWhere('bordereau.createdById = :createdById', { createdById });
    if (devise) query.andWhere('bordereau.devise = :devise', { devise });
    
    if (startDate && endDate) {
      query.andWhere('bordereau.dateDebut BETWEEN :start AND :end', { start: startDate, end: endDate });
    }
    
    if (minAmount) query.andWhere('bordereau.primeTotale >= :minAmount', { minAmount });
    if (maxAmount) query.andWhere('bordereau.primeTotale <= :maxAmount', { maxAmount });
    
    if (overdue === 'true') {
      const today = new Date();
      query.andWhere('bordereau.dateLimitePaiement < :today', { today })
        .andWhere('bordereau.status = :status', { status: BordereauStatus.ENVOYE });
    }
    
    if (search) {
      query.andWhere(
        '(bordereau.numero LIKE :search OR bordereau.notes LIKE :search OR cedante.raisonSociale LIKE :search OR reassureur.raisonSociale LIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [data, total] = await query
      .orderBy(`bordereau.${sortBy}`, sortOrder as 'ASC' | 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async update(id: string, dto: UpdateBordereauDto, userId: string): Promise<Bordereau> {
    const bordereau = await this.findOne(id);

    if (![BordereauStatus.BROUILLON, BordereauStatus.EN_VALIDATION].includes(bordereau.status)) {
      throw new BadRequestException('Cannot update bordereau that is not in draft or validation status');
    }

    Object.assign(bordereau, dto);

    bordereau.historique.push({
      date: new Date(),
      action: 'UPDATED',
      user: userId,
      details: 'Bordereau modifié'
    });

    return this.bordereauRepo.save(bordereau);
  }

  async updateStatus(id: string, status: BordereauStatus, userId: string): Promise<Bordereau> {
    const bordereau = await this.findOne(id);

    const oldStatus = bordereau.status;
    bordereau.status = status;

    if (status === BordereauStatus.VALIDE) {
      bordereau.validatedById = userId;
      bordereau.dateValidation = new Date();
    }

    if (status === BordereauStatus.ENVOYE) {
      bordereau.dateEnvoi = new Date();
    }

    bordereau.historique.push({
      date: new Date(),
      action: 'STATUS_CHANGED',
      user: userId,
      details: `Statut changé de ${oldStatus} à ${status}`
    });

    return this.bordereauRepo.save(bordereau);
  }

  async archive(bordereauId: string, userId: string): Promise<Bordereau> {
    const bordereau = await this.findOne(bordereauId);

    if (bordereau.status !== BordereauStatus.COMPTABILISE) {
      throw new BadRequestException('Only comptabilized bordereaux can be archived');
    }

    return this.updateStatus(bordereauId, BordereauStatus.ARCHIVE, userId);
  }

  async bulkArchive(bordereauIds: string[], userId: string): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const results = { success: [], failed: [] };

    for (const id of bordereauIds) {
      try {
        await this.archive(id, userId);
        results.success.push(id);
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    return results;
  }

  async delete(id: string): Promise<void> {
    const bordereau = await this.findOne(id);

    if (bordereau.status !== BordereauStatus.BROUILLON) {
      throw new BadRequestException('Only draft bordereaux can be deleted');
    }

    await this.bordereauRepo.remove(bordereau);
  }

  async bulkValidate(bordereauIds: string[], userId: string): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const results = { success: [], failed: [] };

    for (const id of bordereauIds) {
      try {
        await this.validate(id, userId);
        results.success.push(id);
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    return results;
  }

  async bulkSend(bordereauIds: string[], recipients: string[], userId: string): Promise<{ success: string[]; failed: Array<{ id: string; error: string }> }> {
    const results = { success: [], failed: [] };

    for (const id of bordereauIds) {
      try {
        await this.sendBordereau(id, recipients, userId);
        results.success.push(id);
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    return results;
  }

  async bulkGeneratePdf(bordereauIds: string[], userId: string): Promise<{ success: Array<{ id: string; fileName: string }>; failed: Array<{ id: string; error: string }> }> {
    const results = { success: [], failed: [] };

    for (const id of bordereauIds) {
      try {
        const { fileName } = await this.generatePdf(id, userId);
        results.success.push({ id, fileName });
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    return results;
  }

  async getStatistics(filters: any): Promise<any> {
    const { cedanteId, reassureurId, startDate, endDate } = filters;

    const query = this.bordereauRepo.createQueryBuilder('bordereau');

    if (cedanteId) query.andWhere('bordereau.cedanteId = :cedanteId', { cedanteId });
    if (reassureurId) query.andWhere('bordereau.reassureurId = :reassureurId', { reassureurId });
    if (startDate && endDate) {
      query.andWhere('bordereau.dateDebut BETWEEN :start AND :end', { start: startDate, end: endDate });
    }

    const bordereaux = await query.getMany();

    const stats = {
      total: bordereaux.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      totalPrime: 0,
      totalCommission: 0,
      totalSolde: 0,
      overdue: 0,
    };

    const today = new Date();

    bordereaux.forEach(b => {
      stats.byType[b.type] = (stats.byType[b.type] || 0) + 1;
      stats.byStatus[b.status] = (stats.byStatus[b.status] || 0) + 1;
      stats.totalPrime += Number(b.primeTotale);
      stats.totalCommission += Number(b.commissionCedante) + Number(b.commissionARS);
      stats.totalSolde += Number(b.solde);

      if (b.dateLimitePaiement && b.dateLimitePaiement < today && b.status === BordereauStatus.ENVOYE) {
        stats.overdue++;
      }
    });

    return stats;
  }

  async getAgingReport(): Promise<any> {
    const bordereaux = await this.bordereauRepo.find({
      where: { status: BordereauStatus.ENVOYE },
      relations: ['cedante', 'reassureur']
    });

    const today = new Date();
    const aging = {
      current: [],
      days_1_30: [],
      days_31_60: [],
      days_61_90: [],
      over_90: []
    };

    bordereaux.forEach(b => {
      if (!b.dateLimitePaiement) return;
      
      const daysDiff = Math.floor((today.getTime() - b.dateLimitePaiement.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff < 0) aging.current.push(b);
      else if (daysDiff <= 30) aging.days_1_30.push(b);
      else if (daysDiff <= 60) aging.days_31_60.push(b);
      else if (daysDiff <= 90) aging.days_61_90.push(b);
      else aging.over_90.push(b);
    });

    return {
      current: { count: aging.current.length, amount: aging.current.reduce((s, b) => s + Number(b.solde), 0) },
      days_1_30: { count: aging.days_1_30.length, amount: aging.days_1_30.reduce((s, b) => s + Number(b.solde), 0) },
      days_31_60: { count: aging.days_31_60.length, amount: aging.days_31_60.reduce((s, b) => s + Number(b.solde), 0) },
      days_61_90: { count: aging.days_61_90.length, amount: aging.days_61_90.reduce((s, b) => s + Number(b.solde), 0) },
      over_90: { count: aging.over_90.length, amount: aging.over_90.reduce((s, b) => s + Number(b.solde), 0) }
    };
  }

  async getVolumeMetrics(startDate: Date, endDate: Date): Promise<any> {
    const bordereaux = await this.bordereauRepo.find({
      where: {
        dateEmission: Between(startDate, endDate)
      }
    });

    const metrics = {
      total_generated: bordereaux.length,
      by_type: {},
      by_status: {},
      avg_processing_time: 0,
      total_amount: 0
    };

    let totalProcessingDays = 0;
    let processedCount = 0;

    bordereaux.forEach(b => {
      metrics.by_type[b.type] = (metrics.by_type[b.type] || 0) + 1;
      metrics.by_status[b.status] = (metrics.by_status[b.status] || 0) + 1;
      metrics.total_amount += Number(b.primeTotale);

      if (b.dateValidation) {
        const days = Math.floor((b.dateValidation.getTime() - b.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        totalProcessingDays += days;
        processedCount++;
      }
    });

    metrics.avg_processing_time = processedCount > 0 ? totalProcessingDays / processedCount : 0;

    return metrics;
  }
}