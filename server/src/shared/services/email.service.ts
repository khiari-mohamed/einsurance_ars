import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get('app.smtpHost'),
      port: config.get<number>('app.smtpPort'),
      secure: config.get<number>('app.smtpPort') === 465,
      auth: {
        user: config.get('app.smtpUser'),
        pass: config.get('app.smtpPass'),
      },
    });
  }

  async send(to: string | string[], subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('app.smtpFrom'),
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
      });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    await this.send(
      to,
      'Réinitialisation du mot de passe — ARS ERP',
      `<p>Votre code de réinitialisation : <strong>${token}</strong></p>
       <p>Ce code expire dans 1 heure.</p>`,
    );
  }

  async sendWorkflowNotification(
    to: string,
    taskType: string,
    description: string,
  ): Promise<void> {
    await this.send(
      to,
      `[ARS ERP] Nouvelle tâche : ${taskType}`,
      `<p>${description}</p>`,
    );
  }
}