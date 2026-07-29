// Mirrors the real Prisma enums and controller responses in
// server/src/modules/finances exactly.
// FIX (Finances pass): this entire file previously described a fictional
// model — SourceType/BeneficiaireType as lowercase strings that don't match
// FinancialPartyType, an EncaissementStatus with brouillon/saisi/valide/
// comptabilise states that don't exist (Encaissement only has isValidated/
// validatedAt/validatedByUserId), a Commission entity with its own numero/
// type/baseCalcul/tauxOverride (commissions are read-only AffaireReassureur
// rows, not a separate table), a "Settlement" that actually described
// Situation's batch-netting concept (lignes[], soldePrecedent,
// gainPerteChange) while the real Settlement is a much simpler single
// reconciliation record, and an OrdrePaiement verify→sign→transmit
// lifecycle that doesn't match the real validate→execute→swift
// (OrdreVirementStatut) one. Rebuilt from scratch against the real schema.

export enum FinancialPartyType {
  ASSURE = 'ASSURE',
  CEDANTE = 'CEDANTE',
  REASSUREUR = 'REASSUREUR',
  CO_COURTIER = 'CO_COURTIER',
  BANQUE_ARS = 'BANQUE_ARS',
}

export enum FinancialMovementType {
  ENCAISSEMENT = 'ENCAISSEMENT',
  DECAISSEMENT = 'DECAISSEMENT',
}

export enum SettlementMode {
  PAR_AFFAIRE = 'PAR_AFFAIRE',
  PAR_SITUATION = 'PAR_SITUATION',
}

export enum SituationSoldeDirection {
  CEDANTE_DOIT = 'CEDANTE_DOIT',
  ARS_DOIT = 'ARS_DOIT',
  EQUILIBRE = 'EQUILIBRE',
}

export enum OrdreVirementStatut {
  BROUILLON = 'BROUILLON',
  VALIDE = 'VALIDE',
  EXECUTE = 'EXECUTE',
  SWIFT_RECU = 'SWIFT_RECU',
}

export enum DecaissementStatut {
  BROUILLON = 'BROUILLON',
  APPROUVE = 'APPROUVE',
  EXECUTE = 'EXECUTE',
  REJETE = 'REJETE',
}

export enum CommissionMode {
  CALCULABLE = 'CALCULABLE',
  FORFAITAIRE = 'FORFAITAIRE',
}

export interface PartnerRef {
  id: string;
  code: string;
  raisonSociale: string;
}

