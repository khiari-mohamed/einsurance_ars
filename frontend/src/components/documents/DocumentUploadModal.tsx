import { useState } from 'react';
import { X, Upload, File } from 'lucide-react';
import { gedApi } from '../../api/ged.api';
import { EntityType, DocumentType, ConfidentialityLevel } from '../../types/ged.types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  entityType: EntityType;
  entityId: string;
  onSuccess?: () => void;
}

export default function DocumentUploadModal({ isOpen, onClose, entityType, entityId, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>(DocumentType.OTHER);
  const [confidentialityLevel, setConfidentialityLevel] = useState<ConfidentialityLevel>(ConfidentialityLevel.INTERNAL);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    try {
      await gedApi.uploadDocument(file, {
        entityType,
        entityId,
        documentType,
        confidentialityLevel,
        description: description || undefined,
        tags: tags ? tags.split(',').map(t => t.trim()) : undefined,
      });
      onSuccess?.();
      onClose();
      setFile(null);
      setDescription('');
      setTags('');
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Échec du téléchargement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Télécharger un document</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Fichier *</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <File className="w-5 h-5 text-blue-600" />
                  <span className="text-sm">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-red-600 text-sm ml-2"
                  >
                    Supprimer
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-10 w-10 text-gray-400" />
                  <label className="mt-2 inline-block cursor-pointer">
                    <span className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                      Sélectionner un fichier
                    </span>
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Type de document *</label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value as DocumentType)}
              className="w-full border rounded-lg px-3 py-2"
              required
            >
              <option value={DocumentType.OTHER}>Autre</option>
              <option value={DocumentType.NOTE_SYNTHESE}>Note de synthèse</option>
              <option value={DocumentType.SLIP_COTATION}>Slip de cotation</option>
              <option value={DocumentType.SLIP_COUVERTURE}>Slip de couverture</option>
              <option value={DocumentType.BORDEREAU_CESSION}>Bordereau de cession</option>
              <option value={DocumentType.AVIS_SINISTRE}>Avis de sinistre</option>
              <option value={DocumentType.PAYMENT_ORDER}>Ordre de paiement</option>
              <option value={DocumentType.SWIFT_CONFIRMATION}>Confirmation SWIFT</option>
              <option value={DocumentType.CORRESPONDENCE}>Correspondance</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Niveau de confidentialité</label>
            <select
              value={confidentialityLevel}
              onChange={(e) => setConfidentialityLevel(e.target.value as ConfidentialityLevel)}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value={ConfidentialityLevel.PUBLIC}>Public</option>
              <option value={ConfidentialityLevel.INTERNAL}>Interne</option>
              <option value={ConfidentialityLevel.CONFIDENTIAL}>Confidentiel</option>
              <option value={ConfidentialityLevel.SECRET}>Secret</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Tags (séparés par des virgules)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="urgent, contrat, 2024"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={!file || loading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
            >
              {loading ? 'Téléchargement...' : 'Télécharger'}
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
