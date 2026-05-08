import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { AffaireType, AffaireStatut, ModeRenouvellement } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CommissionCalculatorService } from '../../affaires/commission-calculator.service';
import { PdfService } from '../../../shared/services/pdf.service';
import { NotificationService } from '../../../shared/services/notification.service';
import {
  CreateFacultativeDto,
  GuaranteeLineDto,
} from './dto/create-facultative.dto';
import { UpdateFacultativeDto } from './dto/update-facultative.dto';

@Injectable()
export class FacultativeService {
  private readonly logger = new Logger(FacultativeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commissionCalc: CommissionCalculatorService,
    private readonly pdf: PdfService,
    private readonly notification: NotificationService,
  ) {}

  // ── List ─────────────────────────────────────────────────────────

  async findAll(filters: {
    cedanteId?: string;
    assureId?: string;
    branche?: string;
    statut?: AffaireStatut;
    dateEffetFrom?: string;
    dateEffetTo?: string;
    modeRenouvellement?: ModeRenouvellement;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      cedanteId,
      assureId,
      branche,
      statut,
      dateEffetFrom,
      dateEffetTo,
      modeRenouvellement,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {
      affaire: {
        isActive: true,
        type: AffaireType.FACULTATIVE,
        ...(cedanteId && { cedanteId }),
        ...(statut && { statut }),
      },
      ...(assureId && { assureId }),
      ...(branche && { branche: { contains: branche, mode: 'insensitive' } }),
      ...(modeRenouvellement && { modeRenouvellement }),
      ...((dateEffetFrom || dateEffetTo) && {
        dateEffet: {
          ...(dateEffetFrom && { gte: new Date(dateEffetFrom) }),
          ...(dateEffetTo && { lte: new Date(dateEffetTo) }),
        },
      }),
      ...(search && {
        OR: [
          { numeroPoliceCedante: { contains: search, mode: 'insensitive' } },
          { branche: { contains: search, mode: 'insensitive' } },
          { garantie: { contains: search, mode: 'insensitive' } },
          {
            affaire: {
              numero: { contains: search, mode: 'insensitive' },
            },
          },
          {
            assure: {
              raisonSociale: { contains: search, mode: 'insensitive' },
            },
          },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.facultativeAffaire.findMany({
        where,
        include: {
          affaire: {
            include: {
              cedante: {
                select: { id: true, code: true, raisonSociale: true },
              },
              reassureurs: {
                include: {
                  reassureur: {
                    select: { id: true, code: true, raisonSociale: true },
                  },
                },
              },
            },
          },
          assure: {
            select: { id: true, code: true, raisonSociale: true },
          },
          guaranteeLines: { orderBy: { ordre: 'asc' } },
        },
        skip,
        take: limit,
        orderBy: { affaire: { createdAt: 'desc' } },
      }),
      this.prisma.facultativeAffaire.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Find one by affaire ID ────────────────────────────────────────

  async findOne(affaireId: string) {
    const fac = await this.prisma.facultativeAffaire.findUnique({
      where: { affaireId },
      include: {
        affaire: {
          include: {
            cedante: true,
            reassureurs: {
              include: {
                reassureur: {
                  include: {
                    bankAccounts: { where: { isDefault: true } },
                    contacts: true,
                  },
                },
              },
            },
          },
        },
        assure: { include: { contacts: true } },
        guaranteeLines: { orderBy: { ordre: 'asc' } },
      },
    });

    if (!fac) throw new NotFoundException('Affaire facultative introuvable');
    return fac;
  }

  // ── Create ───────────────────────────────────────────────────────

  async create(dto: CreateFacultativeDto) {
    const affaire = await this.prisma.affaire.findUnique({
      where: { id: dto.affaireId },
      include: { reassureurs: true },
    });

    if (!affaire || !affaire.isActive) {
      throw new NotFoundException('Affaire introuvable');
    }
    if (affaire.type !== AffaireType.FACULTATIVE) {
      throw new BadRequestException(
        "L'affaire doit être de type FACULTATIVE",
      );
    }

    const existing = await this.prisma.facultativeAffaire.findUnique({
      where: { affaireId: dto.affaireId },
    });
    if (existing) {
      throw new ConflictException(
        'Des données facultatives existent déjà pour cette affaire',
      );
    }

    const primeCedee = this.round3(dto.prime100Pct * (dto.tauxCession / 100));
    const commissionCedante = dto.tauxCommissionCedante
      ? this.round3(primeCedee * (dto.tauxCommissionCedante / 100))
      : null;

    const fac = await this.prisma.facultativeAffaire.create({
      data: {
        affaireId: dto.affaireId,
        reassuranceType: dto.reassuranceType,
        assureId: dto.assureId,
        numeroPoliceCedante: dto.numeroPoliceCedante,
        dateEffet: new Date(dto.dateEffet),
        dateEcheance: new Date(dto.dateEcheance),
        modeRenouvellement: dto.modeRenouvellement,
        paysAssure: dto.paysAssure,
        branche: dto.branche,
        produit: dto.produit,
        garantie: dto.garantie,
        prime100Pct: dto.prime100Pct,
        tauxPrime: dto.tauxPrime,
        tauxCession: dto.tauxCession,
        primeCedee,
        tauxCommissionCedante: dto.tauxCommissionCedante,
        commissionCedante,
        guaranteeLines: dto.guaranteeLines
          ? {
              create: dto.guaranteeLines.map((g, i) => ({
                garantie: g.garantie,
                capitauxAssures100: g.capitauxAssures100,
                ordre: g.ordre ?? i + 1,
              })),
            }
          : undefined,
      },
      include: {
        assure: true,
        guaranteeLines: { orderBy: { ordre: 'asc' } },
      },
    });

    // Cascade commission recalculation to already-attached reinsurers
    if (affaire.reassureurs.length > 0) {
      await this.recalculateCommissions(dto.affaireId);
    }

    this.logger.log(
      `FacultativeAffaire created for affaire ${dto.affaireId}`,
    );
    return fac;
  }

  // ── Update ───────────────────────────────────────────────────────

  async update(affaireId: string, dto: UpdateFacultativeDto) {
    const fac = await this.findOne(affaireId);

    if (fac.affaire.statut === AffaireStatut.PLACEMENT_REALISE) {
      throw new BadRequestException(
        'Une affaire placée ne peut plus être modifiée',
      );
    }

    const prime100 =
      dto.prime100Pct !== undefined ? dto.prime100Pct : Number(fac.prime100Pct);
    const tauxCession =
      dto.tauxCession !== undefined
        ? dto.tauxCession
        : Number(fac.tauxCession);
    const tauxCommCed =
      dto.tauxCommissionCedante !== undefined
        ? dto.tauxCommissionCedante
        : Number(fac.tauxCommissionCedante ?? 0);

    const primeCedee = this.round3(prime100 * (tauxCession / 100));
    const commissionCedante = tauxCommCed
      ? this.round3(primeCedee * (tauxCommCed / 100))
      : null;

    const updated = await this.prisma.facultativeAffaire.update({
      where: { affaireId },
      data: {
        ...(dto.assureId !== undefined && { assureId: dto.assureId }),
        ...(dto.numeroPoliceCedante !== undefined && {
          numeroPoliceCedante: dto.numeroPoliceCedante,
        }),
        ...(dto.dateEffet !== undefined && {
          dateEffet: new Date(dto.dateEffet),
        }),
        ...(dto.dateEcheance !== undefined && {
          dateEcheance: new Date(dto.dateEcheance),
        }),
        ...(dto.modeRenouvellement !== undefined && {
          modeRenouvellement: dto.modeRenouvellement,
        }),
        ...(dto.paysAssure !== undefined && { paysAssure: dto.paysAssure }),
        ...(dto.branche !== undefined && { branche: dto.branche }),
        ...(dto.produit !== undefined && { produit: dto.produit }),
        ...(dto.garantie !== undefined && { garantie: dto.garantie }),
        ...(dto.prime100Pct !== undefined && {
          prime100Pct: dto.prime100Pct,
          primeCedee,
        }),
        ...(dto.tauxPrime !== undefined && { tauxPrime: dto.tauxPrime }),
        ...(dto.tauxCession !== undefined && {
          tauxCession: dto.tauxCession,
          primeCedee,
        }),
        ...(dto.tauxCommissionCedante !== undefined && {
          tauxCommissionCedante: dto.tauxCommissionCedante,
          commissionCedante,
        }),
      },
      include: {
        assure: true,
        guaranteeLines: { orderBy: { ordre: 'asc' } },
        affaire: { include: { cedante: true, reassureurs: true } },
      },
    });

    await this.recalculateCommissions(affaireId);
    return updated;
  }

  // ── Guarantee lines ──────────────────────────────────────────────

  async replaceGuaranteeLines(affaireId: string, lines: GuaranteeLineDto[]) {
    const fac = await this.prisma.facultativeAffaire.findUnique({
      where: { affaireId },
      select: { id: true },
    });
    if (!fac) throw new NotFoundException('Données facultatives introuvables');

    return this.prisma.$transaction(async (tx) => {
      await tx.guaranteeLine.deleteMany({
        where: { facultativeId: fac.id },
      });

      return tx.facultativeAffaire.update({
        where: { affaireId },
        data: {
          guaranteeLines: {
            create: lines.map((g, i) => ({
              garantie: g.garantie,
              capitauxAssures100: g.capitauxAssures100,
              ordre: g.ordre ?? i + 1,
            })),
          },
        },
        include: { guaranteeLines: { orderBy: { ordre: 'asc' } } },
      });
    });
  }

  async addGuaranteeLine(affaireId: string, line: GuaranteeLineDto) {
    const fac = await this.prisma.facultativeAffaire.findUnique({
      where: { affaireId },
      select: { id: true },
    });
    if (!fac) throw new NotFoundException('Données facultatives introuvables');

    const lastLine = await this.prisma.guaranteeLine.findFirst({
      where: { facultativeId: fac.id },
      orderBy: { ordre: 'desc' },
    });

    return this.prisma.guaranteeLine.create({
      data: {
        facultativeId: fac.id,
        garantie: line.garantie,
        capitauxAssures100: line.capitauxAssures100,
        ordre: line.ordre ?? (lastLine ? lastLine.ordre + 1 : 1),
      },
    });
  }

  async removeGuaranteeLine(affaireId: string, lineId: string) {
    const fac = await this.prisma.facultativeAffaire.findUnique({
      where: { affaireId },
      select: { id: true },
    });
    if (!fac) throw new NotFoundException('Données facultatives introuvables');

    const line = await this.prisma.guaranteeLine.findFirst({
      where: { id: lineId, facultativeId: fac.id },
    });
    if (!line) throw new NotFoundException('Ligne de garantie introuvable');

    await this.prisma.guaranteeLine.delete({ where: { id: lineId } });
    return { message: 'Ligne supprimée avec succès' };
  }

  // ── Commission recalculation ─────────────────────────────────────

  async recalculateCommissions(affaireId: string) {
    const affaire = await this.prisma.affaire.findUniqueOrThrow({
      where: { id: affaireId },
      include: { facultativeData: true, reassureurs: true },
    });

    if (!affaire.facultativeData || affaire.reassureurs.length === 0) {
      return { recalculated: 0 };
    }

    const fac = affaire.facultativeData;
    const primeCedee =
      Number(fac.primeCedee) ||
      this.round3(
        Number(fac.prime100Pct) * (Number(fac.tauxCession) / 100),
      );

    if (primeCedee <= 0) return { recalculated: 0 };

    const results = this.commissionCalc.calculate({
      primeCedee,
      tauxCession: Number(fac.tauxCession) / 100,
      tauxCommissionCedante: Number(fac.tauxCommissionCedante ?? 0),
      reassureurs: affaire.reassureurs.map((r) => ({
        reassureurId: r.reassureurId,
        partPct: Number(r.partPct),
        commissionMode: r.commissionMode,
        tauxCommissionArs: Number(r.tauxCommissionArs ?? 0),
        commissionForfait: r.commissionForfait
          ? Number(r.commissionForfait)
          : undefined,
      })),
    });

    await Promise.all(
      results.map((res) =>
        this.prisma.affaireReassureur.updateMany({
          where: { affaireId, reassureurId: res.reassureurId },
          data: {
            primeBrute: res.primeBrute,
            commissionArs: res.commissionArs,
            commissionCedante: res.commissionCedante,
            primeNetteCedante: res.primeNetteCedante,
            primeNetteReassureur: res.primeNetteReassureur,
          },
        }),
      ),
    );

    this.logger.log(
      `Commissions recalculated for facultative affaire ${affaireId} (${results.length} reinsurers)`,
    );

    return { recalculated: results.length };
  }

  // ── Renewal alerts ───────────────────────────────────────────────

  async getRenewalsAlert(daysAhead = 30) {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    return this.prisma.facultativeAffaire.findMany({
      where: {
        dateEcheance: { gte: now, lte: cutoff },
        modeRenouvellement: { not: ModeRenouvellement.RESILIATION },
        affaire: {
          isActive: true,
          statut: AffaireStatut.PLACEMENT_REALISE,
        },
      },
      include: {
        affaire: {
          include: {
            cedante: { select: { code: true, raisonSociale: true } },
          },
        },
        assure: { select: { code: true, raisonSociale: true } },
      },
      orderBy: { dateEcheance: 'asc' },
    });
  }

  // ── Statistics ───────────────────────────────────────────────────

  async getStatsByBranch(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const dateFrom = new Date(`${targetYear}-01-01`);
    const dateTo = new Date(`${targetYear}-12-31`);

    const items = await this.prisma.facultativeAffaire.findMany({
      where: {
        dateEffet: { gte: dateFrom, lte: dateTo },
        affaire: { isActive: true },
      },
      select: {
        branche: true,
        primeCedee: true,
        commissionCedante: true,
      },
    });

    const grouped: Record<
  string,
  { count: number; totalPrime: number; totalCommission: number }
> = {};


    for (const item of items) {
      const key = item.branche ?? 'Non définie';
      if (!grouped[key])
        grouped[key] = { count: 0, totalPrime: 0, totalCommission: 0 };
      grouped[key].count++;
      grouped[key].totalPrime = this.round3(
        grouped[key].totalPrime + Number(item.primeCedee ?? 0),
      );
      grouped[key].totalCommission = this.round3(
        grouped[key].totalCommission + Number(item.commissionCedante ?? 0),
      );
    }

    return Object.entries(grouped)
      .map(([branche, stats]) => ({ branche, ...stats }))
      .sort((a, b) => b.totalPrime - a.totalPrime);
  }

  // ── PDF slip ─────────────────────────────────────────────────────

  async generateSlip(affaireId: string): Promise<Buffer> {
    const fac = await this.findOne(affaireId);
    const company = await this.prisma.companyProfile.findFirst();

    return this.pdf.generateFromTemplate('bordereau-cedante', {
      facultative: {
        ...fac,
        primeCedee: Number(fac.primeCedee),
        commissionCedante: Number(fac.commissionCedante ?? 0),
        prime100Pct: Number(fac.prime100Pct),
        tauxCession: Number(fac.tauxCession),
      },
      affaire: fac.affaire,
      company,
      generatedAt: new Date().toLocaleDateString('fr-TN'),
      title: 'SLIP DE COTATION FACULTATIVE',
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private round3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }
}