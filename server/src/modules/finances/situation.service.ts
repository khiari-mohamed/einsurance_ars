import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { SituationSoldeDirection } from '@prisma/client';
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

    const reference = await this.sequence.next('SITUATION');
    const dateDebut = new Date(dto.dateDebut);
    const dateFin = new Date(dto.dateFin);

    // Gather all affaires for this cedante in the period with modePaiement = PAR_SITUATION
    const whereClause: any = {
      cedanteId: dto.cedanteId,
      isActive: true,
      statut: 'PLACEMENT_REALISE',
      modePaiement: 'PAR_SITUATION',
    };

    // If filtering by treaty, add the traiteData relation filter
    if (dto.traiteId) {
      whereClause.traiteData = {
        is: {
          traiteId: dto.traiteId,
        },
      };
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

    // Compute DEBIT (primes) and CREDIT (sinistres) per affaire
    let totalDebit = 0;
    let totalCredit = 0;

    const lines = await Promise.all(affaires.map(async (a) => {
      // Debit side: prime cédée nette de commission cedante
      const debit = a.facultativeData
        ? Number(a.facultativeData.primeCedee ?? 0) - Number(a.facultativeData.commissionCedante ?? 0)
        : await (async () => {
            if (!a.traiteData) return 0;
            const dueInstalments = await this.prisma.pmdInstalment.findMany({
              where: {
                traiteId: a.traiteData.id,
                dateEcheance: { gte: dateDebut, lte: dateFin },
              },
            });
            return dueInstalments.reduce((s, inst) => s + Number(inst.montant), 0);
          })();

      // Credit side: sum of sinistre reserves in period
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
    else if (soldeNet > 0) soldeDirection = SituationSoldeDirection.CEDANTE_DOIT; // cedante owes ARS
    else soldeDirection = SituationSoldeDirection.ARS_DOIT; // ARS owes via reinsurers

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

    // Create inter-department handoff task (chargé de dossier → DAF)
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
    return this.prisma.situation.delete({ where: { id } });
  }
}