import { Injectable, BadRequestException } from '@nestjs/common';
import { AffaireStatut, AffaireType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../shared/services/notification.service';

const TRANSITIONS: Record<AffaireStatut, AffaireStatut[]> = {
  EN_COTATION: [AffaireStatut.PREVISION],
  PREVISION: [AffaireStatut.PLACEMENT_REALISE, AffaireStatut.EN_COTATION],
  PLACEMENT_REALISE: [], // terminal state
};

@Injectable()
export class AffaireWorkflowService {
  constructor(private prisma: PrismaService, private notification: NotificationService) {}

  async transition(affaireId: string, targetStatus: AffaireStatut, userId: string): Promise<void> {
    const affaire = await this.prisma.affaire.findUniqueOrThrow({
      where: { id: affaireId },
      include: { reassureurs: true, facultativeData: true, traiteData: true, cedante: true },
    });

    const allowed = TRANSITIONS[affaire.statut];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Transition impossible: ${affaire.statut} → ${targetStatus}. Transitions autorisées: ${allowed.join(', ') || 'aucune'}`,
      );
    }

    // Business rules per transition
    if (targetStatus === AffaireStatut.PREVISION) {
      this.validateForPrevision(affaire);
    }
    if (targetStatus === AffaireStatut.PLACEMENT_REALISE) {
      await this.validateForPlacement(affaire);
    }

    await this.prisma.affaire.update({
      where: { id: affaireId },
      data: { statut: targetStatus },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: `STATUT_CHANGED: ${affaire.statut} → ${targetStatus}`,
        entityType: 'Affaire',
        entityId: affaireId,
        before: { statut: affaire.statut },
        after: { statut: targetStatus },
      },
    });

    // Notify direction réassurance on placement
    if (targetStatus === AffaireStatut.PLACEMENT_REALISE) {
      this.notification.notifyRole(
        'DIRECTION_REASSURANCE',
        'PLACEMENT_REALISE',
        `Affaire placée: ${affaire.numero}`,
        `L'affaire ${affaire.numero} (${affaire.cedante.raisonSociale}) est maintenant placée.`,
        { affaireId, numero: affaire.numero },
      );
    }
  }

  private validateForPrevision(affaire: any): void {
    if (!affaire.reassureurs || affaire.reassureurs.length === 0) {
      throw new BadRequestException('Au moins un réassureur doit être renseigné avant passage en prévision');
    }
    const totalParts = affaire.reassureurs.reduce((sum: number, r: any) => sum + Number(r.partPct), 0);
    if (Math.abs(totalParts - 100) > 0.001) {
      throw new BadRequestException(`Total des participations doit être 100% (actuel: ${totalParts.toFixed(4)}%)`);
    }
  }

  private async validateForPlacement(affaire: any): Promise<void> {
    this.validateForPrevision(affaire);

    if (affaire.type === AffaireType.FACULTATIVE) {
      if (!affaire.facultativeData) throw new BadRequestException('Données facultatives manquantes');
      if (!affaire.facultativeData.dateEffet || !affaire.facultativeData.dateEcheance) {
        throw new BadRequestException('Dates d\'effet et d\'échéance obligatoires pour le placement');
      }
    } else {
      if (!affaire.traiteData) throw new BadRequestException('Données du traité manquantes');
    }

    // Check document checklist completeness (warn only — don't block placement)
    const checklist = await this.prisma.documentChecklist.findUnique({ where: { affaireId: affaire.id } });
    if (checklist && checklist.completionPct < 100) {
      // In production, this could be a configurable threshold
    }
  }
}