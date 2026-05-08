import { Injectable, BadRequestException } from '@nestjs/common';
import { CashCallStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../shared/services/notification.service';
import { EmailService } from '../../shared/services/email.service';
import { CreateCashCallDto } from './dto/cash-call.dto';

@Injectable()
export class CashCallService {
  constructor(
    private prisma: PrismaService,
    private notification: NotificationService,
    private email: EmailService,
  ) {}

  async trigger(sinistreId: string, dto: CreateCashCallDto, userId: string) {
    const sinistre = await this.prisma.sinistre.findUniqueOrThrow({
      where: { id: sinistreId },
      include: { affaire: { include: { cedante: true } }, cashCall: true },
    });

    if (sinistre.cashCall) {
      throw new BadRequestException('Un cash call existe déjà pour ce sinistre');
    }

    const [cashCall] = await this.prisma.$transaction([
      this.prisma.cashCall.create({
        data: {
          sinistreId,
          statut: CashCallStatut.DECLENCHE,
          montantDemande: dto.montantDemande,
          notes: dto.notes,
        },
      }),
      this.prisma.sinistre.update({
        where: { id: sinistreId },
        data: { appelAuComptant: true },
      }),
      this.prisma.sinistreEvent.create({
        data: {
          sinistreId,
          actorId: userId,
          actorLabel: 'Direction Réassurance',
          action: `Cash call déclenché: ${dto.montantDemande} TND`,
          note: dto.notes,
        },
      }),
    ]);

    // Create follow-up task for IRDS
    await this.prisma.workflowTask.create({
      data: {
        type: 'CASH_CALL_FOLLOW_UP',
        statut: 'EN_ATTENTE',
        affaireId: sinistre.affaireId,
        description: `Suivre le paiement du cash call sinistre ${sinistre.numero} — ${dto.montantDemande} TND`,
        createdById: userId,
      },
    });

    this.notification.notifyRole(
      'SERVICE_IRDS',
      'CASH_CALL_DECLENCHE',
      `Cash call: sinistre ${sinistre.numero}`,
      `Un cash call de ${dto.montantDemande} TND a été déclenché pour le sinistre ${sinistre.numero}.`,
      { sinistreId },
    );

    return cashCall;
  }

  async advanceStatut(sinistreId: string, newStatut: CashCallStatut, userId: string, note?: string) {
    const cashCall = await this.prisma.cashCall.findUnique({ where: { sinistreId } });
    if (!cashCall) throw new BadRequestException('Aucun cash call pour ce sinistre');

    const transitions: Record<CashCallStatut, CashCallStatut[]> = {
      DECLENCHE: [CashCallStatut.REINSUREUR_CONTACTE],
      REINSUREUR_CONTACTE: [CashCallStatut.EN_ATTENTE_PAIEMENT],
      EN_ATTENTE_PAIEMENT: [CashCallStatut.PAIEMENT_RECU],
      PAIEMENT_RECU: [CashCallStatut.LETTRE],
      LETTRE: [],
    };

    if (!transitions[cashCall.statut].includes(newStatut)) {
      throw new BadRequestException(`Transition invalide: ${cashCall.statut} → ${newStatut}`);
    }

    await this.prisma.$transaction([
      this.prisma.cashCall.update({
        where: { sinistreId },
        data: {
          statut: newStatut,
          ...(newStatut === CashCallStatut.PAIEMENT_RECU && { datePaiement: new Date() }),
        },
      }),
      this.prisma.sinistreEvent.create({
        data: {
          sinistreId,
          actorId: userId,
          actorLabel: 'SERVICE_IRDS',
          action: `Cash call: ${newStatut}`,
          note,
        },
      }),
    ]);

    if (newStatut === CashCallStatut.PAIEMENT_RECU) {
      await this.prisma.sinistre.update({
        where: { id: sinistreId },
        data: { statut: 'RECUPERE' },
      });
    }

    return this.prisma.cashCall.findUnique({ where: { sinistreId } });
  }

  async recordPayment(sinistreId: string, montantRecu: number, userId: string) {
    await this.prisma.cashCall.update({
      where: { sinistreId },
      data: { montantRecu, statut: CashCallStatut.PAIEMENT_RECU, datePaiement: new Date() },
    });
    await this.prisma.sinistreEvent.create({
      data: {
        sinistreId, actorId: userId,
        actorLabel: 'SERVICE_IRDS',
        action: `Paiement cash call reçu: ${montantRecu} TND`,
      },
    });
  }
}