import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const AML_THRESHOLD_TND = 10_000;

@Injectable()
export class AmlService {
  private readonly logger = new Logger(AmlService.name);

  constructor(private prisma: PrismaService) {}

  async checkEncaissement(encaissementId: string): Promise<{ flagged: boolean; reason?: string }> {
    const enc = await this.prisma.encaissement.findUnique({ where: { id: encaissementId } });
    if (!enc) return { flagged: false };

    const montantTnd = enc.montantTnd ? Number(enc.montantTnd) : Number(enc.montant);
    if (montantTnd >= AML_THRESHOLD_TND) {
      this.logger.warn(`AML flag: Encaissement ${enc.reference} — ${montantTnd} TND (seuil: ${AML_THRESHOLD_TND})`);

      await this.prisma.auditLog.create({
        data: {
          action: 'AML_FLAG',
          entityType: 'Encaissement',
          entityId: encaissementId,
          after: { montantTnd, threshold: AML_THRESHOLD_TND, reason: 'Montant supérieur au seuil AML' },
        },
      });

      return { flagged: true, reason: `Montant ${montantTnd} TND dépasse le seuil AML de ${AML_THRESHOLD_TND} TND` };
    }

    return { flagged: false };
  }

  /**
   * FIX (Finances pass): the AML check only ever ran on Encaissement.
   * Decaissements (wires OUT to reinsurers/co-courtiers) can be equally
   * large and were never screened at all — a real anti-money-laundering
   * gap, not just an inconsistency.
   */
  async checkDecaissement(decaissementId: string): Promise<{ flagged: boolean; reason?: string }> {
    const dec = await this.prisma.decaissement.findUnique({ where: { id: decaissementId } });
    if (!dec) return { flagged: false };

    const montantTnd = dec.montantTnd ? Number(dec.montantTnd) : Number(dec.montant);
    if (montantTnd >= AML_THRESHOLD_TND) {
      this.logger.warn(`AML flag: Decaissement ${dec.reference} — ${montantTnd} TND (seuil: ${AML_THRESHOLD_TND})`);

      await this.prisma.auditLog.create({
        data: {
          action: 'AML_FLAG',
          entityType: 'Decaissement',
          entityId: decaissementId,
          after: { montantTnd, threshold: AML_THRESHOLD_TND, reason: 'Montant supérieur au seuil AML' },
        },
      });

      return { flagged: true, reason: `Montant ${montantTnd} TND dépasse le seuil AML de ${AML_THRESHOLD_TND} TND` };
    }

    return { flagged: false };
  }

  // FIX (Finances pass): unbounded — this list only grows. Paginated now.
  async getFlaggedTransactions(page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { action: 'AML_FLAG' },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      this.prisma.auditLog.count({ where: { action: 'AML_FLAG' } }),
    ]);
    return { data, total, page, limit };
  }
}