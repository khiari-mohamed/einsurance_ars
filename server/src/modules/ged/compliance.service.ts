import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../../shared/services/notification.service';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(private prisma: PrismaService, private notification: NotificationService) {}

  /** Daily: flag affaires with placed status but incomplete mandatory checklists */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async checkIncompleteChecklists() {
    const incomplete = await this.prisma.documentChecklist.findMany({
      where: {
        completionPct: { lt: 100 },
        items: { some: { isMandatory: true, statut: { not: 'RECU' } } },
      },
      include: {
        items: { where: { isMandatory: true, statut: { not: 'RECU' } } },
      },
    });

    for (const cl of incomplete) {
      const missing = cl.items.map((i) => i.libelle).join(', ');
      this.notification.notifyRole(
        'DIRECTION_REASSURANCE',
        'CHECKLIST_INCOMPLETE',
        `Dossier incomplet`,
        `Documents obligatoires manquants: ${missing}`,
        { affaireId: cl.affaireId },
      );
    }

    this.logger.log(`Compliance check: ${incomplete.length} dossiers incomplets`);
  }

  async getComplianceReport() {
    const total = await this.prisma.documentChecklist.count();
    const complete = await this.prisma.documentChecklist.count({ where: { completionPct: 100 } });
    const incomplete = await this.prisma.documentChecklist.findMany({
      where: { completionPct: { lt: 100 } },
      include: { items: { where: { isMandatory: true, statut: { not: 'RECU' } } } },
      orderBy: { completionPct: 'asc' },
      take: 20,
    });

    return { total, complete, incompleteCount: total - complete, topIncomplete: incomplete };
  }
}