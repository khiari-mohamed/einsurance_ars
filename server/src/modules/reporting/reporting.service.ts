import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReportingService {
  constructor(private prisma: PrismaService) {}

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

    const totalPrimes = encaissements.reduce((s, e) => s + Number(e.montantTnd ?? e.montant), 0);
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

  async getReassureurStatement(reassureurCode: string, year: number) {
    const dateFrom = new Date(`${year}-01-01`);
    const dateTo = new Date(`${year}-12-31`);

    const [reassureur, participations, decaissements] = await Promise.all([
      this.prisma.reassureur.findFirst({ where: { code: reassureurCode } }),
      this.prisma.affaireReassureur.findMany({
        where: {
          reassureur: { code: reassureurCode },
          affaire: { isActive: true },
        },
        include: {
          affaire: { include: { cedante: true, facultativeData: true } },
        },
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