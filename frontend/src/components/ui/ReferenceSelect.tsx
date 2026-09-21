import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Pencil, Trash2, Plus, AlertCircle } from 'lucide-react';
import masterDataApi from '../../api/master-data.api';
import { extractErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../lib/store';
import { REFERENTIEL_INLINE_EDIT_ENABLED } from '../../config/referentiel-inline.config';
import QuickReferenceCreateModal from '../../features/affaires/QuickReferenceCreateModal';

export type ReferenceKind = 'assure' | 'cedante' | 'reassureur';

interface ReferenceOption {
  id: string;
  code?: string;
  raisonSociale: string;
}

interface Props {
  kind: ReferenceKind;
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  placeholder?: string;
  className?: string;
  /** Disables every action button (not the select itself) — e.g. a placed affaire. */
  readOnlyActions?: boolean;
}

const QUERY_KEY: Record<ReferenceKind, string> = {
  assure: 'assures',
  cedante: 'cedantes',
  reassureur: 'reassureurs',
};

const API: Record<ReferenceKind, { getAll: (params?: { limit?: number }) => Promise<{ data: { data: ReferenceOption[] } }>; delete: (id: string) => Promise<unknown> }> = {
  assure: masterDataApi.assures,
  cedante: masterDataApi.cedantes,
  reassureur: masterDataApi.reassureurs,
};

const SINGULAR: Record<ReferenceKind, string> = {
  assure: 'un assuré',
  cedante: 'une cédante',
  reassureur: 'un réassureur',
};

const PLACEHOLDER: Record<ReferenceKind, string> = {
  assure: 'Sélectionner un assuré',
  cedante: 'Sélectionner une cédante',
  reassureur: 'Sélectionner un réassureur',
};

/**
 * Référentiel-backed dropdown with optional inline create / edit / delete.
 *
 * FIX (bug #1): replaces the previous `navigate('/cedantes')` "Gérer" button.
 * That button lived inside the create wizard — clicking it unmounted the whole
 * modal and silently destroyed every field the user had already filled across
 * steps 1–3, with no warning and no way back. Everything here happens in an
 * overlay on top of the wizard, so form state is never lost.
 *
 * FIX (bug #2): after creating a record, the new option is written straight
 * into the React Query cache (setQueryData) BEFORE invalidating. Previously
 * only invalidateQueries() was called, so for the duration of the refetch the
 * <select>'s `value` pointed at an id that had no matching <option> — which
 * renders as a BLANK dropdown, making a successful creation look like it had
 * failed.
 */
export default function ReferenceSelect({
  kind,
  value,
  onChange,
  required,
  placeholder,
  className,
  readOnlyActions = false,
}: Props) {
  const queryClient = useQueryClient();
  const hasBackendPermission = useAuthStore((state) => state.hasPermission);
  const [showCreate, setShowCreate] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [error, setError] = useState('');

  const queryKey = QUERY_KEY[kind];

  const { data: options = [] } = useQuery<ReferenceOption[]>({
    queryKey: [queryKey],
    queryFn: async () => (await API[kind].getAll({ limit: 500 })).data.data,
  });

  // FIX (bug #9): the Référentiel write endpoints require MASTER_DATA_*
  // permissions, not AFFAIRES_*. A user with only affaire rights previously
  // saw the buttons, clicked, and got a 403 surfaced as a vague "Impossible
  // de créer cette fiche." Now the actions simply aren't offered to them.
  const canWrite = hasBackendPermission('donnees:create');
  const canDelete = hasBackendPermission('donnees:delete');
  const showActions = REFERENTIEL_INLINE_EDIT_ENABLED && !readOnlyActions && canWrite;

  const handleCreated = (entity: { id: string; raisonSociale: string; code?: string }) => {
    // Optimistic insert — see FIX (bug #2) above.
    queryClient.setQueryData<ReferenceOption[]>([queryKey], (prev) =>
      prev ? [...prev, entity] : [entity],
    );
    onChange(entity.id);
    queryClient.invalidateQueries({ queryKey: [queryKey] });
    setShowCreate(false);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => API[kind].delete(id),
    onSuccess: (_res, id) => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      // If the deactivated record was the selected one, clear the selection
      // rather than leaving the form pointing at an inactive entity.
      if (value === id) onChange('');
      setError('');
    },
    onError: (err) => setError(extractErrorMessage(err, 'Suppression impossible.')),
  });

  const selectClass =
    className ??
    'w-full rounded-xl border border-border bg-secondary px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background';

  return (
    <>
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className={selectClass}
        >
          <option value="">{placeholder ?? PLACEHOLDER[kind]}</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.raisonSociale}
              {o.code ? ` (${o.code})` : ''}
            </option>
          ))}
        </select>

        {showActions && (
          <>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="shrink-0 rounded-xl border border-primary/30 px-3 text-[12px] font-medium text-primary hover:bg-primary/10"
              title={`Ajouter ${SINGULAR[kind]}`}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={() => setShowManage(true)}
              className="shrink-0 rounded-xl border border-border px-3 text-[12px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Gérer (sans quitter le formulaire)"
            >
              Gérer
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
          <AlertCircle size={12} /> {error}
        </p>
      )}

      {showCreate && (
        <QuickReferenceCreateModal
          kind={kind}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {showManage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">Gérer le Référentiel</h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Les modifications s'appliquent directement aux fiches du Référentiel. Votre saisie en cours est conservée.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowManage(false)}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-secondary"
              >
                Fermer
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-5">
              {options.length === 0 ? (
                <p className="py-8 text-center text-[13px] text-muted-foreground">
                  Aucune fiche pour le moment. Utilisez « + » pour en créer une.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {options.map((o) => (
                    <div key={o.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-[13px] text-foreground">{o.raisonSociale}</p>
                        {o.code && <p className="text-[11px] font-mono text-muted-foreground">{o.code}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onChange(o.id);
                            setShowManage(false);
                          }}
                          className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          Sélectionner
                        </button>
                        {/*
                          NOTE (deliberate scope limit): "Modifier" opens the
                          full Référentiel fiche in a new browser tab rather
                          than an inline edit form. The full fiche has 5 tabs
                          (contacts, comptes bancaires, conventions, champs
                          libres...) that QuickReferenceCreateModal's 1-screen
                          form doesn't cover — an inline editor reusing that
                          form would silently hide those fields and risk the
                          user thinking they'd seen the whole record. A new
                          tab satisfies "modifier depuis le dropdown" without
                          losing the wizard state (the original bug) and
                          without a half-truth edit form.
                        */}
                        <a
                          href={`/${queryKey}/${o.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
                          title="Modifier la fiche complète (nouvel onglet)"
                        >
                          <Pencil size={12} />
                        </a>
                        {canDelete && (
                          <button
                            type="button"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Désactiver « ${o.raisonSociale} » ? La fiche restera visible dans l'historique mais ne sera plus sélectionnable.`,
                                )
                              ) {
                                deleteMutation.mutate(o.id);
                              }
                            }}
                            className="rounded-lg border border-destructive/30 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/10 disabled:opacity-40"
                            title="Désactiver"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div className="border-t border-border px-5 py-3">
                <p className="flex items-center gap-1.5 text-[12px] text-destructive">
                  <AlertCircle size={13} /> {error}
                </p>
              </div>
            )}

            <div className="flex justify-between border-t border-border p-5">
              <button
                type="button"
                onClick={() => {
                  setShowManage(false);
                  setShowCreate(true);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-primary/30 px-3 py-2 text-[13px] font-medium text-primary hover:bg-primary/10"
              >
                <Plus size={14} /> Ajouter {SINGULAR[kind]}
              </button>
              <button
                type="button"
                onClick={() => setShowManage(false)}
                className="rounded-xl px-4 py-2 text-[13px] font-medium text-foreground hover:bg-secondary"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}