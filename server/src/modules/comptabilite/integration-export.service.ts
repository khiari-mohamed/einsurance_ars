import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SequenceService } from '../../shared/services/sequence.service';
import { GenerateExportDto } from './dto/generate-export.dto';

interface ExportLine {
  journalCode: string;
  pieceNumero: string;
  dateEcriture: Date;
  compte: string;
  compteAuxiliaire?: string;
  libelle: string;
  debit: number;
  credit: number;
  devise: string;
}

/**
 * IntegrationExportService — builds the "fichier d'intégration" that hands
 * off validated journal entries to ARS's external accounting system.
 *
 * Design note: this is deliberately separate from
 * ComptabiliteService.exportEntries() (the simple, stateless CSV download
 * used by the Grand Livre / ad-hoc reporting screens). This service is for
 * the REAL handoff to accounting: it only ever exports VALIDE entries that
 * have never been exported before, records exactly what was sent as an
 * immutable ExportBatch, and marks those entries as exported so a second
 * run of the same export doesn't resend them. If ARS needs to re-download
 * a specific past batch (e.g. the accountant lost the file), that's
 * getBatch()/reexportBatch() below — replaying the ORIGINAL stored content,
 * not regenerating from current (possibly since-changed) data.
 *
 * Format: SAGE by default, matching the existing SAGE accounting
 * integration already built for this project (config-driven API/import
 * module). CSV_GENERIC is available as a fallback for any other target.
 * The SAGE column layout below (JournalCode;NumeroPiece;DateEcriture;
 * CompteGeneral;CompteAuxiliaire;Libelle;Debit;Credit;Devise) matches
 * SAGE's standard "import d'écritures" delimited-text format — if ARS's
 * actual SAGE tenant expects a different column order or a fixed-width
 * layout instead, that's a one-line change to formatSageLine() below,
 * everything else (batching, idempotency, audit) is format-independent.
 */
@Injectable()
export class IntegrationExportService {
  private readonly logger = new Logger(IntegrationExportService.name);

  constructor(
    private prisma: PrismaService,
    private sequence: SequenceService,
  ) {}

  async generate(dto: GenerateExportDto, userId?: string) {
    const format = dto.format ?? 'SAGE';

    const where: any = {
      statut: 'VALIDE',
      exportedAt: null, // idempotency: never re-export an already-exported entry
    };
    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {};
      if (dto.dateFrom) where.createdAt.gte = new Date(dto.dateFrom);
      if (dto.dateTo) where.createdAt.lte = new Date(dto.dateTo);
    }
    if (dto.codeJournal) where.codeJournal = dto.codeJournal;

    const entries = await this.prisma.journalEntry.findMany({
      where,
      include: { lines: { include: { planComptable: true, auxiliary: true }, orderBy: { ordre: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });

    if (entries.length === 0) {
      throw new BadRequestException('Aucune écriture validée à exporter (soit aucune écriture ne correspond aux filtres, soit tout a déjà été exporté).');
    }

    const exportLines: ExportLine[] = [];
    for (const entry of entries) {
      for (const line of entry.lines) {
        exportLines.push({
          journalCode: entry.codeJournal ?? this.inferJournalCode(line.planComptable.compte),
          pieceNumero: entry.pieceComptable ?? entry.numero,
          dateEcriture: entry.createdAt,
          compte: line.planComptable.compte,
          compteAuxiliaire: line.auxiliary?.code,
          libelle: (line.libelle ?? entry.description ?? '').slice(0, 60), // SAGE libellé field is conventionally capped
          debit: Number(line.debit ?? 0),
          credit: Number(line.credit ?? 0),
          devise: entry.currency,
        });
      }
    }

    const content = format === 'SAGE' ? this.formatSage(exportLines) : this.formatCsvGeneric(exportLines);
    const reference = await this.sequence.next('JOURNAL_ENTRY');

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.exportBatch.create({
        data: {
          reference,
          format,
          dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : undefined,
          dateTo: dto.dateTo ? new Date(dto.dateTo) : undefined,
          codeJournal: dto.codeJournal,
          entryCount: entries.length,
          content,
          exportedByUserId: userId,
        },
      });

      await tx.journalEntry.updateMany({
        where: { id: { in: entries.map((e) => e.id) } },
        data: { exportBatchId: created.id, exportedAt: new Date() },
      });

      return created;
    });

    if (userId) {
      await this.prisma.auditLog.create({
        data: {
          userId, action: 'EXPORT_BATCH_GENERATED', entityType: 'ExportBatch', entityId: batch.id,
          after: { reference: batch.reference, format, entryCount: batch.entryCount },
        },
      });
    }

    this.logger.log(`Export batch ${reference} generated: ${entries.length} entries, format ${format}`);
    return batch;
  }

