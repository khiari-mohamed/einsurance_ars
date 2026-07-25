import api from '../lib/api';
import type {
  Bordereau, CreateBordereauDto, UpdateBordereauDto, GenerateBordereauDto,
  RejectDto, SendDto, PayDto, BordereauStatistics, BordereauFilters,
  AgingReport, VolumeMetrics, BordereauDocumentLink, BordereauHistoryEntry,
} from '../types/bordereau.types';

export const bordereauxApi = {
  // ── CRUD ──────────────────────────────────────────────────────────
  getAll: (params?: BordereauFilters) =>
    api.get<{ data: Bordereau[]; total: number; page: number; limit: number }>('/bordereaux', { params }),

  getOne: (id: string) => api.get<Bordereau>(`/bordereaux/${id}`),

  getByNumero: (numero: string) => api.get<Bordereau>(`/bordereaux/numero/${numero}`),

  create: (data: CreateBordereauDto) => api.post<Bordereau>('/bordereaux', data),

  update: (id: string, data: UpdateBordereauDto) => api.put<Bordereau>(`/bordereaux/${id}`, data),

  delete: (id: string) => api.delete<{ deleted: boolean }>(`/bordereaux/${id}`),

  // ── Generation (real backend supports: CESSION_CEDANTE, CESSION_REASSUREUR, SINISTRE_FACULTATIVE) ──
  generate: (data: GenerateBordereauDto) => api.post<Bordereau[]>('/bordereaux/generate', data),

  // ── Workflow ──────────────────────────────────────────────────────
  submitForValidation: (id: string) => api.patch<Bordereau>(`/bordereaux/${id}/submit-validation`),
  validate: (id: string) => api.patch<Bordereau>(`/bordereaux/${id}/validate`),
  reject: (id: string, data: RejectDto) => api.patch<Bordereau>(`/bordereaux/${id}/reject`, data),
  send: (id: string, data: SendDto) => api.patch<Bordereau>(`/bordereaux/${id}/send`, data),
  sendReminder: (id: string) => api.post<{ sent: boolean }>(`/bordereaux/${id}/send-reminder`),
  pay: (id: string, data: PayDto) => api.post<{ payment: any; bordereau: Bordereau }>(`/bordereaux/${id}/pay`, data),
  archive: (id: string) => api.patch<Bordereau>(`/bordereaux/${id}/archive`),

  // ── History ───────────────────────────────────────────────────────
  getHistory: (id: string) => api.get<BordereauHistoryEntry[]>(`/bordereaux/${id}/history`),

  // ── Documents (DocumentLink-backed) ──────────────────────────────
  getDocuments: (id: string) => api.get<BordereauDocumentLink[]>(`/bordereaux/${id}/documents`),

  validateDocuments: (id: string) =>
    api.get<{ complete: boolean; missing: string[] }>(`/bordereaux/${id}/documents/validate`),

  uploadDocument: (id: string, file: File, documentType: string, description?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    if (description) formData.append('description', description);
    return api.post<any>(`/bordereaux/${id}/documents`, formData, {
      headers: { 'Content-Type': undefined }, // let axios set the multipart boundary itself
    });
  },

  deleteDocument: (id: string, documentLinkId: string) =>
    api.delete(`/bordereaux/${id}/documents/${documentLinkId}`),

  // ── PDF ───────────────────────────────────────────────────────────
  generatePdf: (id: string) => api.get(`/bordereaux/${id}/pdf`, { responseType: 'blob' }),

  bulkGeneratePdf: (bordereauIds: string[]) =>
    api.post<{ success: Array<{ id: string; fileName: string }>; failed: Array<{ id: string; error: string }> }>(
      '/bordereaux/bulk-generate-pdf', { bordereauIds },
    ),

  // ── Bulk ──────────────────────────────────────────────────────────
  bulkValidate: (bordereauIds: string[]) =>
    api.post<{ success: string[]; failed: Array<{ id: string; error: string }> }>('/bordereaux/bulk-validate', { bordereauIds }),

  bulkArchive: (bordereauIds: string[]) =>
    api.post<{ success: string[]; failed: Array<{ id: string; error: string }> }>('/bordereaux/bulk-archive', { bordereauIds }),

  bulkSend: (bordereauIds: string[], recipients: string[]) =>
    api.post<{ success: string[]; failed: Array<{ id: string; error: string }> }>('/bordereaux/bulk-send', { bordereauIds, recipients }),

  // ── Statistics & Reports ─────────────────────────────────────────
  getStatistics: (params?: { cedanteId?: string; reassureurCode?: string; startDate?: string; endDate?: string }) =>
    api.get<BordereauStatistics>('/bordereaux/statistics', { params }),

  getAgingReport: () => api.get<AgingReport>('/bordereaux/reports/aging'),

  getVolumeMetrics: (startDate: string, endDate: string) =>
    api.get<VolumeMetrics>('/bordereaux/reports/volume', { params: { startDate, endDate } }),

  getOverdue: () => api.get<Bordereau[]>('/bordereaux/overdue'),

  getDueSoon: (days?: number) => api.get<Bordereau[]>('/bordereaux/due-soon', { params: { days } }),
};

export default bordereauxApi;