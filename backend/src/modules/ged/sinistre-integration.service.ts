import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, EntityType, DocumentType } from './document.entity';
import { DocumentLink } from './document-link.entity';

@Injectable()
export class SinistreIntegrationService {
  constructor(
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    @InjectRepository(DocumentLink)
    private linkRepo: Repository<DocumentLink>,
  ) {}

  async onSinistreCreated(sinistreId: string, affaireId: string): Promise<void> {
    const mandatoryDocs = [
      DocumentType.AVIS_SINISTRE,
      DocumentType.EXPERT_REPORT,
      DocumentType.CLAIM_ASSESSMENT,
    ];

    for (const docType of mandatoryDocs) {
      const placeholder = this.documentRepo.create({
        fileName: `${docType}_placeholder.pdf`,
        storagePath: '',
        mimeType: 'application/pdf',
        fileSize: 0,
        entityType: EntityType.SINISTRE,
        entityId: sinistreId,
        documentType: docType,
        isMandatory: true,
        uploadedById: 'system',
      });
      await this.documentRepo.save(placeholder);
    }

    if (affaireId) {
      await this.linkSinistreToAffaire(sinistreId, affaireId);
    }
  }

  async getSinistreDocuments(sinistreId: string): Promise<Document[]> {
    const directDocs = await this.documentRepo.find({
      where: { entityType: EntityType.SINISTRE, entityId: sinistreId },
      relations: ['uploadedBy'],
    });

    const linkedDocs = await this.linkRepo.find({
      where: { linkedEntityType: EntityType.SINISTRE, linkedEntityId: sinistreId },
      relations: ['document', 'document.uploadedBy'],
    });

    return [...directDocs, ...linkedDocs.map(l => l.document)];
  }

  async linkSinistreToAffaire(sinistreId: string, affaireId: string): Promise<void> {
    const sinistreDocs = await this.documentRepo.find({
      where: { entityType: EntityType.SINISTRE, entityId: sinistreId },
    });

    for (const doc of sinistreDocs) {
      const link = this.linkRepo.create({
        documentId: doc.id,
        linkedEntityType: EntityType.AFFAIRE,
        linkedEntityId: affaireId,
      });
      await this.linkRepo.save(link);
    }
  }
}
