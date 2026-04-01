import api from '../lib/api';
import { Sinistre, CreateSinistreDto } from '../types/sinistre.types';

export const sinistresApi = {
  getAll: (filters?: any) => api.get<Sinistre[]>('/sinistres', { params: filters }),
  getOne: (id: string) => api.get<Sinistre>(`/sinistres/${id}`),
  create: (data: CreateSinistreDto) => api.post<Sinistre>('/sinistres', data),
  update: (id: string, data: Partial<Sinistre>) => api.put<Sinistre>(`/sinistres/${id}`, data),
  delete: (id: string) => api.delete(`/sinistres/${id}`),
  notifyReinsurers: (id: string) => api.post(`/sinistres/${id}/notify-reinsurers`),
  updateParticipation: (id: string, data: any) => api.put(`/sinistres/participations/${id}`, data),
  getDashboardStats: () => api.get('/sinistres/dashboard/stats'),
  
  // Documents
  getDocuments: (id: string) => api.get(`/sinistres/${id}/documents`),
  uploadDocument: (id: string, formData: FormData) => api.post(`/sinistres/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getDocumentUrl: (docId: string) => api.get(`/sinistres/documents/${docId}/url`),
  deleteDocument: (docId: string) => api.delete(`/sinistres/documents/${docId}`),
  
  // Expertise
  createExpertise: (data: any) => api.post('/sinistres/expertises', data),
  
  // SAP
  adjustSAP: (data: any) => api.post('/sinistres/sap/adjust', data),
  
  // Analytics
  getEvolution: (months?: number) => api.get('/sinistres/analytics/evolution', { params: { months } }),
  getByCedante: () => api.get('/sinistres/analytics/by-cedante'),
  getByStatus: () => api.get('/sinistres/analytics/by-status'),
  getAging: () => api.get('/sinistres/analytics/aging'),
  getSAPAnalysis: () => api.get('/sinistres/analytics/sap-summary'),
  
  // Bordereaux
  generateBordereau: (data: { startDate: string; endDate: string; reassureurId?: string; cedanteId?: string }) => 
    api.post('/sinistres/bordereaux/generate', data),
  generateBordereauPDF: (data: { startDate: string; endDate: string; reassureurId?: string; cedanteId?: string }) => 
    api.post('/sinistres/bordereaux/generate-pdf', data),
  
  // Audit Trail
  getAuditTrail: (id: string) => api.get(`/sinistres/${id}/audit-trail`),
};
