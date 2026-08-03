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
  | 'LETTRAGE'
  // NEW — per-BordereauType numbering. Key format is literally
  // `BORDEREAU_${BordereauType}`, which lets BordereauxService build the key
  // with a simple template string instead of a separate mapping function.
  // 'BORDEREAU' (flat, above) is kept for backward compatibility with any
  // already-issued numbers — it's just no longer the key bordereaux.service.ts
  // writes new ones under.
  | 'BORDEREAU_CESSION_CEDANTE'
  | 'BORDEREAU_CESSION_REASSUREUR'
  | 'BORDEREAU_SINISTRE_FACULTATIVE'
  | 'BORDEREAU_SITUATION_TRAITE'
  | 'BORDEREAU_FACTURE_DEPOT_PRIME'
  | 'BORDEREAU_NOTE_DE_CREDIT'
  | 'BORDEREAU_ETAT_DE_TRANSFERT'
  | 'BORDEREAU_SITUATION_FINANCIERE'
  | 'BORDEREAU_FACTURE_PRIME_REASSURANCE_DEPOT'
  | 'BORDEREAU_FACTURE_PRIME_REASSURANCE_AJUSTEMENT';

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

  // NEW — one distinct 3-letter prefix per BordereauType, independent
  // restarting counters (same Option-A convention as the 4 Référentiel
  // entity types above — see the comment on those regarding the
  // still-unresolved global-vs-per-type numbering question).
  BORDEREAU_CESSION_CEDANTE: 'BCC',
  BORDEREAU_CESSION_REASSUREUR: 'BCR',
  BORDEREAU_SINISTRE_FACULTATIVE: 'BSF',
  BORDEREAU_SITUATION_TRAITE: 'BST',
  BORDEREAU_FACTURE_DEPOT_PRIME: 'BFD',
  BORDEREAU_NOTE_DE_CREDIT: 'BNC',
  BORDEREAU_ETAT_DE_TRANSFERT: 'BET',
  BORDEREAU_SITUATION_FINANCIERE: 'BSI',
  BORDEREAU_FACTURE_PRIME_REASSURANCE_DEPOT: 'BPD',
  BORDEREAU_FACTURE_PRIME_REASSURANCE_AJUSTEMENT: 'BPA',
};

const PAD_LENGTH = 4;

@Injectable()
export class SequenceService {
  constructor(private prisma: PrismaService) {}

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

  async currentValue(entityType: SequenceEntity): Promise<number> {
    const seq = await this.prisma.sequence.findUnique({ where: { entityType } });
    return seq?.lastValue ?? 0;
  }

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