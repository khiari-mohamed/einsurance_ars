import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sinistre, SinistreParticipation, ParticipationNotification, NotificationType, NotificationMoyen, NotificationStatut } from './sinistres.entity';
import { EmailService } from '../shared/services/email.service';
import { Reassureur } from '../reassureurs/reassureurs.entity';

@Injectable()
export class SinistreNotificationService {
  constructor(
    @InjectRepository(Sinistre) private sinistreRepo: Repository<Sinistre>,
    @InjectRepository(SinistreParticipation) private participationRepo: Repository<SinistreParticipation>,
    @InjectRepository(ParticipationNotification) private notificationRepo: Repository<ParticipationNotification>,
    private emailService: EmailService,
  ) {}

  async notifyReinsurers(sinistreId: string): Promise<void> {
    const sinistre = await this.sinistreRepo.findOne({
      where: { id: sinistreId },
      relations: ['affaire', 'cedante', 'participations', 'participations.reassureur'],
    });

    if (!sinistre) throw new Error('Sinistre not found');

    for (const participation of sinistre.participations) {
      await this.sendNotificationToReinsurer(sinistre, participation, NotificationType.INITIAL);
    }

    await this.sinistreRepo.update(sinistreId, {
      dateNotificationReassureurs: new Date(),
    });
  }

  async sendReminderNotifications(sinistreId: string): Promise<void> {
    const sinistre = await this.sinistreRepo.findOne({
      where: { id: sinistreId },
      relations: ['participations', 'participations.reassureur'],
    });

    if (!sinistre) return;

    for (const participation of sinistre.participations) {
      if (participation.statutPaiement === 'en_attente') {
        await this.sendNotificationToReinsurer(sinistre, participation, NotificationType.RAPPEL);
      }
    }
  }

  private async sendNotificationToReinsurer(
    sinistre: Sinistre,
    participation: SinistreParticipation,
    type: NotificationType,
  ): Promise<void> {
    const reassureur = participation.reassureur;
    const subject = this.getEmailSubject(type, sinistre.numero);
    const message = this.getEmailBody(type, sinistre, participation);

    try {
      await this.emailService.sendNotification(reassureur.email, subject, message);

      await this.notificationRepo.save(
        this.notificationRepo.create({
          participationId: participation.id,
          type,
          moyen: NotificationMoyen.EMAIL,
          statut: NotificationStatut.ENVOYE,
          message: subject,
        }),
      );
    } catch (error) {
      await this.notificationRepo.save(
        this.notificationRepo.create({
          participationId: participation.id,
          type,
          moyen: NotificationMoyen.EMAIL,
          statut: NotificationStatut.ERREUR,
          message: error.message,
        }),
      );
    }
  }

  private getEmailSubject(type: NotificationType, numero: string): string {
    const prefix = type === NotificationType.URGENT ? '[URGENT] ' : type === NotificationType.RAPPEL ? '[RAPPEL] ' : '';
    return `${prefix}Notification de Sinistre ${numero} - ARS Tunisie`;
  }

  private getEmailBody(type: NotificationType, sinistre: Sinistre, participation: SinistreParticipation): string {
    const urgencyClass = type === NotificationType.URGENT ? 'urgent' : '';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <h2 style="color: ${type === NotificationType.URGENT ? '#d32f2f' : '#1976d2'};">
          ${type === NotificationType.INITIAL ? 'Notification de Sinistre' : type === NotificationType.RAPPEL ? 'Rappel - Sinistre en attente' : 'URGENT - Action requise'}
        </h2>
        
        <p>Cher partenaire ${participation.reassureur.raisonSociale},</p>
        
        <p>ARS Tunisie vous informe ${type === NotificationType.INITIAL ? 'd\'un sinistre survenu' : 'du sinistre suivant en attente de règlement'} :</p>
        
        <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid ${type === NotificationType.URGENT ? '#d32f2f' : '#1976d2'};">
          <h3>DÉTAILS DU SINISTRE</h3>
          <p><strong>Numéro:</strong> ${sinistre.numero}</p>
          <p><strong>Référence Cédante:</strong> ${sinistre.referenceCedante}</p>
          <p><strong>Date de survenance:</strong> ${new Date(sinistre.dateSurvenance).toLocaleDateString('fr-FR')}</p>
          <p><strong>Montant total:</strong> ${sinistre.montantTotal.toLocaleString('fr-FR')} TND</p>
          <p><strong>Votre participation:</strong> ${participation.partPourcentage}% (${participation.montantPart.toLocaleString('fr-FR')} TND)</p>
          ${sinistre.description ? `<p><strong>Description:</strong> ${sinistre.description}</p>` : ''}
        </div>
        
        ${type === NotificationType.URGENT ? '<p style="color: #d32f2f; font-weight: bold;">⚠️ ATTENTION: Délai de règlement dépassé. Veuillez procéder au paiement immédiatement.</p>' : ''}
        ${type === NotificationType.RAPPEL ? '<p style="color: #ff9800;">⏰ Rappel: Veuillez procéder au règlement dans les délais contractuels.</p>' : ''}
        
        <p>Pour toute question, veuillez contacter notre Service Technique.</p>
        
        <p>Cordialement,<br>
        <strong>Service Technique - ARS Tunisie</strong><br>
        Email: technique@ars.tn<br>
        Tél: +216 XX XXX XXX</p>
      </div>
    `;
  }

  async checkOverdueNotifications(): Promise<void> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const overdueSinistres = await this.sinistreRepo.find({
      where: {
        dateNotificationReassureurs: null,
      },
      relations: ['participations', 'participations.reassureur'],
    });

    for (const sinistre of overdueSinistres) {
      if (new Date(sinistre.dateNotificationARS) < twentyFourHoursAgo) {
        for (const participation of sinistre.participations) {
          await this.sendNotificationToReinsurer(sinistre, participation, NotificationType.URGENT);
        }
      }
    }
  }
}
