import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { Lettrage, LettrageStatus, LettrageType } from './lettrage.entity';
import { Encaissement, EncaissementStatus } from './encaissement.entity';
import { Decaissement, DecaissementStatus } from './decaissement.entity';
import { Bordereau } from '../bordereaux/bordereaux.entity';
import { AuditLog, AuditActionType, AuditEntityType } from './audit-log.entity';

export interface PaymentMatch {
  encaissementId?: string;
  decaissementId?: string;
  bordereauId: string;
  montant: number;
  matchScore: number; // 0-100 confidence
}

@Injectable()
export class LettrageService {
  private readonly TOLERANCE_PERCENTAGE = 0.02; // 2% default tolerance
  private readonly AGING_THRESHOLDS = {
    CURRENT: 0,
    _30_DAYS: 30,
    _60_DAYS: 60,
    _90_DAYS: 90,
  };

  constructor(
    @InjectRepository(Lettrage)
    private lettrageRepo: Repository<Lettrage>,
    @InjectRepository(Encaissement)
    private encaissementRepo: Repository<Encaissement>,
    @InjectRepository(Decaissement)
    private decaissementRepo: Repository<Decaissement>,
    @InjectRepository(Bordereau)
    private bordereauRepo: Repository<Bordereau>,
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  // ==================== ADVANCED AUTO-LETTRAGE ====================

  /**
   * Enhanced auto-lettrage with multi-payment matching and partial payment support
   */
  async autoLettrageAdvanced(
    tolerancePercent: number = 2,
    userId: string = 'SYSTEM',
  ): Promise<{ matched: number; partial: number; unmatched: number }> {
    let matched = 0;
    let partial = 0;
    let unmatched = 0;

    // Get available encaissements sorted by date (oldest first for priority matching)
    const availableEncaissements = await this.encaissementRepo.find({
      where: { statut: EncaissementStatus.VALIDE },
      order: { dateEncaissement: 'ASC' },
    });

    const tolerance = tolerancePercent / 100;

    // Get all affaires with bordereaux for matching
    const affaires = await this.encaissementRepo.find({
      where: { statut: EncaissementStatus.VALIDE },
      relations: ['affaire', 'bordereau'],
    });

    for (const enc of affaires) {
      if (!enc.bordereauId) continue;

      const bordereau = await this.bordereauRepo.findOne({ where: { id: enc.bordereauId } });
      if (!bordereau) continue;

      const bordereauAmount = Number(bordereau.solde || 0);
      let remainingAmount = bordereauAmount;
      const appliedEncaissements: PaymentMatch[] = [];
      let isPartial = false;

      // Try exact match first
      const exactMatch = availableEncaissements.find(
        avail =>
          Math.abs(Number(avail.montantEquivalentTND) - bordereauAmount) / bordereauAmount <= tolerance &&
          avail.id !== enc.id,
      );

      if (exactMatch) {
        appliedEncaissements.push({
          encaissementId: exactMatch.id,
          bordereauId: bordereau.id,
          montant: Number(exactMatch.montantEquivalentTND),
          matchScore: 100,
        });
        matched++;
        continue;
      }

      // Try multi-payment matching
      for (const avail of availableEncaissements) {
        const avAmount = Number(avail.montantEquivalentTND);

        if (avAmount <= remainingAmount + remainingAmount * tolerance) {
          const score = this.calculateMatchScore(avAmount, remainingAmount);
          appliedEncaissements.push({
            encaissementId: avail.id,
            bordereauId: bordereau.id,
            montant: avAmount,
            matchScore: score,
          });
          remainingAmount -= avAmount;
          isPartial = true;

          if (Math.abs(remainingAmount) < 1) {
            break;
          }
        }
      }

      // Create lettrage if matches found
      if (appliedEncaissements.length > 0) {
        await this.createAdvancedLettrage({
          type: LettrageType.AFFAIRE,
          entityId: bordereau.id,
          encaissements: appliedEncaissements.map(m => ({
            encaissementId: m.encaissementId!,
            montantAffecte: m.montant,
          })),
          creances: [{
            bordereauId: bordereau.id,
            montantDu: bordereauAmount,
            montantRegle: bordereauAmount - remainingAmount,
          }],
          userId,
          status: Math.abs(remainingAmount) < 1 ? LettrageStatus.COMPLET : LettrageStatus.PARTIEL,
          notes: isPartial ? `Multi-payment match: ${appliedEncaissements.length} payments` : 'Single payment match',
        });

        if (isPartial) {
          partial++;
        } else {
          matched++;
        }

        if (Math.abs(remainingAmount) > 1) {
          unmatched++;
        }
      } else {
        unmatched++;
      }
    }

    return { matched, partial, unmatched };
  }

  /**
   * Create lettrage with advanced options
   */
  async createAdvancedLettrage(data: {
    type: LettrageType;
    entityId: string;
    encaissements?: Array<{ encaissementId: string; montantAffecte: number }>;
    decaissements?: Array<{ decaissementId: string; montantAffecte: number }>;
    creances?: Array<{ bordereauId: string; montantDu: number; montantRegle: number }>;
    userId: string;
    status?: LettrageStatus;
    notes?: string;
  }): Promise<Lettrage> {
    const reference = await this.generateReference();

    const totalEncaissements = (data.encaissements || []).reduce((sum, e) => sum + e.montantAffecte, 0);
    const totalDecaissements = (data.decaissements || []).reduce((sum, d) => sum + d.montantAffecte, 0);
    const totalCreances = (data.creances || []).reduce((sum, c) => sum + c.montantRegle, 0);

    const soldeAvant = totalCreances;
    const soldeApres = soldeAvant - totalEncaissements + totalDecaissements;
    const ecart = Math.abs(soldeApres);

    const statut = data.status || (ecart < 0.01 ? LettrageStatus.COMPLET : LettrageStatus.PARTIEL);

    const lettrage = this.lettrageRepo.create({
      reference,
      dateLettrage: new Date(),
      type: data.type,
      entityId: data.entityId,
      encaissements: data.encaissements || [],
      decaissements: data.decaissements || [],
      creances: data.creances || [],
      soldeAvant,
      soldeApres,
      ecart,
      statut,
      notes: data.notes,
      createdById: data.userId,
    });

    const saved = await this.lettrageRepo.save(lettrage);

    // Audit log
    await this.auditLogRepo.save({
      actionType: AuditActionType.CREATE,
      entityType: AuditEntityType.LETTRAGE,
      entityId: saved.id,
      userId: data.userId,
      userEmail: '',
      description: `Lettrage created: ${saved.reference} - Type: ${data.type} - Status: ${statut}`,
      afterValues: saved,
    });

    return saved;
  }

  // ==================== AGING ANALYSIS ====================

  /**
   * Get aging analysis for creances/dettes
   */
  async getAgingAnalysis(type: 'creances' | 'dettes', cedanteId?: string): Promise<any> {
    const now = new Date();
    const aging = {
      current: { count: 0, montant: 0 },
      _30_days: { count: 0, montant: 0 },
      _60_days: { count: 0, montant: 0 },
      _90_days: { count: 0, montant: 0 },
      over_90: { count: 0, montant: 0 },
    };

    let items = [];

    if (type === 'creances') {
      // Get unlettered encaissements
      const query = this.encaissementRepo.createQueryBuilder('enc').where('enc.statut != :statut', {
        statut: EncaissementStatus.COMPTABILISE,
      });

      if (cedanteId) {
        query.andWhere('enc.cedanteId = :cedanteId', { cedanteId });
      }

      items = await query.getMany();
    } else {
      // Get unpaid decaissements
      const query = this.decaissementRepo
        .createQueryBuilder('dec')
        .where('dec.statut != :statut', { statut: DecaissementStatus.COMPTABILISE });

      if (cedanteId) {
        query.andWhere('(dec.cedanteId = :cedanteId OR dec.reassureurId = :cedanteId)', { cedanteId });
      }

      items = await query.getMany();
    }

    // Categorize by age
    for (const item of items) {
      const itemDate = new Date(item.dateEncaissement || item.dateDecaissement);
      const daysOld = Math.floor((now.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24));
      const montant = Number(item.montantEquivalentTND || item.montant || 0);

      if (daysOld <= 0) {
        aging.current.count++;
        aging.current.montant += montant;
      } else if (daysOld <= 30) {
        aging._30_days.count++;
        aging._30_days.montant += montant;
      } else if (daysOld <= 60) {
        aging._60_days.count++;
        aging._60_days.montant += montant;
      } else if (daysOld <= 90) {
        aging._90_days.count++;
        aging._90_days.montant += montant;
      } else {
        aging.over_90.count++;
        aging.over_90.montant += montant;
      }
    }

    const totalMontant = Object.values(aging).reduce((sum: any, cat) => sum + cat.montant, 0);

    return {
      type,
      cedanteId,
      asof: now.toISOString(),
      aging,
      total: {
        count: items.length,
        montant: totalMontant,
      },
      criticalItems: aging.over_90,
      recommendation:
        aging.over_90.montant > 0
          ? `${aging.over_90.count} items over 90 days old - immediate collection required`
          : 'No overdue items',
    };
  }

  // ==================== UNMATCHED ITEMS & ALERTS ====================

  /**
   * Get unmatchted items (creances/dettes with no lettrage)
   */
  async getUnmatchedItems(days: number = 30, minMontant: number = 0): Promise<any> {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const unmatchedEncaissements = await this.encaissementRepo.find({
      where: {
        dateEncaissement: Between(cutoffDate, new Date()),
        statut: EncaissementStatus.VALIDE,
        bordereauId: null,
      },
    });

    const unmatchedDecaissements = await this.decaissementRepo.find({
      where: {
        dateDecaissement: Between(cutoffDate, new Date()),
        statut: In([DecaissementStatus.EXECUTE, DecaissementStatus.COMPTABILISE]),
        bordereauId: null,
      },
    });

    const filteredEncaissements = unmatchedEncaissements.filter(
      e => Number(e.montantEquivalentTND) >= minMontant,
    );
    const filteredDecaissements = unmatchedDecaissements.filter(
      d => Number(d.montantEquivalentTND) >= minMontant,
    );

    return {
      periode: { days, since: cutoffDate.toISOString() },
      encaissements: {
        count: filteredEncaissements.length,
        montant: filteredEncaissements.reduce((sum, e) => sum + Number(e.montantEquivalentTND), 0),
        items: filteredEncaissements.map(e => ({
          id: e.id,
          numero: e.numero,
          date: e.dateEncaissement,
          montant: e.montantEquivalentTND,
          source: e.sourceType,
          daysOld: Math.floor(
            (new Date().getTime() - new Date(e.dateEncaissement).getTime()) / (1000 * 60 * 60 * 24),
          ),
        })),
      },
      decaissements: {
        count: filteredDecaissements.length,
        montant: filteredDecaissements.reduce((sum, d) => sum + Number(d.montantEquivalentTND), 0),
        items: filteredDecaissements.map(d => ({
          id: d.id,
          numero: d.numero,
          date: d.dateDecaissement,
          montant: d.montantEquivalentTND,
          beneficiary: d.beneficiaireType,
          daysOld: Math.floor(
            (new Date().getTime() - new Date(d.dateDecaissement).getTime()) / (1000 * 60 * 60 * 24),
          ),
        })),
      },
      totalUnmatched: filteredEncaissements.length + filteredDecaissements.length,
      alerts: [
        filteredEncaissements.some(
          e =>
            (new Date().getTime() - new Date(e.dateEncaissement).getTime()) / (1000 * 60 * 60 * 24) >
            30,
        )
          ? 'Encaissements over 30 days unmatched - escalate for manual review'
          : null,
        filteredDecaissements.some(
          d =>
            (new Date().getTime() - new Date(d.dateDecaissement).getTime()) / (1000 * 60 * 60 * 24) >
            30,
        )
          ? 'Décaissements over 30 days unmatched - verify completion'
          : null,
      ].filter(Boolean),
    };
  }

  // ==================== LETTRAGE QUERIES ====================

  async findAll(filters?: { type?: LettrageType; entityId?: string }): Promise<Lettrage[]> {
    const query = this.lettrageRepo.createQueryBuilder('let').leftJoinAndSelect('let.createdBy', 'createdBy');

    if (filters?.type) {
      query.andWhere('let.type = :type', { type: filters.type });
    }

    if (filters?.entityId) {
      query.andWhere('let.entityId = :entityId', { entityId: filters.entityId });
    }

    return query.orderBy('let.dateLettrage', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Lettrage> {
    const lettrage = await this.lettrageRepo.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!lettrage) {
      throw new NotFoundException(`Lettrage ${id} not found`);
    }

    return lettrage;
  }

  // ==================== UTILITIES ====================

  private calculateMatchScore(encAmount: number, remainingAmount: number): number {
    // Score based on how close the payment is to remaining amount
    const diff = Math.abs(encAmount - remainingAmount);
    const maxDiff = Math.max(encAmount, remainingAmount);
    return Math.max(0, 100 - (diff / maxDiff) * 100);
  }

  private async generateReference(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.lettrageRepo.count();
    return `LET-${year}-${String(count + 1).padStart(5, '0')}`;
  }
}
