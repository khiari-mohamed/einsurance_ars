import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Trash2 } from 'lucide-react';
import comptabiliteApi from '@/api/comptabilite.api';
import { formatCurrency, formatDate } from '@/lib/currency';
import { toast } from 'sonner';

export default function JournalEntries() {
  const queryClient = useQueryClient();
  const [statut, setStatut] = useState<'' | 'BROUILLON' | 'VALIDE'>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['journal-entries', statut],
    queryFn: async () => (await comptabiliteApi.getEntries({ statut: (statut || undefined) as any, limit: 100 })).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['journal-entries'] });

  const validateMutation = useMutation({
    mutationFn: (id: string) => comptabiliteApi.validateEntry(id),
    onSuccess: () => { toast.success('Écriture validée'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => comptabiliteApi.deleteEntry(id),
    onSuccess: () => { toast.success('Écriture supprimée'); invalidate(); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  const entries = data?.data ?? [];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Écritures Comptables</h1>
        <select value={statut} onChange={(e) => setStatut(e.target.value as any)} className="px-3 py-2 border rounded-lg text-sm">
          <option value="">Toutes</option>
          <option value="BROUILLON">Brouillon</option>
          <option value="VALIDE">Validées</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Numéro</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affaire</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucune écriture</td></tr>
            ) : (
              entries.map((e) => (
                <>
                  <tr key={e.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                    <td className="px-4 py-3 text-sm font-mono">{e.numero}</td>
                    <td className="px-4 py-3 text-sm">{e.type}</td>
                    <td className="px-4 py-3 text-sm">{e.affaire?.numero || '-'}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(e.createdAt)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${e.statut === 'VALIDE' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{e.statut}</span>
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2" onClick={(ev) => ev.stopPropagation()}>
                      {e.statut === 'BROUILLON' && (
                        <>
                          <button onClick={() => validateMutation.mutate(e.id)} className="p-1.5 rounded hover:bg-green-50 text-green-600" title="Valider"><CheckCircle size={16} /></button>
                          <button onClick={() => deleteMutation.mutate(e.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Supprimer"><Trash2 size={16} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                  {expandedId === e.id && (
                    <tr><td colSpan={6} className="px-4 py-3 bg-gray-50">
                      <p className="text-xs text-gray-500 mb-2">{e.description}</p>
                      <table className="w-full text-xs">
                        <thead><tr className="text-gray-500"><th className="text-left py-1">Compte</th><th className="text-right py-1">Débit</th><th className="text-right py-1">Crédit</th></tr></thead>
                        <tbody>
                          {e.lines.map((l: any) => (
                            <tr key={l.id} className="border-t"><td className="py-1 font-mono">{l.planComptable?.compte} — {l.libelle}</td><td className="py-1 text-right">{l.debit ? formatCurrency(l.debit) : '-'}</td><td className="py-1 text-right">{l.credit ? formatCurrency(l.credit) : '-'}</td></tr>
                          ))}
                        </tbody>
                      </table>
                    </td></tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}