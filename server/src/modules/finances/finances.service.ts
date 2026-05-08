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
      this.prisma.encaissement.findMany({ where, include: { affaire: { select: { numero: true } }, cedante: { select: { raisonSociale: true } } }, skip, take: limit, orderBy: { dateEncaissement: 'desc' } }),
      this.prisma.encaissement.count({ where }),
    ]);
    return { data, total, page, limit };
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

    // AML check
    await this.aml.checkEncaissement(enc.id);

    return enc;
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