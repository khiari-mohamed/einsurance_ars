import api from '../lib/api';
import { Document, UploadDocumentDto, UpdateDocumentDto, SearchDocumentDto, DocumentStatistics, EntityType, DocumentType } from '../types/ged.types';

export const gedApi = {
  uploadDocument: async (file: File, data: UploadDocumentDto): Promise<Document> => {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value));
      }
    });

    const response = await api.post('/ged/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getDocuments: async (params?: SearchDocumentDto): Promise<Document[]> => {
    const response = await api.get('/ged/documents', { params });
    return response.data;
  },

  getDocument: async (id: string): Promise<Document> => {
    const response = await api.get(`/ged/documents/${id}`);
    return response.data;
  },

  downloadDocument: async (id: string): Promise<Blob> => {
    const response = await api.get(`/ged/documents/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  updateDocument: async (id: string, data: UpdateDocumentDto): Promise<Document> => {
    const response = await api.put(`/ged/documents/${id}`, data);
    return response.data;
  },

  deleteDocument: async (id: string): Promise<void> => {
    await api.delete(`/ged/documents/${id}`);
  },

  getEntityDocuments: async (entityType: EntityType, entityId: string): Promise<Document[]> => {
    const response = await api.get(`/ged/entity/${entityType}/${entityId}`);
    return response.data;
  },

  getStatistics: async (): Promise<DocumentStatistics> => {
    const response = await api.get('/ged/statistics');
    return response.data;
  },

  bulkUpload: async (files: File[], data: { entityType: EntityType; entityId: string; documentType: DocumentType }): Promise<Document[]> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('entityType', data.entityType);
    formData.append('entityId', data.entityId);
    formData.append('documentType', String(data.documentType));

    const response = await api.post('/ged/bulk/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  bulkDownload: async (documentIds: string[]): Promise<Blob> => {
    const response = await api.post('/ged/bulk/download', { documentIds }, {
      responseType: 'blob',
    });
    return response.data;
  },

  createShareLink: async (id: string, config: { expiresAt: string; password?: string; email?: string; maxDownloads?: number }): Promise<{ token: string; url: string }> => {
    const response = await api.post(`/ged/documents/${id}/share`, config);
    return response.data;
  },

  // NOTE: this hits GET /ged/shared/:token, which is a @Public() route on
  // the backend (no auth header required/sent) — that's intentional, this
  // is meant to work for an external recipient with just the link.
  accessSharedDocument: async (token: string, password?: string): Promise<Blob> => {
    const response = await api.get(`/ged/shared/${token}`, {
      params: { password },
      responseType: 'blob',
    });
    return response.data;
  },

  checkCompliance: async (entityType: EntityType, entityId: string): Promise<any> => {
    const response = await api.get(`/ged/compliance/${entityType}/${entityId}`);
    return response.data;
  },

  getMissingDocumentsReport: async (): Promise<any[]> => {
    const response = await api.get('/ged/compliance/reports/missing-documents');
    return response.data;
  },

  getAffaireDocuments: async (affaireId: string): Promise<Document[]> => {
    const response = await api.get(`/ged/affaire/${affaireId}/documents`);
    return response.data;
  },

  getSinistreDocuments: async (sinistreId: string): Promise<Document[]> => {
    const response = await api.get(`/ged/sinistre/${sinistreId}/documents`);
    return response.data;
  },

  getPaymentDocuments: async (paymentId: string): Promise<Document[]> => {
    const response = await api.get(`/ged/finance/payment/${paymentId}/documents`);
    return response.data;
  },

  // ── Checklists ────────────────────────────────────────────────────
  // NEW: DocumentChecklist.tsx previously bypassed the API layer entirely
  // with raw `fetch()` calls to non-existent/unauthenticated endpoints.
  // These bring checklist access into the same authenticated axios
  // instance (Bearer token, envelope-unwrapping, silent refresh) as
  // everything else in this file.
  getChecklist: async (affaireId: string): Promise<any> => {
    const response = await api.get(`/ged/checklist/${affaireId}`);
    return response.data;
  },

  markItemReceived: async (checklistId: string, itemId: string, documentId: string): Promise<any> => {
    const response = await api.post(`/ged/checklist/${checklistId}/items/${itemId}/receive`, { documentId });
    return response.data;
  },

  markItemRejected: async (checklistId: string, itemId: string): Promise<any> => {
    const response = await api.post(`/ged/checklist/${checklistId}/items/${itemId}/reject`, {});
    return response.data;
  },
};