// FIX (Affaires pass): this entire file previously described a data model
// that does not exist on the backend — different enum value sets, flat
// fields where the schema nests under facultativeData/traiteData, a single
// global commission where the backend computes per-reinsurer, and a
// coCourtierId relation that doesn't exist on Affaire at all. Rebuilt to
// match server/src/modules/affaires exactly.

export enum AffaireStatut {
  EN_COTATION = 'EN_COTATION',
  PREVISION = 'PREVISION',
  PLACEMENT_REALISE = 'PLACEMENT_REALISE',
}

export enum AffaireType {
  FACULTATIVE = 'FACULTATIVE',
  TRAITE = 'TRAITE',
}

export enum ModePaiement {
  PAR_AFFAIRE = 'PAR_AFFAIRE',
  PAR_SITUATION = 'PAR_SITUATION',
}

export enum ReassuranceType {
  PROPORTIONNEL = 'PROPORTIONNEL',
  NON_PROPORTIONNEL = 'NON_PROPORTIONNEL',
}

export enum FormeCouverture {
  QUOTA_PART = 'QUOTA_PART',
  EXCES_DE_PLEIN = 'EXCES_DE_PLEIN',
  EXCES_DE_SINISTRES = 'EXCES_DE_SINISTRES',
  STOP_LOSS = 'STOP_LOSS',
}

export enum ModeRenouvellement {
  TACITE = 'TACITE',
  RESILIATION = 'RESILIATION',
  NEGOCIATION = 'NEGOCIATION',
}

export enum Periodicite {
  TRIMESTRIELLE = 'TRIMESTRIELLE',
  SEMESTRIELLE = 'SEMESTRIELLE',
  ANNUELLE = 'ANNUELLE',
}

export enum CommissionMode {
  CALCULABLE = 'CALCULABLE',
  FORFAITAIRE = 'FORFAITAIRE',
}

// Compatibility exports used by older UI components.
export enum AffaireStatus {
  DRAFT = 'DRAFT',
  COTATION = 'COTATION',
  PREVISION = 'PREVISION',
  PLACEMENT_REALISE = 'PLACEMENT_REALISE',
  ACTIVE = 'ACTIVE',
  TERMINE = 'TERMINE',
  ANNULE = 'ANNULE',
}

export enum AffaireCategory {
  FACULTATIVE = 'FACULTATIVE',
  TRAITEE = 'TRAITEE',
}

// ============================================================
// Nested entities
// ============================================================

export interface PartnerRef {
  id: string;
  code: string;
  raisonSociale: string;
  compteComptable?: string;
}

export interface AffaireReassureur {
  id: string;
  affaireId: string;
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
}

export interface GuaranteeLine {
  id?: string;
  garantie: string;
  capitauxAssures100: number;
  ordre?: number;
}

export interface FacultativeAffaire {
  id: string;
  affaireId: string;
  reassuranceType: ReassuranceType;
  assureId: string;
  assure: PartnerRef;
  numeroPoliceCedante?: string;
  dateEffet: string;
  dateEcheance: string;
  modeRenouvellement?: ModeRenouvellement;
  paysAssure?: string;
  branche?: string;
  produit?: string;
  garantie?: string;
  prime100Pct: number;
  tauxPrime?: number;
  tauxCession: number;
  primeCedee?: number;
  tauxCommissionCedante?: number;
  commissionCedante?: number;
  guaranteeLines: GuaranteeLine[];
}

export interface TreatyAccountRubrique {
  id?: string;
  rubrique: string;
  compteReference: string;
  ordre?: number;
}

export interface PmdInstalment {
  id?: string;
  numeroTranche: number;
  dateEcheance: string;
  montant: number;
  tauxDeduction?: number;
  isPaid?: boolean;
  paidAt?: string;
}

export interface TraiteAffaire {
  id: string;
  affaireId: string;
  referenceTraite?: string;
  reassuranceType: ReassuranceType;
  formeCouverture?: FormeCouverture;
  dateEffet: string;
  dateEcheance: string;
  modeRenouvellement?: ModeRenouvellement;
  dateAvisResiliation?: string;
  zoneGeographique?: string;
  branche?: string;
  produit?: string;
  garantie?: string;
  periodicite: Periodicite;
  accountRubriques: TreatyAccountRubrique[];
  primePrevisionnelle?: number;
  pmd?: number;
  tauxCommissionCedante?: number;
  commissionLiquidationArs?: number;
  pmdInstalments: PmdInstalment[];
  seuilNotification?: number;
  renewalReminderSent?: boolean;
}

