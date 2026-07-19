// src/modules/uploads/uploads.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { File as MulterFile } from 'multer';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../shared/services/storage.service';
import { FileValidationPipe } from '../../common/pipes/file-validation.pipe';
import { UploadFileDto } from './upload-file.dto';
import { resolveCategory } from '../../config/upload.config';
import { DocumentEntityType, DocumentStatut } from '@prisma/client';

const ENTITY_LINK_FIELD: Record<DocumentEntityType, string> = {
  ASSURE: 'assureId',
  CEDANTE: 'cedanteId',
  REASSUREUR: 'reassureurId',
  CO_COURTIER: 'coCourtId',
  AFFAIRE: 'affaireId',
  SINISTRE: 'sinistreId',
  ENCAISSEMENT: 'encaissementId',
  DECAISSEMENT: 'decaissementId',
  ORDRE_PAIEMENT: 'ordrePaiementId',
  BORDEREAU: 'bordereauId',
};

const ENTITY_SUBFOLDER: Record<DocumentEntityType, string> = {
  ASSURE: 'assures',
  CEDANTE: 'cedantes',
  REASSUREUR: 'reassureurs',
  CO_COURTIER: 'co-courtiers',
  AFFAIRE: 'affaires',
  SINISTRE: 'sinistres',
  ENCAISSEMENT: 'encaissements',
  DECAISSEMENT: 'decaissements',
  ORDRE_PAIEMENT: 'ordres-paiement',
  BORDEREAU: 'bordereaux',
};

@Injectable()
export class UploadsService {
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    this.maxFileSizeBytes = this.config.get<number>('app.maxFileSizeMb', 25) * 1024 * 1024;
  }

  async uploadSingle(file: MulterFile, dto: UploadFileDto, userId?: string) {
    FileValidationPipe.validate(file, this.maxFileSizeBytes);

    if (dto.replaceDocumentId) {
      return this.addVersion(dto.replaceDocumentId, file, userId);
    }

    const category = resolveCategory(file.mimetype, file.originalname);
    const subfolder = ENTITY_SUBFOLDER[dto.entityType];
    const { filePath } = await this.storage.saveFile(file.buffer, file.originalname, subfolder);

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.create({
        data: {
          nom: file.originalname,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.buffer.length,
          filePath,
          documentType: dto.documentType,
          statut: DocumentStatut.RECU,
          isLatestVersion: true,
          versionNumber: 1,
          uploadedById: userId,
        },
      });

      await tx.documentVersion.create({
        data: { documentId: document.id, versionNumber: 1, filePath, uploadedById: userId },
      });

      const linkField = ENTITY_LINK_FIELD[dto.entityType];
      await tx.documentLink.create({
        data: { documentId: document.id, entityType: dto.entityType, [linkField]: dto.entityId },
      });

      await tx.documentAccessLog.create({
        data: { documentId: document.id, userId, action: 'UPLOAD' },
      });

      return { ...document, category };
    });
  }

  async uploadBulk(files: MulterFile[], dto: UploadFileDto, userId?: string) {
    const results: any[] = [];
    const errors: { file: string; error: string }[] = [];

    for (const file of files) {
      try {
        const doc = await this.uploadSingle(file, { ...dto, replaceDocumentId: undefined }, userId);
        results.push(doc);
      } catch (err: unknown) {
        errors.push({ file: file.originalname, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { uploaded: results, failed: errors };
  }

  async addVersion(documentId: string, file: MulterFile, userId?: string) {
    FileValidationPipe.validate(file, this.maxFileSizeBytes);

    const existing = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!existing) throw new NotFoundException('Document introuvable.');

    const { filePath } = await this.storage.saveFile(file.buffer, file.originalname, 'versions');
    const nextVersion = existing.versionNumber + 1;

    return this.prisma.$transaction(async (tx) => {
      await tx.documentVersion.create({
        data: { documentId, versionNumber: nextVersion, filePath, uploadedById: userId },
      });

      const updated = await tx.document.update({
        where: { id: documentId },
        data: {
          filePath,
          sizeBytes: file.buffer.length,
          mimeType: file.mimetype,
          versionNumber: nextVersion,
          statut: DocumentStatut.RECU,
        },
      });

      await tx.documentAccessLog.create({ data: { documentId, userId, action: 'UPLOAD' } });
      return updated;
    });
  }

  async getFileForDownload(documentId: string, userId?: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Document introuvable.');

    if (!this.storage.fileExists(document.filePath)) {
      throw new NotFoundException('Fichier introuvable sur le disque.');
    }

    await this.prisma.documentAccessLog.create({ data: { documentId, userId, action: 'DOWNLOAD' } });

    const buffer = await this.storage.getFileBuffer(document.filePath);
    return { buffer, document };
  }

  async deleteDocument(documentId: string, userId?: string) {
    const document = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Document introuvable.');

    await this.storage.deleteFile(document.filePath);
    await this.prisma.documentAccessLog.create({ data: { documentId, userId, action: 'DELETE' } });

    return this.prisma.document.delete({ where: { id: documentId } });
  }
}