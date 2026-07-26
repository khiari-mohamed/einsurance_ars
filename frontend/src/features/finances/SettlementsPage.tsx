import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, FileText, Trash2 } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/currency';
import SettlementForm from './SettlementForm';
import SettlementDetails from './SettlementDetails';

// FIX (Finances pass): full rewrite against the real Settlement model
// (reference/mode/montant/currency/tauxRealisation/tauxReglement/
// dateSettlement/validatedAt) — the old version's numero/type/
// totalCommissionARS/soldeFinal fields don't exist.
export default function SettlementsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['settlements'],
    queryFn: async () => (await financesApi.getSettlements({ limit: 50 })).data,
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce règlement ?')) return;
    try {
      await financesApi.deleteSettlement(id);
      toast.success('Règlement supprimé');
      queryClient.invalidateQueries({ queryKey: ['settlements'] });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Règlements</h1>
        <Button onClick={() => setShowForm(true)}><Plus className="mr-2 h-4 w-4" /> Nouveau Règlement</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
                ) : (data?.data ?? []).length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Aucun règlement</td></tr>
                ) : (
                  (data?.data ?? []).map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium font-mono">{s.reference}</td>
                      <td className="px-4 py-3 text-sm"><Badge variant="outline">{s.mode}</Badge></td>
                      <td className="px-4 py-3 text-sm">{s.affaire?.numero || '-'}</td>
                      <td className="px-4 py-3 text-sm">{formatDate(s.dateSettlement)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{formatCurrency(s.montant, s.currency)}</td>
                      <td className="px-4 py-3">
                        <Badge className={s.validatedAt ? 'bg-green-500' : 'bg-gray-400'}>{s.validatedAt ? 'VALIDÉ' : 'EN ATTENTE'}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm space-x-2">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedId(s.id); setShowDetails(true); }}><FileText className="h-4 w-4" /></Button>
                        {!s.validatedAt && <Button size="sm" variant="outline" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Nouveau Règlement</DialogTitle></DialogHeader>
          <SettlementForm onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['settlements'] }); }} onCancel={() => setShowForm(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Détails du Règlement</DialogTitle></DialogHeader>
          {selectedId && <SettlementDetails settlementId={selectedId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}