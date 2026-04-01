import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import api from '../../lib/api';

export default function TraitesList() {
  const { data: traites, isLoading } = useQuery({
    queryKey: ['traites'],
    queryFn: async () => {
      const { data } = await api.get('/traites');
      return data;
    },
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Traités</h1>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus size={20} />
          Nouveau Traité
        </button>
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Traité</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {traites?.map((traite: any) => (
                <tr key={traite.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium">{traite.numeroTraite}</td>
                  <td className="px-6 py-4 text-sm uppercase">{traite.type}</td>
                  <td className="px-6 py-4 text-sm">{traite.primePrevisionnelle} {traite.devise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
