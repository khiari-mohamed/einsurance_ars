// FIX (Affaires Pass 2): dedicated types for the /facultatives module —
// its list/detail response shapes nest differently from Affaire.facultativeData
// (here the facultative record is the root, `affaire` is nested inside it).
import {
  ReassuranceType, ModeRenouvellement, AffaireStatut, AffaireType,
  PartnerRef, GuaranteeLine, AffaireReassureur,
} from './affaire.types';

export interface FacultativeAffaireHeader {
  id: string;
  numero: string;
  statut: AffaireStatut;
  type: AffaireType;
  cedanteId: string;
  cedante: PartnerRef;
  reassureurs: AffaireReassureur[];
}

export interface FacultativeListItem {
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
  affaire: FacultativeAffaireHeader;
}

// Detail response nests fuller party records (contacts, default bank
// account) — kept loose on those specific sub-objects since this pass
// doesn't build a dedicated detail page that consumes them deeply.
export interface FacultativeDetail extends Omit<FacultativeListItem, 'affaire' | 'assure'> {
  assure: PartnerRef & { contacts?: any[] };
  affaire: FacultativeAffaireHeader & {
    cedante: PartnerRef & Record<string, any>;
    reassureurs: (AffaireReassureur & {
      reassureur: PartnerRef & { bankAccounts?: any[]; contacts?: any[] };
    })[];
  };
}

export interface FacultativesListResponse {
  data: FacultativeListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface RenewalAlertItem {
  id: string;
  affaireId: string;
  dateEcheance: string;
  modeRenouvellement?: ModeRenouvellement;
  branche?: string;
  affaire: { cedante: { code: string; raisonSociale: string } };
  assure: { code: string; raisonSociale: string };
}

export interface BranchStat {
  branche: string;
  count: number;
  totalPrime: number;
  totalCommission: number;
}

export interface FacultativeFilters {
  cedanteId?: string;
  assureId?: string;
  branche?: string;
  statut?: AffaireStatut;
  dateEffetFrom?: string;
  dateEffetTo?: string;
  modeRenouvellement?: ModeRenouvellement;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GuaranteeLineInput {
  garantie: string;
  capitauxAssures100: number;
  ordre?: number;
}

export interface CreateFacultativeDto {
  affaireId: string;
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

export type UpdateFacultativeDto = Partial<Omit<CreateFacultativeDto, 'affaireId' | 'reassuranceType'>>;