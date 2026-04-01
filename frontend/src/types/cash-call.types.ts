export enum CashCallStatus {
  INITIATED = 'initiated',
  SENT = 'sent',
  ACKNOWLEDGED = 'acknowledged',
  PAID = 'paid',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum CashCallUrgency {
  NORMAL = 'normal',
  URGENT = 'urgent',
  CRITICAL = 'critical',
}

export interface CashCallCommunication {
  date: Date;
  type: 'email' | 'phone' | 'fax' | 'portal';
  message: string;
  sentBy: string;
  response?: string;
}

export interface CashCallSuivi {
  date: Date;
  action: string;
  user: string;
  notes?: string;
}

export interface CashCall {
  id: string;
  numero: string;
  sinistreId: string;
  sinistre?: any;
  reassureurId: string;
  reassureur?: any;
  montantDemande: number;
  montantRecu: number;
  devise: string;
  statut: CashCallStatus;
  urgence: CashCallUrgency;
  dateEmission: Date;
  dateEcheance: Date;
  datePaiement?: Date;
  motif: string;
  justification?: string;
  communications: CashCallCommunication[];
  suivis: CashCallSuivi[];
  referencePaiement?: string;
  rappelEnvoye: boolean;
  nombreRappels: number;
  dateDernierRappel?: Date;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCashCallDto {
  sinistreId: string;
  reassureurId: string;
  montantDemande: number;
  devise?: string;
  urgence?: CashCallUrgency;
  dateEcheance: Date;
  motif: string;
  justification?: string;
}

export interface UpdateCashCallDto {
  montantRecu?: number;
  datePaiement?: Date;
  referencePaiement?: string;
  justification?: string;
}

export interface AddCommunicationDto {
  type: 'email' | 'phone' | 'fax' | 'portal';
  message: string;
  response?: string;
}

export interface AddSuiviDto {
  action: string;
  notes?: string;
}
