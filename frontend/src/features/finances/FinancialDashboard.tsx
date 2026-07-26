import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, DollarSign, RefreshCw } from 'lucide-react';
import { financesApi } from '@/api/finances.api';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/currency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// FIX (Finances pass): the "Évolution des Flux" chart previously plotted
// hardcoded fake weekly numbers (45000/52000/48000/61000...) unrelated to
// any real data — no weekly-breakdown endpoint exists. Replaced with a
// simple, honest two-bar comparison of the real period totals. Also fixed
// the response-unwrapping — financesApi now returns the raw axios promise
// (matching every other *.api.ts in this app), so `const {data} = await ...`
// is correct; the old `(x as any)?.data || x` double-unwrap hack is gone.
export default function FinancialDashboard() {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('month');
  const [cashFlow, setCashFlow] = useState<any>(null);
  const [agingCreances, setAgingCreances] = useState<any>(null);
  const [agingDettes, setAgingDettes] = useState<any>(null);

  useEffect(() => { loadDashboardData(); }, [period]);

  const getPeriodDates = (p: string) => {
    const now = new Date();
    let startDate: Date;
    switch (p) {
      case 'week': startDate = new Date(now.getTime() - 7 * 86400000); break;
      case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'quarter': startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1); break;
      case 'year': startDate = new Date(now.getFullYear(), 0, 1); break;
      default: startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { startDate: startDate.toISOString().split('T')[0], endDate: now.toISOString().split('T')[0] };
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getPeriodDates(period);
      const [cf, cr, dt] = await Promise.all([
        financesApi.getCashFlowReport(startDate, endDate),
        financesApi.getAgingReport('creances'),
        financesApi.getAgingReport('dettes'),
      ]);
      setCashFlow(cf.data);
      setAgingCreances(cr.data);
      setAgingDettes(dt.data);
    } catch {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Tableau de Bord Financier</h1>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Cette Semaine</SelectItem>
              <SelectItem value="month">Ce Mois</SelectItem>
              <SelectItem value="quarter">Ce Trimestre</SelectItem>
              <SelectItem value="year">Cette Année</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadDashboardData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
        </div>
      </div>

      {cashFlow && (
        <div className="grid grid-cols-3 gap-4">
          <Card><CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Encaissements</CardTitle><TrendingUp className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(cashFlow.totalEncaissements)}</div><p className="text-xs text-gray-500">{cashFlow.encaissements} transactions</p></CardContent></Card>
          <Card><CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Décaissements</CardTitle><TrendingDown className="h-4 w-4 text-red-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(cashFlow.totalDecaissements)}</div><p className="text-xs text-gray-500">{cashFlow.decaissements} transactions</p></CardContent></Card>
          <Card><CardHeader className="pb-2 flex-row items-center justify-between"><CardTitle className="text-sm font-medium">Solde Net</CardTitle><DollarSign className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className={`text-2xl font-bold ${cashFlow.soldeNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(cashFlow.soldeNet)}</div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle>Encaissements vs Décaissements — période sélectionnée</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cashFlow ? [{ name: 'Période', encaissements: cashFlow.totalEncaissements, decaissements: cashFlow.totalDecaissements }] : []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 13 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 13 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="encaissements" fill="#10b981" name="Encaissements" radius={[8, 8, 0, 0]} maxBarSize={80} />
              <Bar dataKey="decaissements" fill="#ef4444" name="Décaissements" radius={[8, 8, 0, 0]} maxBarSize={80} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Créances par Ancienneté</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {agingCreances?.ranges?.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div><p className="font-medium">{r.label}</p><p className="text-sm text-gray-600">{r.count} mouvement(s)</p></div>
                <p className="text-lg font-bold text-blue-600">{formatCurrency(r.montant)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Dettes par Ancienneté</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {agingDettes?.ranges?.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div><p className="font-medium">{r.label}</p><p className="text-sm text-gray-600">{r.count} mouvement(s)</p></div>
                <p className="text-lg font-bold text-red-600">{formatCurrency(r.montant)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}