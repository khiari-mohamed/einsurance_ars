import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Like } from 'typeorm';
import { Affaire } from '../affaires/affaires.entity';
import { Encaissement, EncaissementStatus } from './encaissement.entity';
import { Decaissement, DecaissementStatus } from './decaissement.entity';
import { BankMovement, MovementType } from './bank-movement.entity';
import { AccountingService } from './accounting.service';
import { AuditLog, AuditActionType, AuditEntityType } from './audit-log.entity';
import { CreateEncaissementDto } from './dto/create-encaissement.dto';
import { UpdateEncaissementDto } from './dto/update-encaissement.dto';
import { CreateDecaissementDto } from './dto/create-decaissement.dto';
import { UpdateDecaissementDto } from './dto/update-decaissement.dto';

@Injectable()
export class FinancesService {
  constructor(
    @InjectRepository(Encaissement)
    private encaissementRepo: Repository<Encaissement>,
    @InjectRepository(Decaissement)
    private decaissementRepo: Repository<Decaissement>,
    @InjectRepository(BankMovement)
    private bankMovementRepo: Repository<BankMovement>,
    @InjectRepository(Affaire)
    private affaireRepo: Repository<Affaire>,
    private accountingService: AccountingService,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  // ==================== ENCAISSEMENTS ====================

  async createEncaissement(dto: CreateEncaissementDto, userId: string): Promise<Encaissement> {
    const numero = await this.generateEncaissementNumero();
    const tauxChange = dto.tauxChange || 1;
    const montantEquivalentTND = dto.montant * tauxChange;

    const encaissement = this.encaissementRepo.create({
      ...dto,
      numero,
      tauxChange,
      montantEquivalentTND,
      statut: EncaissementStatus.SAISI,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'CREATION',
        user: userId,
        details: 'Encaissement créé',
      }],
    });

