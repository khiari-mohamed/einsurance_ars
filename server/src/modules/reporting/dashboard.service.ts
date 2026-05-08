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
}