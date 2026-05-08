import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateReassureurDto } from './dto/create-reassureur.dto';
import { UpdateReassureurDto } from './dto/update-reassureur.dto';

@Injectable()
export class ReassureursService {
  constructor(private prisma: PrismaService, private sequence: SequenceService) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { raisonSociale: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { pays: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.reassureur.findMany({ where, include: { contacts: true, bankAccounts: true }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
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
        participations: { include: { affaire: { include: { cedante: true } } }, take: 10 },
        auxiliaryAccounts: true,
      },
    });
    if (!r) throw new NotFoundException('Réassureur introuvable');
    return r;
  }

  async create(dto: CreateReassureurDto) {
    // Check if compte comptable already exists
    const existingCompte = await this.prisma.reassureur.findUnique({ 
      where: { compteComptable: dto.compteComptable } 
    });
    if (existingCompte) throw new ConflictException('Compte comptable déjà utilisé');

    // Check if RNE already exists (only if provided)
    if (dto.rne) {
      const existingRne = await this.prisma.reassureur.findFirst({ 
        where: { rne: dto.rne } 
      });
      if (existingRne) throw new ConflictException('RNE déjà utilisé');
    }

    const code = await this.sequence.next('REASSUREUR');
    return this.prisma.reassureur.create({
      data: {
        code,
        compteComptable: dto.compteComptable,
        isAccountLocked: true,
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

  async update(id: string, dto: UpdateReassureurDto) {
    await this.findOne(id);
    if (dto.contacts !== undefined) await this.prisma.contact.deleteMany({ where: { reassureurId: id } });
    if (dto.bankAccounts !== undefined) await this.prisma.bankAccount.deleteMany({ where: { reassureurId: id } });
    return this.prisma.reassureur.update({
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
    const active = await this.prisma.affaireReassureur.count({ where: { reassureurId: id } });
    if (active > 0) throw new BadRequestException('Impossible de supprimer: des participations actives existent');
    return this.prisma.reassureur.update({ where: { id }, data: { isActive: false } });
  }
}