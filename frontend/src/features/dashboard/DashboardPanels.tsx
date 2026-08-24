import { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, AlertTriangle, Target, Download, Calendar } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DashboardPanels() {
  const [viewMode, setViewMode] = useState<'affaire' | 'cedante' | 'reassureur' | 'combined'>('combined');
  const [period, setPeriod] = useState('2024');
  const [caData, setCAData] = useState<any>(null);
  const [primesData, setPrimesData] = useState<any>(null);
  const [budgetData, setBudgetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [viewMode, period]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [ca, primes, budget] = await Promise.all([
        fetch(`/api/reporting/chiffre-affaires?mode=${viewMode}&period=${period}`).then(r => r.json()),
        fetch(`/api/reporting/primes-aging?period=${period}`).then(r => r.json()),
        fetch(`/api/reporting/budget-vs-actual?period=${period}`).then(r => r.json()),
      ]);
      setCAData(ca);
      setPrimesData(primes);
      setBudgetData(budget);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Chargement des données...</p>
        </div>
      </div>
    );
  }

  const VIEW_MODES: { key: typeof viewMode; label: string }[] = [
    { key: 'affaire', label: 'Par Affaire' },
    { key: 'cedante', label: 'Par Cédante' },
    { key: 'reassureur', label: 'Par Réassureur' },
    { key: 'combined', label: 'Combiné' },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-foreground">Tableau de Bord</h1>
        <div className="flex gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border border-input bg-background text-foreground rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="Q1-2024">Q1 2024</option>
            <option value="Q2-2024">Q2 2024</option>
            <option value="Q3-2024">Q3 2024</option>
            <option value="Q4-2024">Q4 2024</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <Download size={16} />
            Exporter
          </button>
        </div>
      </div>

      {/* Panel 1: Chiffre d'Affaires */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-primary" size={24} />
            <h2 className="font-display text-xl font-semibold text-foreground">Chiffre d'Affaires</h2>
          </div>
          {/* Segmented pill control — same pattern as the exchange-rate widget tabs */}
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-secondary p-0.5">
            {VIEW_MODES.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">CA Total</p>
            <p className="font-display text-2xl font-semibold text-primary">{caData?.total?.toLocaleString() || '0'} TND</p>
            <p className="text-xs text-success mt-1">+12.5% vs année précédente</p>
          </div>
          <div className="bg-success/10 border border-success/20 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Facultatives</p>
            <p className="font-display text-2xl font-semibold text-success">{caData?.facultatives?.toLocaleString() || '0'} TND</p>
            <p className="text-xs text-muted-foreground mt-1">{caData?.facultativesPercent || 0}% du total</p>
          </div>
          <div className="bg-[hsl(var(--chart-5)/0.10)] border border-[hsl(var(--chart-5)/0.20)] p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Traités</p>
            <p className="font-display text-2xl font-semibold text-[hsl(var(--chart-5))]">{caData?.traites?.toLocaleString() || '0'} TND</p>
            <p className="text-xs text-muted-foreground mt-1">{caData?.traitesPercent || 0}% du total</p>
          </div>
          <div className="bg-warning/10 border border-warning/20 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Commissions ARS</p>
            <p className="font-display text-2xl font-semibold text-warning">{caData?.commissions?.toLocaleString() || '0'} TND</p>
            <p className="text-xs text-muted-foreground mt-1">Marge moyenne: {caData?.marginPercent || 0}%</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={caData?.chartData || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'calc(var(--radius) - 2px)',
                color: 'hsl(var(--popover-foreground))',
              }}
            />
            <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Bar dataKey="montant" fill="hsl(var(--primary))" name="Montant (TND)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Panel 2: Primes Encaissées vs Non Encaissées */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="text-success" size={24} />
          <h2 className="font-display text-xl font-semibold text-foreground">État des Primes</h2>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-success/10 border border-success/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Encaissées</p>
                <p className="font-display text-2xl font-semibold text-success">{primesData?.encaissees?.toLocaleString() || '0'} TND</p>
              </div>
              <div className="bg-destructive/10 border border-destructive/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Non Encaissées</p>
                <p className="font-display text-2xl font-semibold text-destructive">{primesData?.nonEncaissees?.toLocaleString() || '0'} TND</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Encaissées', value: primesData?.encaissees || 0 },
                    { name: 'Non Encaissées', value: primesData?.nonEncaissees || 0 },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${((entry.value / (primesData?.encaissees + primesData?.nonEncaissees)) * 100).toFixed(1)}%`}
                  outerRadius={80}
                  fill="hsl(var(--muted))"
                  dataKey="value"
                >
                  <Cell fill="hsl(var(--success))" />
                  <Cell fill="hsl(var(--destructive))" />
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'calc(var(--radius) - 2px)',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2 text-foreground">
              <AlertTriangle className="text-warning" size={18} />
              Aging des Créances
            </h3>
            <div className="space-y-3">
              {[
                { label: '0-30 jours', value: primesData?.aging?.['0-30'] || 0, color: 'bg-success' },
                { label: '31-60 jours', value: primesData?.aging?.['31-60'] || 0, color: 'bg-warning' },
                { label: '61-90 jours', value: primesData?.aging?.['61-90'] || 0, color: 'bg-[hsl(var(--chart-2))]' },
                { label: '90+ jours', value: primesData?.aging?.['90+'] || 0, color: 'bg-destructive' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground">{item.label}</span>
                    <span className="font-semibold text-foreground">{item.value.toLocaleString()} TND</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`${item.color} h-2 rounded-full`}
                      style={{ width: `${(item.value / (primesData?.nonEncaissees || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Panel 3: Budget vs Actuel */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Target className="text-[hsl(var(--chart-5))]" size={24} />
          <h2 className="font-display text-xl font-semibold text-foreground">Budget vs Réalisé</h2>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-[hsl(var(--chart-5)/0.10)] border border-[hsl(var(--chart-5)/0.20)] p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Budget Annuel</p>
            <p className="font-display text-2xl font-semibold text-[hsl(var(--chart-5))]">{budgetData?.budget?.toLocaleString() || '0'} TND</p>
          </div>
          <div className="bg-primary/10 border border-primary/20 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Réalisé</p>
            <p className="font-display text-2xl font-semibold text-primary">{budgetData?.actual?.toLocaleString() || '0'} TND</p>
          </div>
          <div className={`p-4 rounded-lg border ${(budgetData?.variance || 0) >= 0 ? 'bg-success/10 border-success/20' : 'bg-destructive/10 border-destructive/20'}`}>
            <p className="text-sm text-muted-foreground mb-1">Écart</p>
            <p className={`font-display text-2xl font-semibold ${(budgetData?.variance || 0) >= 0 ? 'text-success' : 'text-destructive'}`}>
              {(budgetData?.variance || 0) >= 0 ? '+' : ''}{budgetData?.variance?.toFixed(1) || '0'}%
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={budgetData?.monthlyData || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'calc(var(--radius) - 2px)',
                color: 'hsl(var(--popover-foreground))',
              }}
            />
            <Legend wrapperStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
            <Line type="monotone" dataKey="budget" stroke="hsl(var(--chart-5))" name="Budget" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" name="Réalisé" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Panel 4: Rapport Trimestriel */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="text-primary" size={24} />
            <h2 className="font-display text-xl font-semibold text-foreground">Rapport Trimestriel CA</h2>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <Download size={16} />
            Télécharger PDF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/40">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">Trimestre</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Facultatives</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Traités</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Total CA</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">Évolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(budgetData?.quarterlyReport || []).map((q: any) => (
                <tr key={q.quarter} className="hover:bg-secondary/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{q.quarter}</td>
                  <td className="px-4 py-3 text-right text-foreground">{q.facultatives?.toLocaleString()} TND</td>
                  <td className="px-4 py-3 text-right text-foreground">{q.traites?.toLocaleString()} TND</td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">{q.total?.toLocaleString()} TND</td>
                  <td className={`px-4 py-3 text-right font-semibold ${q.evolution >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {q.evolution >= 0 ? '+' : ''}{q.evolution}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}