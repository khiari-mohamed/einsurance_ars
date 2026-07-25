// Mirrors the real backend enums exactly (Prisma BordereauType / BordereauStatut / PaymentMode).
// The previous version of this file used invented lowercase strings that
// didn't correspond to anything the backend actually returns.

export type BordereauType =
  | 'CESSION_CEDANTE'
  | 'CESSION_REASSUREUR'
  | 'SINISTRE_FACULTATIVE'
  | 'SITUATION_TRAITE'
  | 'FACTURE_DEPOT_PRIME'
  | 'NOTE_DE_CREDIT'
  | 'ETAT_DE_TRANSFERT'
  | 'SITUATION_FINANCIERE'
  | 'FACTURE_PRIME_REASSURANCE_DEPOT'
  | 'FACTURE_PRIME_REASSURANCE_AJUSTEMENT';

export type BordereauStatus =
  | 'BROUILLON'
  | 'EN_VALIDATION'
  | 'VALIDE'
  | 'EMIS'
  | 'ACQUITTE'
  | 'ARCHIVE';

export type PaymentMode = 'VIREMENT' | 'CHEQUE' | 'TRAITE' | 'COMPENSATION' | 'AUTRE';

// Curated subset of ged.types.ts DocumentType relevant to bordereau attachments
export type BordereauDocumentType =
  | 'swift_confirmation'
  | 'bank_statement'
  | 'payment_justification'
  | 'settlement_statement'
  | 'correspondence'
  | 'other';

export interface BordereauLine {
  id?: string;
  libelle: string;
  couverture?: string;
  periodeDebut?: string;
  periodeFin?: string;
  capitaux100?: number;
  prime100?: number;
  tauxCession?: number;
  primeBrute?: number;
  commissionCedante?: number;
  commissionCourtage?: number;
  primeNette?: number;
  sinistresPayes?: number;
  recConstitues?: number;
  sapConstitues?: number;
  participationsBenef?: number;
  taxes?: number;
  brokerage?: number;
  primesCedees?: number;
  recLiberes?: number;
  sapLiberes?: number;
  interets?: number;
  ordre?: number;
}

export interface BordereauPayment {
  id: string;
  bordereauId: string;
  montant: number;
  modePaiement: PaymentMode;
  datePaiement: string;
  referenceBancaire?: string;
  notes?: string;
  createdAt: string;
}

export interface BordereauHistoryEntry {
  date: string;
  action: string;
  user: string;
  details?: string;
}

export interface BordereauDocumentLink {
  id: string; // DocumentLink id — used for delete
  document: {
    id: string;
    nom: string;
    originalName?: string;
    mimeType?: string;
    sizeBytes?: number;
    documentType?: string;
    createdAt: string;
  };
}

export interface Bordereau {
  id: string;
  numero: string;
  type: BordereauType;
  statut: BordereauStatus;

  affaireId?: string;
  affaire?: { numero: string; type: string };
  situationId?: string;

  cedanteId?: string;
  cedante?: { raisonSociale: string };
  reassureurCode?: string;

  dateEmission: string;
  datePeriodeDebut?: string;
  datePeriodeFin?: string;
  dateLimitePaiement?: string;
  dateValidation?: string;
  dateEnvoi?: string;

  currency: string;
  montantTotal: number;
  montantEnLettres?: string;
  montantRegle: number;
  solde: number;         // derived server-side
  isOverdue: boolean;    // derived server-side

  rejectionReason?: string;
  recipients: string[];
  notes?: string;

  createdByUserId?: string;
  createdBy?: { id: string; nom: string; prenom: string; email: string } | null;
  validatedByUserId?: string;
  validatedBy?: { id: string; nom: string; prenom: string; email: string } | null;

  lines: BordereauLine[];
  payments?: BordereauPayment[];

  createdAt: string;
  updatedAt: string;
}

export interface CreateBordereauDto {
  type: BordereauType;
  affaireId?: string;
  situationId?: string;
  cedanteId?: string;
  reassureurCode?: string;
  datePeriodeDebut?: string;
  datePeriodeFin?: string;
  dateLimitePaiement?: string;
  currency?: string;
  notes?: string;
  lines?: BordereauLine[];
}

export type UpdateBordereauDto = Partial<CreateBordereauDto>;

export interface GenerateBordereauDto {
  affaireId: string;
  type: BordereauType;
  reassureurId?: string;
  datePeriodeDebut?: string;
  datePeriodeFin?: string;
  dateLimitePaiement?: string;
}

export interface RejectDto {
  reason: string;
}

export interface SendDto {
  recipients: string[];
}

export interface PayDto {
  montant: number;
  modePaiement: PaymentMode;
  datePaiement: string;
  referenceBancaire?: string;
  notes?: string;
}

export interface BordereauStatistics {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  totalMontant: number;
  totalRegle: number;
  totalSolde: number;
  overdue: number;
}

export interface AgingBucket { count: number; amount: number }
export interface AgingReport {
  current: AgingBucket;
  days_1_30: AgingBucket;
  days_31_60: AgingBucket;
  days_61_90: AgingBucket;
  over_90: AgingBucket;
}

export interface VolumeMetrics {
  total_generated: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  avg_processing_time: number;
  total_amount: number;
}

export interface BordereauFilters {
  affaireId?: string;
  type?: BordereauType;
  statut?: BordereauStatus;
  cedanteId?: string;
  reassureurCode?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  overdue?: string;
  currency?: string;
  createdByUserId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}