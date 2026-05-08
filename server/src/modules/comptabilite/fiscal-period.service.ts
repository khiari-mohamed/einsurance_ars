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

    // Use findFirst to avoid null uniqueness issue
    let period = await this.prisma.fiscalPeriod.findFirst({
      where: { annee, mois },
    });
    if (!period) {
      // Check there's no duplicate before creating
      const existing = await this.prisma.fiscalPeriod.findFirst({ where: { annee, mois } });
      if (existing) return existing;
      period = await this.prisma.fiscalPeriod.create({
        data: { annee, mois, dateDebut: new Date(annee, mois - 1, 1), dateFin: new Date(annee, mois, 0, 23, 59, 59) },
      });
    }
    return period;
  }

  async close(dto: ClosePeriodDto, userId: string) {
    const period = await this.prisma.fiscalPeriod.findUnique({
      where: { annee_mois: { annee: dto.annee, mois: dto.mois ?? null as any } },
    });
    if (!period) throw new NotFoundException('Période introuvable');
    if (period.isClosed) throw new BadRequestException('Période déjà clôturée');

    // Ensure all BROUILLON entries in this period are validated before closing
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