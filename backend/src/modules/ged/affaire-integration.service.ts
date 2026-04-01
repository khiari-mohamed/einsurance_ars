import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, EntityType, DocumentType } from './document.entity';
import { DocumentLink } from './document-link.entity';

@Injectable()
export class AffaireIntegrationService {
  constructor(
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    @InjectRepository(DocumentLink)
    private linkRepo: Repository<DocumentLink>,
  ) {}

  async onAffaireCreated(affaireId: string, affaireType: string): Promise<void> {
    const mandatoryDocs = [
      DocumentType.NOTE_SYNTHESE,
      DocumentType.SLIP_COUVERTURE,
      DocumentType.ORDRE_PLACEMENT,
      DocumentType.BORDEREAU_CESSION,
    ];

    for (const docType of mandatoryDocs) {
      const placeholder = this.documentRepo.create({
        fileName: `${docType}_placeholder.pdf`,
        storagePath: '',
        mimeType: 'application/pdf',
        fileSize: 0,
        entityType: EntityType.AFFAIRE,
        entityId: affaireId,
        documentType: docType,
        isMandatory: true,
        uploadedById: 'system',
      });
      await this.documentRepo.save(placeholder);
    }
  }

  async getAffaireDocuments(affaireId: string): Promise<Document[]> {
    const directDocs = await this.documentRepo.find({
      where: { entityType: EntityType.AFFAIRE, entityId: affaireId },
      relations: ['uploadedBy'],
    });

    const linkedDocs = await this.linkRepo.find({
      where: { linkedEntityType: EntityType.AFFAIRE, linkedEntityId: affaireId },
      relations: ['document', 'document.uploadedBy'],
    });

    return [...directDocs, ...linkedDocs.map(l => l.document)];
  }

  async linkDocumentToAffaire(documentId: string, affaireId: string): Promise<void> {
    const link = this.linkRepo.create({
      documentId,
      linkedEntityType: EntityType.AFFAIRE,
      linkedEntityId: affaireId,
    });
    await this.linkRepo.save(link);
  }
}
