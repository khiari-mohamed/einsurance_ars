import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Circle, Upload, FileText, AlertCircle, XCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { gedApi } from '../../api/ged.api';
import { extractErrorMessage } from '../../lib/api';

interface DocumentChecklistProps {
  affaireId: string;
  affaireNumero: string;
  category: 'facultative' | 'traitee';
}

// Mirrors DocumentChecklistItem / DocumentChecklist from the backend
// (DocumentStatut enum values, uppercase — see server prisma schema).
type ChecklistStatut = 'MANQUANT' | 'EN_ATTENTE' | 'RECU' | 'REJETE';

interface ChecklistItem {
  id: string;
  documentType: string;
  libelle: string;
  isMandatory: boolean;
  statut: ChecklistStatut;
  documentId?: string | null;
  receivedAt?: string | null;
  ordre: number;
}

interface Checklist {
  id: string;
  affaireId: string;
  completionPct: number;
  items: ChecklistItem[];
}

export default function DocumentChecklist({ affaireId, affaireNumero }: DocumentChecklistProps) {
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gedApi.getChecklist(affaireId);
      setChecklist(data);
    } catch (err) {
      // FIX: previously fell back to a hand-guessed, hardcoded checklist
      // built client-side (initializeChecklist()). That silently diverged
      // from the authoritative server-side checklist (document types,
      // labels, and — critically — which reinsurer-specific slots actually
      // exist per CDC §5.7/§10.2), so an upload could match nothing and the
      // completion % would never reflect reality. A missing checklist is a
      // real state to surface, not paper over.
      setChecklist(null);
      setError(extractErrorMessage(err, 'Checklist introuvable pour cette affaire'));
    } finally {
      setLoading(false);
    }
  }, [affaireId]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const handleFileUpload = async (item: ChecklistItem, file: File) => {
    if (!checklist) return;
    setUploadingItemId(item.id);
    try {
      const uploaded = await gedApi.uploadDocument(file, {
        affaireId,
        documentType: item.documentType,
        entityType: 'AFFAIRE',
      } as any);

      await gedApi.markItemReceived(checklist.id, item.id, uploaded.id);
      toast.success('Document téléchargé avec succès');
      await fetchChecklist();
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Erreur lors du téléchargement'));
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleDownload = async (item: ChecklistItem) => {
    if (!item.documentId) return;
    try {
      const blob = await gedApi.downloadDocument(item.documentId);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Release the blob URL once the new tab has had a chance to load it.
      setTimeout(() => window.URL.revokeObjectURL(url), 30_000);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Erreur lors du téléchargement'));
    }
  };

  // FIX: local status strings were lowercase ('recu' | 'en_attente' |
  // 'manquant') and didn't include 'REJETE' at all, while the backend's
  // DocumentStatut enum is uppercase with 4 values — icons/badges would
  // never have matched real data, and rejected documents had no visual
  // treatment whatsoever.
  const getStatusIcon = (statut: ChecklistStatut) => {
    switch (statut) {
      case 'RECU':
        return <CheckCircle2 className="text-green-600" size={20} />;
      case 'EN_ATTENTE':
        return <AlertCircle className="text-orange-600" size={20} />;
      case 'REJETE':
        return <XCircle className="text-red-600" size={20} />;
      default:
        return <Circle className="text-gray-400" size={20} />;
    }
  };

  const getStatusBadge = (statut: ChecklistStatut) => {
    const styles: Record<ChecklistStatut, string> = {
      RECU: 'bg-green-100 text-green-800',
      EN_ATTENTE: 'bg-orange-100 text-orange-800',
      REJETE: 'bg-red-100 text-red-800',
      MANQUANT: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<ChecklistStatut, string> = {
      RECU: 'Reçu',
      EN_ATTENTE: 'En attente',
      REJETE: 'Rejeté',
      MANQUANT: 'Manquant',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[statut]}`}>
        {labels[statut]}
      </span>
    );
  };

  if (loading) {
    return <div className="p-6 text-center">Chargement...</div>;
  }

  if (error || !checklist) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 text-center text-gray-600">
        <AlertCircle className="mx-auto mb-2 text-orange-500" size={28} />
        <p>{error ?? 'Checklist introuvable pour cette affaire.'}</p>
      </div>
    );
  }

  const completionPercentage = Math.round(checklist.completionPct);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold">Checklist Documentaire</h3>
          <p className="text-sm text-gray-600">Affaire: {affaireNumero}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-blue-600">{completionPercentage}%</div>
          <p className="text-xs text-gray-600">Complétude</p>
        </div>
      </div>

      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {checklist.items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              {getStatusIcon(item.statut)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{item.libelle}</p>
                  {item.isMandatory && <span className="text-red-500 text-xs">*</span>}
                </div>
                {item.receivedAt && (
                  <p className="text-xs text-gray-500">
                    Téléchargé le {new Date(item.receivedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {getStatusBadge(item.statut)}

              {item.statut === 'RECU' && item.documentId ? (
                <button
                  type="button"
                  onClick={() => handleDownload(item)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Download size={18} />
                </button>
              ) : (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(item, file);
                      // Reset so re-selecting the same file re-fires onChange
                      e.target.value = '';
                    }}
                    disabled={uploadingItemId === item.id}
                  />
                  <div className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Upload size={18} />
                    <span className="text-xs">
                      {uploadingItemId === item.id ? 'Upload...' : 'Upload'}
                    </span>
                  </div>
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2 text-sm">
          <FileText className="text-blue-600" size={18} />
          <span className="font-medium">
            {checklist.items.filter((d) => d.statut === 'RECU').length} / {checklist.items.length} documents reçus
          </span>
          {completionPercentage === 100 && (
            <span className="ml-auto text-green-600 font-semibold">✓ Checklist complète</span>
          )}
        </div>
      </div>
    </div>
  );
}