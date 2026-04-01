import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Like } from 'typeorm';
import { Settlement, SettlementType, SettlementStatus } from './settlement.entity';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { UpdateSettlementDto } from './dto/update-settlement.dto';
import { Affaire } from '../affaires/affaires.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { Bordereau } from '../bordereaux/bordereaux.entity';
import { Commission, CommissionType } from './commission.entity';
import { AuditLog, AuditActionType, AuditEntityType } from './audit-log.entity';

@Injectable()
export class SettlementService {
  constructor(
    @InjectRepository(Settlement)
    private settlementRepo: Repository<Settlement>,
    @InjectRepository(Affaire)
    private affaireRepo: Repository<Affaire>,
    @InjectRepository(Cedante)
    private cedanteRepo: Repository<Cedante>,
    @InjectRepository(Bordereau)
    private bordereauRepo: Repository<Bordereau>,
    @InjectRepository(Commission)
    private commissionRepo: Repository<Commission>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  // ==================== SETTLEMENT CREATION ====================

  async createSettlement(dto: CreateSettlementDto, userId: string): Promise<Settlement> {
    // Validate cedante exists
    const cedante = await this.cedanteRepo.findOne({ where: { id: dto.cedanteId } });
    if (!cedante) {
      throw new NotFoundException(`Cedante ${dto.cedanteId} not found`);
    }

    const numero = await this.generateSettlementNumero(dto.type);
    const dateDebut = new Date(dto.dateDebut);
    const dateFin = new Date(dto.dateFin);

    if (dateDebut >= dateFin) {
      throw new BadRequestException('Start date must be before end date');
    }

    const settlement = this.settlementRepo.create({
      ...dto,
      numero,
      dateDebut,
      dateFin,
      statut: SettlementStatus.EN_COURS,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'CREATION',
        user: userId,
        details: `Settlement created for ${cedante.raisonSociale}`,
      }],
    });

