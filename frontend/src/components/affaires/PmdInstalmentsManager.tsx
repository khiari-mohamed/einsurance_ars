import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import { traitesApi } from '../../api/traites.api';
import { formatCurrency } from '../../lib/currency';
import { PmdInstalmentInput } from '../../types/traite.types';

interface Props {
  affaireId: string;
}

// FIX (Traités pass): full rewrite. The previous version (and its now-
// recommended-for-deletion twin, features/affaires/PMDInstalmentSchedule.tsx)
// invented a data model — pourcentage, statut ('en_attente'/'paye'/'retard'),
// montantPaye, referencePaiement, datePaiement — none of which exists on the
// real PmdInstalment model (numeroTranche, dateEcheance, montant,
// tauxDeduction, isPaid, paidAt only), and called routes/APIs that don't
// exist on the backend. This uses the real /traites endpoints, including the
// new PUT replace-all route added in this pass.
export function PmdInstalmentsManager({ affaireId }: Props) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<PmdInstalmentInput[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState('');

  const { data: traite, isLoading } = useQuery({
    queryKey: ['traite', affaireId],
    queryFn: async () => (await traitesApi.getOne(affaireId)).data,
  });

  const instalments = traite?.pmdInstalments ?? [];
  const hasPaidInstalment = instalments.some((i) => i.isPaid);

  useEffect(() => {
    if (traite && !isDirty) {
      setRows(
        instalments.map((p) => ({
          numeroTranche: p.numeroTranche,
          dateEcheance: p.dateEcheance.split('T')[0],
          montant: p.montant,
          tauxDeduction: p.tauxDeduction,
        })),
      );
    }
  }, [traite]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['traite', affaireId] });
    queryClient.invalidateQueries({ queryKey: ['affaire', affaireId] });
  };

  const saveMutation = useMutation({
    mutationFn: (data: PmdInstalmentInput[]) => traitesApi.replacePmdInstalments(affaireId, data),
    onSuccess: () => {
      invalidate();
      setIsDirty(false);
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Erreur lors de l\'enregistrement.'),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => traitesApi.regeneratePmdInstalments(affaireId),
    onSuccess: () => {
      invalidate();
      setIsDirty(false);
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.message || 'Erreur lors de la régénération.'),
  });

  const payMutation = useMutation({
    mutationFn: (instalmentId: string) => traitesApi.markInstalmentPaid(affaireId, instalmentId),
    onSuccess: () => invalidate(),
    onError: (err: any) => setError(err.response?.data?.message || 'Erreur lors du marquage.'),
  });

  const addRow = () => {
    setRows((prev) => [...prev, { numeroTranche: prev.length + 1, dateEcheance: '', montant: 0 }]);
    setIsDirty(true);
  };

  const updateRow = (idx: number, patch: Partial<PmdInstalmentInput>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setIsDirty(true);
  };

  const removeRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handleSave = () => {
    const invalid = rows.some((r) => !r.dateEcheance || r.montant < 0);
    if (invalid) {
      setError('Chaque tranche doit avoir une date d\'échéance et un montant ≥ 0.');
      return;
    }
    saveMutation.mutate(rows.map((r, i) => ({ ...r, numeroTranche: i + 1 })));
  };

  const totalMontant = rows.reduce((sum, r) => sum + (r.montant || 0), 0);
  const pmdTotal = traite?.pmd ?? 0;
  const ecart = totalMontant - pmdTotal;

  if (isLoading) return <div className="p-4 text-[13px] text-gray-500">Chargement...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-[13px] font-semibold text-gray-900">Échéancier PMD</h4>
          {pmdTotal > 0 && (
            <p className="text-[11px] text-gray-500 mt-0.5">
              PMD total : {formatCurrency(pmdTotal, traite?.affaire.currency || 'TND')} · Périodicité : {traite?.periodicite}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => regenerateMutation.mutate()}
            disabled={!pmdTotal || regenerateMutation.isPending}
            className="flex items-center gap-1.5 text-[12px] font-medium text-gray-600 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed"
            title={!pmdTotal ? 'PMD non renseigné' : 'Régénérer un échéancier régulier depuis le PMD et la périodicité'}
          >
            <RotateCcw size={13} />
            Régénérer
          </button>
          <button
            type="button"
            onClick={addRow}
            disabled={hasPaidInstalment}
            className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={14} />
            Ajouter une tranche
          </button>
          {isDirty && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending || hasPaidInstalment}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Save size={13} />
              {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>

      {hasPaidInstalment && (
        <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[12px] text-amber-800">
          Au moins une tranche est déjà payée — l'échéancier ne peut plus être remplacé intégralement. Utilisez "Marquer payé" ligne par ligne.
        </div>
      )}

      {error && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-[12px] text-red-700 flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-[13px] text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg">
          Aucune tranche. Renseignez un PMD puis "Régénérer", ou ajoutez des tranches manuellement.
        </p>
      ) : (
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">N°</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Échéance</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-600 uppercase">Montant</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-600 uppercase">Taux déduction %</th>
                <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-600 uppercase">Statut</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r, idx) => {
                const backendRow = instalments[idx];
                const isPaid = backendRow?.isPaid ?? false;
                return (
                  <tr key={idx} className={isPaid ? 'bg-green-50/40' : ''}>
                    <td className="px-3 py-2 text-[13px] text-gray-700">{r.numeroTranche}</td>
                    <td className="px-3 py-2">
                      <input
                        type="date"
                        value={r.dateEcheance}
                        onChange={(e) => updateRow(idx, { dateEcheance: e.target.value })}
                        disabled={isPaid}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={r.montant}
                        onChange={(e) => updateRow(idx, { montant: parseFloat(e.target.value) || 0 })}
                        disabled={isPaid}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px] text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        step="0.0001"
                        min="0"
                        max="100"
                        value={r.tauxDeduction ?? ''}
                        onChange={(e) => updateRow(idx, { tauxDeduction: parseFloat(e.target.value) || undefined })}
                        disabled={isPaid}
                        className="w-full px-2 py-1.5 border border-gray-200 rounded text-[13px] text-right focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
                      />
                    </td>
                    <td className="px-3 py-2 text-[12px]">
                      {isPaid ? (
                        <span className="flex items-center gap-1 text-green-700">
                          <CheckCircle2 size={13} />
                          Payée{backendRow?.paidAt ? ` (${new Date(backendRow.paidAt).toLocaleDateString('fr-FR')})` : ''}
                        </span>
                      ) : (
                        <span className="text-gray-400">En attente</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isPaid ? null : backendRow ? (
                        <button
                          type="button"
                          onClick={() => payMutation.mutate(backendRow.id!)}
                          disabled={payMutation.isPending || isDirty}
                          title={isDirty ? 'Enregistrez les modifications avant de marquer un paiement' : 'Marquer payée'}
                          className="text-[11px] font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Marquer payée
                        </button>
                      ) : (
                        <button type="button" onClick={() => removeRow(idx)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-100">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-[12px] font-semibold text-gray-700">Total</td>
                <td className="px-3 py-2 text-[13px] font-semibold text-right text-gray-900">
                  {formatCurrency(totalMontant, traite?.affaire.currency || 'TND')}
                </td>
                <td colSpan={3} className="px-3 py-2">
                  {pmdTotal > 0 && Math.abs(ecart) > 0.001 && (
                    <span className="text-[11px] text-amber-600">Écart avec le PMD : {formatCurrency(ecart, traite?.affaire.currency || 'TND')}</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

export default PmdInstalmentsManager;