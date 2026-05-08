import { Injectable } from '@nestjs/common';
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

const PREFIXES: Record<SequenceEntity, string> = {
  ASSURE: 'ASS',
  CEDANTE: 'CED',
  REASSUREUR: 'REA',
  COCOURTIER: 'CC',
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

@Injectable()
export class SequenceService {
  constructor(private prisma: PrismaService) {}

  async next(entityType: SequenceEntity): Promise<string> {
    const result = await this.prisma.$transaction(async (tx) => {
      const seq = await tx.sequence.upsert({
        where: { entityType },
        update: { lastValue: { increment: 1 } },
        create: { entityType, lastValue: 1, prefix: PREFIXES[entityType] },
      });
      return seq;
    });

    const prefix = result.prefix ?? PREFIXES[entityType];
    const year = new Date().getFullYear();
    const padded = String(result.lastValue).padStart(6, '0');
    return `${prefix}-${year}-${padded}`;
  }
}