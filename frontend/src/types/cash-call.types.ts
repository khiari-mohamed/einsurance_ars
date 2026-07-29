export type CashCallStatut =
  | 'DECLENCHE'
  | 'REINSUREUR_CONTACTE'
  | 'EN_ATTENTE_PAIEMENT'
  | 'PAIEMENT_RECU'
  | 'LETTRE';

// A claim has AT MOST ONE cash call (CashCall.sinistreId is @unique on the
// backend) — this is not a list resource.
export interface CashCall {
  id: string;
  sinistreId: string;
  statut: CashCallStatut;
  montantDemande: number;
  montantRecu?: number | null;
  dateDeclenche: string;
  datePaiement?: string | null;
  notes?: string | null;
  encaissementId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCashCallDto {
  montantDemande: number;
  notes?: string;
}

export interface RecordCashCallPaymentDto {
  montantRecu: number;
}