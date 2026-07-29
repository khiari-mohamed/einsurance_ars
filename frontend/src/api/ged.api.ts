// FIX (SWIFT/GED gap): full rewrite against the real GedController.
// - getDocuments()/search() now return the real {data,total,page,limit}
//   envelope instead of assuming a bare array.
// - uploadDocument() now builds the per-entity-type FK field (assureId /
//   cedanteId / ... / ordrePaiementId) that the backend's UploadDocumentDto
//   actually expects, instead of a generic entityId that had no matching
//   field on the DTO at all.
// - getEntityDocuments() now hits the real route
//   (/ged/entity/:entityType/:entityId) and is typed as DocumentLink[]
//   (what GedService.getDocumentsForEntity() actually returns), not
//   Document[].
import api from '../lib/api';
import {
  Document, DocumentLink, UpdateDocumentDto, SearchDocumentDto,
  PaginatedDocuments, DocumentStatistics, DocumentEntityType, DocumentChecklist,
  ShareLinkConfig, ShareLinkResult,
} from '../types/ged.types';

// Mirrors uploads.service.ts's ENTITY_LINK_FIELD map exactly — the
// canonical entityType -> FK field name mapping used server-side.
const ENTITY_LINK_FIELD: Record<DocumentEntityType, string> = {
  [DocumentEntityType.ASSURE]: 'assureId',
  [DocumentEntityType.CEDANTE]: 'cedanteId',
  [DocumentEntityType.REASSUREUR]: 'reassureurId',
  [DocumentEntityType.CO_COURTIER]: 'coCourtId',
  [DocumentEntityType.AFFAIRE]: 'affaireId',
  [DocumentEntityType.SINISTRE]: 'sinistreId',
  [DocumentEntityType.ENCAISSEMENT]: 'encaissementId',
  [DocumentEntityType.DECAISSEMENT]: 'decaissementId',
  [DocumentEntityType.ORDRE_PAIEMENT]: 'ordrePaiementId',
  [DocumentEntityType.BORDEREAU]: 'bordereauId',
};

export interface UploadTarget {
  entityType: DocumentEntityType;
  entityId: string;
  documentType?: string;
  comment?: string;
}

export const gedApi = {
  uploadDocument: async (file: File, target: UploadTarget): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', target.entityType);
    formData.append(ENTITY_LINK_FIELD[target.entityType], target.entityId);
    if (target.documentType) formData.append('documentType', target.documentType);
    if (target.comment) formData.append('comment', target.comment);

    const { data } = await api.post<Document>('/ged/upload', formData, {
      headers: { 'Content-Type': undefined }, // let axios set the multipart boundary
    });
    return data;
  },

  getDocuments: (params?: SearchDocumentDto) =>
    api.get<PaginatedDocuments>('/ged/documents', { params }),

  getDocument: (id: string) => api.get<Document>(`/ged/documents/${id}`),

  downloadDocument: async (id: string): Promise<Blob> => {
    const { data } = await api.get(`/ged/documents/${id}/download`, { responseType: 'blob' });
    return data as Blob;
  },

  updateDocument: (id: string, data: UpdateDocumentDto) =>
    api.put<Document>(`/ged/documents/${id}`, data),

  deleteDocument: (id: string) => api.delete<void>(`/ged/documents/${id}`),

  getEntityDocuments: (entityType: DocumentEntityType, entityId: string) =>
    api.get<DocumentLink[]>(`/ged/entity/${entityType}/${entityId}`),

  getAffaireDocuments: (affaireId: string) => api.get<DocumentLink[]>(`/ged/affaire/${affaireId}/documents`),
  getSinistreDocuments: (sinistreId: string) => api.get<DocumentLink[]>(`/ged/sinistre/${sinistreId}/documents`),
  getPaymentDocuments: (paymentId: string) => api.get<DocumentLink[]>(`/ged/finance/payment/${paymentId}/documents`),

  getStatistics: () => api.get<DocumentStatistics>('/ged/statistics'),

  bulkUpload: (files: File[], target: { entityType: DocumentEntityType; entityId: string; documentType?: string }) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('entityType', target.entityType);
    formData.append('entityId', target.entityId);
    if (target.documentType) formData.append('documentType', target.documentType);
    return api.post<{ success: boolean; fileName: string; document?: Document; error?: string }[]>(
      '/ged/bulk/upload', formData, { headers: { 'Content-Type': undefined } },
    );
  },

  bulkDownload: async (documentIds: string[]): Promise<Blob> => {
    const { data } = await api.post('/ged/bulk/download', { documentIds }, { responseType: 'blob' });
    return data as Blob;
  },

  createShareLink: (id: string, config: ShareLinkConfig) =>
    api.post<ShareLinkResult>(`/ged/documents/${id}/share`, config),

  // Hits the @Public() /ged/shared/:token route — works without auth.
  accessSharedDocument: async (token: string): Promise<Blob> => {
    const { data } = await api.get(`/ged/shared/${token}`, { responseType: 'blob' });
    return data as Blob;
  },

  checkCompliance: (entityType: DocumentEntityType, entityId: string) =>
    api.get<any>(`/ged/compliance/${entityType}/${entityId}`),

  getComplianceReport: () => api.get<any>('/ged/compliance/report'),

  getMissingDocumentsReport: () => api.get<any[]>('/ged/compliance/reports/missing-documents'),

  // ── Checklists ──────────────────────────────────────────────────
  getChecklist: (affaireId: string) => api.get<DocumentChecklist>(`/ged/checklist/${affaireId}`),

  markItemReceived: (checklistId: string, itemId: string, documentId: string) =>
    api.post<DocumentChecklist>(`/ged/checklist/${checklistId}/items/${itemId}/receive`, { documentId }),

  markItemRejected: (checklistId: string, itemId: string) =>
    api.post<DocumentChecklist>(`/ged/checklist/${checklistId}/items/${itemId}/reject`, {}),
};

export default gedApi;