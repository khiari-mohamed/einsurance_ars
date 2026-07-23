import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateCoCourtierDto } from './dto/create-co-courtier.dto';
import { UpdateCoCourtierDto } from './dto/update-co-courtier.dto';
import { BulkImportCoCourtierItemDto } from './dto/bulk-import-co-courtiers.dto';
import { BulkUpdateCoCourtiersDataDto } from './dto/bulk-update-co-courtiers.dto';

@Injectable()
export class CoCourtierService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
  ) {}

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
        { compteComptable: { contains: search } },
        // FIX (new, Co-Courtier pass): identifiantUnique is a prominent
        // column in the list UI but wasn't searchable — added.
        { identifiantUnique: { contains: search, mode: 'insensitive' } },
        { pays: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.coCourtier.findMany({
        where,
        include: { contacts: true, bankAccounts: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coCourtier.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const c = await this.prisma.coCourtier.findUnique({
      where: { id },
      include: {
        contacts: true,
        bankAccounts: true,
        documents: {
          where: { entityType: 'CO_COURTIER' },
          include: { document: true },
        },
      },
    });
    if (!c) throw new NotFoundException('Courtier en réassurance introuvable');
    return c;
  }

  async create(dto: CreateCoCourtierDto) {
    const existing = await this.prisma.coCourtier.findUnique({
      where: { compteComptable: dto.compteComptable },
    });
    if (existing) {
      throw new ConflictException(`Compte comptable ${dto.compteComptable} déjà utilisé`);
    }

    if (dto.rne) {
      const existingRne = await this.prisma.coCourtier.findFirst({ where: { rne: dto.rne } });
      if (existingRne) throw new ConflictException(`RNE ${dto.rne} déjà utilisé`);
    }

    if (dto.identifiantUnique) {
      const existingIdentifiant = await this.prisma.coCourtier.findUnique({
        where: { identifiantUnique: dto.identifiantUnique },
      });
      if (existingIdentifiant) {
        throw new ConflictException(`Identifiant unique ${dto.identifiantUnique} déjà utilisé`);
      }
    }
    if (dto.resident && !dto.identifiantUnique) {
      throw new BadRequestException(
        'Identifiant unique obligatoire pour les courtiers tunisiens (resident = true)',
      );
    }

    // Soft cross-entity duplicate-code check — see CedantesService.create().
    const [dupCedante, dupReassureur] = await Promise.all([
      this.prisma.cedante.findUnique({ where: { compteComptable: dto.compteComptable } }),
      this.prisma.reassureur.findUnique({ where: { compteComptable: dto.compteComptable } }),
    ]);
    if (dupCedante || dupReassureur) {
      await this.prisma.auditLog.create({
        data: {
          action: 'POTENTIAL_DUPLICATE_ACCOUNT_CODE',
          entityType: 'CO_COURTIER',
          after: {
            compteComptable: dto.compteComptable,
            raisonSociale: dto.raisonSociale,
            matchedCedanteId: dupCedante?.id ?? null,
            matchedReassureurId: dupReassureur?.id ?? null,
          },
        },
      });
    }

    const code = await this.sequence.next('COCOURTIER'); // CCO-0001, CCO-0002...

    return this.prisma.coCourtier.create({
      data: {
        code,
        compteComptable: dto.compteComptable,
        isAccountLocked: true,
        raisonSociale: dto.raisonSociale,
        rne: dto.rne,
        identifiantUnique: dto.identifiantUnique,
        resident: dto.resident,
        formeJuridique: dto.formeJuridique,
        adresse: dto.adresse,
        pays: dto.pays,
        capital: dto.capital,
        // FIX (new, Co-Courtier pass): deviseParDefaut/groupKey now persisted.
        // Passing dto.deviseParDefaut straight through is safe even when
        // undefined — Prisma omits undefined keys, so the schema's
        // @default("TND") still applies when the caller doesn't send one.
        deviseParDefaut: dto.deviseParDefaut,
        groupKey: dto.groupKey,
        freeFields: dto.freeFields ?? {},
        contacts: dto.contacts ? { create: dto.contacts } : undefined,
        bankAccounts: dto.bankAccounts ? { create: dto.bankAccounts } : undefined,
      },
      include: { contacts: true, bankAccounts: true },
    });
  }

  /**
   * Bulk import — mirrors CedantesService.bulkImport(). Same in-file + DB
   * uniqueness checks as create(): compteComptable, identifiantUnique, and the
   * resident-requires-identifiantUnique rule. rne is non-unique on CoCourtier
   * (mostly-foreign entities, matching Reassureur's rationale) so it's in-file
   * dedup only, not a DB uniqueness check.
   */
  async bulkImport(items: BulkImportCoCourtierItemDto[]) {
    const results: {
      row: number;
      success: boolean;
      code?: string;
      raisonSociale?: string;
      error?: string;
    }[] = [];
    const seenComptes = new Set<string>();
    const seenIdentifiants = new Set<string>();
    const seenRnes = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const dto = items[i];
      const rowNum = i + 1;
      try {
        if (!dto.raisonSociale || !dto.raisonSociale.trim()) {
          throw new BadRequestException('Raison sociale manquante');
        }

        if (!dto.compteComptable) {
          throw new BadRequestException('Compte comptable manquant');
        }
        if (seenComptes.has(dto.compteComptable)) {
          throw new ConflictException(`Compte comptable ${dto.compteComptable} en doublon dans le fichier importé`);
        }
        const existingCompte = await this.prisma.coCourtier.findUnique({
          where: { compteComptable: dto.compteComptable },
        });
        if (existingCompte) {
          throw new ConflictException(`Compte comptable ${dto.compteComptable} déjà utilisé`);
        }

        if (dto.identifiantUnique) {
          if (seenIdentifiants.has(dto.identifiantUnique)) {
            throw new ConflictException(`Identifiant unique ${dto.identifiantUnique} en doublon dans le fichier importé`);
          }
          const existingIdentifiant = await this.prisma.coCourtier.findUnique({
            where: { identifiantUnique: dto.identifiantUnique },
          });
          if (existingIdentifiant) {
            throw new ConflictException(`Identifiant unique ${dto.identifiantUnique} déjà utilisé`);
          }
        }

        if (dto.rne) {
          if (seenRnes.has(dto.rne)) {
            throw new ConflictException(`RNE ${dto.rne} en doublon dans le fichier importé`);
          }
          seenRnes.add(dto.rne);
        }

        if (dto.resident && !dto.identifiantUnique) {
          throw new BadRequestException(
            'Identifiant unique obligatoire pour les courtiers tunisiens (resident = true)',
          );
        }

        const code = await this.sequence.next('COCOURTIER');
        const created = await this.prisma.coCourtier.create({
          data: {
            code,
            compteComptable: dto.compteComptable,
            isAccountLocked: true,
            raisonSociale: dto.raisonSociale.trim(),
            rne: dto.rne || undefined,
            identifiantUnique: dto.identifiantUnique || undefined,
            resident: dto.resident,
            formeJuridique: dto.formeJuridique,
            adresse: dto.adresse,
            pays: dto.pays,
            capital: dto.capital,
            // FIX (new, Co-Courtier pass): parity with create().
            deviseParDefaut: dto.deviseParDefaut || undefined,
            freeFields: {},
          },
        });

        seenComptes.add(dto.compteComptable);

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

  /** Bulk edit — mirrors CedantesService.bulkUpdate() exactly. */
  async bulkUpdate(ids: string[], dto: BulkUpdateCoCourtiersDataDto) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Aucun courtier sélectionné');
    }

    const data: any = {};
    if (dto.pays !== undefined) data.pays = dto.pays;
    if (dto.formeJuridique !== undefined) data.formeJuridique = dto.formeJuridique;
    // FIX (new, Co-Courtier pass): parity with the DTO addition.
    if (dto.deviseParDefaut !== undefined) data.deviseParDefaut = dto.deviseParDefaut;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification fournie');
    }

    const result = await this.prisma.coCourtier.updateMany({
      where: { id: { in: ids } },
      data,
    });

    return { updated: result.count };
  }

  /**
   * Bulk deactivate — mirrors remove()'s exact (lack of) guard: as noted in
   * remove()'s own comment, there is still no AffaireCoCourtier-equivalent
   * relation, so this cannot check for active deal participation before
   * deactivating, same limitation as the single-record remove(). Processed
   * per-id so one NotFoundException doesn't block the rest of the selection.
   */
  async bulkDelete(ids: string[], userId?: string) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Aucun courtier sélectionné');
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of ids) {
      try {
        const exists = await this.prisma.coCourtier.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Courtier introuvable');

        await this.prisma.coCourtier.update({ where: { id }, data: { isActive: false } });
        if (userId) {
          await this.prisma.auditLog.create({
            data: {
              userId,
              action: 'BULK_DEACTIVATE',
              entityType: 'CO_COURTIER',
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

  async update(id: string, dto: UpdateCoCourtierDto) {
    const existing = await this.findOne(id);

    if (dto.rne && dto.rne !== existing.rne) {
      const conflict = await this.prisma.coCourtier.findFirst({ where: { rne: dto.rne } });
      if (conflict) {
        throw new ConflictException(`RNE ${dto.rne} déjà utilisé par une autre entité`);
      }
    }

    if (dto.identifiantUnique && dto.identifiantUnique !== existing.identifiantUnique) {
      const conflict = await this.prisma.coCourtier.findUnique({
        where: { identifiantUnique: dto.identifiantUnique },
      });
      if (conflict) {
        throw new ConflictException(`Identifiant unique ${dto.identifiantUnique} déjà utilisé par une autre entité`);
      }
    }

    const resident = dto.resident ?? existing.resident;
    if (resident && !(dto.identifiantUnique ?? existing.identifiantUnique)) {
      throw new BadRequestException(
        'Identifiant unique obligatoire pour les courtiers tunisiens (resident = true)',
      );
    }

    return this.prisma.coCourtier.update({
      where: { id },
      data: {
        ...(dto.raisonSociale !== undefined && { raisonSociale: dto.raisonSociale }),
        ...(dto.rne !== undefined && { rne: dto.rne }),
        ...(dto.identifiantUnique !== undefined && { identifiantUnique: dto.identifiantUnique }),
        ...(dto.resident !== undefined && { resident: dto.resident }),
        ...(dto.formeJuridique !== undefined && { formeJuridique: dto.formeJuridique }),
        ...(dto.adresse !== undefined && { adresse: dto.adresse }),
        ...(dto.pays !== undefined && { pays: dto.pays }),
        ...(dto.capital !== undefined && { capital: dto.capital }),
        // FIX (new, Co-Courtier pass): deviseParDefaut/groupKey now updatable.
        ...(dto.deviseParDefaut !== undefined && { deviseParDefaut: dto.deviseParDefaut }),
        ...(dto.groupKey !== undefined && { groupKey: dto.groupKey }),
        ...(dto.freeFields !== undefined && { freeFields: dto.freeFields }),
        ...(dto.contacts !== undefined && {
          contacts: { deleteMany: {}, create: dto.contacts },
        }),
        ...(dto.bankAccounts !== undefined && {
          bankAccounts: { deleteMany: {}, create: dto.bankAccounts },
        }),
      },
      include: { contacts: true, bankAccounts: true },
    });
  }

  async remove(id: string, userId?: string) {
    const existing = await this.findOne(id);

    // UNRESOLVED (flagged in review, not fixed here — no schema to hook into yet):
    // there is still no AffaireCoCourtier (or equivalent) relation, so unlike
    // Cedantes/Reassureurs this method cannot check for active deal participation
    // before deactivating. Section 5.7 says CoCourtier is structurally identical to
    // Réassureur, whose Onglet 3 is a "liste dynamique des affaires" — the same
    // relation is conceptually owed here. Add the join model + this guard together
    // once confirmed; deactivating a co-broker mid-deal today goes unguarded.

    const updated = await this.prisma.coCourtier.update({
      where: { id },
      data: { isActive: false },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'DEACTIVATE',
          entityType: 'CO_COURTIER',
          entityId: id,
          before: { isActive: existing.isActive, raisonSociale: existing.raisonSociale, code: existing.code },
          after: { isActive: false, raisonSociale: existing.raisonSociale, code: existing.code },
        },
      });
    }

    return updated;
  }

  /**
   * ADMIN ONLY: allow a super admin to manually override the auto-generated code.
   */
  async overrideCode(id: string, newCode: string, userId: string) {
    const existing = await this.findOne(id);

    if (!/^CCO-[0-9]{4}$/.test(newCode)) {
      throw new BadRequestException('Le code doit être au format CCO-XXXX');
    }

    const conflict = await this.prisma.coCourtier.findUnique({ where: { code: newCode } });
    if (conflict) {
      throw new ConflictException(`Le code ${newCode} est déjà utilisé`);
    }

    const oldCode = existing.code;

    const updated = await this.prisma.coCourtier.update({
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
        entityType: 'CO_COURTIER',
        entityId: id,
        before: { code: oldCode },
        after: { code: newCode },
      },
    });

    const match = newCode.match(/-([0-9]{4})$/);
    if (match) {
      await this.sequence.bump('COCOURTIER', parseInt(match[1], 10));
    }

    return updated;
  }
}