export interface TreatyParameterVersion {
  id: string;
  traiteId: string;
  version: number;
  dateDebut: string;
  dateFin: string;
  tauxCommissionCedante: number;
  tauxCommissionCourtage: number;
  plafondGarantie?: number;
  franchiseAbsolue?: number;
  franchiseRelative?: number;
  clauseParticuliere?: string;
  motifModification?: string;
  isActive: boolean;
  createdByUserId?: string;
  createdAt: string;
}

export interface CreateTreatyParameterVersionInput {
  dateDebut: string;
  dateFin: string;
  tauxCommissionCedante: number;
  tauxCommissionCourtage: number;
  plafondGarantie?: number;
  franchiseAbsolue?: number;
  franchiseRelative?: number;
  clauseParticuliere?: string;
  motifModification?: string;
}

export type UpdateTreatyParameterVersionInput = Partial<Omit<CreateTreatyParameterVersionInput, 'motifModification'>> & {
  motifModification: string;
};

export type RenewTreatyParameterVersionInput = Partial<CreateTreatyParameterVersionInput>;