import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, DollarSign } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import affairesApi from '@/api/affaires.api';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';

interface Props {
  affaireId: string;
  onComplete?: () => void;
}

// FIX (Finances pass): full rewrite. The real POST /finances/four-step/
// :affaireId does EVERYTHING atomically server-side — resolves the FX
// rate, computes step1's net amount, creates a decaissement (+ an
// auto-generated ordre de paiement, when the reinsurer has a usable
// default bank account) per reinsurer, and records the ARS commission
// encaissement. There is nothing left for a 4-screen manual wizard to
// collect — this collapses to a preview + one confirm button, then
// displays exactly what the backend created.
export default function FourStepPaymentWizard({ affaireId, onComplete }: Props) {
  const [result, setResult] = useState<any>(null);

  const { data: affaire } = useQuery({
    queryKey: ['affaire-for-4step', affaireId],
    queryFn: async () => (await affairesApi.getOne(affaireId)).data,
  });

  const executeMutation = useMutation({
    mutationFn: () => financesApi.executeFourStepPayment(affaireId),
    onSuccess: ({ data }) => { setResult(data); toast.success('Flux de paiement exécuté'); onComplete?.(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur lors de l\'exécution'),
  });

  if (!affaire) return <div className="p-6 text-gray-500">Chargement...</div>;

  const totalArsCommission = affaire.reassureurs.reduce((s: number, r: any) => s + (r.commissionArs ?? 0), 0);

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Flux de Paiement 4 Étapes</h2>
        <p className="text-gray-600">Affaire {affaire.numero} — {affaire.cedante?.raisonSociale}</p>
      </div>

      {affaire.modePaiement !== 'PAR_AFFAIRE' && (
        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-sm text-red-800">
          Cette affaire est réglée par situation (batch netting) — le flux 4 étapes ne s'applique qu'au mode "Par Affaire".
        </div>
      )}

      <div className="p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-600">Prime cédée</span><span className="font-semibold">{formatCurrency(affaire.facultativeData?.primeCedee ?? 0, affaire.currency)}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Commission cédante</span><span className="font-semibold">{formatCurrency(affaire.facultativeData?.commissionCedante ?? 0, affaire.currency)}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Commission ARS (total)</span><span className="font-semibold text-purple-600">{formatCurrency(totalArsCommission, affaire.currency)}</span></div>
        <div className="border-t pt-2 flex justify-between"><span className="text-gray-600">Réassureurs</span><span className="font-semibold">{affaire.reassureurs.length}</span></div>
      </div>

      {!result ? (
        <button
          onClick={() => executeMutation.mutate()}
          disabled={executeMutation.isPending || affaire.modePaiement !== 'PAR_AFFAIRE'}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          <DollarSign size={18} />
          {executeMutation.isPending ? 'Exécution en cours...' : 'Exécuter le flux 4 étapes'}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-green-700 font-medium"><CheckCircle size={20} /> Flux exécuté — taux appliqué : {result.tauxApplique}</div>
          {result.steps.map((s: any, i: number) => (
            <div key={i} className={`p-3 rounded-lg text-sm flex items-center justify-between ${s.type === 'WARNING' ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                {s.type === 'WARNING' ? <AlertTriangle size={16} className="text-amber-600" /> : <CheckCircle size={16} className="text-green-600" />}
                <span>Étape {s.step} — {s.type}{s.reassureur ? ` (${s.reassureur})` : ''}{s.message ? `: ${s.message}` : ''}</span>
              </div>
              {s.montant != null && <span className="font-semibold">{formatCurrency(s.montant, affaire.currency)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}