import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { FxGainLossService } from './fx-gain-loss.service';
import { CreateSettlementDto } from './dto/create-settlement.dto';

@Injectable()
export class SettlementService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private fxService: FxGainLossService,
  ) {}

  async findAll(affaireId?: string, situationId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (affaireId) where.affaireId = affaireId;
    if (situationId) where.situationId = situationId;
    const [data, total] = await Promise.all([
      this.prisma.settlement.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.settlement.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async create(dto: CreateSettlementDto) {
    if (dto.mode === 'PAR_AFFAIRE' && !dto.affaireId) {
      throw new BadRequestException('affaireId requis pour settlement PAR_AFFAIRE');
    }
    if (dto.mode === 'PAR_SITUATION' && !dto.situationId) {
      throw new BadRequestException('situationId requis pour settlement PAR_SITUATION');
    }

    const reference = await this.sequence.next('SETTLEMENT');
    const tauxRealisation = dto.tauxRealisation ?? 1;
    const tauxReglement = dto.tauxReglement ?? tauxRealisation;
    const currency = dto.currency ?? 'TND';
    const montantTnd = currency !== 'TND'
      ? Math.round(dto.montant * tauxReglement * 1000) / 1000
      : dto.montant;

    const settlement = await this.prisma.settlement.create({
      data: {
        reference,
        mode: dto.mode,
        affaireId: dto.affaireId,
        situationId: dto.situationId,
        montant: dto.montant,
        currency,
        tauxRealisation,
        tauxReglement,
        montantTnd,
        dateSettlement: dto.dateSettlement ? new Date(dto.dateSettlement) : new Date(),
      },
    });

    // Auto-compute FX gain/loss if foreign currency with different rates
    if (currency !== 'TND' && tauxRealisation !== tauxReglement) {
      await this.fxService.compute({
        montantDevise: dto.montant,
        currency,
        tauxRealisation,
        tauxReglement,
        sourceType: 'settlement',
        sourceId: settlement.id,
        affaireId: dto.affaireId,
      });
    }

    return settlement;
  }

  async delete(id: string) {
    const s = await this.prisma.settlement.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Settlement introuvable');
    const enc = await this.prisma.encaissement.count({ where: { settlementId: id } });
    if (enc > 0) throw new BadRequestException('Impossible de supprimer un settlement avec des encaissements liés');
    return this.prisma.settlement.delete({ where: { id } });
  }
}