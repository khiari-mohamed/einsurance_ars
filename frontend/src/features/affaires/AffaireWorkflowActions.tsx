import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowLeft, AlertCircle, RotateCcw } from 'lucide-react';
import { affairesApi } from '../../api/affaires.api';
import { Affaire, AffaireStatut, AffaireType, statutLabels } from '../../types/affaire.types';

// FIX (Workflow pass): full rewrite. The old version called
// sendToCotation/receiveSlip/updateStatus(oldEnum)/generateBordereauCedante/
// generateAccountingEntries — none of which exist on the real
// AffairesController (only GET/POST/PUT/PATCH :id/status/POST
// :id/recalculate-commissions/DELETE do). This mirrors the real 3-state
// TRANSITIONS map from AffaireWorkflowService exactly, so the UI only ever
// offers moves the backend will actually accept.
const TRANSITIONS: Record<AffaireStatut, AffaireStatut[]> = {
  [AffaireStatut.EN_COTATION]: [AffaireStatut.PREVISION],
  [AffaireStatut.PREVISION]: [AffaireStatut.PLACEMENT_REALISE, AffaireStatut.EN_COTATION],
  [AffaireStatut.PLACEMENT_REALISE]: [],
};

interface Props {
  affaire: Affaire;
}

export default function AffaireWorkflowActions({ affaire }: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const statusMutation = useMutation({
    mutationFn: (statut: AffaireStatut) => affairesApi.changeStatus(affaire.id, statut),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affaire', affaire.id] });
      queryClient.invalidateQueries({ queryKey: ['affaires'] });
      setError('');
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' ') : (msg || 'Transition refusée.'));
    },
  });

  const recalcMutation = useMutation({
    mutationFn: () => affairesApi.recalculateCommissions(affaire.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['affaire', affaire.id] }),
  });

  const nextOptions = TRANSITIONS[affaire.statut] ?? [];

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Statut actuel</p>
        <p className="text-[14px] font-semibold text-gray-900">{statutLabels[affaire.statut]}</p>
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700 flex items-start gap-2">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {nextOptions.length === 0 ? (
        <p className="text-[12px] text-gray-400">Statut terminal — aucune transition possible.</p>
      ) : (
        <div className="space-y-2">
          {nextOptions.map((target) => {
            const isForward = target !== AffaireStatut.EN_COTATION;
            return (
              <button
                key={target}
                onClick={() => statusMutation.mutate(target)}
                disabled={statusMutation.isPending}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-50 ${
                  isForward ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {isForward ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                {statusMutation.isPending ? 'Traitement...' : `${isForward ? 'Passer à' : 'Revenir à'} : ${statutLabels[target]}`}
              </button>
            );
          })}
        </div>
      )}

      {affaire.type === AffaireType.FACULTATIVE && (
        <button
          onClick={() => recalcMutation.mutate()}
          disabled={recalcMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-[13px] font-medium disabled:opacity-50"
        >
          <RotateCcw size={16} />
          {recalcMutation.isPending ? 'Recalcul...' : 'Recalculer les commissions'}
        </button>
      )}

      <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100">
        Le passage en <strong>Prévision</strong> exige que les participations réassureurs totalisent 100%.
        Le passage en <strong>Placement Réalisé</strong> exige en plus des dates d'effet/échéance complètes
        et verrouille définitivement l'affaire.
      </p>
    </div>
  );
}