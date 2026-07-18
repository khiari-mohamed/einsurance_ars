import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type SequenceEntity =
  | 'ASSURE'
  | 'CEDANTE'
  | 'REASSUREUR'
  | 'COCOURTIER'
  | 'AFFAIRE'
  | 'SINISTRE'
  | 'BORDEREAU'
  | 'ORDRE_PAIEMENT'
  | 'SETTLEMENT'
  | 'ENCAISSEMENT'
  | 'DECAISSEMENT'
  | 'JOURNAL_ENTRY'
  | 'SITUATION'
  | 'LETTRAGE';

// Prefixes confirmed in the June 26 audit (Critique 3) for Référentiel entity types.
// NOTE: the client checked BOTH "prefix per type" AND "global numbering" simultaneously
// on the original questionnaire (5.6.1) — still an open, unresolved contradiction
// (Audit Critique 3). This implementation is Option A: independent, per-type,
// restarting counters (CAS-0001, CAS-0002... / REA-0001, REA-0002... run in parallel,
// NOT sharing one counter). If the client confirms Option B (a single shared global
// counter across all 4 types), this needs a structural change — one shared Sequence
// row instead of 4 independent ones — not just a prefix change.
const PREFIXES: Record<SequenceEntity, string> = {
  CEDANTE: 'CAS',
  REASSUREUR: 'REA',
  ASSURE: 'CLI',
  COCOURTIER: 'CCO',

  AFFAIRE: 'AFF',
  SINISTRE: 'SIN',
  BORDEREAU: 'BDR',
  ORDRE_PAIEMENT: 'OPV',
  SETTLEMENT: 'SET',
  ENCAISSEMENT: 'ENC',
  DECAISSEMENT: 'DEC',
  JOURNAL_ENTRY: 'JNL',
  SITUATION: 'SIT',
  LETTRAGE: 'LET',
};

const PAD_LENGTH = 4;

@Injectable()
export class SequenceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generates the next sequential code for a given entity type.
   * Examples: next('CEDANTE') -> 'CAS-0001', 'CAS-0002'...
   */
  async next(entityType: SequenceEntity): Promise<string> {
    const prefix = PREFIXES[entityType];
    if (!prefix) {
      throw new ConflictException(
        `Invalid entity type: "${entityType}". Allowed types: ${Object.keys(PREFIXES).join(', ')}`,
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      return tx.sequence.upsert({
        where: { entityType },
        update: { lastValue: { increment: 1 }, prefix },
        create: { entityType, lastValue: 1, prefix },
      });
    });

    const padded = String(result.lastValue).padStart(PAD_LENGTH, '0');
    return `${result.prefix}-${padded}`;
  }

  /**
   * Gets the current last value without incrementing (for admin monitoring).
   */
  async currentValue(entityType: SequenceEntity): Promise<number> {
    const seq = await this.prisma.sequence.findUnique({ where: { entityType } });
    return seq?.lastValue ?? 0;
  }

  /**
   * FIX (was missing entirely): after an admin manually overrides an auto-generated
   * code (e.g. CAS-0005 -> CAS-0099), the underlying counter must be bumped forward
   * so a future auto-generated code can't eventually walk back up to 0099 and collide
   * with the manually-assigned one. Previously, all four *.service.ts overrideCode()
   * methods had a docstring CLAIMING this behavior, but never actually implemented it
   * — this was dead documentation. Never moves the counter backwards.
   */
  async bump(entityType: SequenceEntity, minValue: number): Promise<void> {
    const prefix = PREFIXES[entityType];
    if (!prefix) {
      throw new ConflictException(`Invalid entity type: "${entityType}"`);
    }

    await this.prisma.$transaction(async (tx) => {
      const seq = await tx.sequence.findUnique({ where: { entityType } });
      const current = seq?.lastValue ?? 0;
      if (minValue <= current) return;

      await tx.sequence.upsert({
        where: { entityType },
        update: { lastValue: minValue },
        create: { entityType, lastValue: minValue, prefix },
      });
    });
  }

  /**
   * ADMIN ONLY: Resets the sequence for a specific entity type.
   * Use carefully via a dedicated admin endpoint.
   */
  async reset(entityType: SequenceEntity, resetTo: number = 0): Promise<void> {
    const prefix = PREFIXES[entityType];
    if (!prefix) {
      throw new ConflictException(`Invalid entity type: "${entityType}"`);
    }

    await this.prisma.sequence.upsert({
      where: { entityType },
      update: { lastValue: resetTo },
      create: { entityType, lastValue: resetTo, prefix },
    });
  }
}