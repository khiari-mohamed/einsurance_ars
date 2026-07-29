import api from '../lib/api';
import type {
  Sinistre, CreateSinistreDto, UpdateSinistreDto, AdjustSapDto,
  SinistreKpis, LossRatio, EvolutionPoint, ByCedantePoint, ByStatusPoint, AgingReport,
  SinistreEvent, SinistreStatut,
} from '../types/sinistre.types';
import type { CashCall, CreateCashCallDto, RecordCashCallPaymentDto } from '../types/cash-call.types';

export interface SinistreFilters {
  affaireId?: string;
  statut?: SinistreStatut;
  cedanteId?: string;
  page?: number;
  limit?: number;
}

export interface SinistresListResponse {
  data: Sinistre[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const sinistresApi = {
  getAll: (filters?: SinistreFilters) => api.get<SinistresListResponse>('/sinistres', { params: filters }),
  getOne: (id: string) => api.get<Sinistre>(`/sinistres/${id}`),
  create: (data: CreateSinistreDto) => api.post<Sinistre>('/sinistres', data),
  update: (id: string, data: UpdateSinistreDto) => api.put<Sinistre>(`/sinistres/${id}`, data),
  adjustSap: (id: string, data: AdjustSapDto) => api.patch<Sinistre>(`/sinistres/${id}/adjust-sap`, data),

  // Workflow
  submitValidation: (id: string, note?: string) => api.patch<Sinistre>(`/sinistres/${id}/submit-validation`, { note }),
  approve: (id: string, note?: string) => api.patch<Sinistre>(`/sinistres/${id}/approve`, { note }),
  reject: (id: string, motif: string) => api.patch<Sinistre>(`/sinistres/${id}/reject`, { motif }),
  declareToReassureurs: (id: string, note?: string) => api.patch<Sinistre>(`/sinistres/${id}/declare-reassureurs`, { note }),
  markRecovery: (id: string, note?: string) => api.patch<Sinistre>(`/sinistres/${id}/recovery`, { note }),
  close: (id: string, note?: string) => api.patch<Sinistre>(`/sinistres/${id}/close`, { note }),

  // Cash Call — one per claim
  triggerCashCall: (id: string, data: CreateCashCallDto) => api.post<CashCall>(`/sinistres/${id}/cash-call`, data),
  advanceCashCall: (id: string, statut: string, note?: string) =>
    api.patch<CashCall>(`/sinistres/${id}/cash-call/advance`, { statut, note }),
  recordCashCallPayment: (id: string, data: RecordCashCallPaymentDto) =>
    api.post<CashCall>(`/sinistres/${id}/cash-call/record-payment`, data),

  // Events
  getEvents: (id: string) => api.get<SinistreEvent[]>(`/sinistres/${id}/events`),

  // Analytics
  getKpis: (cedanteId?: string, year?: number) => api.get<SinistreKpis>('/sinistres/analytics/kpis', { params: { cedanteId, year } }),
  getLossRatio: (cedanteId?: string, year?: number) => api.get<LossRatio>('/sinistres/analytics/loss-ratio', { params: { cedanteId, year } }),
  getEvolution: (months = 12) => api.get<EvolutionPoint[]>('/sinistres/analytics/evolution', { params: { months } }),
  getByCedante: (limit = 10) => api.get<ByCedantePoint[]>('/sinistres/analytics/by-cedante', { params: { limit } }),
  getByStatus: () => api.get<ByStatusPoint[]>('/sinistres/analytics/by-status'),
  getAging: () => api.get<AgingReport>('/sinistres/analytics/aging'),
};

export default sinistresApi;