import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { soldeDirectionLabels, SituationSoldeDirection } from '@/types/finance.types';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/currency';
import SituationBuilder from './SituationBuilder';

const soldeColors: Record<SituationSoldeDirection, string> = {
  [SituationSoldeDirection.CEDANTE_DOIT]: 'bg-green-100 text-green-700',
  [SituationSoldeDirection.ARS_DOIT]: 'bg-orange-100 text-orange-700',
  [SituationSoldeDirection.EQUILIBRE]: 'bg-gray-100 text-gray-700',
};

// NEW (Finances pass): a real list view for Situations was entirely
// missing — the old SettlementsPage.tsx was actually trying to be this,
// but built against an invented model. This is the real one.
export default function SituationsPage() {
  const queryClient = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['situations'],
    queryFn: async () => (await financesApi.getSituations({ limit: 50 })).data,
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette situation ? Impossible si des règlements ou bordereaux y sont déjà liés.')) return;
    try {
      await financesApi.deleteSituation(id);
      toast.success('Situation supprimée');
      queryClient.invalidateQueries({ queryKey: ['situations'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Situations de Règlement</h1>
        <Button onClick={() => setShowBuilder(true)}><Plus className="mr-2 h-4 w-4" /> Compiler une Situation</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cédante</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Période</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Débit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Crédit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Solde</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
                ) : (data?.data ?? []).length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Aucune situation</td></tr>
                ) : (
                  (data?.data ?? []).map((s) => (
                    <>
                      <tr key={s.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}>
                        <td className="px-4 py-3 text-sm font-medium font-mono">{s.reference}</td>
                        <td className="px-4 py-3 text-sm">{s.cedante?.raisonSociale}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(s.dateDebut)} - {formatDate(s.dateFin)}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(s.totalDebit ?? 0, s.currency)}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatCurrency(s.totalCredit ?? 0, s.currency)}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold">{formatCurrency(s.soldeNet ?? 0, s.currency)}</td>
                        <td className="px-4 py-3">
                          {s.soldeDirection && <Badge className={soldeColors[s.soldeDirection]}>{soldeDirectionLabels[s.soldeDirection]}</Badge>}
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}><Trash2 size={14} /></Button>
                        </td>
                      </tr>
                      {expandedId === s.id && (
                        <tr>
                          <td colSpan={8} className="px-4 py-3 bg-gray-50">
                            <div className="text-xs text-gray-500 mb-2">{s.lines.length} ligne(s) — {s._count?.settlements ?? 0} règlement(s) lié(s), {s._count?.bordereaux ?? 0} bordereau(x)</div>
                            <table className="w-full text-xs">
                              <thead><tr className="text-gray-500"><th className="text-left py-1">Affaire</th><th className="text-right py-1">Débit</th><th className="text-right py-1">Crédit</th><th className="text-right py-1">Solde</th></tr></thead>
                              <tbody>
                                {s.lines.map((l) => (
                                  <tr key={l.id} className="border-t"><td className="py-1 font-mono">{l.affaire?.numero}</td><td className="py-1 text-right">{formatCurrency(l.debit ?? 0, s.currency)}</td><td className="py-1 text-right">{formatCurrency(l.credit ?? 0, s.currency)}</td><td className="py-1 text-right">{formatCurrency(l.solde ?? 0, s.currency)}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Compiler une Situation</DialogTitle></DialogHeader>
          <SituationBuilder onCreated={() => setShowBuilder(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}