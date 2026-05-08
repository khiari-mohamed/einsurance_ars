import { Injectable, BadRequestException } from '@nestjs/common';
import { SinistreStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../shared/services/email.service';
import { NotificationService } from '../../shared/services/notification.service';

@Injectable()
export class SinistreNotificationService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private notification: NotificationService,
  ) {}

  /** 3-party notification chain: Cedante → ARS → Reassureurs */
  async declareToReassureurs(sinistreId: string, userId: string, note?: string): Promise<void> {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({
      where: { id: sinistreId },
      include: {
        affaire: {
          include: {
            cedante: true,
            reassureurs: { include: { reassureur: { include: { contacts: true } } } },
            traiteData: true,
          },
        },
      },
    });

    if (sinistre.statut !== SinistreStatut.VALIDE) {
      throw new BadRequestException('Sinistre doit être VALIDE avant déclaration aux réassureurs');
    }

    // Check notification threshold for proportional treaties
    if (sinistre.affaire.traiteData?.seuilNotification && sinistre.reserves) {
      if (Number(sinistre.reserves) < Number(sinistre.affaire.traiteData.seuilNotification)) {
        throw new BadRequestException(
          `Montant des réserves (${sinistre.reserves}) inférieur au seuil de notification (${sinistre.affaire.traiteData.seuilNotification})`,
        );
      }
    }

    // Create per-reinsurer participation records
    const participations = sinistre.affaire.reassureurs.map((r) => ({
      sinistreId,
      reassureurCode: r.reassureur.code,
      partPct: Number(r.partPct),
      montantPart: sinistre.partReassureurs
        ? Math.round(Number(sinistre.partReassureurs) * (Number(r.partPct) / 100) * 1000) / 1000
        : null,
      isNotified: false,
    }));

    await this.prisma.$transaction([
      ...participations.map((p) =>
        this.prisma.sinistreParticipation.upsert({
          where: {
            id: (null as any), // create-only
          },
          create: p,
          update: { isNotified: false },
        }),
      ),
      this.prisma.sinistre.update({
        where: { id: sinistreId },
        data: { statut: SinistreStatut.DECLARE_REASSUREURS },
      }),
      this.prisma.sinistreEvent.create({
        data: {
          sinistreId,
          actorId: userId,
          actorLabel: 'Direction Réassurance',
          action: 'Déclaré aux réassureurs',
          note,
        },
      }),
    ]);

    // Email each reinsurer's contact(s)
    for (const r of sinistre.affaire.reassureurs) {
      const emails = r.reassureur.contacts
        .filter((c) => c.email)
        .map((c) => c.email as string);

      if (emails.length > 0) {
        await this.email.send(
          emails,
          `[ARS] Avis de sinistre — Affaire ${sinistre.affaire.numero}`,
          this.buildReassureurNotificationEmail(sinistre, r),
        );
      }

      // Mark as notified
      await this.prisma.sinistreParticipation.updateMany({
        where: { sinistreId, reassureurCode: r.reassureur.code },
        data: { isNotified: true, notifiedAt: new Date() },
      });
    }

    this.notification.notifyRole(
      'SERVICE_IRDS',
      'SINISTRE_DECLARE',
      `Sinistre déclaré: ${sinistre.numero}`,
      `Le sinistre ${sinistre.numero} a été déclaré aux réassureurs.`,
      { sinistreId },
    );
  }

  async markInRecovery(sinistreId: string, userId: string, note?: string): Promise<void> {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({ where: { id: sinistreId } });

    if (
      sinistre.statut !== SinistreStatut.DECLARE_REASSUREURS && 
      sinistre.statut !== SinistreStatut.VALIDE
    ) {
      throw new BadRequestException('Statut invalide pour mise en récupération');
    }

    await this.prisma.$transaction([
      this.prisma.sinistre.update({
        where: { id: sinistreId },
        data: { statut: SinistreStatut.EN_RECUPERATION },
      }),
      this.prisma.sinistreEvent.create({
        data: {
          sinistreId, actorId: userId,
          actorLabel: 'SERVICE_IRDS',
          action: 'Mis en récupération',
          note,
        },
      }),
    ]);
  }

  async close(sinistreId: string, userId: string, note?: string): Promise<void> {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({ where: { id: sinistreId } });

    await this.prisma.$transaction([
      this.prisma.sinistre.update({
        where: { id: sinistreId },
        data: {
          statut: SinistreStatut.CLOS,
          ...((
            sinistre.statut === SinistreStatut.EN_RECUPERATION || 
            sinistre.statut === SinistreStatut.RECUPERE
          ) && { recoveredAt: new Date() }),
        },
      }),
      this.prisma.sinistreEvent.create({
        data: {
          sinistreId, actorId: userId,
          actorLabel: 'Direction Réassurance',
          action: 'Dossier clos',
          note,
        },
      }),
    ]);
  }

  private buildReassureurNotificationEmail(sinistre: any, reinsurer: any): string {
    return `
      <h2>Avis de Sinistre — ARS Réassurance Tunisie</h2>
      <p>Madame, Monsieur,</p>
      <p>Nous vous informons de la survenance du sinistre suivant :</p>
      <table border="1" cellpadding="5">
        <tr><td><strong>N° Sinistre ARS</strong></td><td>${sinistre.numero}</td></tr>
        <tr><td><strong>Affaire</strong></td><td>${sinistre.affaire.numero}</td></tr>
        <tr><td><strong>Cédante</strong></td><td>${sinistre.affaire.cedante.raisonSociale}</td></tr>
        <tr><td><strong>Date Survenance</strong></td><td>${new Date(sinistre.dateSurvenance).toLocaleDateString('fr-TN')}</td></tr>
        <tr><td><strong>Votre Quote-Part</strong></td><td>${reinsurer.partPct}%</td></tr>
        <tr><td><strong>Réserves totales</strong></td><td>${sinistre.reserves ?? 'En cours d\'évaluation'}</td></tr>
      </table>
      <p>Veuillez agréer nos salutations distinguées.</p>
      <p><em>ARS Réassurance — Tunis</em></p>
    `;
  }
}