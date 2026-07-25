import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle2, Clock, AlertTriangle, X, ArrowRight, UserCheck } from 'lucide-react';
import { workflowApi } from '../../api/workflow.api';
import { WorkflowTask, WorkflowTaskStatut, taskTypeLabels, taskStatutLabels, taskStatutColors } from '../../types/workflow.types';

// FIX (Workflow pass): full rewrite. The old version called raw fetch()
// with NO Authorization header (bypasses lib/api.ts's auth interceptor
// entirely — guaranteed 401 against any real guarded route) against routes
// that don't exist (/api/workflow/notifications/...), plus a hardcoded,
// unauthenticated ws://localhost:3000/notifications with no confirmed
// backend contract. Rebuilt against the real WorkflowTask model via
// react-query polling — consistent with how the rest of this app fetches
// data — instead of inventing a WebSocket protocol with no verified spec.
// "Assign to me" uses the new claim endpoint (server resolves the current
// user from the JWT) rather than a user-picker UI backed by an unreviewed
// /users list endpoint.
type FilterMode = 'mine' | 'unassigned' | 'all' | 'overdue';

export default function WorkflowNotifications() {
  const [filter, setFilter] = useState<FilterMode>('mine');
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeNote, setCompleteNote] = useState('');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['workflow-tasks', filter],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (filter === 'mine') params.mine = true;
      const { data } = await workflowApi.getTasks(params);
      return data;
    },
    refetchInterval: 60_000,
  });

  const tasks = data?.data ?? [];

  const isOverdue = (t: WorkflowTask) =>
    !!t.dueDate && new Date(t.dueDate) < new Date() && t.statut !== WorkflowTaskStatut.COMPLETE && t.statut !== WorkflowTaskStatut.ANNULE;

  const visibleTasks = tasks.filter((t) => {
    if (filter === 'unassigned') return !t.assignedToId && t.statut !== WorkflowTaskStatut.COMPLETE && t.statut !== WorkflowTaskStatut.ANNULE;
    if (filter === 'overdue') return isOverdue(t);
    return true;
  });

  const claimMutation = useMutation({
    mutationFn: (id: string) => workflowApi.claimTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow-tasks'] }),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => workflowApi.completeTask(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow-tasks'] });
      setCompletingId(null);
      setCompleteNote('');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => workflowApi.cancelTask(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflow-tasks'] }),
  });

  const overdueCount = tasks.filter(isOverdue).length;
  const pendingCount = tasks.filter((t) => t.statut === WorkflowTaskStatut.EN_ATTENTE || t.statut === WorkflowTaskStatut.EN_COURS).length;

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Bell className="text-blue-600" size={28} />
        <div>
          <h1 className="text-[22px] font-semibold text-gray-900">Tâches &amp; Notifications</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">{pendingCount} en attente • {overdueCount} en retard</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {([
          { key: 'mine', label: 'Mes tâches' },
          { key: 'unassigned', label: 'Non assignées' },
          { key: 'overdue', label: 'En retard' },
          { key: 'all', label: 'Toutes' },
        ] as { key: FilterMode; label: string }[]).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setFilter(opt.key)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
              filter === opt.key ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] divide-y divide-gray-100">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : visibleTasks.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Bell size={40} className="mx-auto mb-3 text-gray-300" />
            Aucune tâche dans cette vue.
          </div>
        ) : (
          visibleTasks.map((task) => {
            const overdue = isOverdue(task);
            return (
              <div key={task.id} className={`p-4 ${overdue ? 'bg-red-50/40' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="mt-0.5">
                      {overdue ? <AlertTriangle size={18} className="text-red-500" /> : <Clock size={18} className="text-blue-500" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-gray-900">{taskTypeLabels[task.type]}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${taskStatutColors[task.statut]}`}>
                          {taskStatutLabels[task.statut]}
                        </span>
                        {!task.assignedToId && task.statut !== WorkflowTaskStatut.COMPLETE && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">Non assignée</span>
                        )}
                      </div>
                      {task.description && <p className="text-[12px] text-gray-600 mt-1 whitespace-pre-line">{task.description}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400">
                        {task.dueDate && <span className={overdue ? 'text-red-600 font-medium' : ''}>Échéance : {new Date(task.dueDate).toLocaleDateString('fr-FR')}</span>}
                        {task.assignedTo && <span>Assignée à {task.assignedTo.prenom} {task.assignedTo.nom}</span>}
                        {task.affaire && <span className="font-mono">{task.affaire.numero}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {task.affaireId && (
                      <button onClick={() => navigate(`/affaires/${task.affaireId}`)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors" title="Voir l'affaire">
                        <ArrowRight size={15} />
                      </button>
                    )}
                    {task.statut === WorkflowTaskStatut.EN_ATTENTE && !task.assignedToId && (
                      <button onClick={() => claimMutation.mutate(task.id)} disabled={claimMutation.isPending} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors disabled:opacity-50" title="Prendre en charge">
                        <UserCheck size={15} />
                      </button>
                    )}
                    {(task.statut === WorkflowTaskStatut.EN_ATTENTE || task.statut === WorkflowTaskStatut.EN_COURS) && (
                      <>
                        <button onClick={() => setCompletingId(task.id)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors" title="Marquer terminée">
                          <CheckCircle2 size={15} />
                        </button>
                        <button onClick={() => cancelMutation.mutate(task.id)} disabled={cancelMutation.isPending} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50" title="Annuler">
                          <X size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {completingId === task.id && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <textarea
                      value={completeNote}
                      onChange={(e) => setCompleteNote(e.target.value)}
                      placeholder="Note de complétion (optionnel)"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center justify-end gap-2 mt-2">
                      <button onClick={() => { setCompletingId(null); setCompleteNote(''); }} className="px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        Annuler
                      </button>
                      <button
                        onClick={() => completeMutation.mutate({ id: task.id, note: completeNote || undefined })}
                        disabled={completeMutation.isPending}
                        className="px-3 py-1.5 text-[12px] font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        {completeMutation.isPending ? 'Enregistrement...' : 'Confirmer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}