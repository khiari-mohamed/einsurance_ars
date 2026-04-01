import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { comptabiliteApi } from '../../api/comptabilite.api';

export default function GrandLivre() {
  const [accountCode, setAccountCode] = useState('');
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => comptabiliteApi.getAccounts().then(r => r.data),
  });

  const { data: ledger = [], isLoading } = useQuery({
    queryKey: ['ledger', accountCode, filters],
    queryFn: () => accountCode
      ? comptabiliteApi.getLedger(accountCode, filters.startDate, filters.endDate).then(r => r.data)
      : Promise.resolve([]),
    enabled: !!accountCode,
  });

  const runningBalance = ledger.reduce((acc: number[], entry: any) => {
    const last = acc.length > 0 ? acc[acc.length - 1] : 0;
    acc.push(last + Number(entry.debit) - Number(entry.credit));
    return acc;
  }, []);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Grand Livre</h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Compte</label>
            <select
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Sélectionner un compte...</option>
              {accounts.map((account: any) => (
                <option key={account.id} value={account.code}>
                  {account.code} - {account.libelle}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date début</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="px-3 py-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date fin</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="px-3 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {!accountCode ? (
            <p className="text-center py-8 text-gray-500">Sélectionnez un compte pour afficher le grand livre</p>
          ) : isLoading ? (
            <p className="text-center py-8 text-gray-500">Chargement...</p>
          ) : ledger.length === 0 ? (
            <p className="text-center py-8 text-gray-500">Aucune écriture pour ce compte</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Journal</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Pièce</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Libellé</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Débit</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Crédit</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Solde</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ledger.map((entry: any, index: number) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{new Date(entry.dateOperation).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm font-mono uppercase">{entry.journalCode}</td>
                    <td className="px-4 py-3 text-sm font-mono">{entry.pieceReference}</td>
                    <td className="px-4 py-3 text-sm">{entry.libelle}</td>
                    <td className="px-4 py-3 text-sm text-right">{Number(entry.debit).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-right">{Number(entry.credit).toLocaleString()}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${runningBalance[index] >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {runningBalance[index].toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right">Total:</td>
                  <td className="px-4 py-3 text-right">
                    {ledger.reduce((sum: number, e: any) => sum + Number(e.debit), 0).toLocaleString()} TND
                  </td>
                  <td className="px-4 py-3 text-right">
                    {ledger.reduce((sum: number, e: any) => sum + Number(e.credit), 0).toLocaleString()} TND
                  </td>
                  <td className="px-4 py-3 text-right">
                    {runningBalance[runningBalance.length - 1]?.toLocaleString() || 0} TND
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
