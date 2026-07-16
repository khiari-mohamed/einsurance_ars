import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateAssureDto } from './dto/create-assure.dto';
import { UpdateAssureDto } from './dto/update-assure.dto';

@Injectable()
export class AssuresService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
  ) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { raisonSociale: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { rne: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.assure.findMany({
        where,
        include: { contacts: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.assure.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const assure = await this.prisma.assure.findUnique({
      where: { id },
      include: {
        contacts: true,
        facultatives: {
          include: {
            affaire: {
              include: {
                cedante: true,
                reassureurs: { include: { reassureur: true } },
              },
            },
          },
          take: 10,
          orderBy: { affaireId: 'desc' },
        },
        documents: {
          where: { entityType: 'ASSURE' },
          include: { document: true },
        },
      },
    });
    if (!assure) throw new NotFoundException('Client introuvable');
    return assure;
  }

  async create(dto: CreateAssureDto) {
    // Check RNE uniqueness if provided
    if (dto.rne) {
      const existing = await this.prisma.assure.findUnique({
        where: { rne: dto.rne },
      });
      if (existing) throw new ConflictException('RNE déjà utilisé');
    }

    // Generate code (ASSURE → CLI- prefix via SequenceService)
    const code = await this.sequence.next('ASSURE'); // returns CLI-0001, CLI-0002...

    return this.prisma.assure.create({
      data: {
        code,
        raisonSociale: dto.raisonSociale,
        rne: dto.rne,
        formeJuridique: dto.formeJuridique,
        adresse: dto.adresse,
        pays: dto.pays,
        capital: dto.capital,
        freeFields: dto.freeFields ?? {},
        contacts: dto.contacts ? { create: dto.contacts } : undefined,
      },
      include: { contacts: true },
    });
  }

  async update(id: string, dto: UpdateAssureDto) {
    // Verify exists
    const existing = await this.findOne(id);

    // Check RNE uniqueness if updated
    if (dto.rne && dto.rne !== existing.rne) {
      const conflict = await this.prisma.assure.findUnique({
        where: { rne: dto.rne },
      });
      if (conflict) throw new ConflictException(`RNE ${dto.rne} déjà utilisé par une autre entité`);
    }

    // Handle contacts (delete & recreate)
    if (dto.contacts !== undefined) {
      await this.prisma.contact.deleteMany({ where: { assureId: id } });
    }

    return this.prisma.assure.update({
      where: { id },
      data: {
        ...(dto.raisonSociale !== undefined && { raisonSociale: dto.raisonSociale }),
        ...(dto.rne !== undefined && { rne: dto.rne }),
        ...(dto.formeJuridique !== undefined && { formeJuridique: dto.formeJuridique }),
        ...(dto.adresse !== undefined && { adresse: dto.adresse }),
        ...(dto.pays !== undefined && { pays: dto.pays }),
        ...(dto.capital !== undefined && { capital: dto.capital }),
        ...(dto.freeFields !== undefined && { freeFields: dto.freeFields }),
        ...(dto.contacts && { contacts: { create: dto.contacts } }),
      },
      include: { contacts: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Check for active facultatives before deactivating
    const activeFacultatives = await this.prisma.facultativeAffaire.count({
      where: {
        assureId: id,
        affaire: { isActive: true },
      },
    });
    if (activeFacultatives > 0) {
      throw new BadRequestException(
        `Impossible de désactiver: ${activeFacultatives} affaire(s) facultative(s) active(s) existent pour ce client`,
      );
    }

    // Soft delete: set inactive
    return this.prisma.assure.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * ADMIN ONLY: Allow super admin to modify the auto-generated code.
   */
  async overrideCode(id: string, newCode: string, userId: string) {
    const existing = await this.findOne(id);

    // Validate code format (CLI-XXXX)
    if (!/^CLI-[0-9]{4}$/.test(newCode)) {
      throw new BadRequestException('Le code doit être au format CLI-XXXX');
    }

    // Check if code already exists
    const conflict = await this.prisma.assure.findUnique({
      where: { code: newCode },
    });
    if (conflict) {
      throw new ConflictException(`Le code ${newCode} est déjà utilisé`);
    }

    // Store old code before update
    const oldCode = existing.code;

    // Update with audit trail
    const updated = await this.prisma.assure.update({
      where: { id },
      data: {
        code: newCode,
        codeModifiedBy: userId,
        codeModifiedAt: new Date(),
        oldCode: oldCode,
      },
    });

    // Log the change in AuditLog
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CODE_OVERRIDE',
        entityType: 'ASSURE',
        entityId: id,
        before: { code: oldCode },
        after: { code: newCode },
      },
    });

    return updated;
  }
}