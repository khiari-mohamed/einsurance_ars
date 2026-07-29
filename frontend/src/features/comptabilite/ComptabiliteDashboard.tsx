import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle, Calendar, TrendingUp } from 'lucide-react';
import comptabiliteApi from '@/api/comptabilite.api';
import { formatCurrency } from '@/lib/currency';

// FIX (Comptabilité pass): full rewrite against the real endpoints —
// getEntries(statut=BROUILLON), getCurrentPeriod(), getProfitLoss().
export default function ComptabiliteDashboard() {
  const { data: brouillon } = useQuery({
    queryKey: ['entries-brouillon'],
    queryFn: async () => (await comptabiliteApi.getEntries({ statut: 'BROUILLON' as any, limit: 100 })).data,
  });
  const { data: period } = useQuery({
    queryKey: ['fiscal-period-current'],
    queryFn: async () => (await comptabiliteApi.getCurrentPeriod()).data,
  });
  const { data: pl } = useQuery({
    queryKey: ['profit-loss-current'],
    queryFn: async () => (await comptabiliteApi.getProfitLoss()).data,
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Comptabilité</h1>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">En Brouillon</CardTitle><FileText className="h-4 w-4 text-amber-600" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-amber-600">{brouillon?.total ?? 0}</div><p className="text-xs text-gray-500">écritures à valider</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Période courante</CardTitle><Calendar className="h-4 w-4 text-blue-600" /></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{period ? `${period.mois}/${period.annee}` : '-'}</div>
            {period && <Badge className={period.isClosed ? 'bg-red-500' : 'bg-green-500'}>{period.isClosed ? 'CLÔTURÉE' : 'OUVERTE'}</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Produits (année)</CardTitle><TrendingUp className="h-4 w-4 text-green-600" /></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(pl?.totalProduits ?? 0)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Résultat Net</CardTitle><CheckCircle className="h-4 w-4 text-purple-600" /></CardHeader>
          <CardContent><div className={`text-2xl font-bold ${(pl?.resultatNet ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(pl?.resultatNet ?? 0)}</div></CardContent>
        </Card>
      </div>

      {brouillon && brouillon.data.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Écritures en attente de validation</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {brouillon.data.slice(0, 10).map((e) => (
              <div key={e.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-lg text-sm">
                <div><span className="font-mono font-medium">{e.numero}</span> — {e.description}</div>
                <Badge variant="outline">{e.type}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}