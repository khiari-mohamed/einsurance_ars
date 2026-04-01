import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { comptabiliteApi } from '../../api/comptabilite.api';

export default function Balance() {
  const currentYear = new Date().getFullYear();
  const [exercice, setExercice] = useState(currentYear);
  const [mois, setMois] = useState<number | undefined>(undefined);

  const { data: balance, isLoading } = useQuery({
    queryKey: ['trial-balance', exercice, mois],
    queryFn: () => comptabiliteApi.getTrialBalance(exercice, mois).then(r => r.data),
  });

  const exportToExcel = () => {
    if (!balance) return;
    const csvContent = [
      ['Compte', 'Libellé', 'Débit', 'Crédit', 'Solde'].join(','),
      ...balance.accounts.map((a: any) => [
        a.code,
        a.label,
        a.debit,
        a.credit,
        a.solde,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-${exercice}${mois ? `-${mois}` : ''}.csv`;
    a.click();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Balance Générale</h1>
        <div className="flex gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download size={20} />
            Exporter
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Printer size={20} />
            Imprimer
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Exercice</label>
            <select
              value={exercice}
              onChange={(e) => setExercice(parseInt(e.target.value))}
              className="px-3 py-2 border rounded-lg"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mois (optionnel)</label>
            <select
              value={mois || ''}
              onChange={(e) => setMois(e.target.value ? parseInt(e.target.value) : undefined)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">Année complète</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{new Date(2000, m - 1).toLocaleString('fr', { month: 'long' })}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <p className="text-center py-8 text-gray-500">Chargement...</p>
          ) : !balance ? (
            <p className="text-center py-8 text-gray-500">Aucune donnée</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Compte</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Libellé</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Débit</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Crédit</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {balance.accounts.map((account: any) => (
                  <tr key={account.code} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono">{account.code}</td>
                    <td className="px-4 py-3 text-sm">{account.label}</td>
                    <td className="px-4 py-3 text-sm text-right">{account.debit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right">{account.credit.toLocaleString()}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${account.solde >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {account.solde.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right">Total:</td>
                  <td className="px-4 py-3 text-right">{balance.totalDebit.toLocaleString()} TND</td>
                  <td className="px-4 py-3 text-right">{balance.totalCredit.toLocaleString()} TND</td>
                  <td className="px-4 py-3 text-right">{(balance.totalDebit - balance.totalCredit).toLocaleString()} TND</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
