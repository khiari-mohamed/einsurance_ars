import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * 4 Dashboard panels as defined in the CDC:
 * Panel 1 — Chiffre d'affaires (CA) — current year + evolution
 * Panel 2 — Primes cédées — by cedante, by branch
 * Panel 3 — Budget vs Actual
 * Panel 4 — Quarterly report summary
 */
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getPanel1Ca(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const dateFrom = new Date(`${targetYear}-01-01`);
    const dateTo = new Date(`${targetYear}-12-31`);

    // CA = total primes encaissées in TND
    const [encaissements, prevYear] = await Promise.all([
      this.prisma.encaissement.aggregate({
        where: { dateEncaissement: { gte: dateFrom, lte: dateTo } },
        _sum: { montantTnd: true, montant: true },
      }),
      this.prisma.encaissement.aggregate({
        where: { dateEncaissement: { gte: new Date(`${targetYear - 1}-01-01`), lte: new Date(`${targetYear - 1}-12-31`) } },
        _sum: { montantTnd: true },
      }),
    ]);

    const currentCA = Number(encaissements._sum.montantTnd ?? encaissements._sum.montant ?? 0);
    const prevCA = Number(prevYear._sum.montantTnd ?? 0);
    const evolutionPct = prevCA > 0 ? Math.round(((currentCA - prevCA) / prevCA) * 100 * 100) / 100 : null;

    // Monthly breakdown
    const monthly = await this.prisma.encaissement.groupBy({
      by: ['dateEncaissement'],
      where: { dateEncaissement: { gte: dateFrom, lte: dateTo } },
      _sum: { montantTnd: true },
    });

    return { currentCA, prevCA, evolutionPct, year: targetYear, monthlyData: monthly };
  }

  async getPanel2Primes(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const dateFrom = new Date(`${targetYear}-01-01`);
    const dateTo = new Date(`${targetYear}-12-31`);

    // By cedante
    const byCedante = await this.prisma.encaissement.groupBy({
      by: ['cedanteId'],
      where: { dateEncaissement: { gte: dateFrom, lte: dateTo }, cedanteId: { not: null } },
      _sum: { montantTnd: true },
      orderBy: { _sum: { montantTnd: 'desc' } },
      take: 10,
    });

    const cedanteIds = byCedante.map((c) => c.cedanteId).filter(Boolean) as string[];
    const cedantes = await this.prisma.cedante.findMany({
      where: { id: { in: cedanteIds } },
      select: { id: true, code: true, raisonSociale: true },
    });
    const cedanteMap = new Map(cedantes.map((c) => [c.id, c]));

    return {
      byCedante: byCedante.map((b) => ({
        cedante: cedanteMap.get(b.cedanteId ?? ''),
        totalPrimes: Number(b._sum.montantTnd ?? 0),
      })),
      year: targetYear,
    };
  }

  async getPanel3Budget(year?: number, cedanteId?: string) {
    const targetYear = year ?? new Date().getFullYear();
    const targets = await this.prisma.budgetTarget.findMany({
      where: { annee: targetYear, ...(cedanteId && { cedanteId }) },
      orderBy: { mois: 'asc' },
    });

    return {
      targets,
      totalTarget: targets.reduce((s, t) => s + Number(t.targetCA), 0),
      totalActual: targets.reduce((s, t) => s + Number(t.actualCA ?? 0), 0),
    };
  }

  async getPanel4QuarterlyReport(year?: number, quarter?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const q = quarter ?? Math.ceil((new Date().getMonth() + 1) / 3);
    const quarterStartMonth = (q - 1) * 3 + 1;
    const dateFrom = new Date(`${targetYear}-${String(quarterStartMonth).padStart(2, '0')}-01`);
    const dateTo = new Date(targetYear, quarterStartMonth + 2, 0);

    const [affaires, sinistres, encaissements, decaissements] = await Promise.all([
      this.prisma.affaire.count({
        where: { isActive: true, statut: 'PLACEMENT_REALISE', createdAt: { gte: dateFrom, lte: dateTo } },
      }),
      this.prisma.sinistre.count({ where: { dateSurvenance: { gte: dateFrom, lte: dateTo } } }),
      this.prisma.encaissement.aggregate({
        where: { dateEncaissement: { gte: dateFrom, lte: dateTo } },
        _sum: { montantTnd: true },
      }),
      this.prisma.decaissement.aggregate({
        where: { dateDecaissement: { gte: dateFrom, lte: dateTo } },
        _sum: { montantTnd: true },
      }),
    ]);

    return {
      year: targetYear,
      quarter: q,
      period: { from: dateFrom, to: dateTo },
      affairesPlacees: affaires,
      sinistres,
      encaissements: Number(encaissements._sum.montantTnd ?? 0),
      decaissements: Number(decaissements._sum.montantTnd ?? 0),
      solde: Number(encaissements._sum.montantTnd ?? 0) - Number(decaissements._sum.montantTnd ?? 0),
    };
  }

  async getSummary() {
    const [totalAffaires, totalSinistres, openTasks, pendingOrdres] = await Promise.all([
      this.prisma.affaire.count({ where: { isActive: true, statut: 'PLACEMENT_REALISE' } }),
      this.prisma.sinistre.count({ where: { statut: { notIn: ['CLOS', 'REJETE'] } } }),
      this.prisma.workflowTask.count({ where: { statut: 'EN_ATTENTE' } }),
      this.prisma.ordrePaiement.count({ where: { statut: { in: ['BROUILLON', 'VALIDE'] } } }),
    ]);
    return { totalAffaires, totalSinistres, openTasks, pendingOrdres };
  }

  async getKPIs(filters?: { startDate?: string; endDate?: string; cedanteId?: string; reassureurId?: string }) {
    const year = new Date().getFullYear();
    const startOfYear = new Date(`${year}-01-01`);
    const endOfYear = new Date(`${year}-12-31`);
    const prevYearStart = new Date(`${year - 1}-01-01`);
    const prevYearEnd = new Date(`${year - 1}-12-31`);

    const whereClause = {
      dateEncaissement: { gte: startOfYear, lte: endOfYear },
      ...(filters?.cedanteId && { cedanteId: filters.cedanteId }),
    };

    const prevWhereClause = {
      dateEncaissement: { gte: prevYearStart, lte: prevYearEnd },
      ...(filters?.cedanteId && { cedanteId: filters.cedanteId }),
    };

    const [currentCA, prevCA, affairesCount, prevAffairesCount, cedantesCount, sinistresCount] = await Promise.all([
      this.prisma.encaissement.aggregate({ where: whereClause, _sum: { montantTnd: true } }),
      this.prisma.encaissement.aggregate({ where: prevWhereClause, _sum: { montantTnd: true } }),
      this.prisma.affaire.count({
        where: {
          isActive: true,
          statut: 'PLACEMENT_REALISE',
          createdAt: { gte: startOfYear },
          ...(filters?.cedanteId && { cedanteId: filters.cedanteId }),
        },
      }),
      this.prisma.affaire.count({
        where: {
          isActive: true,
          statut: 'PLACEMENT_REALISE',
          createdAt: { gte: prevYearStart, lte: prevYearEnd },
          ...(filters?.cedanteId && { cedanteId: filters.cedanteId }),
        },
      }),
      this.prisma.cedante.count({ where: { isActive: true } }),
      this.prisma.sinistre.count({ where: { statut: { notIn: ['CLOS', 'REJETE'] } } }),
    ]);

    const caRealise = Number(currentCA._sum.montantTnd ?? 0);
    const caPrev = Number(prevCA._sum.montantTnd ?? 0);
    const caTrend = caPrev > 0 ? Math.round(((caRealise - caPrev) / caPrev) * 100 * 100) / 100 : 0;

    const commissionARS = await this.prisma.affaireReassureur.aggregate({
      where: filters?.reassureurId ? { reassureurId: filters.reassureurId } : undefined,
      _sum: { commissionArs: true },
    });
    const margeARS = Number(commissionARS._sum.commissionArs ?? 0);

    const margePrevYear = await this.prisma.affaireReassureur.aggregate({
      where: {
        affaire: { createdAt: { gte: prevYearStart, lte: prevYearEnd } },
        ...(filters?.reassureurId && { reassureurId: filters.reassureurId }),
      },
      _sum: { commissionArs: true },
    });
    const margePrev = Number(margePrevYear._sum.commissionArs ?? 0);
    const margeTrend = margePrev > 0 ? Math.round(((margeARS - margePrev) / margePrev) * 100 * 100) / 100 : 0;

    const [totalEnc, totalDec] = await Promise.all([
      this.prisma.encaissement.aggregate({ _sum: { montantTnd: true } }),
      this.prisma.decaissement.aggregate({ _sum: { montantTnd: true } }),
    ]);
    const tresorerieValue = Number(totalEnc._sum.montantTnd ?? 0) - Number(totalDec._sum.montantTnd ?? 0);

    const [tresoreriePrev, tresoreriePrevDec] = await Promise.all([
      this.prisma.encaissement.aggregate({
        where: { dateEncaissement: { lte: prevYearEnd } },
        _sum: { montantTnd: true },
      }),
      this.prisma.decaissement.aggregate({
        where: { dateDecaissement: { lte: prevYearEnd } },
        _sum: { montantTnd: true },
      }),
    ]);
    const tresoreriePrevValue = Number(tresoreriePrev._sum.montantTnd ?? 0) - Number(tresoreriePrevDec._sum.montantTnd ?? 0);
    const tresorerieTrend = tresoreriePrevValue !== 0
      ? Math.round(((tresorerieValue - tresoreriePrevValue) / Math.abs(tresoreriePrevValue)) * 100 * 100) / 100
      : 0;

    const sinistresMontant = await this.prisma.sinistre.aggregate({
      where: { dateSurvenance: { gte: startOfYear, lte: endOfYear } },
      _sum: { partReassureurs: true },
    });
    const sinistresPrevMontant = await this.prisma.sinistre.aggregate({
      where: { dateSurvenance: { gte: prevYearStart, lte: prevYearEnd } },
      _sum: { partReassureurs: true },
    });
    const prevSinistresCount = await this.prisma.sinistre.count({
      where: { dateSurvenance: { gte: prevYearStart, lte: prevYearEnd }, statut: { notIn: ['CLOS', 'REJETE'] } },
    });
    const sinistresTrend = prevSinistresCount > 0
      ? Math.round(((sinistresCount - prevSinistresCount) / prevSinistresCount) * 100 * 100) / 100
      : 0;

    const tauxSinistralite = caRealise > 0
      ? Math.round((Number(sinistresMontant._sum.partReassureurs ?? 0) / caRealise) * 100 * 100) / 100
      : 0;

    const affairesTrend = prevAffairesCount > 0
      ? Math.round(((affairesCount - prevAffairesCount) / prevAffairesCount) * 100 * 100) / 100
      : 0;

    const prevCedantesCount = await this.prisma.cedante.count({
      where: { isActive: true, createdAt: { lte: prevYearEnd } },
    });
    const cedantesTrend = prevCedantesCount > 0
      ? Math.round(((cedantesCount - prevCedantesCount) / prevCedantesCount) * 100 * 100) / 100
      : 0;

    const budgetTargets = await this.prisma.budgetTarget.findMany({
      where: { annee: year, ...(filters?.cedanteId && { cedanteId: filters.cedanteId }) },
    });
    const totalTarget = budgetTargets.reduce((s, t) => s + Number(t.targetCA), 0);
    const tauxRealisation = totalTarget > 0 ? Math.round((caRealise / totalTarget) * 100 * 100) / 100 : 0;

    // Calculate primes à encaisser from facultative affaires
    const affairesAvecPrimes = await this.prisma.affaire.findMany({
      where: {
        isActive: true,
        statut: 'PLACEMENT_REALISE',
        type: 'FACULTATIVE',
        ...(filters?.cedanteId && { cedanteId: filters.cedanteId }),
      },
      include: {
        facultativeData: { select: { primeCedee: true } },
        encaissements: { select: { montantTnd: true } },
      },
    });

    let primesAEncaisserTotal = 0;
    for (const affaire of affairesAvecPrimes) {
      const primeCedee = Number(affaire.facultativeData?.primeCedee ?? 0);
      const totalEncaisse = affaire.encaissements.reduce((s, e) => s + Number(e.montantTnd ?? 0), 0);
      const reste = primeCedee - totalEncaisse;
      if (reste > 0) primesAEncaisserTotal += reste;
    }

    return {
      ca: {
        realise: caRealise,
        previsionnel: totalTarget || caRealise,
        trend: caTrend,
        tauxRealisation,
      },
      margeARS: { value: margeARS, trend: margeTrend },
      tresorerie: { value: tresorerieValue, trend: tresorerieTrend },
      sinistres: {
        ouverts: sinistresCount,
        trend: sinistresTrend,
        montantTotal: Number(sinistresMontant._sum.partReassureurs ?? 0),
        tauxSinistralite,
      },
      affaires: { total: affairesCount, trend: affairesTrend },
      cedantes: { actives: cedantesCount, trend: cedantesTrend },
      primesAEncaisser: { montant: primesAEncaisserTotal },
    };
  }

  async getCAEvolution() {
    const year = new Date().getFullYear();
    const prevYear = year - 1;
    const months = [];

    for (let m = 0; m < 12; m++) {
      const monthStart = new Date(year, m, 1);
      const monthEnd = new Date(year, m + 1, 0);
      const prevMonthStart = new Date(prevYear, m, 1);
      const prevMonthEnd = new Date(prevYear, m + 1, 0);

      const [current, previous] = await Promise.all([
        this.prisma.encaissement.aggregate({
          where: { dateEncaissement: { gte: monthStart, lte: monthEnd } },
          _sum: { montantTnd: true },
        }),
        this.prisma.encaissement.aggregate({
          where: { dateEncaissement: { gte: prevMonthStart, lte: prevMonthEnd } },
          _sum: { montantTnd: true },
        }),
      ]);

      const budgetTarget = await this.prisma.budgetTarget.findFirst({
        where: { annee: year, mois: m + 1 },
      });

      months.push({
        month: monthStart.toLocaleDateString('fr-FR', { month: 'short' }),
        realise: Number(current._sum.montantTnd ?? 0),
        previsionnel: Number(budgetTarget?.targetCA ?? previous._sum.montantTnd ?? 0),
      });
    }
    return months;
  }

  async getCACedantes(limit = 10) {
    const year = new Date().getFullYear();
    const result = await this.prisma.encaissement.groupBy({
      by: ['cedanteId'],
      where: { cedanteId: { not: null }, dateEncaissement: { gte: new Date(`${year}-01-01`) } },
      _sum: { montantTnd: true },
      orderBy: { _sum: { montantTnd: 'desc' } },
      take: limit,
    });

    const cedanteIds = result.map(r => r.cedanteId).filter(Boolean) as string[];
    const cedantes = await this.prisma.cedante.findMany({ where: { id: { in: cedanteIds } } });
    const cedanteMap = new Map(cedantes.map(c => [c.id, c]));

    const total = result.reduce((s, r) => s + Number(r._sum.montantTnd ?? 0), 0);
    return result.map(r => ({
      cedanteName: cedanteMap.get(r.cedanteId!)?.raisonSociale ?? 'Inconnu',
      ca: Number(r._sum.montantTnd ?? 0),
      percentage: total > 0 ? (Number(r._sum.montantTnd ?? 0) / total) * 100 : 0,
    }));
  }

  async getCAReassureurs(limit = 5) {
    const year = new Date().getFullYear();
    const result = await this.prisma.affaireReassureur.groupBy({
      by: ['reassureurId'],
      _sum: { primeBrute: true },
      orderBy: { _sum: { primeBrute: 'desc' } },
      take: limit,
    });

    const reassureurIds = result.map(r => r.reassureurId);
    const reassureurs = await this.prisma.reassureur.findMany({ where: { id: { in: reassureurIds } } });
    const reassureurMap = new Map(reassureurs.map(r => [r.id, r]));

    return result.map(r => ({
      reassureurName: reassureurMap.get(r.reassureurId)?.raisonSociale ?? 'Inconnu',
      ca: Number(r._sum.primeBrute ?? 0),
    }));
  }

  async getSinistresTrend(months = 12) {
    const result = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const [primes, sinistres] = await Promise.all([
        this.prisma.encaissement.aggregate({ where: { dateEncaissement: { gte: monthStart, lte: monthEnd } }, _sum: { montantTnd: true } }),
        this.prisma.sinistre.aggregate({ where: { dateSurvenance: { gte: monthStart, lte: monthEnd } }, _sum: { partReassureurs: true } }),
      ]);
      result.push({
        month: monthStart.toLocaleDateString('fr-FR', { month: 'short' }),
        primes: Number(primes._sum.montantTnd ?? 0),
        sinistres: Number(sinistres._sum.partReassureurs ?? 0),
      });
    }
    return result;
  }

  async getTopAffaires(limit = 10) {
    const affaires = await this.prisma.affaire.findMany({
      where: { isActive: true, statut: 'PLACEMENT_REALISE', type: 'FACULTATIVE' },
      include: { cedante: true, facultativeData: true, reassureurs: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return affaires.map(a => ({
      id: a.id,
      numeroAffaire: a.numero,
      cedanteName: a.cedante.raisonSociale,
      prime: Number(a.facultativeData?.primeCedee ?? 0),
      commissionARS: a.reassureurs.reduce((s, r) => s + Number(r.commissionArs ?? 0), 0),
    }));
  }

  async getSinistresMajeurs(minAmount = 50000, limit = 10) {
    const sinistres = await this.prisma.sinistre.findMany({
      where: { partReassureurs: { gte: minAmount } },
      include: { affaire: { include: { cedante: true } } },
      orderBy: { partReassureurs: 'desc' },
      take: limit,
    });

    return sinistres.map(s => ({
      id: s.id,
      numeroSinistre: s.numero,
      affaireNumero: s.affaire.numero,
      cedanteName: s.affaire.cedante.raisonSociale,
      montant: Number(s.partReassureurs ?? 0),
      joursOuvert: Math.floor((Date.now() - s.dateDeclaration.getTime()) / (1000 * 60 * 60 * 24)),
      statut: s.statut,
    }));
  }

  async getEcheances(days = 7) {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const affaires = await this.prisma.affaire.findMany({
      where: {
        isActive: true,
        OR: [
          { facultativeData: { dateEcheance: { gte: now, lte: future } } },
          { traiteData: { dateEcheance: { gte: now, lte: future } } },
        ],
      },
      include: { facultativeData: true, traiteData: true },
      take: 20,
    });

    return affaires.map(a => ({
      id: a.id,
      type: a.type,
      affaireNumero: a.numero,
      montant: Number(a.facultativeData?.primeCedee ?? 0),
      dateEcheance: (a.facultativeData?.dateEcheance ?? a.traiteData?.dateEcheance)?.toISOString() ?? '',
      responsable: 'Service Réassurance',
    }));
  }

  async getAlerts() {
    const [sinistresCritiques, echeancesProches, ordresEnAttente] = await Promise.all([
      this.prisma.sinistre.count({ where: { appelAuComptant: true, statut: { notIn: ['CLOS', 'RECUPERE'] } } }),
      this.prisma.affaire.count({
        where: {
          isActive: true,
          OR: [
            { facultativeData: { dateEcheance: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } } },
            { traiteData: { dateEcheance: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } } },
          ],
        },
      }),
      this.prisma.ordrePaiement.count({ where: { statut: 'BROUILLON' } }),
    ]);

    const alerts = [];
    if (sinistresCritiques > 0) {
      alerts.push({ id: '1', title: 'Sinistres critiques', message: `${sinistresCritiques} sinistres avec appel au comptant en attente`, severity: 'critical' as const });
    }
    if (echeancesProches > 0) {
      alerts.push({ id: '2', title: 'Échéances proches', message: `${echeancesProches} affaires arrivent à échéance dans 7 jours`, severity: 'high' as const });
    }
    if (ordresEnAttente > 0) {
      alerts.push({ id: '3', title: 'Ordres de paiement', message: `${ordresEnAttente} ordres en attente de validation`, severity: 'medium' as const });
    }
    return alerts;
  }

  async getCashFlow(filters?: { startDate?: string; endDate?: string }) {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const [enc, dec] = await Promise.all([
        this.prisma.encaissement.aggregate({ where: { dateEncaissement: { gte: monthStart, lte: monthEnd } }, _sum: { montantTnd: true } }),
        this.prisma.decaissement.aggregate({ where: { dateDecaissement: { gte: monthStart, lte: monthEnd } }, _sum: { montantTnd: true } }),
      ]);
      months.push({
        date: monthStart.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }),
        encaissements: Number(enc._sum.montantTnd ?? 0),
        decaissements: Number(dec._sum.montantTnd ?? 0),
      });
    }
    return months;
  }

  async getFinanceDashboard(filters?: { startDate?: string; endDate?: string }) {
    const year = new Date().getFullYear();
    const startDate = filters?.startDate ? new Date(filters.startDate) : new Date(`${year}-01-01`);
    const endDate = filters?.endDate ? new Date(filters.endDate) : new Date();

    // Aging report — primes à encaisser par tranche d'âge
    const affairesNonPayees = await this.prisma.affaire.findMany({
      where: {
        isActive: true,
        statut: 'PLACEMENT_REALISE',
        facultativeData: { primeCedee: { gt: 0 } },
      },
      include: { facultativeData: true, encaissements: true },
    });

    const agingReport = [];
    const now = Date.now();
    const buckets = [
      { label: '0-30 jours', min: 0, max: 30 },
      { label: '31-60 jours', min: 31, max: 60 },
      { label: '61-90 jours', min: 61, max: 90 },
      { label: '91-180 jours', min: 91, max: 180 },
      { label: '+180 jours', min: 181, max: Infinity },
    ];

    for (const bucket of buckets) {
      let montantDu = 0;
      for (const affaire of affairesNonPayees) {
        const primeCedee = Number(affaire.facultativeData?.primeCedee ?? 0);
        const totalEncaisse = affaire.encaissements.reduce((s, e) => s + Number(e.montantTnd ?? 0), 0);
        const reste = primeCedee - totalEncaisse;
        if (reste > 0 && affaire.facultativeData?.dateEffet) {
          const ageJours = Math.floor((now - affaire.facultativeData.dateEffet.getTime()) / (1000 * 60 * 60 * 24));
          if (ageJours >= bucket.min && ageJours <= bucket.max) {
            montantDu += reste;
          }
        }
      }
      agingReport.push({ bucket: bucket.label, montantDu });
    }

    // Commission dashboard
    const commissionARS = await this.prisma.affaireReassureur.aggregate({
      where: { affaire: { createdAt: { gte: startDate, lte: endDate } } },
      _sum: { commissionArs: true, commissionCedante: true },
    });

    const ordresPaiement = await this.prisma.ordrePaiement.aggregate({
      where: { statut: { in: ['BROUILLON', 'VALIDE'] }, createdAt: { gte: startDate, lte: endDate } },
      _sum: { montant: true },
    });

    // Pending approvals
    const pendingDecaissements = await this.prisma.decaissement.findMany({
      where: { dateDecaissement: { gte: startDate, lte: endDate }, ordrePaiementId: null },
      take: 20,
    });

    return {
      agingReport,
      commissionDashboard: {
        commissionARS: Number(commissionARS._sum.commissionArs ?? 0),
        commissionCedante: Number(commissionARS._sum.commissionCedante ?? 0),
        aPayer: Number(ordresPaiement._sum.montant ?? 0),
      },
      pendingApprovals: {
        items: pendingDecaissements.map((d) => ({
          id: d.id,
          type: 'decaissement',
          beneficiaire: d.reassureurCode ?? 'Inconnu',
          montant: Number(d.montantTnd ?? 0),
          date: d.dateDecaissement.toISOString(),
        })),
      },
    };
  }
}