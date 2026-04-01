import { Download, Printer } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { comptabiliteApi } from '../../api/comptabilite.api';

export default function BalanceSheet() {
  const currentYear = new Date().getFullYear();
  const [exercice, setExercice] = useState(currentYear);

  const { data: balanceSheet, isLoading } = useQuery({
    queryKey: ['balance-sheet', exercice],
    queryFn: () => comptabiliteApi.getBalanceSheet(exercice).then(r => r.data),
  });

  const exportToExcel = () => {
    if (!balanceSheet) return;
    const csvContent = [
      ['Bilan', exercice].join(','),
      [''],
      ['ACTIF', '', 'PASSIF', ''].join(','),
      ['Compte', 'Montant', 'Compte', 'Montant'].join(','),
      ...Array.from({ length: Math.max(balanceSheet.actif.accounts.length, balanceSheet.passif.accounts.length) }, (_, i) => {
        const actif = balanceSheet.actif.accounts[i];
        const passif = balanceSheet.passif.accounts[i];
        return [
          actif ? `${actif.code} - ${actif.label}` : '',
          actif ? actif.solde : '',
          passif ? `${passif.code} - ${passif.label}` : '',
          passif ? Math.abs(passif.solde) : '',
        ].join(',');
      }),
      [''],
      ['TOTAL ACTIF', balanceSheet.actif.total, 'TOTAL PASSIF', balanceSheet.passif.total].join(','),
      ['', '', 'RESULTAT', balanceSheet.resultat].join(','),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bilan-${exercice}.csv`;
    a.click();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bilan</h1>
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

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b">
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
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-gray-500">Chargement...</p>
      ) : !balanceSheet ? (
        <p className="text-center py-8 text-gray-500">Aucune donn\u00e9e</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 mb-1">Total Actif</p>
              <p className="text-2xl font-bold text-blue-600">{balanceSheet.actif.total.toLocaleString()} TND</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 mb-1">Total Passif</p>
              <p className="text-2xl font-bold text-purple-600">{balanceSheet.passif.total.toLocaleString()} TND</p>
            </div>
            <div className={`bg-white rounded-lg shadow p-4 ${balanceSheet.resultat >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
              <p className="text-sm text-gray-600 mb-1">R\u00e9sultat</p>
              <p className={`text-2xl font-bold ${balanceSheet.resultat >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(balanceSheet.resultat).toLocaleString()} TND
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {balanceSheet.resultat >= 0 ? 'B\u00e9n\u00e9fice' : 'Perte'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b bg-blue-50">
                <h2 className="text-lg font-semibold text-blue-900">ACTIF</h2>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Compte</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Libell\u00e9</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {balanceSheet.actif.accounts.map((account: any) => (
                      <tr key={account.code} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono">{account.code}</td>
                        <td className="px-4 py-3 text-sm">{account.label}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-blue-600">
                          {account.solde.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-50 font-bold">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-right">TOTAL ACTIF:</td>
                      <td className="px-4 py-3 text-right text-blue-600">
                        {balanceSheet.actif.total.toLocaleString()} TND
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b bg-purple-50">
                <h2 className="text-lg font-semibold text-purple-900">PASSIF</h2>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Compte</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Libell\u00e9</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {balanceSheet.passif.accounts.map((account: any) => (
                      <tr key={account.code} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono">{account.code}</td>
                        <td className="px-4 py-3 text-sm">{account.label}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-purple-600">
                          {Math.abs(account.solde).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-purple-50">
                    <tr className="font-bold">
                      <td colSpan={2} className="px-4 py-3 text-right">TOTAL PASSIF:</td>
                      <td className="px-4 py-3 text-right text-purple-600">
                        {balanceSheet.passif.total.toLocaleString()} TND
                      </td>
                    </tr>
                    <tr className="font-bold">
                      <td colSpan={2} className="px-4 py-3 text-right">R\u00c9SULTAT:</td>
                      <td className={`px-4 py-3 text-right ${balanceSheet.resultat >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(balanceSheet.resultat).toLocaleString()} TND
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
