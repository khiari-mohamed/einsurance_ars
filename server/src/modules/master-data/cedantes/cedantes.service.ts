import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateCedanteDto } from './dto/create-cedante.dto';
import { UpdateCedanteDto } from './dto/update-cedante.dto';

@Injectable()
export class CedantesService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
  ) {}

  /**
   * FIX: added `statut` param — findAll() previously hardcoded isActive: true, which
   * made it impossible to satisfy the confirmed spec (5.6.7 / audit D7 default):
   * inactive partners must stay "visible dans l'historique, non sélectionnable dans
   * les nouvelles affaires" — visible, just not selectable. Default stays 'ACTIVE' so
   * existing callers (e.g. the "select cédante for new affaire" picker) keep the same
   * behavior; pass statut: 'ALL' or 'INACTIVE' explicitly for the history view.
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
        { compteComptable: { contains: search } },
        { identifiantUnique: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.cedante.findMany({
        where,
        include: { contacts: true, bankAccounts: true },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.cedante.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const c = await this.prisma.cedante.findUnique({
      where: { id },
      include: {
        contacts: true,
        bankAccounts: true,
        affaires: {
          where: { isActive: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { reassureurs: true },
        },
        auxiliaryAccounts: true,
        documents: {
          where: { entityType: 'CEDANTE' },
          include: { document: true },
        },
      },
    });
    if (!c) throw new NotFoundException('Compagnie d\'assurances introuvable');
    return c;
  }

  async create(dto: CreateCedanteDto) {
    // --- UNIQUENESS CHECKS ---
    const [existingAccount, existingRne, existingIdentifiant] = await Promise.all([
      this.prisma.cedante.findUnique({ where: { compteComptable: dto.compteComptable } }),
      dto.rne ? this.prisma.cedante.findUnique({ where: { rne: dto.rne } }) : null,
      dto.identifiantUnique
        ? this.prisma.cedante.findUnique({ where: { identifiantUnique: dto.identifiantUnique } })
        : null,
    ]);

    if (existingAccount) {
      throw new ConflictException(`Compte comptable ${dto.compteComptable} déjà utilisé`);
    }
    if (existingRne) {
      throw new ConflictException(`RNE ${dto.rne} déjà utilisé`);
    }
    if (existingIdentifiant) {
      throw new ConflictException(`Identifiant unique ${dto.identifiantUnique} déjà utilisé`);
    }

    // --- BUSINESS RULE: identifiantUnique required for Tunisian entities ---
    // (this check now actually executes — the DTO no longer blocks the request
    // before we get here; see create-cedante.dto.ts)
    if (dto.resident && !dto.identifiantUnique) {
      throw new BadRequestException(
        'Identifiant unique obligatoire pour les entités tunisiennes (resident = true)',
      );
    }

    // FIX (new): soft cross-entity duplicate-code check (consolidated doc Section 12.2).
    // 6 known entities (GAT RE, TUNIS RE, ASTREE RE, NCA RE, UNITED INSURANCE, AON
    // LIMITED) legitimately hold a distinct code in both the 401xxxxx and 411xxxxx
    // ranges. This is NOT blocked — only logged — because we can't yet distinguish a
    // legitimate dual-code entity from an accidental duplicate at the schema level
    // (pending client decision D1: one fiche/two comptes vs two fiches).
    const [dupReassureur, dupCoCourtier] = await Promise.all([
      this.prisma.reassureur.findUnique({ where: { compteComptable: dto.compteComptable } }),
      this.prisma.coCourtier.findUnique({ where: { compteComptable: dto.compteComptable } }),
    ]);
    if (dupReassureur || dupCoCourtier) {
      await this.prisma.auditLog.create({
        data: {
          action: 'POTENTIAL_DUPLICATE_ACCOUNT_CODE',
          entityType: 'CEDANTE',
          after: {
            compteComptable: dto.compteComptable,
            raisonSociale: dto.raisonSociale,
            matchedReassureurId: dupReassureur?.id ?? null,
            matchedCoCourtierId: dupCoCourtier?.id ?? null,
          },
        },
      });
    }

    // --- GENERATE CODE ---
    const code = await this.sequence.next('CEDANTE'); // CAS-0001, CAS-0002...

    // --- CREATE ---
    return this.prisma.cedante.create({
      data: {
        code,
        compteComptable: dto.compteComptable,
        isAccountLocked: true, // locked immediately and permanently
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
  }

  async update(id: string, dto: UpdateCedanteDto) {
    // --- VERIFY EXISTS ---
    const existing = await this.findOne(id);

    // --- UNIQUENESS CHECKS FOR UPDATED FIELDS ---
    if (dto.rne && dto.rne !== existing.rne) {
      const conflict = await this.prisma.cedante.findUnique({ where: { rne: dto.rne } });
      if (conflict) throw new ConflictException(`RNE ${dto.rne} déjà utilisé par une autre entité`);
    }

    if (dto.identifiantUnique && dto.identifiantUnique !== existing.identifiantUnique) {
      const conflict = await this.prisma.cedante.findUnique({
        where: { identifiantUnique: dto.identifiantUnique },
      });
      if (conflict) {
        throw new ConflictException(
          `Identifiant unique ${dto.identifiantUnique} déjà utilisé par une autre entité`,
        );
      }
    }

    // --- BUSINESS RULE: identifiantUnique required if resident becomes true ---
    const resident = dto.resident ?? existing.resident;
    const identifiantUnique = dto.identifiantUnique ?? existing.identifiantUnique;
    if (resident && !identifiantUnique) {
      throw new BadRequestException(
        'Identifiant unique obligatoire pour les entités tunisiennes (resident = true)',
      );
    }

    // FIX: was two separate round-trips (deleteMany() then a later, separate update())
    // — if the process died between them, all contacts/bank accounts were deleted and
    // never recreated (silent data loss). Now a single nested write (deleteMany +
    // create on each relation) executed atomically in one prisma.cedante.update() call.

    // --- UPDATE ---
    return this.prisma.cedante.update({
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
  }

  async remove(id: string) {
    await this.findOne(id);

    const activeAffaires = await this.prisma.affaire.count({
      where: { cedanteId: id, isActive: true },
    });
    if (activeAffaires > 0) {
      throw new BadRequestException(
        `Impossible de désactiver: ${activeAffaires} affaire(s) active(s) existent pour cette compagnie`,
      );
    }

    return this.prisma.cedante.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * ADMIN ONLY: allow a super admin to manually override the auto-generated code.
   * FIX: now actually bumps the underlying Sequence counter forward (via
   * sequence.bump) so a future auto-generated code can never collide with the
   * manually-assigned one. Previously the docstring claimed this but the method
   * never touched the Sequence table at all.
   */
  async overrideCode(id: string, newCode: string, userId: string) {
    const existing = await this.findOne(id);

    if (!/^CAS-[0-9]{4}$/.test(newCode)) {
      throw new BadRequestException('Le code doit être au format CAS-XXXX');
    }

    const conflict = await this.prisma.cedante.findUnique({ where: { code: newCode } });
    if (conflict) {
      throw new ConflictException(`Le code ${newCode} est déjà utilisé`);
    }

    const oldCode = existing.code;

    const updated = await this.prisma.cedante.update({
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
        entityType: 'CEDANTE',
        entityId: id,
        before: { code: oldCode },
        after: { code: newCode },
      },
    });

    // FIX: bump the sequence counter so next('CEDANTE') can't walk back up and
    // collide with this manually-assigned code.
    const match = newCode.match(/-([0-9]{4})$/);
    if (match) {
      await this.sequence.bump('CEDANTE', parseInt(match[1], 10));
    }

    return updated;
  }
}