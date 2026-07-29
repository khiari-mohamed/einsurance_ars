import { Download } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import comptabiliteApi from '../../api/comptabilite.api';
import { formatCurrency, formatDate } from '../../lib/currency';

// FIX (Reconciliation gap): full rewrite. "Journal Banque" is the
// accounting ledger for bank accounts (JournalLine rows whose
// planComptable.compte is a class-5 account, e.g. 53200000/53210000/
// 53220000 per PlanComptableService.seed()) — this is GET
// /comptabilite/ledger?compte=53, not a fictional /finances/
// accounting-entries route. Bank-account selection now comes from the real
// plan comptable (class 5) instead of a hardcoded two-option list.
export default function EcrituresBancaires() {
  const [selectedCompte, setSelectedCompte] = useState('532');

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['plan-comptable-class5'],
    queryFn: async () => {
      const { data } = await comptabiliteApi.getPlanComptable();
      return data.filter((p) => p.classe === '5');
    },
  });

  const { data: ledger, isLoading } = useQuery({
    queryKey: ['ledger', selectedCompte],
    queryFn: async () => (await comptabiliteApi.getLedger({ compte: selectedCompte })).data,
    enabled: !!selectedCompte,
  });

  const lines = ledger?.lines ?? [];

  const exportToCsv = () => {
    const csvContent = [
      ['Date', 'Écriture', 'Compte', 'Libellé', 'Débit', 'Crédit', 'Devise'].join(','),
      ...lines.map((l) =>
        [
          l.journalEntry?.createdAt ? new Date(l.journalEntry.createdAt).toLocaleDateString('fr-FR') : '',
          l.journalEntry?.numero ?? '',
          l.planComptable?.compte ?? '',
          l.libelle ?? l.planComptable?.libelle ?? '',
          l.debit ?? 0,
          l.credit ?? 0,
          l.currency,
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-banque-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Journal Banque</h1>
        <button onClick={exportToCsv} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
          <Download size={20} /> Exporter
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <label className="block text-sm font-medium mb-1">Compte bancaire</label>
          <select value={selectedCompte} onChange={(e) => setSelectedCompte(e.target.value)} className="px-3 py-2 border rounded-lg">
            <option value="532">Tous les comptes de trésorerie (53...)</option>
            {bankAccounts.map((b) => <option key={b.id} value={b.compte}>{b.compte} - {b.libelle}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <p className="text-center py-8 text-gray-500">Chargement...</p>
          ) : lines.length === 0 ? (
            <p className="text-center py-8 text-gray-500">Aucune écriture pour ce compte</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Écriture</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Compte</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Libellé</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Débit</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Crédit</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{l.journalEntry?.createdAt ? formatDate(l.journalEntry.createdAt) : '-'}</td>
                    <td className="px-4 py-3 text-sm font-mono">{l.journalEntry?.numero}</td>
                    <td className="px-4 py-3 text-sm font-mono">{l.planComptable?.compte}</td>
                    <td className="px-4 py-3 text-sm">{l.libelle || l.planComptable?.libelle}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{l.debit ? formatCurrency(l.debit, l.currency) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{l.credit ? formatCurrency(l.credit, l.currency) : '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${l.journalEntry?.statut === 'VALIDE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {l.journalEntry?.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {ledger && (
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right">Total:</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(ledger.totalDebit, 'TND')}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(ledger.totalCredit, 'TND')}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
}