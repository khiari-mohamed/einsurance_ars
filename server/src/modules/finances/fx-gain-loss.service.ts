import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { FxGainLossType, JournalEntryType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
// FIX (Finances pass): was '@/shared/services/sequence.service' — no other
// file in this codebase uses the '@/' alias; everything else uses relative
// imports. This would only compile if a matching tsconfig path alias
// happens to exist, which is unverified and inconsistent with every other
// reviewed file. Switched to the relative import used everywhere else.
import { SequenceService } from '../../shared/services/sequence.service';

export interface FxComputeInput {
  montantDevise: number;
  currency: string;
  tauxRealisation: number;
  tauxReglement: number;
  sourceType: 'encaissement' | 'decaissement' | 'settlement';
  sourceId: string;
  affaireId?: string;
}

export interface FxComputeResult {
  fxGainLossId: string;
  journalEntryId: string;
  type: FxGainLossType;
  montantDiff: number;
}

@Injectable()
export class FxGainLossService {
  private readonly logger = new Logger(FxGainLossService.name);

  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
  ) {}

  /**
   * Core FX logic from the CDC:
   * - If tauxReglement > tauxRealisation → GAIN → crédit compte 77xxxxx
   * - If tauxReglement < tauxRealisation → PERTE → débit compte 67xxxxx
   * - Auto-generates a BROUILLON journal entry
   */
  async compute(input: FxComputeInput): Promise<FxComputeResult | null> {
    if (input.currency === 'TND') return null;
    if (input.tauxRealisation === input.tauxReglement) return null;

    // FIX (Finances pass): FxGainLoss has a @unique constraint on each of
    // encaissementId/decaissementId/settlementId — calling compute() twice
    // for the same source previously threw a raw, uncaught Prisma unique-
    // constraint violation (500). Now checked up front and made idempotent:
    // a repeat call returns the existing record instead of erroring.
    const existingWhere =
      input.sourceType === 'encaissement' ? { encaissementId: input.sourceId }
      : input.sourceType === 'decaissement' ? { decaissementId: input.sourceId }
      : { settlementId: input.sourceId };
    const existing = await this.prisma.fxGainLoss.findFirst({ where: existingWhere });
    if (existing) {
      this.logger.warn(`FX gain/loss already computed for ${input.sourceType} ${input.sourceId} — returning existing record`);
      return {
        fxGainLossId: existing.id,
        journalEntryId: existing.journalEntryId ?? '',
        type: existing.type,
        montantDiff: Number(existing.montantDiff),
      };
    }

    const differenceRate = input.tauxReglement - input.tauxRealisation;
    const montantDiff = Math.round(input.montantDevise * Math.abs(differenceRate) * 1000) / 1000;
    const type: FxGainLossType = differenceRate > 0 ? FxGainLossType.GAIN : FxGainLossType.PERTE;

    this.logger.log(
      `FX ${type}: ${input.currency} ${input.montantDevise} — diff rate ${differenceRate.toFixed(6)} → TND diff ${montantDiff}`,
    );

    const gainAccount = await this.prisma.planComptable.findFirst({
      where: { compte: { startsWith: '776' }, isActive: true },
    });
    const perteAccount = await this.prisma.planComptable.findFirst({
      where: { compte: { startsWith: '676' }, isActive: true },
    });
    const bankAccount = await this.prisma.planComptable.findFirst({
      where: { compte: { startsWith: '532' }, isActive: true },
    });

    // FIX (Finances pass): previously, a missing account produced an empty
    // planComptableId that was silently filtered out of `lines`, so the
    // resulting JournalEntry could end up with only ONE line instead of a
    // balanced debit=credit pair — a real double-entry-bookkeeping
    // integrity violation that would pass silently. Now a hard error
    // instead, since this is a configuration problem that must be fixed in
    // the plan comptable, not swallowed.
    if (type === FxGainLossType.GAIN && !gainAccount) {
      throw new BadRequestException("Compte de gain de change (classe 776) introuvable dans le plan comptable — configuration requise avant de comptabiliser cet écart.");
    }
    if (type === FxGainLossType.PERTE && !perteAccount) {
      throw new BadRequestException("Compte de perte de change (classe 676) introuvable dans le plan comptable — configuration requise avant de comptabiliser cet écart.");
    }
    if (!bankAccount) {
      throw new BadRequestException("Compte de banque (classe 532) introuvable dans le plan comptable — configuration requise avant de comptabiliser cet écart.");
    }

    const now = new Date();
    const fiscalPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: { dateDebut: { lte: now }, dateFin: { gte: now }, isClosed: false },
    });

    const lines =
      type === FxGainLossType.GAIN
        ? [
            {
              planComptableId: bankAccount.id,
              debit: montantDiff,
              credit: null as number | null,
              libelle: `Gain de change ${input.currency} — taux réal. ${input.tauxRealisation} vs règl. ${input.tauxReglement}`,
            },
            {
              planComptableId: gainAccount!.id,
              debit: null as number | null,
              credit: montantDiff,
              libelle: `Gain de change ${input.currency}`,
            },
          ]
        : [
            {
              planComptableId: perteAccount!.id,
              debit: montantDiff,
              credit: null as number | null,
              libelle: `Perte de change ${input.currency} — taux réal. ${input.tauxRealisation} vs règl. ${input.tauxReglement}`,
            },
            {
              planComptableId: bankAccount.id,
              debit: null as number | null,
              credit: montantDiff,
              libelle: `Perte de change ${input.currency}`,
            },
          ];

    return this.prisma.$transaction(async (tx) => {
      const entryNumero = await this.sequence.next('JOURNAL_ENTRY');

      const journalEntry = await tx.journalEntry.create({
        data: {
          numero: entryNumero,
          statut: 'BROUILLON',
          type: type === FxGainLossType.GAIN ? JournalEntryType.GAIN_DE_CHANGE : JournalEntryType.PERTE_DE_CHANGE,
          affaireId: input.affaireId,
          fiscalPeriodId: fiscalPeriod?.id,
          description: `${type} de change ${input.currency} — montant devise: ${input.montantDevise}`,
          currency: 'TND',
          lines: {
            create: lines.map((l, i) => ({
              planComptableId: l.planComptableId,
              debit: l.debit,
              credit: l.credit,
              libelle: l.libelle,
              ordre: i + 1,
            })),
          },
        },
      });

      const fxGainLoss = await tx.fxGainLoss.create({
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

      // FIX (Finances pass): compute() previously returned void — callers
      // had no way to link back to the created records.
      return { fxGainLossId: fxGainLoss.id, journalEntryId: journalEntry.id, type, montantDiff };
    });
  }
}