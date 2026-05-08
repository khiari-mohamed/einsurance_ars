import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuxiliaryAccountService {
  constructor(private prisma: PrismaService) {}

  findAll(planComptableId?: string) {
    return this.prisma.auxiliaryAccount.findMany({
      where: { isActive: true, ...(planComptableId && { planComptableId }) },
      include: { planComptable: true, cedante: { select: { code: true, raisonSociale: true } }, reassureur: { select: { code: true, raisonSociale: true } } },
      orderBy: { code: 'asc' },
    });
  }

  async create(data: { planComptableId: string; code: string; libelle: string; cedanteId?: string; reassureurId?: string }) {
    const plan = await this.prisma.planComptable.findUnique({ where: { id: data.planComptableId } });
    if (!plan) throw new NotFoundException('Compte général introuvable');
    return this.prisma.auxiliaryAccount.create({ data });
  }

  /**
   * Auto-create auxiliary accounts for a new cedante or reassureur.
   * Called when master data is created.
   */
  async createForCedante(cedanteId: string, compteComptable: string, raisonSociale: string) {
    const plan = await this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '411' } } });
    if (!plan) return;
    await this.prisma.auxiliaryAccount.upsert({
      where: { planComptableId_code: { planComptableId: plan.id, code: compteComptable } },
      update: {},
      create: { planComptableId: plan.id, code: compteComptable, libelle: raisonSociale, cedanteId },
    });
  }

  async createForReassureur(reassureurId: string, compteComptable: string, raisonSociale: string) {
    const plan = await this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '401' } } });
    if (!plan) return;
    await this.prisma.auxiliaryAccount.upsert({
      where: { planComptableId_code: { planComptableId: plan.id, code: compteComptable } },
      update: {},
      create: { planComptableId: plan.id, code: compteComptable, libelle: raisonSociale, reassureurId },
    });
  }
}