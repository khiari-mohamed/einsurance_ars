import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import { facultativeApi } from '../../api/facultative.api';
import { formatCurrency } from '../../lib/currency';
import { GuaranteeLineInput } from '../../types/facultative.types';

interface Props {
  affaireId: string;
}

// FIX (Affaires Pass 2): full rewrite. The previous version invented fields
// (numeroLigne, codeGarantie, libelleGarantie, tauxPrime, primeNette,
// franchise, plafond, observations) that don't exist on the real
// GuaranteeLine model (garantie, capitauxAssures100, ordre only) and called
// a guaranteeLinesApi with getByAffaire/getTotals routes that have no
// backend counterpart. This version uses facultativeApi (wired to the real
// /facultatives controller) and edits via the atomic replace-all endpoint,
// which matches the CDC's "table répétable" pattern for guarantee lines and
// avoids partial-save inconsistencies.
export function GuaranteeLinesManager({ affaireId }: Props) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<GuaranteeLineInput[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState('');

  const { data: fac, isLoading } = useQuery({
    queryKey: ['facultative', affaireId],
    queryFn: async () => (await facultativeApi.getOne(affaireId)).data,
  });

  useEffect(() => {
    if (fac && !isDirty) {
      setRows(
        fac.guaranteeLines.map((g) => ({ garantie: g.garantie, capitauxAssures100: g.capitauxAssures100, ordre: g.ordre })),
      );
    }
  }, [fac]);

  const saveMutation = useMutation({
    mutationFn: (lines: GuaranteeLineInput[]) => facultativeApi.replaceGuaranteeLines(affaireId, lines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facultative', affaireId] });
      queryClient.invalidateQueries({ queryKey: ['affaire', affaireId] });
      setIsDirty(false);
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement.');
    },
  });

  const addRow = () => {
    setRows((prev) => [...prev, { garantie: '', capitauxAssures100: 0, ordre: prev.length + 1 }]);
    setIsDirty(true);
  };

  const updateRow = (idx: number, patch: Partial<GuaranteeLineInput>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setIsDirty(true);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handleSave = () => {
    const invalid = rows.some((r) => !r.garantie.trim() || r.capitauxAssures100 < 0);
    if (invalid) {
      setError('Chaque ligne doit avoir un libellé de garantie et un capital assuré ≥ 0.');
      return;
    }
    saveMutation.mutate(rows.map((r, i) => ({ ...r, ordre: i + 1 })));
  };

  const totalCapitaux = rows.reduce((sum, r) => sum + (r.capitauxAssures100 || 0), 0);

  if (isLoading) return <div className="p-4 text-[13px] text-gray-500">Chargement...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-gray-900">Capitaux assurés 100% par garantie</h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700"
          >
            <Plus size={14} />
            Ajouter une ligne
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={13} />
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700 flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">
          Aucune ligne de garantie. Cliquez sur "Ajouter une ligne".
        </p>
      ) : (
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Garantie</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-600 uppercase">Capitaux assurés 100%</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2">
                    <input
                      value={r.garantie}
                      onChange={(e) => updateRow(idx, { garantie: e.target.value })}
                      placeholder="Ex: Incendie"
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={r.capitauxAssures100}
                      onChange={(e) => updateRow(idx, { capitauxAssures100: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px] text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeRow(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-100">
              <tr>
                <td className="px-3 py-2 text-[12px] font-semibold text-gray-700">Total</td>
                <td className="px-3 py-2 text-[13px] font-semibold text-gray-900 text-right">{formatCurrency(totalCapitaux, 'TND')}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default GuaranteeLinesManager;