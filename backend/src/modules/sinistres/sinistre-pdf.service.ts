import { Injectable } from '@nestjs/common';
import { StorageService } from '../shared/services/storage.service';

@Injectable()
export class SinistrePDFService {
  constructor(private storageService: StorageService) {}

  async generateBordereauPDF(bordereauData: any): Promise<string> {
    const htmlContent = this.generateBordereauHTML(bordereauData);
    
    const filename = `bordereau-sinistres-${bordereauData.numero}.pdf`;
    const filePath = `bordereaux/sinistres/${new Date().getFullYear()}/${filename}`;
    
    const buffer = Buffer.from(htmlContent);
    const result = await this.storageService.uploadFile(filePath, buffer, 'application/pdf');
    
    return result.url;
  }

  private generateBordereauHTML(data: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #1976d2; }
          .info { margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #1976d2; color: white; }
          .totaux { margin-top: 20px; font-weight: bold; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>ARS TUNISIE</h1>
          <h2>BORDEREAU SINISTRES</h2>
          <p>N° ${data.numero}</p>
        </div>
        
        <div class="info">
          <p><strong>Date d'émission:</strong> ${new Date(data.dateEmission).toLocaleDateString('fr-FR')}</p>
          <p><strong>Période:</strong> ${new Date(data.periode.debut).toLocaleDateString('fr-FR')} - ${new Date(data.periode.fin).toLocaleDateString('fr-FR')}</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>N° Sinistre</th>
              <th>Cédante</th>
              <th>Affaire</th>
              <th>Date Survenance</th>
              <th>Montant Total</th>
              <th>Part Réassurance</th>
              <th>Montant Réglé</th>
              <th>Restant</th>
              <th>SAP</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            ${data.sinistres.map((s: any) => `
              <tr>
                <td>${s.numero}</td>
                <td>${s.cedante}</td>
                <td>${s.affaire}</td>
                <td>${new Date(s.dateSurvenance).toLocaleDateString('fr-FR')}</td>
                <td>${s.montantTotal.toLocaleString('fr-FR')} TND</td>
                <td>${s.montantReassurance.toLocaleString('fr-FR')} TND</td>
                <td>${s.montantRegle.toLocaleString('fr-FR')} TND</td>
                <td>${s.montantRestant.toLocaleString('fr-FR')} TND</td>
                <td>${s.sapActuel.toLocaleString('fr-FR')} TND</td>
                <td>${s.statut}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totaux">
          <p>Nombre de sinistres: ${data.totaux.nombreSinistres}</p>
          <p>Montant total: ${data.totaux.montantTotal.toLocaleString('fr-FR')} TND</p>
          <p>Part réassurance: ${data.totaux.montantReassurance.toLocaleString('fr-FR')} TND</p>
          <p>Montant réglé: ${data.totaux.montantRegle.toLocaleString('fr-FR')} TND</p>
          <p>Montant restant: ${data.totaux.montantRestant.toLocaleString('fr-FR')} TND</p>
          <p>SAP total: ${data.totaux.sapTotal.toLocaleString('fr-FR')} TND</p>
        </div>
        
        <div class="footer">
          <p>ARS TUNISIE - Courtier en Réassurance</p>
          <p>Ce document est généré automatiquement</p>
        </div>
      </body>
      </html>
    `;
  }
}
