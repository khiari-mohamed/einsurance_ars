import api from '../lib/api';
import type { EntityType } from '../types/ged.types';

const uploadBaseUrl = api.defaults.baseURL ?? '';

export interface UploadFileParams {
  file: File;
  entityType: EntityType;
  entityId: string;
  documentType?: string;
  comment?: string;
  onProgress?: (percent: number) => void;
}

// Uses raw XHR instead of fetch/axios shorthand specifically to get
// real upload progress events for the progress bar in FileUploadZone.
function uploadWithProgress(url: string, formData: FormData, onProgress?: (p: number) => void) {
  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    const token = localStorage.getItem('accessToken');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(JSON.parse(xhr.responseText)?.message || 'Échec du téléversement.'));
      }
    };
    xhr.onerror = () => reject(new Error('Erreur réseau pendant le téléversement.'));

    xhr.send(formData);
  });
}

export const uploadsApi = {
  uploadSingle: ({ file, entityType, entityId, documentType, comment, onProgress }: UploadFileParams) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    if (documentType) formData.append('documentType', documentType);
    if (comment) formData.append('comment', comment);

    return uploadWithProgress(`${uploadBaseUrl}/uploads`, formData, onProgress);
  },

  uploadBulk: (
    files: File[],
    entityType: EntityType,
    entityId: string,
    documentType?: string,
    onProgress?: (p: number) => void,
  ) => {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));
    formData.append('entityType', entityType);
    formData.append('entityId', entityId);
    if (documentType) formData.append('documentType', documentType);

    return uploadWithProgress(`${uploadBaseUrl}/uploads/bulk`, formData, onProgress);
  },

  addVersion: (documentId: string, file: File, onProgress?: (p: number) => void) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadWithProgress(`${uploadBaseUrl}/uploads/${documentId}/version`, formData, onProgress);
  },

  getDownloadUrl: (documentId: string) => `${uploadBaseUrl}/uploads/${documentId}/download`,

  remove: (documentId: string) => api.delete(`/uploads/${documentId}`),
};