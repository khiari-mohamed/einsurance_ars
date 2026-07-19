import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Retrieve deactivation audit trail for all référentiel entities
   * (ASSURE, CEDANTE, REASSUREUR, CO_COURTIER).
   * Includes user info, timestamps, and entity details.
   */
  async getReferentielHistory(
    page = 1,
    limit = 50,
    entityType?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      entityType: {
        in: ['ASSURE', 'CEDANTE', 'REASSUREUR', 'CO_COURTIER'],
      },
      action: { in: ['DEACTIVATE', 'BULK_DEACTIVATE'] },
    };

    if (entityType && ['ASSURE', 'CEDANTE', 'REASSUREUR', 'CO_COURTIER'].includes(entityType)) {
      where.entityType = entityType;
    }

    if (search) {
      where.OR = [
        {
          after: {
            path: ['raisonSociale'],
            string_contains: search,
          },
        },
        {
          after: {
            path: ['code'],
            string_contains: search,
          },
        },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              nom: true,
              prenom: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Enrich logs with entity label
    const enriched = logs.map((log) => {
      const entityLabel = this.getEntityTypeLabel(log.entityType);
      const afterData = log.after as any || {};
      const entityName = afterData.raisonSociale || afterData.code || '(Unknown)';
      return {
        ...log,
        entityLabel,
        entityName,
        userName: log.user
          ? `${log.user.prenom} ${log.user.nom}`.trim()
          : '(System)',
      };
    });

    return {
      data: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  private getEntityTypeLabel(entityType: string): string {
    const labels: Record<string, string> = {
      ASSURE: 'Client',
      CEDANTE: 'Compagnie d\'assurances',
      REASSUREUR: 'Réassureur',
      CO_COURTIER: 'Courtier en réassurance',
    };
    return labels[entityType] || entityType;
  }
}
