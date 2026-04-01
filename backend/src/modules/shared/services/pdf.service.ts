import { Injectable } from '@nestjs/common';
import { Bordereau } from '../../bordereaux/bordereaux.entity';
import { BordereauDocument } from '../../bordereaux/bordereau-document.entity';
import PDFDocument = require('pdfkit');

@Injectable()
export class PdfService {
  async generateBordereauPdf(bordereau: Bordereau, documents: BordereauDocument[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('ARS TUNISIE', { align: 'center' });
      doc.fontSize(16).text(this.getBordereauTitle(bordereau.type), { align: 'center' });
      doc.moveDown();

      // Bordereau Info
      doc.fontSize(12);
      doc.text(`Numéro: ${bordereau.numero}`);
      doc.text(`Type: ${bordereau.type.toUpperCase()}`);
      doc.text(`Statut: ${bordereau.status}`);
      doc.text(`Date d'émission: ${this.formatDate(bordereau.dateEmission)}`);
      doc.moveDown();

      // Parties
      doc.fontSize(14).text('PARTIES', { underline: true });
      doc.fontSize(11);
      doc.text(`Cédante: ${bordereau.cedante?.raisonSociale || 'N/A'}`);
      if (bordereau.reassureur) {
        doc.text(`Réassureur: ${bordereau.reassureur.raisonSociale}`);
      }
      doc.moveDown();

      // Période
      doc.fontSize(14).text('PÉRIODE', { underline: true });
      doc.fontSize(11);
      doc.text(`Du: ${this.formatDate(bordereau.dateDebut)}`);
      doc.text(`Au: ${this.formatDate(bordereau.dateFin)}`);
      if (bordereau.dateLimitePaiement) {
        doc.text(`Date limite de paiement: ${this.formatDate(bordereau.dateLimitePaiement)}`);
      }
      doc.moveDown();

      // Lignes
      if (bordereau.lignes && bordereau.lignes.length > 0) {
        doc.fontSize(14).text('DÉTAIL DES AFFAIRES', { underline: true });
        doc.fontSize(9);

        const tableTop = doc.y + 10;
        const colWidths = [30, 150, 80, 80, 80, 80];
        const headers = ['N°', 'Description', 'Montant Brut', 'Montant Cédé', 'Commission', 'Net à Payer'];

        // Table headers
        let x = 50;
        headers.forEach((header, i) => {
          doc.text(header, x, tableTop, { width: colWidths[i], align: 'left' });
          x += colWidths[i];
        });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Table rows
        let y = tableTop + 20;
        bordereau.lignes.forEach((ligne) => {
          if (y > 700) {
            doc.addPage();
            y = 50;
          }

          x = 50;
          const rowData = [
            ligne.numLigne.toString(),
            ligne.description.substring(0, 30),
            this.formatCurrency(ligne.montantBrut, bordereau.devise),
            this.formatCurrency(ligne.montantCede, bordereau.devise),
            this.formatCurrency(ligne.commissionMontant, bordereau.devise),
            this.formatCurrency(ligne.netAPayer, bordereau.devise),
          ];

          rowData.forEach((data, i) => {
            doc.text(data, x, y, { width: colWidths[i], align: i === 1 ? 'left' : 'right' });
            x += colWidths[i];
          });

          y += 20;
        });

        doc.moveDown(2);
      }

      // Totaux
      doc.fontSize(12).text('RÉCAPITULATIF FINANCIER', { underline: true });
      doc.fontSize(11);
      doc.text(`Prime Totale: ${this.formatCurrency(bordereau.primeTotale, bordereau.devise)}`);
      doc.text(`Commission Cédante: ${this.formatCurrency(bordereau.commissionCedante, bordereau.devise)}`);
      doc.text(`Commission ARS: ${this.formatCurrency(bordereau.commissionARS, bordereau.devise)}`);
      doc.text(`Sinistres: ${this.formatCurrency(bordereau.sinistres, bordereau.devise)}`);
      doc.text(`Acompte Reçu: ${this.formatCurrency(bordereau.acompteRecu, bordereau.devise)}`);
      doc.font('Helvetica-Bold').fontSize(13).text(`SOLDE: ${this.formatCurrency(bordereau.solde, bordereau.devise)}`);
      doc.font('Helvetica').moveDown();

      // Documents attachés
      if (documents && documents.length > 0) {
        doc.fontSize(12).text('DOCUMENTS JOINTS', { underline: true });
        doc.fontSize(10);
        documents.forEach((doc_item, index) => {
          doc.text(`${index + 1}. ${doc_item.nomFichier} (${doc_item.type})`);
        });
      }

      // Footer
      doc.fontSize(8).text(
        `Généré le ${this.formatDate(new Date())} - ARS Tunisie`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      doc.end();
    });
  }

  private formatDate(date: Date | string): string {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR');
  }

  private formatCurrency(amount: number | string, currency: string = 'TND'): string {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return `${num.toFixed(2)} ${currency}`;
  }

  private getBordereauTitle(type: string): string {
    const titles = {
      'cession': 'BORDEREAU DE CESSION',
      'reassureur': 'BORDEREAU RÉASSUREUR',
      'sinistre': 'BORDEREAU SINISTRE',
      'situation': 'BORDEREAU DE SITUATION',
    };
    return titles[type] || 'BORDEREAU';
  }
}
