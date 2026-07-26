import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
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

// FIX (Finances pass): full rewrite. SWIFT confirmation attaches to
// OrdrePaiement (PATCH /finances/ordres-paiement/:id/swift, body
// {swiftDocumentId}), not Decaissement — the old component's prop was
// paymentId used against a decaissement-shaped fictional route
// ('/api/finances/payments/:id/swift-confirmed') that doesn't exist.
//
// NOTE: the actual file upload (turning a chosen PDF/image into a Document
// id to pass as swiftDocumentId) depends on the GED module's upload
// endpoint, which wasn't part of this review — ged.api.ts/uploads.api.ts
// weren't provided. Rather than guess at that contract, this component
// exposes a manual "Document ID" field for now (for a document already
// uploaded via GED) and documents exactly where the real upload call needs
// to be wired in once that module is reviewed.
export default function SWIFTUpload({ ordrePaiementId, reference, montant, currency, beneficiaire, onDone }: Props) {
  const [documentId, setDocumentId] = useState('');

  const attachMutation = useMutation({
    mutationFn: () => financesApi.attachSwift(ordrePaiementId, documentId),
    onSuccess: () => { toast.success('Confirmation SWIFT attachée'); onDone?.(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="text-blue-600" size={24} />
        <div>
          <h3 className="font-semibold">Ordre {reference}</h3>
          <p className="text-sm text-gray-600">{beneficiaire} — {formatCurrency(montant, currency)}</p>
        </div>
      </div>

      <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded flex items-start gap-2">
        <AlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
        <div className="text-sm">
          <p className="font-semibold text-amber-800">Document à téléverser via la GED d'abord</p>
          <p className="text-amber-700">
            Téléversez la confirmation SWIFT dans la Gestion Électronique des Documents, puis collez son identifiant ci-dessous.
          </p>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">Identifiant du document (GED)</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm font-mono mt-1"
          value={documentId}
          onChange={(e) => setDocumentId(e.target.value)}
          placeholder="uuid du document"
        />
      </div>

      <button
        onClick={() => attachMutation.mutate()}
        disabled={!documentId || attachMutation.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        <CheckCircle size={16} />
        {attachMutation.isPending ? 'Enregistrement...' : 'Confirmer la réception SWIFT'}
      </button>
    </div>
  );
}