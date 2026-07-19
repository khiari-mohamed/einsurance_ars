import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DocumentEntityType, DocumentStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../shared/services/storage.service';
import { UploadsService } from '../upload/uploads.service';
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

@Injectable()
export class GedService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private checklist: DocumentChecklistService,
    private uploads: UploadsService, // FIX: delegate storage/validation/versioning here instead of duplicating it
  ) {}

  /**
   * FIX (duplicate pipeline bug): this method used to run its own
   * ALLOWED_MIME_TYPES list and its own hardcoded 50MB limit — a second
   * source of truth alongside upload.config.ts / app.config.ts. It also
   * created the Document row directly, with NO matching DocumentVersion
   * row, unlike UploadsService.uploadSingle() which creates version 1
   * properly. That meant every document uploaded through GED silently had
   * an empty version history. Now delegates to UploadsService (single
   * source of truth for limits/types + correct versioning), then re-fetches
   * with `links` included so the return shape is identical to before for
   * any caller reading `.links` off the result.
   */
  async upload(
    file: MulterFile,
    dto: UploadDocumentDto,
    userId: string,
  ) {
    const { entityType, entityId } = this.resolveEntityRef(dto);

    const created = await this.uploads.uploadSingle(
      file as any,
      { entityType, entityId, documentType: dto.documentType } as any,
      userId,
    );

    const document = await this.prisma.document.findUnique({
      where: { id: created.id },
      include: { links: true },
    });

    if (dto.affaireId && dto.documentType) {
      await this.updateChecklist(dto.affaireId, dto.documentType, created.id);
    }

    return document;
  }

  /**
   * FIX: UploadDocumentDto carries one optional FK per possible target
   * (assureId, cedanteId, reassureurId...) rather than a single
   * (entityType, entityId) pair. The old code did
   * `dto.entityType ?? DocumentEntityType.AFFAIRE` — so a caller that set
   * only `cedanteId` and forgot the explicit `entityType` flag got the
   * document silently filed as an AFFAIRE document. This resolves the type
   * from whichever FK is actually set, and throws instead of guessing if an
   * explicit entityType contradicts it.
   */
  private resolveEntityRef(dto: UploadDocumentDto): { entityType: DocumentEntityType; entityId: string } {
    const candidates: [DocumentEntityType, string | undefined][] = [
      ['ASSURE', dto.assureId],
      ['CEDANTE', dto.cedanteId],
      ['REASSUREUR', dto.reassureurId],
      ['CO_COURTIER', dto.coCourtId],
      ['AFFAIRE', dto.affaireId],
      ['SINISTRE', dto.sinistreId],
      ['ENCAISSEMENT', dto.encaissementId],
      ['DECAISSEMENT', dto.decaissementId],
      ['ORDRE_PAIEMENT', dto.ordrePaiementId],
      ['BORDEREAU', dto.bordereauId],
    ];

    const match = candidates.find(([, id]) => !!id);
    if (!match) {
      throw new BadRequestException(
        "Aucune entité cible spécifiée pour l'upload (assureId, cedanteId, reassureurId, etc.).",
      );
    }

    const [resolvedType, entityId] = match;

    if (dto.entityType && dto.entityType !== resolvedType) {
      throw new BadRequestException(
        `entityType (${dto.entityType}) ne correspond pas au champ FK fourni (résolu: ${resolvedType}).`,
      );
    }

    return { entityType: resolvedType, entityId: entityId as string };
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