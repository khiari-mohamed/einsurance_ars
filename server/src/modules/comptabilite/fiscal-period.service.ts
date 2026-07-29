import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ClosePeriodDto } from './dto/close-period.dto';

@Injectable()
export class FiscalPeriodService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.fiscalPeriod.findMany({ orderBy: [{ annee: 'desc' }, { mois: 'asc' }] });
  }

  async getOrCreateCurrent(): Promise<{ id: string }> {
    const now = new Date();
    const annee = now.getFullYear();
    const mois = now.getMonth() + 1;

    // FIX (Comptabilité pass): the old code called findFirst, then — if not
    // found — called the EXACT SAME findFirst query again immediately
    // before creating. Pure dead code (the second call always returns the
    // same null the first one did); removed.
    let period = await this.prisma.fiscalPeriod.findFirst({ where: { annee, mois } });
    if (!period) {
      period = await this.prisma.fiscalPeriod.create({
        data: { annee, mois, dateDebut: new Date(annee, mois - 1, 1), dateFin: new Date(annee, mois, 0, 23, 59, 59) },
      });
    }
    return period;
  }

  /**
   * NEW (Comptabilité pass): the frontend dashboard needs a single "what's
   * the current period and is it open/closed" view — no such endpoint
   * existed (only a bare list via findAll()).
   */
  async getCurrent() {
    const period = await this.getOrCreateCurrent();
    return this.prisma.fiscalPeriod.findUniqueOrThrow({ where: { id: period.id } });
  }

  async close(dto: ClosePeriodDto, userId: string) {
    const period = await this.prisma.fiscalPeriod.findUnique({
      where: { annee_mois: { annee: dto.annee, mois: dto.mois ?? (null as any) } },
    });
    if (!period) throw new NotFoundException('Période introuvable');
    if (period.isClosed) throw new BadRequestException('Période déjà clôturée');

    const unvalidated = await this.prisma.journalEntry.count({
      where: { fiscalPeriodId: period.id, statut: 'BROUILLON' },
    });
    if (unvalidated > 0) {
      throw new BadRequestException(`${unvalidated} écriture(s) en brouillon doivent être validées avant clôture`);
    }

    return this.prisma.fiscalPeriod.update({
      where: { id: period.id },
      data: { isClosed: true, closedAt: new Date(), closedByUserId: userId },
    });
  }

  /**
   * NEW (Comptabilité pass): the schema (isClosed/closedAt/closedByUserId)
   * was clearly built for a real open→close→reopen admin workflow, but no
   * reopen path existed at all — a mistaken closure was permanent. Gated
   * behind the same admin-only permission level as seed() at the
   * controller, since reopening a closed period is a sensitive override.
   */
  async reopen(dto: ClosePeriodDto, userId: string) {
    const period = await this.prisma.fiscalPeriod.findUnique({
      where: { annee_mois: { annee: dto.annee, mois: dto.mois ?? (null as any) } },
    });
    if (!period) throw new NotFoundException('Période introuvable');
    if (!period.isClosed) throw new BadRequestException('Période déjà ouverte');

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: period.id },
      data: { isClosed: false, closedAt: null, closedByUserId: null },
    });

    await this.prisma.auditLog.create({
      data: {
        userId, action: 'FISCAL_PERIOD_REOPENED', entityType: 'FiscalPeriod', entityId: period.id,
        before: { isClosed: true }, after: { isClosed: false },
      },
    });

    return updated;
  }

  async initYear(annee: number) {
    const existing = await this.prisma.fiscalPeriod.count({ where: { annee } });
    if (existing > 0) throw new BadRequestException(`Périodes ${annee} déjà initialisées`);

    const periods = Array.from({ length: 12 }, (_, i) => ({
      annee,
      mois: i + 1,
      dateDebut: new Date(annee, i, 1),
      dateFin: new Date(annee, i + 1, 0, 23, 59, 59),
    }));

    await this.prisma.fiscalPeriod.createMany({ data: periods });
    return { created: 12, annee };
  }
}