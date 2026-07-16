import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { FxGainLossService } from './fx-gain-loss.service';
import { AmlService } from './aml.service';
import { CreateEncaissementDto } from './dto/create-encaissement.dto';
import { CreateDecaissementDto } from './dto/create-decaissement.dto';

@Injectable()
export class FinancesService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private fxService: FxGainLossService,
    private aml: AmlService,
  ) {}

  // ── Encaissements ────────────────────────────────────────────────

  async findEncaissements(filters: { affaireId?: string; cedanteId?: string; page?: number; limit?: number }) {
    const { affaireId, cedanteId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (affaireId) where.affaireId = affaireId;
    if (cedanteId) where.cedanteId = cedanteId;
    const [data, total] = await Promise.all([
      this.prisma.encaissement.findMany({
        where,
        include: { affaire: { select: { numero: true } }, cedante: { select: { raisonSociale: true } } },
        skip, take: limit, orderBy: { dateEncaissement: 'desc' },
      }),
      this.prisma.encaissement.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findEncaissement(id: string) {
    const enc = await this.prisma.encaissement.findUnique({ where: { id }, include: { affaire: true, cedante: true } });
    if (!enc) throw new NotFoundException('Encaissement introuvable');
    return enc;
  }

  async createEncaissement(dto: CreateEncaissementDto) {
    const reference = await this.sequence.next('ENCAISSEMENT');
    const currency = dto.currency ?? 'TND';
    const tauxRealisation = dto.tauxRealisation ?? 1;
    const montantTnd = currency !== 'TND'
      ? Math.round(dto.montant * tauxRealisation * 1000) / 1000
      : dto.montant;

    const enc = await this.prisma.encaissement.create({
      data: {
        reference,
        affaireId: dto.affaireId,
        partyType: dto.partyType,
        cedanteId: dto.cedanteId,
        assureLabel: dto.assureLabel,
        montant: dto.montant,
        currency,
        tauxRealisation: dto.tauxRealisation,
        montantTnd,
        stepNumber: dto.stepNumber,
        dateEncaissement: dto.dateEncaissement ? new Date(dto.dateEncaissement) : new Date(),
        description: dto.description,
      },
    });

    await this.aml.checkEncaissement(enc.id);
    return enc;
  }

  async updateEncaissement(id: string, dto: any) {
    await this.findEncaissement(id);
    return this.prisma.encaissement.update({ where: { id }, data: dto });
  }

  async validateEncaissement(id: string) {
    await this.findEncaissement(id);
    return this.prisma.encaissement.update({ where: { id }, data: { /* status transition */ } });
  }

  async deleteEncaissement(id: string) {
    await this.findEncaissement(id);
    return this.prisma.encaissement.delete({ where: { id } });
  }

  // ── Décaissements ─────────────────────────────────────────────────

  async findDecaissements(filters: { affaireId?: string; page?: number; limit?: number }) {
    const { affaireId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (affaireId) where.affaireId = affaireId;
    const [data, total] = await Promise.all([
      this.prisma.decaissement.findMany({ where, skip, take: limit, orderBy: { dateDecaissement: 'desc' } }),
      this.prisma.decaissement.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findDecaissement(id: string) {
    const dec = await this.prisma.decaissement.findUnique({ where: { id } });
    if (!dec) throw new NotFoundException('Décaissement introuvable');
    return dec;
  }

  async createDecaissement(dto: CreateDecaissementDto) {
    const reference = await this.sequence.next('DECAISSEMENT');
    const currency = dto.currency ?? 'TND';
    const tauxReglement = dto.tauxReglement ?? 1;
    const montantTnd = currency !== 'TND'
      ? Math.round(dto.montant * tauxReglement * 1000) / 1000
      : dto.montant;

    return this.prisma.decaissement.create({
      data: {
        reference,
        affaireId: dto.affaireId,
        partyType: dto.partyType,
        reassureurCode: dto.reassureurCode,
        coCourtId: dto.coCourtId,
        montant: dto.montant,
        currency,
        tauxReglement: dto.tauxReglement,
        montantTnd,
        stepNumber: dto.stepNumber,
        description: dto.description,
      },
    });
  }

  async updateDecaissement(id: string, dto: any) {
    await this.findDecaissement(id);
    return this.prisma.decaissement.update({ where: { id }, data: dto });
  }

  async approveDecaissement(id: string, niveau: number, userId: string) {
    await this.findDecaissement(id);
    return this.prisma.decaissement.update({ where: { id }, data: { /* status update */ } });
  }

  async executeDecaissement(id: string) {
    await this.findDecaissement(id);
    return this.prisma.decaissement.update({ where: { id }, data: { /* status = executed */ } });
  }

  async deleteDecaissement(id: string) {
    await this.findDecaissement(id);
    return this.prisma.decaissement.delete({ where: { id } });
  }

  // ── Commissions ──────────────────────────────────────────────────

  async findCommissions(filters: { affaireId?: string; type?: string; statut?: string; page?: number; limit?: number }) {
    const { affaireId, type, statut, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (affaireId) where.affaireId = affaireId;
    if (type) where.type = type;
    if (statut) where.statut = statut;

    // Commission entries are derived from AffaireReassureur records
    const [data, total] = await Promise.all([
      this.prisma.affaireReassureur.findMany({
        where: { affaireId: affaireId ?? undefined },
        include: { reassureur: true, affaire: { select: { numero: true } } },
        skip, take: limit,
      }),
      this.prisma.affaireReassureur.count({ where: { affaireId: affaireId ?? undefined } }),
    ]);
    return { data, total, page, limit };
  }

  async findCommission(id: string) {
    const c = await this.prisma.affaireReassureur.findUnique({
      where: { id },
      include: { reassureur: true, affaire: { select: { numero: true } } },
    });
    if (!c) throw new NotFoundException('Commission introuvable');
    return c;
  }

  async createCommission(data: any) {
    return this.prisma.affaireReassureur.create({ data });
  }

  async markCommissionPaid(id: string, decaissementId: string) {
    return this.prisma.affaireReassureur.update({ where: { id }, data: { /* mark paid */ } });
  }

  async getCommissionStatement(cedanteId: string, period: string) {
    return this.prisma.affaireReassureur.findMany({
      where: { affaire: { cedanteId } },
      include: { reassureur: true, affaire: true },
    });
  }

  // ── Reports ──────────────────────────────────────────────────────

  async getCashFlowReport(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const [encaissements, decaissements] = await Promise.all([
      this.prisma.encaissement.aggregate({
        where: { dateEncaissement: { gte: start, lte: end } },
        _count: { id: true },
        _sum: { montant: true },
      }),
      this.prisma.decaissement.aggregate({
        where: { dateDecaissement: { gte: start, lte: end } },
        _count: { id: true },
        _sum: { montant: true },
      }),
    ]);

    const totalEncaissements = Number(encaissements._sum.montant ?? 0);
    const totalDecaissements = Number(decaissements._sum.montant ?? 0);

    return {
      totalEncaissements,
      totalDecaissements,
      soldeNet: Math.round((totalEncaissements - totalDecaissements) * 1000) / 1000,
      encaissements: encaissements._count.id,
      decaissements: decaissements._count.id,
    };
  }

  async getAgingReport(type: 'creances' | 'dettes') {
    // Simplified aging: group by date ranges
    const now = new Date();
    const ranges = [
      { label: '0-30 jours', min: 0, max: 30 },
      { label: '31-60 jours', min: 31, max: 60 },
      { label: '61-90 jours', min: 61, max: 90 },
      { label: '90+ jours', min: 91, max: 9999 },
    ];

    const dateField = type === 'creances' ? 'dateEncaissement' : 'dateDecaissement';
    const model = type === 'creances' ? 'encaissement' : 'decaissement';

    const results = [];
    for (const range of ranges) {
      const minDate = new Date(now.getTime() - range.max * 86400000);
      const maxDate = range.min > 0 ? new Date(now.getTime() - (range.min - 1) * 86400000) : now;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const agg: any = await (this.prisma as any)[model].aggregate({
        where: {
          [dateField]: { lte: maxDate, ...(range.min > 0 ? { gte: minDate } : {}) },
        },
        _count: { id: true },
        _sum: { montant: true },
      });

      results.push({
        label: range.label,
        count: agg._count.id,
        montant: Number(agg._sum.montant ?? 0),
      });
    }

    return { ranges: results };
  }

  // ── Summary balances ─────────────────────────────────────────────

  async getBalanceForAffaire(affaireId: string) {
    const [encTotal, decTotal] = await Promise.all([
      this.prisma.encaissement.aggregate({
        where: { affaireId },
        _sum: { montant: true },
      }),
      this.prisma.decaissement.aggregate({
        where: { affaireId },
        _sum: { montant: true },
      }),
    ]);
    const encaisse = Number(encTotal._sum.montant ?? 0);
    const decaisse = Number(decTotal._sum.montant ?? 0);
    return {
      affaireId,
      encaisse,
      decaisse,
      solde: Math.round((encaisse - decaisse) * 1000) / 1000,
    };
  }
}
