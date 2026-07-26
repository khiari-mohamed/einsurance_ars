import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';

// FIX (Finances pass): full rewrite. Commissions are NOT a separate entity
// with a numero/taux/tauxOverride/statut lifecycle — they're read-only
// AffaireReassureur participation lines (partPct/commissionMode/
// primeBrute/commissionArs/commissionCedante), created exclusively through
// the Affaires module. This page is now read + mark-paid only, matching
// what /finances/commissions actually supports.
export default function CommissionsPage() {
  const queryClient = useQueryClient();
  const [paidFilter, setPaidFilter] = useState<'' | 'paid' | 'unpaid'>('');
  const [payingId, setPayingId] = useState<string | null>(null);
  const [decaissementId, setDecaissementId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['commissions', paidFilter],
    queryFn: async () => (await financesApi.getCommissions({ paid: paidFilter || undefined, limit: 100 })).data,
  });

  const lines = data?.data ?? [];
  const totalCommissionArs = lines.reduce((s, l) => s + (l.commissionArs ?? 0), 0);
  const paidCount = lines.filter((l) => l.commissionPaidAt).length;
  const unpaidCount = lines.length - paidCount;
  const totalUnpaid = lines.filter((l) => !l.commissionPaidAt).reduce((s, l) => s + (l.commissionArs ?? 0), 0);

  const handleMarkPaid = async () => {
    if (!payingId || !decaissementId) return;
    try {
      await financesApi.markCommissionPaid(payingId, decaissementId);
      toast.success('Commission marquée comme payée');
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
      setPayingId(null);
      setDecaissementId('');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Commissions de Réassurance</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Commission ARS</CardTitle>
            <DollarSign className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-purple-600">{formatCurrency(totalCommissionArs)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">À Payer</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatCurrency(totalUnpaid)}</div>
            <p className="text-xs text-gray-500">{unpaidCount} ligne(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Payées</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{paidCount}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Select value={paidFilter} onValueChange={(v) => setPaidFilter(v as any)}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Toutes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes</SelectItem>
              <SelectItem value="paid">Payées</SelectItem>
              <SelectItem value="unpaid">Non payées</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Réassureur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prime Brute</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Commission ARS</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {isLoading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Chargement...</td></tr>
                ) : lines.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Aucune commission</td></tr>
                ) : (
                  lines.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono">{c.affaire?.numero || '-'}</td>
                      <td className="px-4 py-3 text-sm">{c.reassureur?.raisonSociale}</td>
                      <td className="px-4 py-3 text-sm">{c.partPct}%</td>
                      <td className="px-4 py-3 text-sm">{formatCurrency(c.primeBrute ?? 0, c.affaire?.currency)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-green-600">{formatCurrency(c.commissionArs ?? 0, c.affaire?.currency)}</td>
                      <td className="px-4 py-3">
                        <Badge className={c.commissionPaidAt ? 'bg-green-500' : 'bg-yellow-500'}>
                          {c.commissionPaidAt ? 'PAYÉE' : 'NON PAYÉE'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {!c.commissionPaidAt && (
                          <Button size="sm" onClick={() => setPayingId(c.id)}>Marquer payée</Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!payingId} onOpenChange={(o) => !o && setPayingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Marquer la commission comme payée</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">ID du décaissement correspondant</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              value={decaissementId}
              onChange={(e) => setDecaissementId(e.target.value)}
              placeholder="uuid du décaissement au réassureur"
            />
            <p className="text-[11px] text-gray-400">
              Le décaissement doit correspondre au même réassureur que cette ligne de commission.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPayingId(null)}>Annuler</Button>
              <Button onClick={handleMarkPaid} disabled={!decaissementId}>Confirmer</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}