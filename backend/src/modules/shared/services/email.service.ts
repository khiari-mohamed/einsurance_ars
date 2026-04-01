import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { Bordereau } from '../../bordereaux/bordereaux.entity';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: this.configService.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendBordereauEmail(
    recipients: string[],
    subject: string,
    htmlContent: string,
    pdfBuffer: Buffer,
    fileName: string
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get('SMTP_FROM'),
      to: recipients.join(', '),
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
  }

  async sendNotification(to: string, subject: string, message: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get('SMTP_FROM'),
      to,
      subject,
      html: `<p>${message}</p>`,
    });
  }

  // Update email.service.ts - Add sinistre email template

async sendSinistreBordereauEmail(
  recipients: string[],
  bordereau: Bordereau,
  pdfBuffer: Buffer,
  fileName: string
): Promise<void> {
  const subject = `[URGENT] Bordereau Sinistre ${bordereau.numero} - ARS Tunisie`;
  
  const htmlContent = `
    <h2 style="color: red;">AVIS DE SINISTRE - ACTION REQUISE</h2>
    <p>Cher partenaire,</p>
    <p>Veuillez trouver ci-joint le bordereau de sinistre suivant :</p>
    
    <div style="background-color: #ffe6e6; padding: 15px; border-left: 5px solid red;">
      <h3>DÉTAILS DU SINISTRE</h3>
      <p><strong>Numéro:</strong> ${bordereau.numero}</p>
      <p><strong>Date d'émission:</strong> ${bordereau.dateEmission.toLocaleDateString('fr-FR')}</p>
      <p><strong>Montant total:</strong> ${bordereau.sinistres} ${bordereau.devise}</p>
      <p><strong>Statut:</strong> EN ATTENTE DE RÈGLEMENT</p>
    </div>
    
    <p style="color: red; font-weight: bold;">
      ⚠️ Veuillez procéder au règlement dans les délais contractuels.
    </p>
    
    <p>Cordialement,<br>Service Sinistres - ARS Tunisie</p>
  `;

  await this.sendBordereauEmail(recipients, subject, htmlContent, pdfBuffer, fileName);
}
}
