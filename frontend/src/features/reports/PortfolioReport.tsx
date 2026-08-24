import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Filter, TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, Sector } from 'recharts';
import { reportingApi } from '../../api/reporting.api';

// Chart tokens only — chart-1 (gold) + chart-2..5 (rose/sage/blue/violet) + the
// semantic destructive/success/warning trio give 8 distinct, on-palette slices
// without introducing a single hardcoded hex outside the design system.
const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-3))',
  'hsl(var(--warning))',
  'hsl(var(--chart-5))',
  'hsl(var(--destructive))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-2))',
  'hsl(var(--success))',
];

// Light -> dark tint pairs for each COLORS entry, used to build the glossy gradients below.
// Same hues as COLORS, just given depth - nothing in the palette itself has changed.
const PIE_GRADIENTS: [string, string][] = [
  ['hsl(var(--chart-1))', 'hsl(var(--chart-1) / 0.6)'],
  ['hsl(var(--chart-3))', 'hsl(var(--chart-3) / 0.6)'],
  ['hsl(var(--warning))', 'hsl(var(--warning) / 0.6)'],
  ['hsl(var(--chart-5))', 'hsl(var(--chart-5) / 0.6)'],
  ['hsl(var(--destructive))', 'hsl(var(--destructive) / 0.6)'],
  ['hsl(var(--chart-4))', 'hsl(var(--chart-4) / 0.6)'],
  ['hsl(var(--chart-2))', 'hsl(var(--chart-2) / 0.6)'],
  ['hsl(var(--success))', 'hsl(var(--success) / 0.6)'],
];

// Flat colors for the bar-chart tooltip swatches (gradients aren't valid CSS colors on their own).
const BAR_DOT_COLOR: Record<string, string> = {
  primes: 'hsl(var(--chart-1))',
  sinistres: 'hsl(var(--destructive))',
  commissions: 'hsl(var(--chart-3))',
};

const formatTND = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(amount);

/** Frosted-glass tooltip shared by the bar chart and the donut chart. */
function GlassChartTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const title = label ?? payload[0]?.name ?? payload[0]?.payload?.name;
  return (
    <div className="backdrop-blur-xl bg-popover/90 border border-border rounded-[calc(var(--radius)-4px)] px-4 py-3 min-w-[170px]">
      {title && (
        <p className="text-[11px] font-mono-label text-muted-foreground mb-2">{title}</p>
      )}
      <div className="space-y-1.5">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: BAR_DOT_COLOR[entry.dataKey] || entry.payload?.fill || 'hsl(var(--muted-foreground))' }}
              />
              {entry.name}
            </span>
            <span className="font-semibold text-foreground">{formatTND(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Active (hovered) donut slice - pops out slightly with a soft glow. */
function renderActivePieShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 10}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      cornerRadius={8}
      style={{ filter: 'drop-shadow(0px 8px 16px rgba(0,0,0,0.45))' }}
    />
  );
}

/** Convert backend response to the array format the UI expects */
function toPerfArray(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  // Backend returns { totalAffaires, totalPrimes, totalCommission, groupBy }
  // Transform to an array of { name, primes, sinistres, commissions, affairesCount, tauxSinistralite, rentabilite }
  const items: any[] = [];
  if (data.branches && typeof data.branches === 'object') {
    for (const [name, vals] of Object.entries(data.branches as Record<string, any>)) {
      items.push({
        name,
        primes: vals.totalPrimes ?? vals.primes ?? 0,
        sinistres: vals.sinistres ?? 0,
        commissions: vals.totalCommission ?? vals.commissions ?? 0,
        affairesCount: vals.count ?? vals.affairesCount ?? 0,
        tauxSinistralite: 0,
        rentabilite: 0,
      });
    }
  }
  if (items.length === 0) {
    items.push({
      name: data.groupBy || 'Portfolio',
      primes: data.totalPrimes ?? 0,
      sinistres: data.totalSinistres ?? 0,
      commissions: data.totalCommission ?? 0,
      affairesCount: data.totalAffaires ?? 0,
      tauxSinistralite: 0,
      rentabilite: 0,
    });
  }
  // Calculate derived rates
  for (const item of items) {
    item.tauxSinistralite = item.primes > 0 ? (item.sinistres / item.primes) * 100 : 0;
    item.rentabilite = item.primes > 0 ? ((item.primes - item.sinistres - item.commissions) / item.primes) * 100 : 0;
  }
  return items;
}

