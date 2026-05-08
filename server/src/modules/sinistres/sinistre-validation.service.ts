import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { SinistreStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../shared/services/notification.service';

@Injectable()
export class SinistreValidationService {
  constructor(private prisma: PrismaService, private notification: NotificationService) {}

  /** Direction Réassurance submits sinistre for director validation */
  async submitForValidation(sinistreId: string, userId: string, note?: string): Promise<void> {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({ where: { id: sinistreId } });

    if (sinistre.statut !== SinistreStatut.DECLARE) {
      throw new BadRequestException(`Sinistre doit être en statut DECLARE pour soumission (actuel: ${sinistre.statut})`);
    }

    await this.prisma.$transaction([
      this.prisma.sinistre.update({
        where: { id: sinistreId },
        data: { statut: SinistreStatut.EN_COURS_VALIDATION },
      }),
      this.prisma.sinistreEvent.create({
        data: {
          sinistreId,
          actorId: userId,
          actorLabel: 'Direction Réassurance',
          action: 'Soumis pour validation Direction Générale',
          note,
        },
      }),
    ]);

    // Create workflow task for Direction Générale
    await this.prisma.workflowTask.create({
      data: {
        type: 'VALIDATION_SINISTRE',
        statut: 'EN_ATTENTE',
        affaireId: sinistre.affaireId,
        description: `Validation requise pour sinistre ${sinistre.numero}`,
        createdById: userId,
      },
    });

    this.notification.notifyRole(
      'DIRECTION_GENERALE',
      'VALIDATION_SINISTRE',
      `Sinistre à valider: ${sinistre.numero}`,
      `Le sinistre ${sinistre.numero} requiert votre validation.`,
      { sinistreId },
    );
  }

  /** Direction Générale approves the sinistre */
  async approve(sinistreId: string, userId: string, note?: string): Promise<void> {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({
      where: { id: sinistreId },
      include: { affaire: { include: { reassureurs: { include: { reassureur: true } } } } },
    });

    if (sinistre.statut !== SinistreStatut.EN_COURS_VALIDATION) {
      throw new BadRequestException('Sinistre doit être EN_COURS_VALIDATION pour approbation');
    }

    await this.prisma.$transaction([
      this.prisma.sinistre.update({
        where: { id: sinistreId },
        data: { statut: SinistreStatut.VALIDE },
      }),
      this.prisma.sinistreEvent.create({
        data: {
          sinistreId,
          actorId: userId,
          actorLabel: 'Direction Générale',
          action: 'Validé par la Direction Générale',
          note,
        },
      }),
      this.prisma.workflowTask.updateMany({
        where: { type: 'VALIDATION_SINISTRE', affaireId: sinistre.affaireId, statut: 'EN_ATTENTE' },
        data: { statut: 'COMPLETE', completedAt: new Date() },
      }),
    ]);

    this.notification.notifyRole(
      'DIRECTION_REASSURANCE',
      'SINISTRE_VALIDE',
      `Sinistre validé: ${sinistre.numero}`,
      `Le sinistre ${sinistre.numero} a été validé. Vous pouvez procéder à la déclaration aux réassureurs.`,
      { sinistreId },
    );
  }

  /** Direction Générale rejects the sinistre */
  async reject(sinistreId: string, userId: string, motif: string): Promise<void> {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({ where: { id: sinistreId } });

    if (sinistre.statut !== SinistreStatut.EN_COURS_VALIDATION) {
      throw new BadRequestException('Sinistre doit être EN_COURS_VALIDATION pour rejet');
    }

    await this.prisma.$transaction([
      this.prisma.sinistre.update({
        where: { id: sinistreId },
        data: { statut: SinistreStatut.REJETE },
      }),
      this.prisma.sinistreEvent.create({
        data: {
          sinistreId,
          actorId: userId,
          actorLabel: 'Direction Générale',
          action: `Rejeté: ${motif}`,
          note: motif,
        },
      }),
    ]);

    this.notification.notifyRole(
      'DIRECTION_REASSURANCE',
      'SINISTRE_REJETE',
      `Sinistre rejeté: ${sinistre.numero}`,
      `Le sinistre ${sinistre.numero} a été rejeté. Motif: ${motif}`,
      { sinistreId },
    );
  }
}