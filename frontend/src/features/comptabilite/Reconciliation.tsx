import { CheckCircle, AlertCircle, Link2 } from 'lucide-react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financesApi } from '../../api/finances.api';
import { formatCurrency, formatDate } from '../../lib/currency';
import { toast } from 'sonner';

// FIX (Reconciliation gap): full rewrite. Real bank reconciliation is a
// Finances concern (BankMovement <-> Encaissement/Decaissement), not
// Comptabilité's JournalEntry-based ledger — the old version queried a
// fictional /finances/accounting-entries endpoint conflating the two.
// Left panel: unreconciled BankMovement rows (real bank statement lines,
// via the new GET /finances/bank-movements). Right panel: unreconciled
// Encaissement/Decaissement rows (via GET /finances/reconciliation/
// unreconciled). Pick one from each side, matching type, and confirm.
export default function Reconciliation() {
  const queryClient = useQueryClient();
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [selectedMovementType, setSelectedMovementType] = useState<'ENCAISSEMENT' | 'DECAISSEMENT' | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const { data: unreconciledMovements, isLoading: loadingMovements } = useQuery({
    queryKey: ['bank-movements-unreconciled'],
    queryFn: async () => (await financesApi.listBankMovements({ reconciled: false, limit: 100 })).data,
  });

  const { data: unreconciledItems, isLoading: loadingItems } = useQuery({
    queryKey: ['finances-unreconciled'],
    queryFn: async () => (await financesApi.getUnreconciled()).data,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bank-movements-unreconciled'] });
    queryClient.invalidateQueries({ queryKey: ['finances-unreconciled'] });
    setSelectedMovementId(null);
    setSelectedMovementType(null);
    setSelectedItemId(null);
  };

  const reconcileMutation = useMutation({
    mutationFn: () => {
      if (!selectedMovementId || !selectedItemId || !selectedMovementType) throw new Error('Sélection incomplète');
      return selectedMovementType === 'ENCAISSEMENT'
        ? financesApi.reconcileEncaissement(selectedItemId, selectedMovementId)
        : financesApi.reconcileDecaissement(selectedItemId, selectedMovementId);
    },
    onSuccess: () => { toast.success('Rapprochement effectué'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur lors du rapprochement'),
  });

  const movements = unreconciledMovements?.data ?? [];
  const encaissements = unreconciledItems?.unreconciled.encaissements ?? [];
  const decaissements = unreconciledItems?.unreconciled.decaissements ?? [];

  const canConfirm = !!selectedMovementId && !!selectedItemId && !!selectedMovementType;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-2xl font-semibold text-foreground">Réconciliation Bancaire</h1>
        <div className="flex gap-4">
          <div className="bg-warning/10 border border-warning/25 px-4 py-2 rounded-lg flex items-center gap-2">
            <AlertCircle className="text-warning" size={20} />
            <div><p className="text-xs text-muted-foreground">Mouvements non rapprochés</p><p className="text-lg font-bold text-warning">{movements.length}</p></div>
          </div>
          <button
            onClick={() => reconcileMutation.mutate()}
            disabled={!canConfirm || reconcileMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-40"
          >
            <Link2 size={18} />
            {reconcileMutation.isPending ? 'Rapprochement...' : 'Rapprocher la sélection'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card rounded-[var(--radius)] border border-border">
          <div className="p-4 border-b"><h2 className="text-lg font-semibold">Mouvements Bancaires (non rapprochés)</h2></div>
          <div className="overflow-x-auto max-h-[600px]">
            {loadingMovements ? (
              <p className="text-center py-8 text-muted-foreground">Chargement...</p>
            ) : movements.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucun mouvement en attente</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Réf</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {movements.map((m) => (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedMovementId(m.id)}
                      className={`cursor-pointer hover:bg-primary/10 ${selectedMovementId === m.id ? 'bg-primary/15' : ''}`}
                    >
                      <td className="px-3 py-2 text-xs">{formatDate(m.dateValeur)}</td>
                      <td className="px-3 py-2 text-xs font-mono">{m.reference || '-'}</td>
                      <td className="px-3 py-2 text-xs">{m.type}</td>
                      <td className="px-3 py-2 text-xs text-right font-medium">{formatCurrency(m.montant, m.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-card rounded-[var(--radius)] border border-border">
          <div className="p-4 border-b"><h2 className="text-lg font-semibold">Encaissements / Décaissements (non rapprochés)</h2></div>
          <div className="overflow-x-auto max-h-[600px]">
            {loadingItems ? (
              <p className="text-center py-8 text-muted-foreground">Chargement...</p>
            ) : encaissements.length === 0 && decaissements.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Aucun élément en attente</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Réf</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {encaissements.map((e) => (
                    <tr
                      key={e.id}
                      onClick={() => { setSelectedItemId(e.id); setSelectedMovementType('ENCAISSEMENT'); }}
                      className={`cursor-pointer hover:bg-green-50 ${selectedItemId === e.id ? 'bg-green-100' : ''}`}
                    >
                      <td className="px-3 py-2 text-xs font-mono">{e.reference}</td>
                      <td className="px-3 py-2 text-xs text-green-700">Encaissement</td>
                      <td className="px-3 py-2 text-xs text-right font-medium">{formatCurrency(e.montant, e.currency)}</td>
                    </tr>
                  ))}
                  {decaissements.map((d) => (
                    <tr
                      key={d.id}
                      onClick={() => { setSelectedItemId(d.id); setSelectedMovementType('DECAISSEMENT'); }}
                      className={`cursor-pointer hover:bg-red-50 ${selectedItemId === d.id ? 'bg-red-100' : ''}`}
                    >
                      <td className="px-3 py-2 text-xs font-mono">{d.reference}</td>
                      <td className="px-3 py-2 text-xs text-red-700">Décaissement</td>
                      <td className="px-3 py-2 text-xs text-right font-medium">{formatCurrency(d.montant, d.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {canConfirm && (
        <div className="mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg flex items-center gap-2 text-sm text-foreground">
          <CheckCircle size={16} /> Sélection prête — cliquez "Rapprocher la sélection" pour confirmer.
        </div>
      )}
    </div>
  );
}