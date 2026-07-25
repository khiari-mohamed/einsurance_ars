import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentEntityType } from '@prisma/client';
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

  // NEW: referenced by the frontend (gedApi.getMissingDocumentsReport) but
  // never implemented. Note DocumentChecklist has no Prisma relation to
  // Affaire (only a bare affaireId FK column) — `include: { affaire: true }`
  // would throw at runtime since no such relation is declared on the model.
  // Batch-fetching the affaire numbers separately instead.
  async getMissingDocumentsReport() {
    const incomplete = await this.prisma.documentChecklist.findMany({
      where: { completionPct: { lt: 100 } },
      include: {
        items: { where: { isMandatory: true, statut: { not: 'RECU' } }, orderBy: { ordre: 'asc' } },
      },
      orderBy: { completionPct: 'asc' },
    });

    if (!incomplete.length) return [];

    const affaires = await this.prisma.affaire.findMany({
      where: { id: { in: incomplete.map((c) => c.affaireId) } },
      select: { id: true, numero: true, statut: true, type: true },
    });
    const affaireById = new Map(affaires.map((a) => [a.id, a]));

    return incomplete.map((cl) => ({
      affaireId: cl.affaireId,
      affaireNumero: affaireById.get(cl.affaireId)?.numero ?? null,
      affaireStatut: affaireById.get(cl.affaireId)?.statut ?? null,
      completionPct: cl.completionPct,
      missingDocuments: cl.items.map((i) => ({ documentType: i.documentType, libelle: i.libelle })),
    }));
  }

  // NEW: also referenced by the frontend (gedApi.checkCompliance) but never
  // implemented. AFFAIRE compliance is checklist-driven (CDC §10.2);
  // CEDANTE/REASSUREUR/CO_COURTIER compliance is defined here as "has at
  // least one active signed Convention" (CDC §5.3, onglet 3 — "convention
  // signée obligatoire").
  async checkEntityCompliance(entityType: DocumentEntityType, entityId: string) {
    if (entityType === 'AFFAIRE') {
      const checklist = await this.prisma.documentChecklist.findUnique({
        where: { affaireId: entityId },
        include: { items: { orderBy: { ordre: 'asc' } } },
      });
      if (!checklist) {
        return {
          entityType, entityId, compliant: false,
          reason: 'Aucune checklist trouvée pour cette affaire',
          missingItems: [],
        };
      }
      const missing = checklist.items.filter((i) => i.isMandatory && i.statut !== 'RECU');
      return {
        entityType, entityId,
        compliant: missing.length === 0,
        completionPct: checklist.completionPct,
        missingItems: missing.map((i) => ({ documentType: i.documentType, libelle: i.libelle, statut: i.statut })),
      };
    }

    if (entityType === 'CEDANTE' || entityType === 'REASSUREUR' || entityType === 'CO_COURTIER') {
      const where: Record<string, unknown> = { isActive: true };
      if (entityType === 'CEDANTE') where.cedanteId = entityId;
      if (entityType === 'REASSUREUR') where.reassureurId = entityId;
      if (entityType === 'CO_COURTIER') where.coCourtId = entityId;

      const convention = await this.prisma.convention.findFirst({ where });
      return {
        entityType, entityId,
        compliant: !!convention,
        missingItems: convention
          ? []
          : [{ documentType: 'CONVENTION', libelle: 'Convention signée (GED)', statut: 'MANQUANT' }],
      };
    }

    // Other entity types have no mandatory-document policy defined yet.
    return { entityType, entityId, compliant: true, missingItems: [] };
  }
}