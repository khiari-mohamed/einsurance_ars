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

  /**
   * FIX: added `statut` param — findAll() previously hardcoded isActive: true, making
   * it impossible to satisfy the confirmed spec (5.6.7 / audit D7 default): inactive
   * partners must stay "visible dans l'historique, non sélectionnable dans les
   * nouvelles affaires" — visible, just not selectable. Default stays 'ACTIVE' so
   * existing callers keep the same behavior.
   */
  async findAll(
    search?: string,
    page = 1,
    limit = 20,
    statut: 'ACTIVE' | 'INACTIVE' | 'ALL' = 'ACTIVE',
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (statut === 'ACTIVE') where.isActive = true;
    else if (statut === 'INACTIVE') where.isActive = false;

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
    if (dto.rne) {
      const existing = await this.prisma.assure.findUnique({ where: { rne: dto.rne } });
      if (existing) throw new ConflictException('RNE déjà utilisé');
    }

    const code = await this.sequence.next('ASSURE'); // CLI-0001, CLI-0002...

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
    const existing = await this.findOne(id);

    if (dto.rne && dto.rne !== existing.rne) {
      const conflict = await this.prisma.assure.findUnique({ where: { rne: dto.rne } });
      if (conflict) throw new ConflictException(`RNE ${dto.rne} déjà utilisé par une autre entité`);
    }

    // FIX: was two separate round-trips (deleteMany() then a later update()) — if the
    // process died in between, contacts were deleted and never recreated (silent data
    // loss). Now a single nested write (deleteMany + create on the relation) executed
    // atomically inside one prisma.assure.update() call.
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
        ...(dto.contacts !== undefined && {
          contacts: { deleteMany: {}, create: dto.contacts },
        }),
      },
      include: { contacts: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    const activeFacultatives = await this.prisma.facultativeAffaire.count({
      where: { assureId: id, affaire: { isActive: true } },
    });
    if (activeFacultatives > 0) {
      throw new BadRequestException(
        `Impossible de désactiver: ${activeFacultatives} affaire(s) facultative(s) active(s) existent pour ce client`,
      );
    }

    return this.prisma.assure.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * ADMIN ONLY: allow a super admin to manually override the auto-generated code.
   * FIX: now bumps the underlying Sequence counter via sequence.bump() — see
   * SequenceService.bump() for rationale.
   */
  async overrideCode(id: string, newCode: string, userId: string) {
    const existing = await this.findOne(id);

    if (!/^CLI-[0-9]{4}$/.test(newCode)) {
      throw new BadRequestException('Le code doit être au format CLI-XXXX');
    }

    const conflict = await this.prisma.assure.findUnique({ where: { code: newCode } });
    if (conflict) {
      throw new ConflictException(`Le code ${newCode} est déjà utilisé`);
    }

    const oldCode = existing.code;

    const updated = await this.prisma.assure.update({
      where: { id },
      data: {
        code: newCode,
        codeModifiedBy: userId,
        codeModifiedAt: new Date(),
        oldCode: oldCode,
      },
    });

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

    const match = newCode.match(/-([0-9]{4})$/);
    if (match) {
      await this.sequence.bump('ASSURE', parseInt(match[1], 10));
    }

    return updated;
  }
}