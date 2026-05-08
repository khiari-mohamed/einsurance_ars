import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ComptabiliteService {
  constructor(private prisma: PrismaService) {}

  async findEntries(filters: { statut?: string; type?: string; affaireId?: string; fiscalPeriodId?: string; page?: number; limit?: number }) {
    const { statut, type, affaireId, fiscalPeriodId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (statut) where.statut = statut;
    if (type) where.type = type;
    if (affaireId) where.affaireId = affaireId;
    if (fiscalPeriodId) where.fiscalPeriodId = fiscalPeriodId;

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        include: {
          lines: { include: { planComptable: true, auxiliary: true }, orderBy: { ordre: 'asc' } },
          affaire: { select: { numero: true } },
          fiscalPeriod: true,
        },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const e = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: { include: { planComptable: true, auxiliary: true, cedante: true, reassureur: true }, orderBy: { ordre: 'asc' } },
        affaire: true,
        sinistre: true,
        bordereau: true,
        fiscalPeriod: true,
        fxGainLossItems: true,
      },
    });
    if (!e) throw new NotFoundException('Écriture introuvable');
    return e;
  }

  async validate(entryIds: string[], userId: string) {
    // Verify each entry is balanced before validation
    for (const id of entryIds) {
      const entry = await this.prisma.journalEntry.findUnique({
        where: { id },
        include: { lines: true },
      });
      if (!entry) continue;
      if (entry.statut === 'VALIDE') continue;

      const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
      const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
      const diff = Math.abs(totalDebit - totalCredit);
      if (diff > 0.001) {
        throw new BadRequestException(
          `Écriture ${entry.numero} non équilibrée: Débit ${totalDebit.toFixed(3)} ≠ Crédit ${totalCredit.toFixed(3)}`,
        );
      }
    }

    await this.prisma.journalEntry.updateMany({
      where: { id: { in: entryIds }, statut: 'BROUILLON' },
      data: { statut: 'VALIDE', validatedAt: new Date(), validatedBy: userId },
    });

    return { validated: entryIds.length };
  }

  async getLedger(compte?: string, cedanteId?: string, reassureurId?: string, year?: number) {
    const where: any = {};
    if (compte) where.planComptable = { compte: { startsWith: compte } };
    if (cedanteId) where.cedanteId = cedanteId;
    if (reassureurId) where.reassureurId = reassureurId;
    if (year) {
      where.journalEntry = { fiscalPeriod: { annee: year } };
    }

    const lines = await this.prisma.journalLine.findMany({
      where,
      include: {
        planComptable: true,
        auxiliary: true,
        journalEntry: { include: { fiscalPeriod: true } },
        cedante: { select: { code: true, raisonSociale: true } },
        reassureur: { select: { code: true, raisonSociale: true } },
      },
      orderBy: { journalEntry: { createdAt: 'asc' } },
    });

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
    const solde = Math.round((totalDebit - totalCredit) * 1000) / 1000;

    return { lines, totalDebit: Math.round(totalDebit * 1000) / 1000, totalCredit: Math.round(totalCredit * 1000) / 1000, solde };
  }

  async getTrialBalance(year?: number, mois?: number) {
    const periodWhere: any = {};
    if (year) periodWhere.annee = year;
    if (mois) periodWhere.mois = mois;

    const lines = await this.prisma.journalLine.findMany({
      where: {
        journalEntry: { statut: 'VALIDE', ...(Object.keys(periodWhere).length > 0 && { fiscalPeriod: periodWhere }) },
      },
      include: { planComptable: true },
    });

    // Group by account
    const balances: Record<string, { compte: string; libelle: string; debit: number; credit: number; solde: number }> = {};
    for (const line of lines) {
      const key = line.planComptable.compte;
      if (!balances[key]) {
        balances[key] = { compte: key, libelle: line.planComptable.libelle, debit: 0, credit: 0, solde: 0 };
      }
      balances[key].debit += Number(line.debit ?? 0);
      balances[key].credit += Number(line.credit ?? 0);
      balances[key].solde = balances[key].debit - balances[key].credit;
    }

    return Object.values(balances).sort((a, b) => a.compte.localeCompare(b.compte));
  }
}