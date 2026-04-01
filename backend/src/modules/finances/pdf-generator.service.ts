import { Injectable } from '@nestjs/common';
import { OrdrePaiement, PaymentOrderTemplate } from './ordre-paiement.entity';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import { join } from 'path';

@Injectable()
export class PDFGeneratorService {
  async generateOrdrePaiementPDF(ordre: OrdrePaiement, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = createWriteStream(outputPath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('ORDRE DE PAIEMENT', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`N° ${ordre.numero}`, { align: 'center' });
      doc.moveDown(2);

      // Date
      doc.fontSize(10).text(`Date: ${new Date(ordre.dateCreation).toLocaleDateString('fr-FR')}`, { align: 'right' });
      doc.moveDown();

      // Beneficiary
      doc.fontSize(14).text('BÉNÉFICIAIRE', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`Nom: ${ordre.beneficiaire.nom}`);
      doc.text(`Banque: ${ordre.beneficiaire.banque}`);
      doc.text(`IBAN: ${ordre.beneficiaire.iban}`);
      if (ordre.beneficiaire.bic) doc.text(`BIC/SWIFT: ${ordre.beneficiaire.bic}`);
      doc.text(`Adresse: ${ordre.beneficiaire.adresse}`);
      doc.text(`Pays: ${ordre.beneficiaire.pays}`);
      doc.moveDown(2);

      // Amount
      doc.fontSize(14).text('MONTANT', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(`${ordre.montant.toFixed(2)} ${ordre.devise}`);
      doc.font('Helvetica').fontSize(10);
      doc.text(`En lettres: ${ordre.montantLettres}`);
      doc.moveDown(2);

      // Purpose
      doc.fontSize(14).text('OBJET DU PAIEMENT', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10).text(ordre.objet);
      if (ordre.referenceFacture) doc.text(`Référence facture: ${ordre.referenceFacture}`);
      if (ordre.referenceAffaire) doc.text(`Référence affaire: ${ordre.referenceAffaire}`);
      doc.moveDown(2);

      // Signatures
      doc.fontSize(14).text('SIGNATURES', { underline: true });
      doc.moveDown(2);

      const signatureY = doc.y;
      doc.fontSize(10);
      
      // Creator
      doc.text('Créé par:', 50, signatureY);
      doc.text('_________________', 50, signatureY + 40);
      
      // Verifier
      if (ordre.verificateurId) {
        doc.text('Vérifié par:', 220, signatureY);
        doc.text('_________________', 220, signatureY + 40);
      }
      
      // Signer
      if (ordre.ordinateurId) {
        doc.text('Signé par:', 390, signatureY);
        doc.text('_________________', 390, signatureY + 40);
      }

      doc.moveDown(5);

      // Footer
      if (ordre.template === PaymentOrderTemplate.URGENT) {
        doc.fontSize(12).fillColor('red').text('*** URGENT ***', { align: 'center' });
      }

      doc.fontSize(8).fillColor('gray').text(
        'ARS TUNISIE - Ordre de paiement généré automatiquement',
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }

  async generateCommissionStatementPDF(data: any, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = createWriteStream(outputPath);

      doc.pipe(stream);

      doc.fontSize(18).text('RELEVÉ DE COMMISSIONS', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Période: ${data.periode.startDate} - ${data.periode.endDate}`, { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(12).text('RÉSUMÉ', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`Total commissions: ${data.totalCommissions.toFixed(2)} TND`);
      doc.text(`Nombre d'opérations: ${data.count}`);
      doc.moveDown();

      // By Type
      doc.text('Par type:');
      Object.entries(data.byType).forEach(([type, montant]: [string, any]) => {
        doc.text(`  ${type}: ${montant.toFixed(2)} TND`);
      });
      doc.moveDown();

      // By Status
      doc.text('Par statut:');
      Object.entries(data.byStatus).forEach(([status, montant]: [string, any]) => {
        doc.text(`  ${status}: ${montant.toFixed(2)} TND`);
      });

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }

  async generateSettlementPDF(settlement: any, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const stream = createWriteStream(outputPath);

      doc.pipe(stream);

      doc.fontSize(18).text('BORDEREAU DE SITUATION', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`N° ${settlement.numero}`, { align: 'center' });
      doc.moveDown(2);

      // Period
      doc.fontSize(12).text(`Période: ${new Date(settlement.dateDebut).toLocaleDateString('fr-FR')} - ${new Date(settlement.dateFin).toLocaleDateString('fr-FR')}`);
      doc.moveDown();

      // Cedante
      doc.text(`Cédante: ${settlement.cedante?.raisonSociale || 'N/A'}`);
      doc.moveDown(2);

      // Totals
      doc.fontSize(12).text('TOTAUX', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(10);
      doc.text(`Prime totale: ${settlement.totalPrime.toFixed(2)} TND`);
      doc.text(`Commission cédante: ${settlement.totalCommissionCedante.toFixed(2)} TND`);
      doc.text(`Commission ARS: ${settlement.totalCommissionARS.toFixed(2)} TND`);
      doc.text(`Sinistres: ${settlement.totalSinistre.toFixed(2)} TND`);
      doc.moveDown();
      doc.fontSize(12).font('Helvetica-Bold').text(`SOLDE FINAL: ${settlement.soldeFinal.toFixed(2)} TND`);

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    });
  }
}
