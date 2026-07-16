import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportingService {
  constructor(private prisma: PrismaService) {}

  // ── Chiffre d'affaires ──────────────────────────────────────────

  async getChiffreAffaires(mode?: string, period?: string) {
    const year = period ? parseInt(period, 10) : new Date().getFullYear();
    const dateFrom = new Date(`${year}-01-01`);
    const dateTo = new Date(`${year}-12-31`);

    const agg = await this.prisma.encaissement.aggregate({
      where: { dateEncaissement: { gte: dateFrom, lte: dateTo } },
      _sum: { montantTnd: true },
    });

    const total = Number(agg._sum.montantTnd ?? 0);

    const byBranche = await this.prisma.encaissement.findMany({
      where: { dateEncaissement: { gte: dateFrom, lte: dateTo } },
      include: { affaire: { include: { facultativeData: { select: { branche: true } }, traiteData: { select: { branche: true } } } } },
    });

    const branches: Record<string, number> = {};
    for (const enc of byBranche) {
      const b = enc.affaire?.facultativeData?.branche ?? enc.affaire?.traiteData?.branche ?? 'AUTRE';
      branches[b] = (branches[b] ?? 0) + Number(enc.montantTnd ?? 0);
    }

    return { mode: mode ?? 'combined', period: String(year), total, branches };
  }

  // ── Primes aging ─────────────────────────────────────────────────

  async getPrimesAging(period?: string) {
    const now = new Date();
    const ranges = [
      { label: '0-30 jours', min: 0, max: 30 },
      { label: '31-60 jours', min: 31, max: 60 },
      { label: '61-90 jours', min: 61, max: 90 },
      { label: '90+ jours', min: 91, max: 9999 },
    ];

    const results = [];
    for (const range of ranges) {
      const minDate = new Date(now.getTime() - range.max * 86400000);
      const maxDate = range.min > 0 ? new Date(now.getTime() - (range.min - 1) * 86400000) : now;

      const agg = await this.prisma.encaissement.aggregate({
        where: { dateEncaissement: { lte: maxDate, ...(range.min > 0 ? { gte: minDate } : {}) } },
        _sum: { montantTnd: true },
      });
      results.push({ label: range.label, montant: Number(agg._sum.montantTnd ?? 0) });
    }

    return { period: period ?? String(now.getFullYear()), ranges: results };
  }

  // ── Budget vs actual ─────────────────────────────────────────────

  async getBudgetVsActual(period?: string) {
    const year = period ? parseInt(period, 10) : new Date().getFullYear();
    const dateFrom = new Date(`${year}-01-01`);
    const dateTo = new Date(`${year}-12-31`);

    const actual = await this.prisma.encaissement.aggregate({
      where: { dateEncaissement: { gte: dateFrom, lte: dateTo } },
      _sum: { montantTnd: true },
    });

    const budgetData = await this.prisma.budgetTarget.findMany({ where: { annee: year } });
    const budgetTotal = budgetData.reduce((s, b) => s + Number(b.targetCA), 0);
    const actualTotal = Number(actual._sum.montantTnd ?? 0);

    return {
      period: String(year),
      budget: budgetTotal,
      actual: actualTotal,
      ecart: Math.round((actualTotal - budgetTotal) * 1000) / 1000,
      realisationPct: budgetTotal > 0 ? Math.round((actualTotal / budgetTotal) * 10000) / 100 : 0,
    };
  }

  // ── Portfolio performance ────────────────────────────────────────

  async getPortfolioPerformance(filters: { startDate?: string; endDate?: string; groupBy?: string }) {
    const { startDate, endDate, groupBy = 'branche' } = filters;
    const where: any = { isActive: true };
    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };

    const affaires: any[] = await this.prisma.affaire.findMany({
      where,
      include: {
        reassureurs: { select: { commissionArs: true, primeNetteReassureur: true } },
        facultativeData: { select: { branche: true, prime100Pct: true } },
        traiteData: { select: { branche: true, primePrevisionnelle: true } },
      },
    });

    let totalPrimes = 0;
    let totalCommission = 0;
    for (const a of affaires) {
      const prime = Number(a.facultativeData?.prime100Pct ?? a.traiteData?.primePrevisionnelle ?? 0);
      totalPrimes += prime;
      totalCommission += a.reassureurs?.reduce?.((s: number, ar: any) => s + Number(ar.commissionArs ?? 0), 0) ?? 0;
    }

    return { totalAffaires: affaires.length, totalPrimes, totalCommission, groupBy };
  }

  // ── Risk concentration ──────────────────────────────────────────

  async getRiskConcentration(type?: string) {
    const affaires = await this.prisma.affaire.findMany({
      where: { isActive: true },
      include: { cedante: { select: { raisonSociale: true } }, facultativeData: { select: { prime100Pct: true } }, traiteData: { select: { primePrevisionnelle: true } } },
    });

    const byCedante: Record<string, { montant: number }> = {};
    let totalBrute = 0;
    for (const a of affaires) {
      const prime = Number(a.facultativeData?.prime100Pct ?? a.traiteData?.primePrevisionnelle ?? 0);
      const key = a.cedante?.raisonSociale ?? 'INCONNU';
      byCedante[key] = { montant: (byCedante[key]?.montant ?? 0) + prime };
      totalBrute += prime;
    }

    const items = Object.entries(byCedante)
      .sort((a, b) => b[1].montant - a[1].montant)
      .slice(0, 10)
      .map(([entite, { montant }]) => ({
        entite,
        montant: Math.round(montant * 1000) / 1000,
        partPct: totalBrute > 0 ? Math.round((montant / totalBrute) * 10000) / 100 : 0,
      }));

    return { type: type ?? 'cedante', topConcentration: items };
  }

  // ── Reinsurers performance ───────────────────────────────────────

  async getReinsurersPerformance(filters: { startDate?: string; endDate?: string }) {
    const ars: any[] = await this.prisma.affaireReassureur.findMany({
      include: { reassureur: { select: { raisonSociale: true, code: true } } },
    });

    const byReassureur: Record<string, any> = {};
    for (const ar of ars) {
      const key = ar.reassureur?.raisonSociale ?? ar.reassureurCode ?? 'INCONNU';
      if (!byReassureur[key]) byReassureur[key] = { totalPrimes: 0, totalCommission: 0, count: 0 };
      byReassureur[key].totalPrimes += Number(ar.primeNetteReassureur ?? 0);
      byReassureur[key].totalCommission += Number(ar.commissionArs ?? 0);
      byReassureur[key].count++;
    }

    return { reinsurers: byReassureur };
  }

  // ── SAP report ───────────────────────────────────────────────────

  async getSAPReport(filters: { startDate?: string; endDate?: string }) {
    const agg = await this.prisma.sinistre.aggregate({
      _sum: { sap: true },
      _count: { id: true },
    });

    return { totalSAP: Number(agg._sum.sap ?? 0), count: agg._count.id };
  }

  // ── Monthly production ──────────────────────────────────────────

  async getMonthlyProduction(year?: number, month?: number) {
    const y = year ?? new Date().getFullYear();
    const m = month ?? new Date().getMonth() + 1;
    const dateFrom = new Date(y, m - 1, 1);
    const dateTo = new Date(y, m, 0, 23, 59, 59);

    const [affaires, enc, dec] = await Promise.all([
      this.prisma.affaire.count({ where: { createdAt: { gte: dateFrom, lte: dateTo } } }),
      this.prisma.encaissement.aggregate({ where: { dateEncaissement: { gte: dateFrom, lte: dateTo } }, _sum: { montantTnd: true } }),
      this.prisma.decaissement.aggregate({ where: { dateDecaissement: { gte: dateFrom, lte: dateTo } }, _sum: { montantTnd: true } }),
    ]);

    return {
      year: y, month: m,
      nouvellesAffaires: affaires,
      encaissements: Number(enc._sum.montantTnd ?? 0),
      decaissements: Number(dec._sum.montantTnd ?? 0),
    };
  }

  // ── Commission analysis ─────────────────────────────────────────

  async getCommissionAnalysis(filters: { startDate?: string; endDate?: string }) {
    const ars = await this.prisma.affaireReassureur.findMany({
      include: { reassureur: { select: { raisonSociale: true } }, affaire: { select: { numero: true } } },
    });

    const totalCommission = ars.reduce((s, ar) => s + Number(ar.commissionArs ?? 0), 0);
    const totalPrimes = ars.reduce((s, ar) => s + Number(ar.primeNetteReassureur ?? 0), 0);

    return {
      totalCommission: Math.round(totalCommission * 1000) / 1000,
      totalPrimesNettes: Math.round(totalPrimes * 1000) / 1000,
      ratio: totalPrimes > 0 ? Math.round((totalCommission / totalPrimes) * 10000) / 100 : 0,
      count: ars.length,
    };
  }

  // ── Cedantes performance ────────────────────────────────────────

  async getCedantesPerformance(filters: { startDate?: string; endDate?: string }) {
    const sinistres: any[] = await this.prisma.sinistre.findMany({
      where: filters.startDate || filters.endDate ? { dateSurvenance: { ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}), ...(filters.endDate ? { lte: new Date(filters.endDate) } : {}) } } : {},
      include: { affaire: { select: { cedante: { select: { raisonSociale: true } } } } },
    });

    const byCedante: Record<string, any> = {};
    for (const s of sinistres) {
      const key = s.affaire?.cedante?.raisonSociale ?? 'INCONNU';
      if (!byCedante[key]) byCedante[key] = { count: 0, totalMontant: 0 };
      byCedante[key].count++;
      byCedante[key].totalMontant += Number(s.reserves ?? s.partReassureurs ?? s.sap ?? 0);
    }

    return { cedantes: byCedante };
  }

  // ── Branches analysis ───────────────────────────────────────────

  async getBranchesAnalysis(filters: { startDate?: string; endDate?: string }) {
    const affaires = await this.prisma.affaire.findMany({
      where: { isActive: true },
      include: { facultativeData: { select: { branche: true, prime100Pct: true } }, traiteData: { select: { branche: true, primePrevisionnelle: true } } },
    });

    const byBranche: Record<string, any> = {};
    for (const a of affaires) {
      const b = a.facultativeData?.branche ?? a.traiteData?.branche ?? 'AUTRE';
      if (!byBranche[b]) byBranche[b] = { count: 0, totalPrimes: 0 };
      byBranche[b].count++;
      byBranche[b].totalPrimes += Number(a.facultativeData?.prime100Pct ?? a.traiteData?.primePrevisionnelle ?? 0);
    }

    return { branches: byBranche };
  }

  // ── Payment aging ───────────────────────────────────────────────

  async getPaymentAging(type?: string) {
    const now = new Date();
    const ranges = [
      { label: '0-30 jours', min: 0, max: 30 },
      { label: '31-60 jours', min: 31, max: 60 },
      { label: '61-90 jours', min: 61, max: 90 },
      { label: '90+ jours', min: 91, max: 9999 },
    ];

    const model = type === 'dettes' ? 'decaissement' : 'encaissement';
    const dateField = type === 'dettes' ? 'dateDecaissement' : 'dateEncaissement';

    const results = [];
    for (const range of ranges) {
      const maxDate = new Date(now.getTime() - range.min * 86400000);
      const minDate = range.max < 9999 ? new Date(now.getTime() - (range.max + 1) * 86400000) : new Date(0);

      const agg: any = await (this.prisma as any)[model].aggregate({
        where: { [dateField]: { gte: minDate, lte: maxDate } },
        _sum: { montantTnd: true },
        _count: { id: true },
      });

      results.push({ label: range.label, count: agg._count.id, montant: Number(agg._sum.montantTnd ?? 0) });
    }

    return { type: type ?? 'creances', ranges: results };
  }

  // ── Bordereaux summary ──────────────────────────────────────────

  async getBordereauxSummary(filters: { startDate?: string; endDate?: string; type?: string }) {
    const where: any = {};
    if (filters.startDate) where.createdAt = { ...where.createdAt, gte: new Date(filters.startDate) };
    if (filters.endDate) where.createdAt = { ...where.createdAt, lte: new Date(filters.endDate) };
    if (filters.type) where.type = filters.type;

    const [data, total] = await Promise.all([
      this.prisma.bordereau.findMany({ where, take: 100, orderBy: { createdAt: 'desc' } }),
      this.prisma.bordereau.count({ where }),
    ]);

    const totalMontant = data.reduce((s, b) => s + Number(b.montantTotal ?? 0), 0);

    return { total, totalMontant: Math.round(totalMontant * 1000) / 1000, data };
  }

  // ── Cedante statement ───────────────────────────────────────────

  async getCedanteStatement(cedanteId: string, year: number) {
    const dateFrom = new Date(`${year}-01-01`);
    const dateTo = new Date(`${year}-12-31`);

    const [cedante, encaissements, sinistres, affaires] = await Promise.all([
      this.prisma.cedante.findUnique({ where: { id: cedanteId } }),
      this.prisma.encaissement.findMany({
        where: { cedanteId, dateEncaissement: { gte: dateFrom, lte: dateTo } },
        orderBy: { dateEncaissement: 'asc' },
      }),
      this.prisma.sinistre.findMany({
        where: { affaire: { cedanteId }, dateSurvenance: { gte: dateFrom, lte: dateTo } },
        include: { affaire: { select: { numero: true } } },
      }),
      this.prisma.affaire.count({ where: { cedanteId, isActive: true, statut: 'PLACEMENT_REALISE' } }),
    ]);

    const totalPrimes = encaissements.reduce((s, e) => s + Number(e.montantTnd ?? 0), 0);
    const totalSinistres = sinistres.reduce((s, sin) => s + Number(sin.partReassureurs ?? 0), 0);
    const lossRatio = totalPrimes > 0 ? Math.round((totalSinistres / totalPrimes) * 100 * 100) / 100 : 0;

    return {
      cedante,
      year,
      affairesActives: affaires,
      totalPrimes: Math.round(totalPrimes * 1000) / 1000,
      totalSinistres: Math.round(totalSinistres * 1000) / 1000,
      lossRatioPct: lossRatio,
      encaissements,
      sinistres,
    };
  }

  // ── Reassureur statement ────────────────────────────────────────

  async getReassureurStatement(reassureurCode: string, year: number) {
    const dateFrom = new Date(`${year}-01-01`);
    const dateTo = new Date(`${year}-12-31`);

    const [reassureur, participations, decaissements] = await Promise.all([
      this.prisma.reassureur.findFirst({ where: { code: reassureurCode } }),
      this.prisma.affaireReassureur.findMany({
        where: { reassureur: { code: reassureurCode }, affaire: { isActive: true } },
        include: { affaire: { include: { cedante: true, facultativeData: true } } },
      }),
      this.prisma.decaissement.findMany({
        where: { reassureurCode, dateDecaissement: { gte: dateFrom, lte: dateTo } },
      }),
    ]);

    const totalPrimesNettes = participations.reduce((s, p) => s + Number(p.primeNetteReassureur ?? 0), 0);
    const totalDecaisse = decaissements.reduce((s, d) => s + Number(d.montant), 0);

    return {
      reassureur,
      year,
      participations: participations.length,
      totalPrimesNettes: Math.round(totalPrimesNettes * 1000) / 1000,
      totalDecaisse: Math.round(totalDecaisse * 1000) / 1000,
      commissions: participations.reduce((s, p) => s + Number(p.commissionArs ?? 0), 0),
    };
  }

  // ── Annual report ───────────────────────────────────────────────

  async getAnnualReport(year: number) {
    const dateFrom = new Date(`${year}-01-01`);
    const dateTo = new Date(`${year}-12-31`);

    const [affaires, sinistres, enc, dec, fxGains, fxPertes] = await Promise.all([
      this.prisma.affaire.count({ where: { isActive: true, statut: 'PLACEMENT_REALISE', createdAt: { gte: dateFrom, lte: dateTo } } }),
      this.prisma.sinistre.count({ where: { createdAt: { gte: dateFrom, lte: dateTo } } }),
      this.prisma.encaissement.aggregate({ where: { dateEncaissement: { gte: dateFrom, lte: dateTo } }, _sum: { montantTnd: true } }),
      this.prisma.decaissement.aggregate({ where: { dateDecaissement: { gte: dateFrom, lte: dateTo } }, _sum: { montantTnd: true } }),
      this.prisma.fxGainLoss.aggregate({ where: { type: 'GAIN', createdAt: { gte: dateFrom, lte: dateTo } }, _sum: { montantDiff: true } }),
      this.prisma.fxGainLoss.aggregate({ where: { type: 'PERTE', createdAt: { gte: dateFrom, lte: dateTo } }, _sum: { montantDiff: true } }),
    ]);

    return {
      year,
      nouvellesAffaires: affaires,
      totalSinistres: sinistres,
      totalEncaissements: Number(enc._sum.montantTnd ?? 0),
      totalDecaissements: Number(dec._sum.montantTnd ?? 0),
      soldeFinancier: Number(enc._sum.montantTnd ?? 0) - Number(dec._sum.montantTnd ?? 0),
      gainsDeChange: Number(fxGains._sum.montantDiff ?? 0),
      pertesDeChange: Number(fxPertes._sum.montantDiff ?? 0),
      soldeChange: Number(fxGains._sum.montantDiff ?? 0) - Number(fxPertes._sum.montantDiff ?? 0),
    };
  }
}
