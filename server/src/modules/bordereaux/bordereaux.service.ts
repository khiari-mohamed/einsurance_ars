import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { BordereauStatut, BordereauType, DocumentStatut, PaymentMode, Prisma, SituationSoldeDirection } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import type { SequenceEntity } from '../../shared/services/sequence.service';
import { AmountToWordsService } from '../../shared/services/amount-to-words.service';
import { StorageService } from '../../shared/services/storage.service';
import { EmailService } from '../../shared/services/email.service';
import { PdfGeneratorService } from '../reporting/pdf-generator.service';
import { AccountingEngineService } from '../comptabilite/accounting-engine.service';
import { CreateBordereauDto, BordereauLineDto } from './dto/create-bordereau.dto';
import { UpdateBordereauDto } from './dto/update-bordereau.dto';
import { GenerateBordereauDto } from './dto/generate-bordereau.dto';
import { RejectBordereauDto } from './dto/reject-bordereau.dto';
import { SendBordereauDto } from './dto/send-bordereau.dto';
import { PayBordereauDto } from './dto/pay-bordereau.dto';
import { AttachDocumentDto } from './dto/attach-document.dto';

function resolveTemplate(type: BordereauType): 'bordereau-cession' | 'bordereau-traite' | 'bordereau-releve' {
  switch (type) {
    case BordereauType.CESSION_CEDANTE:
    case BordereauType.CESSION_REASSUREUR:
      return 'bordereau-cession';
    case BordereauType.SITUATION_TRAITE:
    case BordereauType.FACTURE_DEPOT_PRIME:
    case BordereauType.FACTURE_PRIME_REASSURANCE_DEPOT:
    case BordereauType.FACTURE_PRIME_REASSURANCE_AJUSTEMENT:
    case BordereauType.ETAT_DE_TRANSFERT:
      return 'bordereau-traite';
    case BordereauType.NOTE_DE_CREDIT:
    case BordereauType.SITUATION_FINANCIERE:
    case BordereauType.SINISTRE_FACULTATIVE:
      return 'bordereau-releve';
    default:
      return 'bordereau-cession';
  }
}

const TYPE_TITLES: Record<BordereauType, string> = {
  CESSION_CEDANTE: 'Bordereau de Cession — Cédante',
  CESSION_REASSUREUR: 'Bordereau de Cession — Réassureur',
  SINISTRE_FACULTATIVE: 'Bordereau Sinistre — Facultative',
  SITUATION_TRAITE: 'Situation de Traité',
  FACTURE_DEPOT_PRIME: 'Facture — Dépôt de Prime',
  NOTE_DE_CREDIT: 'Note de Crédit',
  ETAT_DE_TRANSFERT: 'État de Transfert',
  SITUATION_FINANCIERE: 'Situation Financière',
  FACTURE_PRIME_REASSURANCE_DEPOT: 'Facture Prime de Réassurance — Dépôt',
  FACTURE_PRIME_REASSURANCE_AJUSTEMENT: 'Facture Prime de Réassurance — Ajustement',
};

const DEFAULT_PAYMENT_TERM_DAYS = 30;

