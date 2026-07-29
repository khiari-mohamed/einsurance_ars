// Rebuilt to match server/src/modules/sinistres exactly. The previous
// version described a fictional model (montantTotal, expertise workflow,
// per-reinsurer payment tracking, a different 7-state lowercase status
// enum) that was never implemented anywhere in the service layer.

export type SinistreStatut =
  | 'DECLARE'
  | 'EN_COURS_VALIDATION'
  | 'VALIDE'
  | 'REJETE'
  | 'DECLARE_REASSUREURS'
  | 'EN_RECUPERATION'
  | 'RECUPERE'
  | 'CLOS';

export type RecoveryMethod = 'ENCAISSEMENT_DIRECT' | 'COMPENSATION';

export interface SinistreParticipation {
  id: string;
  sinistreId: string;
  reassureurCode: string;
  partPct: number;
  montantPart?: number | null;
  isNotified: boolean;
  notifiedAt?: string | null;
}

export interface SinistreEvent {
  id: string;
  sinistreId: string;
  date: string;
  actorId?: string | null;
  actor?: { nom: string; prenom: string; role: string } | null;
  actorLabel: string;
  action: string;
  note?: string | null;
  createdAt: string;
}

export interface SinistreAudit {
  id: string;
  sinistreId: string;
  action: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  userId?: string | null;
  createdAt: string;
}

export interface SinistreAffaireRef {
  id: string;
  numero: string;
  type: 'FACULTATIVE' | 'TRAITE';
  currency: string;
  cedante: { id: string; code: string; raisonSociale: string };
  reassureurs?: Array<{
    reassureurId: string;
    partPct: number;
    reassureur: { id: string; code: string; raisonSociale: string };
  }>;
  facultativeData?: { branche?: string; produit?: string; garantie?: string } | null;
  traiteData?: { branche?: string; referenceTraite?: string } | null;
}

export interface Sinistre {
  id: string;
  numero: string;
  affaireId: string;
  affaire: SinistreAffaireRef;
  statut: SinistreStatut;

  numerPolice?: string | null;
  periodeCouverture?: string | null;
  dateDeclaration: string;
  dateSurvenance: string;

  reglementExerciceN?: number | null;
  cumulReglementAnterieurs?: number | null;
  reserves?: number | null;
  partReassureurs?: number | null;
  sap?: number | null;

  appelAuComptant: boolean;
  cashCall?: import('./cash-call.types').CashCall | null;

  recoveryMethod?: RecoveryMethod | null;
  recoveredAt?: string | null;

  description?: string | null;
  cause?: string | null;
  lieu?: string | null;

  events?: SinistreEvent[];
  participations?: SinistreParticipation[];
  auditRecords?: SinistreAudit[];
  documents?: unknown[];

  createdAt: string;
  updatedAt: string;
}

export interface CreateSinistreDto {
  affaireId: string;
  numerPolice?: string;
  periodeCouverture?: string;
  dateSurvenance: string;
  reglementExerciceN?: number;
  cumulReglementAnterieurs?: number;
  reserves?: number;
  partReassureurs?: number;
  appelAuComptant?: boolean;
  description?: string;
  cause?: string;
  lieu?: string;
}

export type UpdateSinistreDto = Partial<Omit<CreateSinistreDto, 'affaireId' | 'dateSurvenance'>> & {
  recoveryMethod?: RecoveryMethod;
};

export interface AdjustSapDto {
  sap: number;
  note?: string;
}

// ── Analytics ────────────────────────────────────────────────────────

export interface SinistreKpis {
  totalSinistres: number;
  parStatut: Record<string, number>;
  reservesTotales: number;
  partReassureursTotale: number;
  sapTotal: number;
  year: number;
}

export interface LossRatio {
  primes: number;
  sinistres: number;
  lossRatioPct: number;
  year: number;
}

export interface EvolutionPoint { period: string; count: number; amount: number }
export interface ByCedantePoint { cedante: string; count: number; amount: number }
export interface ByStatusPoint { status: string; count: number; amount: number }
export interface AgingBucket { count: number; amount: number }
export interface AgingReport {
  '0-30 jours': AgingBucket;
  '31-60 jours': AgingBucket;
  '61-90 jours': AgingBucket;
  '+90 jours': AgingBucket;
}

export const STATUT_LABELS: Record<SinistreStatut, string> = {
  DECLARE: 'Déclaré',
  EN_COURS_VALIDATION: 'En Validation',
  VALIDE: 'Validé',
  REJETE: 'Rejeté',
  DECLARE_REASSUREURS: 'Déclaré Réassureurs',
  EN_RECUPERATION: 'En Récupération',
  RECUPERE: 'Récupéré',
  CLOS: 'Clos',
};

export const STATUT_COLORS: Record<SinistreStatut, string> = {
  DECLARE: 'bg-blue-100 text-blue-800',
  EN_COURS_VALIDATION: 'bg-yellow-100 text-yellow-800',
  VALIDE: 'bg-green-100 text-green-800',
  REJETE: 'bg-red-100 text-red-800',
  DECLARE_REASSUREURS: 'bg-purple-100 text-purple-800',
  EN_RECUPERATION: 'bg-orange-100 text-orange-800',
  RECUPERE: 'bg-teal-100 text-teal-800',
  CLOS: 'bg-gray-100 text-gray-800',
};