import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateTreatyParameterVersionDto } from './dto/create-parameter-version.dto';
import { UpdateTreatyParameterVersionDto } from './dto/update-parameter-version.dto';
import { RenewTreatyParameterVersionDto } from './dto/renew-parameter-version.dto';

@Injectable()
export class TreatyParametersService {
  constructor(private prisma: PrismaService) {}

  private async getTraiteOrThrow(affaireId: string) {
    const traite = await this.prisma.traiteAffaire.findUnique({
      where: { affaireId },
      select: { id: true },
    });
    if (!traite) throw new NotFoundException('Traité introuvable');
    return traite;
  }

  async getActive(affaireId: string) {
    const traite = await this.getTraiteOrThrow(affaireId);
    const active = await this.prisma.treatyParameterVersion.findFirst({
      where: { traiteId: traite.id, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!active) {
      throw new NotFoundException("Aucune version de paramètres active — créez la version initiale");
    }
    return active;
  }

  async getHistory(affaireId: string) {
    const traite = await this.getTraiteOrThrow(affaireId);
    return this.prisma.treatyParameterVersion.findMany({
      where: { traiteId: traite.id },
      orderBy: { version: 'desc' },
    });
  }

  async createInitial(affaireId: string, dto: CreateTreatyParameterVersionDto, userId?: string) {
    const traite = await this.getTraiteOrThrow(affaireId);

    const existing = await this.prisma.treatyParameterVersion.findFirst({
      where: { traiteId: traite.id },
    });
    if (existing) {
      throw new ConflictException(
        'Une version de paramètres existe déjà pour ce traité — utilisez la modification ou le renouvellement',
      );
    }

    this.assertDateOrder(dto.dateDebut, dto.dateFin);

    return this.prisma.treatyParameterVersion.create({
      data: {
        traiteId: traite.id,
        version: 1,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        tauxCommissionCedante: dto.tauxCommissionCedante,
        tauxCommissionCourtage: dto.tauxCommissionCourtage,
        plafondGarantie: dto.plafondGarantie,
        franchiseAbsolue: dto.franchiseAbsolue,
        franchiseRelative: dto.franchiseRelative,
        clauseParticuliere: dto.clauseParticuliere,
        motifModification: dto.motifModification ?? 'Version initiale',
        isActive: true,
        createdByUserId: userId,
      },
    });
  }

  /** Archive the current active version and create a new one on top of it.
   * Every unspecified field carries forward from the version being
   * superseded — this is a full "next version", not a delta patch. */
  async supersede(affaireId: string, dto: UpdateTreatyParameterVersionDto, userId?: string) {
    const traite = await this.getTraiteOrThrow(affaireId);
    const active = await this.prisma.treatyParameterVersion.findFirst({
      where: { traiteId: traite.id, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!active) {
      throw new NotFoundException('Aucune version active à modifier — créez la version initiale');
    }

    const dateDebut = dto.dateDebut ?? active.dateDebut.toISOString();
    const dateFin = dto.dateFin ?? active.dateFin.toISOString();
    this.assertDateOrder(dateDebut, dateFin);

    return this.prisma.$transaction(async (tx) => {
      await tx.treatyParameterVersion.update({
        where: { id: active.id },
        data: { isActive: false },
      });

      return tx.treatyParameterVersion.create({
        data: {
          traiteId: traite.id,
          version: active.version + 1,
          dateDebut: new Date(dateDebut),
          dateFin: new Date(dateFin),
          tauxCommissionCedante: dto.tauxCommissionCedante ?? active.tauxCommissionCedante,
          tauxCommissionCourtage: dto.tauxCommissionCourtage ?? active.tauxCommissionCourtage,
          plafondGarantie: dto.plafondGarantie ?? active.plafondGarantie,
          franchiseAbsolue: dto.franchiseAbsolue ?? active.franchiseAbsolue,
          franchiseRelative: dto.franchiseRelative ?? active.franchiseRelative,
          clauseParticuliere: dto.clauseParticuliere ?? active.clauseParticuliere,
          motifModification: dto.motifModification,
          isActive: true,
          createdByUserId: userId,
        },
      });
    });
  }

  /** Renewal — same archive+create mechanics as supersede(), but with
   * sensible period defaults (next day → +1 year) instead of requiring the
   * caller to always specify dates, and a default motif. */
  async renew(affaireId: string, dto: RenewTreatyParameterVersionDto, userId?: string) {
    const traite = await this.getTraiteOrThrow(affaireId);
    const active = await this.prisma.treatyParameterVersion.findFirst({
      where: { traiteId: traite.id, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!active) {
      throw new NotFoundException('Aucune version active — créez la version initiale avant de renouveler');
    }

    const defaultStart = new Date(active.dateFin);
    defaultStart.setDate(defaultStart.getDate() + 1);
    const dateDebut = dto.dateDebut ?? defaultStart.toISOString();

    const defaultEnd = new Date(dateDebut);
    defaultEnd.setFullYear(defaultEnd.getFullYear() + 1);
    defaultEnd.setDate(defaultEnd.getDate() - 1);
    const dateFin = dto.dateFin ?? defaultEnd.toISOString();

    this.assertDateOrder(dateDebut, dateFin);

    return this.prisma.$transaction(async (tx) => {
      await tx.treatyParameterVersion.update({
        where: { id: active.id },
        data: { isActive: false },
      });

      return tx.treatyParameterVersion.create({
        data: {
          traiteId: traite.id,
          version: active.version + 1,
          dateDebut: new Date(dateDebut),
          dateFin: new Date(dateFin),
          tauxCommissionCedante: dto.tauxCommissionCedante ?? active.tauxCommissionCedante,
          tauxCommissionCourtage: dto.tauxCommissionCourtage ?? active.tauxCommissionCourtage,
          plafondGarantie: dto.plafondGarantie ?? active.plafondGarantie,
          franchiseAbsolue: dto.franchiseAbsolue ?? active.franchiseAbsolue,
          franchiseRelative: dto.franchiseRelative ?? active.franchiseRelative,
          clauseParticuliere: dto.clauseParticuliere ?? active.clauseParticuliere,
          motifModification: dto.motifModification ?? 'Renouvellement du traité',
          isActive: true,
          createdByUserId: userId,
        },
      });
    });
  }

  private assertDateOrder(debut: string, fin: string): void {
    if (new Date(debut) >= new Date(fin)) {
      throw new BadRequestException('La date de début doit être antérieure à la date de fin');
    }
  }
}