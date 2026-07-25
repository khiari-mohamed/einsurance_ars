import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Clock, ArrowRight } from 'lucide-react';
import { workflowApi } from '../../api/workflow.api';

const ACTION_LABELS: Record<string, string> = {
  AFFAIRE_CREATED: 'Affaire créée',
  AFFAIRE_UPDATED: 'Affaire modifiée',
  AFFAIRE_DELETED: 'Affaire désactivée',
};

function actionLabel(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith('STATUT_CHANGED')) return action.replace('STATUT_CHANGED: ', 'Changement de statut : ');
  return action;
}

const LIMIT = 30;

// FIX (Workflow pass): full rewrite. Was a static placeholder with no data
// fetching. Now backed by the new GET /workflow/audit-history endpoint,
// surfacing the AFFAIRE_CREATED/AFFAIRE_UPDATED/AFFAIRE_DELETED/
// STATUT_CHANGED entries AffairesService and AffaireWorkflowService already
// write to AuditLog on every affaire lifecycle event.
export default function WorkflowHistory() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['workflow-audit-history', page],
    queryFn: async () => {
      const { data } = await workflowApi.getAuditHistory({ page, limit: LIMIT });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const entries = data?.data ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <h1 className="text-[22px] font-semibold text-gray-900 mb-6">Historique Workflow</h1>

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Clock size={40} className="mx-auto mb-3 text-gray-300" />
            Aucun historique disponible pour le moment.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Clock size={16} className="text-gray-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-gray-900">{actionLabel(entry.action)}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {entry.user ? `${entry.user.prenom} ${entry.user.nom}` : 'Système'} · {new Date(entry.createdAt).toLocaleString('fr-FR')}
                    </p>
                    {entry.before && entry.after && (
                      <p className="text-[11px] text-gray-400 mt-1 font-mono truncate">
                        {JSON.stringify(entry.before)} → {JSON.stringify(entry.after)}
                      </p>
                    )}
                  </div>
                </div>
                {entry.entityId && entry.entityType === 'Affaire' && (
                  <button onClick={() => navigate(`/affaires/${entry.entityId}`)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0" title="Voir l'affaire">
                    <ArrowRight size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="text-[12px] text-gray-500">Page {page} / {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
              Précédent
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
              Suivant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}