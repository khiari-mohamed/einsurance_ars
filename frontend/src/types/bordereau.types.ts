export type BordereauType = 'cession' | 'reassureur' | 'sinistre' | 'situation';

export type BordereauStatus = 
  | 'brouillon' 
  | 'en_validation' 
  | 'valide' 
  | 'envoye' 
  | 'comptabilise' 
  | 'archive';

export type DocumentType =
  | 'bulletin_soin'
  | 'facture'
  | 'ordre_paiement'
  | 'releve_bancaire'
  | 'correspondance'
  | 'contrat'
  | 'avis_sinistre'
  | 'autre';

export type PaymentMode =
  | 'virement'
  | 'cheque'
  | 'traite'
  | 'compensation'
  | 'autre';

export interface BordereauLigne {
  id?: string;
  affaireId: string;
  numLigne: number;
  typeLigne: 'prime' | 'sinistre' | 'commission' | 'frais';
  description: string;
  montantBrut: number;
  tauxCession?: number;
  montantCede: number;
  partReassureur?: number;
  commissionMontant: number;
  montantSinistre?: number;
  netAPayer: number;
  notes?: string;
  affaire?: any;
  reassureur?: any;
  createdAt?: string;
}

export interface BordereauDocument {
  id: string;
  bordereauId: string;
  type: DocumentType;
  nomFichier: string;
  cheminS3: string;
  taille: number;
  mimeType: string;
  description?: string;
  uploadedById: string;
  uploadedBy?: any;
  metadata: Record<string, any>;
  uploadedAt: string;
}

export interface BordereauHistoryEntry {
  date: Date | string;
  action: string;
  user: string;
  details?: string;
}

export interface Bordereau {
  id: string;
  numero: string;
  type: BordereauType;
  status: BordereauStatus;
  cedanteId: string;
  reassureurId?: string;
  dateDebut: string | Date;
  dateFin: string | Date;
  dateEmission: string | Date;
  dateLimitePaiement?: string | Date;
  primeTotale: number;
  commissionCedante: number;
  commissionARS: number;
  sinistres: number;
  acompteRecu: number;
  solde: number;
  devise: string;
  lignes: BordereauLigne[];
  pdfPath?: string;
  notes?: string;
  documents: any[];
  historique: BordereauHistoryEntry[];
  cedante?: any;
  reassureur?: any;
  createdBy?: any;
  validatedBy?: any;
  createdById: string;
  validatedById?: string;
  dateValidation?: string | Date;
  dateEnvoi?: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CreateBordereauDto {
  type: BordereauType;
  cedanteId: string;
  reassureurId?: string;
  dateDebut: string;
  dateFin: string;
  dateEmission: string;
  dateLimitePaiement?: string;
  devise?: string;
  lignes?: Omit<BordereauLigne, 'id' | 'numLigne' | 'affaire'>[];
  notes?: string;
  affaireIds?: string[];
}

export interface GenerateBordereauDto {
  type: BordereauType;
  cedanteId: string;
  periodStart: string;
  periodEnd: string;
  treatyId?: string;
  reassureurId?: string;
}

export interface PaymentDto {
  montant: number;
  modePaiement: PaymentMode;
  datePaiement: string;
  referenceBancaire?: string;
  notes?: string;
}

export interface BordereauStatistics {
  total: number;
  byType: Record<BordereauType, number>;
  byStatus: Record<BordereauStatus, number>;
  totalPrime: number;
  totalCommission: number;
  totalSolde: number;
  overdue: number;
}

export interface BordereauFilters {
  type?: BordereauType;
  status?: BordereauStatus;
  cedanteId?: string;
  reassureurId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}
