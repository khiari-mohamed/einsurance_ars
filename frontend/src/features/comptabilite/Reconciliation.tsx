import { CheckCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import api from '../../lib/api';

export default function Reconciliation() {
  const [selectedAccount, setSelectedAccount] = useState('512000');
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { data: bankEntries = [], isLoading: loadingBank } = useQuery({
    queryKey: ['bank-entries', selectedAccount, filters],
    queryFn: () => api.get('/finances/accounting-entries', {
      params: { journalCode: 'bnq', compteDebit: selectedAccount, ...filters }
    }).then(r => r.data.data || []),
  });

  const { data: accountingEntries = [], isLoading: loadingAccounting } = useQuery({
    queryKey: ['accounting-entries-reconcile', selectedAccount, filters],
    queryFn: () => api.get('/finances/accounting-entries', {
      params: { compteCredit: selectedAccount, ...filters }
    }).then(r => r.data.data || []),
  });

  const reconciledCount = bankEntries.filter((e: any) => e.isReconciled).length;
  const unreconciledCount = bankEntries.length - reconciledCount;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Réconciliation Bancaire</h1>
        <div className="flex gap-4">
          <div className="bg-green-50 px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <CheckCircle className="text-green-600" size={20} />
              <div>
                <p className="text-xs text-gray-600">Rapprochées</p>
                <p className="text-lg font-bold text-green-600">{reconciledCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="text-orange-600" size={20} />
              <div>
                <p className="text-xs text-gray-600">En attente</p>
                <p className="text-lg font-bold text-orange-600">{unreconciledCount}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="p-4 border-b flex gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Compte bancaire</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="512000">512000 - Banque</option>
              <option value="531000">531000 - Caisse</option>
            </select>
          </div>
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

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Mouvements Bancaires</h2>
          </div>
          <div className="overflow-x-auto max-h-[600px]">
            {loadingBank ? (
              <p className="text-center py-8 text-gray-500">Chargement...</p>
            ) : bankEntries.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Aucun mouvement</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Réf</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Montant</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bankEntries.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs">{new Date(entry.dateEcriture).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-xs font-mono">{entry.reference}</td>
                      <td className="px-3 py-2 text-xs text-right font-medium">
                        {Number(entry.montantDebit).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {entry.isReconciled ? (
                          <CheckCircle className="text-green-600 mx-auto" size={16} />
                        ) : (
                          <AlertCircle className="text-orange-600 mx-auto" size={16} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Écritures Comptables</h2>
          </div>
          <div className="overflow-x-auto max-h-[600px]">
            {loadingAccounting ? (
              <p className="text-center py-8 text-gray-500">Chargement...</p>
            ) : accountingEntries.length === 0 ? (
              <p className="text-center py-8 text-gray-500">Aucune écriture</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Réf</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Libellé</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accountingEntries.map((entry: any) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-xs">{new Date(entry.dateEcriture).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-xs font-mono">{entry.reference}</td>
                      <td className="px-3 py-2 text-xs">{entry.libelle}</td>
                      <td className="px-3 py-2 text-xs text-right font-medium">
                        {Number(entry.montantCredit).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
