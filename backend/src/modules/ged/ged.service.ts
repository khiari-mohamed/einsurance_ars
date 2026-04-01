import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, In } from 'typeorm';
import { Document, EntityType, DocumentStatus, DocumentType } from './document.entity';
import { DocumentLink } from './document-link.entity';
import { DocumentVersion } from './document-version.entity';
import { DocumentAccessLog, AccessAction } from './document-access-log.entity';
import { DocumentShare } from './document-share.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { SearchDocumentDto } from './dto/search-document.dto';
import { StorageService } from '../shared/services/storage.service';
import { OcrService } from './ocr.service';
import { FileValidationService } from './file-validation.service';
import * as crypto from 'crypto';
import archiver from 'archiver';

@Injectable()
export class GedService {
  constructor(
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    @InjectRepository(DocumentLink)
    private linkRepo: Repository<DocumentLink>,
    @InjectRepository(DocumentVersion)
    private versionRepo: Repository<DocumentVersion>,
    @InjectRepository(DocumentAccessLog)
    private accessLogRepo: Repository<DocumentAccessLog>,
    @InjectRepository(DocumentShare)
    private shareRepo: Repository<DocumentShare>,
    private storageService: StorageService,
    private ocrService: OcrService,
    private fileValidation: FileValidationService,
  ) {}

  async uploadDocument(
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
    dto: UploadDocumentDto,
    userId: string,
  ): Promise<Document> {
    this.fileValidation.validateFile(file);
    const checksum = this.calculateChecksum(file.buffer);
    const fileName = this.sanitizeFileName(file.originalname);
    const storagePath = this.generateStoragePath(dto.entityType, dto.entityId, fileName);

    const { path } = await this.storageService.uploadFile(storagePath, file.buffer, file.mimetype);

    const document = this.documentRepo.create({
      fileName,
      originalFileName: file.originalname,
      storagePath: path,
      mimeType: file.mimetype,
      fileSize: file.size,
      entityType: dto.entityType,
      entityId: dto.entityId,
      documentType: dto.documentType,
      confidentialityLevel: dto.confidentialityLevel,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
      tags: dto.tags || [],
      description: dto.description,
      checksum,
      uploadedById: userId,
    });

    const saved = await this.documentRepo.save(document);

    await this.logAccess(saved.id, userId, AccessAction.UPLOAD, null);

    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      try {
        await this.ocrService.processDocument(saved.id, file.buffer, file.mimetype);
      } catch (error) {
        console.error('OCR processing failed:', error);
      }
    }

