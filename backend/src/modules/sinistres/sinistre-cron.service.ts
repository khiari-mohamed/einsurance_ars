import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Sinistre, SinistreStatus, PaymentStatus } from './sinistres.entity';
import { SinistreNotificationService } from './sinistre-notification.service';

@Injectable()
export class SinistreCronService {
  private readonly logger = new Logger(SinistreCronService.name);

  constructor(
    @InjectRepository(Sinistre) private sinistreRepo: Repository<Sinistre>,
    private notificationService: SinistreNotificationService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async check24HourNotificationRule(): Promise<void> {
    this.logger.log('Checking 24-hour notification rule...');
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const overdueSinistres = await this.sinistreRepo.find({
      where: {
        dateNotificationReassureurs: null,
        dateNotificationARS: LessThan(twentyFourHoursAgo),
      },
    });

    if (overdueSinistres.length > 0) {
      this.logger.warn(`Found ${overdueSinistres.length} sinistres with overdue notifications`);
      
      for (const sinistre of overdueSinistres) {
        await this.notificationService.checkOverdueNotifications();
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendPaymentReminders(): Promise<void> {
    this.logger.log('Sending payment reminders...');
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const sinistresWithPendingPayments = await this.sinistreRepo.find({
      where: {
        statut: SinistreStatus.EN_REGLEMENT,
        dateNotificationReassureurs: LessThan(thirtyDaysAgo),
      },
      relations: ['participations'],
    });

    for (const sinistre of sinistresWithPendingPayments) {
      const hasPendingPayments = sinistre.participations.some(
        p => p.statutPaiement === PaymentStatus.EN_ATTENTE || p.statutPaiement === PaymentStatus.EN_RETARD
      );

      if (hasPendingPayments) {
        await this.notificationService.sendReminderNotifications(sinistre.id);
      }
    }
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async monthlySAPRevision(): Promise<void> {
    this.logger.log('Running monthly SAP revision...');
    
    const openSinistres = await this.sinistreRepo.find({
      where: [
        { statut: SinistreStatus.DECLARE },
        { statut: SinistreStatus.EN_EXPERTISE },
        { statut: SinistreStatus.EN_REGLEMENT },
        { statut: SinistreStatus.PARTIEL },
      ],
    });

    this.logger.log(`Found ${openSinistres.length} open sinistres requiring SAP review`);
  }
}
