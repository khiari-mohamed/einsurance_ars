import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// AML (Anti-Money Laundering) threshold — transactions above this threshold
// must be flagged for manual review (configurable, default 10,000 TND equivalent)
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

  async getFlaggedTransactions() {
    return this.prisma.auditLog.findMany({
      where: { action: 'AML_FLAG' },
      orderBy: { createdAt: 'desc' },
    });
  }
}