function toConcArray(data: any): any {
  if (!data) return { top10Affaires: [], byCedante: [], concentrationIndex: 0 };
  if (Array.isArray(data)) return { top10Affaires: data, byCedante: [], concentrationIndex: 0 };
  // Backend returns { type, topConcentration: [{ entite, montant, partPct }] }
  const topConcentration = data.topConcentration ?? data.top10Affaires ?? [];
  return {
    top10Affaires: Array.isArray(topConcentration) ? topConcentration.map((c: any) => ({
      numeroAffaire: c.entite ?? c.numeroAffaire ?? '-',
      exposure: c.montant ?? c.exposure ?? 0,
    })) : [],
    byCedante: Array.isArray(topConcentration) ? topConcentration.slice(0, 5).map((c: any) => ({
      name: c.entite ?? c.name ?? '-',
      exposure: c.montant ?? c.exposure ?? 0,
    })) : [],
    concentrationIndex: topConcentration.length > 0 ? Math.max(...topConcentration.map((c: any) => c.partPct ?? 0)) : 0,
  };
}

export default function PortfolioReport() {
  const [filters, setFilters] = useState({ startDate: '', endDate: '', groupBy: 'branche' });
  const [showFilters, setShowFilters] = useState(false);
  const [activePieIndex, setActivePieIndex] = useState<number | undefined>(undefined);

  const { data: performance, isLoading } = useQuery({
    queryKey: ['portfolio-performance', filters],
    queryFn: () => reportingApi.getPortfolioPerformance(filters).then(r => r.data),
  });

  const { data: concentration } = useQuery({
    queryKey: ['risk-concentration'],
    queryFn: () => reportingApi.getRiskConcentration().then(r => r.data),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(amount);
  };

  const perfArray = toPerfArray(performance);
  const concObj = toConcArray(concentration);

  const exportToExcel = () => {
    const csv = [
      ['Nom', 'Primes', 'Sinistres', 'Commissions', 'Taux Sinistralité', 'Rentabilité', 'Affaires'],
      ...perfArray.map((p: any) => [
        p.name,
        p.primes,
        p.sinistres,
        p.commissions,
        (p.tauxSinistralite || 0).toFixed(2),
        (p.rentabilite || 0).toFixed(2),
        p.affairesCount
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (isLoading) return <div className="p-6 text-center font-mono-label text-xs text-muted-foreground">Chargement...</div>;

  const totalPrimes = perfArray.reduce((s: number, p: any) => s + (p.primes || 0), 0);
  const totalSinistres = perfArray.reduce((s: number, p: any) => s + (p.sinistres || 0), 0);
  const totalCommissions = perfArray.reduce((s: number, p: any) => s + (p.commissions || 0), 0);
  const avgSinistralite = totalPrimes > 0 ? (totalSinistres / totalPrimes) * 100 : 0;

  // Same perfArray, just carrying a flat color per slice so the donut's tooltip
  // swatch can show a real color even though the slice itself is filled with a gradient.
  const perfArrayWithColor = perfArray.map((p: any, i: number) => ({ ...p, fill: COLORS[i % COLORS.length] }));

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-mono-label text-[11px] text-primary mb-1">Portefeuille</p>
          <h1 className="font-display text-2xl font-semibold text-foreground">Rapport Portfolio</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-[calc(var(--radius)-4px)] text-foreground hover-elevate active-elevate-2"
          >
            <Filter size={18} />
            Filtrer
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-[calc(var(--radius)-4px)] font-medium hover-elevate active-elevate-2 border border-primary-border"
          >
            <Download size={18} />
            Exporter
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-card p-4 rounded-[var(--radius)] border border-border">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Date Début</label>
              <input
                type="date"
                className="w-full border border-border rounded-[calc(var(--radius)-6px)] p-2 bg-background text-foreground"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Date Fin</label>
              <input
                type="date"
                className="w-full border border-border rounded-[calc(var(--radius)-6px)] p-2 bg-background text-foreground"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">Grouper par</label>
              <select
                className="w-full border border-border rounded-[calc(var(--radius)-6px)] p-2 bg-background text-foreground"
                value={filters.groupBy}
                onChange={(e) => setFilters({ ...filters, groupBy: e.target.value })}
              >
                <option value="branche">Branche</option>
                <option value="cedante">Cédante</option>
                <option value="category">Type (Facultative/Traité)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Primes Totales"
          value={formatCurrency(totalPrimes)}
          icon={<TrendingUp />}
          color="blue"
        />
        <KPICard
          title="Sinistres"
          value={formatCurrency(totalSinistres)}
          icon={<TrendingDown />}
          color="red"
        />
        <KPICard
          title="Commissions ARS"
          value={formatCurrency(totalCommissions)}
          icon={<BarChart3 />}
          color="green"
        />
        <KPICard
          title="Taux Sinistralité"
          value={`${avgSinistralite.toFixed(1)}%`}
          icon={<PieChartIcon />}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative bg-card/80 backdrop-blur-xl rounded-[var(--radius)] p-5 border border-border overflow-hidden">
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-[hsl(var(--chart-3)/0.10)] rounded-full blur-3xl pointer-events-none" />
          <h3 className="relative font-display text-lg font-semibold text-foreground mb-4">Performance par {filters.groupBy === 'branche' ? 'Branche' : filters.groupBy === 'cedante' ? 'Cédante' : 'Type'}</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={perfArray} barGap={8} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradPrimes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" />
                    <stop offset="100%" stopColor="hsl(var(--chart-1) / 0.55)" />
                  </linearGradient>
                  <linearGradient id="barGradSinistres" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--destructive))" />
                    <stop offset="100%" stopColor="hsl(var(--destructive) / 0.55)" />
                  </linearGradient>
                  <linearGradient id="barGradCommissions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-3))" />
                    <stop offset="100%" stopColor="hsl(var(--chart-3) / 0.55)" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassChartTooltip />} cursor={{ fill: 'hsl(var(--primary) / 0.05)', radius: 8 } as any} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 16 }} formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>} />
                <Bar dataKey="primes" name="Primes" fill="url(#barGradPrimes)" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={800} animationEasing="ease-out" />
                <Bar dataKey="sinistres" name="Sinistres" fill="url(#barGradSinistres)" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={800} animationBegin={100} animationEasing="ease-out" />
                <Bar dataKey="commissions" name="Commissions" fill="url(#barGradCommissions)" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={800} animationBegin={200} animationEasing="ease-out" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative bg-card/80 backdrop-blur-xl rounded-[var(--radius)] p-5 border border-border overflow-hidden">
          <div className="absolute -top-16 -left-16 w-56 h-56 bg-[hsl(var(--chart-5)/0.10)] rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-[hsl(var(--warning)/0.10)] rounded-full blur-3xl pointer-events-none" />
          <h3 className="relative font-display text-lg font-semibold text-foreground mb-4">Distribution des Primes</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <defs>
                  {PIE_GRADIENTS.map((g, i) => (
                    <linearGradient key={i} id={`pieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={g[0]} />
                      <stop offset="100%" stopColor={g[1]} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={perfArrayWithColor}
                  dataKey="primes"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={104}
                  paddingAngle={3}
                  cornerRadius={6}
                  activeIndex={activePieIndex}
                  activeShape={renderActivePieShape}
                  onMouseEnter={(_: any, i: number) => setActivePieIndex(i)}
                  onMouseLeave={() => setActivePieIndex(undefined)}
                  label={({ name, primes }: any) => `${name}: ${totalPrimes > 0 ? ((primes / totalPrimes) * 100).toFixed(1) : 0}%`}
                  labelLine={{ stroke: 'hsl(var(--border))' } as any}
                >
                  {perfArray.map((_: any, i: number) => (
                    <Cell key={i} fill={`url(#pieGrad${i % PIE_GRADIENTS.length})`} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<GlassChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[11px] font-mono-label text-muted-foreground">Total Primes</span>
              <span className="text-lg font-display font-semibold text-foreground mt-0.5">{formatCurrency(totalPrimes)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-[var(--radius)] p-5 border border-border">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">Détails Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Nom</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Affaires</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Primes</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Sinistres</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Commissions</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Taux Sin.</th>
                <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Rentabilité</th>
              </tr>
            </thead>
            <tbody>
              {perfArray.map((p: any, i: number) => (
                <tr key={i} className="border-t border-border hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-right text-foreground">{(p.affairesCount ?? 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatCurrency(p.primes || 0)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatCurrency(p.sinistres || 0)}</td>
                  <td className="px-4 py-3 text-right text-foreground">{formatCurrency(p.commissions || 0)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded-[6px] text-xs border ${
                      (p.tauxSinistralite || 0) > 70 ? 'bg-destructive/15 text-destructive border-destructive/30' :
                      (p.tauxSinistralite || 0) > 50 ? 'bg-warning/15 text-warning border-warning/30' :
                      'bg-[hsl(var(--chart-3)/0.15)] border-[hsl(var(--chart-3)/0.3)]'
                    }`} style={(p.tauxSinistralite || 0) <= 50 && (p.tauxSinistralite || 0) <= 70 && !((p.tauxSinistralite || 0) > 70) && !((p.tauxSinistralite || 0) > 50) ? { color: 'hsl(var(--chart-3))' } : undefined}>
                      {(p.tauxSinistralite || 0).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold" style={{ color: (p.rentabilite || 0) > 0 ? 'hsl(var(--chart-3))' : 'hsl(var(--destructive))' }}>
                      {(p.rentabilite || 0).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card rounded-[var(--radius)] p-5 border border-border">
        <h3 className="font-display text-lg font-semibold text-foreground mb-4">Concentration des Risques</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Top 10</h4>
            <div className="space-y-2">
              {(concObj.top10Affaires || []).map((a: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-2 bg-secondary/40 border border-border/50 rounded-[calc(var(--radius)-6px)]">
                  <span className="text-sm font-medium text-foreground">{a.numeroAffaire}</span>
                  <span className="text-sm text-muted-foreground">{formatCurrency(a.exposure)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Concentration par Cédante</h4>
            <div className="space-y-2">
              {(concObj.byCedante || []).map((c: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-2 bg-secondary/40 border border-border/50 rounded-[calc(var(--radius)-6px)]">
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{formatCurrency(c.exposure)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-[calc(var(--radius)-4px)]">
          <p className="text-sm text-foreground">
            <strong className="text-primary">Indice de Concentration:</strong> {(concObj.concentrationIndex || 0).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  const styles: Record<string, { border: string; icon: string; glow: string }> = {
    blue: { border: 'border-l-primary', icon: 'text-primary', glow: 'bg-primary/12' },
    red: { border: 'border-l-destructive', icon: 'text-destructive', glow: 'bg-destructive/12' },
    green: { border: 'border-l-[hsl(var(--chart-3))]', icon: 'text-[hsl(var(--chart-3))]', glow: 'bg-[hsl(var(--chart-3)/0.12)]' },
    orange: { border: 'border-l-warning', icon: 'text-warning', glow: 'bg-warning/12' },
  };
  const s = styles[color] || styles.blue;
  return (
    <div className={`relative bg-card rounded-[var(--radius)] p-5 border border-border border-l-4 ${s.border} overflow-hidden`}>
      <div className={`absolute -top-8 -right-8 w-24 h-24 ${s.glow} rounded-full blur-2xl pointer-events-none`} />
      <div className="relative flex justify-between items-start mb-2">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <span className={s.icon}>{icon}</span>
      </div>
      <p className="relative text-2xl font-display font-semibold text-foreground">{value}</p>
    </div>
  );
}