import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateAssureDto } from './dto/create-assure.dto';
import { UpdateAssureDto } from './dto/update-assure.dto';
import { BulkImportAssureItemDto } from './dto/bulk-import-assures.dto';
import { BulkUpdateAssuresDataDto } from './dto/bulk-update-assures.dto';

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
        { pays: { contains: search, mode: 'insensitive' } },
        { contacts: { some: { email: { contains: search, mode: 'insensitive' } } } },
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
        deviseParDefaut: dto.deviseParDefaut,
        freeFields: dto.freeFields ?? {},
        contacts: dto.contacts ? { create: dto.contacts } : undefined,
      },
      include: { contacts: true },
    });
  }

  /**
   * Bulk import from a parsed Excel/CSV file. Rows are processed one at a time
   * (not wrapped in a single transaction) so a bad row never rolls back the
   * good ones — the caller gets a per-row success/failure report instead.
   * Also guards against duplicate RNEs *within the same file*, not just
   * against what's already in the DB.
   */
  async bulkImport(items: BulkImportAssureItemDto[]) {
    const results: {
      row: number;
      success: boolean;
      code?: string;
      raisonSociale?: string;
      error?: string;
    }[] = [];
    const seenRnes = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const dto = items[i];
      const rowNum = i + 1;
      try {
        if (!dto.raisonSociale || !dto.raisonSociale.trim()) {
          throw new BadRequestException('Raison sociale manquante');
        }

        if (dto.rne) {
          if (seenRnes.has(dto.rne)) {
            throw new ConflictException(`RNE ${dto.rne} en doublon dans le fichier importé`);
          }
          const existing = await this.prisma.assure.findUnique({ where: { rne: dto.rne } });
          if (existing) throw new ConflictException(`RNE ${dto.rne} déjà utilisé`);
          seenRnes.add(dto.rne);
        }

        const code = await this.sequence.next('ASSURE');
        const created = await this.prisma.assure.create({
          data: {
            code,
            raisonSociale: dto.raisonSociale.trim(),
            rne: dto.rne || undefined,
            formeJuridique: dto.formeJuridique,
            adresse: dto.adresse,
            pays: dto.pays,
            capital: dto.capital,
            freeFields: {},
          },
        });

        results.push({ row: rowNum, success: true, code: created.code, raisonSociale: created.raisonSociale });
      } catch (err: any) {
        results.push({
          row: rowNum,
          success: false,
          raisonSociale: dto?.raisonSociale,
          error: err?.message || 'Erreur inconnue',
        });
      }
    }

    return {
      total: items.length,
      created: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
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
        ...(dto.deviseParDefaut !== undefined && { deviseParDefaut: dto.deviseParDefaut }),
        ...(dto.freeFields !== undefined && { freeFields: dto.freeFields }),
        ...(dto.contacts !== undefined && {
          contacts: { deleteMany: {}, create: dto.contacts },
        }),
      },
      include: { contacts: true },
    });
  }

  /**
   * Bulk edit — applies a small, intentionally-limited set of shared fields
   * (pays, formeJuridique, isActive) identically across every id given. Uses
   * updateMany since these fields carry no per-row conflict risk (unlike rne,
   * which stays unique-checked and out of scope here).
   */
  async bulkUpdate(ids: string[], dto: BulkUpdateAssuresDataDto) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Aucun client sélectionné');
    }

    const data: any = {};
    if (dto.pays !== undefined) data.pays = dto.pays;
    if (dto.formeJuridique !== undefined) data.formeJuridique = dto.formeJuridique;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification fournie');
    }

    const result = await this.prisma.assure.updateMany({
      where: { id: { in: ids } },
      data,
    });

    return { updated: result.count };
  }

  async remove(id: string, userId?: string) {
    const existing = await this.findOne(id);

    const activeFacultatives = await this.prisma.facultativeAffaire.count({
      where: { assureId: id, affaire: { isActive: true } },
    });
    if (activeFacultatives > 0) {
      throw new BadRequestException(
        `Impossible de désactiver: ${activeFacultatives} affaire(s) facultative(s) active(s) existent pour ce client`,
      );
    }

    const updated = await this.prisma.assure.update({
      where: { id },
      data: { isActive: false },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'DEACTIVATE',
          entityType: 'ASSURE',
          entityId: id,
          before: { isActive: existing.isActive, raisonSociale: existing.raisonSociale, code: existing.code },
          after: { isActive: false, raisonSociale: existing.raisonSociale, code: existing.code },
        },
      });
    }

    return updated;
  }

  /**
   * Bulk deactivate — reuses remove()'s exact rule (block if active
   * facultatives exist) but processed per-id so one blocked client doesn't
   * prevent deactivating the rest of the selection. Returns which ids were
   * skipped and why.
   */
  async bulkDelete(ids: string[], userId?: string) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Aucun client sélectionné');
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of ids) {
      try {
        const exists = await this.prisma.assure.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Client introuvable');

        const activeFacultatives = await this.prisma.facultativeAffaire.count({
          where: { assureId: id, affaire: { isActive: true } },
        });
        if (activeFacultatives > 0) {
          throw new BadRequestException(
            `${activeFacultatives} affaire(s) active(s) empêchent la désactivation`,
          );
        }

        await this.prisma.assure.update({ where: { id }, data: { isActive: false } });
        if (userId) {
          await this.prisma.auditLog.create({
            data: {
              userId,
              action: 'BULK_DEACTIVATE',
              entityType: 'ASSURE',
              entityId: id,
              before: { isActive: exists.isActive, raisonSociale: exists.raisonSociale, code: exists.code },
              after: { isActive: false, raisonSociale: exists.raisonSociale, code: exists.code },
            },
          });
        }
        results.push({ id, success: true });
      } catch (err: any) {
        results.push({ id, success: false, error: err?.message || 'Erreur inconnue' });
      }
    }

    return {
      total: ids.length,
      deactivated: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
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