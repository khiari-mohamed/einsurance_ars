import { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, X, Loader2, AlertCircle } from 'lucide-react';
import { useFileUpload } from '../../hooks/useFileUpload';
import { ACCEPT_ATTRIBUTE, isAllowedFile, MAX_FILE_SIZE_MB } from '../../lib/upload.config';
import type { EntityType } from '../../types/ged.types';

interface FileUploadZoneProps {
  entityType: EntityType;
  entityId: string;
  documentType?: string;
  multiple?: boolean;
  onUploaded?: (result: any) => void;
}

// Generic drag-and-drop upload zone — drop this into any module
// (AssureDetail, SinistreDocuments, BordereauDocuments, SWIFT upload...)
// and pass the entityType/entityId; everything else is handled here.
export function FileUploadZone({
  entityType,
  entityId,
  documentType,
  multiple = false,
  onUploaded,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { progress, isUploading, error, upload, reset } = useFileUpload();

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const file = fileList[0]; // single-file path uses useFileUpload; bulk handled by caller if needed
      setLocalError(null);

      if (!isAllowedFile(file)) {
        setLocalError('Type de fichier non autorisé. Formats acceptés : PDF, Word, Excel, CSV, PNG, JPG.');
        return;
      }

      try {
        const result = await upload({ file, entityType, entityId, documentType });
        onUploaded?.(result);
        reset();
      } catch {
        // error already surfaced via hook's `error` state
      }
    },
    [entityType, entityId, documentType, upload, onUploaded, reset],
  );

  const displayError = localError || error;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {isUploading ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm text-gray-600">Téléversement en cours… {progress}%</p>
            <div className="w-full max-w-xs h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </>
        ) : (
          <>
            <UploadCloud className="h-6 w-6 text-gray-400" />
            <p className="text-sm text-gray-600">
              Glissez-déposez un fichier ici, ou <span className="text-blue-600 underline">parcourir</span>
            </p>
            <p className="text-xs text-gray-400">PDF, Word, Excel, CSV, PNG, JPG — max {MAX_FILE_SIZE_MB}MB</p>
          </>
        )}
      </div>

      {displayError && (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}