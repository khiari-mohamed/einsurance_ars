import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DocumentEntityType, DocumentStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../shared/services/storage.service';
import { DocumentChecklistService } from './document-checklist.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';
import { ShareDocumentDto } from './dto/share-document.dto';

// Multer file type definition
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/tiff',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

@Injectable()
export class GedService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private checklist: DocumentChecklistService,
  ) {}

  async upload(
    file: MulterFile,
    dto: UploadDocumentDto,
    userId: string,
  ) {
    // Validate file
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Type de fichier non autorisé: ${file.mimetype}`);
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(`Fichier trop volumineux (max 50MB)`);
    }

    // Determine sub-directory
    const subDir = dto.affaireId ?? dto.sinistreId ?? dto.cedanteId ?? 'general';
    const { filePath, fileName } = await this.storage.saveFile(file.buffer, file.originalname, subDir);

    const document = await this.prisma.document.create({
      data: {
        nom: fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        filePath,
        documentType: dto.documentType,
        statut: DocumentStatut.RECU,
        uploadedById: userId,
        links: {
          create: {
            entityType: dto.entityType ?? DocumentEntityType.AFFAIRE,
            assureId: dto.assureId,
            cedanteId: dto.cedanteId,
            reassureurId: dto.reassureurId,
            coCourtId: dto.coCourtId,
            affaireId: dto.affaireId,
            sinistreId: dto.sinistreId,
            encaissementId: dto.encaissementId,
            decaissementId: dto.decaissementId,
            ordrePaiementId: dto.ordrePaiementId,
            bordereauId: dto.bordereauId,
          },
        },
      },
      include: { links: true },
    });

    // Log access
    await this.prisma.documentAccessLog.create({
      data: { documentId: document.id, userId, action: 'UPLOAD', ipAddress: null },
    });

    // Update checklist if document type matches a checklist item
    if (dto.affaireId && dto.documentType) {
      await this.updateChecklist(dto.affaireId, dto.documentType, document.id);
    }

    return document;
  }

  async search(dto: SearchDocumentDto, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (dto.statut) where.statut = dto.statut;
    if (dto.documentType) where.documentType = dto.documentType;
    if (dto.search) where.originalName = { contains: dto.search, mode: 'insensitive' };
    if (dto.affaireId) where.links = { some: { affaireId: dto.affaireId } };
    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {
        ...(dto.dateFrom && { gte: new Date(dto.dateFrom) }),
        ...(dto.dateTo && { lte: new Date(dto.dateTo) }),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: { links: true },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.document.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async download(id: string, userId: string): Promise<{ buffer: Buffer; document: any }> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document introuvable');
    if (!this.storage.fileExists(doc.filePath)) {
      throw new NotFoundException('Fichier introuvable sur disque');
    }

    await this.prisma.documentAccessLog.create({
      data: { documentId: id, userId, action: 'DOWNLOAD' },
    });

    return { buffer: await this.storage.getFileBuffer(doc.filePath), document: doc };
  }

  async uploadNewVersion(id: string, file: MulterFile, userId: string, comment?: string) {
    const existing = await this.prisma.document.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Document introuvable');

    // Archive current version
    await this.prisma.documentVersion.create({
      data: {
        documentId: id,
        versionNumber: existing.versionNumber,
        filePath: existing.filePath,
        uploadedById: userId,
        comment: comment ?? `Version ${existing.versionNumber}`,
      },
    });

    const subDir = 'versions';
    const { filePath } = await this.storage.saveFile(file.buffer, file.originalname, subDir);

    return this.prisma.document.update({
      where: { id },
      data: {
        nom: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        filePath,
        versionNumber: existing.versionNumber + 1,
      },
    });
  }

  async getVersionHistory(id: string) {
    return this.prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async share(id: string, dto: ShareDocumentDto) {
    return this.prisma.documentShare.create({
      data: {
        documentId: id,
        sharedWithUserId: dto.userId,
        sharedWithEmail: dto.email,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  async delete(id: string, userId: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document introuvable');

    await this.prisma.documentAccessLog.create({
      data: { documentId: id, userId, action: 'DELETE' },
    });

    // Soft-delete: mark as REJETE and keep the file for audit trail
    return this.prisma.document.update({
      where: { id },
      data: { statut: DocumentStatut.REJETE },
    });
  }

  async getDocumentsForEntity(entityType: DocumentEntityType, entityId: string) {
    return this.prisma.documentLink.findMany({
      where: { entityType, [`${this.entityKey(entityType)}Id`]: entityId },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private entityKey(type: DocumentEntityType): string {
    const map: Record<DocumentEntityType, string> = {
      ASSURE: 'assure',
      CEDANTE: 'cedante',
      REASSUREUR: 'reassureur',
      CO_COURTIER: 'coCourtier',
      AFFAIRE: 'affaire',
      SINISTRE: 'sinistre',
      ENCAISSEMENT: 'encaissement',
      DECAISSEMENT: 'decaissement',
      ORDRE_PAIEMENT: 'ordrePaiement',
      BORDEREAU: 'bordereau',
    };
    return map[type] ?? 'affaire';
  }

  private async updateChecklist(affaireId: string, documentType: string, documentId: string) {
    const checklist = await this.prisma.documentChecklist.findUnique({
      where: { affaireId },
      include: { items: true },
    });
    if (!checklist) return;

    const item = checklist.items.find(
      (i) => i.documentType === documentType && i.statut !== 'RECU',
    );
    if (item) {
      await this.checklist.markItemReceived(checklist.id, item.id, documentId);
    }
  }
}