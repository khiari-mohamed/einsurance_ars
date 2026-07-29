import { useNavigate } from 'react-router-dom';
import { FileText, ArrowRight } from 'lucide-react';

// RETIRED (Sinistres pass): this component previously called
// sinistresApi.generateBordereau()/generateBordereauPDF() — both were
// hardcoded fake stubs (Promise.resolve with empty data) that never hit a
// real backend, and both methods were removed entirely when sinistres.api.ts
// was rebuilt against the real SinistresController contract.
//
// The real capability already exists: BordereauxService.generate() with
// type: 'SINISTRE_FACULTATIVE' builds a genuine bordereau from a single
// affaire's settled claims (see bordereaux.service.ts). That flow lives in
// the Bordereaux module itself (BordereauGenerateModal.tsx), not here —
// this component's old UI (cedante + free date-range, no affaire selection)
// doesn't match how the real endpoint is scoped (one affaireId, required).
//
// Not wired into App.tsx or features/sinistres/index.ts — kept only so the
// file compiles if anything still references it. Safe to delete.
export default function SinistreBordereau() {
  const navigate = useNavigate();

  return (
    <div className="p-8">
      <div className="max-w-lg mx-auto text-center bg-white rounded-lg shadow p-8">
        <FileText className="mx-auto text-blue-500 mb-4" size={40} />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Génération de bordereau sinistre
        </h2>
        <p className="text-gray-600 mb-6">
          La génération de bordereaux (y compris pour les sinistres facultatifs)
          se fait désormais depuis le module Bordereaux, à partir d'une affaire
          spécifique.
        </p>
        <button
          onClick={() => navigate('/bordereaux')}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700"
        >
          Aller au module Bordereaux
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}