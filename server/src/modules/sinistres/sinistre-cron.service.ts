import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../shared/services/notification.service';

@Injectable()
export class SinistreCronService {
  private readonly logger = new Logger(SinistreCronService.name);

  constructor(private prisma: PrismaService, private notification: NotificationService) {}

  /** 31 December: create SAP reconstitution task for all non-prop treaties */
  @Cron('0 8 31 12 *') // 08:00 on Dec 31
  async triggerSapYearEnd() {
    this.logger.log('SAP year-end task creation triggered (31 December)');

    const nonPropTraites = await this.prisma.traiteAffaire.findMany({
      where: { reassuranceType: 'NON_PROPORTIONNEL' },
      include: { affaire: { include: { cedante: true } } },
    });

    for (const traite of nonPropTraites) {
      if (traite.affaire.statut !== 'PLACEMENT_REALISE') continue;

      await this.prisma.workflowTask.create({
        data: {
          type: 'SAP_ANNUEL_31_DEC',
          statut: 'EN_ATTENTE',
          affaireId: traite.affaireId,
          description: `SAP annuel 31/12 — ${traite.affaire.numero} (${traite.affaire.cedante.raisonSociale})`,
          dueDate: new Date(new Date().getFullYear(), 11, 31, 23, 59),
        },
      });

      this.notification.notifyRole(
        'SERVICE_IRDS',
        'SAP_ANNUEL',
        `SAP annuel requis: ${traite.affaire.numero}`,
        `Le SAP annuel au 31/12 doit être établi pour le traité ${traite.affaire.numero}.`,
        { affaireId: traite.affaireId },
      );
    }

    this.logger.log(`SAP tasks created for ${nonPropTraites.length} non-proportional treaties`);
  }

  /** January 1st: renewal reminders for treaties approaching expiry */
  @Cron('0 8 1 1 *') // 08:00 on Jan 1
  async triggerRenewalReminders() {
    this.logger.log('Treaty renewal reminder check (January 1st)');

    const now = new Date();
    const threeMonthsLater = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());

    const expiring = await this.prisma.traiteAffaire.findMany({
      where: {
        dateEcheance: { gte: now, lte: threeMonthsLater },
        renewalReminderSent: false,
        affaire: { statut: 'PLACEMENT_REALISE', isActive: true },
      },
      include: { affaire: { include: { cedante: true } } },
    });

    for (const traite of expiring) {
      await this.prisma.$transaction([
        this.prisma.workflowTask.create({
          data: {
            type: 'RENOUVELLEMENT_TRAITE',
            statut: 'EN_ATTENTE',
            affaireId: traite.affaireId,
            description: `Renouvellement traité ${traite.affaire.numero} — échéance ${traite.dateEcheance.toLocaleDateString('fr-TN')}`,
            dueDate: traite.dateEcheance,
          },
        }),
        this.prisma.traiteAffaire.update({
          where: { id: traite.id },
          data: { renewalReminderSent: true },
        }),
      ]);

      this.notification.notifyRole(
        'DIRECTION_REASSURANCE',
        'RENOUVELLEMENT_TRAITE',
        `Renouvellement: ${traite.affaire.numero}`,
        `Le traité ${traite.affaire.numero} (${traite.affaire.cedante.raisonSociale}) arrive à échéance le ${traite.dateEcheance.toLocaleDateString('fr-TN')}.`,
        { affaireId: traite.affaireId },
      );
    }

    this.logger.log(`Renewal reminders sent for ${expiring.length} treaties`);
  }

  /** Daily: check open cash calls with no movement in 3+ days */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkStaleCashCalls() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const stale = await this.prisma.cashCall.findMany({
      where: {
        statut: { in: ['REINSUREUR_CONTACTE', 'EN_ATTENTE_PAIEMENT'] },
        updatedAt: { lt: threeDaysAgo },
      },
      include: { sinistre: { select: { numero: true, affaireId: true } } },
    });

    for (const cc of stale) {
      this.notification.notifyRole(
        'SERVICE_IRDS',
        'CASH_CALL_STALE',
        `Cash call sans réponse: sinistre ${cc.sinistre.numero}`,
        `Aucune mise à jour depuis 3 jours sur le cash call (statut: ${cc.statut}).`,
        { sinistreId: cc.sinistreId },
      );
    }
  }
}