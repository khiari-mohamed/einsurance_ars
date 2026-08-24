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
        <h1 className="font-display text-2xl font-semibold text-foreground">Exercices Comptables</h1>
        <div className="flex gap-2">
          <input type="number" value={newYear} onChange={(e) => setNewYear(Number(e.target.value))} className="w-24 px-3 py-2 border border-border bg-background rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2" />
          <button onClick={() => initMutation.mutate(newYear)} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"><Plus size={16} /> Initialiser</button>
        </div>
      </div>

      <div className="bg-card rounded-[var(--radius)] border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted">
            <tr><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Période</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Statut</th><th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Action</th></tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Chargement...</td></tr>
            ) : periods.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">Aucune période — initialisez une année</td></tr>
            ) : (
              periods.map((p) => (
                <tr key={p.id} className="hover:bg-muted/60">
                  <td className="px-4 py-3 text-sm">{p.mois}/{p.annee}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs border ${p.isClosed ? 'bg-destructive/15 text-destructive border-destructive/30' : 'bg-success/15 text-success border-success/30'}`}>{p.isClosed ? 'CLÔTURÉE' : 'OUVERTE'}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {p.isClosed ? (
                      <button onClick={() => reopenMutation.mutate({ annee: p.annee, mois: p.mois })} className="flex items-center gap-1 text-primary hover:underline"><Unlock size={14} /> Rouvrir</button>
                    ) : (
                      <button onClick={() => closeMutation.mutate({ annee: p.annee, mois: p.mois })} className="flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"><Lock size={14} /> Clôturer</button>
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