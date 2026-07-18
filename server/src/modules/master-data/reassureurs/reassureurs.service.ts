import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateReassureurDto } from './dto/create-reassureur.dto';
import { UpdateReassureurDto } from './dto/update-reassureur.dto';

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

  async remove(id: string) {
    await this.findOne(id);

    const activeParticipations = await this.prisma.affaireReassureur.count({
      where: { reassureurId: id },
    });
    if (activeParticipations > 0) {
      throw new BadRequestException(
        `Impossible de désactiver: ${activeParticipations} participation(s) active(s) existent pour ce réassureur`,
      );
    }

    return this.prisma.reassureur.update({
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