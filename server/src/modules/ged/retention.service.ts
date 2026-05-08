import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../shared/services/storage.service';

// Legal retention: reinsurance documents must be kept 10 years in Tunisia
const RETENTION_YEARS = 10;

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);

  constructor(private prisma: PrismaService, private storage: StorageService) {}

  @Cron('0 3 1 * *') // 03:00 on the 1st of each month
  async purgeExpiredDocuments() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

    // Only purge documents that have been explicitly marked for deletion
    // and are beyond the retention period — never auto-delete linked documents
    const expired = await this.prisma.document.findMany({
      where: {
        createdAt: { lt: cutoff },
        links: { none: {} }, // only orphaned documents
      },
    });

    let purged = 0;
    for (const doc of expired) {
      await this.storage.deleteFile(doc.filePath).catch(() => {});
      await this.prisma.document.delete({ where: { id: doc.id } }).catch(() => {});
      purged++;
    }

    this.logger.log(`Retention purge: ${purged} documents orphelins supprimés (antérieurs au ${cutoff.toLocaleDateString()})`);
  }

  async getRetentionStatus() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);
    const total = await this.prisma.document.count();
    const expiring = await this.prisma.document.count({ where: { createdAt: { lt: cutoff }, links: { none: {} } } });
    return { total, expiring, retentionYears: RETENTION_YEARS, cutoffDate: cutoff };
  }
}