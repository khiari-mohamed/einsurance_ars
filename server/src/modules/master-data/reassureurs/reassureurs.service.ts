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

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
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
    // --- UNIQUENESS CHECKS ---
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

    // --- BUSINESS RULE: identifiantUnique required for Tunisian entities ---
    if (dto.resident && !dto.identifiantUnique) {
      throw new BadRequestException(
        'Identifiant unique obligatoire pour les réassureurs tunisiens (resident = true)',
      );
    }

    // --- BUSINESS RULE: SWIFT required for non-resident (foreign) reinsurers ---
    if (!dto.resident && dto.bankAccounts) {
      const missingSwift = dto.bankAccounts.some((b) => !b.swift);
      if (missingSwift) {
        throw new BadRequestException(
          'Code SWIFT obligatoire pour les réassureurs non-résidents (resident = false)',
        );
      }
    }

    // --- GENERATE CODE ---
    const code = await this.sequence.next('REASSUREUR'); // returns REA-0001, REA-0002...

    // --- CREATE ---
    return this.prisma.reassureur.create({
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

  async update(id: string, dto: UpdateReassureurDto) {
    // --- VERIFY EXISTS ---
    const existing = await this.findOne(id);

    // --- UNIQUENESS CHECKS FOR UPDATED FIELDS ---
    if (dto.rne && dto.rne !== existing.rne) {
      const conflict = await this.prisma.reassureur.findFirst({
        where: { rne: dto.rne },
      });
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

    // --- BUSINESS RULE: identifiantUnique required if resident becomes true ---
    const resident = dto.resident ?? existing.resident;
    const identifiantUnique = dto.identifiantUnique ?? existing.identifiantUnique;
    if (resident && !identifiantUnique) {
      throw new BadRequestException(
        'Identifiant unique obligatoire pour les réassureurs tunisiens (resident = true)',
      );
    }

    // --- BUSINESS RULE: SWIFT required for non-resident ---
    if (!resident && dto.bankAccounts) {
      const missingSwift = dto.bankAccounts.some((b) => !b.swift);
      if (missingSwift) {
        throw new BadRequestException(
          'Code SWIFT obligatoire pour les réassureurs non-résidents (resident = false)',
        );
      }
    }

    // --- HANDLE CONTACTS (delete & recreate) ---
    if (dto.contacts !== undefined) {
      await this.prisma.contact.deleteMany({ where: { reassureurId: id } });
    }

    // --- HANDLE BANK ACCOUNTS (delete & recreate) ---
    if (dto.bankAccounts !== undefined) {
      await this.prisma.bankAccount.deleteMany({ where: { reassureurId: id } });
    }

    // --- UPDATE ---
    return this.prisma.reassureur.update({
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
        ...(dto.contacts && { contacts: { create: dto.contacts } }),
        ...(dto.bankAccounts && { bankAccounts: { create: dto.bankAccounts } }),
      },
      include: { contacts: true, bankAccounts: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Check for active participations before deactivating
    const activeParticipations = await this.prisma.affaireReassureur.count({
      where: { reassureurId: id },
    });
    if (activeParticipations > 0) {
      throw new BadRequestException(
        `Impossible de désactiver: ${activeParticipations} participation(s) active(s) existent pour ce réassureur`,
      );
    }

    // Soft delete: set inactive
    return this.prisma.reassureur.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * ADMIN ONLY: Allow super admin to modify the auto-generated code.
   * This advances the sequence ONLY if the new code is a valid next value.
   * If it's a manual override (not following the pattern), do NOT advance the sequence.
   */
  async overrideCode(id: string, newCode: string, userId: string) {
    const existing = await this.findOne(id);

    // Validate code format (REA-XXXX)
    if (!/^REA-[0-9]{4}$/.test(newCode)) {
      throw new BadRequestException('Le code doit être au format REA-XXXX');
    }

    // Check if code already exists
    const conflict = await this.prisma.reassureur.findUnique({
      where: { code: newCode },
    });
    if (conflict) {
      throw new ConflictException(`Le code ${newCode} est déjà utilisé`);
    }

    // Store old code before update
    const oldCode = existing.code;

    // Update with audit trail
    const updated = await this.prisma.reassureur.update({
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
        entityType: 'REASSUREUR',
        entityId: id,
        before: { code: oldCode },
        after: { code: newCode },
      },
    });

    return updated;
  }
}