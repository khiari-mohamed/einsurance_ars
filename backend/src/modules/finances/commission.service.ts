import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, Like } from 'typeorm';
import { Commission, CommissionType, CommissionStatus, CalculationBase } from './commission.entity';
import { AccountingService } from './accounting.service';
import { CreateCommissionDto } from './dto/create-commission.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';
import { Affaire } from '../affaires/affaires.entity';
import { AuditLog, AuditActionType, AuditEntityType } from './audit-log.entity';

@Injectable()
export class CommissionService {
  constructor(
    @InjectRepository(Commission)
    private commissionRepo: Repository<Commission>,
    @InjectRepository(Affaire)
    private affaireRepo: Repository<Affaire>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
    private accountingService: AccountingService,
  ) {}

  // ==================== COMMISSION CREATION & CALCULATION ====================

  async createCommission(dto: CreateCommissionDto, userId: string): Promise<Commission> {
    // Validate affaire exists
    const affaire = await this.affaireRepo.findOne({ where: { id: dto.affaireId } });
    if (!affaire) {
      throw new NotFoundException(`Affaire ${dto.affaireId} not found`);
    }

    // Calculate montant if not provided
    let montant = dto.montant;
    if (!montant) {
      montant = dto.baseMontant * (dto.taux / 100);
    }

    // Validate commission limits
    this.validateCommissionLimits(dto, montant, affaire);

    const numero = await this.generateCommissionNumero(dto.type);

    const commission = this.commissionRepo.create({
      ...dto,
      numero,
      montant,
      dateCalcul: new Date(),
      statut: CommissionStatus.CALCULEE,
      createdById: userId,
      historique: [{
        date: new Date(),
        action: 'CREATION',
        user: userId,
        details: `Commission ${dto.type} créée - ${montant.toFixed(2)} TND`,
      }],
    });

    const saved = await this.commissionRepo.save(commission);

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.COMMISSION,
      entityId: saved.id,
      userId,
      userEmail: '', // From JWT context
      description: `Created commission: ${saved.numero} - Type: ${saved.type} - Amount: ${saved.montant}`,
      afterValues: saved,
    });

    return saved;
  }

  async findAllCommissions(filters?: {
    affaireId?: string;
    type?: CommissionType;
    statut?: CommissionStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Commission[]; total: number; page: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const query = this.commissionRepo.createQueryBuilder('com')
      .leftJoinAndSelect('com.affaire', 'affaire')
      .leftJoinAndSelect('com.bordereau', 'bordereau')
      .leftJoinAndSelect('com.cedante', 'cedante')
      .leftJoinAndSelect('com.courtier', 'courtier')
      .leftJoinAndSelect('com.createdBy', 'createdBy');

    if (filters?.affaireId) {
      query.andWhere('com.affaireId = :affaireId', { affaireId: filters.affaireId });
    }

    if (filters?.type) {
      query.andWhere('com.type = :type', { type: filters.type });
    }

    if (filters?.statut) {
      query.andWhere('com.statut = :statut', { statut: filters.statut });
    }

    if (filters?.startDate && filters?.endDate) {
      query.andWhere('com.dateCalcul BETWEEN :startDate AND :endDate', {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
    }

    const [data, total] = await query
      .orderBy('com.dateCalcul', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOneCommission(id: string): Promise<Commission> {
    const commission = await this.commissionRepo.findOne({
      where: { id },
      relations: ['affaire', 'bordereau', 'cedante', 'courtier', 'createdBy'],
    });

    if (!commission) {
      throw new NotFoundException(`Commission ${id} not found`);
    }

    return commission;
  }

  async updateCommission(id: string, dto: UpdateCommissionDto, userId: string): Promise<Commission> {
    const commission = await this.findOneCommission(id);

    // Cannot modify if already paid
    if (commission.statut === CommissionStatus.PAYEE) {
      throw new BadRequestException('Cannot modify paid commission');
    }

    const beforeValues = { ...commission };

    // If montant is provided and differs from calculation
    if (dto.montant && dto.montant !== commission.montant) {
      commission.tauxOverride = true;
      commission.overrideByUserId = userId;
    }

    Object.assign(commission, dto);

    commission.historique.push({
      date: new Date(),
      action: 'MODIFICATION',
      user: userId,
      details: `Commission modifiée`,
    });

    const saved = await this.commissionRepo.save(commission);

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.UPDATE,
      entityType: AuditEntityType.COMMISSION,
      entityId: saved.id,
      userId,
      userEmail: '',
      beforeValues: beforeValues,
      afterValues: saved,
      changedFields: Object.keys(dto),
    });

    return saved;
  }

  async markAsPaid(commissionId: string, decaissementId: string, userId: string): Promise<Commission> {
    const commission = await this.findOneCommission(commissionId);

    if (commission.statut === CommissionStatus.PAYEE) {
      throw new BadRequestException('Commission already marked as paid');
    }

    commission.statut = CommissionStatus.PAYEE;
    commission.datePaiement = new Date();
    commission.decaissementId = decaissementId;

    commission.historique.push({
      date: new Date(),
      action: 'PAIEMENT',
      user: userId,
      details: `Commission payée via décaissement ${decaissementId}`,
    });

    const saved = await this.commissionRepo.save(commission);

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.UPDATE,
      entityType: AuditEntityType.COMMISSION,
      entityId: saved.id,
      userId,
      userEmail: '',
      description: `Commission marked as paid: ${commission.numero}`,
      afterValues: { statut: CommissionStatus.PAYEE, decaissementId },
    });

    return saved;
  }

  // ==================== COMMISSION CALCULATIONS ====================

  /**
   * Calculate all commissions for an affaire based on contract terms
   */
  async calculateAffaireCommissions(affaireId: string, bordereauId?: string, userId?: string): Promise<Commission[]> {
    const affaire = await this.affaireRepo.findOne({ where: { id: affaireId } });
    if (!affaire) {
      throw new NotFoundException(`Affaire ${affaireId} not found`);
    }

    const createdCommissions: Commission[] = [];

    // Commission ARS (on prime cédée)
    if (affaire.tauxCommissionARS) {
      const commissionARS = await this.createCommission(
        {
          type: CommissionType.ARS,
          affaireId,
          bordereauId,
          baseCalcul: CalculationBase.PRIME_CEDEE,
          baseMontant: Number(affaire.primeCedee) || 0,
          taux: Number(affaire.tauxCommissionARS),
          tauxMax: 30,
        },
        userId || 'SYSTEM',
      );
      createdCommissions.push(commissionARS);
    }

    // Commission Cédante
    if (affaire.tauxCommissionCedante) {
      const commissionCedante = await this.createCommission(
        {
          type: CommissionType.CEDANTE,
          affaireId,
          cedanteId: affaire.cedanteId,
          bordereauId,
          baseCalcul: CalculationBase.PRIME_CEDEE,
          baseMontant: Number(affaire.primeCedee) || 0,
          taux: Number(affaire.tauxCommissionCedante),
        },
        userId || 'SYSTEM',
      );
      createdCommissions.push(commissionCedante);
    }

    // Commission Courtier (if applicable)
    if (affaire.coCourtierId) {
      const commissionCourtier = await this.createCommission(
        {
          type: CommissionType.COURTIER,
          affaireId,
          courtierId: affaire.coCourtierId,
          bordereauId,
          baseCalcul: CalculationBase.PRIME_CEDEE,
          baseMontant: Number(affaire.primeCedee) || 0,
          taux: Number(affaire.tauxCommissionCedante),
        },
        userId || 'SYSTEM',
      );
      createdCommissions.push(commissionCourtier);
    }

    return createdCommissions;
  }

  /**
   * Get total commission due for payment
   */
  async getTotalCommissionsDue(filters?: { type?: CommissionType; affaireId?: string }): Promise<number> {
    const query = this.commissionRepo.createQueryBuilder('com')
      .select('COALESCE(SUM(com.montant), 0)', 'total')
      .where('com.statut = :statut', { statut: CommissionStatus.A_PAYER });

    if (filters?.type) {
      query.andWhere('com.type = :type', { type: filters.type });
    }

    if (filters?.affaireId) {
      query.andWhere('com.affaireId = :affaireId', { affaireId: filters.affaireId });
    }

    const result = await query.getRawOne();
    return Number(result.total) || 0;
  }

  /**
   * Commission statement for reporting
   */
  async getCommissionStatement(startDate: string, endDate: string): Promise<any> {
    const commissions = await this.commissionRepo.find({
      where: {
        dateCalcul: Between(new Date(startDate), new Date(endDate)),
      },
      relations: ['affaire', 'cedante', 'courtier'],
    });

    const byType = {
      [CommissionType.ARS]: 0,
      [CommissionType.CEDANTE]: 0,
      [CommissionType.COURTIER]: 0,
    };

    const byStatus = {
      [CommissionStatus.CALCULEE]: 0,
      [CommissionStatus.A_PAYER]: 0,
      [CommissionStatus.PAYEE]: 0,
    };

    commissions.forEach(c => {
      byType[c.type] += Number(c.montant);
      byStatus[c.statut] += Number(c.montant);
    });

    return {
      periode: { startDate, endDate },
      totalCommissions: commissions.reduce((sum, c) => sum + Number(c.montant), 0),
      byType,
      byStatus,
      count: commissions.length,
      details: commissions,
    };
  }

  // ==================== VALIDATION ====================

  private validateCommissionLimits(dto: CreateCommissionDto, montant: number, affaire: Affaire): void {
    // Commission ARS should not exceed 30% of prime cédée
    if (dto.type === CommissionType.ARS) {
      const maxCommission = (Number(affaire.primeCedee) || 0) * 0.30;
      if (montant > maxCommission) {
        throw new BadRequestException(
          `Commission ARS (${montant.toFixed(2)}) exceeds maximum allowed (${maxCommission.toFixed(2)}) - 30% of prime cédée`,
        );
      }
    }

    // Validate taux max if provided
    if (dto.tauxMax && dto.taux > dto.tauxMax) {
      throw new BadRequestException(`Commission rate (${dto.taux}%) exceeds maximum allowed (${dto.tauxMax}%)`);
    }

    // Negative amounts not allowed
    if (montant < 0) {
      throw new BadRequestException('Commission montant cannot be negative');
    }
  }

  // ==================== UTILITIES ====================

  private async generateCommissionNumero(type: CommissionType): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = type === CommissionType.ARS ? 'CAR' : type === CommissionType.CEDANTE ? 'CCE' : 'CCO';
    const count = await this.commissionRepo.count({
      where: { numero: Like(`${prefix}-${year}-%`) },
    });
    return `${prefix}-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
