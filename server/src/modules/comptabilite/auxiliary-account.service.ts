import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAuxiliaryAccountDto } from './dto/create-auxiliary-account.dto';

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

  async create(data: CreateAuxiliaryAccountDto) {
    const plan = await this.prisma.planComptable.findUnique({ where: { id: data.planComptableId } });
    if (!plan) throw new NotFoundException('Compte général introuvable');
    return this.prisma.auxiliaryAccount.create({ data });
  }

  /**
   * Auto-create (idempotent, upsert-based) auxiliary accounts for a
   * cedante or reassureur. NOTE (Comptabilité pass): this was already
   * written but is never called from CedantesService.create()/
   * ReassureursService.create() (verified against the Référentiel module
   * reviewed earlier in this engagement) — meaning auxiliary accounts
   * practically never exist, and every journal line's auxiliaryId ends up
   * null, losing per-tiers traceability at the general-ledger level. Can't
   * fix that at the source without touching those Référentiel files (out
   * of scope here) — closed the practical gap by having
   * AccountingEngineService call these lazily at generation time instead
   * (see accounting-engine.service.ts). Recommend wiring these into
   * Cedantes/ReassureursService.create() directly next time that module is
   * revisited, so the auxiliary account exists from day one rather than
   * being created retroactively on first journal entry.
   */
  async createForCedante(cedanteId: string, compteComptable: string, raisonSociale: string) {
    const plan = await this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '411' } } });
    if (!plan) return null;
    return this.prisma.auxiliaryAccount.upsert({
      where: { planComptableId_code: { planComptableId: plan.id, code: compteComptable } },
      update: {},
      create: { planComptableId: plan.id, code: compteComptable, libelle: raisonSociale, cedanteId },
    });
  }

  async createForReassureur(reassureurId: string, compteComptable: string, raisonSociale: string) {
    const plan = await this.prisma.planComptable.findFirst({ where: { compte: { startsWith: '401' } } });
    if (!plan) return null;
    return this.prisma.auxiliaryAccount.upsert({
      where: { planComptableId_code: { planComptableId: plan.id, code: compteComptable } },
      update: {},
      create: { planComptableId: plan.id, code: compteComptable, libelle: raisonSociale, reassureurId },
    });
  }
}