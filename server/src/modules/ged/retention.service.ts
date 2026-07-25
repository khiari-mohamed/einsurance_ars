import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../shared/services/storage.service';

// Legal retention: reinsurance documents must be kept 10 years in Tunisia.
// Default fallback if not overridden via config (app.documentRetentionYears).
const DEFAULT_RETENTION_YEARS = 10;

@Injectable()
export class RetentionService {
  private readonly logger = new Logger(RetentionService.name);
  private readonly retentionYears: number;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    config: ConfigService,
  ) {
    // FIX: was a hardcoded module-level constant — now configurable per
    // deployment without a code change/redeploy.
    this.retentionYears = config.get<number>('app.documentRetentionYears', DEFAULT_RETENTION_YEARS);
  }

  @Cron('0 3 1 * *') // 03:00 on the 1st of each month
  async purgeExpiredDocuments() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - this.retentionYears);

    // Only purge documents that are orphaned (no active links) and beyond
    // the retention period — never auto-delete linked documents.
    const expired = await this.prisma.document.findMany({
      where: {
        createdAt: { lt: cutoff },
        links: { none: {} },
      },
    });

    let purged = 0;
    let skipped = 0;

    for (const doc of expired) {
      try {
        // FIX: previously deleted the file with a swallowed .catch(() => {})
        // and then unconditionally deleted the DB row regardless of whether
        // the file deletion actually succeeded. A failed disk delete meant
        // the DB record (our only record the file existed) was gone while
        // the physical file stayed on disk forever, untracked and
        // unrecoverable. Now: only remove the DB row once the file is
        // confirmed gone (or was already gone); on any other failure, leave
        // the row intact so it's retried on the next monthly cycle.
        const exists = await this.storage.fileExists(doc.filePath);
        if (exists) {
          await this.storage.deleteFile(doc.filePath);
        }
        await this.prisma.document.delete({ where: { id: doc.id } });
        purged++;
      } catch (err: any) {
        skipped++;
        this.logger.warn(
          `Retention purge: échec suppression document ${doc.id} — ${err?.message ?? err}. Nouvelle tentative au prochain cycle.`,
        );
      }
    }

    this.logger.log(
      `Retention purge: ${purged} document(s) orphelin(s) supprimé(s), ${skipped} échec(s) (antérieurs au ${cutoff.toLocaleDateString()})`,
    );
  }

  async getRetentionStatus() {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - this.retentionYears);
    const total = await this.prisma.document.count();
    const expiring = await this.prisma.document.count({
      where: { createdAt: { lt: cutoff }, links: { none: {} } },
    });
    return { total, expiring, retentionYears: this.retentionYears, cutoffDate: cutoff };
  }
}