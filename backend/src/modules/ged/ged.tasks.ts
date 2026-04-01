import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RetentionService } from './retention.service';
import { ComplianceService } from './compliance.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { DocumentShare } from './document-share.entity';

@Injectable()
export class GedTasks {
  constructor(
    private retentionService: RetentionService,
    private complianceService: ComplianceService,
    @InjectRepository(DocumentShare)
    private shareRepo: Repository<DocumentShare>,
  ) {}

  @Cron('0 2 * * *')
  async dailyCleanup() {
    console.log('Running daily GED cleanup...');
    
    await this.cleanupExpiredShares();
    await this.retentionService.archiveExpiredDocuments();
  }

  @Cron('0 1 1 * *')
  async monthlyRetention() {
    console.log('Running monthly retention policy...');
    
    const deleted = await this.retentionService.deleteObsoleteDocuments();
    console.log(`Deleted ${deleted} obsolete documents`);
  }

  @Cron('0 9 * * 1')
  async weeklyComplianceReport() {
    console.log('Generating weekly compliance report...');
    
    const report = await this.complianceService.getMissingDocumentsReport();
    console.log(`Found ${report.length} entities with missing documents`);
  }

  private async cleanupExpiredShares(): Promise<void> {
    const expired = await this.shareRepo.find({
      where: {
        expiresAt: LessThan(new Date()),
      },
    });

    if (expired.length > 0) {
      await this.shareRepo.remove(expired);
      console.log(`Cleaned up ${expired.length} expired share links`);
    }
  }
}
