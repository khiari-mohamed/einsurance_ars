import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ImportExportService {
  constructor(private prisma: PrismaService) {}

  async exportCedantes(): Promise<Buffer> {
    const rows = (
      await this.prisma.cedante.findMany({
        where: { isActive: true },
        include: { contacts: true, bankAccounts: true },
        orderBy: { code: 'asc' },
      })
    ).map((c) => ({
      Code: c.code,
      'Raison Sociale': c.raisonSociale,
      'Compte Comptable': c.compteComptable,
      RNE: c.rne ?? '',
      'Forme Juridique': c.formeJuridique ?? '',
      Adresse: c.adresse ?? '',
      Pays: c.pays ?? '',
      Capital: c.capital?.toString() ?? '',
    }));
    return this.toExcel(rows, 'Cédantes');
  }

  async exportReassureurs(): Promise<Buffer> {
    const rows = (
      await this.prisma.reassureur.findMany({
        where: { isActive: true },
        include: { contacts: true, bankAccounts: true },
        orderBy: { code: 'asc' },
      })
    ).map((r) => ({
      Code: r.code,
      'Raison Sociale': r.raisonSociale,
      'Compte Comptable': r.compteComptable,
      Pays: r.pays ?? '',
      Capital: r.capital?.toString() ?? '',
    }));
    return this.toExcel(rows, 'Réassureurs');
  }

  async exportAffaires(): Promise<Buffer> {
    const rows = (
      await this.prisma.affaire.findMany({
        where: { isActive: true },
        include: { cedante: true },
        orderBy: { createdAt: 'desc' },
      })
    ).map((a) => ({
      Numéro: a.numero,
      Type: a.type,
      Statut: a.statut,
      Cédante: a.cedante.raisonSociale,
      Devise: a.currency,
      'Mode Paiement': a.modePaiement,
      'Créé le': a.createdAt.toLocaleDateString('fr-TN'),
    }));
    return this.toExcel(rows, 'Affaires');
  }

  async exportSinistres(): Promise<Buffer> {
    const rows = (
      await this.prisma.sinistre.findMany({
        include: { affaire: { include: { cedante: true } } },
        orderBy: { createdAt: 'desc' },
      })
    ).map((s) => ({
      Numéro: s.numero,
      Affaire: s.affaire.numero,
      Cédante: s.affaire.cedante.raisonSociale,
      Statut: s.statut,
      'Date Survenance': s.dateSurvenance.toLocaleDateString('fr-TN'),
      'Date Déclaration': s.dateDeclaration.toLocaleDateString('fr-TN'),
      Réserves: s.reserves?.toString() ?? '',
      'Part Réassureurs': s.partReassureurs?.toString() ?? '',
      SAP: s.sap?.toString() ?? '',
    }));
    return this.toExcel(rows, 'Sinistres');
  }

  private toExcel(rows: Record<string, any>[], sheetName: string): Buffer {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  }
}