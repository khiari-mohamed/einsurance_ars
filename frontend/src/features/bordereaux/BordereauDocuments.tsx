import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Download, Eye } from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import type { DocumentType } from '../../types/bordereau.types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';


interface BordereauDocumentsProps {
  bordereauId: string;
}

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'bulletin_soin', label: 'Bulletin de Soin' },
  { value: 'facture', label: 'Facture' },
  { value: 'ordre_paiement', label: 'Ordre de Paiement' },
  { value: 'releve_bancaire', label: 'Relevé Bancaire' },
  { value: 'correspondance', label: 'Correspondance' },
  { value: 'contrat', label: 'Contrat' },
  { value: 'avis_sinistre', label: 'Avis de Sinistre' },
  { value: 'autre', label: 'Autre' },
];

export default function BordereauDocuments({ bordereauId }: BordereauDocumentsProps) {
  const queryClient = useQueryClient();
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState({
    file: null as File | null,
    type: 'facture' as DocumentType,
    description: '',
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ['bordereau-documents', bordereauId],
    queryFn: () => bordereauxApi.getDocuments(bordereauId),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!uploadData.file) throw new Error('No file selected');
      return bordereauxApi.addDocument(
        bordereauId,
        uploadData.file,
        uploadData.type,
        uploadData.description
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau-documents', bordereauId] });
      queryClient.invalidateQueries({ queryKey: ['bordereau', bordereauId] });
      setUploadModal(false);
      setUploadData({ file: null, type: 'facture', description: '' });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        alert('Le fichier ne doit pas dépasser 10 MB');
        return;
      }
      setUploadData({ ...uploadData, file });
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.file) {
      alert('Veuillez sélectionner un fichier');
      return;
    }
    uploadMutation.mutate();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getDocumentTypeLabel = (type: DocumentType) => {
    return DOCUMENT_TYPES.find(t => t.value === type)?.label || type;
  };

  if (isLoading) {
    return (
      <Card className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Chargement des documents...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Documents Attachés</h3>
        <Button onClick={() => setUploadModal(true)} className="gap-2">
          <Upload size={18} />
          Ajouter un Document
        </Button>
      </div>

      {documents?.data && documents.data.length > 0 ? (
        <div className="grid gap-3">
          {documents.data.map((doc: any) => (
            <Card key={doc.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="text-blue-600" size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.nomFichier}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{getDocumentTypeLabel(doc.type)}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.taille)}</span>
                      <span>•</span>
                      <span>{new Date(doc.uploadedAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                    {doc.description && (
                      <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      // Open document in new tab
                      window.open(doc.cheminS3, '_blank');
                    }}
                    title="Voir"
                  >
                    <Eye size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      // Download document
                      const a = document.createElement('a');
                      a.href = doc.cheminS3;
                      a.download = doc.nomFichier;
                      a.click();
                    }}
                    title="Télécharger"
                  >
                    <Download size={16} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <FileText className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-600">Aucun document attaché</p>
          <Button
            onClick={() => setUploadModal(true)}
            variant="outline"
            className="mt-4 gap-2"
          >
            <Upload size={18} />
            Ajouter le premier document
          </Button>
        </Card>
      )}

      {/* Upload Modal */}
      {uploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">Ajouter un Document</h3>
              
              <form onSubmit={handleUpload} className="space-y-4">
                {/* File Input */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Fichier <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="w-full border rounded-lg px-3 py-2"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Formats acceptés: PDF, JPEG, PNG, Excel (max 10 MB)
                  </p>
                  {uploadData.file && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ {uploadData.file.name} ({formatFileSize(uploadData.file.size)})
                    </p>
                  )}
                </div>

                {/* Document Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Type de Document <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={uploadData.type}
                    onChange={(e) => setUploadData({ ...uploadData, type: e.target.value as DocumentType })}
                    className="w-full border rounded-lg px-3 py-2"
                    required
                  >
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Description
                  </label>
                  <textarea
                    value={uploadData.description}
                    onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={3}
                    placeholder="Description du document..."
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={uploadMutation.isPending || !uploadData.file}
                  >
                    {uploadMutation.isPending ? 'Upload en cours...' : 'Ajouter'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setUploadModal(false);
                      setUploadData({ file: null, type: 'facture', description: '' });
                    }}
                    disabled={uploadMutation.isPending}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
