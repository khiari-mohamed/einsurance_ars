export enum JournalEntryStatut { BROUILLON = 'BROUILLON', VALIDE = 'VALIDE' }

export enum JournalEntryType {
  PASSATION_CA_FACULTATIVE = 'PASSATION_CA_FACULTATIVE',
  PASSATION_CA_TRAITE = 'PASSATION_CA_TRAITE',
  ENCAISSEMENT_PRIME_CEDEE = 'ENCAISSEMENT_PRIME_CEDEE',
  REGLEMENT_REASSUREUR = 'REGLEMENT_REASSUREUR',
  GAIN_DE_CHANGE = 'GAIN_DE_CHANGE',
  PERTE_DE_CHANGE = 'PERTE_DE_CHANGE',
  SAP_RECONSTITUTION = 'SAP_RECONSTITUTION',
  LIQUIDATION_TRAITE = 'LIQUIDATION_TRAITE',
}

export interface PlanComptable {
  id: string;
  compte: string;
  libelle: string;
  type: string;
  classe: string;
  isAuxiliary: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AuxiliaryAccountRef { id: string; code: string; libelle: string }

export interface JournalLine {
  id: string;
  journalEntryId: string;
  journalEntry?: { numero: string; statut: JournalEntryStatut; type: JournalEntryType; description?: string; codeJournal?: string; pieceComptable?: string; createdAt: string };
  planComptableId: string;
  planComptable?: PlanComptable;
  auxiliaryId?: string;
  auxiliary?: AuxiliaryAccountRef;
  cedanteId?: string;
  cedante?: { code: string; raisonSociale: string };
  reassureurId?: string;
  reassureur?: { code: string; raisonSociale: string };
  debit?: number;
  credit?: number;
  currency: string;
  montantDevise?: number;
  tauxChange?: number;
  libelle?: string;
  ordre: number;
}

export interface JournalEntry {
  id: string;
  numero: string;
  statut: JournalEntryStatut;
  type: JournalEntryType;
  affaireId?: string;
  affaire?: { numero: string };
  sinistreId?: string;
  bordereauId?: string;
  fiscalPeriodId?: string;
  codeJournal?: string;
  pieceComptable?: string;
  validatedAt?: string;
  validatedBy?: string;
  description?: string;
  currency: string;
  lines: JournalLine[];
  createdAt: string;
  updatedAt: string;
}

export interface LedgerResult {
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  solde: number;
}

export interface TrialBalanceLine {
  compte: string;
  libelle: string;
  debit: number;
  credit: number;
  solde: number;
}

export interface PaginatedEntries {
  data: JournalEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProfitLossReport {
  year: number;
  charges: TrialBalanceLine[];
  produits: TrialBalanceLine[];
  totalCharges: number;
  totalProduits: number;
  resultatNet: number;
}

export interface FiscalPeriod {
  id: string;
  annee: number;
  mois: number;
  dateDebut: string;
  dateFin: string;
  isClosed: boolean;
  closedAt?: string;
  closedByUserId?: string;
}

export interface AuxiliaryAccount {
  id: string;
  planComptableId: string;
  planComptable?: PlanComptable;
  code: string;
  libelle: string;
  cedanteId?: string;
  cedante?: { code: string; raisonSociale: string };
  reassureurId?: string;
  reassureur?: { code: string; raisonSociale: string };
  isActive: boolean;
}

export interface ExportResult { format: string; content: string; count: number }