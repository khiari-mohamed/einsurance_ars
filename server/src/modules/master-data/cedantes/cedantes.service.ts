import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateCedanteDto } from './dto/create-cedante.dto';
import { UpdateCedanteDto } from './dto/update-cedante.dto';

@Injectable()
export class CedantesService {
  constructor(private prisma: PrismaService, private sequence: SequenceService) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { raisonSociale: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { compteComptable: { contains: search } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.cedante.findMany({
        where, include: { contacts: true, bankAccounts: true },
        skip, take: limit, orderBy: { createdAt: 'desc' },
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
        affaires: { where: { isActive: true }, take: 10, orderBy: { createdAt: 'desc' } },
        auxiliaryAccounts: true,
      },
    });
    if (!c) throw new NotFoundException('Cédante introuvable');
    return c;
  }

  async create(dto: CreateCedanteDto) {
    const [ec, er] = await Promise.all([
      this.prisma.cedante.findUnique({ where: { compteComptable: dto.compteComptable } }),
      dto.rne ? this.prisma.cedante.findUnique({ where: { rne: dto.rne } }) : null,
    ]);
    if (ec) throw new ConflictException('Compte comptable déjà utilisé');
    if (er) throw new ConflictException('RNE déjà utilisé');

    const code = await this.sequence.next('CEDANTE');
    return this.prisma.cedante.create({
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

  async update(id: string, dto: UpdateCedanteDto) {
    await this.findOne(id);
    if (dto.contacts !== undefined)
      await this.prisma.contact.deleteMany({ where: { cedanteId: id } });
    if (dto.bankAccounts !== undefined)
      await this.prisma.bankAccount.deleteMany({ where: { cedanteId: id } });
    return this.prisma.cedante.update({
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
    const active = await this.prisma.affaire.count({ where: { cedanteId: id, isActive: true } });
    if (active > 0)
      throw new BadRequestException('Impossible de supprimer: des affaires actives existent pour cette cédante');
    return this.prisma.cedante.update({ where: { id }, data: { isActive: false } });
  }
}