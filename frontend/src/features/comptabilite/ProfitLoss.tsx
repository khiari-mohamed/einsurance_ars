import { Download, Printer, TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { comptabiliteApi } from '../../api/comptabilite.api';

export default function ProfitLoss() {
  const currentYear = new Date().getFullYear();
  const [exercice, setExercice] = useState(currentYear);

  const { data: profitLoss, isLoading } = useQuery({
    queryKey: ['profit-loss', exercice],
    queryFn: () => comptabiliteApi.getProfitLoss(exercice).then(r => r.data),
  });

  const exportToExcel = () => {
    if (!profitLoss) return;
    const csvContent = [
      ['Compte d\'Exploitation', exercice].join(','),
      [''],
      ['CHARGES', '', 'PRODUITS', ''].join(','),
      ['Compte', 'Montant', 'Compte', 'Montant'].join(','),
      ...Array.from({ length: Math.max(profitLoss.charges.accounts.length, profitLoss.produits.accounts.length) }, (_, i) => {
        const charge = profitLoss.charges.accounts[i];
        const produit = profitLoss.produits.accounts[i];
        return [
          charge ? `${charge.code} - ${charge.label}` : '',
          charge ? charge.debit : '',
          produit ? `${produit.code} - ${produit.label}` : '',
          produit ? produit.credit : '',
        ].join(',');
      }),
      [''],
      ['TOTAL CHARGES', profitLoss.charges.total, 'TOTAL PRODUITS', profitLoss.produits.total].join(','),
      ['RESULTAT', profitLoss.resultat >= 0 ? 'B\u00e9n\u00e9fice' : 'Perte', '', Math.abs(profitLoss.resultat)].join(','),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compte-resultat-${exercice}.csv`;
    a.click();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Compte de R\u00e9sultat</h1>
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
      ) : !profitLoss ? (
        <p className="text-center py-8 text-gray-500">Aucune donn\u00e9e</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 mb-1">Total Charges</p>
              <p className="text-2xl font-bold text-red-600">{profitLoss.charges.total.toLocaleString()} TND</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <p className="text-sm text-gray-600 mb-1">Total Produits</p>
              <p className="text-2xl font-bold text-green-600">{profitLoss.produits.total.toLocaleString()} TND</p>
            </div>
            <div className={`bg-white rounded-lg shadow p-4 ${profitLoss.resultat >= 0 ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">R\u00e9sultat Net</p>
                  <p className={`text-2xl font-bold ${profitLoss.resultat >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(profitLoss.resultat).toLocaleString()} TND
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {profitLoss.resultat >= 0 ? 'B\u00e9n\u00e9fice' : 'Perte'}
                  </p>
                </div>
                {profitLoss.resultat >= 0 ? (
                  <TrendingUp className="text-green-600" size={32} />
                ) : (
                  <TrendingDown className="text-red-600" size={32} />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b bg-red-50">
                <h2 className="text-lg font-semibold text-red-900">CHARGES (Classe 6)</h2>
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
                    {profitLoss.charges.accounts.map((account: any) => (
                      <tr key={account.code} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono">{account.code}</td>
                        <td className="px-4 py-3 text-sm">{account.label}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                          {account.debit.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-red-50 font-bold">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-right">TOTAL CHARGES:</td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {profitLoss.charges.total.toLocaleString()} TND
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-4 border-b bg-green-50">
                <h2 className="text-lg font-semibold text-green-900">PRODUITS (Classe 7)</h2>
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
                    {profitLoss.produits.accounts.map((account: any) => (
                      <tr key={account.code} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono">{account.code}</td>
                        <td className="px-4 py-3 text-sm">{account.label}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                          {account.credit.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-green-50 font-bold">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-right">TOTAL PRODUITS:</td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {profitLoss.produits.total.toLocaleString()} TND
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
