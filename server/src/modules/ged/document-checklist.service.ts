import { Injectable, NotFoundException } from '@nestjs/common';
import { DocumentStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DocumentChecklistService {
  constructor(private prisma: PrismaService) {}

  async getForAffaire(affaireId: string) {
    let checklist = await this.prisma.documentChecklist.findUnique({
      where: { affaireId },
      include: { items: { orderBy: { ordre: 'asc' } } },
    });
    if (!checklist) throw new NotFoundException('Checklist introuvable pour cette affaire');
    return checklist;
  }

  async markItemReceived(checklistId: string, itemId: string, documentId: string) {
    await this.prisma.documentChecklistItem.update({
      where: { id: itemId },
      data: { statut: DocumentStatut.RECU, documentId, receivedAt: new Date() },
    });
    return this.updateCompletionPct(checklistId);
  }

  async markItemPending(checklistId: string, itemId: string) {
    await this.prisma.documentChecklistItem.update({
      where: { id: itemId },
      data: { statut: DocumentStatut.EN_ATTENTE },
    });
    return this.updateCompletionPct(checklistId);
  }

  private async updateCompletionPct(checklistId: string) {
    const items = await this.prisma.documentChecklistItem.findMany({
      where: { checklistId },
    });
    const total = items.length;
    const received = items.filter((i) => i.statut === DocumentStatut.RECU).length;
    const pct = total > 0 ? Math.round((received / total) * 100 * 10) / 10 : 0;

    return this.prisma.documentChecklist.update({
      where: { id: checklistId },
      data: { completionPct: pct },
      include: { items: { orderBy: { ordre: 'asc' } } },
    });
  }
}