export enum WorkflowTaskType {
  VALIDATION_SINISTRE = 'VALIDATION_SINISTRE',
  CASH_CALL_FOLLOW_UP = 'CASH_CALL_FOLLOW_UP',
  RENOUVELLEMENT_TRAITE = 'RENOUVELLEMENT_TRAITE',
  SAP_ANNUEL_31_DEC = 'SAP_ANNUEL_31_DEC',
  AVIS_SINISTRE_REASSUREUR = 'AVIS_SINISTRE_REASSUREUR',
  SITUATION_A_COMPILER = 'SITUATION_A_COMPILER',
  INTER_DEPARTEMENT_HANDOFF = 'INTER_DEPARTEMENT_HANDOFF',
}

export enum WorkflowTaskStatut {
  EN_ATTENTE = 'EN_ATTENTE',
  EN_COURS = 'EN_COURS',
  COMPLETE = 'COMPLETE',
  ANNULE = 'ANNULE',
}

export const taskTypeLabels: Record<WorkflowTaskType, string> = {
  [WorkflowTaskType.VALIDATION_SINISTRE]: 'Validation sinistre',
  [WorkflowTaskType.CASH_CALL_FOLLOW_UP]: 'Suivi cash call',
  [WorkflowTaskType.RENOUVELLEMENT_TRAITE]: 'Renouvellement traité',
  [WorkflowTaskType.SAP_ANNUEL_31_DEC]: 'SAP annuel (31/12)',
  [WorkflowTaskType.AVIS_SINISTRE_REASSUREUR]: 'Avis sinistre réassureur',
  [WorkflowTaskType.SITUATION_A_COMPILER]: 'Situation à compiler',
  [WorkflowTaskType.INTER_DEPARTEMENT_HANDOFF]: 'Transfert inter-service',
};

export const taskStatutLabels: Record<WorkflowTaskStatut, string> = {
  [WorkflowTaskStatut.EN_ATTENTE]: 'En attente',
  [WorkflowTaskStatut.EN_COURS]: 'En cours',
  [WorkflowTaskStatut.COMPLETE]: 'Terminée',
  [WorkflowTaskStatut.ANNULE]: 'Annulée',
};

export const taskStatutColors: Record<WorkflowTaskStatut, string> = {
  [WorkflowTaskStatut.EN_ATTENTE]: 'bg-gray-100 text-gray-700',
  [WorkflowTaskStatut.EN_COURS]: 'bg-blue-100 text-blue-700',
  [WorkflowTaskStatut.COMPLETE]: 'bg-green-100 text-green-700',
  [WorkflowTaskStatut.ANNULE]: 'bg-red-100 text-red-700',
};

export interface WorkflowTask {
  id: string;
  type: WorkflowTaskType;
  statut: WorkflowTaskStatut;
  affaireId?: string;
  affaire?: { numero: string; type: string; cedante: { raisonSociale: string } };
  situationId?: string;
  assignedToId?: string;
  assignedTo?: { nom: string; prenom: string; email: string };
  createdById?: string;
  createdBy?: { nom: string; prenom: string };
  description?: string;
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTasksListResponse {
  data: WorkflowTask[];
  total: number;
  page: number;
  limit: number;
}

export interface WorkflowTaskFilters {
  type?: WorkflowTaskType;
  statut?: WorkflowTaskStatut;
  affaireId?: string;
  mine?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateWorkflowTaskInput {
  type: WorkflowTaskType;
  description?: string;
  affaireId?: string;
  assignedToId?: string;
  dueDate?: string;
}

export interface AuditHistoryEntry {
  id: string;
  userId?: string;
  user?: { nom: string; prenom: string };
  action: string;
  entityType: string;
  entityId?: string;
  before?: any;
  after?: any;
  createdAt: string;
}

export interface AuditHistoryResponse {
  data: AuditHistoryEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditHistoryFilters {
  affaireId?: string;
  entityType?: string;
  action?: string;
  page?: number;
  limit?: number;
}