import { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Upload, FileText, AlertCircle, Download } from 'lucide-react';
import { toast } from 'sonner';

interface DocumentChecklistProps {
  affaireId: string;
  affaireNumero: string;
  category: 'facultative' | 'traitee';
  reassureurs?: Array<{ id: string; raisonSociale: string }>;
}

interface DocumentItem {
  type: string;
  label: string;
  required: boolean;
  status: 'manquant' | 'en_attente' | 'recu';
  fileUrl?: string;
  uploadedAt?: string;
  uploadedBy?: string;
}

export default function DocumentChecklist({
  affaireId,
  affaireNumero,
  reassureurs = [],
}: DocumentChecklistProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChecklist();
  }, [affaireId]);

  const fetchChecklist = async () => {
    try {
      const res = await fetch(`/api/ged/checklist/${affaireId}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      } else {
        initializeChecklist();
      }
    } catch (error) {
      initializeChecklist();
    } finally {
      setLoading(false);
    }
  };

  const initializeChecklist = () => {
    const baseDocuments: DocumentItem[] = [
      { type: 'note_synthese', label: 'Note de Synthèse', required: true, status: 'manquant' },
      { type: 'slip_cotation', label: 'Slip de Cotation', required: true, status: 'manquant' },
      { type: 'ordre_assurance', label: 'Ordre d\'Assurance (signé)', required: true, status: 'manquant' },
      { type: 'slip_couverture', label: 'Slip de Couverture (signé)', required: true, status: 'manquant' },
      { type: 'bordereau_cedante', label: 'Bordereau de Cession Cédante', required: true, status: 'manquant' },
      { type: 'convention_cedante', label: 'Convention Cédante', required: true, status: 'manquant' },
    ];

    reassureurs.forEach((r) => {
      baseDocuments.push({
        type: `bordereau_reassureur_${r.id}`,
        label: `Bordereau Cession ${r.raisonSociale}`,
        required: true,
        status: 'manquant',
      });
      baseDocuments.push({
        type: `convention_reassureur_${r.id}`,
        label: `Convention ${r.raisonSociale}`,
        required: true,
        status: 'manquant',
      });
    });

    setDocuments(baseDocuments);
  };

  const handleFileUpload = async (docType: string, file: File) => {
    setUploading(docType);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('affaireId', affaireId);
    formData.append('documentType', docType);

    try {
      const res = await fetch('/api/ged/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setDocuments(
          documents.map((doc) =>
            doc.type === docType
              ? {
                  ...doc,
                  status: 'recu',
                  fileUrl: data.fileUrl,
                  uploadedAt: new Date().toISOString(),
                }
              : doc
          )
        );
        toast.success('Document téléchargé avec succès');
      } else {
        toast.error('Erreur lors du téléchargement');
      }
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    } finally {
      setUploading(null);
    }
  };

  const getCompletionPercentage = () => {
    const total = documents.filter((d) => d.required).length;
    const completed = documents.filter((d) => d.required && d.status === 'recu').length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'recu':
        return <CheckCircle2 className="text-green-600" size={20} />;
      case 'en_attente':
        return <AlertCircle className="text-orange-600" size={20} />;
      default:
        return <Circle className="text-gray-400" size={20} />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      recu: 'bg-green-100 text-green-800',
      en_attente: 'bg-orange-100 text-orange-800',
      manquant: 'bg-gray-100 text-gray-800',
    };
    const labels = {
      recu: 'Reçu',
      en_attente: 'En attente',
      manquant: 'Manquant',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const completionPercentage = getCompletionPercentage();

  if (loading) {
    return <div className="p-6 text-center">Chargement...</div>;
  }

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
        {documents.map((doc) => (
          <div
            key={doc.type}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3 flex-1">
              {getStatusIcon(doc.status)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{doc.label}</p>
                  {doc.required && <span className="text-red-500 text-xs">*</span>}
                </div>
                {doc.uploadedAt && (
                  <p className="text-xs text-gray-500">
                    Téléchargé le {new Date(doc.uploadedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {getStatusBadge(doc.status)}

              {doc.status === 'recu' && doc.fileUrl ? (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                >
                  <Download size={18} />
                </a>
              ) : (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(doc.type, file);
                    }}
                    disabled={uploading === doc.type}
                  />
                  <div className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Upload size={18} />
                    {uploading === doc.type ? (
                      <span className="text-xs">Upload...</span>
                    ) : (
                      <span className="text-xs">Upload</span>
                    )}
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
            {documents.filter((d) => d.status === 'recu').length} / {documents.length} documents reçus
          </span>
          {completionPercentage === 100 && (
            <span className="ml-auto text-green-600 font-semibold">✓ Checklist complète</span>
          )}
        </div>
      </div>
    </div>
  );
}
