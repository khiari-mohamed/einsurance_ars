import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as XLSX from 'xlsx';
import { Affaire } from '../affaires/affaires.entity';
import { Cedante } from '../cedantes/cedantes.entity';
import { Reassureur } from '../reassureurs/reassureurs.entity';
import { Sinistre } from '../sinistres/sinistres.entity';
import { Encaissement } from '../finances/encaissement.entity';
import { Decaissement } from '../finances/decaissement.entity';

@Injectable()
export class ImportExportService {
  constructor(
    @InjectRepository(Affaire) private affaireRepo: Repository<Affaire>,
    @InjectRepository(Cedante) private cedanteRepo: Repository<Cedante>,
    @InjectRepository(Reassureur) private reassureurRepo: Repository<Reassureur>,
    @InjectRepository(Sinistre) private sinistreRepo: Repository<Sinistre>,
    private dataSource: DataSource,
  ) {}

  // ==================== EXPORT ====================

  async exportAffairesToExcel(filters?: any): Promise<Buffer> {
    const affaires = await this.affaireRepo.find({
      relations: ['cedante', 'assure', 'reinsurers', 'reinsurers.reassureur'],
      where: filters,
    });

    const data = affaires.map(a => ({
      'Numéro Affaire': a.numeroAffaire,
      'Statut': a.status,
      'Catégorie': a.category,
      'Type': a.type,
      'Cédante': a.cedante?.raisonSociale,
      'Assuré': a.assure?.raisonSociale,
      'Branche': a.branche,
      'Date Effet': a.dateEffet,
      'Date Échéance': a.dateEcheance,
      'Capital Assuré 100%': a.capitalAssure100,
      'Prime 100%': a.prime100,
      'Taux Cession': a.tauxCession,
      'Prime Cédée': a.primeCedee,
      'Commission Cédante': a.montantCommissionCedante,
      'Commission ARS': a.montantCommissionARS,
      'Devise': a.devise,
      'Exercice': a.exercice,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Affaires');

    // Auto-size columns
    const maxWidth = data.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
    worksheet['!cols'] = Array(maxWidth).fill({ wch: 15 });

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async exportSinistresToExcel(filters?: any): Promise<Buffer> {
    const sinistres = await this.sinistreRepo.find({
      relations: ['affaire', 'cedante', 'participations', 'participations.reassureur'],
      where: filters,
    });

    const data = sinistres.map(s => ({
      'Numéro Sinistre': s.numero,
      'Référence Cédante': s.referenceCedante,
      'Affaire': s.affaire?.numeroAffaire,
      'Cédante': s.cedante?.raisonSociale,
      'Date Survenance': s.dateSurvenance,
      'Date Déclaration': s.dateDeclarationCedante,
      'Montant Total': s.montantTotal,
      'Montant Réassurance': s.montantReassurance,
      'Montant Réglé': s.montantRegle,
      'SAP Actuel': s.sapActuel,
      'Statut': s.statut,
      'Cause': s.cause,
      'Lieu': s.lieu,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sinistres');

    worksheet['!cols'] = Array(12).fill({ wch: 15 });

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async exportFinancesToExcel(startDate: Date, endDate: Date): Promise<Buffer> {
    const encaissements = await this.dataSource.getRepository(Encaissement).find({
      where: { dateEncaissement: { $gte: startDate, $lte: endDate } as any },
      relations: ['affaire', 'cedante'],
    });

    const decaissements = await this.dataSource.getRepository(Decaissement).find({
      where: { dateDecaissement: { $gte: startDate, $lte: endDate } as any },
      relations: ['affaire', 'reassureur'],
    });

    const encData = encaissements.map(e => ({
      'Type': 'Encaissement',
      'Numéro': e.numero,
      'Date': e.dateEncaissement,
      'Affaire': e.affaire?.numeroAffaire,
      'Entité': e.cedante?.raisonSociale || e.sourceType,
      'Montant': e.montant,
      'Devise': e.devise,
      'Montant TND': e.montantEquivalentTND,
      'Mode Paiement': e.modePaiement,
      'Statut': e.statut,
    }));

    const decData = decaissements.map(d => ({
      'Type': 'Décaissement',
      'Numéro': d.numero,
      'Date': d.dateDecaissement,
      'Affaire': d.affaire?.numeroAffaire,
      'Entité': d.reassureur?.raisonSociale || d.beneficiaireType,
      'Montant': d.montant,
      'Devise': d.devise,
      'Montant TND': d.montantEquivalentTND,
      'Mode Paiement': d.modePaiement,
      'Statut': d.statut,
    }));

    const allData = [...encData, ...decData].sort((a, b) => 
      new Date(a.Date).getTime() - new Date(b.Date).getTime()
    );

    const worksheet = XLSX.utils.json_to_sheet(allData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mouvements Financiers');

    worksheet['!cols'] = Array(10).fill({ wch: 15 });

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async exportToTXT(entityType: string, filters?: any): Promise<string> {
    let data: any[];
    let headers: string[];

    switch (entityType) {
      case 'affaires':
        data = await this.affaireRepo.find({ relations: ['cedante', 'assure'], where: filters });
        headers = ['numeroAffaire', 'status', 'category', 'primeCedee', 'dateEffet'];
        break;
      case 'cedantes':
        data = await this.cedanteRepo.find(filters);
        headers = ['code', 'raisonSociale', 'email', 'telephone'];
        break;
      case 'reassureurs':
        data = await this.reassureurRepo.find(filters);
        headers = ['code', 'raisonSociale', 'email', 'rating'];
        break;
      default:
        throw new BadRequestException('Invalid entity type');
    }

    // Generate TXT with pipe delimiter
    let txt = headers.join('|') + '\n';
    
    for (const item of data) {
      const row = headers.map(h => {
        const value = item[h];
        if (value instanceof Date) return value.toISOString().split('T')[0];
        if (typeof value === 'object' && value !== null) return value.raisonSociale || value.code || '';
        return value || '';
      });
      txt += row.join('|') + '\n';
    }

    return txt;
  }

  // ==================== IMPORT ====================

  async importAffairesFromExcel(file: Buffer, userId: string): Promise<{ success: number; errors: any[] }> {
    const workbook = XLSX.read(file, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let success = 0;
    const errors: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      
      try {
        // Find cedante
        const cedante = await this.cedanteRepo.findOne({
          where: { raisonSociale: row['Cédante'] },
        });

        if (!cedante) {
          throw new Error(`Cédante not found: ${row['Cédante']}`);
        }

        // Create affaire
        const affaire = this.affaireRepo.create({
          numeroAffaire: row['Numéro Affaire'] || `AFF-${Date.now()}-${i}`,
          status: row['Statut'] || 'draft',
          category: row['Catégorie'] || 'facultative',
          type: row['Type'] || 'proportionnel',
          cedanteId: cedante.id,
          branche: row['Branche'],
          dateEffet: new Date(row['Date Effet']),
          dateEcheance: new Date(row['Date Échéance']),
          capitalAssure100: parseFloat(row['Capital Assuré 100%']) || 0,
          prime100: parseFloat(row['Prime 100%']) || 0,
          tauxCession: parseFloat(row['Taux Cession']) || 0,
          primeCedee: parseFloat(row['Prime Cédée']) || 0,
          montantCommissionCedante: parseFloat(row['Commission Cédante']) || 0,
          montantCommissionARS: parseFloat(row['Commission ARS']) || 0,
          devise: row['Devise'] || 'TND',
          exercice: parseInt(row['Exercice']) || new Date().getFullYear(),
          createdById: userId,
        });

        await this.affaireRepo.save(affaire);
        success++;
      } catch (error) {
        errors.push({
          row: i + 2, // Excel row number (1-indexed + header)
          data: row,
          error: error.message,
        });
      }
    }

    return { success, errors };
  }

  async importCedantesFromExcel(file: Buffer): Promise<{ success: number; errors: any[] }> {
    const workbook = XLSX.read(file, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let success = 0;
    const errors: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      
      try {
        // Check if exists
        const existing = await this.cedanteRepo.findOne({
          where: { code: row['Code'] },
        });

        if (existing) {
          throw new Error(`Cédante already exists: ${row['Code']}`);
        }

        const cedante = this.cedanteRepo.create({
          code: row['Code'],
          raisonSociale: row['Raison Sociale'],
          formeJuridique: row['Forme Juridique'],
          adresse: row['Adresse'],
          ville: row['Ville'],
          codePostal: row['Code Postal'],
          pays: row['Pays'] || 'Tunisie',
          telephone: row['Téléphone'],
          email: row['Email'],
          matriculeFiscale: row['Matricule Fiscale'],
        });

        await this.cedanteRepo.save(cedante);
        success++;
      } catch (error) {
        errors.push({
          row: i + 2,
          data: row,
          error: error.message,
        });
      }
    }

    return { success, errors };
  }

  async importFromTXT(file: Buffer, entityType: string, userId: string): Promise<{ success: number; errors: any[] }> {
    const content = file.toString('utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    if (lines.length < 2) {
      throw new BadRequestException('File must contain headers and at least one data row');
    }

    const headers = lines[0].split('|');
    let success = 0;
    const errors: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split('|');
      const row: any = {};
      
      headers.forEach((h, idx) => {
        row[h.trim()] = values[idx]?.trim();
      });

      try {
        switch (entityType) {
          case 'cedantes':
            await this.cedanteRepo.save(this.cedanteRepo.create(row));
            break;
          case 'reassureurs':
            await this.reassureurRepo.save(this.reassureurRepo.create(row));
            break;
          default:
            throw new Error('Unsupported entity type');
        }
        success++;
      } catch (error) {
        errors.push({ row: i + 1, data: row, error: error.message });
      }
    }

    return { success, errors };
  }

  // ==================== TEMPLATES ====================

  async generateImportTemplate(entityType: string): Promise<Buffer> {
    let headers: string[];
    let sampleData: any[];

    switch (entityType) {
      case 'affaires':
        headers = ['Numéro Affaire', 'Statut', 'Catégorie', 'Type', 'Cédante', 'Branche', 
                   'Date Effet', 'Date Échéance', 'Capital Assuré 100%', 'Prime 100%', 
                   'Taux Cession', 'Prime Cédée', 'Commission Cédante', 'Commission ARS', 'Devise', 'Exercice'];
        sampleData = [{
          'Numéro Affaire': 'AFF-2024-001',
          'Statut': 'draft',
          'Catégorie': 'facultative',
          'Type': 'proportionnel',
          'Cédante': 'STAR Assurances',
          'Branche': 'Incendie',
          'Date Effet': '2024-01-01',
          'Date Échéance': '2024-12-31',
          'Capital Assuré 100%': 1000000,
          'Prime 100%': 50000,
          'Taux Cession': 80,
          'Prime Cédée': 40000,
          'Commission Cédante': 8000,
          'Commission ARS': 2000,
          'Devise': 'TND',
          'Exercice': 2024,
        }];
        break;

      case 'cedantes':
        headers = ['Code', 'Raison Sociale', 'Forme Juridique', 'Adresse', 'Ville', 
                   'Code Postal', 'Pays', 'Téléphone', 'Email', 'Site Web', 
                   'Matricule Fiscale', 'Registre Commerce'];
        sampleData = [{
          'Code': 'CED001',
          'Raison Sociale': 'STAR Assurances',
          'Forme Juridique': 'SA',
          'Adresse': '123 Avenue Habib Bourguiba',
          'Ville': 'Tunis',
          'Code Postal': '1000',
          'Pays': 'Tunisie',
          'Téléphone': '+216 71 123 456',
          'Email': 'contact@star.tn',
          'Site Web': 'www.star.tn',
          'Matricule Fiscale': '1234567A',
          'Registre Commerce': 'B123456',
        }];
        break;

      default:
        throw new BadRequestException('Invalid entity type');
    }

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

    worksheet['!cols'] = Array(headers.length).fill({ wch: 20 });

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}
