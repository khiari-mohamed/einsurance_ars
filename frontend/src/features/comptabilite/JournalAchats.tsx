import { useQuery } from '@tanstack/react-query';
import comptabiliteApi from '@/api/comptabilite.api';
import { formatCurrency, formatDate } from '@/lib/currency';

// FIX (Comptabilité pass): full rewrite. Per CDC §V's account numbering
// (réassureurs = "Fournisseur" 401xxxxx), Journal Achats IS the general
// ledger filtered to compte prefix "401" — not a fictional journalCode=ach
// param on a nonexistent endpoint.
export default function JournalAchats() {
  const { data, isLoading } = useQuery({
    queryKey: ['journal-achats'],
    queryFn: async () => (await comptabiliteApi.getLedger({ compte: '401' })).data,
  });

  const lines = data?.lines ?? [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Journal Achats</h1>
      <p className="text-sm text-gray-500 mb-6">Réassureurs (comptes 401xxxxx)</p>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Écriture</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Réassureur</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Débit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Crédit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
            ) : lines.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucune écriture</td></tr>
            ) : (
              lines.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{l.journalEntry?.createdAt ? formatDate(l.journalEntry.createdAt) : '-'}</td>
                  <td className="px-4 py-3 text-sm font-mono">{l.journalEntry?.numero}</td>
                  <td className="px-4 py-3 text-sm">{l.reassureur?.raisonSociale || '-'}</td>
                  <td className="px-4 py-3 text-sm">{l.libelle}</td>
                  <td className="px-4 py-3 text-sm text-right">{l.debit ? formatCurrency(l.debit, l.currency) : '-'}</td>
                  <td className="px-4 py-3 text-sm text-right">{l.credit ? formatCurrency(l.credit, l.currency) : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
          {data && (
            <tfoot className="bg-gray-50 font-semibold">
              <tr><td colSpan={4} className="px-4 py-3 text-right">Total:</td><td className="px-4 py-3 text-right">{formatCurrency(data.totalDebit)}</td><td className="px-4 py-3 text-right">{formatCurrency(data.totalCredit)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}