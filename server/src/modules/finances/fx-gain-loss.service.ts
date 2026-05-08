import { Injectable, Logger } from '@nestjs/common';
import { FxGainLossType, JournalEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '@/shared/services/sequence.service';

export interface FxComputeInput {
  montantDevise: number;
  currency: string;
  tauxRealisation: number;
  tauxReglement: number;
  sourceType: 'encaissement' | 'decaissement' | 'settlement';
  sourceId: string;
  affaireId?: string;
}

@Injectable()
export class FxGainLossService {
  private readonly logger = new Logger(FxGainLossService.name);

  constructor(
  private prisma: PrismaService,
  private sequence: SequenceService,   // ADD THIS
) {}

  /**
   * Core FX logic from the CDC:
   * - If tauxReglement > tauxRealisation → GAIN → crédit compte 77xxxxx (gain de change)
   * - If tauxReglement < tauxRealisation → PERTE → débit compte 67xxxxx (perte de change)
   * - Auto-generates a BROUILLON journal entry
   */
  async compute(input: FxComputeInput): Promise<void> {
    if (input.currency === 'TND') return; // no FX on local currency
    if (input.tauxRealisation === input.tauxReglement) return; // no diff

    const differenceRate = input.tauxReglement - input.tauxRealisation;
    const montantDiff = Math.round(input.montantDevise * Math.abs(differenceRate) * 1000) / 1000;
    const type: FxGainLossType = differenceRate > 0 ? FxGainLossType.GAIN : FxGainLossType.PERTE;

    this.logger.log(
      `FX ${type}: ${input.currency} ${input.montantDevise} — diff rate ${differenceRate.toFixed(6)} → TND diff ${montantDiff}`,
    );

    // Get accounts from plan comptable
    const gainAccount = await this.prisma.planComptable.findFirst({
      where: { compte: { startsWith: '776' }, isActive: true },
    });
    const perteAccount = await this.prisma.planComptable.findFirst({
      where: { compte: { startsWith: '676' }, isActive: true },
    });
    const bankAccount = await this.prisma.planComptable.findFirst({
      where: { compte: { startsWith: '532' }, isActive: true },
    });

    // Get current fiscal period
    const now = new Date();
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: {
        dateDebut: { lte: now },
        dateFin: { gte: now },
        isClosed: false,
      },
    });

    // Build journal entry lines
    // GAIN: DEBIT bank / CREDIT gain account
    // PERTE: DEBIT perte account / CREDIT bank
    const lines =
      type === FxGainLossType.GAIN
        ? [
            {
              planComptableId: bankAccount?.id ?? '',
              debit: montantDiff,
              credit: null as number | null,
              libelle: `Gain de change ${input.currency} — taux réal. ${input.tauxRealisation} vs règl. ${input.tauxReglement}`,
            },
            {
              planComptableId: gainAccount?.id ?? '',
              debit: null as number | null,
              credit: montantDiff,
              libelle: `Gain de change ${input.currency}`,
            },
          ]
        : [
            {
              planComptableId: perteAccount?.id ?? '',
              debit: montantDiff,
              credit: null as number | null,
              libelle: `Perte de change ${input.currency} — taux réal. ${input.tauxRealisation} vs règl. ${input.tauxReglement}`,
            },
            {
              planComptableId: bankAccount?.id ?? '',
              debit: null as number | null,
              credit: montantDiff,
              libelle: `Perte de change ${input.currency}`,
            },
          ];

    // Create journal entry + FxGainLoss record in one transaction
    await this.prisma.$transaction(async (tx) => {
      const entryNumero = await this.sequence.next('JOURNAL_ENTRY');

      const journalEntry = await tx.journalEntry.create({
        data: {
          numero: entryNumero,
          statut: 'BROUILLON',
          type: type === FxGainLossType.GAIN
            ? JournalEntryType.GAIN_DE_CHANGE
            : JournalEntryType.PERTE_DE_CHANGE,
          affaireId: input.affaireId,
          fiscalPeriodId: fiscalPeriod?.id,
          description: `${type} de change ${input.currency} — montant devise: ${input.montantDevise}`,
          currency: 'TND',
          lines: {
            create: lines
              .filter((l) => l.planComptableId)
              .map((l, i) => ({
                planComptableId: l.planComptableId,
                debit: l.debit,
                credit: l.credit,
                libelle: l.libelle,
                ordre: i + 1,
              })),
          },
        },
      });

      await tx.fxGainLoss.create({
        data: {
          type,
          tauxRealisation: input.tauxRealisation,
          tauxReglement: input.tauxReglement,
          montantDevise: input.montantDevise,
          differenceRate,
          montantDiff,
          journalEntryId: journalEntry.id,
          ...(input.sourceType === 'encaissement' && { encaissementId: input.sourceId }),
          ...(input.sourceType === 'decaissement' && { decaissementId: input.sourceId }),
          ...(input.sourceType === 'settlement' && { settlementId: input.sourceId }),
        },
      });
    });
  }
}