  async listBatches(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.exportBatch.findMany({
        select: { id: true, reference: true, format: true, dateFrom: true, dateTo: true, codeJournal: true, entryCount: true, exportedByUserId: true, createdAt: true },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.exportBatch.count(),
    ]);
    return { data, total, page, limit };
  }

  async getBatch(id: string) {
    const batch = await this.prisma.exportBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Lot d\'export introuvable');
    return batch;
  }

  /** Re-download the exact content of a past batch — not a regeneration. */
  async reexportBatch(id: string) {
    return this.getBatch(id);
  }

  /**
   * Admin-only escape hatch: unmark entries from a batch as exported, e.g.
   * if the batch failed to import into SAGE and needs to be regenerated
   * with fresh data instead of just re-downloaded verbatim. Does NOT
   * delete the batch record itself (audit trail stays intact) — just frees
   * the entries to be picked up by the next generate() call.
   */
  async voidBatch(id: string, userId: string) {
    const batch = await this.getBatch(id);
    await this.prisma.journalEntry.updateMany({
      where: { exportBatchId: id },
      data: { exportBatchId: null, exportedAt: null },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: 'EXPORT_BATCH_VOIDED', entityType: 'ExportBatch', entityId: id, before: { reference: batch.reference } },
    });
    return { voided: true, entriesFreed: batch.entryCount };
  }

  // ── Formatters ───────────────────────────────────────────────────

  private formatSage(lines: ExportLine[]): string {
    const header = 'JournalCode;NumeroPiece;DateEcriture;CompteGeneral;CompteAuxiliaire;Libelle;Debit;Credit;Devise';
    const rows = lines.map((l) => [
      l.journalCode,
      l.pieceNumero,
      this.formatDateSage(l.dateEcriture),
      l.compte,
      l.compteAuxiliaire ?? '',
      l.libelle.replace(/;/g, ','),
      l.debit.toFixed(3),
      l.credit.toFixed(3),
      l.devise,
    ].join(';'));
    return [header, ...rows].join('\r\n'); // SAGE import expects CRLF line endings
  }

  private formatCsvGeneric(lines: ExportLine[]): string {
    const header = 'Journal;Piece;Date;Compte;Auxiliaire;Libelle;Debit;Credit;Devise';
    const rows = lines.map((l) => [
      l.journalCode, l.pieceNumero, l.dateEcriture.toISOString().split('T')[0],
      l.compte, l.compteAuxiliaire ?? '', l.libelle.replace(/;/g, ','),
      l.debit.toFixed(3), l.credit.toFixed(3), l.devise,
    ].join(';'));
    return [header, ...rows].join('\n');
  }

  private formatDateSage(d: Date): string {
    // SAGE's standard import date format is DDMMYYYY.
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}${mm}${d.getFullYear()}`;
  }

  /** Fallback journal-code inference by account class prefix, used only
   * when an entry's codeJournal wasn't set at validation time. */
  private inferJournalCode(compte: string): string {
    if (compte.startsWith('401')) return 'ACH';
    if (compte.startsWith('411')) return 'VTE';
    if (compte.startsWith('53')) return 'BQ';
    return 'OD';
  }
}