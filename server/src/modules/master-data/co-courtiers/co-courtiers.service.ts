import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateCoCourtierDto } from './dto/create-co-courtier.dto';
import { UpdateCoCourtierDto } from './dto/update-co-courtier.dto';

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
        // FIX: was 'CO_COURTIER' here but 'COCOURTIER' (no underscore) in
        // overrideCode()'s AuditLog write below, in the SAME file. Normalized to
        // 'CO_COURTIER' everywhere to match the DocumentEntityType enum convention.
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

    // FIX (new): same identifiantUnique uniqueness + resident business rule now
    // applied to CoCourtier, matching Cedante/Reassureur (see note in
    // create-co-courtier.dto.ts re: schema assumption).
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

    // FIX (new): soft cross-entity duplicate-code check — see CedantesService.create().
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
        freeFields: dto.freeFields ?? {},
        contacts: dto.contacts ? { create: dto.contacts } : undefined,
        bankAccounts: dto.bankAccounts ? { create: dto.bankAccounts } : undefined,
      },
      include: { contacts: true, bankAccounts: true },
    });
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

    // FIX: single atomic nested write instead of two separate round-trips.
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

    // UNRESOLVED (flagged in review, not fixed here — no schema to hook into yet):
    // there is still no AffaireCoCourtier (or equivalent) relation, so unlike
    // Cedantes/Reassureurs this method cannot check for active deal participation
    // before deactivating. Section 5.7 says CoCourtier is structurally identical to
    // Réassureur, whose Onglet 3 is a "liste dynamique des affaires" — the same
    // relation is conceptually owed here. Add the join model + this guard together
    // once confirmed; deactivating a co-broker mid-deal today goes unguarded.

    return this.prisma.coCourtier.update({
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

    // FIX: normalized to 'CO_COURTIER' (was 'COCOURTIER', no underscore — see findOne() note above).
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