import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, EntityType, DocumentType } from './document.entity';

@Injectable()
export class ComplianceService {
  private requiredDocs = {
    [EntityType.REASSUREUR]: [
      DocumentType.COMPANY_REGISTRATION,
      DocumentType.BANKING_INFO,
      DocumentType.TREATY_AGREEMENT,
    ],
    [EntityType.CEDANTE]: [
      DocumentType.COMPANY_REGISTRATION,
      DocumentType.BANKING_INFO,
      DocumentType.POWER_OF_ATTORNEY,
    ],
    [EntityType.AFFAIRE]: [
      DocumentType.SLIP_COUVERTURE,
      DocumentType.ORDRE_PLACEMENT,
      DocumentType.BORDEREAU_CESSION,
    ],
    [EntityType.SINISTRE]: [
      DocumentType.AVIS_SINISTRE,
      DocumentType.EXPERT_REPORT,
    ],
  };

  constructor(
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
  ) {}

  async checkCompliance(entityType: EntityType, entityId: string): Promise<{
    missing: DocumentType[];
    expired: Document[];
    warnings: string[];
  }> {
    const required = this.requiredDocs[entityType] || [];
    const existing = await this.documentRepo.find({
      where: { entityType, entityId },
    });

    const existingTypes = existing.map(d => d.documentType);
    const missing = required.filter(type => !existingTypes.includes(type));

    const now = new Date();
    const expired = existing.filter(d => d.validTo && new Date(d.validTo) < now);

    const warnings: string[] = [];
    if (missing.length > 0) {
      warnings.push(`${missing.length} document(s) obligatoire(s) manquant(s)`);
    }
    if (expired.length > 0) {
      warnings.push(`${expired.length} document(s) expiré(s)`);
    }

    return { missing, expired, warnings };
  }

  async getMissingDocumentsReport(): Promise<any[]> {
    const entities = await this.documentRepo
      .createQueryBuilder('doc')
      .select('doc.entityType', 'entityType')
      .addSelect('doc.entityId', 'entityId')
      .groupBy('doc.entityType')
      .addGroupBy('doc.entityId')
      .getRawMany();

    const report = [];
    for (const entity of entities) {
      const compliance = await this.checkCompliance(entity.entityType, entity.entityId);
      if (compliance.missing.length > 0 || compliance.expired.length > 0) {
        report.push({
          entityType: entity.entityType,
          entityId: entity.entityId,
          missing: compliance.missing,
          expired: compliance.expired.length,
        });
      }
    }

    return report;
  }
}
