import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, EntityType, DocumentType } from './document.entity';
import { DocumentLink } from './document-link.entity';

@Injectable()
export class FinanceIntegrationService {
  constructor(
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    @InjectRepository(DocumentLink)
    private linkRepo: Repository<DocumentLink>,
  ) {}

  async linkPaymentToDocuments(paymentId: string, documentIds: string[]): Promise<void> {
    for (const docId of documentIds) {
      const link = this.linkRepo.create({
        documentId: docId,
        linkedEntityType: EntityType.FINANCE,
        linkedEntityId: paymentId,
      });
      await this.linkRepo.save(link);
    }
  }

  async validatePaymentDocuments(paymentId: string): Promise<boolean> {
    const links = await this.linkRepo.find({
      where: { linkedEntityType: EntityType.FINANCE, linkedEntityId: paymentId },
      relations: ['document'],
    });

    const hasJustification = links.some(l => 
      l.document.documentType === DocumentType.PAYMENT_JUSTIFICATION ||
      l.document.documentType === DocumentType.SWIFT_CONFIRMATION
    );

    return hasJustification;
  }

  async getPaymentDocuments(paymentId: string): Promise<Document[]> {
    const links = await this.linkRepo.find({
      where: { linkedEntityType: EntityType.FINANCE, linkedEntityId: paymentId },
      relations: ['document', 'document.uploadedBy'],
    });

    return links.map(l => l.document);
  }

  async createPaymentDocumentPlaceholder(paymentId: string, paymentType: string): Promise<void> {
    const docType = paymentType === 'encaissement' 
      ? DocumentType.BANK_STATEMENT 
      : DocumentType.PAYMENT_ORDER;

    const placeholder = this.documentRepo.create({
      fileName: `${docType}_${paymentId}.pdf`,
      storagePath: '',
      mimeType: 'application/pdf',
      fileSize: 0,
      entityType: EntityType.FINANCE,
      entityId: paymentId,
      documentType: docType,
      isMandatory: true,
      uploadedById: 'system',
    });

    await this.documentRepo.save(placeholder);
  }
}
