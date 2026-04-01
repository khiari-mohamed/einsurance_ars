import { Download } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export default function JournalVentes() {
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['accounting-entries', 'vte', filters],
    queryFn: () => api.get('/finances/accounting-entries', {
      params: { journalCode: 'vte', ...filters }
    }).then(r => r.data.data || []),
  });

  const totalDebit = entries.reduce((sum: number, e: any) => sum + Number(e.montantDebit), 0);
  const totalCredit = entries.reduce((sum: number, e: any) => sum + Number(e.montantCredit), 0);

  const exportToExcel = () => {
    const csvContent = [
      ['Date', 'Référence', 'Compte Débit', 'Compte Crédit', 'Libellé', 'Débit', 'Crédit'].join(','),
      ...entries.map((e: any) => [
        new Date(e.dateEcriture).toLocaleDateString(),
        e.reference,
        e.compteDebit,
        e.compteCredit,
        e.libelle,
        e.montantDebit,
        e.montantCredit,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-ventes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Journal des Ventes</h1>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <Download size={20} />
          Exporter
        </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex gap-4">
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

        <div className="overflow-x-auto">
          {isLoading ? (
            <p className="text-center py-8 text-gray-500">Chargement...</p>
          ) : entries.length === 0 ? (
            <p className="text-center py-8 text-gray-500">Aucune écriture comptable</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Référence</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Compte Débit</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Compte Crédit</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Libellé</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Débit</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Crédit</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {entries.map((entry: any) => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{new Date(entry.dateEcriture).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm font-mono">{entry.reference}</td>
                    <td className="px-4 py-3 text-sm font-mono">{entry.compteDebit}</td>
                    <td className="px-4 py-3 text-sm font-mono">{entry.compteCredit}</td>
                    <td className="px-4 py-3 text-sm">{entry.libelle}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {Number(entry.montantDebit).toLocaleString()} {entry.devise}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {Number(entry.montantCredit).toLocaleString()} {entry.devise}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        entry.statut === 'comptabilisee' ? 'bg-green-100 text-green-800' :
                        entry.statut === 'validee' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {entry.statut}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right">Total:</td>
                  <td className="px-4 py-3 text-right">{totalDebit.toLocaleString()} TND</td>
                  <td className="px-4 py-3 text-right">{totalCredit.toLocaleString()} TND</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
