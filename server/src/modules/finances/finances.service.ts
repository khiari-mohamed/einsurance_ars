import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DecaissementStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { FxGainLossService } from './fx-gain-loss.service';
import { AmlService } from './aml.service';
import { ExchangeRateResolverService } from './exchange-rate-resolver.service';
import { CreateEncaissementDto } from './dto/create-encaissement.dto';
import { CreateDecaissementDto } from './dto/create-decaissement.dto';

@Injectable()
export class FinancesService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private fxService: FxGainLossService,
    private aml: AmlService,
    private exchangeRates: ExchangeRateResolverService,
  ) {}

  // ── Encaissements ────────────────────────────────────────────────

  async findEncaissements(filters: { affaireId?: string; cedanteId?: string; page?: number; limit?: number }) {
    const { affaireId, cedanteId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (affaireId) where.affaireId = affaireId;
    if (cedanteId) where.cedanteId = cedanteId;
    const [data, total] = await Promise.all([
      this.prisma.encaissement.findMany({
        where,
        include: { affaire: { select: { numero: true } }, cedante: { select: { raisonSociale: true } } },
        skip, take: limit, orderBy: { dateEncaissement: 'desc' },
      }),
      this.prisma.encaissement.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findEncaissement(id: string) {
    const enc = await this.prisma.encaissement.findUnique({ where: { id }, include: { affaire: true, cedante: true } });
    if (!enc) throw new NotFoundException('Encaissement introuvable');
    return enc;
  }

  async createEncaissement(dto: CreateEncaissementDto) {
    const reference = await this.sequence.next('ENCAISSEMENT');
    const currency = dto.currency ?? 'TND';
    const dateEncaissement = dto.dateEncaissement ? new Date(dto.dateEncaissement) : new Date();

    // FIX (Finances pass): tauxRealisation previously defaulted to `1` for
    // ANY unsupplied rate, including foreign currencies — silently treating
    // e.g. an EUR encaissement as 1:1 with TND if the caller forgot to pass
    // a rate. Now resolved from the BCT ExchangeRate referential when not
    // explicitly supplied, and throws a clear error if no rate exists
    // rather than silently defaulting.
    const tauxRealisation = await this.exchangeRates.resolve(currency, dto.tauxRealisation, dateEncaissement);
    const montantTnd = currency !== 'TND'
      ? Math.round(dto.montant * tauxRealisation * 1000) / 1000
      : dto.montant;

    const enc = await this.prisma.encaissement.create({
      data: {
        reference,
        affaireId: dto.affaireId,
        partyType: dto.partyType,
        cedanteId: dto.cedanteId,
        assureLabel: dto.assureLabel,
        montant: dto.montant,
        currency,
        tauxRealisation,
        montantTnd,
        stepNumber: dto.stepNumber,
        dateEncaissement,
        description: dto.description,
      },
    });

    const amlResult = await this.aml.checkEncaissement(enc.id);
    return { ...enc, amlFlagged: amlResult.flagged, amlReason: amlResult.reason };
  }

  async updateEncaissement(id: string, dto: any) {
    const existing = await this.findEncaissement(id);
    if (existing.isValidated) {
      throw new BadRequestException('Impossible de modifier un encaissement déjà validé');
    }
    return this.prisma.encaissement.update({ where: { id }, data: dto });
  }

  /**
   * FIX (Finances pass): was `data: { ... }` — a literal no-op despite
   * being gated behind FINANCES_APPROVE. Now uses the new
   * isValidated/validatedAt/validatedByUserId fields for real.
   */
  async validateEncaissement(id: string, userId: string) {
    const enc = await this.findEncaissement(id);
    if (enc.isValidated) {
      throw new BadRequestException('Cet encaissement est déjà validé');
    }
    const updated = await this.prisma.encaissement.update({
      where: { id },
      data: { isValidated: true, validatedAt: new Date(), validatedByUserId: userId },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'ENCAISSEMENT_VALIDATED', entityType: 'Encaissement', entityId: id },
    });
    return updated;
  }

  async deleteEncaissement(id: string) {
    const enc = await this.findEncaissement(id);

    // FIX (Finances pass): hard delete had no guards at all — deleting an
    // already-lettered, settled, or FX-journaled encaissement would either
    // FK-violate or silently orphan the referencing Lettrage/Settlement/
    // FxGainLoss/JournalEntry records.
    const lettrageCount = await this.prisma.lettrageItem.count({ where: { encaissementId: id, isLettre: true } });
    if (lettrageCount > 0) throw new BadRequestException('Impossible de supprimer un encaissement déjà lettré');
    if (enc.settlementId) throw new BadRequestException('Impossible de supprimer un encaissement lié à un règlement');
    const fx = await this.prisma.fxGainLoss.findUnique({ where: { encaissementId: id } });
    if (fx) throw new BadRequestException('Impossible de supprimer un encaissement ayant généré un écart de change comptabilisé');
    if (enc.isValidated) throw new BadRequestException('Impossible de supprimer un encaissement validé');

    return this.prisma.encaissement.delete({ where: { id } });
  }

  // ── Décaissements ─────────────────────────────────────────────────

  async findDecaissements(filters: { affaireId?: string; page?: number; limit?: number }) {
    const { affaireId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (affaireId) where.affaireId = affaireId;
    const [data, total] = await Promise.all([
      this.prisma.decaissement.findMany({ where, skip, take: limit, orderBy: { dateDecaissement: 'desc' } }),
      this.prisma.decaissement.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findDecaissement(id: string) {
    const dec = await this.prisma.decaissement.findUnique({ where: { id } });
    if (!dec) throw new NotFoundException('Décaissement introuvable');
    return dec;
  }

  async createDecaissement(dto: CreateDecaissementDto) {
    const reference = await this.sequence.next('DECAISSEMENT');
    const currency = dto.currency ?? 'TND';
    const now = new Date();

    const tauxReglement = await this.exchangeRates.resolve(currency, dto.tauxReglement, now);
    const montantTnd = currency !== 'TND'
      ? Math.round(dto.montant * tauxReglement * 1000) / 1000
      : dto.montant;

    const dec = await this.prisma.decaissement.create({
      data: {
        reference,
        affaireId: dto.affaireId,
        partyType: dto.partyType,
        reassureurCode: dto.reassureurCode,
        coCourtId: dto.coCourtId,
        montant: dto.montant,
        currency,
        tauxReglement,
        montantTnd,
        stepNumber: dto.stepNumber,
        description: dto.description,
      },
    });

    // FIX (Finances pass): AML screening previously only ran on
    // encaissements — wires OUT to reinsurers/co-courtiers were never
    // screened at all.
    const amlResult = await this.aml.checkDecaissement(dec.id);
    return { ...dec, amlFlagged: amlResult.flagged, amlReason: amlResult.reason };
  }

  async updateDecaissement(id: string, dto: any) {
    const existing = await this.findDecaissement(id);
    if (existing.statut !== DecaissementStatut.BROUILLON) {
      throw new BadRequestException('Seul un décaissement en brouillon peut être modifié');
    }
    return this.prisma.decaissement.update({ where: { id }, data: dto });
  }

  /**
   * FIX (Finances pass): was `data: { ... }` — the `niveau` parameter was
   * accepted and silently discarded, and nothing transitioned.
   * Single-level approval implemented for real (BROUILLON -> APPROUVE);
   * if ARS's process needs N-level sign-off, extend with a counter rather
   * than re-deriving from scratch.
   */
  async approveDecaissement(id: string, niveau: number | undefined, userId: string, note?: string) {
    const dec = await this.findDecaissement(id);
    if (dec.statut !== DecaissementStatut.BROUILLON) {
      throw new BadRequestException('Seul un décaissement en brouillon peut être approuvé');
    }
    const updated = await this.prisma.decaissement.update({
      where: { id },
      data: { statut: DecaissementStatut.APPROUVE, approvedAt: new Date(), approvedByUserId: userId },
    });
    await this.prisma.auditLog.create({
      data: {
        userId, action: 'DECAISSEMENT_APPROVED', entityType: 'Decaissement', entityId: id,
        before: { statut: dec.statut }, after: { statut: DecaissementStatut.APPROUVE, niveau, note },
      },
    });
    return updated;
  }

  /** NEW (Finances pass): complement to approve — no reject path existed. */
  async rejectDecaissement(id: string, motif: string, userId: string) {
    const dec = await this.findDecaissement(id);
    if (dec.statut === DecaissementStatut.EXECUTE) {
      throw new BadRequestException('Un décaissement déjà exécuté ne peut plus être rejeté');
    }
    const updated = await this.prisma.decaissement.update({
      where: { id },
      data: { statut: DecaissementStatut.REJETE, rejectionReason: motif },
    });
    await this.prisma.auditLog.create({
      data: {
        userId, action: 'DECAISSEMENT_REJECTED', entityType: 'Decaissement', entityId: id,
        before: { statut: dec.statut }, after: { statut: DecaissementStatut.REJETE, motif },
      },
    });
    return updated;
  }

  /**
   * FIX (Finances pass): was `data: { ... }` — no-op.
   */
  async executeDecaissement(id: string, userId?: string) {
    const dec = await this.findDecaissement(id);
    if (dec.statut !== DecaissementStatut.APPROUVE) {
      throw new BadRequestException('Le décaissement doit être approuvé avant exécution');
    }
    const updated = await this.prisma.decaissement.update({
      where: { id },
      data: { statut: DecaissementStatut.EXECUTE, executedAt: new Date() },
    });
    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId, action: 'DECAISSEMENT_EXECUTED', entityType: 'Decaissement', entityId: id,
          before: { statut: dec.statut }, after: { statut: DecaissementStatut.EXECUTE },
        },
      });
    }
    return updated;
  }

  async deleteDecaissement(id: string) {
    const dec = await this.findDecaissement(id);

    if (dec.statut !== DecaissementStatut.BROUILLON) {
      throw new BadRequestException('Seul un décaissement en brouillon peut être supprimé');
    }
    if (dec.settlementId) throw new BadRequestException('Impossible de supprimer un décaissement lié à un règlement');
    if (dec.ordrePaiementId) throw new BadRequestException('Impossible de supprimer un décaissement lié à un ordre de paiement');
    const fx = await this.prisma.fxGainLoss.findUnique({ where: { decaissementId: id } });
    if (fx) throw new BadRequestException('Impossible de supprimer un décaissement ayant généré un écart de change comptabilisé');

    return this.prisma.decaissement.delete({ where: { id } });
  }

  // ── Commissions (read-only views into AffaireReassureur) ───────────
  //
  // FIX (Finances pass): createCommission(data: any) was REMOVED. It called
  // prisma.affaireReassureur.create({ data }) directly on fully unvalidated
  // input — bypassing CommissionCalculatorService.validateShares()'s
  // 100%-sum invariant that the Affaires module enforces everywhere else,
  // and risking a duplicate/garbage row on an existing affaire's
  // participation table. AffaireReassureur rows must only ever be created
  // through AffairesService (Affaires module). This section is read + a
  // real markCommissionPaid() only.

  async findCommissions(filters: { affaireId?: string; reassureurId?: string; paid?: 'paid' | 'unpaid'; page?: number; limit?: number }) {
    const { affaireId, reassureurId, paid, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (affaireId) where.affaireId = affaireId;
    if (reassureurId) where.reassureurId = reassureurId;
    // FIX (Finances pass): the old `type`/`statut` query params were dead —
    // AffaireReassureur has no such columns; they never filtered anything.
    // Replaced with filters that map to real fields.
    if (paid === 'paid') where.commissionPaidAt = { not: null };
    if (paid === 'unpaid') where.commissionPaidAt = null;

    const [data, total] = await Promise.all([
      this.prisma.affaireReassureur.findMany({
        where,
        include: { reassureur: true, affaire: { select: { numero: true, currency: true } } },
        skip, take: limit, orderBy: { affaire: { createdAt: 'desc' } },
      }),
      this.prisma.affaireReassureur.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findCommission(id: string) {
    const c = await this.prisma.affaireReassureur.findUnique({
      where: { id },
      include: { reassureur: true, affaire: { select: { numero: true, currency: true } } },
    });
    if (!c) throw new NotFoundException('Commission introuvable');
    return c;
  }

  /**
   * FIX (Finances pass): was `data: { ... }` — a no-op, since no field
   * existed on AffaireReassureur to record it. Now real, and cross-checks
   * the decaissement actually corresponds to this reinsurer.
   */
  async markCommissionPaid(id: string, decaissementId: string, userId?: string) {
    const commission = await this.findCommission(id);
    if (commission.commissionPaidAt) {
      throw new BadRequestException('Cette commission est déjà marquée comme payée');
    }
    const dec = await this.prisma.decaissement.findUnique({ where: { id: decaissementId } });
    if (!dec) throw new NotFoundException('Décaissement introuvable');
    if (dec.reassureurCode !== commission.reassureur.code) {
      throw new BadRequestException('Ce décaissement ne correspond pas au réassureur de cette commission');
    }

    const updated = await this.prisma.affaireReassureur.update({
      where: { id },
      data: { commissionPaidAt: new Date(), commissionDecaissementId: decaissementId },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId, action: 'COMMISSION_MARKED_PAID', entityType: 'AffaireReassureur', entityId: id,
          after: { decaissementId },
        },
      });
    }

    return updated;
  }

  /** FIX (Finances pass): `period` was accepted but never actually used to filter anything. */
  async getCommissionStatement(cedanteId: string, period: string) {
    const cedante = await this.prisma.cedante.findUnique({ where: { id: cedanteId } });
    if (!cedante) throw new NotFoundException('Cédante introuvable');

    const { start, end } = this.parsePeriod(period);

    const lines = await this.prisma.affaireReassureur.findMany({
      where: { affaire: { cedanteId, createdAt: { gte: start, lte: end } } },
      include: { reassureur: { select: { code: true, raisonSociale: true } }, affaire: { select: { numero: true, type: true } } },
      orderBy: { affaire: { createdAt: 'asc' } },
    });

    const totalPrimeBrute = this.round3(lines.reduce((s, l) => s + Number(l.primeBrute ?? 0), 0));
    const totalCommissionArs = this.round3(lines.reduce((s, l) => s + Number(l.commissionArs ?? 0), 0));

    return {
      cedante: { code: cedante.code, raisonSociale: cedante.raisonSociale },
      period, periodStart: start, periodEnd: end,
      lines, totalPrimeBrute, totalCommissionArs,
    };
  }

  private parsePeriod(period: string): { start: Date; end: Date } {
    const parts = period.split('-');
    const year = parseInt(parts[0], 10);
    if (isNaN(year)) throw new BadRequestException('Format de période invalide (attendu: AAAA ou AAAA-MM)');
    if (parts.length === 1) {
      return { start: new Date(`${year}-01-01`), end: new Date(`${year}-12-31T23:59:59`) };
    }
    const month = parseInt(parts[1], 10);
    if (isNaN(month) || month < 1 || month > 12) throw new BadRequestException('Mois invalide');
    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0, 23, 59, 59) };
  }

  // ── Reports ──────────────────────────────────────────────────────

  async getCashFlowReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const [encaissements, decaissements] = await Promise.all([
      this.prisma.encaissement.aggregate({
        where: { dateEncaissement: { gte: start, lte: end } },
        _count: { id: true },
        _sum: { montant: true },
      }),
      this.prisma.decaissement.aggregate({
        where: { dateDecaissement: { gte: start, lte: end } },
        _count: { id: true },
        _sum: { montant: true },
      }),
    ]);

    const totalEncaissements = Number(encaissements._sum.montant ?? 0);
    const totalDecaissements = Number(decaissements._sum.montant ?? 0);

    return {
      totalEncaissements,
      totalDecaissements,
      soldeNet: this.round3(totalEncaissements - totalDecaissements),
      encaissements: encaissements._count.id,
      decaissements: decaissements._count.id,
    };
  }

  async getAgingReport(type: 'creances' | 'dettes') {
    const now = new Date();
    const ranges = [
      { label: '0-30 jours', min: 0, max: 30 },
      { label: '31-60 jours', min: 31, max: 60 },
      { label: '61-90 jours', min: 61, max: 90 },
      { label: '90+ jours', min: 91, max: 9999 },
    ];

    const dateField = type === 'creances' ? 'dateEncaissement' : 'dateDecaissement';
    const model = type === 'creances' ? 'encaissement' : 'decaissement';

    const results = [];
    for (const range of ranges) {
      const minDate = new Date(now.getTime() - range.max * 86400000);
      const maxDate = range.min > 0 ? new Date(now.getTime() - (range.min - 1) * 86400000) : now;

      const agg: any = await (this.prisma as any)[model].aggregate({
        where: {
          [dateField]: { lte: maxDate, ...(range.min > 0 ? { gte: minDate } : {}) },
        },
        _count: { id: true },
        _sum: { montant: true },
      });

      results.push({ label: range.label, count: agg._count.id, montant: Number(agg._sum.montant ?? 0) });
    }

    return { ranges: results };
  }

  async getBalanceForAffaire(affaireId: string) {
    const [encTotal, decTotal] = await Promise.all([
      this.prisma.encaissement.aggregate({ where: { affaireId }, _sum: { montant: true } }),
      this.prisma.decaissement.aggregate({ where: { affaireId }, _sum: { montant: true } }),
    ]);
    const encaisse = Number(encTotal._sum.montant ?? 0);
    const decaisse = Number(decTotal._sum.montant ?? 0);
    return { affaireId, encaisse, decaisse, solde: this.round3(encaisse - decaisse) };
  }

  private round3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }
}