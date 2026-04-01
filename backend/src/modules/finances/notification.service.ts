import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encaissement } from './encaissement.entity';
import { Decaissement } from './decaissement.entity';
import { User, UserRole } from '../users/users.entity';

export interface EmailPayload {
  to: string[];
  subject: string;
  body: string;
  priority?: 'low' | 'normal' | 'high';
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async sendPaymentReminderEmail(items: any[], daysOverdue: number): Promise<void> {
    const financialUsers = await this.userRepo.find({
      where: { role: UserRole.AGENT_FINANCIER },
    });

    const emails = financialUsers.map(u => u.email).filter(Boolean);

    if (emails.length === 0) {
      this.logger.warn('No financial users found for payment reminder');
      return;
    }

    const subject = `[ARS] Rappel de paiement - ${items.length} éléments en retard de ${daysOverdue} jours`;
    const body = this.buildPaymentReminderBody(items, daysOverdue);

    await this.sendEmail({
      to: emails,
      subject,
      body,
      priority: daysOverdue >= 90 ? 'high' : 'normal',
    });
  }

  async sendApprovalRequestEmail(decaissement: Decaissement, approverUserId: string): Promise<void> {
    const approver = await this.userRepo.findOne({ where: { id: approverUserId } });

    if (!approver?.email) {
      this.logger.warn(`No email found for approver ${approverUserId}`);
      return;
    }

    const subject = `[ARS] Demande d'approbation - Décaissement ${decaissement.numero}`;
    const body = `
Bonjour,

Un décaissement nécessite votre approbation:

Numéro: ${decaissement.numero}
Montant: ${decaissement.montant} ${decaissement.devise}
Bénéficiaire: ${decaissement.beneficiaireType}
Date: ${new Date(decaissement.dateDecaissement).toLocaleDateString('fr-FR')}

Veuillez vous connecter au système pour approuver ou rejeter cette demande.

Cordialement,
Système ARS
    `;

    await this.sendEmail({
      to: [approver.email],
      subject,
      body,
      priority: Number(decaissement.montantEquivalentTND) > 100000 ? 'high' : 'normal',
    });
  }

  async sendAMLAlertEmail(findings: any[], decaissementId: string): Promise<void> {
    const directors = await this.userRepo.find({
      where: { role: UserRole.DIRECTEUR_FINANCIER },
    });

    const emails = directors.map(u => u.email).filter(Boolean);

    if (emails.length === 0) {
      this.logger.warn('No directors found for AML alert');
      return;
    }

    const highRiskFindings = findings.filter(f => f.severity === 'HIGH' || f.severity === 'CRITICAL');

    if (highRiskFindings.length === 0) return;

    const subject = `[ARS] ALERTE AML - ${highRiskFindings.length} risques détectés`;
    const body = `
ALERTE ANTI-BLANCHIMENT

Décaissement ID: ${decaissementId}

Risques détectés:
${highRiskFindings.map(f => `- ${f.type}: ${f.description}`).join('\n')}

Action requise: Vérification immédiate avant exécution du paiement.

Système ARS - Conformité AML
    `;

    await this.sendEmail({
      to: emails,
      subject,
      body,
      priority: 'high',
    });
  }

  async sendReconciliationAlertEmail(discrepancies: any[], accountNumber: string): Promise<void> {
    const accountants = await this.userRepo.find({
      where: { role: UserRole.COMPTABLE },
    });

    const emails = accountants.map(u => u.email).filter(Boolean);

    if (emails.length === 0 || discrepancies.length === 0) return;

    const subject = `[ARS] Alerte Rapprochement Bancaire - ${discrepancies.length} écarts détectés`;
    const body = `
Rapprochement bancaire - Compte ${accountNumber}

${discrepancies.length} écarts détectés nécessitant une vérification.

Veuillez consulter le rapport de rapprochement pour plus de détails.

Système ARS - Comptabilité
    `;

    await this.sendEmail({
      to: emails,
      subject,
      body,
      priority: 'normal',
    });
  }

  private async sendEmail(payload: EmailPayload): Promise<void> {
    // Production: Integrate with email service (SendGrid, AWS SES, etc.)
    // For now, log the email
    this.logger.log(`[EMAIL] To: ${payload.to.join(', ')}`);
    this.logger.log(`[EMAIL] Subject: ${payload.subject}`);
    this.logger.log(`[EMAIL] Priority: ${payload.priority || 'normal'}`);
    this.logger.log(`[EMAIL] Body:\n${payload.body}`);

    // TODO: Implement actual email sending
    // Example with nodemailer:
    // await this.mailer.sendMail({
    //   from: process.env.SMTP_FROM,
    //   to: payload.to,
    //   subject: payload.subject,
    //   text: payload.body,
    //   priority: payload.priority,
    // });
  }

  private buildPaymentReminderBody(items: any[], daysOverdue: number): string {
    const itemsList = items.slice(0, 10).map(item => 
      `- ${item.numero}: ${item.montant} TND (${item.daysOld} jours)`
    ).join('\n');

    return `
Rappel de paiement - ${daysOverdue} jours

${items.length} éléments en retard de paiement:

${itemsList}
${items.length > 10 ? `\n... et ${items.length - 10} autres` : ''}

Action requise: Vérifier et traiter ces paiements en retard.

Système ARS - Service Financier
    `;
  }
}
