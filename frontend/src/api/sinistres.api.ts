import api from '../lib/api';
import { Sinistre, CreateSinistreDto } from '../types/sinistre.types';

export const sinistresApi = {
  getAll: (filters?: any) => api.get<Sinistre[]>('/sinistres', { params: filters }),
  getOne: (id: string) => api.get<Sinistre>(`/sinistres/${id}`),
  create: (data: CreateSinistreDto) => api.post<Sinistre>('/sinistres', data),
  update: (id: string, data: Partial<Sinistre>) => api.put<Sinistre>(`/sinistres/${id}`, data),
  delete: (id: string) => api.delete(`/sinistres/${id}`),

  // Workflow
  submitValidation: (id: string, note?: string) => api.patch(`/sinistres/${id}/submit-validation`, { note }),
  approve: (id: string, note?: string) => api.patch(`/sinistres/${id}/approve`, { note }),
  reject: (id: string, motif: string) => api.patch(`/sinistres/${id}/reject`, { motif }),
  declareToReassureurs: (id: string, note?: string) => api.patch(`/sinistres/${id}/declare-reassureurs`, { note }),
  markRecovery: (id: string, note?: string) => api.patch(`/sinistres/${id}/recovery`, { note }),
  close: (id: string, note?: string) => api.patch(`/sinistres/${id}/close`, { note }),

  // SAP
  adjustSap: (id: string, data: any) => api.patch(`/sinistres/${id}/adjust-sap`, data),

  // Cash Call
  triggerCashCall: (id: string, data: any) => api.post(`/sinistres/${id}/cash-call`, data),
  advanceCashCall: (id: string, statut: string, note?: string) =>
    api.patch(`/sinistres/${id}/cash-call/advance`, { statut, note }),

  // Events
  getEvents: (id: string) => api.get(`/sinistres/${id}/events`),

  // Analytics — existing backend endpoints
  getKpis: (cedanteId?: string, year?: number) =>
    api.get('/sinistres/analytics/kpis', { params: { cedanteId, year } }),

  // Documents
  getDocuments: (id: string) => api.get(`/sinistres/${id}/documents`),
  uploadDocument: (id: string, formData: FormData) =>
    api.post(`/sinistres/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getDocumentUrl: (docId: string) => api.get(`/sinistres/documents/${docId}/url`),
  deleteDocument: (docId: string) => api.delete(`/sinistres/documents/${docId}`),
};
