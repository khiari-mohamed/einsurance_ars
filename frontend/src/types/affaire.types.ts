export enum AffaireStatus {
  DRAFT = 'draft',
  COTATION = 'cotation',
  PREVISION = 'prevision',
  PLACEMENT_REALISE = 'placement_realise',
  ACTIVE = 'active',
  TERMINE = 'termine',
  ANNULE = 'annule',
}

export enum AffaireCategory {
  FACULTATIVE = 'facultative',
  TRAITEE = 'traitee',
}

export enum AffaireType {
  PROPORTIONNEL = 'proportionnel',
  NON_PROPORTIONNEL = 'non_proportionnel',
}

export enum PaymentMode {
  PAYE_HORS_SITUATION = 'paye_hors_situation',
  INCLUS_SITUATION = 'inclus_situation',
}

export enum CommissionCalculMode {
  AUTO = 'auto',
  MANUEL = 'manuel',
}

export enum TreatyType {
  QP = 'qp',
  XOL = 'xol',
  SURPLUS = 'surplus',
  STOP_LOSS = 'stop_loss',
}

export enum PeriodiciteComptes {
  TRIMESTRIEL = 'trimestriel',
  SEMESTRIEL = 'semestriel',
  ANNUEL = 'annuel',
}

export enum PaymentStatus {
  EN_ATTENTE = 'en_attente',
  PARTIEL = 'partiel',
  COMPLET = 'complet',
  RETARDE = 'retarde',
}

export interface AffaireReinsurer {
  id: string;
  reassureurId: string;
  reassureur: {
    id: string;
    code: string;
    raisonSociale: string;
  };
  share: number;
  role: string;
  signed: boolean;
  slipReceived: boolean;
  primePart: number;
  commissionPart: number;
  netAmount: number;
}

export interface Affaire {
  id: string;
  numeroAffaire: string;
  status: AffaireStatus;
  category: AffaireCategory;
  type: AffaireType;
  assure: {
    id: string;
    code: string;
    raisonSociale: string;
  };
  assureId: string;
  cedante: {
    id: string;
    code: string;
    raisonSociale: string;
  };
  cedanteId: string;
  coCourtier?: {
    id: string;
    code: string;
    raisonSociale: string;
  };
  coCourtierId?: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdById: string;
  numeroPolice?: string;
  branche?: string;
  garantie?: string;
  dateEffet: string;
  dateEcheance: string;
  dateNotification?: string;
  devise: string;
  capitalAssure100: number;
  prime100: number;
  tauxCession: number;
  primeCedee: number;
  tauxCommissionCedante: number;
  montantCommissionCedante: number;
  modeCalculCommissionCedante: CommissionCalculMode;
  tauxCommissionARS: number;
  montantCommissionARS: number;
  modeCalculCommissionARS: CommissionCalculMode;
  paymentMode: PaymentMode;
  exercice: number;
  reinsurers: AffaireReinsurer[];
  treatyType?: TreatyType;
  treatyBranches?: string[];
  treatyZones?: string[];
  periodiciteComptes?: PeriodiciteComptes;
  rubriquesComptes?: string[];
  primePrevisionnelle?: number;
  pmd?: number;
  bordereauReference?: string;
  slipCouvReference?: string;
  bordereauGenerated: boolean;
  slipReceived: boolean;
  paymentStatusCedante: PaymentStatus;
  paymentStatusReinsurers: PaymentStatus;
  primeEncaissee: number;
  primeDecaissee: number;
  sapTotal: number;
  sinistresTotal: number;
  sinistresCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAffaireReinsurer {
  reassureurId: string;
  share: number;
  role?: string;
}

export interface CreateAffaireData {
  category: AffaireCategory;
  type: AffaireType;
  assureId: string;
  cedanteId: string;
  coCourtierId?: string;
  numeroPolice?: string;
  branche?: string;
  garantie?: string;
  dateEffet: string;
  dateEcheance: string;
  dateNotification?: string;
  devise?: string;
  capitalAssure100: number;
  prime100: number;
  tauxCession: number;
  tauxCommissionCedante?: number;
  modeCalculCommissionCedante?: CommissionCalculMode;
  tauxCommissionARS?: number;
  modeCalculCommissionARS?: CommissionCalculMode;
  paymentMode?: PaymentMode;
  reinsurers: CreateAffaireReinsurer[];
  treatyType?: TreatyType;
  treatyBranches?: string[];
  treatyZones?: string[];
  periodiciteComptes?: PeriodiciteComptes;
  rubriquesComptes?: string[];
  primePrevisionnelle?: number;
  pmd?: number;
  montantCommissionCedante?: number;
  montantCommissionARS?: number;
  notes?: string;
}
