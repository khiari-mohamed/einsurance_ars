import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { AffaireStatut, AffaireType, CommissionMode, NegotiationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { CommissionCalculatorService } from './commission-calculator.service';
import { TreatyCalculatorService } from './traites/treaty-calculator.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { AffaireWorkflowService } from './workflow.service';
import { CreateAffaireDto } from './dto/create-affaire.dto';
import { UpdateAffaireDto } from './dto/update-affaire.dto';
import { CreateNegotiationDto, UpdateNegotiationDto } from './dto/negotiation.dto';

@Injectable()
export class AffairesService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private commissionCalc: CommissionCalculatorService,
    private treatyCalc: TreatyCalculatorService,
    private workflow: AffaireWorkflowService,
    private exchangeRates: ExchangeRatesService,
  ) {}

  async findAll(filters: {
    cedanteId?: string;
    assureId?: string;
    statut?: AffaireStatut;
    type?: AffaireType;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { cedanteId, assureId, statut, type, search, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (cedanteId) where.cedanteId = cedanteId;
    if (assureId) where.facultativeData = { is: { assureId } };
    if (statut) where.statut = statut;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { nom: { contains: search, mode: 'insensitive' } },
        { cedante: { raisonSociale: { contains: search, mode: 'insensitive' } } },
        { facultativeData: { assure: { raisonSociale: { contains: search, mode: 'insensitive' } } } },
        { traiteData: { referenceTraite: { contains: search, mode: 'insensitive' } } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.affaire.findMany({
        where,
        include: {
          cedante: { select: { id: true, code: true, raisonSociale: true, compteComptable: true } },
          reassureurs: { include: { reassureur: { select: { id: true, code: true, raisonSociale: true } } } },
          facultativeData: { include: { assure: true, guaranteeLines: true } },
          traiteData: { include: { accountRubriques: true, pmdInstalments: true } },
          _count: { select: { sinistres: true, bordereaux: true } },
        },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.affaire.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const a = await this.prisma.affaire.findUnique({
      where: { id },
      include: {
        cedante: true,
        reassureurs: { include: { reassureur: { include: { bankAccounts: true } } } },
        facultativeData: { include: { assure: true, guaranteeLines: { orderBy: { ordre: 'asc' } } } },
        traiteData: {
          include: {
            accountRubriques: { orderBy: { ordre: 'asc' } },
            pmdInstalments: { orderBy: { numeroTranche: 'asc' } },
          },
        },
        sinistres: { orderBy: { createdAt: 'desc' }, take: 5 },
        bordereaux: { orderBy: { createdAt: 'desc' }, take: 5 },
        workflowTasks: { where: { statut: 'EN_ATTENTE' } },
        documents: { include: { document: true } },
        negotiations: { orderBy: [{ date: 'desc' }, { round: 'desc' }] },
      },
    });
    if (!a || !a.isActive) throw new NotFoundException('Affaire introuvable');
    return a;
  }

  async create(dto: CreateAffaireDto, userId: string) {
    const roe = dto.roe ?? (dto.currency && dto.currency !== 'TND'
      ? (await this.exchangeRates.getLatestRate(dto.currency)).taux
      : dto.roe);
    // Validate type ↔ data consistency
    if (dto.type === AffaireType.FACULTATIVE && !dto.facultativeData) {
      throw new BadRequestException('facultativeData requis pour type FACULTATIVE');
    }
    if (dto.type === AffaireType.TRAITE && !dto.traiteData) {
      throw new BadRequestException('traiteData requis pour type TRAITE');
    }
    if (dto.type === AffaireType.FACULTATIVE && dto.traiteData) {
      throw new BadRequestException('traiteData ne doit pas être fourni pour type FACULTATIVE');
    }
    if (dto.type === AffaireType.TRAITE && dto.facultativeData) {
      throw new BadRequestException('facultativeData ne doit pas être fourni pour type TRAITE');
    }

      // Validate reinsurer shares — facultative: total = tauxCession; treaty: 100
    // (facultativeData presence is guaranteed by the type checks above)
    const expectedShareTotal =
      dto.type === AffaireType.FACULTATIVE ? Number(dto.facultativeData!.tauxCession) : 100;
    this.commissionCalc.validateShares(dto.reassureurs, expectedShareTotal);
    this.assertNoDuplicateReassureurs(dto.reassureurs);

    if (dto.type === AffaireType.FACULTATIVE) {
      this.validateFacultativeReinsurerInputs(dto.reassureurs);
    }

    // Validate reassureurs exist
    const reassureurIds = dto.reassureurs.map((r) => r.reassureurId);
    const found = await this.prisma.reassureur.findMany({
      where: { id: { in: reassureurIds }, isActive: true },
    });
    if (found.length !== reassureurIds.length) {
      throw new BadRequestException('Un ou plusieurs réassureurs sont introuvables ou inactifs');
    }

    if (dto.facultativeData) {
      this.assertDateOrder(dto.facultativeData.dateEffet, dto.facultativeData.dateEcheance);
    }
    if (dto.traiteData) {
      this.assertDateOrder(dto.traiteData.dateEffet, dto.traiteData.dateEcheance);
    }

    const numero = await this.sequence.next('AFFAIRE');

    let reassureurData: any[] = dto.reassureurs.map((r) => ({
      reassureurId: r.reassureurId,
      partPct: r.partPct,
      prime100Pct: r.prime100Pct,
      tauxCommissionCedante: r.tauxCommissionCedante,
      isLeader: r.isLeader ?? false,
      commissionMode: r.commissionMode ?? CommissionMode.CALCULABLE,
      tauxCommissionArs: r.tauxCommissionArs,
      commissionForfait: r.commissionForfait,
    }));

    // Compute commission amounts if facultative
    if (dto.type === AffaireType.FACULTATIVE && dto.facultativeData) {
      const fac = dto.facultativeData;
      const legacyPrime100 = Number(fac.prime100Pct ?? dto.reassureurs[0]?.prime100Pct ?? 0);
      const legacyTauxCedante = Number(
        fac.tauxCommissionCedante ?? dto.reassureurs[0]?.tauxCommissionCedante ?? 0,
      );
      const results = this.commissionCalc.calculate({
        prime100Pct: legacyPrime100,
        reassureurs: dto.reassureurs.map((r) => ({
          reassureurId: r.reassureurId,
          partPct: r.partPct,
          prime100Pct: r.prime100Pct,
          tauxCommissionCedante: r.tauxCommissionCedante ?? legacyTauxCedante,
          commissionMode: r.commissionMode ?? CommissionMode.CALCULABLE,
          tauxCommissionArs: r.tauxCommissionArs,
          commissionForfait: r.commissionForfait,
        })),
      });

      reassureurData = reassureurData.map((r) => {
        const calc = results.find((res) => res.reassureurId === r.reassureurId);
        if (!calc) return r;
        return {
          ...r,
          primeBrute: calc.primeBrute,
          commissionArs: calc.commissionArs,
          commissionCedante: calc.commissionCedante,
          primeNetteCedante: calc.primeNetteCedante,
          primeNetteReassureur: calc.primeNetteReassureur,
        };
      });
    }
    if (dto.type === AffaireType.TRAITE && dto.traiteData && dto.traiteData.primePrevisionnelle) {
      const primePrev = Number(dto.traiteData.primePrevisionnelle);
      const tauxCommCed = Number(dto.traiteData.tauxCommissionCedante ?? 0);
      const primeNetteCedante = this.round3(primePrev * (1 - tauxCommCed / 100));

      const results = this.treatyCalc.calculateTreatyDistribution({
        primeNetteCedante,
        reassureurs: dto.reassureurs.map((r) => ({
          reassureurId: r.reassureurId,
          partPct: r.partPct,
          commissionMode: r.commissionMode ?? CommissionMode.CALCULABLE,
          tauxCommissionArs: r.tauxCommissionArs ?? 0,
          commissionForfait: r.commissionForfait,
        })),
      });

      reassureurData = reassureurData.map((r) => {
        const calc = results.find((res) => res.reassureurId === r.reassureurId);
        if (!calc) return r;
        return {
          ...r,
          primeBrute: calc.primeBrute,
          commissionArs: calc.commissionArs,
          primeNetteReassureur: calc.primeNetteReassureur,
        };
      });
    }

    const { affaire } = await this.prisma.$transaction(async (tx) => {
      const affaire = await tx.affaire.create({
        data: {
          numero,
          type: dto.type,
          statut: AffaireStatut.EN_COTATION,
          cedanteId: dto.cedanteId,
          modePaiement: dto.modePaiement ?? 'PAR_AFFAIRE',
          currency: dto.currency ?? 'TND',
          roe,
          chargeDossier: dto.chargeDossier,
          nom: dto.nom,
          renouvellementDetails: dto.renouvellementDetails,
          reassureurs: { create: reassureurData },
          facultativeData: dto.facultativeData
            ? {
                create: {
                  reassuranceType: dto.facultativeData.reassuranceType,
                  assureId: dto.facultativeData.assureId,
                  dateEffet: new Date(dto.facultativeData.dateEffet),
                  dateEcheance: new Date(dto.facultativeData.dateEcheance),
                  modeRenouvellement: dto.facultativeData.modeRenouvellement,
                  paysAssure: dto.facultativeData.paysAssure,
                  branche: dto.facultativeData.branche,
                  produit: dto.facultativeData.produit,
                  garantie: dto.facultativeData.garantie,
                  prime100Pct: dto.facultativeData.prime100Pct
                    ?? dto.reassureurs[0]?.prime100Pct
                    ?? 0,
                  tauxPrime: dto.facultativeData.tauxPrime,
                  tauxCession: dto.facultativeData.tauxCession,
                  // FIX (Affaires pass — precision consistency): rounded
                  // to 3 decimals, matching the rounding applied above and
                  // in FacultativeService — previously stored raw
                  // floating-point.
                  primeCedee: this.round3(
                    Number(dto.facultativeData.prime100Pct ?? dto.reassureurs[0]?.prime100Pct ?? 0)
                      * (dto.facultativeData.tauxCession / 100),
                  ),
                  tauxCommissionCedante: dto.facultativeData.tauxCommissionCedante,
                  commissionCedante: (dto.facultativeData.tauxCommissionCedante
                    ?? dto.reassureurs[0]?.tauxCommissionCedante)
                    ? this.round3(
                        Number(dto.facultativeData.prime100Pct ?? dto.reassureurs[0]?.prime100Pct ?? 0) *
                          (dto.facultativeData.tauxCession / 100) *
                          (Number(dto.facultativeData.tauxCommissionCedante
                            ?? dto.reassureurs[0]?.tauxCommissionCedante) / 100),
                      )
                    : null,
                  guaranteeLines: dto.facultativeData.guaranteeLines
                    ? { create: dto.facultativeData.guaranteeLines }
                    : undefined,
                },
              }
            : undefined,
          traiteData: dto.traiteData
            ? {
                create: {
                  referenceTraite: dto.traiteData.referenceTraite,
                  reassuranceType: dto.traiteData.reassuranceType,
                  formeCouverture: dto.traiteData.formeCouverture,
                  dateEffet: new Date(dto.traiteData.dateEffet),
                  dateEcheance: new Date(dto.traiteData.dateEcheance),
                  modeRenouvellement: dto.traiteData.modeRenouvellement,
                  dateAvisResiliation: dto.traiteData.dateAvisResiliation
                    ? new Date(dto.traiteData.dateAvisResiliation)
                    : undefined,
                  zoneGeographique: dto.traiteData.zoneGeographique,
                  branche: dto.traiteData.branche,
                  produit: dto.traiteData.produit,
                  garantie: dto.traiteData.garantie,
                  periodicite: dto.traiteData.periodicite,
                  primePrevisionnelle: dto.traiteData.primePrevisionnelle,
                  pmd: dto.traiteData.pmd,
                  tauxCommissionCedante: dto.traiteData.tauxCommissionCedante,
                  commissionLiquidationArs: dto.traiteData.commissionLiquidationArs,
                  seuilNotification: dto.traiteData.seuilNotification,
                  accountRubriques: dto.traiteData.accountRubriques
                    ? { create: dto.traiteData.accountRubriques }
                    : undefined,
                  pmdInstalments: dto.traiteData.pmdInstalments
                    ? {
                        create: dto.traiteData.pmdInstalments.map((p) => ({
                          ...p,
                          dateEcheance: new Date(p.dateEcheance),
                        })),
                      }
                    : undefined,
                },
              }
            : undefined,
        },
        include: {
          cedante: true,
          reassureurs: { include: { reassureur: true } },
          facultativeData: { include: { assure: true, guaranteeLines: true } },
          traiteData: { include: { accountRubriques: true, pmdInstalments: true } },
        },
      });
      await tx.documentChecklist.create({
        data: {
          affaireId: affaire.id,
          items: { create: this.getDefaultChecklistItems(found) },
        },
      });

      await tx.auditLog.create({
        data: { userId, action: 'AFFAIRE_CREATED', entityType: 'Affaire', entityId: affaire.id, after: { numero, type: dto.type } },
      });

      return { affaire };
    });

    if (dto.type === AffaireType.FACULTATIVE && dto.reassureurs.length > 0) {
      await this.recalculateCommissions(affaire.id);
      return this.findOne(affaire.id);
    }
    return affaire;
  }

  async update(id: string, dto: UpdateAffaireDto, userId: string) {
    const affaire = await this.findOne(id);

    if (affaire.statut === AffaireStatut.PLACEMENT_REALISE) {
      const topLevelChanges = Object.keys(dto).filter(
        (key) => !['renouvellementDetails', 'facultativeData', 'traiteData'].includes(key),
      );
      const hasInvalidFacultativeChange = dto.facultativeData
        ? Object.keys(dto.facultativeData).some((key) => key !== 'modeRenouvellement')
        : false;
      const hasInvalidTreatyChange = dto.traiteData
        ? Object.keys(dto.traiteData).some((key) => key !== 'modeRenouvellement')
        : false;
      if (topLevelChanges.length || hasInvalidFacultativeChange || hasInvalidTreatyChange) {
        throw new BadRequestException('Une affaire placée ne peut plus être modifiée, sauf son mode de renouvellement');
      }
    }

    if (dto.type && dto.type !== affaire.type) {
      throw new BadRequestException('Le type d\'affaire (Facultative/Traité) ne peut pas être modifié après création');
    }
    if (dto.facultativeData && affaire.type !== AffaireType.FACULTATIVE) {
      throw new BadRequestException('Cette affaire n\'est pas de type FACULTATIVE');
    }
    if (dto.traiteData && affaire.type !== AffaireType.TRAITE) {
      throw new BadRequestException('Cette affaire n\'est pas de type TRAITE');
    }

    if (dto.facultativeData?.dateEffet || dto.facultativeData?.dateEcheance) {
      this.assertDateOrder(
        dto.facultativeData.dateEffet ?? affaire.facultativeData?.dateEffet?.toISOString(),
        dto.facultativeData.dateEcheance ?? affaire.facultativeData?.dateEcheance?.toISOString(),
      );
    }
    if (dto.traiteData?.dateEffet || dto.traiteData?.dateEcheance) {
      this.assertDateOrder(
        dto.traiteData.dateEffet ?? affaire.traiteData?.dateEffet?.toISOString(),
        dto.traiteData.dateEcheance ?? affaire.traiteData?.dateEcheance?.toISOString(),
      );
    }

    // Facultative: shares total tauxCession (also re-checked when only the rate changes); treaty: 100
    const effectiveTauxCession =
      dto.facultativeData?.tauxCession ?? Number(affaire.facultativeData?.tauxCession ?? 0);
    const expectedShareTotal =
      affaire.type === AffaireType.FACULTATIVE ? effectiveTauxCession : 100;
    const sharesToCheck =
      dto.reassureurs ??
      (affaire.type === AffaireType.FACULTATIVE && dto.facultativeData?.tauxCession !== undefined
        ? affaire.reassureurs.map((r) => ({ partPct: Number(r.partPct) }))
        : undefined);
    if (sharesToCheck) {
      this.commissionCalc.validateShares(sharesToCheck, expectedShareTotal);
    }
    if (dto.reassureurs) {
      this.assertNoDuplicateReassureurs(dto.reassureurs);
      if (affaire.type === AffaireType.FACULTATIVE) {
        this.validateFacultativeReinsurerInputs(dto.reassureurs);
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.reassureurs) {
        await tx.affaireReassureur.deleteMany({ where: { affaireId: id } });
      }

      return tx.affaire.update({
        where: { id },
        data: {
          ...(dto.modePaiement && { modePaiement: dto.modePaiement }),
          ...(dto.currency && { currency: dto.currency }),
          ...(dto.roe !== undefined && { roe: dto.roe }),
          ...(dto.chargeDossier !== undefined && { chargeDossier: dto.chargeDossier }),
          ...(dto.nom !== undefined && { nom: dto.nom }),
          ...(dto.renouvellementDetails !== undefined && { renouvellementDetails: dto.renouvellementDetails }),
          ...(dto.reassureurs && {
            reassureurs: {
              create: dto.reassureurs.map((r) => ({
                reassureurId: r.reassureurId,
                partPct: r.partPct,
                  prime100Pct: r.prime100Pct,
                  tauxCommissionCedante: r.tauxCommissionCedante,
                  isLeader: r.isLeader ?? false,
                commissionMode: r.commissionMode ?? CommissionMode.CALCULABLE,
                tauxCommissionArs: r.tauxCommissionArs,
                commissionForfait: r.commissionForfait,
              })),
            },
          }),
          ...(dto.facultativeData && {
            facultativeData: {
              update: {
                ...(dto.facultativeData.reassuranceType !== undefined && { reassuranceType: dto.facultativeData.reassuranceType }),
                ...(dto.facultativeData.assureId !== undefined && { assure: { connect: { id: dto.facultativeData.assureId } } }),
                ...(dto.facultativeData.dateEffet && { dateEffet: new Date(dto.facultativeData.dateEffet) }),
                ...(dto.facultativeData.dateEcheance && { dateEcheance: new Date(dto.facultativeData.dateEcheance) }),
                ...(dto.facultativeData.modeRenouvellement !== undefined && { modeRenouvellement: dto.facultativeData.modeRenouvellement }),
                ...(dto.facultativeData.paysAssure !== undefined && { paysAssure: dto.facultativeData.paysAssure }),
                ...(dto.facultativeData.branche !== undefined && { branche: dto.facultativeData.branche }),
                ...(dto.facultativeData.produit !== undefined && { produit: dto.facultativeData.produit }),
                ...(dto.facultativeData.garantie !== undefined && { garantie: dto.facultativeData.garantie }),
                ...(dto.facultativeData.guaranteeLines !== undefined && {
                  guaranteeLines: { deleteMany: {}, create: dto.facultativeData.guaranteeLines },
                }),
                ...(() => {
                  const needsRecompute =
                    dto.facultativeData.prime100Pct !== undefined ||
                    dto.facultativeData.tauxCession !== undefined ||
                    dto.facultativeData.tauxCommissionCedante !== undefined;

                  if (!needsRecompute) {
                    return dto.facultativeData.tauxPrime !== undefined
                      ? { tauxPrime: dto.facultativeData.tauxPrime }
                      : {};
                  }

                  const prime100 = dto.facultativeData.prime100Pct ?? Number(affaire.facultativeData?.prime100Pct ?? 0);
                  const tauxCession = dto.facultativeData.tauxCession ?? Number(affaire.facultativeData?.tauxCession ?? 0);
                  const tauxComm = dto.facultativeData.tauxCommissionCedante ?? Number(affaire.facultativeData?.tauxCommissionCedante ?? 0);
                  const primeCedee = this.round3(prime100 * (tauxCession / 100));
                  const commissionCedante = tauxComm
                    ? this.round3(prime100 * (tauxCession / 100) * (tauxComm / 100))
                    : null;

                  return {
                    ...(dto.facultativeData.prime100Pct !== undefined && { prime100Pct: prime100 }),
                    ...(dto.facultativeData.tauxPrime !== undefined && { tauxPrime: dto.facultativeData.tauxPrime }),
                    ...(dto.facultativeData.tauxCession !== undefined && { tauxCession }),
                    ...(dto.facultativeData.tauxCommissionCedante !== undefined && { tauxCommissionCedante: tauxComm }),
                    primeCedee,
                    commissionCedante,
                  };
                })(),
              },
            },
          }),
          ...(dto.traiteData && {
            traiteData: {
              update: {
                ...(dto.traiteData.referenceTraite !== undefined && { referenceTraite: dto.traiteData.referenceTraite }),
                ...(dto.traiteData.reassuranceType !== undefined && { reassuranceType: dto.traiteData.reassuranceType }),
                ...(dto.traiteData.formeCouverture !== undefined && { formeCouverture: dto.traiteData.formeCouverture }),
                ...(dto.traiteData.dateEffet && { dateEffet: new Date(dto.traiteData.dateEffet) }),
                ...(dto.traiteData.dateEcheance && { dateEcheance: new Date(dto.traiteData.dateEcheance) }),
                ...(dto.traiteData.modeRenouvellement !== undefined && { modeRenouvellement: dto.traiteData.modeRenouvellement }),
                ...(dto.traiteData.dateAvisResiliation !== undefined && {
                  dateAvisResiliation: dto.traiteData.dateAvisResiliation ? new Date(dto.traiteData.dateAvisResiliation) : null,
                }),
                ...(dto.traiteData.zoneGeographique !== undefined && { zoneGeographique: dto.traiteData.zoneGeographique }),
                ...(dto.traiteData.branche !== undefined && { branche: dto.traiteData.branche }),
                ...(dto.traiteData.produit !== undefined && { produit: dto.traiteData.produit }),
                ...(dto.traiteData.garantie !== undefined && { garantie: dto.traiteData.garantie }),
                ...(dto.traiteData.primePrevisionnelle !== undefined && { primePrevisionnelle: dto.traiteData.primePrevisionnelle }),
                ...(dto.traiteData.pmd !== undefined && { pmd: dto.traiteData.pmd }),
                ...(dto.traiteData.tauxCommissionCedante !== undefined && { tauxCommissionCedante: dto.traiteData.tauxCommissionCedante }),
                ...(dto.traiteData.commissionLiquidationArs !== undefined && { commissionLiquidationArs: dto.traiteData.commissionLiquidationArs }),
                ...(dto.traiteData.seuilNotification !== undefined && { seuilNotification: dto.traiteData.seuilNotification }),
                ...(dto.traiteData.periodicite && { periodicite: dto.traiteData.periodicite }),
                ...(dto.traiteData.accountRubriques !== undefined && {
                  accountRubriques: { deleteMany: {}, create: dto.traiteData.accountRubriques },
                }),
                ...(dto.traiteData.pmdInstalments !== undefined && {
                  pmdInstalments: {
                    deleteMany: {},
                    create: dto.traiteData.pmdInstalments.map((p) => ({
                      ...p,
                      dateEcheance: new Date(p.dateEcheance),
                    })),
                  },
                }),
              },
            },
          }),
        },
        include: {
          cedante: true,
          reassureurs: { include: { reassureur: true } },
          facultativeData: { include: { assure: true, guaranteeLines: true } },
          traiteData: { include: { accountRubriques: true, pmdInstalments: true } },
        },
      });
    });

    // Cascade commission recalculation if financial data changed (Facultative)
    if (updated.type === AffaireType.FACULTATIVE && (
      dto.facultativeData?.prime100Pct !== undefined ||
      dto.facultativeData?.tauxCession !== undefined ||
      dto.facultativeData?.tauxCommissionCedante !== undefined ||
      dto.reassureurs
    )) {
      await this.recalculateCommissions(id);
    }
    if (updated.type === AffaireType.TRAITE && (
      dto.traiteData?.primePrevisionnelle !== undefined ||
      dto.traiteData?.tauxCommissionCedante !== undefined ||
      dto.reassureurs
    )) {
      await this.recalculateTreatyDistribution(id);
    }

    await this.prisma.auditLog.create({
      data: { userId, action: 'AFFAIRE_UPDATED', entityType: 'Affaire', entityId: id },
    });

    return updated;
  }

  async changeStatus(id: string, statut: AffaireStatut, userId: string) {
    await this.workflow.transition(id, statut, userId);
    return this.findOne(id);
  }

  async createNegotiation(affaireId: string, dto: CreateNegotiationDto, userId: string) {
    const affaire = await this.prisma.affaire.findUnique({ where: { id: affaireId }, select: { id: true, isActive: true } });
    if (!affaire || !affaire.isActive) throw new NotFoundException('Affaire introuvable');
    const latest = await this.prisma.affaireNegotiation.findFirst({
      where: { affaireId },
      orderBy: { round: 'desc' },
      select: { round: true },
    });
    const negotiation = await this.prisma.affaireNegotiation.create({
      data: {
        affaireId,
        round: dto.round ?? (latest ? latest.round + 1 : 1),
        date: new Date(dto.date),
        counterparty: dto.counterparty.trim(),
        subject: dto.subject,
        currentValue: dto.currentValue?.trim() || null,
        proposedValue: dto.proposedValue?.trim() || null,
        status: dto.status ?? NegotiationStatus.EN_COURS,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        notes: dto.notes?.trim() || null,
        createdByUserId: userId,
      },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'NEGOTIATION_CREATED', entityType: 'AffaireNegotiation', entityId: negotiation.id },
    });
    return negotiation;
  }

  async updateRenewalDetails(affaireId: string, details: string) {
    const affaire = await this.prisma.affaire.findUnique({ where: { id: affaireId }, select: { id: true, isActive: true } });
    if (!affaire || !affaire.isActive) throw new NotFoundException('Affaire introuvable');
    return this.prisma.affaire.update({ where: { id: affaireId }, data: { renouvellementDetails: details?.trim() || null } });
  }

  async updateNegotiation(affaireId: string, negotiationId: string, dto: UpdateNegotiationDto, userId: string) {
    const existing = await this.prisma.affaireNegotiation.findFirst({ where: { id: negotiationId, affaireId } });
    if (!existing) throw new NotFoundException('Négociation introuvable');
    const updated = await this.prisma.affaireNegotiation.update({
      where: { id: negotiationId },
      data: {
        ...(dto.round !== undefined && { round: dto.round }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
        ...(dto.counterparty !== undefined && { counterparty: dto.counterparty.trim() }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.currentValue !== undefined && { currentValue: dto.currentValue?.trim() || null }),
        ...(dto.proposedValue !== undefined && { proposedValue: dto.proposedValue?.trim() || null }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.deadline !== undefined && { deadline: dto.deadline ? new Date(dto.deadline) : null }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
      },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'NEGOTIATION_UPDATED', entityType: 'AffaireNegotiation', entityId: negotiationId },
    });
    return updated;
  }

  async deleteNegotiation(affaireId: string, negotiationId: string, userId: string) {
    const existing = await this.prisma.affaireNegotiation.findFirst({ where: { id: negotiationId, affaireId } });
    if (!existing) throw new NotFoundException('Négociation introuvable');
    await this.prisma.affaireNegotiation.delete({ where: { id: negotiationId } });
    await this.prisma.auditLog.create({
      data: { userId, action: 'NEGOTIATION_DELETED', entityType: 'AffaireNegotiation', entityId: negotiationId },
    });
  }

  async remove(id: string, userId: string) {
    const a = await this.findOne(id);
    if (a.statut === AffaireStatut.PLACEMENT_REALISE) {
      throw new BadRequestException('Impossible de supprimer une affaire placée');
    }
    await this.prisma.auditLog.create({
      data: { userId, action: 'AFFAIRE_DELETED', entityType: 'Affaire', entityId: id },
    });
    return this.prisma.affaire.update({ where: { id }, data: { isActive: false } });
  }

  /** Recalculate and persist commission amounts on a facultative affaire */
  async recalculateCommissions(affaireId: string): Promise<void> {
    const affaire = await this.prisma.affaire.findUniqueOrThrow({
      where: { id: affaireId },
      include: { facultativeData: true, reassureurs: true },
    });

    if (affaire.type !== AffaireType.FACULTATIVE || !affaire.facultativeData) return;

    const fac = affaire.facultativeData;

    const results = this.commissionCalc.calculate({
      prime100Pct: Number(fac.prime100Pct),
      tauxCommissionCedante: Number(fac.tauxCommissionCedante ?? 0),
      reassureurs: affaire.reassureurs.map((r) => ({
        reassureurId: r.reassureurId,
        partPct: Number(r.partPct),
        prime100Pct: r.prime100Pct == null ? undefined : Number(r.prime100Pct),
        tauxCommissionCedante: r.tauxCommissionCedante == null
          ? undefined
          : Number(r.tauxCommissionCedante),
        commissionMode: r.commissionMode,
        tauxCommissionArs: Number(r.tauxCommissionArs ?? 0),
        commissionForfait: r.commissionForfait ? Number(r.commissionForfait) : undefined,
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

    await this.prisma.facultativeAffaire.update({
      where: { affaireId },
      data: {
        primeCedee: this.round3(results.reduce((sum, result) => sum + result.primeBrute, 0)),
        commissionCedante: this.round3(results.reduce((sum, result) => sum + result.commissionCedante, 0)),
      },
    });
  }
  private async recalculateTreatyDistribution(affaireId: string): Promise<void> {
    const affaire = await this.prisma.affaire.findUniqueOrThrow({
      where: { id: affaireId },
      include: { traiteData: true, reassureurs: true },
    });

    if (affaire.type !== AffaireType.TRAITE || !affaire.traiteData) return;

    const traite = affaire.traiteData;
    const primePrevisionnelle = Number(traite.primePrevisionnelle ?? 0);
    if (primePrevisionnelle <= 0 || affaire.reassureurs.length === 0) return;

    const tauxCommCed = Number(traite.tauxCommissionCedante ?? 0);
    const primeNetteCedante = this.round3(primePrevisionnelle * (1 - tauxCommCed / 100));

    const results = this.treatyCalc.calculateTreatyDistribution({
      primeNetteCedante,
      reassureurs: affaire.reassureurs.map((r) => ({
        reassureurId: r.reassureurId,
        partPct: Number(r.partPct),
        commissionMode: r.commissionMode,
        tauxCommissionArs: Number(r.tauxCommissionArs ?? 0),
        commissionForfait: r.commissionForfait ? Number(r.commissionForfait) : undefined,
      })),
    });

    await Promise.all(
      results.map((res) =>
        this.prisma.affaireReassureur.updateMany({
          where: { affaireId, reassureurId: res.reassureurId },
          data: {
            primeBrute: res.primeBrute,
            commissionArs: res.commissionArs,
            primeNetteReassureur: res.primeNetteReassureur,
          },
        }),
      ),
    );
  }

  private assertNoDuplicateReassureurs(reassureurs: { reassureurId: string }[]): void {
    const ids = reassureurs.map((r) => r.reassureurId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Un même réassureur ne peut apparaître qu\'une seule fois dans la table de participation');
    }
  }

  private assertDateOrder(effet?: string, echeance?: string): void {
    if (!effet || !echeance) return;
    if (new Date(effet) > new Date(echeance)) {
      throw new BadRequestException("La date d'effet doit être antérieure ou égale à la date d'échéance");
    }
  }

  private getDefaultChecklistItems(
    reassureurs: { id: string; raisonSociale: string }[],
  ) {
    const items: { documentType: string; libelle: string; isMandatory: boolean; ordre: number }[] = [
      { documentType: 'NOTE_DE_SYNTHESE', libelle: 'Note de Synthèse', isMandatory: true, ordre: 1 },
      { documentType: 'SLIP_COTATION', libelle: 'Slip de cotation', isMandatory: true, ordre: 2 },
      { documentType: 'ORDRE_ASSURANCE', libelle: "Ordre d'assurance (signé)", isMandatory: true, ordre: 3 },
      { documentType: 'SLIP_COUVERTURE', libelle: 'Slip de couverture (signé + approuvé)', isMandatory: true, ordre: 4 },
      { documentType: 'BORDEREAU_CESSION_CEDANTE', libelle: 'Bordereau de cession cédante', isMandatory: true, ordre: 5 },
      { documentType: 'CONVENTION_CEDANTE', libelle: 'Convention cédante', isMandatory: true, ordre: 6 },
    ];

    let ordre = items.length + 1;
    for (const r of reassureurs) {
      items.push({
        documentType: `BORDEREAU_CESSION_REASSUREUR_${r.id}`,
        libelle: `Bordereau de cession — ${r.raisonSociale}`,
        isMandatory: true,
        ordre: ordre++,
      });
      items.push({
        documentType: `CONVENTION_REASSUREUR_${r.id}`,
        libelle: `Convention réassureur — ${r.raisonSociale}`,
        isMandatory: true,
        ordre: ordre++,
      });
    }
    return items;
  }

  private round3(n: number): number {
    return Math.round(n * 1000) / 1000;
  }

  private validateFacultativeReinsurerInputs(
    reassureurs: CreateAffaireDto['reassureurs'],
  ): void {
    for (const [index, reassureur] of reassureurs.entries()) {
      if (!(Number(reassureur.prime100Pct) > 0)) {
        throw new BadRequestException(
          `La prime 100% est obligatoire pour le réassureur ${index + 1}`,
        );
      }
      if (reassureur.tauxCommissionCedante === undefined || reassureur.tauxCommissionCedante === null) {
        throw new BadRequestException(
          `Le taux de commission cédante est obligatoire pour le réassureur ${index + 1}`,
        );
      }
      if (
        (reassureur.commissionMode === undefined || reassureur.commissionMode === CommissionMode.CALCULABLE)
        && (reassureur.tauxCommissionArs === undefined || reassureur.tauxCommissionArs === null)
      ) {
        throw new BadRequestException(
          `Le taux de commission courtage est obligatoire pour le réassureur ${index + 1}`,
        );
      }
      if (
        reassureur.commissionMode === CommissionMode.FORFAITAIRE
        && (reassureur.commissionForfait === undefined || reassureur.commissionForfait === null)
      ) {
        throw new BadRequestException(
          `La commission forfaitaire est obligatoire pour le réassureur ${index + 1}`,
        );
      }
    }
  }
}