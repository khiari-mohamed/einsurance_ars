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

// CORRECTED PREFIXES — matches the June 26 meeting decisions
const PREFIXES: Record<SequenceEntity, string> = {
  // Master Data (Référentiel) — changed per meeting
  CEDANTE: 'CAS',      // WAS: 'CED' → NOW: 'CAS' (Compagnie d'assurances)
  REASSUREUR: 'REA',   // Correct (unchanged)
  ASSURE: 'CLI',       // WAS: 'ASS' → NOW: 'CLI' (Client)
  COCOURTIER: 'CCO',   // WAS: 'CC' → NOW: 'CCO' (Courtier en réassurance)

  // Business Modules (unchanged)
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

// Pad length for sequence numbers (4 digits → 0001, 0010, 0100, 1000)
const PAD_LENGTH = 4;

@Injectable()
export class SequenceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generates the next sequential code for a given entity type.
   *
   * Examples:
   * - next('CEDANTE') → 'CAS-0001', 'CAS-0002'...
   * - next('REASSUREUR') → 'REA-0001', 'REA-0002'...
   * - next('ASSURE') → 'CLI-0001', 'CLI-0002'...
   * - next('COCOURTIER') → 'CCO-0001', 'CCO-0002'...
   */
  async next(entityType: SequenceEntity): Promise<string> {
    // Validate entity type exists in prefix map
    const prefix = PREFIXES[entityType];
    if (!prefix) {
      throw new ConflictException(
        `Invalid entity type: "${entityType}". ` +
        `Allowed types: ${Object.keys(PREFIXES).join(', ')}`,
      );
    }

    // Use a transaction to prevent race conditions (concurrent calls)
    const result = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.sequence.upsert({
        where: { entityType },
        update: {
          lastValue: { increment: 1 },
          prefix: prefix, // ensure prefix is set correctly
        },
        create: {
          entityType,
          lastValue: 1,
          prefix: prefix,
        },
      });
      return seq;
    });

    // Format: PREFIX-XXXX (no year, 4-digit padding)
    const padded = String(result.lastValue).padStart(PAD_LENGTH, '0');
    return `${result.prefix}-${padded}`;
  }

  /**
   * Gets the current last value without incrementing (for admin monitoring).
   */
  async currentValue(entityType: SequenceEntity): Promise<number> {
    const seq = await this.prisma.sequence.findUnique({
      where: { entityType },
    });
    return seq?.lastValue ?? 0;
  }

  /**
   * ADMIN ONLY: Resets the sequence for a specific entity type.
   * Use carefully via dedicated admin endpoint.
   */
  async reset(entityType: SequenceEntity, resetTo: number = 0): Promise<void> {
    const prefix = PREFIXES[entityType];
    if (!prefix) {
      throw new ConflictException(`Invalid entity type: "${entityType}"`);
    }

    await this.prisma.sequence.upsert({
      where: { entityType },
      update: { lastValue: resetTo },
      create: {
        entityType,
        lastValue: resetTo,
        prefix: prefix,
      },
    });
  }
}