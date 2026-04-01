export enum SourceType {
  CEDANTE = 'cedante',
  CLIENT = 'client',
  REASSUREUR = 'reassureur',
  COURTIER = 'courtier',
}

export enum ModePaiement {
  VIREMENT = 'virement',
  CHEQUE = 'cheque',
  EFFET = 'effet',
  CASH = 'cash',
  SWIFT = 'swift',
}

export enum EncaissementStatus {
  BROUILLON = 'brouillon',
  SAISI = 'saisi',
  VALIDE = 'valide',
  COMPTABILISE = 'comptabilise',
  ANNULE = 'annule',
}

export enum BeneficiaireType {
  REASSUREUR = 'reassureur',
  CEDANTE = 'cedante',
  COURTIER = 'courtier',
}

export enum DecaissementStatus {
  BROUILLON = 'brouillon',
  APPROUVE_N1 = 'approuve_n1',
  APPROUVE_N2 = 'approuve_n2',
  ORDONNANCE = 'ordonnance',
  EXECUTE = 'execute',
  COMPTABILISE = 'comptabilise',
  ANNULE = 'annule',
}

export enum SwiftStatus {
  ENVOYE = 'envoye',
  ACCEPTE = 'accepte',
  REJETE = 'rejete',
}

export interface Encaissement {
  id: string;
  numero: string;
  dateEncaissement: string;
  montant: number;
  devise: string;
  tauxChange: number;
  montantEquivalentTND: number;
  sourceType: SourceType;
  cedante?: any;
  cedanteId?: string;
  client?: any;
  clientId?: string;
  reassureur?: any;
  reassureurId?: string;
  courtier?: any;
  courtierId?: string;
  modePaiement: ModePaiement;
  referencePaiement: string;
  banqueEmettrice?: string;
  bordereau?: any;
  bordereauId?: string;
  affaire?: any;
  affaireId?: string;
  statut: EncaissementStatus;
  validePar?: any;
  valideParId?: string;
  dateValidation?: string;
  compteBancaireId?: string;
  codeJournal: string;
  pieceComptable?: string;
  notes?: string;
  historique: Array<{
    date: string;
    action: string;
    user: string;
    details?: string;
  }>;
  createdBy: any;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface Decaissement {
  id: string;
  numero: string;
  dateDecaissement: string;
  dateValeur: string;
  beneficiaireType: BeneficiaireType;
  reassureur?: any;
  reassureurId?: string;
  cedante?: any;
  cedanteId?: string;
  courtier?: any;
  courtierId?: string;
  banqueBeneficiaire?: {
    nom: string;
    swift: string;
    iban: string;
    adresse: string;
    pays: string;
  };
  montant: number;
  devise: string;
  tauxChange: number;
  montantEquivalentTND: number;
  fraisBancaires: number;
  montantTotal: number;
  modePaiement: ModePaiement;
  referenceSwift?: string;
  statutSwift?: SwiftStatus;
  commissionARS: number;
  commissionCedante: number;
  montantNetReassureur: number;
  affaire?: any;
  affaireId?: string;
  sinistreId?: string;
  bordereau?: any;
  bordereauId?: string;
  situation?: any;
  situationId?: string;
  statut: DecaissementStatus;
  approbations: Array<{
    niveau: number;
    approbePar: string;
    date: string;
    commentaire?: string;
  }>;
  ordonnancement?: {
    numeroOrdrePaiement: string;
    dateOrdonnancement: string;
    ordonnateur: string;
  };
  compteBancaireDebite?: string;
  pieceComptable?: string;
  notes?: string;
  historique: Array<{
    date: string;
    action: string;
    user: string;
    details?: string;
  }>;
  createdBy: any;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankMovement {
  id: string;
  reference: string;
  dateMovement: string;
  type: 'encaissement' | 'decaissement';
  encaissement?: Encaissement;
  encaissementId?: string;
  decaissement?: Decaissement;
  decaissementId?: string;
  compteBancaire: string;
  montant: number;
  devise: string;
  soldeAvant: number;
  soldeApres: number;
  description?: string;
  reconcilie: boolean;
  dateReconciliation?: string;
  createdAt: string;
}

export interface Lettrage {
  id: string;
  reference: string;
  dateLettrage: string;
  encaissements: Array<{
    encaissementId: string;
    montantAffecte: number;
  }>;
  decaissements: Array<{
    decaissementId: string;
    montantAffecte: number;
  }>;
  creances: Array<{
    bordereauId: string;
    montantDu: number;
    montantRegle: number;
  }>;
  soldeAvant: number;
  soldeApres: number;
  ecart: number;
  statut: 'auto' | 'manuel' | 'partiel' | 'complet';
  type: 'affaire' | 'cedante' | 'reassureur' | 'client';
  entityId: string;
  notes?: string;
  createdBy: any;
  createdById: string;
  createdAt: string;
}

export enum CommissionType {
  ARS = 'ars',
  CEDANTE = 'cedante',
  COURTIER = 'courtier',
}

export enum CommissionStatus {
  CALCULEE = 'calculee',
  A_PAYER = 'a_payer',
  PAYEE = 'payee',
  ANNULEE = 'annulee',
}

export enum CalculationBase {
  PRIME_100 = 'prime_100',
  PRIME_CEDEE = 'prime_cedee',
  SINISTRE = 'sinistre',
}

export interface Commission {
  id: string;
  numero: string;
  type: CommissionType;
  affaire: any;
  affaireId: string;
  bordereau?: any;
  bordereauId?: string;
  cedante?: any;
  cedanteId?: string;
  courtier?: any;
  courtierId?: string;
  baseCalcul: CalculationBase;
  baseMontant: number;
  taux: number;
  montant: number;
  tauxMax?: number;
  tauxOverride: boolean;
  overrideReason?: string;
  overrideByUserId?: string;
  statut: CommissionStatus;
  dateCalcul?: string;
  datePaiement?: string;
  decaissementId?: string;
  compteComptable?: string;
  pieceComptable?: string;
  notes?: string;
  historique: Array<{
    date: string;
    action: string;
    user: string;
    details?: string;
  }>;
  createdBy: any;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export enum SettlementType {
  MENSUELLE = 'mensuelle',
  TRIMESTRIELLE = 'trimestrielle',
  SEMESTRIELLE = 'semestrielle',
  ANNUELLE = 'annuelle',
}

export enum SettlementStatus {
  EN_COURS = 'en_cours',
  CALCULEE = 'calculee',
  VALIDEE = 'validee',
  ENVOYEE = 'envoyee',
  REGLEE = 'reglee',
  ANNULEE = 'annulee',
}

export interface Settlement {
  id: string;
  numero: string;
  type: SettlementType;
  dateDebut: string;
  dateFin: string;
  cedante: any;
  cedanteId: string;
  reassureur?: any;
  reassureurId?: string;
  totalPrime: number;
  totalCommissionCedante: number;
  totalCommissionARS: number;
  totalCommissionCourtier: number;
  totalSinistre: number;
  totalAPayer: number;
  soldePrecedent: number;
  soldeFinal: number;
  gainPerteChange: number;
  lignes: Array<{
    affaireId: string;
    referenceBordereau: string;
    type: 'FACULTATIVE' | 'TRAITE';
    prime100: number;
    primeCedee: number;
    tauxCession: number;
    commissionCedante: number;
    commissionARS: number;
    commissionCourtier: number;
    sinistreMontant: number;
    netAPayer: number;
    statutPaiement: 'IMPAYE' | 'PARTIEL' | 'PAYE';
    encaissementId?: string;
    decaissementId?: string;
  }>;
  bordereauSituationId?: string;
  relevCompteId?: string;
  statut: SettlementStatus;
  dateCalcul?: string;
  dateValidation?: string;
  valideParId?: string;
  dateEnvoi?: string;
  dateReglement?: string;
  approbations: Array<{
    niveau: number;
    approbePar: string;
    date: string;
    commentaire?: string;
  }>;
  notes?: string;
  historique: Array<{
    date: string;
    action: string;
    user: string;
    details?: string;
  }>;
  createdBy: any;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export enum PaymentOrderStatus {
  BROUILLON = 'brouillon',
  VERIFIE = 'verifie',
  SIGNE = 'signe',
  TRANSMIS = 'transmis',
  ANNULE = 'annule',
}

export enum PaymentOrderTemplate {
  STANDARD = 'standard',
  URGENT = 'urgent',
  INTERNATIONAL = 'international',
}

export interface OrdrePaiement {
  id: string;
  numero: string;
  dateCreation: string;
  decaissement: Decaissement;
  decaissementId: string;
  beneficiaire: {
    nom: string;
    banque: string;
    rib?: string;
    iban: string;
    bic?: string;
    adresse: string;
    pays: string;
  };
  montant: number;
  devise: string;
  montantLettres: string;
  objet: string;
  referenceFacture?: string;
  referenceAffaire?: string;
  creeParId?: string;
  verificateurId?: string;
  dateVerification?: string;
  ordinateurId?: string;
  dateSignature?: string;
  commentaireSignature?: string;
  dateTransmission?: string;
  transmisParId?: string;
  statut: PaymentOrderStatus;
  template: PaymentOrderTemplate;
  cheminPDF?: string;
  dateGeneration?: string;
  referenceBank?: string;
  dateConfirmationBank?: string;
  notes?: string;
  historique: Array<{
    date: string;
    action: string;
    user: string;
    details?: string;
  }>;
  createdBy: any;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}
