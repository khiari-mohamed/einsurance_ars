import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { financesApi } from '@/api/finances.api';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@/lib/currency';

interface Props { settlementId: string }

// FIX (Finances pass): full rewrite. Removed every invented section —
// lignes[], historique[], approbations[], soldePrecedent/gainPerteChange —
// none of that exists on the real Settlement. Shows what's actually there:
// FX rates, linked encaissements/decaissements, and validate/calculate
// actions matching the real workflow.
export default function SettlementDetails({ settlementId }: Props) {
  const queryClient = useQueryClient();
  const { data: settlement, isLoading } = useQuery({
    queryKey: ['settlement', settlementId],
    queryFn: async () => (await financesApi.getSettlement(settlementId)).data,
  });

  const calcMutation = useMutation({
    mutationFn: () => financesApi.calculateSettlement(settlementId),
    onSuccess: () => { toast.success('Montant TND recalculé'); queryClient.invalidateQueries({ queryKey: ['settlement', settlementId] }); },
  });
  const validateMutation = useMutation({
    mutationFn: () => financesApi.validateSettlement(settlementId),
    onSuccess: () => { toast.success('Règlement validé'); queryClient.invalidateQueries({ queryKey: ['settlement', settlementId] }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erreur'),
  });

  if (isLoading || !settlement) return <div>Chargement...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Règlement {settlement.reference}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div><p className="text-sm text-gray-600">Mode</p><p className="font-semibold">{settlement.mode}</p></div>
            <div><p className="text-sm text-gray-600">Affaire</p><p className="font-semibold">{settlement.affaire?.numero || '-'}</p></div>
            <div><p className="text-sm text-gray-600">Date</p><p className="font-semibold">{formatDate(settlement.dateSettlement)}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Montants</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg"><p className="text-sm text-gray-600">Montant</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(settlement.montant, settlement.currency)}</p></div>
            <div className="p-4 bg-green-50 rounded-lg"><p className="text-sm text-gray-600">Équivalent TND</p><p className="text-2xl font-bold text-green-600">{formatCurrency(settlement.montantTnd ?? settlement.montant, 'TND')}</p></div>
            {settlement.tauxRealisation != null && <div className="p-4 bg-gray-50 rounded-lg"><p className="text-sm text-gray-600">Taux réalisation</p><p className="text-lg font-semibold">{settlement.tauxRealisation}</p></div>}
            {settlement.tauxReglement != null && <div className="p-4 bg-gray-50 rounded-lg"><p className="text-sm text-gray-600">Taux règlement</p><p className="text-lg font-semibold">{settlement.tauxReglement}</p></div>}
          </div>
          <div className="mt-4 flex items-center gap-3">
            {settlement.validatedAt ? (
              <Badge className="bg-green-500">VALIDÉ le {formatDate(settlement.validatedAt)}</Badge>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => calcMutation.mutate()} disabled={calcMutation.isPending}>Recalculer TND</Button>
                <Button size="sm" onClick={() => validateMutation.mutate()} disabled={validateMutation.isPending}>Valider</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {((settlement.encaissements?.length ?? 0) > 0 || (settlement.decaissements?.length ?? 0) > 0) && (
        <Card>
          <CardHeader><CardTitle>Mouvements liés</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {settlement.encaissements?.map((e) => (
              <div key={e.id} className="flex justify-between p-2 bg-green-50 rounded text-sm"><span className="font-mono">{e.reference}</span><span className="font-semibold">{formatCurrency(e.montant, e.currency)}</span></div>
            ))}
            {settlement.decaissements?.map((d) => (
              <div key={d.id} className="flex justify-between p-2 bg-red-50 rounded text-sm"><span className="font-mono">{d.reference}</span><span className="font-semibold">{formatCurrency(d.montant, d.currency)}</span></div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}