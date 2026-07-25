import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, Download, Trash2 } from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import type { BordereauDocumentType } from '../../types/bordereau.types';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

interface Props { bordereauId: string }

// Curated subset of ged.types.ts DocumentType relevant to bordereau attachments
const DOCUMENT_TYPES: { value: BordereauDocumentType; label: string }[] = [
  { value: 'swift_confirmation', label: 'Confirmation SWIFT' },
  { value: 'bank_statement', label: 'Relevé Bancaire' },
  { value: 'payment_justification', label: 'Justificatif de Paiement' },
  { value: 'settlement_statement', label: 'État de Règlement' },
  { value: 'correspondence', label: 'Correspondance' },
  { value: 'other', label: 'Autre' },
];

export default function BordereauDocuments({ bordereauId }: Props) {
  const queryClient = useQueryClient();
  const [uploadModal, setUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState<{ file: File | null; type: BordereauDocumentType; description: string }>({
    file: null, type: 'payment_justification', description: '',
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ['bordereau-documents', bordereauId],
    queryFn: () => bordereauxApi.getDocuments(bordereauId),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!uploadData.file) throw new Error('Aucun fichier sélectionné');
      return bordereauxApi.uploadDocument(bordereauId, uploadData.file, uploadData.type, uploadData.description);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau-documents', bordereauId] });
      queryClient.invalidateQueries({ queryKey: ['bordereau', bordereauId] });
      setUploadModal(false);
      setUploadData({ file: null, type: 'payment_justification', description: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentLinkId: string) => bordereauxApi.deleteDocument(bordereauId, documentLinkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau-documents', bordereauId] });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { alert('Le fichier ne doit pas dépasser 10 MB'); return; }
      setUploadData({ ...uploadData, file });
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadData.file) { alert('Veuillez sélectionner un fichier'); return; }
    uploadMutation.mutate();
  };

  const formatFileSize = (bytes = 0) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const rows = documents?.data ?? [];

  if (isLoading) {
    return <Card className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div><p className="mt-4 text-gray-600">Chargement...</p></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Documents Attachés</h3>
        <Button onClick={() => setUploadModal(true)} className="gap-2"><Upload size={18} /> Ajouter un Document</Button>
      </div>

      {rows.length > 0 ? (
        <div className="grid gap-3">
          {rows.map((link) => (
            <Card key={link.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-blue-100 rounded-lg"><FileText className="text-blue-600" size={24} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{link.document.originalName ?? link.document.nom}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                      {link.document.documentType && <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">{link.document.documentType}</span>}
                      <span>•</span><span>{formatFileSize(link.document.sizeBytes)}</span>
                      <span>•</span><span>{new Date(link.document.createdAt).toLocaleDateString('fr-FR')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" title="Supprimer" onClick={() => { if (confirm('Retirer ce document ?')) deleteMutation.mutate(link.id); }}>
                    <Trash2 size={16} className="text-red-500" />
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
          <Button onClick={() => setUploadModal(true)} variant="outline" className="mt-4 gap-2"><Upload size={18} /> Ajouter le premier document</Button>
        </Card>
      )}

      {uploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-4">Ajouter un Document</h3>
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Fichier <span className="text-red-500">*</span></label>
                  <input type="file" onChange={handleFileSelect} className="w-full border rounded-lg px-3 py-2" accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls" required />
                  <p className="text-xs text-gray-500 mt-1">Formats acceptés: PDF, JPEG, PNG, Excel (max 10 MB)</p>
                  {uploadData.file && <p className="text-sm text-green-600 mt-2">✓ {uploadData.file.name} ({formatFileSize(uploadData.file.size)})</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Type de Document <span className="text-red-500">*</span></label>
                  <select value={uploadData.type} onChange={(e) => setUploadData({ ...uploadData, type: e.target.value as BordereauDocumentType })} className="w-full border rounded-lg px-3 py-2" required>
                    {DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea value={uploadData.description} onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })} className="w-full border rounded-lg px-3 py-2" rows={3} />
                </div>
                <div className="flex gap-3 pt-4 border-t">
                  <Button type="submit" className="flex-1" disabled={uploadMutation.isPending || !uploadData.file}>
                    {uploadMutation.isPending ? 'Upload en cours...' : 'Ajouter'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => { setUploadModal(false); setUploadData({ file: null, type: 'payment_justification', description: '' }); }} disabled={uploadMutation.isPending}>
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