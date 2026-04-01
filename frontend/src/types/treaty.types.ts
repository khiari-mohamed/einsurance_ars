export enum InstalmentStatus {
  PENDING = 'pending',
  DUE = 'due',
  PAID = 'paid',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export interface PMDInstalment {
  id: string;
  affaireId: string;
  numeroEcheance: number;
  dateEcheance: Date;
  montant: number;
  pourcentage: number;
  montantPaye: number;
  datePaiement?: Date;
  statut: InstalmentStatus;
  referencePaiement?: string;
  notes?: string;
  rappelEnvoye: boolean;
  dateRappel?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TreatyParametersModification {
  date: Date;
  champ: string;
  ancienneValeur: any;
  nouvelleValeur: any;
  modifiePar: string;
  motif?: string;
}

export interface TreatyConditionsParticulieres {
  franchise?: number;
  plafond?: number;
  clausesSpeciales?: string[];
  exclusions?: string[];
}

export interface TreatyParameters {
  id: string;
  affaireId: string;
  anneeRenouvellement: number;
  dateEffet: Date;
  dateEcheance: Date;
  seuilNotificationSinistre?: number;
  seuilCashCall?: number;
  tauxCommissionCedante?: number;
  tauxCommissionARS?: number;
  tauxCommissionLiquidation?: number;
  conditionsParticulieres?: TreatyConditionsParticulieres;
  modifications: TreatyParametersModification[];
  actif: boolean;
  notes?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuaranteeLineConditions {
  franchise?: number;
  plafond?: number;
  exclusions?: string[];
}

export interface GuaranteeLine {
  id: string;
  affaireId: string;
  garantie: string;
  capitalAssure100: number;
  prime100: number;
  tauxPrime: number;
  tauxCession: number;
  primeCedee: number;
  description?: string;
  conditions?: GuaranteeLineConditions;
  ordre: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePMDInstalmentDto {
  affaireId: string;
  numeroEcheance: number;
  dateEcheance: Date;
  montant: number;
  pourcentage: number;
  notes?: string;
}

export interface CreateTreatyParametersDto {
  affaireId: string;
  anneeRenouvellement: number;
  dateEffet: Date;
  dateEcheance: Date;
  seuilNotificationSinistre?: number;
  seuilCashCall?: number;
  tauxCommissionCedante?: number;
  tauxCommissionARS?: number;
  tauxCommissionLiquidation?: number;
  conditionsParticulieres?: TreatyConditionsParticulieres;
  notes?: string;
}

export interface CreateGuaranteeLineDto {
  affaireId: string;
  garantie: string;
  capitalAssure100: number;
  prime100?: number;
  tauxPrime?: number;
  tauxCession?: number;
  description?: string;
  conditions?: GuaranteeLineConditions;
  ordre?: number;
}
