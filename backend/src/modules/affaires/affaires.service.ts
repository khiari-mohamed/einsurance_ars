import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Affaire, AffaireReassureur, AffaireStatus, CommissionCalculMode } from './affaires.entity';
import { CreateAffaireDto } from './dto/create-affaire.dto';
import { UpdateAffaireDto } from './dto/update-affaire.dto';
import { CommissionService } from './commission.service';
import { AffaireIntegrationService } from '../ged/affaire-integration.service';

@Injectable()
export class AffairesService {
  constructor(
    @InjectRepository(Affaire) private repo: Repository<Affaire>,
    @InjectRepository(AffaireReassureur) private reinsurerRepo: Repository<AffaireReassureur>,
    private commissionService: CommissionService,
    @Inject(forwardRef(() => AffaireIntegrationService))
    private gedIntegration: AffaireIntegrationService,
  ) {}

  async create(data: CreateAffaireDto, userId: string): Promise<Affaire> {
    this.validateReinsurerShares(data.reinsurers);

    const numeroAffaire = await this.generateNumeroAffaire();
    const calculations = this.calculateFinancials(data);

    const affaire = this.repo.create({
      category: data.category,
      type: data.type,
      assureId: data.assureId,
      cedanteId: data.cedanteId,
      coCourtierId: data.coCourtierId,
      numeroPolice: data.numeroPolice,
      branche: data.branche,
      garantie: data.garantie,
      dateEffet: data.dateEffet,
      dateEcheance: data.dateEcheance,
      dateNotification: data.dateNotification,
      devise: data.devise || 'TND',
      capitalAssure100: data.capitalAssure100,
      prime100: data.prime100,
      tauxCession: data.tauxCession,
      tauxCommissionCedante: data.tauxCommissionCedante || 0,
      modeCalculCommissionCedante: data.modeCalculCommissionCedante || CommissionCalculMode.AUTO,
      tauxCommissionARS: data.tauxCommissionARS || 0,
      modeCalculCommissionARS: data.modeCalculCommissionARS || CommissionCalculMode.AUTO,
      paymentMode: data.paymentMode,
      treatyType: data.treatyType as any,
      treatyBranches: data.treatyBranches,
      treatyZones: data.treatyZones,
      periodiciteComptes: data.periodiciteComptes as any,
      rubriquesComptes: data.rubriquesComptes,
      primePrevisionnelle: data.primePrevisionnelle,
      pmd: data.pmd,
      notes: data.notes,
      numeroAffaire,
      createdById: userId,
      primeCedee: calculations.primeCedee,
      montantCommissionCedante: calculations.montantCommissionCedante,
      montantCommissionARS: calculations.montantCommissionARS,
    });

    const saved = await this.repo.save(affaire);

    const reinsurers = data.reinsurers.map(r => {
      const reinsurerCalc = this.calculateReinsurerPart(calculations.primeCedee, calculations.montantCommissionARS, r.share);
      return this.reinsurerRepo.create({
        affaireId: saved.id,
        reassureurId: r.reassureurId,
        share: r.share,
        role: r.role || 'FOLLOWER',
        ...reinsurerCalc,
      });
    });

    await this.reinsurerRepo.save(reinsurers);
    
    try {
      await this.gedIntegration.onAffaireCreated(saved.id, data.type);
    } catch (error) {
      console.error('Failed to create GED structure:', error);
    }

    return this.findOne(saved.id);
  }

