import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SituationSoldeDirection, WorkflowTaskStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { NotificationService } from '../../shared/services/notification.service';
import { CreateSituationDto } from './dto/create-situation.dto';

@Injectable()
export class SituationService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private notification: NotificationService,
  ) {}

  async findAll(cedanteId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (cedanteId) where.cedanteId = cedanteId;
    const [data, total] = await Promise.all([
      this.prisma.situation.findMany({
        where,
        include: {
          cedante: { select: { code: true, raisonSociale: true } },
          traite: { select: { referenceTraite: true, periodicite: true } },
          lines: true,
          _count: { select: { settlements: true, bordereaux: true } },
        },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.situation.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const s = await this.prisma.situation.findUnique({
      where: { id },
      include: {
        cedante: true,
        traite: { include: { accountRubriques: true } },
        lines: { include: { affaire: { select: { numero: true, type: true } } } },
        settlements: true,
        bordereaux: true,
        workflowTasks: { where: { statut: 'EN_ATTENTE' } },
      },
    });
    if (!s) throw new NotFoundException('Situation introuvable');
    return s;
  }

  async create(dto: CreateSituationDto, userId: string) {
    const cedante = await this.prisma.cedante.findUnique({ where: { id: dto.cedanteId } });
    if (!cedante) throw new NotFoundException('Cédante introuvable');

    const dateDebut = new Date(dto.dateDebut);
    const dateFin = new Date(dto.dateFin);
    if (dateDebut >= dateFin) {
      throw new BadRequestException('La date de début doit être antérieure à la date de fin');
    }

    // FIX (Finances pass, new): nothing previously prevented compiling two
    // overlapping situations for the same cedante(/traité) — the same
    // affaires' primes/sinistres would then be double-counted across both.
    const overlapping = await this.prisma.situation.findFirst({
      where: {
        cedanteId: dto.cedanteId,
        ...(dto.traiteId ? { traiteId: dto.traiteId } : {}),
        dateDebut: { lte: dateFin },
        dateFin: { gte: dateDebut },
      },
    });
    if (overlapping) {
      throw new BadRequestException(
        `Une situation existe déjà pour cette période (${overlapping.reference}, ${overlapping.dateDebut.toLocaleDateString('fr-FR')} → ${overlapping.dateFin.toLocaleDateString('fr-FR')})`,
      );
    }

    const reference = await this.sequence.next('SITUATION');

    const whereClause: any = {
      cedanteId: dto.cedanteId,
      isActive: true,
      statut: 'PLACEMENT_REALISE',
      modePaiement: 'PAR_SITUATION',
    };
    if (dto.traiteId) {
      whereClause.traiteData = { is: { traiteId: dto.traiteId } };
    }

    const affaires = await this.prisma.affaire.findMany({
      where: whereClause,
      include: {
        facultativeData: true,
        traiteData: true,
        reassureurs: true,
        sinistres: {
          where: {
            dateSurvenance: { gte: dateDebut, lte: dateFin },
            statut: { in: ['VALIDE', 'DECLARE_REASSUREURS', 'EN_RECUPERATION', 'RECUPERE'] },
          },
        },
      },
    });

    if (affaires.length === 0) {
      throw new BadRequestException('Aucune affaire éligible pour cette situation (mode paiement: PAR_SITUATION)');
    }

    let totalDebit = 0;
    let totalCredit = 0;

    const lines = await Promise.all(affaires.map(async (a) => {
      const debit = a.facultativeData
        ? Number(a.facultativeData.primeCedee ?? 0) - Number(a.facultativeData.commissionCedante ?? 0)
        : await (async () => {
            if (!a.traiteData) return 0;
            // FIX (Finances pass): PMD instalments due in the period were
            // included regardless of isPaid — an instalment already paid
            // via TraitesService.markInstalmentPaid() (which creates its
            // own Encaissement directly) got folded into the situation's
            // totalDebit a SECOND time, double-counting money that was
            // already collected outside the situation flow.
            const dueInstalments = await this.prisma.pmdInstalment.findMany({
              where: {
                traiteId: a.traiteData.id,
                dateEcheance: { gte: dateDebut, lte: dateFin },
                isPaid: false,
              },
            });
            return dueInstalments.reduce((s, inst) => s + Number(inst.montant), 0);
          })();

      const credit = a.sinistres.reduce((s, sin) => s + Number(sin.partReassureurs ?? 0), 0);

      const solde = Math.round((debit - credit) * 1000) / 1000;
      totalDebit += debit;
      totalCredit += credit;

      return {
        affaireId: a.id,
        debit: Math.round(debit * 1000) / 1000,
        credit: Math.round(credit * 1000) / 1000,
        solde,
        description: a.numero,
      };
    }));

    const soldeNet = Math.round((totalDebit - totalCredit) * 1000) / 1000;
    let soldeDirection: SituationSoldeDirection;
    if (Math.abs(soldeNet) < 0.001) soldeDirection = SituationSoldeDirection.EQUILIBRE;
    else if (soldeNet > 0) soldeDirection = SituationSoldeDirection.CEDANTE_DOIT;
    else soldeDirection = SituationSoldeDirection.ARS_DOIT;

    const situation = await this.prisma.situation.create({
      data: {
        reference,
        cedanteId: dto.cedanteId,
        traiteId: dto.traiteId,
        dateDebut,
        dateFin,
        periodicite: dto.periodicite,
        currency: dto.currency ?? 'TND',
        totalDebit: Math.round(totalDebit * 1000) / 1000,
        totalCredit: Math.round(totalCredit * 1000) / 1000,
        soldeNet,
        soldeDirection,
        lines: { create: lines },
      },
      include: {
        cedante: true,
        lines: { include: { affaire: { select: { numero: true } } } },
      },
    });

    await this.prisma.workflowTask.create({
      data: {
        type: 'INTER_DEPARTEMENT_HANDOFF',
        statut: 'EN_ATTENTE',
        situationId: situation.id,
        description: `Situation ${reference} compilée — solde ${soldeNet > 0 ? '+' : ''}${soldeNet} TND (${soldeDirection}). Transmission à la DAF requise.`,
        createdById: userId,
      },
    });

    this.notification.notifyRole(
      'DAF',
      'SITUATION_COMPILEE',
      `Nouvelle situation: ${reference}`,
      `La situation ${reference} pour ${cedante.raisonSociale} a été compilée. Solde: ${soldeNet} TND (${soldeDirection}).`,
      { situationId: situation.id },
    );

    return situation;
  }

  async delete(id: string) {
    const s = await this.findOne(id);

    const settled = await this.prisma.settlement.count({ where: { situationId: id } });
    if (settled > 0) throw new BadRequestException('Impossible de supprimer une situation avec des règlements');

    // FIX (Finances pass): bordereaux (Situation.bordereaux relation) were
    // never checked — a situation with bordereaux already generated
    // against it could be deleted, orphaning them.
    const bordereauxCount = await this.prisma.bordereau.count({ where: { situationId: id } });
    if (bordereauxCount > 0) throw new BadRequestException('Impossible de supprimer une situation avec des bordereaux générés');

    // Pending handoff task becomes moot once the situation it references is
    // gone — cancel it rather than leaving a dangling reference or blocking
    // deletion outright (this is a legitimate "compiled by mistake, redo
    // it" path with no money moved yet, unlike the two guards above).
    await this.prisma.workflowTask.updateMany({
      where: { situationId: id, statut: { in: [WorkflowTaskStatut.EN_ATTENTE, WorkflowTaskStatut.EN_COURS] } },
      data: { statut: WorkflowTaskStatut.ANNULE },
    });

    return this.prisma.situation.delete({ where: { id } });
  }
}