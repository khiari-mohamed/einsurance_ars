import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, Trash2, FileText, Loader2 } from 'lucide-react';
import gedApi from '../../api/ged.api';
import { DocumentEntityType, KNOWN_DOCUMENT_TYPES } from '../../types/ged.types';
import type { DocumentLink } from '../../types/ged.types';

interface Props {
  sinistreId: string;
}

// Curated subset of KNOWN_DOCUMENT_TYPES relevant to a claim file — the
// backend accepts any string, this is purely for a sensible <select>.
const SINISTRE_DOCUMENT_TYPES = [
  'AVIS_SINISTRE', 'EXPERT_REPORT', 'PAYMENT_JUSTIFICATION',
  'BANK_STATEMENT', 'SWIFT_CONFIRMATION', 'OTHER',
] as const satisfies readonly (typeof KNOWN_DOCUMENT_TYPES)[number][];

const TYPE_LABELS: Record<string, string> = {
  AVIS_SINISTRE: 'Avis de Sinistre',
  EXPERT_REPORT: "Rapport d'Expertise",
  PAYMENT_JUSTIFICATION: 'Preuve de Paiement',
  BANK_STATEMENT: 'Relevé Bancaire',
  SWIFT_CONFIRMATION: 'Confirmation SWIFT',
  OTHER: 'Autre',
};

export default function SinistreDocuments({ sinistreId }: Props) {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string>('AVIS_SINISTRE');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: links, isLoading } = useQuery({
    queryKey: ['sinistre-documents', sinistreId],
    queryFn: () => gedApi.getSinistreDocuments(sinistreId),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!selectedFile) throw new Error('Aucun fichier sélectionné');
      return gedApi.uploadDocument(selectedFile, {
        entityType: DocumentEntityType.SINISTRE,
        entityId: sinistreId,
        documentType: selectedType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-documents', sinistreId] });
      setSelectedFile(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => gedApi.deleteDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-documents', sinistreId] });
    },
  });

  const handleDownload = async (documentId: string, fileName: string) => {
    const blob = await gedApi.downloadDocument(documentId);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const rows: DocumentLink[] = links?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="font-semibold mb-4">Ajouter un document</h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Type de document</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {SINISTRE_DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>{TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">Fichier</label>
            <input
              type="file"
              onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              className="w-full border rounded-lg px-3 py-2"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
            />
          </div>
          <button
            onClick={() => uploadMutation.mutate()}
            disabled={!selectedFile || uploadMutation.isPending}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {uploadMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {uploadMutation.isPending ? 'Envoi...' : 'Ajouter'}
          </button>
        </div>
        {uploadMutation.isError && (
          <p className="text-sm text-red-600 mt-2">
            {(uploadMutation.error as any)?.response?.data?.message ?? "Échec de l'envoi du document"}
          </p>
        )}
      </div>

      <div>
        <h3 className="font-semibold mb-4">Documents ({rows.length})</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            Aucun document
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((link) => {
              const doc = link.document;
              if (!doc) return null;
              const displayName = doc.originalName ?? doc.nom;
              return (
                <div key={link.id} className="flex items-center justify-between p-4 bg-white border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="text-blue-600 shrink-0" size={24} />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{displayName}</div>
                      <div className="text-sm text-gray-600">
                        {TYPE_LABELS[doc.documentType ?? ''] ?? doc.documentType ?? 'Autre'}
                        {' · '}{formatFileSize(doc.sizeBytes)}
                        {' · '}{new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                        {doc.versionNumber > 1 && ` · v${doc.versionNumber}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleDownload(doc.id, displayName)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                      title="Télécharger"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Supprimer « ${displayName} » ?`)) deleteMutation.mutate(doc.id);
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}