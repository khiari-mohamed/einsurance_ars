import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateReassureurDto } from './dto/create-reassureur.dto';
import { UpdateReassureurDto } from './dto/update-reassureur.dto';
import { BulkImportReassureurItemDto } from './dto/bulk-import-reassureurs.dto';
import { BulkUpdateReassureursDataDto } from './dto/bulk-update-reassureurs.dto';

@Injectable()
export class ReassureursService {
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
        { identifiantUnique: { contains: search, mode: 'insensitive' } },
        { pays: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.reassureur.findMany({
        where,
        include: { contacts: true, bankAccounts: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reassureur.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const r = await this.prisma.reassureur.findUnique({
      where: { id },
      include: {
        contacts: true,
        bankAccounts: true,
        participations: {
          include: {
            affaire: {
              include: {
                cedante: true,
                facultativeData: { include: { assure: true } },
              },
            },
          },
          take: 10,
          orderBy: { affaireId: 'desc' },
        },
        auxiliaryAccounts: true,
        documents: {
          where: { entityType: 'REASSUREUR' },
          include: { document: true },
        },
      },
    });
    if (!r) throw new NotFoundException('Réassureur introuvable');
    return r;
  }

  async create(dto: CreateReassureurDto) {
    const [existingCompte, existingRne, existingIdentifiant] = await Promise.all([
      this.prisma.reassureur.findUnique({ where: { compteComptable: dto.compteComptable } }),
      dto.rne ? this.prisma.reassureur.findFirst({ where: { rne: dto.rne } }) : null,
      dto.identifiantUnique
        ? this.prisma.reassureur.findUnique({ where: { identifiantUnique: dto.identifiantUnique } })
        : null,
    ]);

    if (existingCompte) {
      throw new ConflictException(`Compte comptable ${dto.compteComptable} déjà utilisé`);
    }
    if (existingRne) {
      throw new ConflictException(`RNE ${dto.rne} déjà utilisé`);
    }
    if (existingIdentifiant) {
      throw new ConflictException(`Identifiant unique ${dto.identifiantUnique} déjà utilisé`);
    }

    if (dto.resident && !dto.identifiantUnique) {
      throw new BadRequestException(
        'Identifiant unique obligatoire pour les réassureurs tunisiens (resident = true)',
      );
    }

    // FIX: was a hard BadRequestException blocking creation of ANY non-resident
    // reassureur without SWIFT on every bank account. The audit lists 3 real named
    // non-resident reassureurs currently missing SWIFT in the client's own accounting
    // file — TUNIS RE (40135000), AIG (40136550), LIBYA INSURANCE (40137000) — so this
    // was actively preventing the "start seeding immediately" work the audit itself
    // says is possible today. Question 5.6.3 is still open. Now: allow creation, flag
    // it non-blocking so it surfaces as a data-quality item on the audit trail instead
    // of silently vanishing OR hard-blocking known real records.
    let missingSwiftFlag = false;
    if (!dto.resident && dto.bankAccounts?.length) {
      missingSwiftFlag = dto.bankAccounts.some((b) => !b.swift);
    }

    // FIX (new): soft cross-entity duplicate-code check — see CedantesService.create()
    // for the same rationale (6 known legitimate dual-coded entities, e.g. TUNIS RE,
    // GAT RE — not blocked, only logged).
    const [dupCedante, dupCoCourtier] = await Promise.all([
      this.prisma.cedante.findUnique({ where: { compteComptable: dto.compteComptable } }),
      this.prisma.coCourtier.findUnique({ where: { compteComptable: dto.compteComptable } }),
    ]);
    if (dupCedante || dupCoCourtier) {
      await this.prisma.auditLog.create({
        data: {
          action: 'POTENTIAL_DUPLICATE_ACCOUNT_CODE',
          entityType: 'REASSUREUR',
          after: {
            compteComptable: dto.compteComptable,
            raisonSociale: dto.raisonSociale,
            matchedCedanteId: dupCedante?.id ?? null,
            matchedCoCourtierId: dupCoCourtier?.id ?? null,
          },
        },
      });
    }

    const code = await this.sequence.next('REASSUREUR'); // REA-0001, REA-0002...

    const created = await this.prisma.reassureur.create({
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
        freeFields: dto.freeFields ?? {},
        contacts: dto.contacts ? { create: dto.contacts } : undefined,
        bankAccounts: dto.bankAccounts ? { create: dto.bankAccounts } : undefined,
      },
      include: { contacts: true, bankAccounts: true },
    });

    if (missingSwiftFlag) {
      await this.prisma.auditLog.create({
        data: {
          action: 'MISSING_SWIFT_NON_RESIDENT',
          entityType: 'REASSUREUR',
          entityId: created.id,
          after: { raisonSociale: dto.raisonSociale, compteComptable: dto.compteComptable },
        },
      });
    }

    return created;
  }

  /**
   * Bulk import from a parsed Excel/CSV file — mirrors CedantesService.bulkImport()
   * exactly: rows processed one at a time (no wrapping transaction) so one bad row
   * never rolls back the good ones; per-row success/failure report returned.
   * Re-applies create()'s uniqueness rules (compteComptable, identifiantUnique, rne)
   * plus the resident-requires-identifiantUnique rule, plus in-file duplicate
   * detection. Deliberately excludes bankAccounts (same as Cedante's bulkImport),
   * so the non-resident-missing-SWIFT flag from create() does not apply here —
   * bulk-imported reassureurs without bank data yet can have accounts added via
   * update() afterward, same as Cedante's contacts/bankAccounts.
   */
  async bulkImport(items: BulkImportReassureurItemDto[]) {
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
        const existingCompte = await this.prisma.reassureur.findUnique({
          where: { compteComptable: dto.compteComptable },
        });
        if (existingCompte) {
          throw new ConflictException(`Compte comptable ${dto.compteComptable} déjà utilisé`);
        }

        if (dto.identifiantUnique) {
          if (seenIdentifiants.has(dto.identifiantUnique)) {
            throw new ConflictException(`Identifiant unique ${dto.identifiantUnique} en doublon dans le fichier importé`);
          }
          const existingIdentifiant = await this.prisma.reassureur.findUnique({
            where: { identifiantUnique: dto.identifiantUnique },
          });
          if (existingIdentifiant) {
            throw new ConflictException(`Identifiant unique ${dto.identifiantUnique} déjà utilisé`);
          }
        }

        // FIX: rne is non-unique on Reassureur (mostly-foreign entities — see
        // create()'s comment), so this is in-file dedup only, not a DB uniqueness
        // check. Mirrors create()'s use of findFirst instead of findUnique.
        if (dto.rne) {
          if (seenRnes.has(dto.rne)) {
            throw new ConflictException(`RNE ${dto.rne} en doublon dans le fichier importé`);
          }
          seenRnes.add(dto.rne);
        }

        if (dto.resident && !dto.identifiantUnique) {
          throw new BadRequestException(
            'Identifiant unique obligatoire pour les réassureurs tunisiens (resident = true)',
          );
        }

        const code = await this.sequence.next('REASSUREUR');
        const created = await this.prisma.reassureur.create({
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

  /**
   * Bulk edit — mirrors CedantesService.bulkUpdate() exactly. Same limited,
   * conflict-free field set (pays, formeJuridique, isActive); compteComptable stays
   * permanently locked, and identifiantUnique/resident/rne stay excluded for the
   * same cross-field-rule reason documented in Cedante's version.
   */
  async bulkUpdate(ids: string[], dto: BulkUpdateReassureursDataDto) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Aucun réassureur sélectionné');
    }

    const data: any = {};
    if (dto.pays !== undefined) data.pays = dto.pays;
    if (dto.formeJuridique !== undefined) data.formeJuridique = dto.formeJuridique;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Aucune modification fournie');
    }

    const result = await this.prisma.reassureur.updateMany({
      where: { id: { in: ids } },
      data,
    });

    return { updated: result.count };
  }

  /**
   * Bulk deactivate — reuses remove()'s exact rule (block if active
   * AffaireReassureur participations exist) but processed per-id so one blocked
   * reassureur doesn't prevent deactivating the rest of the selection.
   */
  async bulkDelete(ids: string[], userId?: string) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('Aucun réassureur sélectionné');
    }

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const id of ids) {
      try {
        const exists = await this.prisma.reassureur.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Réassureur introuvable');

        const activeParticipations = await this.prisma.affaireReassureur.count({
          where: { reassureurId: id },
        });
        if (activeParticipations > 0) {
          throw new BadRequestException(
            `${activeParticipations} participation(s) active(s) empêchent la désactivation`,
          );
        }

        await this.prisma.reassureur.update({ where: { id }, data: { isActive: false } });
        if (userId) {
          await this.prisma.auditLog.create({
            data: {
              userId,
              action: 'BULK_DEACTIVATE',
              entityType: 'REASSUREUR',
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

  async update(id: string, dto: UpdateReassureurDto) {
    const existing = await this.findOne(id);

    if (dto.rne && dto.rne !== existing.rne) {
      const conflict = await this.prisma.reassureur.findFirst({ where: { rne: dto.rne } });
      if (conflict) throw new ConflictException(`RNE ${dto.rne} déjà utilisé par une autre entité`);
    }

    if (dto.identifiantUnique && dto.identifiantUnique !== existing.identifiantUnique) {
      const conflict = await this.prisma.reassureur.findUnique({
        where: { identifiantUnique: dto.identifiantUnique },
      });
      if (conflict) {
        throw new ConflictException(
          `Identifiant unique ${dto.identifiantUnique} déjà utilisé par une autre entité`,
        );
      }
    }

    const resident = dto.resident ?? existing.resident;
    if (resident && !(dto.identifiantUnique ?? existing.identifiantUnique)) {
      throw new BadRequestException(
        'Identifiant unique obligatoire pour les réassureurs tunisiens (resident = true)',
      );
    }

    // FIX: same non-blocking SWIFT flag as create() — see rationale above.
    let missingSwiftFlag = false;
    if (!resident && dto.bankAccounts?.length) {
      missingSwiftFlag = dto.bankAccounts.some((b) => !b.swift);
    }

    // FIX: single atomic nested write (deleteMany + create) instead of two separate
    // round-trips — see CedantesService.update() for the same rationale.
    const updated = await this.prisma.reassureur.update({
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

    if (missingSwiftFlag) {
      await this.prisma.auditLog.create({
        data: {
          action: 'MISSING_SWIFT_NON_RESIDENT',
          entityType: 'REASSUREUR',
          entityId: id,
          after: { raisonSociale: updated.raisonSociale, compteComptable: updated.compteComptable },
        },
      });
    }

    return updated;
  }

  async remove(id: string, userId?: string) {
    const existing = await this.findOne(id);

    const activeParticipations = await this.prisma.affaireReassureur.count({
      where: { reassureurId: id },
    });
    if (activeParticipations > 0) {
      throw new BadRequestException(
        `Impossible de désactiver: ${activeParticipations} participation(s) active(s) existent pour ce réassureur`,
      );
    }

    const updated = await this.prisma.reassureur.update({
      where: { id },
      data: { isActive: false },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'DEACTIVATE',
          entityType: 'REASSUREUR',
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
   * FIX: now bumps the underlying Sequence counter via sequence.bump() — see
   * SequenceService.bump() for rationale.
   */
  async overrideCode(id: string, newCode: string, userId: string) {
    const existing = await this.findOne(id);

    if (!/^REA-[0-9]{4}$/.test(newCode)) {
      throw new BadRequestException('Le code doit être au format REA-XXXX');
    }

    const conflict = await this.prisma.reassureur.findUnique({ where: { code: newCode } });
    if (conflict) {
      throw new ConflictException(`Le code ${newCode} est déjà utilisé`);
    }

    const oldCode = existing.code;

    const updated = await this.prisma.reassureur.update({
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
        entityType: 'REASSUREUR',
        entityId: id,
        before: { code: oldCode },
        after: { code: newCode },
      },
    });

    const match = newCode.match(/-([0-9]{4})$/);
    if (match) {
      await this.sequence.bump('REASSUREUR', parseInt(match[1], 10));
    }

    return updated;
  }
}