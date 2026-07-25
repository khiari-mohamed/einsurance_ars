import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import {
  AffaireType,
  AffaireStatut,
  ModeRenouvellement,
  Periodicite,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { PdfService } from '../../../shared/services/pdf.service';
import {
  TreatyCalculatorService,
  LiquidationInput,
} from './treaty-calculator.service';
import {
  CreateTraiteDto,
  TreatyAccountRubriqueDto,
  PmdInstalmentDto,
} from './dto/create-traite.dto';
import { UpdateTraiteDto } from './dto/update-traite.dto';

@Injectable()
export class TraitesService {
  private readonly logger = new Logger(TraitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: TreatyCalculatorService,
    private readonly notification: NotificationService,
    private readonly pdf: PdfService,
  ) {}

  // ── List ─────────────────────────────────────────────────────────

  async findAll(filters: {
    cedanteId?: string;
    reassuranceType?: string;
    periodicite?: Periodicite;
    statut?: AffaireStatut;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      cedanteId,
      reassuranceType,
      periodicite,
      statut,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;

    const where: any = {
      affaire: {
        isActive: true,
        type: AffaireType.TRAITE,
        ...(cedanteId && { cedanteId }),
        ...(statut && { statut }),
      },
      ...(reassuranceType && { reassuranceType }),
      ...(periodicite && { periodicite }),
      ...(search && {
        OR: [
          {
            referenceTraite: { contains: search, mode: 'insensitive' },
          },
          {
            branche: { contains: search, mode: 'insensitive' },
          },
          {
            affaire: {
              numero: { contains: search, mode: 'insensitive' },
            },
          },
          {
            affaire: {
              cedante: {
                raisonSociale: { contains: search, mode: 'insensitive' },
              },
            },
          },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.traiteAffaire.findMany({
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
          accountRubriques: { orderBy: { ordre: 'asc' } },
          pmdInstalments: { orderBy: { numeroTranche: 'asc' } },
          _count: { select: { situations: true } },
        },
        skip,
        take: limit,
        orderBy: { affaire: { createdAt: 'desc' } },
      }),
      this.prisma.traiteAffaire.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ── Find one ─────────────────────────────────────────────────────

  async findOne(affaireId: string) {
    const traite = await this.prisma.traiteAffaire.findUnique({
      where: { affaireId },
      include: {
        affaire: {
          include: {
            cedante: true,
            reassureurs: {
              include: {
                reassureur: {
                  include: { bankAccounts: { where: { isDefault: true } } },
                },
              },
            },
          },
        },
        accountRubriques: { orderBy: { ordre: 'asc' } },
        pmdInstalments: { orderBy: { numeroTranche: 'asc' } },
        situations: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            _count: { select: { lines: true } },
          },
        },
      },
    });

    if (!traite) throw new NotFoundException('Traité introuvable');
    return traite;
  }

  // ── Create ───────────────────────────────────────────────────────

  async create(dto: CreateTraiteDto) {
    const affaire = await this.prisma.affaire.findUnique({
      where: { id: dto.affaireId },
    });

    if (!affaire || !affaire.isActive) {
      throw new NotFoundException('Affaire introuvable');
    }
    if (affaire.type !== AffaireType.TRAITE) {
      throw new BadRequestException(
        "L'affaire doit être de type TRAITE",
      );
    }

    const existing = await this.prisma.traiteAffaire.findUnique({
      where: { affaireId: dto.affaireId },
    });
    if (existing) {
      throw new ConflictException(
        'Des données de traité existent déjà pour cette affaire',
      );
    }

    // FIX (Traités pass): dateEffet/dateEcheance order was never validated —
    // mirrors the guard AffairesService and FacultativeService both have.
    this.assertDateOrder(dto.dateEffet, dto.dateEcheance);

    const dateEffet = new Date(dto.dateEffet);

    // Auto-generate PMD instalments if PMD set but no custom schedule provided
    let pmdInstalmentsData: Array<{
      numeroTranche: number;
      dateEcheance: Date;
      montant: number;
      tauxDeduction?: number;
    }> = [];

    if (dto.pmdInstalments?.length) {
      pmdInstalmentsData = dto.pmdInstalments.map((p) => ({
        numeroTranche: p.numeroTranche,
        dateEcheance: new Date(p.dateEcheance),
        montant: p.montant,
        tauxDeduction: p.tauxDeduction,
      }));
    } else if (dto.pmd && dto.pmd > 0) {
      const generated = this.calculator.generatePmdInstalments(
        dto.pmd,
        dto.periodicite,
        dateEffet,
      );
      pmdInstalmentsData = generated.map((g) => ({
        numeroTranche: g.numeroTranche,
        dateEcheance: g.dateEcheance,
        montant: g.montantBrut,
        tauxDeduction: g.tauxDeduction,
      }));
    }

    const traite = await this.prisma.traiteAffaire.create({
      data: {
        affaireId: dto.affaireId,
        referenceTraite: dto.referenceTraite,
        reassuranceType: dto.reassuranceType,
        formeCouverture: dto.formeCouverture,
        dateEffet,
        dateEcheance: new Date(dto.dateEcheance),
        modeRenouvellement: dto.modeRenouvellement,
        dateAvisResiliation: dto.dateAvisResiliation
          ? new Date(dto.dateAvisResiliation)
          : undefined,
        zoneGeographique: dto.zoneGeographique,
        branche: dto.branche,
        produit: dto.produit,
        garantie: dto.garantie,
        periodicite: dto.periodicite,
        primePrevisionnelle: dto.primePrevisionnelle,
        pmd: dto.pmd,
        tauxCommissionCedante: dto.tauxCommissionCedante,
        commissionLiquidationArs: dto.commissionLiquidationArs,
        seuilNotification: dto.seuilNotification,
        accountRubriques: dto.accountRubriques
          ? {
              create: dto.accountRubriques.map((r, i) => ({
                rubrique: r.rubrique,
                compteReference: r.compteReference,
                ordre: r.ordre ?? i + 1,
              })),
            }
          : undefined,
        pmdInstalments: pmdInstalmentsData.length
          ? { create: pmdInstalmentsData }
          : undefined,
      },
      include: {
        accountRubriques: { orderBy: { ordre: 'asc' } },
        pmdInstalments: { orderBy: { numeroTranche: 'asc' } },
      },
    });

    this.logger.log(`TraiteAffaire created for affaire ${dto.affaireId}`);
    return traite;
  }

  // ── Update ───────────────────────────────────────────────────────

  async update(affaireId: string, dto: UpdateTraiteDto) {
    const traite = await this.findOne(affaireId);

    if (traite.affaire.statut === AffaireStatut.PLACEMENT_REALISE) {
      // Allow updates to purely operational fields (seuil, periodicite,
      // modeRenouvellement...) even when placed.
      // FIX (Traités pass): the error message below says "les champs
      // financiers et dates" but the guard previously only checked
      // formeCouverture/dateEffet/dateEcheance/pmd — primePrevisionnelle,
      // tauxCommissionCedante and commissionLiquidationArs (all financial
      // fields) were silently editable post-placement, contradicting the
      // method's own stated rule. Added them.
      const restrictedFields: (keyof UpdateTraiteDto)[] = [
        'formeCouverture',
        'dateEffet',
        'dateEcheance',
        'pmd',
        'primePrevisionnelle',
        'tauxCommissionCedante',
        'commissionLiquidationArs',
      ];
      const hasRestricted = restrictedFields.some(
        (f) => (dto as Record<string, unknown>)[f] !== undefined,
      );
      if (hasRestricted) {
        throw new BadRequestException(
          'Les champs financiers et dates ne peuvent plus être modifiés sur un traité placé',
        );
      }
    }

    // FIX (Traités pass): date order was never re-validated on update —
    // moving only one of dateEffet/dateEcheance could silently invert the
    // period. Note this branch is effectively only reachable pre-placement
    // given the guard above, but validated regardless for defense in depth
    // (e.g. a future relaxation of the placement guard).
    if (dto.dateEffet !== undefined || dto.dateEcheance !== undefined) {
      this.assertDateOrder(
        dto.dateEffet ?? traite.dateEffet.toISOString(),
        dto.dateEcheance ?? traite.dateEcheance.toISOString(),
      );
    }

    return this.prisma.traiteAffaire.update({
      where: { affaireId },
      data: {
        ...(dto.referenceTraite !== undefined && {
          referenceTraite: dto.referenceTraite,
        }),
        ...(dto.formeCouverture !== undefined && {
          formeCouverture: dto.formeCouverture,
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
        ...(dto.dateAvisResiliation !== undefined && {
          dateAvisResiliation: dto.dateAvisResiliation
            ? new Date(dto.dateAvisResiliation)
            : null,
        }),
        ...(dto.zoneGeographique !== undefined && {
          zoneGeographique: dto.zoneGeographique,
        }),
        ...(dto.branche !== undefined && { branche: dto.branche }),
        ...(dto.produit !== undefined && { produit: dto.produit }),
        ...(dto.garantie !== undefined && { garantie: dto.garantie }),
        ...(dto.periodicite !== undefined && {
          periodicite: dto.periodicite,
        }),
        ...(dto.primePrevisionnelle !== undefined && {
          primePrevisionnelle: dto.primePrevisionnelle,
        }),
        ...(dto.pmd !== undefined && { pmd: dto.pmd }),
        ...(dto.tauxCommissionCedante !== undefined && {
          tauxCommissionCedante: dto.tauxCommissionCedante,
        }),
        ...(dto.commissionLiquidationArs !== undefined && {
          commissionLiquidationArs: dto.commissionLiquidationArs,
        }),
        ...(dto.seuilNotification !== undefined && {
          seuilNotification: dto.seuilNotification,
        }),
      },
      include: {
        accountRubriques: { orderBy: { ordre: 'asc' } },
        pmdInstalments: { orderBy: { numeroTranche: 'asc' } },
      },
    });
  }

  // ── Account Rubriques ────────────────────────────────────────────

  async replaceAccountRubriques(
    affaireId: string,
    rubriques: TreatyAccountRubriqueDto[],
  ) {
    const traite = await this.prisma.traiteAffaire.findUnique({
      where: { affaireId },
      select: { id: true },
    });
    if (!traite) throw new NotFoundException('Traité introuvable');

    return this.prisma.$transaction(async (tx) => {
      await tx.treatyAccountRubrique.deleteMany({
        where: { traiteId: traite.id },
      });

      return tx.traiteAffaire.update({
        where: { affaireId },
        data: {
          accountRubriques: {
            create: rubriques.map((r, i) => ({
              rubrique: r.rubrique,
              compteReference: r.compteReference,
              ordre: r.ordre ?? i + 1,
            })),
          },
        },
        include: { accountRubriques: { orderBy: { ordre: 'asc' } } },
      });
    });
  }

  // ── PMD Instalments ──────────────────────────────────────────────

  async getPmdInstalments(affaireId: string) {
    const traite = await this.prisma.traiteAffaire.findUnique({
      where: { affaireId },
      select: { id: true },
    });
    if (!traite) throw new NotFoundException('Traité introuvable');

    return this.prisma.pmdInstalment.findMany({
      where: { traiteId: traite.id },
      orderBy: { numeroTranche: 'asc' },
    });
  }

  /**
   * FIX (Traités pass, new): full-array replace for a hand-edited PMD
   * schedule — mirrors replaceAccountRubriques()/replaceGuaranteeLines()
   * exactly. Was entirely missing; the only prior write paths were the
   * initial CreateTraiteDto.pmdInstalments and regeneratePmdInstalments()
   * (which only knows how to derive an even split from pmd/periodicite).
   * Blocks the replace if any existing tranche is already paid, since a
   * delete+recreate would orphan the Encaissement row created by
   * markInstalmentPaid() for that tranche.
   */
  async replacePmdInstalments(affaireId: string, instalments: PmdInstalmentDto[]) {
    const traite = await this.prisma.traiteAffaire.findUnique({
      where: { affaireId },
      select: { id: true },
    });
    if (!traite) throw new NotFoundException('Traité introuvable');

    const existing = await this.prisma.pmdInstalment.findMany({
      where: { traiteId: traite.id },
      select: { isPaid: true },
    });
    if (existing.some((i) => i.isPaid)) {
      throw new BadRequestException(
        'Impossible de remplacer intégralement le calendrier : au moins une tranche est déjà payée.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.pmdInstalment.deleteMany({ where: { traiteId: traite.id } });

      return tx.traiteAffaire.update({
        where: { affaireId },
        data: {
          pmdInstalments: {
            create: instalments.map((p) => ({
              numeroTranche: p.numeroTranche,
              dateEcheance: new Date(p.dateEcheance),
              montant: p.montant,
              tauxDeduction: p.tauxDeduction,
            })),
          },
        },
        include: { pmdInstalments: { orderBy: { numeroTranche: 'asc' } } },
      });
    });
  }

  async regeneratePmdInstalments(affaireId: string) {
    const traite = await this.findOne(affaireId);

    if (!traite.pmd || Number(traite.pmd) <= 0) {
      throw new BadRequestException(
        'PMD non renseigné — impossible de générer le calendrier',
      );
    }

    const generated = this.calculator.generatePmdInstalments(
      Number(traite.pmd),
      traite.periodicite,
      traite.dateEffet,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.pmdInstalment.deleteMany({ where: { traiteId: traite.id } });

      await tx.pmdInstalment.createMany({
        data: generated.map((g) => ({
          traiteId: traite.id,
          numeroTranche: g.numeroTranche,
          dateEcheance: g.dateEcheance,
          montant: g.montantBrut,
          tauxDeduction: g.tauxDeduction > 0 ? g.tauxDeduction : undefined,
        })),
      });

      return tx.pmdInstalment.findMany({
        where: { traiteId: traite.id },
        orderBy: { numeroTranche: 'asc' },
      });
    });
  }

  async markInstalmentPaid(
    affaireId: string,
    instalmentId: string,
  ) {
    const traite = await this.prisma.traiteAffaire.findUnique({
      where: { affaireId },
      include: {
        affaire: {
          select: {
            id: true,
            numero: true,
            cedanteId: true,
            currency: true,
          },
        },
      },
    });
    if (!traite) throw new NotFoundException('Traité introuvable');

    const instalment = await this.prisma.pmdInstalment.findFirst({
      where: { id: instalmentId, traiteId: traite.id },
    });
    if (!instalment)
      throw new NotFoundException('Tranche PMD introuvable');
    if (instalment.isPaid)
      throw new BadRequestException('Tranche déjà marquée comme payée');

    const updated = await this.prisma.pmdInstalment.update({
      where: { id: instalmentId },
      data: { isPaid: true, paidAt: new Date() },
    });

    // Trigger accounting entry for PMD payment
    await this.prisma.encaissement.create({
      data: {
        reference: `PMD-${traite.affaire.numero}-T${instalment.numeroTranche}`,
        affaireId: traite.affaire.id,
        partyType: 'CEDANTE',
        cedanteId: traite.affaire.cedanteId,
        montant: Number(instalment.montant),
        currency: traite.affaire.currency,
        description: `PMD Tranche ${instalment.numeroTranche} — ${traite.affaire.numero}`,
      },
    }).catch((err) => this.logger.error(`PMD payment encaissement failed: ${err.message}`));

    return updated;
  }

  // ── Liquidation calculation ──────────────────────────────────────

  async calculateLiquidation(affaireId: string, input: LiquidationInput) {
    await this.findOne(affaireId); // existence check
    return this.calculator.calculateLiquidation(input);
  }

  // ── Treaty distribution ──────────────────────────────────────────

  async calculateDistribution(affaireId: string, primeNetteCedante: number) {
    const traite = await this.findOne(affaireId);

    const reassureurs = traite.affaire.reassureurs.map((r) => ({
      reassureurId: r.reassureurId,
      partPct: Number(r.partPct),
      commissionMode: r.commissionMode,
      tauxCommissionArs: Number(r.tauxCommissionArs ?? 0),
      commissionForfait: r.commissionForfait
        ? Number(r.commissionForfait)
        : undefined,
    }));

    return this.calculator.calculateTreatyDistribution({
      primeNetteCedante,
      reassureurs,
    });
  }

  // ── Renewals ─────────────────────────────────────────────────────

  async getRenewalsAlert(daysAhead = 60) {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    return this.prisma.traiteAffaire.findMany({
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
      },
      orderBy: { dateEcheance: 'asc' },
    });
  }

  // ── Statistics ───────────────────────────────────────────────────

  async getStats(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const dateFrom = new Date(`${targetYear}-01-01`);
    const dateTo = new Date(`${targetYear}-12-31`);

    const [total, byType, pmds] = await Promise.all([
      this.prisma.traiteAffaire.count({
        where: { affaire: { isActive: true, statut: AffaireStatut.PLACEMENT_REALISE } },
      }),
      this.prisma.traiteAffaire.groupBy({
        by: ['reassuranceType'],
        where: {
          dateEffet: { gte: dateFrom, lte: dateTo },
          affaire: { isActive: true },
        },
        _count: { id: true },
        _sum: { pmd: true, primePrevisionnelle: true },
      }),
      this.prisma.pmdInstalment.aggregate({
        where: {
          traite: {
            affaire: { isActive: true, statut: AffaireStatut.PLACEMENT_REALISE },
          },
          dateEcheance: { gte: dateFrom, lte: dateTo },
        },
        _sum: { montant: true },
        _count: { id: true },
      }),
    ]);

    return {
      totalTraitesActifs: total,
      byType: byType.map((b) => ({
        type: b.reassuranceType,
        count: b._count.id,
        totalPmd: Number(b._sum.pmd ?? 0),
        totalPrimePrevisionnelle: Number(b._sum.primePrevisionnelle ?? 0),
      })),
      pmdEcheancesAnnee: {
        count: pmds._count.id,
        totalMontant: Number(pmds._sum.montant ?? 0),
      },
      year: targetYear,
    };
  }

  // ── PDF ──────────────────────────────────────────────────────────

  async generateTreatyStatement(affaireId: string): Promise<Buffer> {
    const traite = await this.findOne(affaireId);
    const company = await this.prisma.companyProfile.findFirst();

    const situations = await this.prisma.situation.findMany({
      where: { traiteId: traite.id },
      include: { lines: true, cedante: true },
      orderBy: { createdAt: 'desc' },
      take: 4,
    });

    return this.pdf.generateFromTemplate('treaty-statement', {
      traite,
      affaire: traite.affaire,
      company,
      situations,
      generatedAt: new Date().toLocaleDateString('fr-TN'),
    });
  }

  async generatePmdInvoice(affaireId: string): Promise<Buffer> {
    const traite = await this.findOne(affaireId);
    const company = await this.prisma.companyProfile.findFirst();

    return this.pdf.generateFromTemplate('pmd-invoice', {
      traite,
      affaire: traite.affaire,
      company,
      generatedAt: new Date().toLocaleDateString('fr-TN'),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────

  /** FIX (Traités pass): mirrors AffairesService/FacultativeService's own
   * guard — kept local to this service, consistent with how the same
   * duplication was handled in Pass 2. */
  private assertDateOrder(effet?: string, echeance?: string): void {
    if (!effet || !echeance) return;
    if (new Date(effet) >= new Date(echeance)) {
      throw new BadRequestException('La date d\'effet doit être antérieure à la date d\'échéance');
    }
  }
}