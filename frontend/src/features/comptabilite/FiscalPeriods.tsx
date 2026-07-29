import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Unlock, Plus } from 'lucide-react';
import comptabiliteApi from '@/api/comptabilite.api';
import { toast } from 'sonner';

export default function FiscalPeriods() {
  const queryClient = useQueryClient();
  const [newYear, setNewYear] = useState(new Date().getFullYear());

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ['fiscal-periods'],
    queryFn: async () => (await comptabiliteApi.getFiscalPeriods()).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['fiscal-periods'] });

  const initMutation = useMutation({
    mutationFn: (year: number) => comptabiliteApi.initYear(year),
    onSuccess: () => { toast.success('Année initialisée'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });
  const closeMutation = useMutation({
    mutationFn: ({ annee, mois }: { annee: number; mois: number }) => comptabiliteApi.closePeriod(annee, mois),
    onSuccess: () => { toast.success('Période clôturée'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });
  const reopenMutation = useMutation({
    mutationFn: ({ annee, mois }: { annee: number; mois: number }) => comptabiliteApi.reopenPeriod(annee, mois),
    onSuccess: () => { toast.success('Période rouverte'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Exercices Comptables</h1>
        <div className="flex gap-2">
          <input type="number" value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} className="w-24 px-3 py-2 border rounded-lg text-sm" />
          <button onClick={() => initMutation.mutate(newYear)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"><Plus size={16} /> Initialiser</button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th><th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th></tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
            ) : periods.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">Aucune période — initialisez une année</td></tr>
            ) : (
              periods.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{p.mois}/{p.annee}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${p.isClosed ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>{p.isClosed ? 'CLÔTURÉE' : 'OUVERTE'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.isClosed ? (
                      <button onClick={() => reopenMutation.mutate({ annee: p.annee, mois: p.mois })} className="flex items-center gap-1 text-blue-600 hover:underline"><Unlock size={14} /> Rouvrir</button>
                    ) : (
                      <button onClick={() => closeMutation.mutate({ annee: p.annee, mois: p.mois })} className="flex items-center gap-1 text-gray-600 hover:underline"><Lock size={14} /> Clôturer</button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}