    return this.encaissementRepo.save(encaissement);
  }

  async findAllEncaissements(filters?: {
    startDate?: string;
    endDate?: string;
    sourceType?: string;
    statut?: EncaissementStatus;
    affaireId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Encaissement[]; total: number; page: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;
    const query = this.encaissementRepo.createQueryBuilder('enc')
      .leftJoinAndSelect('enc.cedante', 'cedante')
      .leftJoinAndSelect('enc.client', 'client')
      .leftJoinAndSelect('enc.reassureur', 'reassureur')
      .leftJoinAndSelect('enc.courtier', 'courtier')
      .leftJoinAndSelect('enc.affaire', 'affaire')
      .leftJoinAndSelect('enc.bordereau', 'bordereau')
      .leftJoinAndSelect('enc.createdBy', 'createdBy')
      .leftJoinAndSelect('enc.validePar', 'validePar');

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('enc.dateEncaissement BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters?.sourceType) {
      query.andWhere('enc.sourceType = :sourceType', { sourceType: filters.sourceType });
    }

    if (filters?.statut) {
      query.andWhere('enc.statut = :statut', { statut: filters.statut });
    }

    if (filters?.affaireId) {
      query.andWhere('enc.affaireId = :affaireId', { affaireId: filters.affaireId });
    }

    const [data, total] = await query
      .orderBy('enc.dateEncaissement', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneEncaissement(id: string): Promise<Encaissement> {
    const encaissement = await this.encaissementRepo.findOne({
      where: { id },
      relations: ['cedante', 'client', 'reassureur', 'courtier', 'affaire', 'bordereau', 'createdBy', 'validePar'],
    });

    if (!encaissement) {
      throw new NotFoundException(`Encaissement ${id} not found`);
    }

    return encaissement;
  }

  async updateEncaissement(id: string, dto: UpdateEncaissementDto, userId: string): Promise<Encaissement> {
    const encaissement = await this.findOneEncaissement(id);

    if (encaissement.statut === EncaissementStatus.COMPTABILISE) {
      throw new BadRequestException('Cannot update comptabilized encaissement');
    }

    if (dto.montant || dto.tauxChange) {
      const montant = dto.montant || encaissement.montant;
      const tauxChange = dto.tauxChange || encaissement.tauxChange;
      encaissement.montantEquivalentTND = montant * tauxChange;
    }

    Object.assign(encaissement, dto);

    encaissement.historique.push({
      date: new Date(),
      action: 'MODIFICATION',
      user: userId,
      details: 'Encaissement modifié',
    });

    return this.encaissementRepo.save(encaissement);
  }

  async validateEncaissement(id: string, userId: string): Promise<Encaissement> {
    const encaissement = await this.findOneEncaissement(id);

    // State machine validation
    const validTransitions = {
      [EncaissementStatus.BROUILLON]: [EncaissementStatus.SAISI],
      [EncaissementStatus.SAISI]: [EncaissementStatus.VALIDE, EncaissementStatus.ANNULE],
      [EncaissementStatus.VALIDE]: [EncaissementStatus.COMPTABILISE, EncaissementStatus.ANNULE],
      [EncaissementStatus.COMPTABILISE]: [],
      [EncaissementStatus.ANNULE]: [],
    };

    if (!validTransitions[encaissement.statut]?.includes(EncaissementStatus.VALIDE)) {
      throw new BadRequestException(`Cannot validate from status ${encaissement.statut}`);
    }

    encaissement.statut = EncaissementStatus.VALIDE;
    encaissement.valideParId = userId;
    encaissement.dateValidation = new Date();

    encaissement.historique.push({
      date: new Date(),
      action: 'VALIDATION',
      user: userId,
      details: 'Encaissement validé',
    });

    const saved = await this.encaissementRepo.save(encaissement);

    // Create bank movement
    await this.createBankMovement({
      type: MovementType.ENCAISSEMENT,
      encaissementId: saved.id,
      compteBancaire: saved.compteBancaireId || 'DEFAULT',
      montant: saved.montantEquivalentTND,
      devise: saved.devise,
      dateMovement: saved.dateEncaissement,
      description: `Encaissement ${saved.numero}`,
    });

    // Audit log for validation
    await this.auditLogRepo.save({
      actionType: AuditActionType.VALIDATE,
      entityType: AuditEntityType.ENCAISSEMENT,
      entityId: saved.id,
      userId,
      userEmail: '',
      description: `Encaissement validated: ${saved.numero}`,
      afterValues: saved,
    });

    return saved;
  }

  async comptabilizeEncaissement(id: string, pieceComptable: string, userId: string): Promise<Encaissement> {
    const encaissement = await this.findOneEncaissement(id);

    if (encaissement.statut !== EncaissementStatus.VALIDE) {
      throw new BadRequestException('Only VALIDE encaissements can be comptabilized');
    }

    encaissement.statut = EncaissementStatus.COMPTABILISE;
    encaissement.pieceComptable = pieceComptable;

    encaissement.historique.push({
      date: new Date(),
      action: 'COMPTABILISATION',
      user: userId,
      details: `Pièce comptable: ${pieceComptable}`,
    });

    // Create accounting entry via AccountingService
    try {
      const entry = await this.accountingService.createEncaissementEntry(encaissement.id, userId);
      encaissement.pieceComptable = entry.reference;
      encaissement.statut = EncaissementStatus.COMPTABILISE;
    } catch (err) {
      // If accounting entry creation fails, propagate error
      throw err;
    }

    const saved = await this.encaissementRepo.save(encaissement);

    // Audit log for comptabilization
    await this.auditLogRepo.save({
      actionType: AuditActionType.COMPTABILIZE,
      entityType: AuditEntityType.ENCAISSEMENT,
      entityId: saved.id,
      userId,
      userEmail: '',
      description: `Encaissement comptabilized: ${saved.numero} - Piece: ${saved.pieceComptable}`,
      afterValues: saved,
    });

    return saved;
  }

  async deleteEncaissement(id: string): Promise<void> {
    const encaissement = await this.findOneEncaissement(id);

    if (encaissement.statut === EncaissementStatus.COMPTABILISE) {
      throw new BadRequestException('Cannot delete comptabilized encaissement');
    }

    await this.encaissementRepo.softRemove(encaissement);
  }

  // ==================== DECAISSEMENTS ====================

  async createDecaissement(dto: CreateDecaissementDto, userId: string): Promise<Decaissement> {
    const numero = await this.generateDecaissementNumero();
    const tauxChange = dto.tauxChange || 1;
    const montantEquivalentTND = dto.montant * tauxChange;

    // AML check for large payments
    if (montantEquivalentTND > 50000) {
      // Log for AML compliance
      console.warn(`Large payment detected: ${numero} - ${montantEquivalentTND} TND - Beneficiary: ${dto.beneficiaireType}`);
    }
    const fraisBancaires = dto.fraisBancaires || 0;
    const montantTotal = dto.montant + fraisBancaires;

    // Calculate commission from affaire if linked
    let commissionARS = dto.commissionARS || 0;
    let commissionCedante = dto.commissionCedante || 0;
    
    if (dto.affaireId) {
      const affaire = await this.affaireRepo.findOne({ where: { id: dto.affaireId } });
      if (affaire) {
        // Calculate ARS commission from contract rate
        commissionARS = dto.montant * (Number(affaire.tauxCommissionARS) / 100);
        commissionCedante = dto.montant * (Number(affaire.tauxCommissionCedante) / 100);
      }
    }

    const montantNetReassureur = dto.montant - commissionARS;

    const decaissement = this.decaissementRepo.create({
      ...dto,
      numero,
      tauxChange,
      montantEquivalentTND,
      fraisBancaires,
      montantTotal,
      commissionARS,
      commissionCedante,
      montantNetReassureur,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'CREATION',
        user: userId,
        details: 'Décaissement créé',
      }],
    });

    return this.decaissementRepo.save(decaissement);
  }

  async findAllDecaissements(filters?: {
    startDate?: string;
    endDate?: string;
    beneficiaireType?: string;
    statut?: DecaissementStatus;
    affaireId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Decaissement[]; total: number; page: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;
    const query = this.decaissementRepo.createQueryBuilder('dec')
      .leftJoinAndSelect('dec.reassureur', 'reassureur')
      .leftJoinAndSelect('dec.cedante', 'cedante')
      .leftJoinAndSelect('dec.courtier', 'courtier')
      .leftJoinAndSelect('dec.affaire', 'affaire')
      .leftJoinAndSelect('dec.bordereau', 'bordereau')
      .leftJoinAndSelect('dec.situation', 'situation')
      .leftJoinAndSelect('dec.createdBy', 'createdBy');

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('dec.dateDecaissement BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    if (filters?.beneficiaireType) {
      query.andWhere('dec.beneficiaireType = :beneficiaireType', { beneficiaireType: filters.beneficiaireType });
    }

    if (filters?.statut) {
      query.andWhere('dec.statut = :statut', { statut: filters.statut });
    }

    if (filters?.affaireId) {
      query.andWhere('dec.affaireId = :affaireId', { affaireId: filters.affaireId });
    }

    const [data, total] = await query
      .orderBy('dec.dateDecaissement', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOneDecaissement(id: string): Promise<Decaissement> {
    const decaissement = await this.decaissementRepo.findOne({
      where: { id },
      relations: ['reassureur', 'cedante', 'courtier', 'affaire', 'bordereau', 'situation', 'createdBy'],
    });

    if (!decaissement) {
      throw new NotFoundException(`Décaissement ${id} not found`);
    }

    return decaissement;
  }

  async updateDecaissement(id: string, dto: UpdateDecaissementDto, userId: string): Promise<Decaissement> {
    const decaissement = await this.findOneDecaissement(id);

    if (decaissement.statut === DecaissementStatus.COMPTABILISE) {
      throw new BadRequestException('Cannot update comptabilized decaissement');
    }

    if (dto.montant || dto.tauxChange || dto.fraisBancaires || dto.commissionARS) {
      const montant = dto.montant || decaissement.montant;
      const tauxChange = dto.tauxChange || decaissement.tauxChange;
      const fraisBancaires = dto.fraisBancaires !== undefined ? dto.fraisBancaires : decaissement.fraisBancaires;
      const commissionARS = dto.commissionARS !== undefined ? dto.commissionARS : decaissement.commissionARS;

      decaissement.montantEquivalentTND = montant * tauxChange;
      decaissement.montantTotal = montant + fraisBancaires;
      decaissement.montantNetReassureur = montant - commissionARS;
    }

    Object.assign(decaissement, dto);

    decaissement.historique.push({
      date: new Date(),
      action: 'MODIFICATION',
      user: userId,
      details: 'Décaissement modifié',
    });

    return this.decaissementRepo.save(decaissement);
  }

  async approveDecaissement(id: string, niveau: number, userId: string, commentaire?: string): Promise<Decaissement> {
    const decaissement = await this.findOneDecaissement(id);

    // Four-Eyes Principle: Cannot approve own payment
    if (decaissement.createdById === userId) {
      throw new BadRequestException('Cannot approve your own payment');
    }

    // Check if user already approved at any level
    const alreadyApproved = decaissement.approbations.some(a => a.approbePar === userId);
    if (alreadyApproved) {
      throw new BadRequestException('You have already approved this payment');
    }

    // Approval matrix based on amount
    const montantTND = Number(decaissement.montantEquivalentTND);
    if (montantTND > 200000 && niveau < 2) {
      throw new BadRequestException('Amount exceeds 200,000 TND - Level 2 approval required');
    }
    if (montantTND > 50000 && niveau < 1) {
      throw new BadRequestException('Amount exceeds 50,000 TND - Level 1 approval required');
    }

    const validStatuses = [DecaissementStatus.BROUILLON, DecaissementStatus.APPROUVE_N1];
    if (!validStatuses.includes(decaissement.statut)) {
      throw new BadRequestException('Invalid status for approval');
    }

    decaissement.approbations.push({
      niveau,
      approbePar: userId,
      date: new Date(),
      commentaire,
    });

    if (niveau === 1) {
      decaissement.statut = DecaissementStatus.APPROUVE_N1;
    } else if (niveau === 2) {
      decaissement.statut = DecaissementStatus.APPROUVE_N2;
    }

    decaissement.historique.push({
      date: new Date(),
      action: `APPROBATION_N${niveau}`,
      user: userId,
      details: commentaire || `Approuvé niveau ${niveau}`,
    });

    return this.decaissementRepo.save(decaissement);
  }

  async ordonnancerDecaissement(id: string, userId: string): Promise<Decaissement> {
    const decaissement = await this.findOneDecaissement(id);

    if (decaissement.statut !== DecaissementStatus.APPROUVE_N2) {
      throw new BadRequestException('Only APPROUVE_N2 decaissements can be ordonnanced');
    }

    const numeroOrdrePaiement = await this.generateOrdrePaiementNumero();
    decaissement.ordonnancement = {
      numeroOrdrePaiement,
      dateOrdonnancement: new Date(),
      ordonnateur: userId,
    };
    decaissement.statut = DecaissementStatus.ORDONNANCE;

    decaissement.historique.push({
      date: new Date(),
      action: 'ORDONNANCEMENT',
      user: userId,
      details: `Ordre de paiement: ${numeroOrdrePaiement}`,
    });

    return this.decaissementRepo.save(decaissement);
  }

  async executeDecaissement(id: string, userId: string): Promise<Decaissement> {
    const decaissement = await this.findOneDecaissement(id);

    if (decaissement.statut !== DecaissementStatus.ORDONNANCE) {
      throw new BadRequestException('Only ORDONNANCE decaissements can be executed');
    }

    decaissement.statut = DecaissementStatus.EXECUTE;

    decaissement.historique.push({
      date: new Date(),
      action: 'EXECUTION',
      user: userId,
      details: 'Paiement exécuté',
    });

    const saved = await this.decaissementRepo.save(decaissement);

    // Create bank movement
    await this.createBankMovement({
      type: MovementType.DECAISSEMENT,
      decaissementId: saved.id,
      compteBancaire: saved.compteBancaireDebite || 'DEFAULT',
      montant: saved.montantEquivalentTND,
      devise: saved.devise,
      dateMovement: saved.dateDecaissement,
      description: `Décaissement ${saved.numero}`,
    });

    // After execution, create accounting entry for decaissement
    try {
      const entry = await this.accountingService.createDecaissementEntry(saved.id, userId);
      saved.pieceComptable = entry.reference;
      saved.statut = DecaissementStatus.COMPTABILISE;
      await this.decaissementRepo.save(saved);

      // Audit log for comptabilization
      await this.auditLogRepo.save({
        actionType: AuditActionType.COMPTABILIZE,
        entityType: AuditEntityType.DECAISSEMENT,
        entityId: saved.id,
        userId,
        userEmail: '',
        description: `Décaissement comptabilized: ${saved.numero} - Piece: ${saved.pieceComptable}`,
        afterValues: saved,
      });
    } catch (err) {
      // If accounting creation fails, still return saved decaissement but surface the error
      console.error('Failed to create accounting entry for decaissement', err);
      throw err;
    }

    return saved;
  }

  async deleteDecaissement(id: string): Promise<void> {
    const decaissement = await this.findOneDecaissement(id);

    if (decaissement.statut === DecaissementStatus.COMPTABILISE) {
      throw new BadRequestException('Cannot delete comptabilized decaissement');
    }

    await this.decaissementRepo.softRemove(decaissement);
  }

  // ==================== BANK MOVEMENTS ====================

  private async createBankMovement(data: {
    type: MovementType;
    encaissementId?: string;
    decaissementId?: string;
    compteBancaire: string;
    montant: number;
    devise: string;
    dateMovement: Date;
    description: string;
  }): Promise<BankMovement> {
    const reference = await this.generateBankMovementReference();
    const lastMovement = await this.bankMovementRepo.findOne({
      where: { compteBancaire: data.compteBancaire },
      order: { createdAt: 'DESC' },
    });

    const soldeAvant = lastMovement?.soldeApres || 0;
    const soldeApres = data.type === MovementType.ENCAISSEMENT
      ? soldeAvant + data.montant
      : soldeAvant - data.montant;

    const movement = this.bankMovementRepo.create({
      ...data,
      reference,
      soldeAvant,
      soldeApres,
    });

    return this.bankMovementRepo.save(movement);
  }

  async findAllBankMovements(compteBancaire?: string): Promise<BankMovement[]> {
    const query = this.bankMovementRepo.createQueryBuilder('bm')
      .leftJoinAndSelect('bm.encaissement', 'encaissement')
      .leftJoinAndSelect('bm.decaissement', 'decaissement');

    if (compteBancaire) {
      query.where('bm.compteBancaire = :compteBancaire', { compteBancaire });
    }

    return query.orderBy('bm.dateMovement', 'DESC').getMany();
  }

  // ==================== REPORTS ====================

  async getCashFlowReport(startDate: string, endDate: string): Promise<any> {
    const encaissements = await this.encaissementRepo.find({
      where: {
        dateEncaissement: Between(new Date(startDate), new Date(endDate)),
        statut: In([EncaissementStatus.VALIDE, EncaissementStatus.COMPTABILISE]),
      },
    });

    const decaissements = await this.decaissementRepo.find({
      where: {
        dateDecaissement: Between(new Date(startDate), new Date(endDate)),
        statut: In([DecaissementStatus.EXECUTE, DecaissementStatus.COMPTABILISE]),
      },
    });

    const totalEncaissements = encaissements.reduce((sum, e) => sum + Number(e.montantEquivalentTND), 0);
    const totalDecaissements = decaissements.reduce((sum, d) => sum + Number(d.montantEquivalentTND), 0);

    return {
      periode: { startDate, endDate },
      totalEncaissements,
      totalDecaissements,
      soldeNet: totalEncaissements - totalDecaissements,
      encaissements: encaissements.length,
      decaissements: decaissements.length,
    };
  }

  async getAgingReport(type: 'creances' | 'dettes'): Promise<any> {
    // Implementation for aging report
    return {
      type,
      ranges: [
        { label: '0-30 jours', count: 0, montant: 0 },
        { label: '31-60 jours', count: 0, montant: 0 },
        { label: '61-90 jours', count: 0, montant: 0 },
        { label: '+90 jours', count: 0, montant: 0 },
      ],
    };
  }

  // ==================== UTILITIES ====================

  private async generateEncaissementNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.encaissementRepo.count({
      where: { numero: Like(`ENC-${year}-%`) },
    });
    return `ENC-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateDecaissementNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.decaissementRepo.count({
      where: { numero: Like(`DEC-${year}-%`) },
    });
    return `DEC-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async generateBankMovementReference(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.bankMovementRepo.count();
    return `BM-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private async generateOrdrePaiementNumero(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.decaissementRepo.count({
      where: { statut: In([DecaissementStatus.ORDONNANCE, DecaissementStatus.EXECUTE, DecaissementStatus.COMPTABILISE]) },
    });
    return `OP-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  // ==================== SWIFT CONFIRMATION ====================

  async attachSwiftConfirmation(decaissementId: string, swiftDocumentUrl: string, userId: string): Promise<Decaissement> {
    const decaissement = await this.findOneDecaissement(decaissementId);

    decaissement.swiftDocumentUrl = swiftDocumentUrl;
    decaissement.swiftUploadedAt = new Date();
    decaissement.swiftConfirmationReceived = true;

    decaissement.historique.push({
      date: new Date(),
      action: 'SWIFT_UPLOADED',
      user: userId,
      details: 'SWIFT confirmation attached',
    });

    return this.decaissementRepo.save(decaissement);
  }
}
