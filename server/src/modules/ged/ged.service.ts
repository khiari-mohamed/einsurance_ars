import {
  Injectable, Logger, NotFoundException, BadRequestException, GoneException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentEntityType, DocumentStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../shared/services/storage.service';
import { UploadsService } from '../upload/uploads.service';
import { DocumentChecklistService } from './document-checklist.service';
import { OcrService } from './ocr.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';
import { ShareDocumentDto } from './dto/share-document.dto';
import { BulkUploadDto } from './dto/bulk-upload.dto';

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

// Used only by uploadNewVersion(), which — unlike upload()/bulkUpload() —
// does NOT go through UploadsService, so it needs its own guard. Mirrors
// the accepted types shown in DocumentChecklist.tsx's file input
// (`accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"`). Ideally this should live in
// (and be imported from) config/upload.config.ts as a single source of
// truth alongside whatever list UploadsService itself uses internally —
// flagged here rather than duplicated blindly, since that file wasn't part
// of this review.
const VERSION_UPLOAD_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
];

@Injectable()
export class GedService {
  private readonly logger = new Logger(GedService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private checklist: DocumentChecklistService,
    private uploads: UploadsService, // delegate storage/validation/versioning here instead of duplicating it
    private ocr: OcrService,
    private config: ConfigService,
  ) {}

  /**
   * Delegates to UploadsService (single source of truth for size/MIME
   * limits + correct DocumentVersion bookkeeping), then re-fetches with
   * `links` included.
   */
  async upload(file: MulterFile, dto: UploadDocumentDto, userId: string) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');

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

    this.triggerOcr(document);

