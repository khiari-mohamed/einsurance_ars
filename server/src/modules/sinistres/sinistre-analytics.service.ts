import { Injectable } from '@nestjs/common';
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

    const [total, parStatut, reserves, partReassureurs] = await Promise.all([
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
      this.prisma.sinistre.aggregate({
        where: { ...where, partReassureurs: { not: null } },
        _sum: { partReassureurs: true },
        _avg: { partReassureurs: true },
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

    // Total premiums collected (encaissements in the year)
    const totalPrimes = await this.prisma.encaissement.aggregate({
      where: {
        dateEncaissement: { gte: dateFrom, lte: dateTo },
        ...(cedanteId && { affaire: { cedanteId } }),
      },
      _sum: { montant: true },
    });

    // Total sinistres charges
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
}