    const saved = await this.settlementRepo.save(settlement);

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.SETTLEMENT,
      entityId: saved.id,
      userId,
      userEmail: '',
      description: `Created settlement: ${saved.numero} - Period: ${dateDebut.toLocaleDateString()} to ${dateFin.toLocaleDateString()}`,
      afterValues: saved,
    });

    return saved;
  }

  async findAllSettlements(filters?: {
    cedanteId?: string;
    type?: SettlementType;
    statut?: SettlementStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Settlement[]; total: number; page: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const query = this.settlementRepo.createQueryBuilder('set')
      .leftJoinAndSelect('set.cedante', 'cedante')
      .leftJoinAndSelect('set.reassureur', 'reassureur')
      .leftJoinAndSelect('set.createdBy', 'createdBy');

    if (filters?.cedanteId) {
      query.andWhere('set.cedanteId = :cedanteId', { cedanteId: filters.cedanteId });
    }

    if (filters?.type) {
      query.andWhere('set.type = :type', { type: filters.type });
    }

    if (filters?.statut) {
      query.andWhere('set.statut = :statut', { statut: filters.statut });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('set.dateDebut BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    const [data, total] = await query
      .orderBy('set.dateDebut', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOneSettlement(id: string): Promise<Settlement> {
    const settlement = await this.settlementRepo.findOne({
      where: { id },
      relations: ['cedante', 'reassureur', 'createdBy'],
    });

    if (!settlement) {
      throw new NotFoundException(`Settlement ${id} not found`);
    }

    return settlement;
  }

  async updateSettlement(id: string, dto: UpdateSettlementDto, userId: string): Promise<Settlement> {
    const settlement = await this.findOneSettlement(id);

    // Cannot modify if already validated
    if (settlement.statut === SettlementStatus.VALIDEE) {
      throw new BadRequestException('Cannot modify validated settlement');
    }

    const beforeValues = { ...settlement };

    Object.assign(settlement, dto);

    settlement.historique.push({
      date: new Date(),
      action: 'MODIFICATION',
      user: userId,
      details: 'Settlement updated',
    });

    const saved = await this.settlementRepo.save(settlement);

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.UPDATE,
      entityType: AuditEntityType.SETTLEMENT,
      entityId: saved.id,
      userId,
      userEmail: '',
      beforeValues,
      afterValues: saved,
      changedFields: Object.keys(dto),
    });

    return saved;
  }

  // ==================== SETTLEMENT CALCULATION ====================

  /**
   * Calculate settlement by summing all affaires/bordereaux in the period
   */
  async calculateSettlement(settlementId: string, userId: string): Promise<Settlement> {
    const settlement = await this.findOneSettlement(settlementId);

    if (settlement.statut !== SettlementStatus.EN_COURS) {
      throw new BadRequestException('Only EN_COURS settlements can be calculated');
    }

    // Find all affaires for this cedante in the period
    const affaires = await this.affaireRepo.find({
      where: {
        cedanteId: settlement.cedanteId,
        createdAt: Between(settlement.dateDebut, settlement.dateFin),
      },
      relations: ['bordereaux'],
    });

    // Initialize totals
    let totalPrime = 0;
    let totalCommissionCedante = 0;
    let totalCommissionARS = 0;
    let totalCommissionCourtier = 0;
    let totalSinistre = 0;

    const lignes = [];

    // Process each affaire
    for (const affaire of affaires) {
      // Get commissions for this affaire
      const commissions = await this.commissionRepo.find({
        where: { affaireId: affaire.id },
      });

      let commissionCedante = 0;
      let commissionARS = 0;
      let commissionCourtier = 0;

      commissions.forEach(c => {
        if (c.type === CommissionType.CEDANTE) commissionCedante = Number(c.montant);
        if (c.type === CommissionType.ARS) commissionARS = Number(c.montant);
        if (c.type === CommissionType.COURTIER) commissionCourtier = Number(c.montant);
      });

      const primeCedee = Number(affaire.primeCedee) || 0;
      const netAPayer = primeCedee - commissionCedante - commissionARS;

      totalPrime += primeCedee;
      totalCommissionCedante += commissionCedante;
      totalCommissionARS += commissionARS;
      totalCommissionCourtier += commissionCourtier;
      // totalSinistre += affaire.sinistres... (would need to calculate from claims)

      // Add line item
      lignes.push({
        affaireId: affaire.id,
        referenceBordereau: affaire.numeroAffaire,
        type: affaire.type,
        prime100: primeCedee,
        primeCedee,
        tauxCession: Number(affaire.tauxCession) || 0,
        commissionCedante,
        commissionARS,
        commissionCourtier,
        sinistreMontant: 0, // Would be calculated from sinistres
        netAPayer,
        statutPaiement: 'IMPAYE',
      });
    }

    const totalAPayer = totalPrime - totalCommissionCedante - totalCommissionARS - totalSinistre;
    const soldePrecedent = 0; // Would be from previous settlement
    const soldeFinal = soldePrecedent + totalAPayer;

    settlement.totalPrime = totalPrime;
    settlement.totalCommissionCedante = totalCommissionCedante;
    settlement.totalCommissionARS = totalCommissionARS;
    settlement.totalCommissionCourtier = totalCommissionCourtier;
    settlement.totalSinistre = totalSinistre;
    settlement.totalAPayer = totalAPayer;
    settlement.soldePrecedent = soldePrecedent;
    settlement.soldeFinal = soldeFinal;
    settlement.lignes = lignes;
    settlement.statut = SettlementStatus.CALCULEE;
    settlement.dateCalcul = new Date();

    settlement.historique.push({
      date: new Date(),
      action: 'CALCULATION',
      user: userId,
      details: `Settlement calculated - Total: ${totalAPayer.toFixed(2)} TND`,
    });

    const saved = await this.settlementRepo.save(settlement);

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.UPDATE,
      entityType: AuditEntityType.SETTLEMENT,
      entityId: saved.id,
      userId,
      userEmail: '',
      description: `Settlement calculated: ${saved.numero} - Total amount: ${totalAPayer.toFixed(2)} TND`,
      afterValues: { statut: saved.statut, totalAPayer, totalPrime },
    });

    return saved;
  }

  /**
   * Validate settlement before sending
   */
  async validateSettlement(settlementId: string, userId: string): Promise<Settlement> {
    const settlement = await this.findOneSettlement(settlementId);

    if (settlement.statut !== SettlementStatus.CALCULEE) {
      throw new BadRequestException('Only CALCULEE settlements can be validated');
    }

    // Validate all amounts are correct
    if (settlement.lignes.length === 0) {
      throw new BadRequestException('Settlement has no line items');
    }

    if (settlement.totalAPayer < 0) {
      throw new BadRequestException('Settlement total cannot be negative');
    }

    settlement.statut = SettlementStatus.VALIDEE;
    settlement.dateValidation = new Date();
    settlement.valideParId = userId;

    settlement.approbations.push({
      niveau: 1,
      approbePar: userId,
      date: new Date(),
      commentaire: 'Validated by financial service',
    });

    settlement.historique.push({
      date: new Date(),
      action: 'VALIDATION',
      user: userId,
      details: 'Settlement validated',
    });

    const saved = await this.settlementRepo.save(settlement);

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.VALIDATE,
      entityType: AuditEntityType.SETTLEMENT,
      entityId: saved.id,
      userId,
      userEmail: '',
      description: `Settlement validated: ${saved.numero}`,
      afterValues: { statut: saved.statut, dateValidation: saved.dateValidation },
    });

    return saved;
  }

  // ==================== AUTO-GENERATION ====================

  /**
   * Auto-generate settlements based on contract périodicité
   */
  async generateMissingSettlements(): Promise<Settlement[]> {
    const cédantes = await this.cedanteRepo.find();
    const created: Settlement[] = [];

    for (const cedante of cédantes) {
      // Check what settlements are needed
      const now = new Date();

      // Monthly settlement (check if exists for this month)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const existingMonth = await this.settlementRepo.findOne({
        where: {
          cedanteId: cedante.id,
          type: SettlementType.MENSUELLE,
          dateDebut: monthStart,
          dateFin: monthEnd,
        },
      });

      if (!existingMonth) {
        const settlement = await this.createSettlement(
          {
            type: SettlementType.MENSUELLE,
            cedanteId: cedante.id,
            dateDebut: monthStart.toISOString().split('T')[0],
            dateFin: monthEnd.toISOString().split('T')[0],
          },
          'SYSTEM',
        );
        created.push(settlement);
      }
    }

    return created;
  }

  // ==================== UTILITIES ====================

  private async generateSettlementNumero(type: SettlementType): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const quarter = Math.ceil((new Date().getMonth() + 1) / 3);

    let prefix = '';
    if (type === SettlementType.MENSUELLE) {
      prefix = `SIT-${year}-M${month}`;
    } else if (type === SettlementType.TRIMESTRIELLE) {
      prefix = `SIT-${year}-Q${quarter}`;
    } else if (type === SettlementType.SEMESTRIELLE) {
      prefix = `SIT-${year}-S${Math.ceil((new Date().getMonth() + 1) / 6)}`;
    } else if (type === SettlementType.ANNUELLE) {
      prefix = `SIT-${year}-A`;
    }

    const count = await this.settlementRepo.count({
      where: { numero: Like(`${prefix}-%`) },
    });

    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }
}