export interface Affaire {
  id: string;
  numero: string;
  statut: AffaireStatut;
  type: AffaireType;
  cedanteId: string;
  cedante: PartnerRef;
  modePaiement: ModePaiement;
  currency: string;
  reassureurs: AffaireReassureur[];
  facultativeData?: FacultativeAffaire;
  traiteData?: TraiteAffaire;
  sinistres?: any[];
  bordereaux?: any[];
  workflowTasks?: any[];
  documents?: any[];
  _count?: { sinistres: number; bordereaux: number };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AffairesListResponse {
  data: Affaire[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// DTOs (Create / Update)
// ============================================================

export interface AffaireReassureurInput {
  reassureurId: string;
  partPct: number;
  isLeader?: boolean;
  commissionMode?: CommissionMode;
  tauxCommissionArs?: number;
  commissionForfait?: number;
}

export interface GuaranteeLineInput {
  garantie: string;
  capitauxAssures100: number;
  ordre?: number;
}

export interface FacultativeDataInput {
  reassuranceType: ReassuranceType;
  assureId: string;
  numeroPoliceCedante?: string;
  dateEffet: string;
  dateEcheance: string;
  modeRenouvellement?: ModeRenouvellement;
  paysAssure?: string;
  branche?: string;
  produit?: string;
  garantie?: string;
  prime100Pct: number;
  tauxPrime?: number;
  tauxCession: number;
  tauxCommissionCedante?: number;
  guaranteeLines?: GuaranteeLineInput[];
}

export interface TreatyAccountRubriqueInput {
  rubrique: string;
  compteReference: string;
  ordre?: number;
}

export interface PmdInstalmentInput {
  numeroTranche: number;
  dateEcheance: string;
  montant: number;
  tauxDeduction?: number;
}

export interface TraiteDataInput {
  referenceTraite?: string;
  reassuranceType: ReassuranceType;
  formeCouverture?: FormeCouverture;
  dateEffet: string;
  dateEcheance: string;
  modeRenouvellement?: ModeRenouvellement;
  dateAvisResiliation?: string;
  zoneGeographique?: string;
  branche?: string;
  produit?: string;
  garantie?: string;
  periodicite: Periodicite;
  primePrevisionnelle?: number;
  pmd?: number;
  tauxCommissionCedante?: number;
  commissionLiquidationArs?: number;
  seuilNotification?: number;
  accountRubriques?: TreatyAccountRubriqueInput[];
  pmdInstalments?: PmdInstalmentInput[];
}

export interface CreateAffaireDto {
  type: AffaireType;
  cedanteId: string;
  modePaiement?: ModePaiement;
  currency?: string;
  reassureurs: AffaireReassureurInput[];
  facultativeData?: FacultativeDataInput;
  traiteData?: TraiteDataInput;
}

export type UpdateAffaireDto = Partial<CreateAffaireDto>;

// ============================================================
// UI labels
// ============================================================

export const statutLabels: Record<AffaireStatut, string> = {
  [AffaireStatut.EN_COTATION]: 'En Cotation',
  [AffaireStatut.PREVISION]: 'Prévision',
  [AffaireStatut.PLACEMENT_REALISE]: 'Placement Réalisé',
};

export const statutColors: Record<AffaireStatut, string> = {
  [AffaireStatut.EN_COTATION]: 'bg-blue-100 text-blue-800',
  [AffaireStatut.PREVISION]: 'bg-yellow-100 text-yellow-800',
  [AffaireStatut.PLACEMENT_REALISE]: 'bg-green-100 text-green-800',
};

export const typeLabels: Record<AffaireType, string> = {
  [AffaireType.FACULTATIVE]: 'Facultative',
  [AffaireType.TRAITE]: 'Traité',
};

export const reassuranceTypeLabels: Record<ReassuranceType, string> = {
  [ReassuranceType.PROPORTIONNEL]: 'Proportionnel',
  [ReassuranceType.NON_PROPORTIONNEL]: 'Non Proportionnel',
};

export const formeCouvertureLabels: Record<FormeCouverture, string> = {
  [FormeCouverture.QUOTA_PART]: 'Quota-Part',
  [FormeCouverture.EXCES_DE_PLEIN]: 'Excédent de Plein',
  [FormeCouverture.EXCES_DE_SINISTRES]: 'Excédent de Sinistres (XOL)',
  [FormeCouverture.STOP_LOSS]: 'Stop Loss',
};

export const periodiciteLabels: Record<Periodicite, string> = {
  [Periodicite.TRIMESTRIELLE]: 'Trimestrielle',
  [Periodicite.SEMESTRIELLE]: 'Semestrielle',
  [Periodicite.ANNUELLE]: 'Annuelle',
};

export const modeRenouvellementLabels: Record<ModeRenouvellement, string> = {
  [ModeRenouvellement.TACITE]: 'Tacite',
  [ModeRenouvellement.RESILIATION]: 'Résiliation',
  [ModeRenouvellement.NEGOCIATION]: 'Négociation',
};