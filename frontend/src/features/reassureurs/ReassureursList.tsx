import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import api from '../../lib/api';

export default function ReassureursList() {
  const { data: reassureurs, isLoading } = useQuery({
    queryKey: ['reassureurs'],
    queryFn: async () => {
      const { data } = await api.get('/reassureurs');
      return data;
    },
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Réassureurs</h1>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          <Plus size={20} />
          Nouveau
        </button>
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Raison Sociale</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pays</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {reassureurs?.map((reassureur: any) => (
                <tr key={reassureur.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">{reassureur.code}</td>
                  <td className="px-6 py-4 text-sm font-medium">{reassureur.raisonSociale}</td>
                  <td className="px-6 py-4 text-sm">{reassureur.pays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
