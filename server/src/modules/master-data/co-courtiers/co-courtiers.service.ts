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

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
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
    // Check if compte comptable already exists
    const existing = await this.prisma.coCourtier.findUnique({
      where: { compteComptable: dto.compteComptable },
    });
    if (existing) {
      throw new ConflictException(`Compte comptable ${dto.compteComptable} déjà utilisé`);
    }

    // Check RNE uniqueness if provided
    if (dto.rne) {
      const existingRne = await this.prisma.coCourtier.findFirst({
        where: { rne: dto.rne },
      });
      if (existingRne) throw new ConflictException(`RNE ${dto.rne} déjà utilisé`);
    }

    // Generate code (COCOURTIER → CCO- prefix via SequenceService)
    const code = await this.sequence.next('COCOURTIER'); // returns CCO-0001, CCO-0002...

    return this.prisma.coCourtier.create({
      data: {
        code,
        compteComptable: dto.compteComptable,
        isAccountLocked: true, // locked immediately and permanently
        raisonSociale: dto.raisonSociale,
        rne: dto.rne,
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
    // Verify exists
    const existing = await this.findOne(id);

    // Check RNE uniqueness if updated
    if (dto.rne && dto.rne !== existing.rne) {
      const conflict = await this.prisma.coCourtier.findFirst({
        where: { rne: dto.rne },
      });
      if (conflict) {
        throw new ConflictException(`RNE ${dto.rne} déjà utilisé par une autre entité`);
      }
    }

    // Handle contacts (delete & recreate)
    if (dto.contacts !== undefined) {
      await this.prisma.contact.deleteMany({ where: { coCourtId: id } });
    }

    // Handle bank accounts (delete & recreate)
    if (dto.bankAccounts !== undefined) {
      await this.prisma.bankAccount.deleteMany({ where: { coCourtId: id } });
    }

    return this.prisma.coCourtier.update({
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
        ...(dto.bankAccounts && { bankAccounts: { create: dto.bankAccounts } }),
      },
      include: { contacts: true, bankAccounts: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Check if this co-courtier is referenced in any active deals
    // Note: There is no direct relation yet — you'd need to check `AffaireReassureur` or similar
    // For now, keep the simple deactivation.
    // If you later add a relation, add the check here.

    // Soft delete: set inactive
    return this.prisma.coCourtier.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * ADMIN ONLY: Allow super admin to modify the auto-generated code.
   */
  async overrideCode(id: string, newCode: string, userId: string) {
    const existing = await this.findOne(id);

    // Validate code format (CCO-XXXX)
    if (!/^CCO-[0-9]{4}$/.test(newCode)) {
      throw new BadRequestException('Le code doit être au format CCO-XXXX');
    }

    // Check if code already exists
    const conflict = await this.prisma.coCourtier.findUnique({
      where: { code: newCode },
    });
    if (conflict) {
      throw new ConflictException(`Le code ${newCode} est déjà utilisé`);
    }

    // Store old code before update
    const oldCode = existing.code;

    // Update with audit trail
    const updated = await this.prisma.coCourtier.update({
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
        entityType: 'COCOURTIER',
        entityId: id,
        before: { code: oldCode },
        after: { code: newCode },
      },
    });

    return updated;
  }
}