// NEW — the 7 types whose bordereau is a netting/statement document
// (DEBIT/CREDIT columns per CDC §6.3), as opposed to CESSION_CEDANTE /
// CESSION_REASSUREUR / SINISTRE_FACULTATIVE which are flat premium/claim
// totals. Shared by computeMontant() and the per-type sequence key builder.
const TRAITE_TYPES = new Set<BordereauType>([
  BordereauType.SITUATION_TRAITE,
  BordereauType.FACTURE_DEPOT_PRIME,
  BordereauType.NOTE_DE_CREDIT,
  BordereauType.ETAT_DE_TRANSFERT,
  BordereauType.SITUATION_FINANCIERE,
  BordereauType.FACTURE_PRIME_REASSURANCE_DEPOT,
  BordereauType.FACTURE_PRIME_REASSURANCE_AJUSTEMENT,
]);

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export interface BordereauQueryFilters {
  affaireId?: string;
  type?: BordereauType;
  statut?: BordereauStatut;
  cedanteId?: string;
  reassureurCode?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  overdue?: string;
  currency?: string;
  createdByUserId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

@Injectable()
export class BordereauxService {
  private readonly logger = new Logger(BordereauxService.name);

  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private amountToWords: AmountToWordsService,
    private pdfGenerator: PdfGeneratorService,
    private storage: StorageService,
    private email: EmailService,
    private accounting: AccountingEngineService,
  ) {}

  private async logAudit(userId: string | undefined, bordereauId: string, action: string, message?: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? undefined,
          action,
          entityType: 'Bordereau',
          entityId: bordereauId,
          after: message ? { message } : undefined,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Audit log write failed for bordereau ${bordereauId}: ${err.message}`);
    }
  }

  private withDerived(b: any) {
    if (!b) return b;
    const montantTotal = Number(b.montantTotal ?? 0);
    const montantRegle = Number(b.montantRegle ?? 0);
    return {
      ...b,
      solde: Math.max(montantTotal - montantRegle, 0),
      isOverdue:
        b.statut === BordereauStatut.EMIS &&
        b.dateLimitePaiement &&
        new Date(b.dateLimitePaiement) < new Date() &&
        montantTotal - montantRegle > 0,
    };
  }

  // ============================================================
  // CRUD / LIST
  // ============================================================

  async findAll(filters: BordereauQueryFilters) {
    const {
      affaireId, type, statut, cedanteId, reassureurCode, search,
      minAmount, maxAmount, overdue, currency, createdByUserId,
      sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20,
    } = filters;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Prisma.BordereauWhereInput = {};
    if (affaireId) where.affaireId = affaireId;
    if (type) where.type = type;
    if (statut) where.statut = statut;
    if (cedanteId) where.cedanteId = cedanteId;
    if (reassureurCode) where.reassureurCode = reassureurCode;
    if (currency) where.currency = currency;
    if (createdByUserId) where.createdByUserId = createdByUserId;
    if (minAmount != null || maxAmount != null) {
      where.montantTotal = {
        ...(minAmount != null && { gte: Number(minAmount) }),
        ...(maxAmount != null && { lte: Number(maxAmount) }),
      };
    }
    if (overdue === 'true') {
      where.statut = BordereauStatut.EMIS;
      where.dateLimitePaiement = { lt: new Date() };
    }
    if (search) {
      where.OR = [
        { numero: { contains: search, mode: 'insensitive' } },
        { reassureurCode: { contains: search, mode: 'insensitive' } },
        { cedante: { raisonSociale: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.bordereau.findMany({
        where,
        include: {
          affaire: { select: { numero: true, type: true } },
          cedante: { select: { raisonSociale: true } },
          _count: { select: { lines: true, payments: true, documents: true } },
        },
        skip, take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.bordereau.count({ where }),
    ]);

    const codes = [...new Set(data.map((b) => b.reassureurCode).filter(Boolean))] as string[];
    const reassureurs = codes.length
      ? await this.prisma.reassureur.findMany({
          where: { code: { in: codes } },
          select: { code: true, raisonSociale: true },
        })
      : [];
    const reassureurMap = new Map(reassureurs.map((r) => [r.code, r.raisonSociale]));

    return {
      data: data.map((b) => this.withDerived({
        ...b,
        reassureur: b.reassureurCode
          ? { raisonSociale: reassureurMap.get(b.reassureurCode) ?? b.reassureurCode }
          : null,
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  async findOne(id: string) {
    const b = await this.prisma.bordereau.findUnique({
      where: { id },
      include: {
        affaire: { include: { cedante: true, reassureurs: { include: { reassureur: true } } } },
        cedante: true,
        situation: { include: { cedante: true } },
        lines: { orderBy: { ordre: 'asc' } },
        payments: { orderBy: { datePaiement: 'desc' } },
        journalEntries: true,
      },
    });
    if (!b) throw new NotFoundException('Bordereau introuvable');

    const userIds = [b.createdByUserId, b.validatedByUserId].filter(Boolean) as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, nom: true, prenom: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    let reassureur: { raisonSociale: string; compteComptable: string } | null = null;
    if (b.reassureurCode) {
      reassureur = await this.prisma.reassureur.findFirst({
        where: { code: b.reassureurCode },
        select: { raisonSociale: true, compteComptable: true },
      });
    }

    return this.withDerived({
      ...b,
      reassureur,
      createdBy: b.createdByUserId ? userMap.get(b.createdByUserId) ?? null : null,
      validatedBy: b.validatedByUserId ? userMap.get(b.validatedByUserId) ?? null : null,
    });
  }

  async findByNumero(numero: string) {
    const b = await this.prisma.bordereau.findFirst({ where: { numero } });
    if (!b) throw new NotFoundException('Bordereau introuvable');
    return this.findOne(b.id);
  }

  // NEW — replaces the old computeMontantTotal(): number with a version that
  // also derives soldeDirection for the 7 traité-family types.
  private computeMontant(
    type: BordereauType,
    lines: Array<Partial<BordereauLineDto>>,
  ): { montantTotal: number; soldeDirection: SituationSoldeDirection | null } {
    if (type === BordereauType.SINISTRE_FACULTATIVE) {
      const montantTotal = lines.reduce(
        (s, l) => s + Number(l.sinistresPayes ?? l.primeNette ?? l.primeBrute ?? 0), 0,
      );
      return { montantTotal, soldeDirection: null };
    }

    if (TRAITE_TYPES.has(type)) {
      let credit = 0; // schema's own "CREDIT side" columns: primesCedees, recLiberes, sapLiberes, interets
      let debit = 0;  // schema's own "DEBIT side" columns: sinistresPayes, recConstitues, sapConstitues, participationsBenef, taxes, brokerage (+ commissions)
      let fallback = 0; // lines entered with only the cession-shaped fields (no debit/credit columns set)

      for (const l of lines) {
        const c = Number(l.primesCedees ?? 0) + Number(l.recLiberes ?? 0)
          + Number(l.sapLiberes ?? 0) + Number(l.interets ?? 0);
        const d = Number(l.sinistresPayes ?? 0) + Number(l.recConstitues ?? 0)
          + Number(l.sapConstitues ?? 0) + Number(l.participationsBenef ?? 0)
          + Number(l.taxes ?? 0) + Number(l.brokerage ?? 0)
          + Number(l.commissionCedante ?? 0) + Number(l.commissionCourtage ?? 0);
        if (c === 0 && d === 0) {
          fallback += Number(l.primeNette ?? l.primeBrute ?? 0);
        } else {
          credit += c;
          debit += d;
        }
      }

      const montantTotal = Math.abs(credit - debit) + Math.abs(fallback);

      // ASSUMPTION (flag for business confirmation — same convention as
      // Situation.soldeDirection, reused generically): CREDIT columns are
      // premium-side amounts owed TO ARS by whichever party this bordereau
      // is issued to; DEBIT columns are claims/deductions owed BY ARS. If
      // CREDIT > DEBIT the counterparty owes ARS the difference
      // (CEDANTE_DOIT — the enum label is reused as-is from Situation, it
      // does not imply the counterparty is literally always a cédante). If
      // DEBIT > CREDIT, ARS owes the counterparty (ARS_DOIT).
      let soldeDirection: SituationSoldeDirection = SituationSoldeDirection.EQUILIBRE;
      if (credit > debit) soldeDirection = SituationSoldeDirection.CEDANTE_DOIT;
      else if (debit > credit) soldeDirection = SituationSoldeDirection.ARS_DOIT;

      return { montantTotal, soldeDirection };
    }

    const montantTotal = lines.reduce((s, l) => s + Number(l.primeNette ?? l.primeBrute ?? 0), 0);
    return { montantTotal, soldeDirection: null };
  }

  // NEW — per-BordereauType sequence key. See SequenceService for the prefix
  // table (BCC/BCR/BSF/BST/BFD/BNC/BET/BSI/BPD/BPA).
  private sequenceKeyFor(type: BordereauType): SequenceEntity {
    return `BORDEREAU_${type}` as SequenceEntity;
  }

  async create(dto: CreateBordereauDto, userId?: string) {
    const numero = await this.sequence.next(this.sequenceKeyFor(dto.type));
    const { montantTotal, soldeDirection } = this.computeMontant(dto.type, dto.lines ?? []);
    const montantEnLettres = this.amountToWords.toWords(montantTotal, dto.currency ?? 'TND');

    const b = await this.prisma.bordereau.create({
      data: {
        numero,
        type: dto.type,
        statut: BordereauStatut.BROUILLON,
        affaireId: dto.affaireId,
        situationId: dto.situationId,
        cedanteId: dto.cedanteId,
        reassureurCode: dto.reassureurCode,
        datePeriodeDebut: dto.datePeriodeDebut ? new Date(dto.datePeriodeDebut) : undefined,
        datePeriodeFin: dto.datePeriodeFin ? new Date(dto.datePeriodeFin) : undefined,
        dateLimitePaiement: dto.dateLimitePaiement ? new Date(dto.dateLimitePaiement) : undefined,
        currency: dto.currency ?? 'TND',
        notes: dto.notes,
        montantTotal,
        montantEnLettres,
        soldeDirection,
        createdByUserId: userId,
        lines: dto.lines ? { create: dto.lines.map((l, i) => ({
          ...l,
          periodeDebut: l.periodeDebut ? new Date(l.periodeDebut) : undefined,
          periodeFin: l.periodeFin ? new Date(l.periodeFin) : undefined,
          ordre: l.ordre ?? i + 1,
        })) } : undefined,
      },
      include: { lines: true },
    });

    await this.logAudit(userId, b.id, 'CREATE', `Bordereau ${b.numero} créé (${b.type})`);
    return b;
  }

  async update(id: string, dto: UpdateBordereauDto, userId?: string) {
    const existing = await this.findOne(id);
    if (existing.statut !== BordereauStatut.BROUILLON) {
      throw new BadRequestException('Seul un bordereau BROUILLON peut être modifié');
    }

    const effectiveType = (dto.type ?? existing.type) as BordereauType;
    const computed = dto.lines ? this.computeMontant(effectiveType, dto.lines) : null;
    const montantEnLettres = computed != null
      ? this.amountToWords.toWords(computed.montantTotal, dto.currency ?? existing.currency)
      : undefined;

    const b = await this.prisma.$transaction(async (tx) => {
      if (dto.lines) {
        await tx.bordereauLine.deleteMany({ where: { bordereauId: id } });
      }
      return tx.bordereau.update({
        where: { id },
        data: {
          type: dto.type,
          affaireId: dto.affaireId,
          situationId: dto.situationId,
          cedanteId: dto.cedanteId,
          reassureurCode: dto.reassureurCode,
          datePeriodeDebut: dto.datePeriodeDebut ? new Date(dto.datePeriodeDebut) : undefined,
          datePeriodeFin: dto.datePeriodeFin ? new Date(dto.datePeriodeFin) : undefined,
          dateLimitePaiement: dto.dateLimitePaiement ? new Date(dto.dateLimitePaiement) : undefined,
          currency: dto.currency,
          notes: dto.notes,
          ...(computed != null && {
            montantTotal: computed.montantTotal,
            montantEnLettres,
            soldeDirection: computed.soldeDirection,
          }),
          ...(dto.lines && {
            lines: { create: dto.lines.map((l, i) => ({
              ...l,
              periodeDebut: l.periodeDebut ? new Date(l.periodeDebut) : undefined,
              periodeFin: l.periodeFin ? new Date(l.periodeFin) : undefined,
              ordre: l.ordre ?? i + 1,
            })) },
          }),
        },
        include: { lines: true },
      });
    });

    await this.logAudit(userId, id, 'UPDATE', 'Bordereau modifié');
    return b;
  }

  async remove(id: string, userId?: string) {
    const b = await this.findOne(id);
    if (b.statut !== BordereauStatut.BROUILLON) {
      throw new BadRequestException('Seul un bordereau BROUILLON peut être supprimé — archivez-le sinon');
    }
    if (b.journalEntries?.length > 0) {
      throw new ForbiddenException('Ce bordereau a des écritures comptables liées et ne peut pas être supprimé');
    }
    await this.prisma.$transaction([
      this.prisma.bordereauLine.deleteMany({ where: { bordereauId: id } }),
      this.prisma.bordereau.delete({ where: { id } }),
    ]);
    await this.logAudit(userId, id, 'DELETE', `Bordereau ${b.numero} supprimé`);
    return { deleted: true };
  }

  // ============================================================
  // GENERATION
  // ============================================================

  async generate(dto: GenerateBordereauDto, userId?: string) {
    const affaire = await this.prisma.affaire.findUniqueOrThrow({
      where: { id: dto.affaireId },
      include: {
        cedante: true,
        facultativeData: { include: { guaranteeLines: true } },
        traiteData: { include: { accountRubriques: true } },
        reassureurs: { include: { reassureur: true } },
      },
    });

    if (affaire.statut !== 'PLACEMENT_REALISE') {
      throw new BadRequestException('L\'affaire doit être placée pour générer un bordereau');
    }

    const results: any[] = [];

    if (dto.type === BordereauType.CESSION_CEDANTE) {
      const b = await this.create({
        type: BordereauType.CESSION_CEDANTE,
        affaireId: affaire.id,
        cedanteId: affaire.cedanteId,
        currency: affaire.currency,
        datePeriodeDebut: dto.datePeriodeDebut,
        datePeriodeFin: dto.datePeriodeFin,
        dateLimitePaiement: dto.dateLimitePaiement,
        lines: this.buildCedanteLines(affaire),
      }, userId);
      results.push(b);

      try {
        await this.accounting.generateForFacultativeAffaire(affaire.id);
      } catch (err: any) {
        this.logger.error(`Accounting entry generation failed for affaire ${affaire.id}: ${err.message}`);
      }
    }

    if (dto.type === BordereauType.CESSION_REASSUREUR) {
      const targets = dto.reassureurId
        ? affaire.reassureurs.filter((r) => r.reassureurId === dto.reassureurId)
        : affaire.reassureurs;

      for (const r of targets) {
        const b = await this.create({
          type: BordereauType.CESSION_REASSUREUR,
          affaireId: affaire.id,
          reassureurCode: r.reassureur.code,
          currency: affaire.currency,
          datePeriodeDebut: dto.datePeriodeDebut,
          datePeriodeFin: dto.datePeriodeFin,
          dateLimitePaiement: dto.dateLimitePaiement,
          lines: this.buildReassureurLines(affaire, r),
        }, userId);
        results.push(b);
      }
    }

    if (dto.type === BordereauType.SINISTRE_FACULTATIVE) {
      const sinistres = await this.prisma.sinistre.findMany({
        where: {
          affaireId: dto.affaireId,
          statut: { in: ['VALIDE', 'DECLARE_REASSUREURS', 'EN_RECUPERATION', 'RECUPERE', 'CLOS'] },
          ...(dto.datePeriodeDebut && { dateSurvenance: { gte: new Date(dto.datePeriodeDebut) } }),
          ...(dto.datePeriodeFin && { dateSurvenance: { lte: new Date(dto.datePeriodeFin) } }),
        },
      });

      const b = await this.create({
        type: BordereauType.SINISTRE_FACULTATIVE,
        affaireId: dto.affaireId,
        datePeriodeDebut: dto.datePeriodeDebut,
        datePeriodeFin: dto.datePeriodeFin,
        dateLimitePaiement: dto.dateLimitePaiement,
        currency: affaire.currency,
        lines: sinistres.map((s, i) => ({
          libelle: `Sinistre ${s.numero} — ${new Date(s.dateSurvenance).toLocaleDateString('fr-TN')}`,
          sinistresPayes: Number(s.partReassureurs ?? 0),
          recConstitues: Number(s.reserves ?? 0),
          sapConstitues: Number(s.sap ?? 0),
          ordre: i + 1,
        })),
      }, userId);
      results.push(b);
    }

    if (results.length === 0) {
      throw new BadRequestException(
        `La génération automatique n'est pas implémentée pour le type ${dto.type}. Créez-le manuellement via POST /bordereaux.`,
      );
    }

    return results;
  }

  private buildCedanteLines(affaire: any): any[] {
    if (affaire.facultativeData) {
      const fac = affaire.facultativeData;
      return [{
        libelle: `${affaire.numero} — ${fac.garantie ?? 'Toutes garanties'}`,
        prime100: Number(fac.prime100Pct),
        tauxCession: Number(fac.tauxCession),
        primeBrute: Number(fac.primeCedee ?? 0),
        commissionCedante: Number(fac.commissionCedante ?? 0),
        commissionCourtage: affaire.reassureurs.reduce((s: number, r: any) => s + Number(r.commissionArs ?? 0), 0),
        primeNette: Number(fac.primeCedee ?? 0) - Number(fac.commissionCedante ?? 0) - affaire.reassureurs.reduce((s: number, r: any) => s + Number(r.commissionArs ?? 0), 0),
        ordre: 1,
      }];
    }
    if (affaire.traiteData) {
      return affaire.traiteData.accountRubriques.map((rub: any, i: number) => ({
        libelle: rub.rubrique,
        couverture: rub.compteReference,
        primeBrute: Number(affaire.traiteData.pmd ?? 0) / affaire.traiteData.accountRubriques.length,
        commissionCedante: 0,
        primeNette: Number(affaire.traiteData.pmd ?? 0) / affaire.traiteData.accountRubriques.length,
        ordre: i + 1,
      }));
    }
    return [];
  }

  private buildReassureurLines(affaire: any, reassureurParticipation: any): any[] {
    if (affaire.facultativeData) {
      return [{
        libelle: `Part ${reassureurParticipation.reassureur.code} (${reassureurParticipation.partPct}%)`,
        primeBrute: Number(reassureurParticipation.primeBrute ?? 0),
        commissionCedante: Number(reassureurParticipation.commissionCedante ?? 0),
        commissionCourtage: Number(reassureurParticipation.commissionArs ?? 0),
        primeNette: Number(reassureurParticipation.primeNetteReassureur ?? 0),
        ordre: 1,
      }];
    }
    return [{
      libelle: `Part traité ${reassureurParticipation.reassureur.code} (${reassureurParticipation.partPct}%)`,
      primeBrute: Number(affaire.traiteData?.pmd ?? 0) * (Number(reassureurParticipation.partPct) / 100),
      primeNette: Number(affaire.traiteData?.pmd ?? 0) * (Number(reassureurParticipation.partPct) / 100),
      ordre: 1,
    }];
  }

  // ============================================================
  // WORKFLOW TRANSITIONS
  // ============================================================

  private async requireStatus(id: string, expected: BordereauStatut | BordereauStatut[]) {
    const b = await this.prisma.bordereau.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Bordereau introuvable');
    const allowed = Array.isArray(expected) ? expected : [expected];
    if (!allowed.includes(b.statut)) {
      throw new BadRequestException(
        `Action impossible depuis le statut ${b.statut} (attendu: ${allowed.join(' ou ')})`,
      );
    }
    return b;
  }

  async submitForValidation(id: string, userId?: string) {
    await this.requireStatus(id, BordereauStatut.BROUILLON);
    const lines = await this.prisma.bordereauLine.count({ where: { bordereauId: id } });
    if (lines === 0) {
      throw new BadRequestException('Impossible de soumettre un bordereau sans lignes');
    }
    const b = await this.prisma.bordereau.update({
      where: { id },
      data: { statut: BordereauStatut.EN_VALIDATION },
    });
    await this.logAudit(userId, id, 'SUBMIT_VALIDATION', 'Soumis pour validation');
    return b;
  }

  async validate(id: string, userId?: string) {
    await this.requireStatus(id, BordereauStatut.EN_VALIDATION);
    const b = await this.prisma.bordereau.update({
      where: { id },
      data: {
        statut: BordereauStatut.VALIDE,
        dateValidation: new Date(),
        validatedByUserId: userId,
        rejectionReason: null,
      },
    });
    await this.logAudit(userId, id, 'VALIDATE', 'Bordereau validé');
    return b;
  }

  async reject(id: string, dto: RejectBordereauDto, userId?: string) {
    await this.requireStatus(id, BordereauStatut.EN_VALIDATION);
    const b = await this.prisma.bordereau.update({
      where: { id },
      data: { statut: BordereauStatut.BROUILLON, rejectionReason: dto.reason },
    });
    await this.logAudit(userId, id, 'REJECT', dto.reason);
    return b;
  }

  async send(id: string, dto: SendBordereauDto, userId?: string) {
    const existing = await this.requireStatus(id, BordereauStatut.VALIDE);
    const dateLimitePaiement =
      existing.dateLimitePaiement ??
      new Date(Date.now() + DEFAULT_PAYMENT_TERM_DAYS * 24 * 60 * 60 * 1000);

    const b = await this.prisma.bordereau.update({
      where: { id },
      data: {
        statut: BordereauStatut.EMIS,
        dateEnvoi: new Date(),
        dateLimitePaiement,
        recipients: dto.recipients,
      },
    });

    await this.email.send(
      dto.recipients,
      `ARS Tunisie — Bordereau ${b.numero}`,
      `<p>Veuillez trouver ci-joint le bordereau ${b.numero}.</p>`,
    );

    await this.logAudit(userId, id, 'SEND', `Envoyé à ${dto.recipients.join(', ')}`);
    return this.withDerived(b);
  }

  async sendReminder(id: string, userId?: string) {
    const b = await this.requireStatus(id, BordereauStatut.EMIS);
    if (!b.recipients?.length) {
      throw new BadRequestException('Aucun destinataire enregistré pour ce bordereau');
    }

    await this.email.send(
      b.recipients,
      `RAPPEL — ARS Tunisie — Bordereau ${b.numero}`,
      `<p>Rappel : le paiement du bordereau ${b.numero} est en attente.</p>`,
    );

    await this.logAudit(userId, id, 'SEND_REMINDER', `Rappel envoyé à ${b.recipients.join(', ')}`);
    return { sent: true };
  }

  async pay(id: string, dto: PayBordereauDto, userId?: string) {
    const b = await this.requireStatus(id, BordereauStatut.EMIS);
    const montantTotal = Number(b.montantTotal ?? 0);
    const newMontantRegle = Number(b.montantRegle) + dto.montant;
    const shouldClose = newMontantRegle >= montantTotal;

    const [payment, updated] = await this.prisma.$transaction([
      this.prisma.bordereauPayment.create({
        data: {
          bordereauId: id,
          montant: dto.montant,
          modePaiement: dto.modePaiement,
          datePaiement: new Date(dto.datePaiement),
          referenceBancaire: dto.referenceBancaire,
          notes: dto.notes,
          recordedByUserId: userId,
        },
      }),
      this.prisma.bordereau.update({
        where: { id },
        data: {
          montantRegle: newMontantRegle,
          ...(shouldClose && { statut: BordereauStatut.ACQUITTE }),
        },
      }),
    ]);

    await this.logAudit(
      userId, id, 'PAYMENT',
      `Paiement de ${dto.montant} ${b.currency} enregistré${shouldClose ? ' — bordereau acquitté' : ''}`,
    );
    return { payment, bordereau: this.withDerived(updated) };
  }

  async archive(id: string, userId?: string) {
    await this.requireStatus(id, BordereauStatut.ACQUITTE);
    const b = await this.prisma.bordereau.update({
      where: { id },
      data: { statut: BordereauStatut.ARCHIVE },
    });
    await this.logAudit(userId, id, 'ARCHIVE', 'Bordereau archivé');
    return b;
  }

  // ============================================================
  // BULK OPERATIONS
  // ============================================================

  private async bulk<T>(ids: string[], fn: (id: string) => Promise<T>) {
    const success: string[] = [];
    const failed: Array<{ id: string; error: string }> = [];
    for (const id of ids) {
      try {
        await fn(id);
        success.push(id);
      } catch (err: any) {
        failed.push({ id, error: err.message ?? 'Erreur inconnue' });
      }
    }
    return { success, failed };
  }

  bulkValidate(ids: string[], userId?: string) {
    return this.bulk(ids, (id) => this.validate(id, userId));
  }

  bulkArchive(ids: string[], userId?: string) {
    return this.bulk(ids, (id) => this.archive(id, userId));
  }

  bulkSend(ids: string[], recipients: string[], userId?: string) {
    return this.bulk(ids, (id) => this.send(id, { recipients }, userId));
  }

  async bulkGeneratePdf(ids: string[]) {
    const success: Array<{ id: string; fileName: string }> = [];
    const failed: Array<{ id: string; error: string }> = [];
    for (const id of ids) {
      try {
        const buffer = await this.generatePdf(id);
        const stored = await this.storage.saveFile(buffer, `bordereau-${id}.pdf`, 'bordereaux-pdf');
        success.push({ id, fileName: stored.fileName });
      } catch (err: any) {
        failed.push({ id, error: err.message ?? 'Erreur inconnue' });
      }
    }
    return { success, failed };
  }

  // ============================================================
  // PDF
  // ============================================================

  async generatePdf(id: string): Promise<Buffer> {
    const b = await this.findOne(id);
    const company = await this.prisma.companyProfile.findFirst();
    const template = resolveTemplate(b.type as BordereauType);

    return this.pdfGenerator.generate(template, {
      bordereau: b,
      company,
      title: TYPE_TITLES[b.type as BordereauType],
      generatedAt: new Date().toLocaleDateString('fr-TN'),
    }, { landscape: template === 'bordereau-traite' });
  }

  // ============================================================
  // DOCUMENTS
  // ============================================================

  async getDocuments(bordereauId: string) {
    return this.prisma.documentLink.findMany({
      where: {
        bordereauId,
        document: { statut: { not: DocumentStatut.REJETE } },
      },
      include: { document: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async uploadDocument(
    bordereauId: string,
    file: UploadedFile,
    dto: AttachDocumentDto,
    userId?: string,
  ) {
    await this.findOne(bordereauId);

    const stored = await this.storage.saveFile(file.buffer, file.originalname, 'bordereaux');

    const document = await this.prisma.document.create({
      data: {
        nom: file.originalname,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        filePath: stored.filePath,
        documentType: dto.documentType,
        statut: DocumentStatut.RECU,
        uploadedById: userId,
        links: {
          create: {
            entityType: 'BORDEREAU',
            bordereauId,
          },
        },
      },
      include: { links: true },
    });

    await this.logAudit(userId, bordereauId, 'DOCUMENT_UPLOAD', `Document "${file.originalname}" ajouté`);
    return document;
  }

  async deleteDocument(bordereauId: string, documentLinkId: string, userId?: string) {
    const link = await this.prisma.documentLink.findUnique({ where: { id: documentLinkId } });
    if (!link || link.bordereauId !== bordereauId) {
      throw new NotFoundException('Document introuvable pour ce bordereau');
    }

    let orphanFilePath: string | null = null;

    const result = await this.prisma.$transaction(async (tx) => {
      const deletedLink = await tx.documentLink.delete({ where: { id: documentLinkId } });
      const remainingLinks = await tx.documentLink.count({ where: { documentId: deletedLink.documentId } });

      if (remainingLinks === 0) {
        const document = await tx.document.findUnique({ where: { id: deletedLink.documentId } });
        if (document) {
          orphanFilePath = document.filePath;
          await tx.documentAccessLog.deleteMany({ where: { documentId: document.id } });
          await tx.documentVersion.deleteMany({ where: { documentId: document.id } });
          await tx.documentShare.deleteMany({ where: { documentId: document.id } });
          await tx.document.delete({ where: { id: document.id } });
        }
      }

      return deletedLink;
    });

    if (orphanFilePath) {
      await this.storage.deleteFile(orphanFilePath);
    }

    await this.logAudit(userId, bordereauId, 'DOCUMENT_DELETE', 'Document retiré');
    return { deleted: true, link: result };
  }

  async validateDocuments(bordereauId: string) {
    const links = await this.prisma.documentLink.findMany({
      where: {
        bordereauId,
        document: { statut: { not: DocumentStatut.REJETE } },
      },
      include: { document: true },
    });

    const complete = links.length > 0;
    return {
      complete,
      missing: complete ? [] : ['Aucun document attaché'],
    };
  }

  // ============================================================
  // HISTORY
  // ============================================================

  async getHistory(bordereauId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: { entityType: 'Bordereau', entityId: bordereauId },
      orderBy: { createdAt: 'desc' },
    });
    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
    const users = userIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nom: true, prenom: true } })
      : [];
    const userMap = new Map(users.map((u) => [u.id, `${u.prenom} ${u.nom}`]));

    return logs.map((l) => ({
      date: l.createdAt,
      action: l.action,
      user: l.userId ? userMap.get(l.userId) ?? 'Utilisateur inconnu' : 'Système',
      details: (l.after as any)?.message ?? undefined,
    }));
  }

  // ============================================================
  // STATISTICS / REPORTS
  // ============================================================

  async getStatistics(filters: { cedanteId?: string; reassureurCode?: string; startDate?: string; endDate?: string }) {
    const where: Prisma.BordereauWhereInput = {};
    if (filters.cedanteId) where.cedanteId = filters.cedanteId;
    if (filters.reassureurCode) where.reassureurCode = filters.reassureurCode;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate && { gte: new Date(filters.startDate) }),
        ...(filters.endDate && { lte: new Date(filters.endDate) }),
      };
    }

    const [total, byType, byStatut, sums, overdueCount] = await Promise.all([
      this.prisma.bordereau.count({ where }),
      this.prisma.bordereau.groupBy({ by: ['type'], where, _count: true }),
      this.prisma.bordereau.groupBy({ by: ['statut'], where, _count: true }),
      this.prisma.bordereau.aggregate({
        where,
        _sum: { montantTotal: true, montantRegle: true },
      }),
      this.prisma.bordereau.count({
        where: { ...where, statut: BordereauStatut.EMIS, dateLimitePaiement: { lt: new Date() } },
      }),
    ]);

    const totalMontant = Number(sums._sum.montantTotal ?? 0);
    const totalRegle = Number(sums._sum.montantRegle ?? 0);

    return {
      total,
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count])),
      byStatus: Object.fromEntries(byStatut.map((s) => [s.statut, s._count])),
      totalMontant,
      totalRegle,
      totalSolde: totalMontant - totalRegle,
      overdue: overdueCount,
    };
  }

  async getAgingReport() {
    const emis = await this.prisma.bordereau.findMany({
      where: { statut: BordereauStatut.EMIS },
      select: { montantTotal: true, montantRegle: true, dateLimitePaiement: true },
    });
    const now = Date.now();
    const buckets = {
      current: { count: 0, amount: 0 },
      days_1_30: { count: 0, amount: 0 },
      days_31_60: { count: 0, amount: 0 },
      days_61_90: { count: 0, amount: 0 },
      over_90: { count: 0, amount: 0 },
    };
    for (const b of emis) {
      const solde = Number(b.montantTotal ?? 0) - Number(b.montantRegle ?? 0);
      if (solde <= 0) continue;
      const daysLate = b.dateLimitePaiement ? Math.floor((now - b.dateLimitePaiement.getTime()) / 86_400_000) : -1;
      let bucket: keyof typeof buckets = 'current';
      if (daysLate > 90) bucket = 'over_90';
      else if (daysLate > 60) bucket = 'days_61_90';
      else if (daysLate > 30) bucket = 'days_31_60';
      else if (daysLate > 0) bucket = 'days_1_30';
      buckets[bucket].count += 1;
      buckets[bucket].amount += solde;
    }
    return buckets;
  }

  async getVolumeMetrics(startDate: string, endDate: string) {
    const where: Prisma.BordereauWhereInput = {
      createdAt: { gte: new Date(startDate), lte: new Date(endDate) },
    };
    const [total, byType, byStatut, sums, sentBordereaux] = await Promise.all([
      this.prisma.bordereau.count({ where }),
      this.prisma.bordereau.groupBy({ by: ['type'], where, _count: true }),
      this.prisma.bordereau.groupBy({ by: ['statut'], where, _count: true }),
      this.prisma.bordereau.aggregate({ where, _sum: { montantTotal: true } }),
      this.prisma.bordereau.findMany({
        where: { ...where, dateEnvoi: { not: null } },
        select: { createdAt: true, dateEnvoi: true },
      }),
    ]);

    const avgProcessingTime = sentBordereaux.length
      ? sentBordereaux.reduce((s, b) => s + (b.dateEnvoi!.getTime() - b.createdAt.getTime()), 0) /
        sentBordereaux.length / 86_400_000
      : 0;

    return {
      total_generated: total,
      by_type: Object.fromEntries(byType.map((t) => [t.type, t._count])),
      by_status: Object.fromEntries(byStatut.map((s) => [s.statut, s._count])),
      avg_processing_time: Math.round(avgProcessingTime * 10) / 10,
      total_amount: Number(sums._sum.montantTotal ?? 0),
    };
  }

  async getOverdue() {
    const list = await this.prisma.bordereau.findMany({
      where: { statut: BordereauStatut.EMIS, dateLimitePaiement: { lt: new Date() } },
      include: { cedante: { select: { raisonSociale: true } } },
      orderBy: { dateLimitePaiement: 'asc' },
    });
    return list.map((b) => this.withDerived(b)).filter((b) => b.solde > 0);
  }

  async getDueSoon(days = 7) {
    const now = new Date();
    const horizon = new Date(now.getTime() + days * 86_400_000);
    const list = await this.prisma.bordereau.findMany({
      where: {
        statut: BordereauStatut.EMIS,
        dateLimitePaiement: { gte: now, lte: horizon },
      },
      include: { cedante: { select: { raisonSociale: true } } },
      orderBy: { dateLimitePaiement: 'asc' },
    });
    return list.map((b) => this.withDerived(b)).filter((b) => b.solde > 0);
  }
}