import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { History, Edit2, RotateCcw, X, AlertCircle, ShieldCheck } from 'lucide-react';
import { treatyParametersApi } from '../../api/treaty-parameters.api';
import { formatCurrency } from '../../lib/currency';
import {
  CreateTreatyParameterVersionInput, UpdateTreatyParameterVersionInput, RenewTreatyParameterVersionInput,
} from '../../types/treaty-parameters.types';

interface Props {
  affaireId: string;
  currency?: string;
}

// FIX (Workflow pass): full build-out. This component previously described
// a feature with zero backing in the schema — TraiteAffaire is flat, no
// version history existed anywhere. Now wired against the real
// TreatyParameterVersion model: every "Modifier" or "Renouveler" archives
// the current active version and creates a new one, preserving a real
// audit trail rather than mutating a row in place.
export function TreatyParametersManager({ affaireId, currency = 'TND' }: Props) {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<'view' | 'create' | 'edit' | 'renew'>('view');
  const [form, setForm] = useState<Record<string, any>>({});
  const [error, setError] = useState('');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['treaty-parameters-active', affaireId] });
    queryClient.invalidateQueries({ queryKey: ['treaty-parameters-history', affaireId] });
  };

  const { data: active, isLoading, isError } = useQuery({
    queryKey: ['treaty-parameters-active', affaireId],
    queryFn: async () => (await treatyParametersApi.getActive(affaireId)).data,
    retry: false,
  });

  const { data: history } = useQuery({
    queryKey: ['treaty-parameters-history', affaireId],
    queryFn: async () => (await treatyParametersApi.getHistory(affaireId)).data,
    enabled: showHistory,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTreatyParameterVersionInput) => treatyParametersApi.createInitial(affaireId, data),
    onSuccess: () => { invalidate(); setMode('view'); setError(''); },
    onError: (err: any) => setError(err.response?.data?.message || 'Erreur lors de la création.'),
  });

  const supersedeMutation = useMutation({
    mutationFn: (data: UpdateTreatyParameterVersionInput) => treatyParametersApi.supersede(affaireId, data),
    onSuccess: () => { invalidate(); setMode('view'); setError(''); },
    onError: (err: any) => setError(err.response?.data?.message || 'Erreur lors de la modification.'),
  });

  const renewMutation = useMutation({
    mutationFn: (data: RenewTreatyParameterVersionInput) => treatyParametersApi.renew(affaireId, data),
    onSuccess: () => { invalidate(); setMode('view'); setError(''); },
    onError: (err: any) => setError(err.response?.data?.message || 'Erreur lors du renouvellement.'),
  });

  const startCreate = () => {
    setForm({ dateDebut: '', dateFin: '', tauxCommissionCedante: 0, tauxCommissionCourtage: 0 });
    setError('');
    setMode('create');
  };

  const startEdit = () => {
    if (!active) return;
    setForm({
      dateDebut: active.dateDebut.split('T')[0],
      dateFin: active.dateFin.split('T')[0],
      tauxCommissionCedante: active.tauxCommissionCedante,
      tauxCommissionCourtage: active.tauxCommissionCourtage,
      plafondGarantie: active.plafondGarantie,
      franchiseAbsolue: active.franchiseAbsolue,
      franchiseRelative: active.franchiseRelative,
      clauseParticuliere: active.clauseParticuliere,
      motifModification: '',
    });
    setError('');
    setMode('edit');
  };

  const startRenew = () => {
    if (!active) return;
    setForm({
      dateDebut: '',
      dateFin: '',
      tauxCommissionCedante: active.tauxCommissionCedante,
      tauxCommissionCourtage: active.tauxCommissionCourtage,
      plafondGarantie: active.plafondGarantie,
      franchiseAbsolue: active.franchiseAbsolue,
      franchiseRelative: active.franchiseRelative,
      clauseParticuliere: active.clauseParticuliere,
      motifModification: '',
    });
    setError('');
    setMode('renew');
  };

  const handleSubmit = () => {
    if (mode === 'create') {
      if (!form.dateDebut || !form.dateFin) { setError('Dates de début et de fin requises.'); return; }
      createMutation.mutate(form as CreateTreatyParameterVersionInput);
    } else if (mode === 'edit') {
      if (!form.motifModification?.trim()) { setError('Le motif de modification est obligatoire.'); return; }
      supersedeMutation.mutate(form as UpdateTreatyParameterVersionInput);
    } else if (mode === 'renew') {
      renewMutation.mutate(form as RenewTreatyParameterVersionInput);
    }
  };

  const isSaving = createMutation.isPending || supersedeMutation.isPending || renewMutation.isPending;

  if (isLoading) return <div className="p-4 text-[13px] text-gray-500">Chargement...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-gray-900">Paramètres commerciaux du traité</h4>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowHistory((s) => !s)} className="flex items-center gap-1.5 text-[12px] font-medium text-gray-600 hover:text-gray-900">
            <History size={13} />
            {showHistory ? 'Masquer historique' : 'Voir historique'}
          </button>
          {active && mode === 'view' && (
            <>
              <button type="button" onClick={startEdit} className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700">
                <Edit2 size={13} /> Modifier
              </button>
              <button type="button" onClick={startRenew} className="flex items-center gap-1.5 text-[12px] font-medium text-purple-600 hover:text-purple-700">
                <RotateCcw size={13} /> Renouveler
              </button>
            </>
          )}
        </div>
      </div>

      {isError && mode === 'view' && (
        <div className="p-4 border border-dashed border-gray-200 rounded-lg text-center">
          <ShieldCheck className="mx-auto text-gray-300 mb-2" size={24} />
          <p className="text-[13px] text-gray-500 mb-3">Aucune version de paramètres commerciaux n'a encore été créée pour ce traité.</p>
          <button type="button" onClick={startCreate} className="px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Créer la version initiale
          </button>
        </div>
      )}

      {active && mode === 'view' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Version</p>
            <p className="text-[13px] font-semibold text-gray-900">v{active.version}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Période</p>
            <p className="text-[13px] text-gray-900">{new Date(active.dateDebut).toLocaleDateString('fr-FR')} – {new Date(active.dateFin).toLocaleDateString('fr-FR')}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Commission cédante</p>
            <p className="text-[13px] text-gray-900">{active.tauxCommissionCedante}%</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Commission courtage ARS</p>
            <p className="text-[13px] text-gray-900">{active.tauxCommissionCourtage}%</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Plafond de garantie</p>
            <p className="text-[13px] text-gray-900">{active.plafondGarantie != null ? formatCurrency(active.plafondGarantie, currency) : 'Illimité'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Franchise absolue</p>
            <p className="text-[13px] text-gray-900">{active.franchiseAbsolue != null ? formatCurrency(active.franchiseAbsolue, currency) : '-'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Franchise relative</p>
            <p className="text-[13px] text-gray-900">{active.franchiseRelative != null ? `${active.franchiseRelative}%` : '-'}</p>
          </div>
          {active.clauseParticuliere && (
            <div className="col-span-full">
              <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Clause particulière</p>
              <p className="text-[13px] text-gray-900 whitespace-pre-line">{active.clauseParticuliere}</p>
            </div>
          )}
        </div>
      )}

      {(mode === 'create' || mode === 'edit' || mode === 'renew') && (
        <div className="p-4 border border-gray-200 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-gray-900">
              {mode === 'create' ? 'Nouvelle version (v1)' : mode === 'edit' ? `Modifier — nouvelle version (v${(active?.version ?? 0) + 1})` : `Renouveler — nouvelle version (v${(active?.version ?? 0) + 1})`}
            </p>
            <button type="button" onClick={() => setMode('view')} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={16} /></button>
          </div>

          {error && <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700 flex items-center gap-2"><AlertCircle size={14} />{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Date de début {mode === 'create' && <span className="text-red-500">*</span>}</label>
              <input type="date" value={form.dateDebut || ''} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px]" />
              {mode === 'renew' && <p className="mt-0.5 text-[10px] text-gray-400">Vide = lendemain de la fin de la période active</p>}
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Date de fin {mode === 'create' && <span className="text-red-500">*</span>}</label>
              <input type="date" value={form.dateFin || ''} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px]" />
              {mode === 'renew' && <p className="mt-0.5 text-[10px] text-gray-400">Vide = +1 an</p>}
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Commission cédante (%)</label>
              <input type="number" step="0.0001" value={form.tauxCommissionCedante ?? ''} onChange={(e) => setForm({ ...form, tauxCommissionCedante: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Commission courtage ARS (%)</label>
              <input type="number" step="0.0001" value={form.tauxCommissionCourtage ?? ''} onChange={(e) => setForm({ ...form, tauxCommissionCourtage: parseFloat(e.target.value) || 0 })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Plafond de garantie</label>
              <input type="number" step="0.001" value={form.plafondGarantie ?? ''} onChange={(e) => setForm({ ...form, plafondGarantie: parseFloat(e.target.value) || undefined })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Franchise absolue</label>
              <input type="number" step="0.001" value={form.franchiseAbsolue ?? ''} onChange={(e) => setForm({ ...form, franchiseAbsolue: parseFloat(e.target.value) || undefined })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px]" />
            </div>
            <div>
              <label className="block text-[11px] text-gray-500 mb-1">Franchise relative (%)</label>
              <input type="number" step="0.0001" value={form.franchiseRelative ?? ''} onChange={(e) => setForm({ ...form, franchiseRelative: parseFloat(e.target.value) || undefined })} className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px]" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] text-gray-500 mb-1">Clause particulière</label>
              <textarea value={form.clauseParticuliere || ''} onChange={(e) => setForm({ ...form, clauseParticuliere: e.target.value })} rows={2} className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px]" />
            </div>
            {mode !== 'create' && (
              <div className="col-span-2">
                <label className="block text-[11px] text-gray-500 mb-1">
                  Motif {mode === 'edit' && <span className="text-red-500">*</span>}
                </label>
                <input value={form.motifModification || ''} onChange={(e) => setForm({ ...form, motifModification: e.target.value })} placeholder={mode === 'renew' ? 'Ex: Renouvellement annuel' : 'Ex: Renégociation du plafond'} className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px]" />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button type="button" onClick={() => setMode('view')} className="px-3 py-1.5 text-[12px] font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
            <button type="button" onClick={handleSubmit} disabled={isSaving} className="px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              {isSaving ? 'Enregistrement...' : 'Confirmer'}
            </button>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="mt-4">
          <h5 className="text-[12px] font-semibold text-gray-700 mb-2">Historique des versions</h5>
          {!history || history.length === 0 ? (
            <p className="text-[12px] text-gray-400">Aucune version enregistrée.</p>
          ) : (
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Version</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Période</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-600 uppercase">Comm. cédante</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-600 uppercase">Comm. courtage</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Motif</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((v) => (
                    <tr key={v.id} className={v.isActive ? 'bg-blue-50/40' : ''}>
                      <td className="px-3 py-2 text-[12px] text-gray-900">v{v.version}</td>
                      <td className="px-3 py-2 text-[12px] text-gray-600">{new Date(v.dateDebut).toLocaleDateString('fr-FR')} – {new Date(v.dateFin).toLocaleDateString('fr-FR')}</td>
                      <td className="px-3 py-2 text-[12px] text-right text-gray-900">{v.tauxCommissionCedante}%</td>
                      <td className="px-3 py-2 text-[12px] text-right text-gray-900">{v.tauxCommissionCourtage}%</td>
                      <td className="px-3 py-2 text-[12px] text-gray-600">{v.motifModification || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${v.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {v.isActive ? 'Active' : 'Archivée'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TreatyParametersManager;