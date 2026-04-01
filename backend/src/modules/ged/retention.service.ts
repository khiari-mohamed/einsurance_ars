import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Document, DocumentType, DocumentStatus } from './document.entity';
import { StorageService } from '../shared/services/storage.service';

@Injectable()
export class RetentionService {
  private retentionPolicies: Record<DocumentType, number> = {
    [DocumentType.BANK_STATEMENT]: 10,
    [DocumentType.ACCOUNTING_ENTRY]: 10,
    [DocumentType.AUDIT_DOCUMENT]: 10,
    [DocumentType.TREATY_AGREEMENT]: 7,
    [DocumentType.SLIP_COUVERTURE]: 7,
    [DocumentType.BORDEREAU_CESSION]: 7,
    [DocumentType.AVIS_SINISTRE]: 5,
    [DocumentType.PAYMENT_ORDER]: 5,
    [DocumentType.CORRESPONDENCE]: 3,
    [DocumentType.OTHER]: 3,
  } as any;

  constructor(
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    private storageService: StorageService,
  ) {}

  async archiveExpiredDocuments(): Promise<number> {
    const now = new Date();
    const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());

    const toArchive = await this.documentRepo.find({
      where: {
        uploadedAt: LessThan(threeYearsAgo),
        status: DocumentStatus.APPROVED,
      },
    });

    for (const doc of toArchive) {
      await this.documentRepo.update(doc.id, { status: DocumentStatus.ARCHIVED });
    }

    return toArchive.length;
  }

  async deleteObsoleteDocuments(): Promise<number> {
    const now = new Date();
    let deleted = 0;

    for (const [docType, years] of Object.entries(this.retentionPolicies)) {
      const cutoffDate = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());

      const toDelete = await this.documentRepo.find({
        where: {
          documentType: docType as DocumentType,
          uploadedAt: LessThan(cutoffDate),
          status: DocumentStatus.ARCHIVED,
        },
      });

      for (const doc of toDelete) {
        try {
          await this.storageService.deleteFile(doc.storagePath);
          await this.documentRepo.delete(doc.id);
          deleted++;
        } catch (error) {
          console.error(`Failed to delete document ${doc.id}:`, error);
        }
      }
    }

    return deleted;
  }

  async getRetentionReport(): Promise<any[]> {
    const report = [];
    const now = new Date();

    for (const [docType, years] of Object.entries(this.retentionPolicies)) {
      const cutoffDate = new Date(now.getFullYear() - years, now.getMonth(), now.getDate());

      const count = await this.documentRepo.count({
        where: {
          documentType: docType as DocumentType,
          uploadedAt: LessThan(cutoffDate),
        },
      });

      if (count > 0) {
        report.push({
          documentType: docType,
          retentionYears: years,
          documentsToReview: count,
        });
      }
    }

    return report;
  }
}
