import { Injectable, BadRequestException } from '@nestjs/common';
import { IntegrationExportFormat } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class IntegrationExportService {
  constructor(private prisma: PrismaService) {}

  async export(
    format: IntegrationExportFormat,
    dateFrom?: string,
    dateTo?: string,
    entryIds?: string[],
    userId?: string,
  ): Promise<{ buffer: Buffer; fileName: string; exportId: string }> {
    const where: any = { statut: 'VALIDE' };
    if (entryIds?.length) where.id = { in: entryIds };
    if (dateFrom || dateTo) {
      where.createdAt = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            planComptable: true,
            auxiliary: true,
            cedante: { select: { code: true, raisonSociale: true } },
            reassureur: { select: { code: true, raisonSociale: true } },
          },
          orderBy: { ordre: 'asc' },
        },
        fiscalPeriod: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (entries.length === 0) {
      throw new BadRequestException('Aucune écriture validée trouvée pour l\'export');
    }

    const fileName = `export-comptable-${new Date().toISOString().split('T')[0]}.${format === IntegrationExportFormat.EXCEL ? 'xlsx' : 'txt'}`;

    let buffer: Buffer;
    if (format === IntegrationExportFormat.EXCEL) {
      buffer = this.toExcel(entries);
    } else {
      buffer = this.toTxt(entries);
    }

    // Record the export
    const exportRecord = await this.prisma.integrationExport.create({
      data: {
        format,
        fileName,
        dateExport: new Date(),
        nombreEntrees: entries.length,
        exportedByUserId: userId,
      },
    });

    // Mark entries as exported
    await this.prisma.journalEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { integrationExportId: exportRecord.id },
    });

    return { buffer, fileName, exportId: exportRecord.id };
  }

  private toExcel(entries: any[]): Buffer {
    const rows: any[] = [];
    for (const entry of entries) {
      for (const line of entry.lines) {
        rows.push({
          'N° Écriture': entry.numero,
          'Date': entry.createdAt.toLocaleDateString('fr-TN'),
          'Période': entry.fiscalPeriod ? `${entry.fiscalPeriod.annee}/${entry.fiscalPeriod.mois ?? 'AN'}` : '',
          'Type': entry.type,
          'Compte': line.planComptable.compte,
          'Libellé Compte': line.planComptable.libelle,
          'Auxiliaire': line.auxiliary?.code ?? '',
          'Libellé Auxiliaire': line.auxiliary?.libelle ?? '',
          'Débit': line.debit?.toString() ?? '',
          'Crédit': line.credit?.toString() ?? '',
          'Devise': line.currency,
          'Libellé Ligne': line.libelle ?? '',
          'Cédante': line.cedante?.raisonSociale ?? '',
          'Réassureur': line.reassureur?.raisonSociale ?? '',
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ecritures');
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }

  private toTxt(entries: any[]): Buffer {
    const lines: string[] = [];
    lines.push('NUM_ECRITURE|DATE|TYPE|COMPTE|AUXILIAIRE|DEBIT|CREDIT|DEVISE|LIBELLE');
    for (const entry of entries) {
      for (const line of entry.lines) {
        lines.push([
          entry.numero,
          entry.createdAt.toISOString().split('T')[0],
          entry.type,
          line.planComptable.compte,
          line.auxiliary?.code ?? '',
          line.debit?.toString() ?? '0',
          line.credit?.toString() ?? '0',
          line.currency,
          (line.libelle ?? '').replace(/\|/g, ' '),
        ].join('|'));
      }
    }
    return Buffer.from(lines.join('\n'), 'utf8');
  }
}