  async findAll(filters?: {
    assureId?: string;
    cedanteId?: string;
    status?: AffaireStatus;
    category?: string;
    exercice?: number;
    search?: string;
  }): Promise<Affaire[]> {
    const query = this.repo.createQueryBuilder('affaire')
      .leftJoinAndSelect('affaire.assure', 'assure')
      .leftJoinAndSelect('affaire.cedante', 'cedante')
      .leftJoinAndSelect('affaire.coCourtier', 'coCourtier')
      .leftJoinAndSelect('affaire.reinsurers', 'reinsurers')
      .leftJoinAndSelect('reinsurers.reassureur', 'reassureur')
      .leftJoinAndSelect('affaire.createdBy', 'createdBy');

    if (filters?.assureId) query.andWhere('affaire.assureId = :assureId', { assureId: filters.assureId });
    if (filters?.cedanteId) query.andWhere('affaire.cedanteId = :cedanteId', { cedanteId: filters.cedanteId });
    if (filters?.status) query.andWhere('affaire.status = :status', { status: filters.status });
    if (filters?.category) query.andWhere('affaire.category = :category', { category: filters.category });
    if (filters?.exercice) query.andWhere('affaire.exercice = :exercice', { exercice: filters.exercice });
    if (filters?.search) {
      query.andWhere(
        '(affaire.numeroAffaire ILIKE :search OR affaire.numeroPolice ILIKE :search OR assure.raisonSociale ILIKE :search OR cedante.raisonSociale ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    return query.orderBy('affaire.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Affaire> {
    const affaire = await this.repo.findOne({
      where: { id },
      relations: ['assure', 'cedante', 'coCourtier', 'reinsurers', 'reinsurers.reassureur', 'createdBy'],
    });

    if (!affaire) throw new NotFoundException(`Affaire with ID ${id} not found`);
    return affaire;
  }

  async update(id: string, data: UpdateAffaireDto): Promise<Affaire> {
    const affaire = await this.findOne(id);

    if (data.reinsurers) {
      this.validateReinsurerShares(data.reinsurers);
      await this.reinsurerRepo.delete({ affaireId: id });
    }

    const calculations = this.calculateFinancials({ ...affaire, ...data } as any);
    const updateData: any = {
      primeCedee: calculations.primeCedee,
      montantCommissionCedante: calculations.montantCommissionCedante,
      montantCommissionARS: calculations.montantCommissionARS,
    };
    if (data.category) updateData.category = data.category;
    if (data.type) updateData.type = data.type;
    if (data.assureId) updateData.assureId = data.assureId;
    if (data.cedanteId) updateData.cedanteId = data.cedanteId;
    if (data.coCourtierId !== undefined) updateData.coCourtierId = data.coCourtierId;
    if (data.numeroPolice !== undefined) updateData.numeroPolice = data.numeroPolice;
    if (data.branche !== undefined) updateData.branche = data.branche;
    if (data.garantie !== undefined) updateData.garantie = data.garantie;
    if (data.dateEffet) updateData.dateEffet = data.dateEffet;
    if (data.dateEcheance) updateData.dateEcheance = data.dateEcheance;
    if (data.dateNotification !== undefined) updateData.dateNotification = data.dateNotification;
    if (data.devise) updateData.devise = data.devise;
    if (data.capitalAssure100 !== undefined) updateData.capitalAssure100 = data.capitalAssure100;
    if (data.prime100 !== undefined) updateData.prime100 = data.prime100;
    if (data.tauxCession !== undefined) updateData.tauxCession = data.tauxCession;
    if (data.tauxCommissionCedante !== undefined) updateData.tauxCommissionCedante = data.tauxCommissionCedante;
    if (data.modeCalculCommissionCedante) updateData.modeCalculCommissionCedante = data.modeCalculCommissionCedante;
    if (data.tauxCommissionARS !== undefined) updateData.tauxCommissionARS = data.tauxCommissionARS;
    if (data.modeCalculCommissionARS) updateData.modeCalculCommissionARS = data.modeCalculCommissionARS;
    if (data.paymentMode) updateData.paymentMode = data.paymentMode;
    if (data.treatyType !== undefined) updateData.treatyType = data.treatyType;
    if (data.treatyBranches !== undefined) updateData.treatyBranches = data.treatyBranches;
    if (data.treatyZones !== undefined) updateData.treatyZones = data.treatyZones;
    if (data.periodiciteComptes !== undefined) updateData.periodiciteComptes = data.periodiciteComptes;
    if (data.rubriquesComptes !== undefined) updateData.rubriquesComptes = data.rubriquesComptes;
    if (data.primePrevisionnelle !== undefined) updateData.primePrevisionnelle = data.primePrevisionnelle;
    if (data.pmd !== undefined) updateData.pmd = data.pmd;
    if (data.notes !== undefined) updateData.notes = data.notes;
    await this.repo.update(id, updateData);

    if (data.reinsurers) {
      const reinsurers = data.reinsurers.map(r => {
        const reinsurerCalc = this.calculateReinsurerPart(calculations.primeCedee, calculations.montantCommissionARS, r.share);
        return this.reinsurerRepo.create({
          affaireId: id,
          reassureurId: r.reassureurId,
          share: r.share,
          role: r.role || 'FOLLOWER',
          ...reinsurerCalc,
        });
      });
      await this.reinsurerRepo.save(reinsurers);
    }

    return this.findOne(id);
  }

  async updateStatus(id: string, status: AffaireStatus, userRole?: string): Promise<Affaire> {
    const affaire = await this.findOne(id);
    this.validateStatusTransition(affaire.status, status);

    if (userRole) {
      const allowedRoles = this.getAllowedRolesForTransition(affaire.status, status);
      if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
        throw new BadRequestException(`Role ${userRole} cannot perform transition from ${affaire.status} to ${status}`);
      }
    }

    await this.repo.update(id, { status });
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const affaire = await this.findOne(id);
    if (affaire.status !== AffaireStatus.DRAFT && affaire.status !== AffaireStatus.ANNULE) {
      throw new BadRequestException('Only draft or cancelled affaires can be deleted');
    }
    await this.repo.delete(id);
  }

  async getStatistics(filters?: { exercice?: number; cedanteId?: string }) {
    const query = this.repo.createQueryBuilder('affaire');

    if (filters?.exercice) query.andWhere('affaire.exercice = :exercice', { exercice: filters.exercice });
    if (filters?.cedanteId) query.andWhere('affaire.cedanteId = :cedanteId', { cedanteId: filters.cedanteId });

    const [total, active, cotation, placement] = await Promise.all([
      query.getCount(),
      query.clone().andWhere('affaire.status = :status', { status: AffaireStatus.ACTIVE }).getCount(),
      query.clone().andWhere('affaire.status = :status', { status: AffaireStatus.COTATION }).getCount(),
      query.clone().andWhere('affaire.status = :status', { status: AffaireStatus.PLACEMENT_REALISE }).getCount(),
    ]);

    const financials = await query
      .select('SUM(affaire.primeCedee)', 'totalPrimeCedee')
      .addSelect('SUM(affaire.montantCommissionARS)', 'totalCommissionARS')
      .getRawOne();

    return {
      total,
      byStatus: { active, cotation, placement },
      financials: {
        totalPrimeCedee: parseFloat(financials.totalPrimeCedee) || 0,
        totalCommissionARS: parseFloat(financials.totalCommissionARS) || 0,
      },
    };
  }

  private calculateFinancials(data: any) {
    let primeCedee: number;

    if (data.category === 'traitee') {
      primeCedee = Number((data.primePrevisionnelle || 0).toFixed(2));
      if (data.pmd && primeCedee < data.pmd) {
        throw new BadRequestException(`Prime prévisionnelle (${primeCedee}) must be ≥ PMD (${data.pmd})`);
      }
    } else {
      primeCedee = Number(((data.prime100 * data.tauxCession) / 100).toFixed(2));
    }

    if (data.tauxCommissionCedante > 100 || data.tauxCommissionARS > 100) {
      throw new BadRequestException('Commission rate cannot exceed 100%');
    }

    let montantCommissionCedante: number;
    if (data.modeCalculCommissionCedante === 'MANUEL' && data.montantCommissionCedante !== undefined) {
      montantCommissionCedante = Number(data.montantCommissionCedante);
      if (montantCommissionCedante > primeCedee) {
        throw new BadRequestException('Commission cédante cannot exceed prime cédée');
      }
    } else {
      montantCommissionCedante = Number(((primeCedee * (data.tauxCommissionCedante || 0)) / 100).toFixed(2));
    }

    let montantCommissionARS: number;
    if (data.modeCalculCommissionARS === 'MANUEL' && data.montantCommissionARS !== undefined) {
      montantCommissionARS = Number(data.montantCommissionARS);
      if (montantCommissionARS > primeCedee) {
        throw new BadRequestException('Commission ARS cannot exceed prime cédée');
      }
      if (montantCommissionARS > montantCommissionCedante) {
        throw new BadRequestException('Commission ARS cannot exceed commission cédante');
      }
    } else {
      montantCommissionARS = Number(((primeCedee * (data.tauxCommissionARS || 0)) / 100).toFixed(2));
      if (montantCommissionARS > montantCommissionCedante) {
        throw new BadRequestException('Commission ARS cannot exceed commission cédante');
      }
    }

    return {
      primeCedee,
      montantCommissionCedante,
      montantCommissionARS,
    };
  }

  private calculateReinsurerPart(primeCedee: number, commissionARS: number, share: number) {
    const primePart = (primeCedee * share) / 100;
    const commissionPart = (commissionARS * share) / 100;
    const netAmount = primePart - commissionPart;

    return { primePart, commissionPart, netAmount };
  }

  private validateReinsurerShares(reinsurers: any[]) {
    const totalShare = reinsurers.reduce((sum, r) => sum + r.share, 0);
    if (Math.abs(totalShare - 100) > 0.01) {
      throw new BadRequestException(`Total reinsurer shares must equal 100% (current: ${totalShare}%)`);
    }
  }

  private validateStatusTransition(current: AffaireStatus, next: AffaireStatus) {
    const validTransitions: Record<AffaireStatus, AffaireStatus[]> = {
      [AffaireStatus.DRAFT]: [AffaireStatus.COTATION, AffaireStatus.ANNULE],
      [AffaireStatus.COTATION]: [AffaireStatus.PREVISION, AffaireStatus.ANNULE],
      [AffaireStatus.PREVISION]: [AffaireStatus.PLACEMENT_REALISE, AffaireStatus.ANNULE],
      [AffaireStatus.PLACEMENT_REALISE]: [AffaireStatus.ACTIVE, AffaireStatus.ANNULE],
      [AffaireStatus.ACTIVE]: [AffaireStatus.TERMINE],
      [AffaireStatus.TERMINE]: [],
      [AffaireStatus.ANNULE]: [],
    };

    if (!validTransitions[current]?.includes(next)) {
      throw new BadRequestException(`Invalid status transition from ${current} to ${next}`);
    }
  }

  private async generateNumeroAffaire(): Promise<string> {
    const exercice = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await this.repo.count({ where: { exercice } });
    return `ARS-${exercice}-${month}-${String(count + 1).padStart(3, '0')}`;
  }

  private getAllowedRolesForTransition(from: AffaireStatus, to: AffaireStatus): string[] {
    const transitionKey = `${from}→${to}`;
    const rules: Record<string, string[]> = {
      'draft→cotation': ['CHARGE_DE_DOSSIER', 'DIRECTEUR_COMMERCIAL'],
      'cotation→prevision': ['CHARGE_DE_DOSSIER'],
      'prevision→placement_realise': ['DIRECTEUR_FINANCIER', 'DIRECTEUR_GENERAL'],
      'placement_realise→active': ['AGENT_FINANCIER', 'DIRECTEUR_FINANCIER'],
      'active→termine': ['COMPTABLE', 'DIRECTEUR_GENERAL'],
    };

    if (to === AffaireStatus.ANNULE) {
      return ['DIRECTEUR_GENERAL', 'ADMINISTRATEUR'];
    }

    return rules[transitionKey] || [];
  }
}
