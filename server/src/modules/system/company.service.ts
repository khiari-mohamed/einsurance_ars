import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private prisma: PrismaService) {}

  async getProfile() {
    return this.prisma.companyProfile.findFirst({
      include: {
        contacts: true,
        bankAccounts: true,
        freeFields: { orderBy: { ordre: 'asc' } },
      },
    });
  }

  async createOrUpdate(dto: CreateCompanyDto) {
    const existing = await this.prisma.companyProfile.findFirst();
    if (existing) return this.update(existing.id, dto);

    return this.prisma.companyProfile.create({
      data: {
        raisonSociale: dto.raisonSociale,
        adresse: dto.adresse,
        ville: dto.ville,
        codePostal: dto.codePostal,
        pays: dto.pays ?? 'Tunisie',
        formeJuridique: dto.formeJuridique,
        capitalSocial: dto.capitalSocial,
        rne: dto.rne,
        objetSocial: dto.objetSocial,
        representantsLegaux: dto.representantsLegaux ?? [],
        matriculeFiscal: dto.matriculeFiscal,
        regimeFiscal: dto.regimeFiscal,
        assujettieATVA: dto.assujettieATVA ?? false,
        tauxTVA: dto.tauxTVA,
        autresTaxes: dto.autresTaxes,
        contacts: dto.contacts ? { create: dto.contacts } : undefined,
        bankAccounts: dto.bankAccounts ? { create: dto.bankAccounts } : undefined,
        freeFields: dto.freeFields ? { create: dto.freeFields } : undefined,
      },
      include: {
        contacts: true,
        bankAccounts: true,
        freeFields: { orderBy: { ordre: 'asc' } },
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const existing = await this.prisma.companyProfile.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Profil société introuvable');

    await this.prisma.$transaction(async (tx) => {
      if (dto.contacts !== undefined)
        await tx.companyContact.deleteMany({ where: { companyId: id } });
      if (dto.bankAccounts !== undefined)
        await tx.companyBankAccount.deleteMany({ where: { companyId: id } });
      if (dto.freeFields !== undefined)
        await tx.companyFreeField.deleteMany({ where: { companyId: id } });
    });

    return this.prisma.companyProfile.update({
      where: { id },
      data: {
        ...(dto.raisonSociale && { raisonSociale: dto.raisonSociale }),
        ...(dto.adresse !== undefined && { adresse: dto.adresse }),
        ...(dto.ville !== undefined && { ville: dto.ville }),
        ...(dto.codePostal !== undefined && { codePostal: dto.codePostal }),
        ...(dto.pays !== undefined && { pays: dto.pays }),
        ...(dto.formeJuridique !== undefined && { formeJuridique: dto.formeJuridique }),
        ...(dto.capitalSocial !== undefined && { capitalSocial: dto.capitalSocial }),
        ...(dto.rne !== undefined && { rne: dto.rne }),
        ...(dto.objetSocial !== undefined && { objetSocial: dto.objetSocial }),
        ...(dto.representantsLegaux !== undefined && { representantsLegaux: dto.representantsLegaux }),
        ...(dto.matriculeFiscal !== undefined && { matriculeFiscal: dto.matriculeFiscal }),
        ...(dto.regimeFiscal !== undefined && { regimeFiscal: dto.regimeFiscal }),
        ...(dto.assujettieATVA !== undefined && { assujettieATVA: dto.assujettieATVA }),
        ...(dto.tauxTVA !== undefined && { tauxTVA: dto.tauxTVA }),
        ...(dto.autresTaxes !== undefined && { autresTaxes: dto.autresTaxes }),
        ...(dto.contacts && { contacts: { create: dto.contacts } }),
        ...(dto.bankAccounts && { bankAccounts: { create: dto.bankAccounts } }),
        ...(dto.freeFields && { freeFields: { create: dto.freeFields } }),
      },
      include: {
        contacts: true,
        bankAccounts: true,
        freeFields: { orderBy: { ordre: 'asc' } },
      },
    });
  }

  async getPasswordPolicy() {
    let policy = await this.prisma.passwordPolicy.findFirst();
    if (!policy) policy = await this.prisma.passwordPolicy.create({ data: {} });
    return policy;
  }

  async updatePasswordPolicy(data: {
    longueurMin?: number;
    requireUppercase?: boolean;
    requireNumber?: boolean;
    requireSymbol?: boolean;
    expirationJours?: number;
    maxTentatives?: number;
    dureeLockoutMinutes?: number;
  }) {
    const policy = await this.getPasswordPolicy();
    return this.prisma.passwordPolicy.update({ where: { id: policy.id }, data });
  }
}