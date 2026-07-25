import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import { traitesApi } from '../../api/traites.api';
import { TreatyAccountRubriqueInput } from '../../types/traite.types';

interface Props { affaireId: string; }

export function TreatyAccountRubriquesManager({ affaireId }: Props) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<TreatyAccountRubriqueInput[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState('');

  const { data: traite, isLoading } = useQuery({
    queryKey: ['traite', affaireId],
    queryFn: async () => (await traitesApi.getOne(affaireId)).data,
  });

  useEffect(() => {
    if (traite && !isDirty) {
      setRows(traite.accountRubriques.map((r) => ({ rubrique: r.rubrique, compteReference: r.compteReference, ordre: r.ordre })));
    }
  }, [traite]);

  const saveMutation = useMutation({
    mutationFn: (data: TreatyAccountRubriqueInput[]) => traitesApi.replaceAccountRubriques(affaireId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['traite', affaireId] });
      queryClient.invalidateQueries({ queryKey: ['affaire', affaireId] });
      setIsDirty(false);
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement.'),
  });

  const addRow = () => { setRows((p) => [...p, { rubrique: '', compteReference: '', ordre: p.length + 1 }]); setIsDirty(true); };
  const updateRow = (idx: number, patch: Partial<TreatyAccountRubriqueInput>) => { setRows((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r))); setIsDirty(true); };
  const removeRow = (idx: number) => { setRows((p) => p.filter((_, i) => i !== idx)); setIsDirty(true); };

  const handleSave = () => {
    if (rows.some((r) => !r.rubrique.trim() || !r.compteReference.trim())) {
      setError('Chaque rubrique doit avoir un libellé et un compte de référence.');
      return;
    }
    saveMutation.mutate(rows.map((r, i) => ({ ...r, ordre: i + 1 })));
  };

  if (isLoading) return <div className="p-4 text-[13px] text-gray-500">Chargement...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-gray-900">Rubriques comptables du traité</h4>
        <div className="flex items-center gap-2">
          <button type="button" onClick={addRow} className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700">
            <Plus size={14} /> Ajouter
          </button>
          {isDirty && (
            <button type="button" onClick={handleSave} disabled={saveMutation.isPending} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
              <Save size={13} /> {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700 flex items-center gap-2"><AlertCircle size={14} />{error}</div>}

      {rows.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">Aucune rubrique. Cliquez sur "Ajouter".</p>
      ) : (
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Rubrique</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Compte de référence</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2">
                    <input value={r.rubrique} onChange={(e) => updateRow(idx, { rubrique: e.target.value })} placeholder="Ex: Incendie" className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={r.compteReference} onChange={(e) => updateRow(idx, { compteReference: e.target.value })} placeholder="Ex: 70510001" className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeRow(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default TreatyAccountRubriquesManager;