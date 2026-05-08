import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { SequenceService } from '../../../shared/services/sequence.service';
import { CreateAssureDto } from './dto/create-assure.dto';
import { UpdateAssureDto } from './dto/update-assure.dto';

@Injectable()
export class AssuresService {
  constructor(private prisma: PrismaService, private sequence: SequenceService) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { raisonSociale: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { rne: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.assure.findMany({ where, include: { contacts: true }, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.assure.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const assure = await this.prisma.assure.findUnique({
      where: { id },
      include: {
        contacts: true,
        facultatives: { include: { affaire: { include: { cedante: true } } }, take: 10 },
      },
    });
    if (!assure) throw new NotFoundException('Assuré introuvable');
    return assure;
  }

  async create(dto: CreateAssureDto) {
    if (dto.rne) {
      const existing = await this.prisma.assure.findUnique({ where: { rne: dto.rne } });
      if (existing) throw new ConflictException('RNE déjà utilisé');
    }
    const code = await this.sequence.next('ASSURE');
    return this.prisma.assure.create({
      data: {
        code,
        raisonSociale: dto.raisonSociale,
        rne: dto.rne,
        formeJuridique: dto.formeJuridique,
        adresse: dto.adresse,
        pays: dto.pays,
        capital: dto.capital,
        freeFields: dto.freeFields ?? {},
        contacts: dto.contacts ? { create: dto.contacts } : undefined,
      },
      include: { contacts: true },
    });
  }

  async update(id: string, dto: UpdateAssureDto) {
    await this.findOne(id);
    if (dto.contacts !== undefined)
      await this.prisma.contact.deleteMany({ where: { assureId: id } });
    return this.prisma.assure.update({
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
      },
      include: { contacts: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.assure.update({ where: { id }, data: { isActive: false } });
  }
}