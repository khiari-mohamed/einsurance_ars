import api from '../lib/api';
import { EntityType } from '../types/ged.types';

const uploadBaseUrl = api.defaults.baseURL ?? '';

export interface UploadFileParams {
  file: File;
  entityType: EntityType;
  entityId: string;
  documentType?: string;
  comment?: string;
  onProgress?: (percent: number) => void;
}

// FIX (SWIFT/GED gap): two real bugs.
// 1. The auth token was read from localStorage.getItem('accessToken') — a
//    key nothing in this app ever writes. The real key is 'ars-auth', with
//    the token nested at state.token (see lib/api.ts's readAuth()). Every
//    raw-XHR upload through this file was silently sent with NO
//    Authorization header — combined with UploadsController previously
//    having no guards at all, this went unnoticed; now that the controller
//    is guarded, uploads via this path would have started failing with 401
//    if left unfixed.
// 2. xhr.onload resolved with the raw parsed response body — but every
//    successful response from this backend is wrapped in
//    {success, data, timestamp} (see lib/api.ts's response interceptor).
//    Raw XHR bypasses that interceptor, so callers were receiving the
//    wrapper object instead of the actual document. Now unwrapped to match.
function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem('ars-auth');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

function uploadWithProgress(url: string, formData: FormData, onProgress?: (p: number) => void) {
  return new Promise<any>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    const token = getAuthToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const parsed = JSON.parse(xhr.responseText);
          const unwrapped = parsed && typeof parsed === 'object' && 'success' in parsed && 'data' in parsed
            ? parsed.data
            : parsed;
          resolve(unwrapped);
        } catch {
          reject(new Error('Réponse invalide du serveur.'));
        }
      } else {
        try {
          reject(new Error(JSON.parse(xhr.responseText)?.message || 'Échec du téléversement.'));
        } catch {
          reject(new Error('Échec du téléversement.'));
        }
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

export default uploadsApi;