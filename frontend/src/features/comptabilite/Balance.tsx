import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import comptabiliteApi from '@/api/comptabilite.api';
import { formatCurrency } from '@/lib/currency';

// FIX (Comptabilité pass): "Balance" = trial balance (balance générale),
// GET /comptabilite/trial-balance — every account's cumulated debit/credit.
export default function Balance() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [mois, setMois] = useState<number | ''>('');

  const { data = [], isLoading } = useQuery({
    queryKey: ['trial-balance', year, mois],
    queryFn: async () => (await comptabiliteApi.getTrialBalance(year, mois || undefined)).data,
  });

  const totalDebit = data.reduce((s, l) => s + l.debit, 0);
  const totalCredit = data.reduce((s, l) => s + l.credit, 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Balance Générale</h1>

      <div className="flex gap-3 mb-4">
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 border border-border bg-background rounded-lg text-sm w-28 focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2" />
        <select value={mois} onChange={(e) => setMois(e.target.value ? Number(e.target.value) : '')} className="px-3 py-2 border border-border bg-background rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2">
          <option value="">Année entière</option>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
        </select>
      </div>

      <div className="bg-card rounded-[var(--radius)] border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Compte</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Libellé</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Débit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Crédit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Solde</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Chargement...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Aucune écriture validée pour cette période</td></tr>
            ) : (
              data.map((l) => (
                <tr key={l.compte} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono">{l.compte}</td>
                  <td className="px-4 py-3 text-sm">{l.libelle}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(l.debit)}</td>
                  <td className="px-4 py-3 text-sm text-right">{formatCurrency(l.credit)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${l.solde >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(l.solde)}</td>
                </tr>
              ))
            )}
          </tbody>
          {data.length > 0 && (
            <tfoot className="bg-gray-50 font-bold">
              <tr><td colSpan={2} className="px-4 py-3 text-right">Total:</td><td className="px-4 py-3 text-right">{formatCurrency(totalDebit)}</td><td className="px-4 py-3 text-right">{formatCurrency(totalCredit)}</td><td className={`px-4 py-3 text-right ${Math.abs(totalDebit - totalCredit) < 0.01 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(totalDebit - totalCredit)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}