    return this.documentRepo.findOne({
      where: { id: saved.id },
      relations: ['uploadedBy'],
    });
  }

  async getDocuments(query: SearchDocumentDto): Promise<Document[]> {
    const qb = this.documentRepo.createQueryBuilder('doc')
      .leftJoinAndSelect('doc.uploadedBy', 'user');

    if (query.entityType) qb.andWhere('doc.entityType = :entityType', { entityType: query.entityType });
    if (query.entityId) qb.andWhere('doc.entityId = :entityId', { entityId: query.entityId });
    if (query.documentType) qb.andWhere('doc.documentType = :documentType', { documentType: query.documentType });
    if (query.status) qb.andWhere('doc.status = :status', { status: query.status });
    if (query.confidentialityLevel) qb.andWhere('doc.confidentialityLevel = :confidentialityLevel', { confidentialityLevel: query.confidentialityLevel });
    if (query.uploadedById) qb.andWhere('doc.uploadedById = :uploadedById', { uploadedById: query.uploadedById });

    if (query.search) {
      qb.andWhere(
        '(doc.fileName ILIKE :search OR doc.ocrText ILIKE :search OR doc.description ILIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    if (query.uploadedAfter || query.uploadedBefore) {
      qb.andWhere('doc.uploadedAt BETWEEN :start AND :end', {
        start: query.uploadedAfter ? new Date(query.uploadedAfter) : new Date('1970-01-01'),
        end: query.uploadedBefore ? new Date(query.uploadedBefore) : new Date(),
      });
    }

    return qb.orderBy('doc.uploadedAt', 'DESC').getMany();
  }

  async getDocument(id: string, userId: string): Promise<Document> {
    const document = await this.documentRepo.findOne({
      where: { id },
      relations: ['uploadedBy'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.logAccess(id, userId, AccessAction.VIEW, null);

    return document;
  }

  async downloadDocument(id: string, userId: string): Promise<{ buffer: Buffer; document: Document }> {
    const document = await this.getDocument(id, userId);

    const buffer = await this.storageService.getFile(document.storagePath);

    await this.logAccess(id, userId, AccessAction.DOWNLOAD, null);

    return { buffer, document };
  }

  async updateDocument(id: string, dto: UpdateDocumentDto, userId: string): Promise<Document> {
    const document = await this.documentRepo.findOne({ where: { id } });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    Object.assign(document, {
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : document.validFrom,
      validTo: dto.validTo ? new Date(dto.validTo) : document.validTo,
    });

    await this.documentRepo.save(document);
    await this.logAccess(id, userId, AccessAction.UPDATE, null);

    return this.documentRepo.findOne({
      where: { id },
      relations: ['uploadedBy'],
    });
  }

  async deleteDocument(id: string, userId: string): Promise<void> {
    const document = await this.documentRepo.findOne({ where: { id } });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    await this.storageService.deleteFile(document.storagePath);
    await this.logAccess(id, userId, AccessAction.DELETE, null);
    await this.documentRepo.remove(document);
  }

  async getEntityDocuments(entityType: EntityType, entityId: string): Promise<Document[]> {
    return this.documentRepo.find({
      where: { entityType, entityId },
      relations: ['uploadedBy'],
      order: { uploadedAt: 'DESC' },
    });
  }

  async getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
    return this.versionRepo.find({
      where: { documentId },
      relations: ['changedBy'],
      order: { versionNumber: 'DESC' },
    });
  }

  async getAccessLogs(documentId: string): Promise<DocumentAccessLog[]> {
    return this.accessLogRepo.find({
      where: { documentId },
      relations: ['user'],
      order: { timestamp: 'DESC' },
      take: 100,
    });
  }

  async getStatistics(): Promise<any> {
    const total = await this.documentRepo.count();
    const byType = await this.documentRepo
      .createQueryBuilder('doc')
      .select('doc.documentType', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('doc.documentType')
      .getRawMany();

    const byEntity = await this.documentRepo
      .createQueryBuilder('doc')
      .select('doc.entityType', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('doc.entityType')
      .getRawMany();

    const totalSize = await this.documentRepo
      .createQueryBuilder('doc')
      .select('SUM(doc.fileSize)', 'total')
      .getRawOne();

    return {
      total,
      byType,
      byEntity,
      totalSize: parseInt(totalSize.total || '0'),
    };
  }

  async bulkUpload(
    files: any[],
    entityType: EntityType,
    entityId: string,
    documentType: DocumentType,
    userId: string,
  ): Promise<Document[]> {
    this.fileValidation.validateFiles(files);
    const documents = [];
    for (const file of files) {
      const doc = await this.uploadDocument(
        file,
        { entityType, entityId, documentType },
        userId,
      );
      documents.push(doc);
    }
    return documents;
  }

  async bulkDownload(documentIds: string[], userId: string): Promise<Buffer> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const buffers: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => buffers.push(chunk));

    for (const id of documentIds) {
      const { buffer, document } = await this.downloadDocument(id, userId);
      archive.append(buffer, { name: document.fileName });
    }

    await archive.finalize();
    return Buffer.concat(buffers);
  }

  async createShareLink(
    documentId: string,
    expiresAt: Date,
    userId: string,
    password?: string,
    email?: string,
    maxDownloads?: number,
  ): Promise<{ token: string; url: string }> {
    const document = await this.documentRepo.findOne({ where: { id: documentId } });
    if (!document) throw new NotFoundException('Document not found');

    const token = crypto.randomBytes(32).toString('hex');
    const hashedPassword = password ? crypto.createHash('sha256').update(password).digest('hex') : null;

    const share = this.shareRepo.create({
      documentId,
      token,
      password: hashedPassword,
      email,
      maxDownloads,
      expiresAt,
      createdById: userId,
    });

    await this.shareRepo.save(share);
    await this.logAccess(documentId, userId, AccessAction.SHARE, null);

    return { token, url: `/ged/shared/${token}` };
  }

  async accessSharedDocument(token: string, password?: string): Promise<{ buffer: Buffer; document: Document }> {
    const share = await this.shareRepo.findOne({
      where: { token },
      relations: ['document'],
    });

    if (!share) throw new NotFoundException('Shared link not found');
    if (new Date() > share.expiresAt) throw new BadRequestException('Link expired');
    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      throw new BadRequestException('Download limit reached');
    }
    if (share.password) {
      const hashedInput = password ? crypto.createHash('sha256').update(password).digest('hex') : null;
      if (hashedInput !== share.password) throw new BadRequestException('Invalid password');
    }

    const buffer = await this.storageService.getFile(share.document.storagePath);
    await this.shareRepo.update(share.id, { downloadCount: share.downloadCount + 1 });

    return { buffer, document: share.document };
  }

  async linkDocuments(
    documentId: string,
    linkedEntityType: string,
    linkedEntityId: string,
  ): Promise<void> {
    const link = this.linkRepo.create({
      documentId,
      linkedEntityType,
      linkedEntityId,
    });
    await this.linkRepo.save(link);
  }

  private async logAccess(
    documentId: string,
    userId: string,
    action: AccessAction,
    ipAddress: string,
  ): Promise<void> {
    const log = this.accessLogRepo.create({
      documentId,
      userId,
      action,
      ipAddress,
    });
    await this.accessLogRepo.save(log);
  }

  private calculateChecksum(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  private generateStoragePath(entityType: EntityType, entityId: string, fileName: string): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    return `ged/${entityType}/${entityId}/${year}/${month}/${timestamp}_${fileName}`;
  }
}
