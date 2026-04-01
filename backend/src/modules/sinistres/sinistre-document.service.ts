import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SinistreDocument, Sinistre } from './sinistres.entity';
import { StorageService } from '../shared/services/storage.service';

export interface UploadDocumentDto {
  sinistreId: string;
  type: string;
  nom: string;
  file: any;
  tags?: string[];
  description?: string;
  uploadedById: string;
}

@Injectable()
export class SinistreDocumentService {
  constructor(
    @InjectRepository(SinistreDocument) private documentRepo: Repository<SinistreDocument>,
    @InjectRepository(Sinistre) private sinistreRepo: Repository<Sinistre>,
    private storageService: StorageService,
  ) {}

  async uploadDocument(dto: UploadDocumentDto): Promise<SinistreDocument> {
    const sinistre = await this.sinistreRepo.findOne({ where: { id: dto.sinistreId } });
    if (!sinistre) throw new NotFoundException('Sinistre not found');

    const filePath = `sinistres/${dto.sinistreId}/${Date.now()}_${dto.file.originalname}`;
    const uploadResult = await this.storageService.uploadFile(filePath, dto.file.buffer, dto.file.mimetype);
    const fileUrl = typeof uploadResult === 'string' ? uploadResult : uploadResult.url;

    const document = this.documentRepo.create({
      sinistreId: dto.sinistreId,
      type: dto.type,
      nom: dto.nom,
      fichierUrl: fileUrl,
      tags: dto.tags || [],
      description: dto.description,
      uploadedById: dto.uploadedById,
    });

    return this.documentRepo.save(document);
  }

  async findBySinistre(sinistreId: string) {
    return this.documentRepo.find({
      where: { sinistreId },
      relations: ['uploadedBy'],
      order: { dateUpload: 'DESC' },
    });
  }

  async findByType(sinistreId: string, type: string): Promise<SinistreDocument[]> {
    return this.documentRepo.find({
      where: { sinistreId, type },
      order: { dateUpload: 'DESC' },
    });
  }

  async deleteDocument(id: string): Promise<void> {
    const document = await this.documentRepo.findOne({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');

    await this.storageService.deleteFile(document.fichierUrl);
    await this.documentRepo.delete(id);
  }

  async getDocumentUrl(id: string) {
    const document = await this.documentRepo.findOne({ where: { id } });
    if (!document) throw new NotFoundException('Document not found');

    return { url: document.fichierUrl };
  }
}
