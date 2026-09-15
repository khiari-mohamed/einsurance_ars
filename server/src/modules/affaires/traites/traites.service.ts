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
  TraiteLiquidationStatut,
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
import { PersistLiquidationDto } from './dto/persist-liquidation.dto';
@Injectable()
export class TraitesService {
  private readonly logger = new Logger(TraitesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: TreatyCalculatorService,
    private readonly notification: NotificationService,
    private readonly pdf: PdfService,
  ) {}

  async findAll(filters: {
    cedanteId?: string;
    reassuranceType?: string;
    periodicite?: Periodicite;
    statut?: AffaireStatut;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { cedanteId, reassuranceType, periodicite, statut, search, page = 1, limit = 20 } = filters;
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
          { referenceTraite: { contains: search, mode: 'insensitive' } },
          { branche: { contains: search, mode: 'insensitive' } },
          { affaire: { numero: { contains: search, mode: 'insensitive' } } },
          { affaire: { cedante: { raisonSociale: { contains: search, mode: 'insensitive' } } } },
        ],
      }),
    };

    const [data, total] = await Promise.all([
      this.prisma.traiteAffaire.findMany({
        where,
        include: {
          affaire: {
            include: {
              cedante: { select: { id: true, code: true, raisonSociale: true } },
              reassureurs: { include: { reassureur: { select: { id: true, code: true, raisonSociale: true } } } },
            },
          },
          accountRubriques: { orderBy: { ordre: 'asc' } },
          pmdInstalments: { orderBy: { numeroTranche: 'asc' } },
          _count: { select: { situations: true } },
        },
        skip, take: limit,
        orderBy: { affaire: { createdAt: 'desc' } },
      }),
      this.prisma.traiteAffaire.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(affaireId: string) {
    const traite = await this.prisma.traiteAffaire.findUnique({
      where: { affaireId },
      include: {
        affaire: {
          include: {
            cedante: true,
            reassureurs: { include: { reassureur: { include: { bankAccounts: { where: { isDefault: true } } } } } },
          },
        },
        accountRubriques: { orderBy: { ordre: 'asc' } },
        pmdInstalments: { orderBy: { numeroTranche: 'asc' } },
        situations: { orderBy: { createdAt: 'desc' }, take: 5, include: { _count: { select: { lines: true } } } },
      },
    });

    if (!traite) throw new NotFoundException('Traité introuvable');
    return traite;
  }

  async create(dto: CreateTraiteDto) {
    const affaire = await this.prisma.affaire.findUnique({ where: { id: dto.affaireId } });

    if (!affaire || !affaire.isActive) throw new NotFoundException('Affaire introuvable');
    if (affaire.type !== AffaireType.TRAITE) throw new BadRequestException("L'affaire doit être de type TRAITE");

    const existing = await this.prisma.traiteAffaire.findUnique({ where: { affaireId: dto.affaireId } });
    if (existing) throw new ConflictException('Des données de traité existent déjà pour cette affaire');

    this.assertDateOrder(dto.dateEffet, dto.dateEcheance);

    const dateEffet = new Date(dto.dateEffet);

    let pmdInstalmentsData: Array<{ numeroTranche: number; dateEcheance: Date; montant: number; tauxDeduction?: number }> = [];

    if (dto.pmdInstalments?.length) {
      pmdInstalmentsData = dto.pmdInstalments.map((p) => ({
        numeroTranche: p.numeroTranche,
        dateEcheance: new Date(p.dateEcheance),
        montant: p.montant,
        tauxDeduction: p.tauxDeduction,
      }));
    } else if (dto.pmd && dto.pmd > 0) {
      const generated = this.calculator.generatePmdInstalments(dto.pmd, dto.periodicite, dateEffet);
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
        dateAvisResiliation: dto.dateAvisResiliation ? new Date(dto.dateAvisResiliation) : undefined,
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
          ? { create: dto.accountRubriques.map((r, i) => ({ rubrique: r.rubrique, compteReference: r.compteReference, ordre: r.ordre ?? i + 1 })) }
          : undefined,
        pmdInstalments: pmdInstalmentsData.length ? { create: pmdInstalmentsData } : undefined,
      },
      include: {
        accountRubriques: { orderBy: { ordre: 'asc' } },
        pmdInstalments: { orderBy: { numeroTranche: 'asc' } },
      },
    });

    this.logger.log(`TraiteAffaire created for affaire ${dto.affaireId}`);
    return traite;
  }

  async update(affaireId: string, dto: UpdateTraiteDto) {
    const traite = await this.findOne(affaireId);

    if (traite.affaire.statut === AffaireStatut.PLACEMENT_REALISE) {
      const restrictedFields: (keyof UpdateTraiteDto)[] = [
        'formeCouverture', 'dateEffet', 'dateEcheance', 'pmd',
        'primePrevisionnelle', 'tauxCommissionCedante', 'commissionLiquidationArs',
      ];
      const hasRestricted = restrictedFields.some((f) => (dto as Record<string, unknown>)[f] !== undefined);
      if (hasRestricted) {
        throw new BadRequestException('Les champs financiers et dates ne peuvent plus être modifiés sur un traité placé');
      }
    }

    if (dto.dateEffet !== undefined || dto.dateEcheance !== undefined) {
      this.assertDateOrder(dto.dateEffet ?? traite.dateEffet.toISOString(), dto.dateEcheance ?? traite.dateEcheance.toISOString());
    }

    const updatedTraite = await this.prisma.traiteAffaire.update({
      where: { affaireId },
      data: {
        ...(dto.referenceTraite !== undefined && { referenceTraite: dto.referenceTraite }),
        ...(dto.formeCouverture !== undefined && { formeCouverture: dto.formeCouverture }),
        ...(dto.dateEffet !== undefined && { dateEffet: new Date(dto.dateEffet) }),
        ...(dto.dateEcheance !== undefined && { dateEcheance: new Date(dto.dateEcheance) }),
        ...(dto.modeRenouvellement !== undefined && { modeRenouvellement: dto.modeRenouvellement }),
        ...(dto.dateAvisResiliation !== undefined && { dateAvisResiliation: dto.dateAvisResiliation ? new Date(dto.dateAvisResiliation) : null }),
        ...(dto.zoneGeographique !== undefined && { zoneGeographique: dto.zoneGeographique }),
        ...(dto.branche !== undefined && { branche: dto.branche }),
        ...(dto.produit !== undefined && { produit: dto.produit }),
        ...(dto.garantie !== undefined && { garantie: dto.garantie }),
        ...(dto.periodicite !== undefined && { periodicite: dto.periodicite }),
        ...(dto.primePrevisionnelle !== undefined && { primePrevisionnelle: dto.primePrevisionnelle }),
        ...(dto.pmd !== undefined && { pmd: dto.pmd }),
        ...(dto.tauxCommissionCedante !== undefined && { tauxCommissionCedante: dto.tauxCommissionCedante }),
        ...(dto.commissionLiquidationArs !== undefined && { commissionLiquidationArs: dto.commissionLiquidationArs }),
        ...(dto.seuilNotification !== undefined && { seuilNotification: dto.seuilNotification }),
      },
      include: {
        accountRubriques: { orderBy: { ordre: 'asc' } },
        pmdInstalments: { orderBy: { numeroTranche: 'asc' } },
      },
    });

    if (dto.primePrevisionnelle !== undefined || dto.tauxCommissionCedante !== undefined) {
      const primeNette = updatedTraite.primePrevisionnelle
        ? Number(updatedTraite.primePrevisionnelle) * (1 - Number(updatedTraite.tauxCommissionCedante ?? 0) / 100)
        : 0;
      await this.calculateDistribution(affaireId, primeNette);
    }

    return updatedTraite;
  }
  async replaceAccountRubriques(affaireId: string, rubriques: TreatyAccountRubriqueDto[]) {
    const traite = await this.prisma.traiteAffaire.findUnique({
      where: { affaireId },
      select: { id: true, affaire: { select: { statut: true } } },
    });
    if (!traite) throw new NotFoundException('Traité introuvable');

    if (traite.affaire.statut === AffaireStatut.PLACEMENT_REALISE) {
      throw new BadRequestException(
        'Les rubriques comptables ne peuvent plus être modifiées sur un traité placé.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.treatyAccountRubrique.deleteMany({ where: { traiteId: traite.id } });

      return tx.traiteAffaire.update({
        where: { affaireId },
        data: {
          accountRubriques: {
            create: rubriques.map((r, i) => ({ rubrique: r.rubrique, compteReference: r.compteReference, ordre: r.ordre ?? i + 1 })),
          },
        },
        include: { accountRubriques: { orderBy: { ordre: 'asc' } } },
      });
    });
  }

  async getPmdInstalments(affaireId: string) {
    const traite = await this.prisma.traiteAffaire.findUnique({ where: { affaireId }, select: { id: true } });
    if (!traite) throw new NotFoundException('Traité introuvable');
    return this.prisma.pmdInstalment.findMany({ where: { traiteId: traite.id }, orderBy: { numeroTranche: 'asc' } });
  }

  async replacePmdInstalments(affaireId: string, instalments: PmdInstalmentDto[]) {
    const traite = await this.prisma.traiteAffaire.findUnique({ where: { affaireId }, select: { id: true } });
    if (!traite) throw new NotFoundException('Traité introuvable');

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pmdInstalment.findMany({ where: { traiteId: traite.id }, select: { isPaid: true } });
      if (existing.some((i) => i.isPaid)) {
        throw new BadRequestException('Impossible de remplacer intégralement le calendrier : au moins une tranche est déjà payée.');
      }

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
      throw new BadRequestException('PMD non renseigné — impossible de générer le calendrier');
    }

    const generated = this.calculator.generatePmdInstalments(Number(traite.pmd), traite.periodicite, traite.dateEffet);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pmdInstalment.findMany({ where: { traiteId: traite.id }, select: { isPaid: true } });
      if (existing.some((i) => i.isPaid)) {
        throw new BadRequestException('Impossible de régénérer le calendrier : au moins une tranche est déjà payée.');
      }

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

      return tx.pmdInstalment.findMany({ where: { traiteId: traite.id }, orderBy: { numeroTranche: 'asc' } });
    });
  }

  async markInstalmentPaid(affaireId: string, instalmentId: string) {
    const traite = await this.prisma.traiteAffaire.findUnique({
      where: { affaireId },
      include: { affaire: { select: { id: true, numero: true, cedanteId: true, currency: true } } },
    });
    if (!traite) throw new NotFoundException('Traité introuvable');

    const instalment = await this.prisma.pmdInstalment.findFirst({ where: { id: instalmentId, traiteId: traite.id } });
    if (!instalment) throw new NotFoundException('Tranche PMD introuvable');
    if (instalment.isPaid) throw new BadRequestException('Tranche déjà marquée comme payée');

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.pmdInstalment.updateMany({
        where: { id: instalmentId, isPaid: false },
        data: { isPaid: true, paidAt: new Date() },
      });
      if (claim.count === 0) {
        throw new ConflictException('Tranche déjà marquée comme payée (opération concurrente détectée)');
      }

      await tx.encaissement.create({
        data: {
          reference: `PMD-${traite.affaire.numero}-T${instalment.numeroTranche}`,
          affaireId: traite.affaire.id,
          partyType: 'CEDANTE',
          cedanteId: traite.affaire.cedanteId,
          montant: Number(instalment.montant),
          currency: traite.affaire.currency,
          description: `PMD Tranche ${instalment.numeroTranche} — ${traite.affaire.numero}`,
        },
      });

      return tx.pmdInstalment.findUniqueOrThrow({ where: { id: instalmentId } });
    });
  }

  // ── Liquidation ───────────────────────────────────────────────────

  /** Pure simulation — unchanged behavior, nothing persisted. */
  async calculateLiquidation(affaireId: string, input: LiquidationInput) {
    await this.findOne(affaireId);
    return this.calculator.calculateLiquidation(input);
  }

  /**
   * NEW: computes AND saves a TraiteLiquidation row (statut SIMULATION).
   * Does not touch Comptabilité — see class-level note.
   */
  async persistLiquidation(affaireId: string, dto: PersistLiquidationDto, userId: string) {
    const traite = await this.findOne(affaireId);

    if (new Date(dto.periodeDebut) >= new Date(dto.periodeFin)) {
      throw new BadRequestException('La période de début doit être antérieure à la période de fin');
    }

    const result = this.calculator.calculateLiquidation(dto);

    return this.prisma.traiteLiquidation.create({
      data: {
        traiteId: traite.id,
        statut: TraiteLiquidationStatut.SIMULATION,
        periodeDebut: new Date(dto.periodeDebut),
        periodeFin: new Date(dto.periodeFin),
        primesCedees: dto.primesCedees,
        participationsBenefRecues: dto.participationsBenefReçues,
        interetsSurDepots: dto.interetsSurDepots,
        sinistresPayes: dto.sinistresPayes,
        reservesConstituees: dto.reservesConstituees,
        reservesLibereesAnterieur: dto.reservesLibereesAnterieur,
        commissionCedante: dto.commissionCedante,
        commissionLiquidationArs: dto.commissionLiquidationArs,
        courtage: dto.courtage,
        taxes: dto.taxes,
        pmdDeductible: dto.pmdDeductible,
        totalDebit: result.totalDebit,
        totalCredit: result.totalCredit,
        soldeNet: result.soldeNet,
        soldeDirection: result.soldeDirection,
        createdByUserId: userId,
      },
    });
  }

  async getLiquidations(affaireId: string) {
    const traite = await this.prisma.traiteAffaire.findUnique({ where: { affaireId }, select: { id: true } });
    if (!traite) throw new NotFoundException('Traité introuvable');
    return this.prisma.traiteLiquidation.findMany({
      where: { traiteId: traite.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async validateLiquidation(affaireId: string, liquidationId: string, userId: string) {
    const traite = await this.prisma.traiteAffaire.findUnique({ where: { affaireId }, select: { id: true } });
    if (!traite) throw new NotFoundException('Traité introuvable');

    const liquidation = await this.prisma.traiteLiquidation.findFirst({
      where: { id: liquidationId, traiteId: traite.id },
    });
    if (!liquidation) throw new NotFoundException('Liquidation introuvable');
    if (liquidation.statut === TraiteLiquidationStatut.VALIDEE) {
      throw new BadRequestException('Cette liquidation est déjà validée');
    }

    return this.prisma.traiteLiquidation.update({
      where: { id: liquidationId },
      data: { statut: TraiteLiquidationStatut.VALIDEE, validatedAt: new Date(), validatedByUserId: userId },
    });
  }

  // ── Treaty distribution ──────────────────────────────────────────

  async calculateDistribution(affaireId: string, primeNetteCedante: number) {
    const traite = await this.findOne(affaireId);

    const reassureurs = traite.affaire.reassureurs.map((r) => ({
      reassureurId: r.reassureurId,
      partPct: Number(r.partPct),
      commissionMode: r.commissionMode,
      tauxCommissionArs: Number(r.tauxCommissionArs ?? 0),
      commissionForfait: r.commissionForfait ? Number(r.commissionForfait) : undefined,
    }));

    const results = this.calculator.calculateTreatyDistribution({ primeNetteCedante, reassureurs });

    await Promise.all(
      results.map((res) =>
        this.prisma.affaireReassureur.updateMany({
          where: { affaireId, reassureurId: res.reassureurId },
          data: { primeBrute: res.primeBrute, commissionArs: res.commissionArs, primeNetteReassureur: res.primeNetteReassureur },
        }),
      ),
    );

    this.logger.log(`Treaty distribution persisted for affaire ${affaireId} (${results.length} reinsurers)`);
    return results;
  }
  async getRenewalsAlert(daysAhead = 60) {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    const dueForRenewal = await this.prisma.traiteAffaire.findMany({
      where: {
        dateEcheance: { gte: now, lte: cutoff },
        modeRenouvellement: { not: ModeRenouvellement.RESILIATION },
        affaire: { isActive: true, statut: AffaireStatut.PLACEMENT_REALISE },
      },
      include: {
        affaire: { include: { cedante: { select: { code: true, raisonSociale: true } } } },
      },
      orderBy: { dateEcheance: 'asc' },
    });

    const notYetFlagged = dueForRenewal.filter((t) => !t.renewalReminderSent);
    if (notYetFlagged.length > 0) {
      await this.prisma.$transaction([
        this.prisma.traiteAffaire.updateMany({
          where: { id: { in: notYetFlagged.map((t) => t.id) } },
          data: { renewalReminderSent: true },
        }),
        ...notYetFlagged.map((t) =>
          this.prisma.workflowTask.create({
            data: {
              type: 'RENOUVELLEMENT_TRAITE',
              affaireId: t.affaire.id,
              description: `Renouvellement à préparer — traité ${t.affaire.numero} (${t.affaire.cedante.raisonSociale}), échéance ${t.dateEcheance.toLocaleDateString('fr-FR')}`,
              dueDate: t.dateEcheance,
            },
          }),
        ),
      ]);
      this.logger.log(`Renewal reminders created for ${notYetFlagged.length} treaty(ies)`);
    }

    return dueForRenewal;
  }

  async getStats(year?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const dateFrom = new Date(`${targetYear}-01-01`);
    const dateTo = new Date(`${targetYear}-12-31`);

    const [total, byType, pmds] = await Promise.all([
      this.prisma.traiteAffaire.count({ where: { affaire: { isActive: true, statut: AffaireStatut.PLACEMENT_REALISE } } }),
      this.prisma.traiteAffaire.groupBy({
        by: ['reassuranceType'],
        where: { dateEffet: { gte: dateFrom, lte: dateTo }, affaire: { isActive: true } },
        _count: { id: true },
        _sum: { pmd: true, primePrevisionnelle: true },
      }),
      this.prisma.pmdInstalment.aggregate({
        where: {
          traite: { affaire: { isActive: true, statut: AffaireStatut.PLACEMENT_REALISE } },
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
      pmdEcheancesAnnee: { count: pmds._count.id, totalMontant: Number(pmds._sum.montant ?? 0) },
      year: targetYear,
    };
  }

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
      traite, affaire: traite.affaire, company, situations, generatedAt: new Date().toLocaleDateString('fr-TN'),
    });
  }

  async generatePmdInvoice(affaireId: string): Promise<Buffer> {
    const traite = await this.findOne(affaireId);
    const company = await this.prisma.companyProfile.findFirst();
    return this.pdf.generateFromTemplate('pmd-invoice', {
      traite, affaire: traite.affaire, company, generatedAt: new Date().toLocaleDateString('fr-TN'),
    });
  }

  private assertDateOrder(effet?: string, echeance?: string): void {
    if (!effet || !echeance) return;
    if (new Date(effet) >= new Date(echeance)) {
      throw new BadRequestException('La date d\'effet doit être antérieure à la date d\'échéance');
    }
  }
}