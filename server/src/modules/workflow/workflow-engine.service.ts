import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WorkflowTaskStatut, WorkflowTaskType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../shared/services/notification.service';
import { EmailService } from '../../shared/services/email.service';

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

  async assignTask(taskId: string, userId: string) {
    const task = await this.prisma.workflowTask.findUniqueOrThrow({ where: { id: taskId } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const updated = await this.prisma.workflowTask.update({
      where: { id: taskId },
      data: { assignedToId: userId, statut: WorkflowTaskStatut.EN_COURS },
    });

    this.notification.notifyUser(
      userId,
      'TASK_ASSIGNED',
      `Tâche assignée: ${task.type}`,
      `Vous avez été assigné à: ${task.description ?? task.type}`,
      { taskId },
    );

    return updated;
  }

  async completeTask(taskId: string, userId: string, note?: string) {
    return this.prisma.workflowTask.update({
      where: { id: taskId },
      data: {
        statut: WorkflowTaskStatut.COMPLETE,
        completedAt: new Date(),
      },
    });
  }

  async cancelTask(taskId: string) {
    return this.prisma.workflowTask.update({
      where: { id: taskId },
      data: { statut: WorkflowTaskStatut.ANNULE },
    });
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
      where: { affaire: { statut: 'PLACEMENT_REALISE', isActive: true } },
      include: { affaire: { include: { cedante: true } } },
    });

    for (const traite of traites) {
      // Check if a situation compilation task is needed based on periodicite
      const lastSituation = await this.prisma.situation.findFirst({
        where: { traiteId: traite.id },
        orderBy: { createdAt: 'desc' },
      });

      let needsTask = false;
      if (!lastSituation) {
        needsTask = true;
      } else {
        const daysSinceLast = Math.floor((now.getTime() - lastSituation.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (traite.periodicite === 'TRIMESTRIELLE' && daysSinceLast >= 90) needsTask = true;
        if (traite.periodicite === 'SEMESTRIELLE' && daysSinceLast >= 180) needsTask = true;
        if (traite.periodicite === 'ANNUELLE' && daysSinceLast >= 365) needsTask = true;
      }

      if (needsTask) {
        const existing = await this.prisma.workflowTask.findFirst({
          where: {
            type: 'SITUATION_A_COMPILER',
            affaireId: traite.affaireId,
            statut: { in: ['EN_ATTENTE', 'EN_COURS'] },
          },
        });

        if (!existing) {
          await this.prisma.workflowTask.create({
            data: {
              type: 'SITUATION_A_COMPILER',
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
}