import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Coins, RefreshCw } from 'lucide-react';
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

  const soldePositif = cashFlow ? cashFlow.soldeNet >= 0 : true;

  return (
    <div className="p-8 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-mono-label text-[11px] text-primary mb-1">Pilotage financier</p>
          <h1 className="font-display text-3xl font-semibold text-foreground">Tableau de Bord Financier</h1>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 rounded-[calc(var(--radius)-4px)] bg-card border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="week">Cette Semaine</SelectItem>
              <SelectItem value="month">Ce Mois</SelectItem>
              <SelectItem value="quarter">Ce Trimestre</SelectItem>
              <SelectItem value="year">Cette Année</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={loadDashboardData}
            disabled={loading}
            className="rounded-[calc(var(--radius)-4px)] border-border text-foreground hover-elevate active-elevate-2"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
        </div>
      </div>

      {cashFlow && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="relative bg-card border-border rounded-[var(--radius)] overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[hsl(var(--chart-3)/0.12)] rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="relative pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Encaissements</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 rounded-[calc(var(--radius)-4px)] bg-[hsl(var(--chart-3)/0.15)] border border-[hsl(var(--chart-3)/0.3)]">
                <TrendingUp className="h-4 w-4" style={{ color: 'hsl(var(--chart-3))' }} />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-display font-semibold" style={{ color: 'hsl(var(--chart-3))' }}>{formatCurrency(cashFlow.totalEncaissements)}</div>
              <p className="text-xs text-muted-foreground mt-1">{cashFlow.encaissements} transactions</p>
            </CardContent>
          </Card>

          <Card className="relative bg-card border-border rounded-[var(--radius)] overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-destructive/10 rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="relative pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Décaissements</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 rounded-[calc(var(--radius)-4px)] bg-destructive/15 border border-destructive/30">
                <TrendingDown className="h-4 w-4 text-destructive" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-2xl font-display font-semibold text-destructive">{formatCurrency(cashFlow.totalDecaissements)}</div>
              <p className="text-xs text-muted-foreground mt-1">{cashFlow.decaissements} transactions</p>
            </CardContent>
          </Card>

          {/* Solde Net — donnée clé, seule carte à porter l'accent or plein */}
          <Card className="relative bg-card border border-primary/30 rounded-[var(--radius)] overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/15 rounded-full blur-2xl pointer-events-none" />
            <CardHeader className="relative pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">Solde Net</CardTitle>
              <div className="flex items-center justify-center w-8 h-8 rounded-[calc(var(--radius)-4px)] bg-primary/15 border border-primary/30">
                <Coins className="h-4 w-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className={`text-2xl font-display font-semibold ${soldePositif ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(cashFlow.soldeNet)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="bg-card/80 backdrop-blur-xl border-border rounded-[var(--radius)]">
        <CardHeader>
          <CardTitle className="font-display font-semibold text-foreground">Encaissements vs Décaissements — période sélectionnée</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cashFlow ? [{ name: 'Période', encaissements: cashFlow.totalEncaissements, decaissements: cashFlow.totalDecaissements }] : []}>
              <defs>
                <linearGradient id="barGradEncaissements" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--chart-3))" />
                  <stop offset="100%" stopColor="hsl(var(--chart-3) / 0.55)" />
                </linearGradient>
                <linearGradient id="barGradDecaissements" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--destructive))" />
                  <stop offset="100%" stopColor="hsl(var(--destructive) / 0.55)" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 13 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v) => formatCurrency(Number(v))}
                contentStyle={{ background: 'hsl(var(--popover) / 0.95)', border: '1px solid hsl(var(--border))', borderRadius: 'calc(var(--radius) - 4px)', color: 'hsl(var(--foreground))' }}
                labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                cursor={{ fill: 'hsl(var(--primary) / 0.05)' }}
              />
              <Legend formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>} />
              <Bar dataKey="encaissements" fill="url(#barGradEncaissements)" name="Encaissements" radius={[8, 8, 0, 0]} maxBarSize={80} />
              <Bar dataKey="decaissements" fill="url(#barGradDecaissements)" name="Décaissements" radius={[8, 8, 0, 0]} maxBarSize={80} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-6">
        <Card className="bg-card border-border rounded-[var(--radius)]">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-foreground">Créances par Ancienneté</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agingCreances?.ranges?.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-secondary/50 border border-border/60 rounded-[calc(var(--radius)-4px)]">
                <div>
                  <p className="font-medium text-foreground">{r.label}</p>
                  <p className="text-sm text-muted-foreground">{r.count} mouvement(s)</p>
                </div>
                <p className="text-lg font-display font-semibold" style={{ color: 'hsl(var(--chart-4))' }}>{formatCurrency(r.montant)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="bg-card border-border rounded-[var(--radius)]">
          <CardHeader>
            <CardTitle className="font-display font-semibold text-foreground">Dettes par Ancienneté</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {agingDettes?.ranges?.map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-secondary/50 border border-border/60 rounded-[calc(var(--radius)-4px)]">
                <div>
                  <p className="font-medium text-foreground">{r.label}</p>
                  <p className="text-sm text-muted-foreground">{r.count} mouvement(s)</p>
                </div>
                <p className="text-lg font-display font-semibold text-destructive">{formatCurrency(r.montant)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}