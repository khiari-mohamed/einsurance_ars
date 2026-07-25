import {
  ReassuranceType, FormeCouverture, ModeRenouvellement, Periodicite,
  AffaireStatut, AffaireType, PartnerRef, AffaireReassureur,
} from './affaire.types';

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
  isPaid: boolean;
  paidAt?: string;
}

export interface TraiteAffaireHeader {
  id: string;
  numero: string;
  statut: AffaireStatut;
  type: AffaireType;
  cedanteId: string;
  cedante: PartnerRef;
  reassureurs: AffaireReassureur[];
  currency: string;
}

export interface TraiteListItem {
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
  primePrevisionnelle?: number;
  pmd?: number;
  tauxCommissionCedante?: number;
  commissionLiquidationArs?: number;
  seuilNotification?: number;
  renewalReminderSent?: boolean;
  accountRubriques: TreatyAccountRubrique[];
  pmdInstalments: PmdInstalment[];
  affaire: TraiteAffaireHeader;
  _count?: { situations: number };
}

export interface TraiteDetail extends Omit<TraiteListItem, 'affaire'> {
  affaire: TraiteAffaireHeader & {
    cedante: PartnerRef & Record<string, any>;
    reassureurs: (AffaireReassureur & { reassureur: PartnerRef & { bankAccounts?: any[] } })[];
  };
  situations?: any[];
}

export interface TraitesListResponse {
  data: TraiteListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TraiteFilters {
  cedanteId?: string;
  reassuranceType?: ReassuranceType;
  periodicite?: Periodicite;
  statut?: AffaireStatut;
  search?: string;
  page?: number;
  limit?: number;
}

export interface RenewalAlertItem {
  id: string;
  affaireId: string;
  referenceTraite?: string;
  dateEcheance: string;
  modeRenouvellement?: ModeRenouvellement;
  affaire: { cedante: { code: string; raisonSociale: string } };
}

export interface TraiteTypeStat {
  type: ReassuranceType;
  count: number;
  totalPmd: number;
  totalPrimePrevisionnelle: number;
}

export interface TraitesStats {
  totalTraitesActifs: number;
  byType: TraiteTypeStat[];
  pmdEcheancesAnnee: { count: number; totalMontant: number };
  year: number;
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

export interface LiquidationInput {
  primesCedees: number;
  participationsBenefReçues: number;
  interetsSurDepots: number;
  sinistresPayes: number;
  reservesConstituees: number;
  reservesLibereesAnterieur: number;
  commissionCedante: number;
  commissionLiquidationArs: number;
  courtage: number;
  taxes: number;
  pmdDeductible: number;
}

export interface LiquidationResult {
  totalDebit: number;
  totalCredit: number;
  soldeNet: number;
  soldeDirection: 'CEDANTE_DOIT' | 'ARS_DOIT' | 'EQUILIBRE';
  lines: { libelle: string; debit: number; credit: number }[];
}

export interface TreatyDistributionResult {
  reassureurId: string;
  primeBrute: number;
  commissionArs: number;
  primeNetteReassureur: number;
}