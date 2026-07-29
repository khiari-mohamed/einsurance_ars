import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import comptabiliteApi from '@/api/comptabilite.api';
import { formatCurrency, formatDate } from '@/lib/currency';

// FIX (Comptabilité pass): general ledger view — matches GET
// /comptabilite/ledger exactly (compte prefix + optional tiers/year filter).
export default function GrandLivre() {
  const [compte, setCompte] = useState('');
  const [year, setYear] = useState<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['grand-livre', compte, year],
    queryFn: async () => (await comptabiliteApi.getLedger({ compte: compte || undefined, year: year ? Number(year) : undefined })).data,
  });

  const lines = data?.lines ?? [];

  const exportCsv = () => {
    const rows = ['Date;Écriture;Compte;Tiers;Libellé;Débit;Crédit'];
    lines.forEach((l) => rows.push([
      l.journalEntry?.createdAt ? new Date(l.journalEntry.createdAt).toLocaleDateString('fr-FR') : '',
      l.journalEntry?.numero ?? '', l.planComptable?.compte ?? '',
      l.cedante?.raisonSociale || l.reassureur?.raisonSociale || '',
      (l.libelle ?? '').replace(/;/g, ','), l.debit ?? 0, l.credit ?? 0,
    ].join(';')));
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `grand-livre-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Grand Livre</h1>
        <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm"><Download size={16} /> Exporter</button>
      </div>

      <div className="flex gap-3 mb-4">
        <input placeholder="Préfixe de compte (ex: 401, 411, 532)" value={compte} onChange={(e) => setCompte(e.target.value)} className="px-3 py-2 border rounded-lg text-sm w-64" />
        <input type="number" placeholder="Année" value={year} onChange={(e) => setYear(e.target.value)} className="px-3 py-2 border rounded-lg text-sm w-32" />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Écriture</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Compte</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tiers</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Libellé</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Débit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Crédit</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
            ) : lines.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Aucune écriture</td></tr>
            ) : (
              lines.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{l.journalEntry?.createdAt ? formatDate(l.journalEntry.createdAt) : '-'}</td>
                  <td className="px-4 py-3 text-sm font-mono">{l.journalEntry?.numero}</td>
                  <td className="px-4 py-3 text-sm font-mono">{l.planComptable?.compte}</td>
                  <td className="px-4 py-3 text-sm">{l.cedante?.raisonSociale || l.reassureur?.raisonSociale || '-'}</td>
                  <td className="px-4 py-3 text-sm">{l.libelle}</td>
                  <td className="px-4 py-3 text-sm text-right">{l.debit ? formatCurrency(l.debit, l.currency) : '-'}</td>
                  <td className="px-4 py-3 text-sm text-right">{l.credit ? formatCurrency(l.credit, l.currency) : '-'}</td>
                </tr>
              ))
            )}
          </tbody>
          {data && (
            <tfoot className="bg-gray-50 font-semibold">
              <tr><td colSpan={5} className="px-4 py-3 text-right">Total:</td><td className="px-4 py-3 text-right">{formatCurrency(data.totalDebit, 'TND')}</td><td className="px-4 py-3 text-right">{formatCurrency(data.totalCredit, 'TND')}</td></tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}