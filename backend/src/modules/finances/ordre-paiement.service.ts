import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { OrdrePaiement, PaymentOrderStatus } from './ordre-paiement.entity';
import { Decaissement } from './decaissement.entity';
import { CreateOrdrePaiementDto } from './dto/create-ordre-paiement.dto';
import { PDFGeneratorService } from './pdf-generator.service';
import { AuditLog, AuditActionType, AuditEntityType } from './audit-log.entity';
import { join } from 'path';

@Injectable()
export class OrdrePaiementService {
  constructor(
    @InjectRepository(OrdrePaiement)
    private readonly ordreRepo: Repository<OrdrePaiement>,
    @InjectRepository(Decaissement)
    private readonly decaissementRepo: Repository<Decaissement>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly pdfGenerator: PDFGeneratorService,
  ) {}

  async create(dto: CreateOrdrePaiementDto, userId: string): Promise<OrdrePaiement> {
    const decaissement = await this.decaissementRepo.findOne({
      where: { id: dto.decaissementId },
      relations: ['reassureur', 'cedante', 'courtier'],
    });

    if (!decaissement) {
      throw new NotFoundException(`Decaissement ${dto.decaissementId} not found`);
    }

    const numero = await this.generateNumero();
    const beneficiaire = dto.beneficiaire || {
      nom: decaissement.reassureur?.raisonSociale || decaissement.cedante?.raisonSociale || '',
      banque: decaissement.banqueBeneficiaire?.nom || '',
      iban: decaissement.banqueBeneficiaire?.iban || '',
      adresse: decaissement.banqueBeneficiaire?.adresse || '',
      pays: decaissement.banqueBeneficiaire?.pays || '',
    };

    const ordre = this.ordreRepo.create({
      ...dto,
      numero,
      dateCreation: new Date(),
      beneficiaire,
      statut: PaymentOrderStatus.BROUILLON,
      creeParId: userId,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'CREATION',
        user: userId,
        details: 'Ordre de paiement créé',
      }],
    });

    const saved = await this.ordreRepo.save(ordre);

    await this.auditLogRepo.save({
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.ORDRE_PAIEMENT,
      entityId: saved.id,
      userId,
      userEmail: '',
      description: `Ordre de paiement créé: ${saved.numero}`,
      afterValues: saved,
    });

    return saved;
  }

  async findAll(filters?: { statut?: PaymentOrderStatus }): Promise<OrdrePaiement[]> {
    const query = this.ordreRepo.createQueryBuilder('op')
      .leftJoinAndSelect('op.decaissement', 'decaissement')
      .leftJoinAndSelect('op.createdBy', 'createdBy');

    if (filters?.statut) {
      query.andWhere('op.statut = :statut', { statut: filters.statut });
    }

    return query.orderBy('op.dateCreation', 'DESC').getMany();
  }

  async findOne(id: string): Promise<OrdrePaiement> {
    const ordre = await this.ordreRepo.findOne({
      where: { id },
      relations: ['decaissement', 'createdBy'],
    });

    if (!ordre) {
      throw new NotFoundException(`Ordre de paiement ${id} not found`);
    }

    return ordre;
  }

  async verify(id: string, userId: string): Promise<OrdrePaiement> {
    const ordre = await this.findOne(id);

    if (ordre.statut !== PaymentOrderStatus.BROUILLON) {
      throw new BadRequestException('Only BROUILLON orders can be verified');
    }

    ordre.statut = PaymentOrderStatus.VERIFIE;
    ordre.verificateurId = userId;
    ordre.dateVerification = new Date();
    ordre.historique.push({
      date: new Date(),
      action: 'VERIFICATION',
      user: userId,
      details: 'Ordre vérifié',
    });

    return this.ordreRepo.save(ordre);
  }

  async sign(id: string, userId: string, commentaire?: string): Promise<OrdrePaiement> {
    const ordre = await this.findOne(id);

    if (ordre.statut !== PaymentOrderStatus.VERIFIE) {
      throw new BadRequestException('Only VERIFIE orders can be signed');
    }

    ordre.statut = PaymentOrderStatus.SIGNE;
    ordre.ordinateurId = userId;
    ordre.dateSignature = new Date();
    ordre.commentaireSignature = commentaire;
    ordre.historique.push({
      date: new Date(),
      action: 'SIGNATURE',
      user: userId,
      details: commentaire || 'Ordre signé',
    });

    // Generate PDF after signature
    const pdfPath = join(process.cwd(), 'uploads', 'ordres-paiement', `${ordre.numero}.pdf`);
    await this.pdfGenerator.generateOrdrePaiementPDF(ordre, pdfPath);
    ordre.cheminPDF = pdfPath;
    ordre.dateGeneration = new Date();

    return this.ordreRepo.save(ordre);
  }

  async transmit(id: string, userId: string, referenceBank?: string): Promise<OrdrePaiement> {
    const ordre = await this.findOne(id);

    if (ordre.statut !== PaymentOrderStatus.SIGNE) {
      throw new BadRequestException('Only SIGNE orders can be transmitted');
    }

    ordre.statut = PaymentOrderStatus.TRANSMIS;
    ordre.dateTransmission = new Date();
    ordre.transmisParId = userId;
    ordre.referenceBank = referenceBank;
    ordre.historique.push({
      date: new Date(),
      action: 'TRANSMISSION',
      user: userId,
      details: `Transmis à la banque${referenceBank ? ` - Ref: ${referenceBank}` : ''}`,
    });

    return this.ordreRepo.save(ordre);
  }

  private async generateNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.ordreRepo.count({
      where: { numero: Like(`OP-${year}-%`) },
    });
    return `OP-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
