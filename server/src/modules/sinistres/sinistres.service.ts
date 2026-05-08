import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SinistreStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { SinistreValidationService } from './sinistre-validation.service';
import { SinistreNotificationService } from './sinistre-notification.service';
import { CashCallService } from './cash-call.service';
import { CreateSinistreDto } from './dto/create-sinistre.dto';
import { UpdateSinistreDto } from './dto/update-sinistre.dto';
import { CreateCashCallDto } from './dto/cash-call.dto';
import { AdjustSapDto } from './dto/adjust-sap.dto';
import { CashCallStatut } from '@prisma/client';

@Injectable()
export class SinistresService {
  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
    private validation: SinistreValidationService,
    private notificationSvc: SinistreNotificationService,
    private cashCallSvc: CashCallService,
  ) {}

  async findAll(filters: {
    affaireId?: string;
    statut?: SinistreStatut;
    cedanteId?: string;
    page?: number;
    limit?: number;
  }) {
    const { affaireId, statut, cedanteId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (affaireId) where.affaireId = affaireId;
    if (statut) where.statut = statut;
    if (cedanteId) where.affaire = { cedanteId };

    const [data, total] = await Promise.all([
      this.prisma.sinistre.findMany({
        where,
        include: {
          affaire: { include: { cedante: { select: { code: true, raisonSociale: true } } } },
          cashCall: true,
          participations: true,
          events: { orderBy: { date: 'desc' }, take: 1 },
        },
        skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.sinistre.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const s = await this.prisma.sinistre.findUnique({
      where: { id },
      include: {
        affaire: {
          include: {
            cedante: true,
            reassureurs: { include: { reassureur: true } },
            traiteData: true,
            facultativeData: true,
          },
        },
        events: { orderBy: { date: 'asc' } },
        cashCall: true,
        participations: true,
        journalEntries: { orderBy: { createdAt: 'desc' }, take: 5 },
        documents: { include: { document: true } },
        auditRecords: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!s) throw new NotFoundException('Sinistre introuvable');
    return s;
  }

  async create(dto: CreateSinistreDto, userId: string) {
    // Validate affaire exists and is placed
    const affaire = await this.prisma.affaire.findUnique({
      where: { id: dto.affaireId },
      include: { reassureurs: { include: { reassureur: true } } },
    });
    if (!affaire || !affaire.isActive) throw new NotFoundException('Affaire introuvable');
    if (affaire.statut !== 'PLACEMENT_REALISE') {
      throw new BadRequestException('Impossible d\'enregistrer un sinistre sur une affaire non placée');
    }

    const numero = await this.sequence.next('SINISTRE');

    const sinistre = await this.prisma.sinistre.create({
      data: {
        numero,
        affaireId: dto.affaireId,
        statut: SinistreStatut.DECLARE,
        numerPolice: dto.numerPolice,
        periodeCouverture: dto.periodeCouverture,
        dateSurvenance: new Date(dto.dateSurvenance),
        reglementExerciceN: dto.reglementExerciceN,
        cumulReglementAnterieurs: dto.cumulReglementAnterieurs,
        reserves: dto.reserves,
        partReassureurs: dto.partReassureurs,
        appelAuComptant: dto.appelAuComptant ?? false,
      },
      include: { affaire: { include: { cedante: true } } },
    });

    // Add initial event to timeline
    await this.prisma.sinistreEvent.create({
      data: {
        sinistreId: sinistre.id,
        actorId: userId,
        actorLabel: 'Direction Réassurance',
        action: 'Déclaration reçue cédante',
        note: `Sinistre déclaré le ${new Date().toLocaleDateString('fr-TN')}`,
      },
    });

    // Audit
    await this.prisma.sinistreAudit.create({
      data: {
        sinistreId: sinistre.id,
        action: 'CREATED',
        after: { numero, statut: SinistreStatut.DECLARE },
        userId,
      },
    });

    return sinistre;
  }

  async update(id: string, dto: UpdateSinistreDto, userId: string) {
    const s = await this.findOne(id);
    if (s.statut === SinistreStatut.CLOS || s.statut === SinistreStatut.REJETE) {
      throw new BadRequestException('Impossible de modifier un sinistre clos ou rejeté');
    }

    const before = { reserves: s.reserves, partReassureurs: s.partReassureurs };
    const updated = await this.prisma.sinistre.update({
      where: { id },
      data: {
        ...(dto.reglementExerciceN !== undefined && { reglementExerciceN: dto.reglementExerciceN }),
        ...(dto.cumulReglementAnterieurs !== undefined && { cumulReglementAnterieurs: dto.cumulReglementAnterieurs }),
        ...(dto.reserves !== undefined && { reserves: dto.reserves }),
        ...(dto.partReassureurs !== undefined && { partReassureurs: dto.partReassureurs }),
        ...(dto.periodeCouverture !== undefined && { periodeCouverture: dto.periodeCouverture }),
        ...(dto.numerPolice !== undefined && { numerPolice: dto.numerPolice }),
        ...(dto.recoveryMethod !== undefined && { recoveryMethod: dto.recoveryMethod }),
      },
    });

    await Promise.all([
      this.prisma.sinistreEvent.create({
        data: {
          sinistreId: id, actorId: userId,
          actorLabel: 'Direction Réassurance',
          action: 'Dossier mis à jour',
        },
      }),
      this.prisma.sinistreAudit.create({
        data: { sinistreId: id, action: 'UPDATED', before, after: dto as any, userId },
      }),
    ]);

    return updated;
  }

  async adjustSap(id: string, dto: AdjustSapDto, userId: string) {
    const s = await this.findOne(id);
    const before = { sap: s.sap };
    await this.prisma.$transaction([
      this.prisma.sinistre.update({ where: { id }, data: { sap: dto.sap } }),
      this.prisma.sinistreEvent.create({
        data: {
          sinistreId: id, actorId: userId,
          actorLabel: 'SERVICE_IRDS',
          action: `SAP ajusté: ${dto.sap} TND`,
          note: dto.note,
        },
      }),
      this.prisma.sinistreAudit.create({
        data: { sinistreId: id, action: 'SAP_ADJUSTED', before, after: { sap: dto.sap }, userId },
      }),
    ]);
    return this.findOne(id);
  }

  // ── Workflow delegation ──────────────────────────────────────────
  submitForValidation(id: string, userId: string, note?: string) {
    return this.validation.submitForValidation(id, userId, note);
  }

  approve(id: string, userId: string, note?: string) {
    return this.validation.approve(id, userId, note);
  }

  reject(id: string, userId: string, motif: string) {
    return this.validation.reject(id, userId, motif);
  }

  declareToReassureurs(id: string, userId: string, note?: string) {
    return this.notificationSvc.declareToReassureurs(id, userId, note);
  }

  markInRecovery(id: string, userId: string, note?: string) {
    return this.notificationSvc.markInRecovery(id, userId, note);
  }

  close(id: string, userId: string, note?: string) {
    return this.notificationSvc.close(id, userId, note);
  }

  triggerCashCall(id: string, dto: CreateCashCallDto, userId: string) {
    return this.cashCallSvc.trigger(id, dto, userId);
  }

  advanceCashCall(id: string, statut: CashCallStatut, userId: string, note?: string) {
    return this.cashCallSvc.advanceStatut(id, statut, userId, note);
  }

  getEvents(sinistreId: string) {
    return this.prisma.sinistreEvent.findMany({
      where: { sinistreId },
      include: { actor: { select: { nom: true, prenom: true, role: true } } },
      orderBy: { date: 'asc' },
    });
  }
}