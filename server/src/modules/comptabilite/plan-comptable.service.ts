import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PlanComptableService {
  constructor(private prisma: PrismaService) {}

  findAll(search?: string) {
    return this.prisma.planComptable.findMany({
      where: {
        isActive: true,
        ...(search && { OR: [
          { compte: { contains: search } },
          { libelle: { contains: search, mode: 'insensitive' } },
        ]}),
      },
      include: { auxiliaries: { where: { isActive: true } } },
      orderBy: { compte: 'asc' },
    });
  }

  async create(data: { compte: string; libelle: string; type: string; classe: string; isAuxiliary?: boolean }) {
    const existing = await this.prisma.planComptable.findUnique({ where: { compte: data.compte } });
    if (existing) throw new ConflictException(`Compte ${data.compte} existe déjà`);
    return this.prisma.planComptable.create({ data });
  }

  async update(id: string, data: Partial<{ libelle: string; isActive: boolean }>) {
    const p = await this.prisma.planComptable.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Compte introuvable');
    return this.prisma.planComptable.update({ where: { id }, data });
  }

  /** Seed standard ARS chart of accounts — idempotent */
  async seed() {
    const accounts = [
      // Class 4 — Third-party accounts
      { compte: '41130000', libelle: 'Cédantes — Primes cédées à recevoir', type: 'DEBIT_NORMAL', classe: '4', isAuxiliary: true },
      { compte: '40130000', libelle: 'Réassureurs — Primes à payer', type: 'CREDIT_NORMAL', classe: '4', isAuxiliary: true },
      { compte: '40150000', libelle: 'Co-courtiers — Commissions à payer', type: 'CREDIT_NORMAL', classe: '4' },
      // Class 5 — Financial accounts
      { compte: '53200000', libelle: 'Banque TND — ARS Principal', type: 'DEBIT_NORMAL', classe: '5' },
      { compte: '53210000', libelle: 'Banque USD', type: 'DEBIT_NORMAL', classe: '5' },
      { compte: '53220000', libelle: 'Banque EUR', type: 'DEBIT_NORMAL', classe: '5' },
      // Class 6 — Charges
      { compte: '67600000', libelle: 'Pertes de change', type: 'DEBIT_NORMAL', classe: '6' },
      { compte: '61310000', libelle: 'Commission cédantes', type: 'DEBIT_NORMAL', classe: '6' },
      // Class 7 — Revenues
      { compte: '70510000', libelle: 'Commissions de courtage ARS', type: 'CREDIT_NORMAL', classe: '7' },
      { compte: '77600000', libelle: 'Gains de change', type: 'CREDIT_NORMAL', classe: '7' },
    ];

    for (const acc of accounts) {
      await this.prisma.planComptable.upsert({
        where: { compte: acc.compte },
        update: { libelle: acc.libelle },
        create: acc,
      });
    }

    return { seeded: accounts.length };
  }
}