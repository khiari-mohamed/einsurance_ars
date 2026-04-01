import api from '../lib/api';
import type { Bordereau, CreateBordereauDto, BordereauStatistics, BordereauFilters, PaymentDto } from '../types/bordereau.types';

export const bordereauxApi = {
  // CRUD Operations
  getAll: (params?: BordereauFilters & {
    minAmount?: number;
    maxAmount?: number;
    overdue?: string;
    devise?: string;
    createdById?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }) => api.get<{ data: Bordereau[]; total: number; page: number; limit: number }>('/bordereaux', { params }),

  getOne: (id: string) => api.get<Bordereau>(`/bordereaux/${id}`),

  getByNumero: (numero: string) => api.get<Bordereau>(`/bordereaux/numero/${numero}`),

  create: (data: CreateBordereauDto) => api.post<Bordereau>('/bordereaux', data),

  update: (id: string, data: Partial<CreateBordereauDto>) => api.put<Bordereau>(`/bordereaux/${id}`, data),

  delete: (id: string) => api.delete(`/bordereaux/${id}`),

  // Generation
  generate: (data: {
    type: string;
    cedanteId: string;
    periodStart: string;
    periodEnd: string;
    treatyId?: string;
    reassureurId?: string;
  }) => api.post<Bordereau[]>('/bordereaux/generate', data),

  generateSinistre: (sinistreId: string) => api.post<Bordereau>('/bordereaux/generate-sinistre', { sinistreId }),

  generateSituation: (data: {
    entityType: 'cedante' | 'reassureur';
    entityId: string;
    periodStart: string;
    periodEnd: string;
  }) => api.post<Bordereau>('/bordereaux/generate-situation', data),

  // Workflow
  submitForValidation: (id: string) => api.post<Bordereau>(`/bordereaux/${id}/submit-validation`),

  validate: (id: string) => api.post<Bordereau>(`/bordereaux/${id}/validate`),

  reject: (id: string, reason: string) => api.post<Bordereau>(`/bordereaux/${id}/reject`, { reason }),

  updateStatus: (id: string, status: string, comment?: string) => 
    api.patch<Bordereau>(`/bordereaux/${id}/status`, { status, comment }),

  send: (id: string, recipients: string[]) => api.post<void>(`/bordereaux/${id}/send`, { recipients }),

  // Payment
  markAsPaid: (id: string, paymentData: PaymentDto) => 
    api.post<Bordereau>(`/bordereaux/${id}/pay`, paymentData),

  // Documents
  addDocument: (id: string, file: File, type: string, description?: string, metadata?: Record<string, any>) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    if (description) formData.append('description', description);
    if (metadata) formData.append('metadata', JSON.stringify(metadata));
    return api.post(`/bordereaux/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  getDocuments: (id: string) => api.get(`/bordereaux/${id}/documents`),

  validateDocuments: (id: string) => api.get<{ complete: boolean; missing: string[] }>(`/bordereaux/${id}/documents/validate`),

  // PDF
  generatePdf: (id: string) => api.get(`/bordereaux/${id}/pdf`, { responseType: 'blob' }),

  // Affaires
  addAffaires: (id: string, affaireIds: string[]) => api.post(`/bordereaux/${id}/affaires`, { affaireIds }),

  // Archive
  archive: (id: string) => api.post<Bordereau>(`/bordereaux/${id}/archive`),

  // Bulk Operations
  bulkValidate: (bordereauIds: string[]) => 
    api.post<{ success: string[]; failed: Array<{ id: string; error: string }> }>('/bordereaux/bulk-validate', { bordereauIds }),

  bulkSend: (bordereauIds: string[], recipients: string[]) => 
    api.post<{ success: string[]; failed: Array<{ id: string; error: string }> }>('/bordereaux/bulk-send', { bordereauIds, recipients }),

  bulkGeneratePdf: (bordereauIds: string[]) => 
    api.post<{ success: Array<{ id: string; fileName: string }>; failed: Array<{ id: string; error: string }> }>('/bordereaux/bulk-generate-pdf', { bordereauIds }),

  bulkArchive: (bordereauIds: string[]) => 
    api.post<{ success: string[]; failed: Array<{ id: string; error: string }> }>('/bordereaux/bulk-archive', { bordereauIds }),

  // Statistics & Reports
  getStatistics: (params?: {
    cedanteId?: string;
    reassureurId?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get<BordereauStatistics>('/bordereaux/statistics', { params }),

  getAgingReport: () => api.get<{
    current: { count: number; amount: number };
    days_1_30: { count: number; amount: number };
    days_31_60: { count: number; amount: number };
    days_61_90: { count: number; amount: number };
    over_90: { count: number; amount: number };
  }>('/bordereaux/reports/aging'),

  getVolumeMetrics: (startDate: string, endDate: string) => api.get<{
    total_generated: number;
    by_type: Record<string, number>;
    by_status: Record<string, number>;
    avg_processing_time: number;
    total_amount: number;
  }>('/bordereaux/reports/volume', { params: { startDate, endDate } }),

  getOverdue: () => api.get<Bordereau[]>('/bordereaux/overdue'),

  getDueSoon: (days?: number) => api.get<Bordereau[]>('/bordereaux/due-soon', { params: { days } }),

  // Reminders
  sendReminder: (id: string) => api.post<void>(`/bordereaux/${id}/send-reminder`),
};
