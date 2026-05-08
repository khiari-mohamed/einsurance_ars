import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { BordereauStatut, BordereauType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { AmountToWordsService } from '../../shared/services/amount-to-words.service';
import { PdfService } from '../../shared/services/pdf.service';
import { AccountingEngineService } from '../comptabilite/accounting-engine.service';
import { CreateBordereauDto } from './dto/create-bordereau.dto';
import { GenerateBordereauDto } from './dto/generate-bordereau.dto';

@Injectable()
export class BordereauxService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private amountToWords: AmountToWordsService,
    private pdf: PdfService,
    private accounting: AccountingEngineService,
  ) {}

  async findAll(filters: { affaireId?: string; type?: BordereauType; statut?: BordereauStatut; page?: number; limit?: number }) {
    const { affaireId, type, statut, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (affaireId) where.affaireId = affaireId;
    if (type) where.type = type;
    if (statut) where.statut = statut;
    const [data, total] = await Promise.all([
      this.prisma.bordereau.findMany({
        where,
        include: {
          affaire: { select: { numero: true, type: true } },
          _count: { select: { lines: true } },
        },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.bordereau.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const b = await this.prisma.bordereau.findUnique({
      where: { id },
      include: {
        affaire: { include: { cedante: true, reassureurs: { include: { reassureur: true } } } },
        situation: { include: { cedante: true } },
        lines: { orderBy: { ordre: 'asc' } },
        journalEntries: true,
        documents: { include: { document: true } },
      },
    });
    if (!b) throw new NotFoundException('Bordereau introuvable');
    return b;
  }

  async create(dto: CreateBordereauDto) {
    const numero = await this.sequence.next('BORDEREAU');
    const montantTotal = dto.lines?.reduce((s, l) => s + (l.primeNette ?? l.primeBrute ?? 0), 0) ?? 0;
    const montantEnLettres = this.amountToWords.toWords(montantTotal, dto.currency ?? 'TND');

    return this.prisma.bordereau.create({
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
        currency: dto.currency ?? 'TND',
        montantTotal,
        montantEnLettres,
        lines: dto.lines ? { create: dto.lines.map((l, i) => ({
          ...l,
          periodeDebut: l.periodeDebut ? new Date(l.periodeDebut) : undefined,
          periodeFin: l.periodeFin ? new Date(l.periodeFin) : undefined,
          ordre: l.ordre ?? i + 1,
        })) } : undefined,
      },
      include: { lines: true },
    });
  }

  /**
   * Auto-generate a bordereau from an affaire's data.
   * CESSION_CEDANTE: one bordereau for the cedante (note de débit)
   * CESSION_REASSUREUR: one bordereau per reinsurer OR one specific if reassureurId given
   */
  async generate(dto: GenerateBordereauDto) {
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
        lines: this.buildCedanteLines(affaire),
      });
      results.push(b);

      // Auto-generate accounting entry
      await this.accounting.generateForFacultativeAffaire(affaire.id).catch(() => null);
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
          lines: this.buildReassureurLines(affaire, r),
        });
        results.push(b);
      }
    }

    return results;
  }

  async emit(id: string) {
    const b = await this.findOne(id);
    if (b.statut !== BordereauStatut.BROUILLON) {
      throw new BadRequestException('Seul un bordereau BROUILLON peut être émis');
    }
    return this.prisma.bordereau.update({
      where: { id },
      data: { statut: BordereauStatut.EMIS, dateEmission: new Date() },
    });
  }

  async markAcquitte(id: string) {
    const b = await this.findOne(id);
    if (b.statut !== BordereauStatut.EMIS) {
      throw new BadRequestException('Seul un bordereau EMIS peut être acquitté');
    }
    return this.prisma.bordereau.update({ where: { id }, data: { statut: BordereauStatut.ACQUITTE } });
  }

  async generatePdf(id: string): Promise<Buffer> {
    const b = await this.findOne(id);
    const company = await this.prisma.companyProfile.findFirst();
    const template = b.type === BordereauType.CESSION_CEDANTE ? 'bordereau-cedante' : 'bordereau-reassureur';
    return this.pdf.generateFromTemplate(template, { bordereau: b, company });
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
      const fac = affaire.facultativeData;
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
}