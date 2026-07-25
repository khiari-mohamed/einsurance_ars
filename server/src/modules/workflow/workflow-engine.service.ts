import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AffaireStatut, ModeRenouvellement, Periodicite, WorkflowTaskStatut, WorkflowTaskType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../shared/services/notification.service';
import { EmailService } from '../../shared/services/email.service';
import { CreateWorkflowTaskDto } from './dto/create-workflow-task.dto';

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
    private email: EmailService,
  ) {}

  async getTasks(filters: {
    assignedToId?: string;
    type?: WorkflowTaskType;
    statut?: WorkflowTaskStatut;
    affaireId?: string;
    page?: number;
    limit?: number;
  }) {
    const { assignedToId, type, statut, affaireId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (assignedToId) where.assignedToId = assignedToId;
    if (type) where.type = type;
    if (statut) where.statut = statut;
    if (affaireId) where.affaireId = affaireId;

    const [data, total] = await Promise.all([
      this.prisma.workflowTask.findMany({
        where,
        include: {
          affaire: { select: { numero: true, type: true, cedante: { select: { raisonSociale: true } } } },
          assignedTo: { select: { nom: true, prenom: true, email: true } },
          createdBy: { select: { nom: true, prenom: true } },
        },
        skip, take: limit,
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      }),
      this.prisma.workflowTask.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  /**
   * FIX (Workflow pass, new): manual task creation was entirely absent —
   * needed for ad-hoc tasks like a chargé de dossier → DAF handoff
   * (INTER_DEPARTEMENT_HANDOFF) that don't yet have an automated trigger
   * (that lives in the not-yet-reviewed Finances/Sinistres modules).
   */
  async createTask(dto: CreateWorkflowTaskDto, creatorUserId: string) {
    if (dto.affaireId) {
      const affaire = await this.prisma.affaire.findUnique({ where: { id: dto.affaireId } });
      if (!affaire || !affaire.isActive) throw new NotFoundException('Affaire introuvable');
    }
    if (dto.assignedToId) {
      const user = await this.prisma.user.findUnique({ where: { id: dto.assignedToId } });
      if (!user || !user.isActive) throw new BadRequestException('Utilisateur assigné introuvable ou inactif');
    }

    const task = await this.prisma.workflowTask.create({
      data: {
        type: dto.type,
        statut: dto.assignedToId ? WorkflowTaskStatut.EN_COURS : WorkflowTaskStatut.EN_ATTENTE,
        affaireId: dto.affaireId,
        assignedToId: dto.assignedToId,
        createdById: creatorUserId,
        description: dto.description,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });

    if (dto.assignedToId) {
      this.notification.notifyUser(
        dto.assignedToId,
        'TASK_ASSIGNED',
        `Tâche assignée: ${task.type}`,
        `Vous avez été assigné à: ${task.description ?? task.type}`,
        { taskId: task.id },
      );
    }

    return task;
  }

  /**
   * Assign (or self-claim, when assigneeUserId === actorUserId) a task.
   * FIX (Workflow pass): added actorUserId for audit logging — previously
   * NO AuditLog entry was ever recorded for any task lifecycle action,
   * unlike every other write path in the app.
   */
  async assignTask(taskId: string, assigneeUserId: string, actorUserId?: string) {
    const task = await this.prisma.workflowTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tâche introuvable');

    const user = await this.prisma.user.findUnique({ where: { id: assigneeUserId } });
    if (!user || !user.isActive) throw new BadRequestException('Utilisateur introuvable ou inactif');

    const updated = await this.prisma.workflowTask.update({
      where: { id: taskId },
      data: { assignedToId: assigneeUserId, statut: WorkflowTaskStatut.EN_COURS },
    });

    if (actorUserId) {
      await this.prisma.auditLog.create({
        data: {
          userId: actorUserId,
          action: actorUserId === assigneeUserId ? 'WORKFLOW_TASK_CLAIMED' : 'WORKFLOW_TASK_ASSIGNED',
          entityType: 'WorkflowTask',
          entityId: taskId,
          before: { assignedToId: task.assignedToId, statut: task.statut },
          after: { assignedToId: assigneeUserId, statut: WorkflowTaskStatut.EN_COURS },
        },
      });
    }

    this.notification.notifyUser(
      assigneeUserId,
      'TASK_ASSIGNED',
      `Tâche assignée: ${task.type}`,
      `Vous avez été assigné à: ${task.description ?? task.type}`,
      { taskId },
    );

    return updated;
  }

  /**
   * FIX (Workflow pass): `note` was accepted as a parameter but silently
   * dropped — WorkflowTask has no dedicated notes field. Appended into
   * `description` instead, so the text the user typed isn't lost. Also
   * added the audit log entry that was missing entirely.
   */
  async completeTask(taskId: string, userId: string, note?: string) {
    const task = await this.prisma.workflowTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tâche introuvable');
    if (task.statut === WorkflowTaskStatut.COMPLETE) {
      throw new BadRequestException('Tâche déjà terminée');
    }

    const description = note
      ? `${task.description ?? ''}${task.description ? '\n' : ''}[Terminée le ${new Date().toLocaleDateString('fr-FR')}] ${note}`
      : task.description;

    const updated = await this.prisma.workflowTask.update({
      where: { id: taskId },
      data: { statut: WorkflowTaskStatut.COMPLETE, completedAt: new Date(), description },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'WORKFLOW_TASK_COMPLETED',
        entityType: 'WorkflowTask',
        entityId: taskId,
        before: { statut: task.statut },
        after: { statut: WorkflowTaskStatut.COMPLETE, note },
      },
    });

    return updated;
  }

  async cancelTask(taskId: string, userId?: string) {
    const task = await this.prisma.workflowTask.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tâche introuvable');

    const updated = await this.prisma.workflowTask.update({
      where: { id: taskId },
      data: { statut: WorkflowTaskStatut.ANNULE },
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: 'WORKFLOW_TASK_CANCELLED',
          entityType: 'WorkflowTask',
          entityId: taskId,
          before: { statut: task.statut },
          after: { statut: WorkflowTaskStatut.ANNULE },
        },
      });
    }

    return updated;
  }

  /**
   * FIX (Workflow pass, new): the "Historique Workflow" page had NO backing
   * endpoint at all (frontend was a static placeholder). Surfaces the
   * Affaire lifecycle AuditLog entries already written by AffairesService
   * and AffaireWorkflowService (AFFAIRE_CREATED, AFFAIRE_UPDATED,
   * AFFAIRE_DELETED, STATUT_CHANGED: X → Y) — data that already existed but
   * had no way to be read back out.
   */
  async getAuditHistory(filters: {
    affaireId?: string;
    entityType?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) {
    const { affaireId, entityType, action, page = 1, limit = 30 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { entityType: entityType ?? 'Affaire' };
    if (affaireId) where.entityId = affaireId;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { nom: true, prenom: true } } },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Daily: send reminders for overdue tasks */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async sendOverdueReminders() {
    const overdue = await this.prisma.workflowTask.findMany({
      where: {
        statut: { in: [WorkflowTaskStatut.EN_ATTENTE, WorkflowTaskStatut.EN_COURS] },
        dueDate: { lt: new Date() },
        assignedToId: { not: null },
      },
      include: {
        assignedTo: { select: { email: true, nom: true } },
        affaire: { select: { numero: true } },
      },
    });

    for (const task of overdue) {
      if (task.assignedTo?.email) {
        await this.email.send(
          task.assignedTo.email,
          `[ARS ERP] Tâche en retard: ${task.type}`,
          `<p>Bonjour ${task.assignedTo.nom},</p><p>La tâche suivante est en retard: <strong>${task.description ?? task.type}</strong></p><p>Échéance: ${task.dueDate?.toLocaleDateString('fr-TN')}</p>`,
        );
      }
    }

    this.logger.log(`Overdue reminders sent for ${overdue.length} tasks`);
  }

  /** Weekly: compile periodic situation tasks */
  @Cron('0 8 * * 1') // Monday 08:00
  async checkPendingSituations() {
    const now = new Date();
    const traites = await this.prisma.traiteAffaire.findMany({
      where: { affaire: { statut: AffaireStatut.PLACEMENT_REALISE, isActive: true } },
      include: { affaire: { include: { cedante: true } } },
    });

    for (const traite of traites) {
      const lastSituation = await this.prisma.situation.findFirst({
        where: { traiteId: traite.id },
        orderBy: { createdAt: 'desc' },
      });

      let needsTask = false;
      if (!lastSituation) {
        needsTask = true;
      } else {
        const daysSinceLast = Math.floor((now.getTime() - lastSituation.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (traite.periodicite === Periodicite.TRIMESTRIELLE && daysSinceLast >= 90) needsTask = true;
        if (traite.periodicite === Periodicite.SEMESTRIELLE && daysSinceLast >= 180) needsTask = true;
        if (traite.periodicite === Periodicite.ANNUELLE && daysSinceLast >= 365) needsTask = true;
      }

      if (needsTask) {
        const existing = await this.prisma.workflowTask.findFirst({
          where: {
            type: WorkflowTaskType.SITUATION_A_COMPILER,
            affaireId: traite.affaireId,
            statut: { in: [WorkflowTaskStatut.EN_ATTENTE, WorkflowTaskStatut.EN_COURS] },
          },
        });

        if (!existing) {
          await this.prisma.workflowTask.create({
            data: {
              type: WorkflowTaskType.SITUATION_A_COMPILER,
              statut: WorkflowTaskStatut.EN_ATTENTE,
              affaireId: traite.affaireId,
              description: `Situation ${traite.periodicite} à compiler — ${traite.affaire.numero} (${traite.affaire.cedante.raisonSociale})`,
              dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });

          this.notification.notifyRole(
            'DIRECTION_REASSURANCE',
            'SITUATION_DUE',
            `Situation à compiler: ${traite.affaire.numero}`,
            `Une situation ${traite.periodicite} doit être compilée pour le traité ${traite.affaire.numero}.`,
            { affaireId: traite.affaireId },
          );
        }
      }
    }
  }

  /**
   * FIX (Workflow pass, new): TraiteAffaire.renewalReminderSent — declared
   * on the schema with the comment "re-param reminder at Jan 1" — was never
   * read or written anywhere in the codebase. Dead field. Daily check that
   * opens a RENOUVELLEMENT_TRAITE task 45 days ahead of a placed treaty's
   * dateEcheance, using the flag as a one-shot guard so it doesn't refire.
   *
   * Deliberately does NOT touch dates, terms, or create a new Affaire —
   * this is a reminder only. What "renewal" means operationally (extend
   * dates on the same row vs. a fresh Affaire vs. a new
   * TreatyParameterVersion) isn't fully specified by the CDC and is left to
   * whoever actions the task — the new TreatyParameterVersion.renew()
   * endpoint is available for the commercial-terms side of that decision.
   */
  @Cron('0 7 * * *')
  async checkTreatyRenewals() {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 45);

    const traites = await this.prisma.traiteAffaire.findMany({
      where: {
        renewalReminderSent: false,
        dateEcheance: { gte: now, lte: cutoff },
        modeRenouvellement: { not: ModeRenouvellement.RESILIATION },
        affaire: { isActive: true, statut: AffaireStatut.PLACEMENT_REALISE },
      },
      include: { affaire: { include: { cedante: true } } },
    });

    for (const traite of traites) {
      await this.prisma.workflowTask.create({
        data: {
          type: WorkflowTaskType.RENOUVELLEMENT_TRAITE,
          statut: WorkflowTaskStatut.EN_ATTENTE,
          affaireId: traite.affaireId,
          description: `Renouvellement à préparer — ${traite.affaire.numero} (${traite.affaire.cedante.raisonSociale}), échéance le ${traite.dateEcheance.toLocaleDateString('fr-FR')}`,
          dueDate: traite.dateEcheance,
        },
      });

      await this.prisma.traiteAffaire.update({
        where: { id: traite.id },
        data: { renewalReminderSent: true },
      });

      this.notification.notifyRole(
        'DIRECTION_REASSURANCE',
        'TREATY_RENEWAL_DUE',
        `Renouvellement à préparer: ${traite.affaire.numero}`,
        `Le traité ${traite.affaire.numero} arrive à échéance le ${traite.dateEcheance.toLocaleDateString('fr-FR')}.`,
        { affaireId: traite.affaireId },
      );
    }

    if (traites.length > 0) {
      this.logger.log(`Treaty renewal tasks created for ${traites.length} treaties`);
    }
  }
}