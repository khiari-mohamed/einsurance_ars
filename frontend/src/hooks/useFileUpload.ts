import { useState, useCallback } from 'react';
import { uploadsApi, UploadFileParams } from '../api/uploads.api';
import { isAllowedFile, MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '../lib/upload.config';

interface UseFileUploadResult {
  progress: number;
  isUploading: boolean;
  error: string | null;
  upload: (params: Omit<UploadFileParams, 'onProgress'>) => Promise<any>;
  reset: () => void;
}

export function useFileUpload(): UseFileUploadResult {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (params: Omit<UploadFileParams, 'onProgress'>) => {
    setError(null);

    if (!isAllowedFile(params.file)) {
      const msg = 'Type de fichier non autorisé. Formats acceptés : PDF, Word, Excel, CSV, PNG, JPG.';
      setError(msg);
      throw new Error(msg);
    }
    if (params.file.size > MAX_FILE_SIZE_BYTES) {
      const msg = `Fichier trop volumineux. Taille maximale : ${MAX_FILE_SIZE_MB}MB.`;
      setError(msg);
      throw new Error(msg);
    }

    setIsUploading(true);
    setProgress(0);
    try {
      const result = await uploadsApi.uploadSingle({ ...params, onProgress: setProgress });
      return result;
    } catch (err: any) {
      setError(err.message || 'Échec du téléversement.');
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setError(null);
    setIsUploading(false);
  }, []);

  return { progress, isUploading, error, upload, reset };
}