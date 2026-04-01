import { useState } from 'react';
import { X, Upload, FileText, Trash2 } from 'lucide-react';
import { gedApi } from '../../api/ged.api';
import { EntityType, DocumentType } from '../../types/ged.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  entityId: string;
  onSuccess?: () => void;
}

export default function BulkUploadModal({ isOpen, onClose, entityType, entityId, onSuccess }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.OTHER);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles].slice(0, 20));
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setLoading(true);
    try {
      await gedApi.bulkUpload(files, { entityType, entityId, documentType });
      onSuccess?.();
      onClose();
      setFiles([]);
    } catch (error) {
      console.error('Bulk upload failed:', error);
      alert('Échec du téléchargement groupé');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Téléchargement groupé (max 20 fichiers)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Type de document *</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              <option value={DocumentType.OTHER}>Autre</option>
              <option value={DocumentType.SLIP_COTATION}>Slip de cotation</option>
              <option value={DocumentType.BORDEREAU_CESSION}>Bordereau de cession</option>
              <option value={DocumentType.AVIS_SINISTRE}>Avis de sinistre</option>
              <option value={DocumentType.PAYMENT_ORDER}>Ordre de paiement</option>
              <option value={DocumentType.CORRESPONDENCE}>Correspondance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Fichiers ({files.length}/20)</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="mx-auto h-10 w-10 text-gray-400" />
              <label className="mt-2 inline-block cursor-pointer">
                <span className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Sélectionner des fichiers
                </span>
                <input
                  type="file"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={files.length >= 20}
                />
              </label>
              <p className="text-sm text-gray-500 mt-2">Maximum 20 fichiers, 100MB par fichier</p>
            </div>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Fichiers sélectionnés:</h3>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div className="flex items-center gap-2 flex-1">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm truncate">{file.name}</span>
                      <span className="text-xs text-gray-500">{formatFileSize(file.size)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={files.length === 0 || loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              {loading ? 'Téléchargement...' : `Télécharger ${files.length} fichier(s)`}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border rounded-lg hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
