export enum SinistreStatus {
  DECLARE = 'declare',
  EN_EXPERTISE = 'en_expertise',
  EN_REGLEMENT = 'en_reglement',
  PARTIEL = 'partiel',
  REGLE = 'regle',
  CONTESTE = 'conteste',
  CLOS = 'clos',
}

export enum PaymentStatus {
  EN_ATTENTE = 'en_attente',
  PARTIEL = 'partiel',
  PAYE = 'paye',
  EN_RETARD = 'en_retard',
}

export interface SinistreParticipation {
  id: string;
  reassureurId: string;
  reassureur: any;
  partPourcentage: number;
  montantPart: number;
  statutPaiement: PaymentStatus;
  montantPaye: number;
  datePaiement?: string;
  referencePaiement?: string;
  notifications?: Array<{
    type: string;
    date: string;
    moyen: string;
    statut: string;
  }>;
}

export interface Sinistre {
  id: string;
  numero: string;
  referenceCedante: string;
  affaireId: string;
  affaire: any;
  cedanteId: string;
  cedante: any;
  dateSurvenance: string;
  dateDeclarationCedante: string;
  dateNotificationARS: string;
  dateNotificationReassureurs?: string;
  dateReglement?: string;
  montantTotal: number;
  montantCedantePart: number;
  montantReassurance: number;
  montantRegle: number;
  montantRestant: number;
  statut: SinistreStatus;
  sapInitial: number;
  sapActuel: number;
  dateDerniereRevisionSAP?: string;
  description?: string;
  cause?: string;
  lieu?: string;
  cedantePaymentVerified: boolean;
  expertiseRequise: boolean;
  participations: SinistreParticipation[];
  createdBy?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateSinistreDto {
  referenceCedante: string;
  affaireId: string;
  cedanteId: string;
  dateSurvenance: Date;
  dateDeclarationCedante: Date;
  montantTotal: number;
  montantCedantePart: number;
  description?: string;
  cause?: string;
  lieu?: string;
  cedantePaymentVerified?: boolean;
  expertiseRequise?: boolean;
  participations: {
    reassureurId: string;
    partPourcentage: number;
    montantPart: number;
  }[];
}

export interface SinistreDocument {
  id: string;
  sinistreId: string;
  type: string;
  nom: string;
  fichierUrl: string;
  tags: string[];
  description?: string;
  uploadedById: string;
  dateUpload: string;
}

export interface Expertise {
  id: string;
  sinistreId: string;
  expertNom: string;
  expertSociete?: string;
  dateDesignation: string;
  dateRapport?: string;
  coutExpertise: number;
  rapportUrl?: string;
  conclusions?: string;
  montantRecommande?: number;
  statut: 'en_cours' | 'termine' | 'annule';
}

export interface SAPTracking {
  id: string;
  sinistreId: string;
  annee: number;
  mois: number;
  montantInitial: number;
  montantPaye: number;
  montantReserve: number;
  clotureAnnee: boolean;
  dateCloture?: string;
  gainPerte: number;
}

export interface SAPAdjustment {
  id: string;
  sapTrackingId: string;
  date: string;
  type: 'AUGMENTATION' | 'REDUCTION' | 'CLOTURE';
  montant: number;
  raison: string;
  valideParId: string;
}

export interface SinistreAnalytics {
  evolution: { period: string; count: number; amount: number }[];
  byCedante: { cedante: string; count: number; amount: number; ratio: number }[];
  byStatus: { status: string; count: number; amount: number }[];
  aging: {
    '0-30 jours': { count: number; amount: number };
    '31-60 jours': { count: number; amount: number };
    '61-90 jours': { count: number; amount: number };
    '+90 jours': { count: number; amount: number };
  };
  sapAnalysis: {
    totalReserves: number;
    totalOutstanding: number;
    coverageRatio: number;
    averageReserve: number;
  };
}

export interface BordereauSinistre {
  numero: string;
  dateEmission: string;
  periode: { debut: string; fin: string };
  sinistres: any[];
  totaux: {
    nombreSinistres: number;
    montantTotal: number;
    montantReassurance: number;
    montantRegle: number;
    montantRestant: number;
    sapTotal: number;
  };
  pdfUrl?: string;
}
