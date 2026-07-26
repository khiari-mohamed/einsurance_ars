import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { financesApi } from '../../api/finances.api';
import { formatCurrency, formatDate } from '../../lib/currency';

// FIX (Finances pass): was calling raw api.get('/settlements') — that
// route doesn't exist (real prefix is /finances/settlements), and read
// fields (numero, montantTotal, devise, status) that don't exist on the
// real Settlement model.
export default function SettlementsList() {
  const { data, isLoading } = useQuery({
    queryKey: ['settlements-list'],
    queryFn: async () => (await financesApi.getSettlements({ limit: 50 })).data,
  });

  const settlements = data?.data ?? [];

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Règlements</h1>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus size={20} /> Nouveau Règlement
        </button>
      </div>
      {isLoading ? (
        <p>Chargement...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {settlements.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium font-mono">{s.reference}</td>
                  <td className="px-6 py-4 text-sm">{formatDate(s.dateSettlement)}</td>
                  <td className="px-6 py-4 text-sm">{formatCurrency(s.montant, s.currency)}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 text-xs rounded-full ${s.validatedAt ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                      {s.validatedAt ? 'Validé' : 'En attente'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}