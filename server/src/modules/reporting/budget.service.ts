import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BudgetService {
  constructor(private prisma: PrismaService) {}

  async setTarget(data: { annee: number; mois?: number; cedanteId?: string; reassureurCode?: string; targetCA: number }) {
    return this.prisma.budgetTarget.upsert({
      where: {
        annee_mois_cedanteId_reassureurCode: {
          annee: data.annee,
          mois: data.mois ?? null as any,
          cedanteId: data.cedanteId ?? null as any,
          reassureurCode: data.reassureurCode ?? null as any,
        },
      },
      update: { targetCA: data.targetCA },
      create: data,
    });
  }

  async refreshActuals(annee: number) {
    const targets = await this.prisma.budgetTarget.findMany({ where: { annee } });

    for (const target of targets) {
      const dateFrom = target.mois
        ? new Date(annee, (target.mois - 1), 1)
        : new Date(`${annee}-01-01`);
      const dateTo = target.mois
        ? new Date(annee, target.mois, 0)
        : new Date(`${annee}-12-31`);

      const where: any = { dateEncaissement: { gte: dateFrom, lte: dateTo } };
      if (target.cedanteId) where.cedanteId = target.cedanteId;

      const actual = await this.prisma.encaissement.aggregate({ where, _sum: { montantTnd: true } });
      const actualCA = Number(actual._sum.montantTnd ?? 0);
      const variancePct = Number(target.targetCA) > 0
        ? Math.round(((actualCA - Number(target.targetCA)) / Number(target.targetCA)) * 100 * 100) / 100
        : 0;

      await this.prisma.budgetTarget.update({
        where: { id: target.id },
        data: { actualCA, variancePct },
      });
    }

    return { refreshed: targets.length };
  }

  getTargets(annee?: number) {
    return this.prisma.budgetTarget.findMany({
      where: annee ? { annee } : {},
      orderBy: [{ annee: 'desc' }, { mois: 'asc' }],
    });
  }
}