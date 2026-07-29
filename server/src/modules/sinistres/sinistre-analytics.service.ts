import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SinistreAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getKpis(cedanteId?: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const dateFrom = new Date(`${targetYear}-01-01`);
    const dateTo = new Date(`${targetYear}-12-31`);

    const where: any = {
      dateSurvenance: { gte: dateFrom, lte: dateTo },
      ...(cedanteId && { affaire: { cedanteId } }),
    };

    const [total, parStatut, reserves] = await Promise.all([
      this.prisma.sinistre.count({ where }),
      this.prisma.sinistre.groupBy({
        by: ['statut'],
        where,
        _count: { id: true },
      }),
      this.prisma.sinistre.aggregate({
        where,
        _sum: { reserves: true, partReassureurs: true, sap: true },
      }),
    ]);

    return {
      totalSinistres: total,
      parStatut: parStatut.reduce((acc, s) => ({ ...acc, [s.statut]: s._count.id }), {}),
      reservesTotales: Number(reserves._sum.reserves ?? 0),
      partReassureursTotale: Number(reserves._sum.partReassureurs ?? 0),
      sapTotal: Number(reserves._sum.sap ?? 0),
      year: targetYear,
    };
  }

  async getLossRatio(cedanteId?: string, year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const dateFrom = new Date(`${targetYear}-01-01`);
    const dateTo = new Date(`${targetYear}-12-31`);

    const totalPrimes = await this.prisma.encaissement.aggregate({
      where: {
        dateEncaissement: { gte: dateFrom, lte: dateTo },
        ...(cedanteId && { affaire: { cedanteId } }),
      },
      _sum: { montant: true },
    });

    const totalSinistres = await this.prisma.sinistre.aggregate({
      where: {
        dateSurvenance: { gte: dateFrom, lte: dateTo },
        ...(cedanteId && { affaire: { cedanteId } }),
      },
      _sum: { partReassureurs: true },
    });

    const primes = Number(totalPrimes._sum.montant ?? 0);
    const sinistres = Number(totalSinistres._sum.partReassureurs ?? 0);
    const ratio = primes > 0 ? (sinistres / primes) * 100 : 0;

    return { primes, sinistres, lossRatioPct: Math.round(ratio * 100) / 100, year: targetYear };
  }

  // ============================================================
  // NEW (Sinistres pass) — real implementations replacing the frontend's
  // hardcoded Promise.resolve({ data: [] }) stubs in sinistres.api.ts.
  // ============================================================

  /** Monthly count + ceded-amount evolution over the trailing N months. */
  async getEvolution(months = 12) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.$queryRaw<Array<{ period: string; count: bigint; amount: Prisma.Decimal | null }>>`
      SELECT to_char(date_trunc('month', "dateSurvenance"), 'YYYY-MM') as period,
             count(*)::bigint as count,
             COALESCE(sum("partReassureurs"), 0) as amount
      FROM "Sinistre"
      WHERE "dateSurvenance" >= ${since}
      GROUP BY period
      ORDER BY period ASC
    `;

    return rows.map((r) => ({
      period: r.period,
      count: Number(r.count),
      amount: Number(r.amount ?? 0),
    }));
  }

  /** Top cedantes by ceded claim amount. */
  async getByCedante(limit = 10) {
    const rows = await this.prisma.$queryRaw<Array<{ cedante: string; count: bigint; amount: Prisma.Decimal | null }>>`
      SELECT c."raisonSociale" as cedante,
             count(s.id)::bigint as count,
             COALESCE(sum(s."partReassureurs"), 0) as amount
      FROM "Sinistre" s
      JOIN "Affaire" a ON a.id = s."affaireId"
      JOIN "Cedante" c ON c.id = a."cedanteId"
      GROUP BY c."raisonSociale"
      ORDER BY amount DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      cedante: r.cedante,
      count: Number(r.count),
      amount: Number(r.amount ?? 0),
    }));
  }

  /** Distribution by SinistreStatut, with total ceded amount per status. */
  async getByStatus() {
    const rows = await this.prisma.sinistre.groupBy({
      by: ['statut'],
      _count: { id: true },
      _sum: { partReassureurs: true },
    });

    return rows.map((r) => ({
      status: r.statut,
      count: r._count.id,
      amount: Number(r._sum.partReassureurs ?? 0),
    }));
  }

  /**
   * Aging of open claims (excludes CLOS/REJETE) bucketed by days since
   * declaration, using `reserves` as the outstanding-exposure figure —
   * the amount still on the books for an open claim, as opposed to
   * partReassureurs (a settled/ceded figure) or sap (year-end specific).
   */
  async getAging() {
    const open = await this.prisma.sinistre.findMany({
      where: { statut: { notIn: ['CLOS', 'REJETE'] } },
      select: { dateDeclaration: true, reserves: true },
    });

    const now = Date.now();
    const buckets = {
      '0-30 jours': { count: 0, amount: 0 },
      '31-60 jours': { count: 0, amount: 0 },
      '61-90 jours': { count: 0, amount: 0 },
      '+90 jours': { count: 0, amount: 0 },
    };

    for (const s of open) {
      const days = Math.floor((now - s.dateDeclaration.getTime()) / 86_400_000);
      const amount = Number(s.reserves ?? 0);
      let bucket: keyof typeof buckets = '0-30 jours';
      if (days > 90) bucket = '+90 jours';
      else if (days > 60) bucket = '61-90 jours';
      else if (days > 30) bucket = '31-60 jours';
      buckets[bucket].count += 1;
      buckets[bucket].amount += amount;
    }

    return buckets;
  }
}