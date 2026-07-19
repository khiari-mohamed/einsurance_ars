import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { File as MulterFile } from 'multer';
import { PrismaService } from '../../../prisma/prisma.service';
import { GedService } from '../../ged/ged.service';
import { AttachConventionDto, ConventionPartnerType } from './dto/attach-convention.dto';

@Injectable()
export class ConventionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ged: GedService, // goes through GED, not UploadsService directly — see rationale below
  ) {}

  private async assertPartnerExists(partnerType: ConventionPartnerType, partnerId: string) {
    const exists =
      partnerType === 'CEDANTE'
        ? await this.prisma.cedante.findUnique({ where: { id: partnerId } })
        : partnerType === 'REASSUREUR'
        ? await this.prisma.reassureur.findUnique({ where: { id: partnerId } })
        : await this.prisma.coCourtier.findUnique({ where: { id: partnerId } });

    if (!exists) {
      throw new NotFoundException(`${partnerType} introuvable (id: ${partnerId})`);
    }
  }

  private fkField(partnerType: ConventionPartnerType): 'cedanteId' | 'reassureurId' | 'coCourtId' {
    if (partnerType === 'CEDANTE') return 'cedanteId';
    if (partnerType === 'REASSUREUR') return 'reassureurId';
    return 'coCourtId';
  }

  async attach(file: MulterFile, dto: AttachConventionDto, userId?: string) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu.');
    }
    await this.assertPartnerExists(dto.partnerType, dto.partnerId);

    // Routed through GedService (not UploadsService directly) so retention
    // (10-year legal minimum, see retention.service.ts) and OCR hooks apply
    // to conventions the same way they apply to every other document type.
    const document = await this.ged.upload(
      file as any,
      {
        documentType: 'CONVENTION',
        entityType: dto.partnerType,
        cedanteId: dto.partnerType === 'CEDANTE' ? dto.partnerId : undefined,
        reassureurId: dto.partnerType === 'REASSUREUR' ? dto.partnerId : undefined,
        coCourtId: dto.partnerType === 'CO_COURTIER' ? dto.partnerId : undefined,
      } as any,
      userId ?? 'system',
    );

    return this.prisma.convention.create({
      data: {
        [this.fkField(dto.partnerType)]: dto.partnerId,
        documentId: document.id,
        dateSignature: dto.dateSignature ? new Date(dto.dateSignature) : undefined,
        dateEffet: dto.dateEffet ? new Date(dto.dateEffet) : undefined,
        notes: dto.notes,
      },
      include: { document: true },
    });
  }

  async listForPartner(partnerType: ConventionPartnerType, partnerId: string) {
    return this.prisma.convention.findMany({
      where: { [this.fkField(partnerType)]: partnerId, isActive: true },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deactivate(conventionId: string) {
    const existing = await this.prisma.convention.findUnique({ where: { id: conventionId } });
    if (!existing) throw new NotFoundException('Convention introuvable.');

    return this.prisma.convention.update({
      where: { id: conventionId },
      data: { isActive: false },
    });
  }
}