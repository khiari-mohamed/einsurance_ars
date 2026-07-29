import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, X } from 'lucide-react';
import { gedApi } from '@/api/ged.api';
import { financesApi } from '@/api/finances.api';
import { DocumentEntityType } from '@/types/ged.types';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';

interface Props {
  ordrePaiementId: string;
  reference: string;
  montant: number;
  currency: string;
  beneficiaire: string;
  onDone?: () => void;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// FIX (SWIFT/GED gap): now does a real upload instead of asking the user
// to paste a document id they don't have. Uploads via gedApi.uploadDocument
// with ordrePaiementId (the backend resolves DocumentEntityType.
// ORDRE_PAIEMENT from that FK automatically), then attaches the returned
// Document.id to the ordre via financesApi.attachSwift — completing the
// path end to end.
export default function SWIFTUpload({ ordrePaiementId, reference, montant, currency, beneficiaire, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null);

  const uploadAndAttach = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Aucun fichier sélectionné');
      const document = await gedApi.uploadDocument(file, {
        entityType: DocumentEntityType.ORDRE_PAIEMENT,
        entityId: ordrePaiementId,
        documentType: 'SWIFT_CONFIRMATION',
      });
      await financesApi.attachSwift(ordrePaiementId, document.id);
      return document;
    },
    onSuccess: () => {
      toast.success('Confirmation SWIFT attachée avec succès');
      onDone?.();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || err.message || 'Erreur lors de l\'envoi'),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!ACCEPTED_TYPES.includes(f.type)) {
      toast.error('Format non supporté. Utilisez PDF, JPG ou PNG');
      return;
    }
    if (f.size > MAX_SIZE_BYTES) {
      toast.error('Fichier trop volumineux (max 5MB)');
      return;
    }
    setFile(f);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="text-blue-600" size={24} />
        <div>
          <h3 className="font-semibold">Ordre {reference}</h3>
          <p className="text-sm text-gray-600">{beneficiaire} — {formatCurrency(montant, currency)}</p>
        </div>
      </div>

      {!file ? (
        <label className="block">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
            <Upload className="mx-auto mb-2 text-gray-400" size={32} />
            <p className="text-sm font-medium text-gray-700">Cliquez pour sélectionner le fichier SWIFT</p>
            <p className="text-xs text-gray-500 mt-1">PDF, JPG ou PNG (max 5MB)</p>
          </div>
          <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} />
        </label>
      ) : (
        <div className="border rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText className="text-blue-600" size={24} />
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            <button onClick={() => setFile(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={18} /></button>
          </div>
          <button
            onClick={() => uploadAndAttach.mutate()}
            disabled={uploadAndAttach.isPending}
            className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <CheckCircle size={16} />
            {uploadAndAttach.isPending ? 'Envoi...' : 'Téléverser et confirmer la réception SWIFT'}
          </button>
        </div>
      )}
    </div>
  );
}