export interface Encaissement {
  id: string;
  reference: string;
  affaireId?: string;
  affaire?: { numero: string };
  partyType: FinancialPartyType;
  cedanteId?: string;
  cedante?: { raisonSociale: string };
  assureLabel?: string;
  montant: number;
  currency: string;
  tauxRealisation?: number;
  montantTnd?: number;
  stepNumber?: number;
  dateEncaissement: string;
  description?: string;
  settlementId?: string;
  bankMovementId?: string;
  isValidated: boolean;
  validatedAt?: string;
  validatedByUserId?: string;
  amlFlagged?: boolean;
  amlReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Decaissement {
  id: string;
  reference: string;
  affaireId?: string;
  partyType: FinancialPartyType;
  reassureurCode?: string;
  coCourtId?: string;
  montant: number;
  currency: string;
  tauxReglement?: number;
  montantTnd?: number;
  stepNumber?: number;
  dateDecaissement: string;
  description?: string;
  ordrePaiementId?: string;
  settlementId?: string;
  bankMovementId?: string;
  statut: DecaissementStatut;
  approvedAt?: string;
  approvedByUserId?: string;
  executedAt?: string;
  rejectionReason?: string;
  amlFlagged?: boolean;
  amlReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BankMovement {
  id: string;
  type: FinancialMovementType;
  montant: number;
  currency: string;
  dateValeur: string;
  reference?: string;
  description?: string;
  isReconciled: boolean;
  reconciledAt?: string;
  // NEW (Reconciliation gap fix): light refs from the new list endpoint.
  encaissements?: { id: string; reference: string; montant: number }[];
  decaissements?: { id: string; reference: string; montant: number }[];
  createdAt: string;
}

export interface LettrageItem {
  id: string;
  bordereauId?: string;
  bordereau?: { numero: string; montantTotal?: number };
  encaissementId?: string;
  encaissement?: Encaissement;
  montant: number;
  isLettre: boolean;
  lettreAt?: string;
}

export interface Lettrage {
  id: string;
  reference: string;
  cedanteId?: string;
  reassureurCode?: string;
  montantEncaisse: number;
  montantLettre?: number;
  residuel?: number;
  dateLettre: string;
  isComplete: boolean;
  items: LettrageItem[];
  createdAt: string;
}

/** A "commission" is a read-only view onto an AffaireReassureur participation
 * line — there is no separate Commission entity on the backend. */
export interface CommissionLine {
  id: string; // AffaireReassureur id
  affaireId: string;
  affaire?: { numero: string; currency: string };
  reassureurId: string;
  reassureur: PartnerRef;
  partPct: number;
  isLeader: boolean;
  commissionMode: CommissionMode;
  tauxCommissionArs?: number;
  commissionForfait?: number;
  primeBrute?: number;
  commissionArs?: number;
  commissionCedante?: number;
  primeNetteCedante?: number;
  primeNetteReassureur?: number;
  commissionPaidAt?: string;
  commissionDecaissementId?: string;
}

export interface CommissionStatement {
  cedante: { code: string; raisonSociale: string };
  period: string;
  periodStart: string;
  periodEnd: string;
  lines: CommissionLine[];
  totalPrimeBrute: number;
  totalCommissionArs: number;
}

export interface Settlement {
  id: string;
  reference: string;
  mode: SettlementMode;
  affaireId?: string;
  affaire?: { numero: string; currency: string };
  situationId?: string;
  montant: number;
  currency: string;
  tauxRealisation?: number;
  tauxReglement?: number;
  montantTnd?: number;
  dateSettlement: string;
  validatedAt?: string;
  validatedByUserId?: string;
  encaissements?: Encaissement[];
  decaissements?: Decaissement[];
  createdAt: string;
  updatedAt: string;
}

export interface SituationLine {
  id: string;
  situationId: string;
  affaireId: string;
  affaire?: { numero: string; type: string };
  debit?: number;
  credit?: number;
  solde?: number;
  description?: string;
}

export interface Situation {
  id: string;
  reference: string;
  cedanteId: string;
  cedante?: { code: string; raisonSociale: string };
  traiteId?: string;
  traite?: { referenceTraite?: string; periodicite: string };
  dateDebut: string;
  dateFin: string;
  periodicite?: string;
  totalDebit?: number;
  totalCredit?: number;
  soldeNet?: number;
  soldeDirection?: SituationSoldeDirection;
  currency: string;
  lines: SituationLine[];
  settlements?: Settlement[];
  bordereaux?: any[];
  workflowTasks?: any[];
  _count?: { settlements: number; bordereaux: number };
  createdAt: string;
  updatedAt: string;
}

export interface OrdrePaiement {
  id: string;
  reference: string;
  statut: OrdreVirementStatut;
  beneficiaire: string;
  bankAccountId?: string;
  bankAccount?: {
    banque: string; agence?: string; rib: string; iban?: string; swift?: string; currency: string;
    reassureur?: PartnerRef;
  };
  montant: number;
  currency: string;
  referenceAffaire?: string;
  referenceBordereau?: string;
  dateExecution?: string;
  signataires: string[];
  swiftReceived: boolean;
  swiftDocumentId?: string;
  dateValidation?: string;
  validatedByUserId?: string;
  decaissements?: Decaissement[];
  documents?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface FourStepStepResult {
  step: number;
  type: 'ENCAISSEMENT' | 'DECAISSEMENT' | 'WARNING';
  id?: string;
  reassureur?: string;
  montant?: number;
  ordrePaiementId?: string;
  message?: string;
}

export interface FourStepPaymentResult {
  affaireNumero: string;
  tauxApplique: number;
  steps: FourStepStepResult[];
}

export interface CashFlowReport {
  totalEncaissements: number;
  totalDecaissements: number;
  soldeNet: number;
  encaissements: number;
  decaissements: number;
}

export interface AgingRange { label: string; count: number; montant: number }
export interface AgingReport { ranges: AgingRange[] }

export interface AmlFlaggedEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  after?: { montantTnd: number; threshold: number; reason: string };
  createdAt: string;
}

// ── DTOs ─────────────────────────────────────────────────────────────

export interface CreateEncaissementInput {
  affaireId?: string;
  partyType: FinancialPartyType;
  cedanteId?: string;
  assureLabel?: string;
  montant: number;
  currency?: string;
  tauxRealisation?: number;
  dateEncaissement?: string;
  description?: string;
  stepNumber?: number;
}

export interface CreateDecaissementInput {
  affaireId?: string;
  partyType: FinancialPartyType;
  reassureurCode?: string;
  coCourtId?: string;
  montant: number;
  currency?: string;
  tauxReglement?: number;
  description?: string;
  stepNumber?: number;
}

export interface CreateSettlementInput {
  mode: SettlementMode;
  affaireId?: string;
  situationId?: string;
  montant: number;
  currency?: string;
  tauxRealisation?: number;
  tauxReglement?: number;
  dateSettlement?: string;
}

export interface CreateSituationInput {
  cedanteId: string;
  traiteId?: string;
  dateDebut: string;
  dateFin: string;
  periodicite?: string;
  currency?: string;
}

export interface CreateOrdrePaiementInput {
  beneficiaire: string;
  bankAccountId?: string;
  montant: number;
  currency?: string;
  referenceAffaire?: string;
  referenceBordereau?: string;
  dateExecution?: string;
  signataires?: string[];
}

export interface LettrageMatchInput { bordereauId: string; montant: number }
export interface CreateLettrageInput {
  encaissementId: string;
  matches: LettrageMatchInput[];
  cedanteId?: string;
  reassureurCode?: string;
}

export interface ImportBankMovementInput {
  type: FinancialMovementType;
  montant: number;
  currency: string;
  dateValeur: string;
  reference?: string;
  description?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

// ── UI labels ────────────────────────────────────────────────────────

export const partyTypeLabels: Record<FinancialPartyType, string> = {
  [FinancialPartyType.ASSURE]: 'Assuré',
  [FinancialPartyType.CEDANTE]: 'Cédante',
  [FinancialPartyType.REASSUREUR]: 'Réassureur',
  [FinancialPartyType.CO_COURTIER]: 'Co-Courtier',
  [FinancialPartyType.BANQUE_ARS]: 'Banque ARS',
};

export const decaissementStatutLabels: Record<DecaissementStatut, string> = {
  [DecaissementStatut.BROUILLON]: 'Brouillon',
  [DecaissementStatut.APPROUVE]: 'Approuvé',
  [DecaissementStatut.EXECUTE]: 'Exécuté',
  [DecaissementStatut.REJETE]: 'Rejeté',
};

export const decaissementStatutColors: Record<DecaissementStatut, string> = {
  [DecaissementStatut.BROUILLON]: 'bg-gray-100 text-gray-700',
  [DecaissementStatut.APPROUVE]: 'bg-blue-100 text-blue-700',
  [DecaissementStatut.EXECUTE]: 'bg-green-100 text-green-700',
  [DecaissementStatut.REJETE]: 'bg-red-100 text-red-700',
};

export const ordreStatutLabels: Record<OrdreVirementStatut, string> = {
  [OrdreVirementStatut.BROUILLON]: 'Brouillon',
  [OrdreVirementStatut.VALIDE]: 'Validé',
  [OrdreVirementStatut.EXECUTE]: 'Exécuté',
  [OrdreVirementStatut.SWIFT_RECU]: 'SWIFT Reçu',
};

export const ordreStatutColors: Record<OrdreVirementStatut, string> = {
  [OrdreVirementStatut.BROUILLON]: 'bg-gray-100 text-gray-700',
  [OrdreVirementStatut.VALIDE]: 'bg-blue-100 text-blue-700',
  [OrdreVirementStatut.EXECUTE]: 'bg-purple-100 text-purple-700',
  [OrdreVirementStatut.SWIFT_RECU]: 'bg-green-100 text-green-700',
};

export const soldeDirectionLabels: Record<SituationSoldeDirection, string> = {
  [SituationSoldeDirection.CEDANTE_DOIT]: 'La cédante doit à ARS',
  [SituationSoldeDirection.ARS_DOIT]: 'ARS doit (via réassureurs)',
  [SituationSoldeDirection.EQUILIBRE]: 'Équilibré',
};