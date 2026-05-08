import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateCoCourtierDto } from './dto/create-co-courtier.dto';
import { UpdateCoCourtierDto } from './dto/update-co-courtier.dto';

@Injectable()
export class CoCourtierService {
  constructor(private prisma: PrismaService, private sequence: SequenceService) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { raisonSociale: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.coCourtier.findMany({ where, include: { contacts: true, bankAccounts: true }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.coCourtier.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const c = await this.prisma.coCourtier.findUnique({ where: { id }, include: { contacts: true, bankAccounts: true } });
    if (!c) throw new NotFoundException('Co-courtier introuvable');
    return c;
  }

  async create(dto: CreateCoCourtierDto) {
    const existing = await this.prisma.coCourtier.findUnique({ where: { compteComptable: dto.compteComptable } });
    if (existing) throw new ConflictException('Compte comptable déjà utilisé');
    const code = await this.sequence.next('COCOURTIER');
    return this.prisma.coCourtier.create({
      data: {
        code, compteComptable: dto.compteComptable, isAccountLocked: true,
        raisonSociale: dto.raisonSociale, rne: dto.rne, formeJuridique: dto.formeJuridique,
        adresse: dto.adresse, pays: dto.pays, capital: dto.capital, freeFields: dto.freeFields ?? {},
        contacts: dto.contacts ? { create: dto.contacts } : undefined,
        bankAccounts: dto.bankAccounts ? { create: dto.bankAccounts } : undefined,
      },
      include: { contacts: true, bankAccounts: true },
    });
  }

  async update(id: string, dto: UpdateCoCourtierDto) {
    await this.findOne(id);
    if (dto.contacts !== undefined) await this.prisma.contact.deleteMany({ where: { coCourtId: id } });
    if (dto.bankAccounts !== undefined) await this.prisma.bankAccount.deleteMany({ where: { coCourtId: id } });
    return this.prisma.coCourtier.update({
      where: { id },
      data: {
        ...(dto.raisonSociale && { raisonSociale: dto.raisonSociale }),
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
    return this.prisma.coCourtier.update({ where: { id }, data: { isActive: false } });
  }
}