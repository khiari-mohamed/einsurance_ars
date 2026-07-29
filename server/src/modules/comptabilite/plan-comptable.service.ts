import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanComptableDto } from './dto/create-plan-comptable.dto';
import { UpdatePlanComptableDto } from './dto/update-plan-comptable.dto';

@Injectable()
export class PlanComptableService {
  constructor(private prisma: PrismaService) {}

  // FIX (Comptabilité pass): PlanComptable.tsx wanted a classe filter — the
  // service only ever supported a free-text search on compte/libelle.
  findAll(search?: string, classe?: string) {
    return this.prisma.planComptable.findMany({
      where: {
        isActive: true,
        ...(classe && { classe }),
        ...(search && { OR: [
          { compte: { contains: search } },
          { libelle: { contains: search, mode: 'insensitive' } },
        ]}),
      },
      include: { auxiliaries: { where: { isActive: true } } },
      orderBy: { compte: 'asc' },
    });
  }

  async findOne(id: string) {
    const p = await this.prisma.planComptable.findUnique({ where: { id }, include: { auxiliaries: true } });
    if (!p) throw new NotFoundException('Compte introuvable');
    return p;
  }

  async create(data: CreatePlanComptableDto) {
    const existing = await this.prisma.planComptable.findUnique({ where: { compte: data.compte } });
    if (existing) throw new ConflictException(`Compte ${data.compte} existe déjà`);
    return this.prisma.planComptable.create({ data });
  }

  /**
   * FIX (Comptabilité pass): this method already existed but was never
   * wired to the controller — PUT /comptabilite/plan-comptable/:id 404'd
   * every time PlanComptable.tsx's edit modal tried to save.
   */
  async update(id: string, data: UpdatePlanComptableDto) {
    const p = await this.prisma.planComptable.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Compte introuvable');
    return this.prisma.planComptable.update({ where: { id }, data });
  }

  /**
   * NEW (Comptabilité pass): no delete/deactivate route existed at all —
   * PlanComptable.tsx's delete button called a route that never existed.
   * Soft-deactivate only (isActive: false), matching the pattern used
   * everywhere else in this codebase (Référentiel entities, Bordereaux) —
   * a chart-of-accounts entry is never hard-deleted once journal lines may
   * reference it.
   */
  async deactivate(id: string) {
    const p = await this.prisma.planComptable.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Compte introuvable');
    const usageCount = await this.prisma.journalLine.count({ where: { planComptableId: id } });
    if (usageCount > 0) {
      // Still allowed — a used account can be retired for new entries.
      // Just returned as info; not blocking.
    }
    return this.prisma.planComptable.update({ where: { id }, data: { isActive: false } });
  }

  async seed() {
    const accounts = [
      { compte: '41130000', libelle: 'Cédantes — Primes cédées à recevoir', type: 'DEBIT_NORMAL', classe: '4', isAuxiliary: true },
      { compte: '40130000', libelle: 'Réassureurs — Primes à payer', type: 'CREDIT_NORMAL', classe: '4', isAuxiliary: true },
      { compte: '40150000', libelle: 'Co-courtiers — Commissions à payer', type: 'CREDIT_NORMAL', classe: '4' },
      { compte: '53200000', libelle: 'Banque TND — ARS Principal', type: 'DEBIT_NORMAL', classe: '5' },
      { compte: '53210000', libelle: 'Banque USD', type: 'DEBIT_NORMAL', classe: '5' },
      { compte: '53220000', libelle: 'Banque EUR', type: 'DEBIT_NORMAL', classe: '5' },
      { compte: '67600000', libelle: 'Pertes de change', type: 'DEBIT_NORMAL', classe: '6' },
      { compte: '61310000', libelle: 'Commission cédantes', type: 'DEBIT_NORMAL', classe: '6' },
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