    return document;
  }

  // NEW: referenced by the frontend (gedApi.bulkUpload) but had no backend
  // implementation. Mirrors upload() per file, targeting a single fixed
  // entity, and returns a per-file success/failure report rather than
  // failing the whole batch on one bad file.
  async bulkUpload(files: MulterFile[], dto: BulkUploadDto, userId: string) {
    if (!files?.length) throw new BadRequestException('Aucun fichier fourni');

    const results: Array<{ success: boolean; fileName: string; document?: any; error?: string }> = [];

    for (const file of files) {
      try {
        const created = await this.uploads.uploadSingle(
          file as any,
          { entityType: dto.entityType, entityId: dto.entityId, documentType: dto.documentType } as any,
          userId,
        );
        const document = await this.prisma.document.findUnique({
          where: { id: created.id },
          include: { links: true },
        });
        this.triggerOcr(document);
        results.push({ success: true, fileName: file.originalname, document });
      } catch (err: any) {
        results.push({ success: false, fileName: file.originalname, error: err?.message ?? 'Erreur inconnue' });
      }
    }

    return results;
  }

  // NEW: referenced by the frontend (gedApi.bulkDownload) but had no
  // backend implementation. Requires the `archiver` package
  // (`npm install archiver` + `npm install -D @types/archiver`).
  async bulkDownload(documentIds: string[]): Promise<Buffer> {
    if (!documentIds?.length) throw new BadRequestException('Aucun document sélectionné');

    const docs = await this.prisma.document.findMany({ where: { id: { in: documentIds } } });
    if (!docs.length) throw new NotFoundException('Aucun document trouvé');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const archiver = require('archiver');
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (chunk: Buffer) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
    });

    for (const doc of docs) {
      if (await this.storage.fileExists(doc.filePath)) {
        const buffer = await this.storage.getFileBuffer(doc.filePath);
        archive.append(buffer, { name: doc.originalName ?? doc.nom });
      } else {
        this.logger.warn(`bulkDownload: fichier introuvable sur disque pour document ${doc.id}, ignoré`);
      }
    }

    archive.finalize();
    return done;
  }

  /**
   * UploadDocumentDto carries one optional FK per possible target
   * (assureId, cedanteId, reassureurId...) rather than a single
   * (entityType, entityId) pair. Resolves the type from whichever FK is
   * actually set, and throws instead of guessing if an explicit entityType
   * contradicts it.
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

  async search(dto: SearchDocumentDto, page = dto.page ?? 1, limit = dto.limit ?? 20) {
    const skip = (page - 1) * limit;
    const where: any = {};

    // FIX: soft-deleted documents (delete() sets statut: REJETE) were never
    // excluded from listings, so "deleted" documents kept appearing
    // everywhere forever. Now excluded by default; an explicit
    // ?statut=REJETE still lets an admin view them (e.g. a trash view).
    where.statut = dto.statut ? dto.statut : { not: DocumentStatut.REJETE };

    if (dto.documentType) where.documentType = dto.documentType;
    if (dto.search) {
      where.OR = [
        { originalName: { contains: dto.search, mode: 'insensitive' } },
        { nom: { contains: dto.search, mode: 'insensitive' } },
        { documentType: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    if (dto.entityType && dto.entityId) {
      where.links = { some: { entityType: dto.entityType, [`${this.entityKey(dto.entityType)}Id`]: dto.entityId } };
    } else if (dto.affaireId) {
      where.links = { some: { affaireId: dto.affaireId } };
    }
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

  // NEW: GET /ged/documents/:id — the frontend has always called this;
  // there was no backend implementation.
  async getDocument(id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { links: true, versions: { orderBy: { versionNumber: 'desc' } } },
    });
    if (!doc) throw new NotFoundException('Document introuvable');
    return doc;
  }

  // NEW: PUT /ged/documents/:id — the frontend has always called this;
  // there was no backend implementation.
  async updateDocument(id: string, dto: UpdateDocumentDto) {
    const existing = await this.prisma.document.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Document introuvable');

    return this.prisma.document.update({
      where: { id },
      data: {
        ...(dto.documentType !== undefined && { documentType: dto.documentType }),
        ...(dto.nom !== undefined && { nom: dto.nom }),
        ...(dto.statut !== undefined && { statut: dto.statut }),
      },
      include: { links: true },
    });
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
    if (!file) throw new BadRequestException('Aucun fichier fourni');

    // FIX: unlike upload()/bulkUpload(), this path never went through
    // UploadsService's shared validation (MIME allow-list / size limit) —
    // it had none of its own either. A version-2+ upload could previously
    // be any file type/size up to Multer's raw global ceiling. Adding a
    // minimal local guard closes the gap without re-introducing the
    // "duplicate source of truth" problem the single-file upload() path
    // was already fixed to avoid (see comment there).
    if (!VERSION_UPLOAD_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Type de fichier non autorisé: ${file.mimetype}`);
    }
    const maxSizeBytes = this.config.get<number>('app.maxFileSizeMb', 25) * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(`Fichier trop volumineux (max ${maxSizeBytes / 1024 / 1024} Mo)`);
    }

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

    const updated = await this.prisma.document.update({
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

    this.triggerOcr(updated);
    return updated;
  }

  async getVersionHistory(id: string) {
    return this.prisma.documentVersion.findMany({
      where: { documentId: id },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async share(id: string, dto: ShareDocumentDto) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document introuvable');

    const shareRecord = await this.prisma.documentShare.create({
      data: {
        documentId: id,
        sharedWithUserId: dto.userId,
        sharedWithEmail: dto.email,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });

    // SCHEMA TODO: DocumentShare has no `token`/`passwordHash`/
    // `maxDownloads` columns — reusing the share record's own `id`
    // (already an unguessable UUIDv4) as the opaque bearer token for the
    // public link. `dto.password`/`dto.maxDownloads` are accepted by the
    // DTO but NOT persisted or enforced yet — see accessShared() below.
    return {
      token: shareRecord.id,
      url: `/ged/shared/${shareRecord.id}`,
      expiresAt: shareRecord.expiresAt,
    };
  }

  // NEW: GET /ged/shared/:token (public link access) — the frontend has
  // always called this; there was no backend implementation, and the route
  // must NOT require a Bearer token (see @Public() in the controller).
  async accessShared(token: string): Promise<{ buffer: Buffer; document: any }> {
    const share = await this.prisma.documentShare.findUnique({
      where: { id: token },
      include: { document: true },
    });
    if (!share) throw new NotFoundException('Lien de partage introuvable');
    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new GoneException('Ce lien de partage a expiré');
    }
    if (!this.storage.fileExists(share.document.filePath)) {
      throw new NotFoundException('Fichier introuvable sur disque');
    }

    await this.prisma.documentAccessLog.create({
      data: { documentId: share.documentId, action: 'VIEW' },
    });

    return { buffer: await this.storage.getFileBuffer(share.document.filePath), document: share.document };
  }

  async delete(id: string, userId: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document introuvable');

    await this.prisma.documentAccessLog.create({
      data: { documentId: id, userId, action: 'DELETE' },
    });

    // NOTE (design smell, left as-is deliberately): this reuses
    // DocumentStatut.REJETE — a value whose other meaning is "a checklist
    // reviewer rejected this document" — to also mean "the user deleted
    // this document". The two are conceptually different lifecycle events.
    // A dedicated `deletedAt DateTime?` column would be the correct fix,
    // but that's a schema change outside this module's given files. The
    // functional bug (deleted docs still showing up everywhere) is fixed
    // above in search()/getDocumentsForEntity(), regardless of naming.
    return this.prisma.document.update({
      where: { id },
      data: { statut: DocumentStatut.REJETE },
    });
  }

  async getDocumentsForEntity(entityType: DocumentEntityType, entityId: string) {
    return this.prisma.documentLink.findMany({
      where: {
        entityType,
        [`${this.entityKey(entityType)}Id`]: entityId,
        // FIX: same soft-delete leak as search() — a deleted document was
        // still returned in every entity's document panel forever.
        document: { statut: { not: DocumentStatut.REJETE } },
      },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // NEW: GET /ged/statistics — the frontend has always called this; there
  // was no backend implementation.
  async getStatistics() {
    const [total, byStatut, byType, sizeAgg, recentUploads] = await Promise.all([
      this.prisma.document.count(),
      this.prisma.document.groupBy({ by: ['statut'], _count: { _all: true } }),
      this.prisma.document.groupBy({ by: ['documentType'], _count: { _all: true } }),
      this.prisma.document.aggregate({ _sum: { sizeBytes: true } }),
      this.prisma.document.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    return {
      total,
      totalSizeBytes: sizeAgg._sum.sizeBytes ?? 0,
      byStatut: byStatut.map((s) => ({ statut: s.statut, count: s._count._all })),
      byType: byType.map((t) => ({ documentType: t.documentType, count: t._count._all })),
      recentUploads,
    };
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

  // NEW: wires the previously-unused OcrService into the actual upload
  // flow. Fire-and-forget/non-blocking by design (per OcrService's own
  // docstring) — a slow/failed OCR pass must never fail or delay the
  // upload response.
  private triggerOcr(document: { id: string; mimeType?: string | null; filePath: string } | null): void {
    if (!document) return;
    if (!this.isOcrEligible(document.mimeType)) return;

    this.ocr.extractText(document.filePath).catch((err: any) => {
      this.logger.warn(`OCR échouée pour le document ${document.id}: ${err?.message ?? err}`);
    });
  }

  private isOcrEligible(mimeType?: string | null): boolean {
    if (!mimeType) return false;
    return mimeType === 'application/pdf' || mimeType.startsWith('image/');
  }
}