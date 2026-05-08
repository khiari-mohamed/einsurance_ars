import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { AffaireStatut, AffaireType, CommissionMode } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { CommissionCalculatorService } from './commission-calculator.service';
import { AffaireWorkflowService } from './workflow.service';
import { CreateAffaireDto } from './dto/create-affaire.dto';
import { UpdateAffaireDto } from './dto/update-affaire.dto';

@Injectable()
export class AffairesService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private commissionCalc: CommissionCalculatorService,
    private workflow: AffaireWorkflowService,
  ) {}

  async findAll(filters: {
    cedanteId?: string;
    statut?: AffaireStatut;
    type?: AffaireType;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { cedanteId, statut, type, search, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { isActive: true };
    if (cedanteId) where.cedanteId = cedanteId;
    if (statut) where.statut = statut;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { cedante: { raisonSociale: { contains: search, mode: 'insensitive' } } },
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
      },
    });
    if (!a || !a.isActive) throw new NotFoundException('Affaire introuvable');
    return a;
  }

  async create(dto: CreateAffaireDto, userId: string) {
    // Validate type ↔ data consistency
    if (dto.type === AffaireType.FACULTATIVE && !dto.facultativeData) {
      throw new BadRequestException('facultativeData requis pour type FACULTATIVE');
    }
    if (dto.type === AffaireType.TRAITE && !dto.traiteData) {
      throw new BadRequestException('traiteData requis pour type TRAITE');
    }

    // Validate reinsurer shares
    this.commissionCalc.validateShares(dto.reassureurs);

    // Validate reassureurs exist
    const reassureurIds = dto.reassureurs.map((r) => r.reassureurId);
    const found = await this.prisma.reassureur.findMany({
      where: { id: { in: reassureurIds }, isActive: true },
    });
    if (found.length !== reassureurIds.length) {
      throw new BadRequestException('Un ou plusieurs réassureurs sont introuvables ou inactifs');
    }

    const numero = await this.sequence.next('AFFAIRE');

    // Calculate commissions if facultative (needs primeCedee)
    let reassureurData: any[] = dto.reassureurs.map((r) => ({
      reassureurId: r.reassureurId,
      partPct: r.partPct,
      isLeader: r.isLeader ?? false,
      commissionMode: r.commissionMode ?? CommissionMode.CALCULABLE,
      tauxCommissionArs: r.tauxCommissionArs,
      commissionForfait: r.commissionForfait,
    }));

    // Compute commission amounts if facultative
    if (dto.type === AffaireType.FACULTATIVE && dto.facultativeData) {
      const fac = dto.facultativeData;
      const primeCedee = Number(fac.prime100Pct) * (fac.tauxCession / 100);
      const results = this.commissionCalc.calculate({
        primeCedee,
        tauxCession: fac.tauxCession / 100,
        tauxCommissionCedante: fac.tauxCommissionCedante ?? 0,
        reassureurs: dto.reassureurs.map((r) => ({
          reassureurId: r.reassureurId,
          partPct: r.partPct,
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

    const affaire = await this.prisma.affaire.create({
      data: {
        numero,
        type: dto.type,
        statut: AffaireStatut.EN_COTATION,
        cedanteId: dto.cedanteId,
        modePaiement: dto.modePaiement ?? 'PAR_AFFAIRE',
        currency: dto.currency ?? 'TND',
        reassureurs: { create: reassureurData },
        facultativeData: dto.facultativeData
          ? {
              create: {
                reassuranceType: dto.facultativeData.reassuranceType,
                assureId: dto.facultativeData.assureId,
                numeroPoliceCedante: dto.facultativeData.numeroPoliceCedante,
                dateEffet: new Date(dto.facultativeData.dateEffet),
                dateEcheance: new Date(dto.facultativeData.dateEcheance),
                modeRenouvellement: dto.facultativeData.modeRenouvellement,
                paysAssure: dto.facultativeData.paysAssure,
                branche: dto.facultativeData.branche,
                produit: dto.facultativeData.produit,
                garantie: dto.facultativeData.garantie,
                prime100Pct: dto.facultativeData.prime100Pct,
                tauxPrime: dto.facultativeData.tauxPrime,
                tauxCession: dto.facultativeData.tauxCession,
                primeCedee: Number(dto.facultativeData.prime100Pct) * (dto.facultativeData.tauxCession / 100),
                tauxCommissionCedante: dto.facultativeData.tauxCommissionCedante,
                commissionCedante: dto.facultativeData.tauxCommissionCedante
                  ? Number(dto.facultativeData.prime100Pct) * (dto.facultativeData.tauxCession / 100) * (dto.facultativeData.tauxCommissionCedante / 100)
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

    // Initialize document checklist
    await this.prisma.documentChecklist.create({
      data: {
        affaireId: affaire.id,
        items: {
          create: this.getDefaultChecklistItems(dto.type),
        },
      },
    });

    // Audit
    await this.prisma.auditLog.create({
      data: { userId, action: 'AFFAIRE_CREATED', entityType: 'Affaire', entityId: affaire.id, after: { numero, type: dto.type } },
    });

    return affaire;
  }

  async update(id: string, dto: UpdateAffaireDto, userId: string) {
    const affaire = await this.findOne(id);

    if (affaire.statut === AffaireStatut.PLACEMENT_REALISE) {
      throw new BadRequestException('Une affaire placée ne peut plus être modifiée');
    }

    if (dto.reassureurs) {
      this.commissionCalc.validateShares(dto.reassureurs);
      // Delete and recreate reinsurer participation table
      await this.prisma.affaireReassureur.deleteMany({ where: { affaireId: id } });
    }

    const updated = await this.prisma.affaire.update({
      where: { id },
      data: {
        ...(dto.modePaiement && { modePaiement: dto.modePaiement }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.reassureurs && {
          reassureurs: {
            create: dto.reassureurs.map((r) => ({
              reassureurId: r.reassureurId,
              partPct: r.partPct,
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
              ...(dto.facultativeData.dateEffet && { dateEffet: new Date(dto.facultativeData.dateEffet) }),
              ...(dto.facultativeData.dateEcheance && { dateEcheance: new Date(dto.facultativeData.dateEcheance) }),
              ...(dto.facultativeData.prime100Pct !== undefined && { prime100Pct: dto.facultativeData.prime100Pct }),
              ...(dto.facultativeData.tauxCession !== undefined && { tauxCession: dto.facultativeData.tauxCession }),
              ...(dto.facultativeData.tauxCommissionCedante !== undefined && { tauxCommissionCedante: dto.facultativeData.tauxCommissionCedante }),
              ...(dto.facultativeData.branche !== undefined && { branche: dto.facultativeData.branche }),
              ...(dto.facultativeData.produit !== undefined && { produit: dto.facultativeData.produit }),
              ...(dto.facultativeData.modeRenouvellement !== undefined && { modeRenouvellement: dto.facultativeData.modeRenouvellement }),
            },
          },
        }),
        ...(dto.traiteData && {
          traiteData: {
            update: {
              ...(dto.traiteData.primePrevisionnelle !== undefined && { primePrevisionnelle: dto.traiteData.primePrevisionnelle }),
              ...(dto.traiteData.pmd !== undefined && { pmd: dto.traiteData.pmd }),
              ...(dto.traiteData.tauxCommissionCedante !== undefined && { tauxCommissionCedante: dto.traiteData.tauxCommissionCedante }),
              ...(dto.traiteData.seuilNotification !== undefined && { seuilNotification: dto.traiteData.seuilNotification }),
              ...(dto.traiteData.periodicite && { periodicite: dto.traiteData.periodicite }),
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

    await this.prisma.auditLog.create({
      data: { userId, action: 'AFFAIRE_UPDATED', entityType: 'Affaire', entityId: id },
    });

    return updated;
  }

  async changeStatus(id: string, statut: AffaireStatut, userId: string) {
    await this.workflow.transition(id, statut, userId);
    return this.findOne(id);
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
    const primeCedee = Number(fac.primeCedee) || Number(fac.prime100Pct) * (Number(fac.tauxCession) / 100);

    const results = this.commissionCalc.calculate({
      primeCedee,
      tauxCession: Number(fac.tauxCession) / 100,
      tauxCommissionCedante: Number(fac.tauxCommissionCedante ?? 0),
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
            commissionCedante: res.commissionCedante,
            primeNetteCedante: res.primeNetteCedante,
            primeNetteReassureur: res.primeNetteReassureur,
          },
        }),
      ),
    );
  }

  private getDefaultChecklistItems(type: AffaireType) {
    const common = [
      { documentType: 'NOTE_DE_SYNTHESE', libelle: 'Note de synthèse', isMandatory: true, ordre: 1 },
      { documentType: 'SLIP_COTATION', libelle: 'Slip de cotation', isMandatory: true, ordre: 2 },
    ];
    const facultative = [
      { documentType: 'CONVENTION', libelle: 'Convention de réassurance', isMandatory: true, ordre: 3 },
      { documentType: 'POLICE', libelle: 'Police d\'assurance', isMandatory: false, ordre: 4 },
    ];
    const traite = [
      { documentType: 'CONTRAT', libelle: 'Contrat de traité', isMandatory: true, ordre: 3 },
      { documentType: 'BORDEREAU_MODELE', libelle: 'Modèle de bordereau', isMandatory: false, ordre: 4 },
    ];
    return [...common, ...(type === AffaireType.FACULTATIVE ? facultative : traite)];
  }
}