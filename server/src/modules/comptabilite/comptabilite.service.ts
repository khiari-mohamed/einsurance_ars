import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { JournalEntryStatut } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ValidateEntryDto } from './dto/validate-entry.dto';
import { ExportEntriesDto } from './dto/export-entries.dto';

@Injectable()
export class ComptabiliteService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters: { statut?: JournalEntryStatut; type?: string; affaireId?: string; fiscalPeriodId?: string; page?: number; limit?: number }) {
    const { statut, type, affaireId, fiscalPeriodId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (statut) where.statut = statut;
    if (type) where.type = type;
    if (affaireId) where.affaireId = affaireId;
    if (fiscalPeriodId) where.fiscalPeriodId = fiscalPeriodId;

    const [data, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where, include: { lines: { include: { planComptable: true } }, affaire: { select: { numero: true } } },
        skip, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const entry = await this.prisma.journalEntry.findUnique({
      where: { id },
      include: {
        lines: { include: { planComptable: true, auxiliary: true, cedante: true, reassureur: true }, orderBy: { ordre: 'asc' } },
        affaire: { select: { numero: true } },
      },
    });
    if (!entry) throw new NotFoundException('Écriture introuvable');
    return entry;
  }

  async validate(id: string, dto: ValidateEntryDto, userId: string) {
    const entry = await this.findOne(id);
    if (entry.statut === JournalEntryStatut.VALIDE) throw new BadRequestException('Écriture déjà validée');

    const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
    const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException(`Écriture déséquilibrée: débit ${totalDebit} ≠ crédit ${totalCredit}`);
    }

    const updated = await this.prisma.journalEntry.update({
      where: { id },
      data: { statut: JournalEntryStatut.VALIDE, validatedAt: new Date(), validatedBy: userId, pieceComptable: dto.pieceComptable, codeJournal: dto.codeJournal },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: 'JOURNAL_ENTRY_VALIDATED', entityType: 'JournalEntry', entityId: id, after: { numero: entry.numero } },
    });

    return updated;
  }

  async delete(id: string) {
    const entry = await this.findOne(id);
    if (entry.statut === JournalEntryStatut.VALIDE) throw new BadRequestException('Impossible de supprimer une écriture validée');
    await this.prisma.journalLine.deleteMany({ where: { journalEntryId: id } });
    return this.prisma.journalEntry.delete({ where: { id } });
  }

  /**
   * General ledger — filterable by compte prefix, tiers, or year.
   * Journal Achats (réassureurs, 401xxxxx) and Journal Ventes (cédantes,
   * 411xxxxx) are both just this ledger filtered to the right prefix, per
   * the CDC's own account numbering convention (§V — Fournisseur/401 for
   * réassureurs, Client/411 for cédantes).
   */
  async getLedger(filters: { compte?: string; cedanteId?: string; reassureurId?: string; year?: number }) {
    const { compte, cedanteId, reassureurId, year } = filters;
    const where: any = {};
    if (compte) where.planComptable = { compte: { startsWith: compte } };
    if (cedanteId) where.cedanteId = cedanteId;
    if (reassureurId) where.reassureurId = reassureurId;
    if (year) where.journalEntry = { createdAt: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31T23:59:59`) } };

    const lines = await this.prisma.journalLine.findMany({
      where,
      include: {
        planComptable: true,
        journalEntry: { select: { numero: true, statut: true, type: true, description: true, codeJournal: true, pieceComptable: true, createdAt: true } },
        cedante: { select: { code: true, raisonSociale: true } },
        reassureur: { select: { code: true, raisonSociale: true } },
      },
      orderBy: { journalEntry: { createdAt: 'desc' } },
    });

    const totalDebit = lines.reduce((s, l) => s + Number(l.debit ?? 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit ?? 0), 0);

    return { lines, totalDebit: this.round3(totalDebit), totalCredit: this.round3(totalCredit), solde: this.round3(totalDebit - totalCredit) };
  }

  async getTrialBalance(year?: number, mois?: number) {
    const targetYear = year ?? new Date().getFullYear();
    const where: any = {
      statut: JournalEntryStatut.VALIDE,
      createdAt: { gte: new Date(`${targetYear}-01-01`), lte: new Date(`${targetYear}-12-31T23:59:59`) },
    };
    if (mois) {
      where.createdAt = { gte: new Date(targetYear, mois - 1, 1), lte: new Date(targetYear, mois, 0, 23, 59, 59) };
    }

    const lines = await this.prisma.journalLine.findMany({
      where: { journalEntry: where },
      include: { planComptable: true },
    });

    const grouped = new Map<string, { compte: string; libelle: string; debit: number; credit: number }>();
    for (const l of lines) {
      const key = l.planComptable.compte;
      if (!grouped.has(key)) grouped.set(key, { compte: key, libelle: l.planComptable.libelle, debit: 0, credit: 0 });
      const g = grouped.get(key)!;
      g.debit += Number(l.debit ?? 0);
      g.credit += Number(l.credit ?? 0);
    }

    return Array.from(grouped.values())
      .map((g) => ({ ...g, debit: this.round3(g.debit), credit: this.round3(g.credit), solde: this.round3(g.debit - g.credit) }))
      .sort((a, b) => a.compte.localeCompare(b.compte));
  }

  /**
   * NEW (Comptabilité pass): a simple compte de résultat (P&L) view —
   * classes 6 (charges) and 7 (produits) from the validated trial balance.
   * This is the honest, CDC-adjacent alternative to a fabricated Bilan —
   * see comptabilite.controller.ts comment on why a full Bilan isn't built.
   */
  async getProfitLoss(year?: number) {
    const balance = await this.getTrialBalance(year);
    const charges = balance.filter((b) => b.compte.startsWith('6'));
    const produits = balance.filter((b) => b.compte.startsWith('7'));
    const totalCharges = this.round3(charges.reduce((s, c) => s + c.debit - c.credit, 0));
    const totalProduits = this.round3(produits.reduce((s, p) => s + p.credit - p.debit, 0));
    return { year: year ?? new Date().getFullYear(), charges, produits, totalCharges, totalProduits, resultatNet: this.round3(totalProduits - totalCharges) };
  }

  async exportEntries(dto: ExportEntriesDto) {
    const where: any = { statut: JournalEntryStatut.VALIDE };
    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {};
      if (dto.dateFrom) where.createdAt.gte = new Date(dto.dateFrom);
      if (dto.dateTo) where.createdAt.lte = new Date(dto.dateTo);
    }
    if (dto.codeJournal) where.codeJournal = dto.codeJournal;

    const entries = await this.prisma.journalEntry.findMany({
      where, include: { lines: { include: { planComptable: true } } }, orderBy: { createdAt: 'asc' },
    });

    const rows: string[] = ['JournalCode;PieceNumero;Date;Compte;Libelle;Debit;Credit;Devise'];
    for (const e of entries) {
      for (const l of e.lines) {
        rows.push([
          e.codeJournal ?? '', e.pieceComptable ?? e.numero, e.createdAt.toISOString().split('T')[0],
          l.planComptable.compte, (l.libelle ?? '').replace(/;/g, ','), (l.debit ?? 0).toString(), (l.credit ?? 0).toString(), e.currency,
        ].join(';'));
      }
    }

    return { format: dto.format ?? 'csv', content: rows.join('\n'), count: entries.length };
  }

  private round3(n: number): number { return Math.round(n * 1000) / 1000; }
}