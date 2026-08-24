import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, ComposedChart, Line, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Sector } from 'recharts';
import { sinistresApi } from '../../api/sinistres.api';
import { formatCurrency } from '../../lib/currency';
import { STATUT_LABELS } from '../../types/sinistre.types';

// Chart 1 (gold) réservé aux données clés du graphe d'évolution.
// Les 4 autres slots (rose / sage / bleu / violet) couvrent le reste
// de la variété de séries/statuts — jamais de couleur hors palette.
const PIE_GRADIENTS: [string, string][] = [
  ['hsl(var(--chart-1))', 'hsl(var(--chart-1) / 0.65)'],
  ['hsl(var(--chart-2))', 'hsl(var(--chart-2) / 0.65)'],
  ['hsl(var(--chart-3))', 'hsl(var(--chart-3) / 0.65)'],
  ['hsl(var(--chart-4))', 'hsl(var(--chart-4) / 0.65)'],
  ['hsl(var(--chart-5))', 'hsl(var(--chart-5) / 0.65)'],
];

function GlassChartTooltip({ active, payload, label, dotColors, formatValue }: any) {
  if (!active || !payload || !payload.length) return null;
  const title = label ?? payload[0]?.payload?.status ?? payload[0]?.name ?? payload[0]?.payload?.name;
  const fmt = (v: any) => (formatValue ? formatValue(v) : (typeof v === 'number' ? v.toLocaleString('fr-FR') : v));
  return (
    <div className="backdrop-blur-xl bg-popover/90 border border-border rounded-[calc(var(--radius)-4px)] shadow-[0_8px_30px_rgba(0,0,0,0.35)] px-4 py-3 min-w-[170px]">
      {title && <p className="text-[11px] font-mono-label text-muted-foreground mb-2">{title}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColors?.[entry.dataKey] || entry.payload?.fill || entry.color || 'hsl(var(--muted-foreground))' }} />
              {entry.name || entry.payload?.status}
            </span>
            <span className="font-semibold text-foreground">{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderActivePieShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} cornerRadius={8} style={{ filter: 'drop-shadow(0px 8px 16px rgba(0,0,0,0.45))' }} />
  );
}

export default function SinistreAnalytics() {
  const { data: evolution } = useQuery({
    queryKey: ['sinistres-evolution'],
    queryFn: async () => (await sinistresApi.getEvolution(12)).data,
  });

  const { data: byCedante } = useQuery({
    queryKey: ['sinistres-by-cedante'],
    queryFn: async () => (await sinistresApi.getByCedante(10)).data,
  });

  const { data: byStatusRaw } = useQuery({
    queryKey: ['sinistres-by-status'],
    queryFn: async () => (await sinistresApi.getByStatus()).data,
  });
  const byStatus = byStatusRaw?.map((s) => ({ ...s, status: STATUT_LABELS[s.status as keyof typeof STATUT_LABELS] ?? s.status }));

  const { data: aging } = useQuery({
    queryKey: ['sinistres-aging'],
    queryFn: async () => (await sinistresApi.getAging()).data,
  });

  const { data: kpis } = useQuery({
    queryKey: ['sinistres-kpis'],
    queryFn: async () => (await sinistresApi.getKpis()).data,
  });

  const agingData = aging ? Object.entries(aging).map(([key, value]) => ({ name: key, count: value.count, amount: value.amount })) : [];

  return (
    <div className="p-8 space-y-6">
      <h1 className="font-display text-3xl font-semibold text-foreground">Analytiques Sinistres</h1>

      {kpis && (
        <div className="grid grid-cols-4 gap-4">
          {/* Réserves Totales — donnée clé, seule à porter l'accent or plein */}
          <div className="relative bg-card p-4 rounded-[var(--radius)] border border-primary/30 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/15 rounded-full blur-2xl pointer-events-none" />
            <div className="relative text-sm text-muted-foreground">Réserves Totales</div>
            <div className="relative text-2xl font-display font-semibold text-primary">{formatCurrency(kpis.reservesTotales)}</div>
          </div>

          <div className="bg-card p-4 rounded-[var(--radius)] border border-border">
            <div className="text-sm text-muted-foreground">Part Réassureurs</div>
            <div className="text-2xl font-display font-semibold" style={{ color: 'hsl(var(--chart-4))' }}>{formatCurrency(kpis.partReassureursTotale)}</div>
          </div>

          <div className="bg-card p-4 rounded-[var(--radius)] border border-border">
            <div className="text-sm text-muted-foreground">SAP Total</div>
            <div className="text-2xl font-display font-semibold" style={{ color: 'hsl(var(--chart-3))' }}>{formatCurrency(kpis.sapTotal)}</div>
          </div>

          <div className="bg-card p-4 rounded-[var(--radius)] border border-border">
            <div className="text-sm text-muted-foreground">Total Sinistres ({kpis.year})</div>
            <div className="text-2xl font-display font-semibold text-foreground">{kpis.totalSinistres}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="relative bg-card/80 backdrop-blur-xl rounded-[var(--radius)] p-6 border border-border overflow-hidden">
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-[hsl(var(--chart-3)/0.10)] rounded-full blur-3xl pointer-events-none" />
          <h3 className="relative text-lg font-display font-semibold text-foreground mb-4">Évolution (12 mois)</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={evolution}>
                <defs>
                  <linearGradient id="areaGradAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="areaGradCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="hsl(var(--border))" />
                <XAxis dataKey="period" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassChartTooltip formatValue={formatCurrency} dotColors={{ amount: 'hsl(var(--chart-1))', count: 'hsl(var(--chart-4))' }} />} cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '4 4' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 12 }} formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>} />
                <Area type="monotone" dataKey="amount" stroke="none" fill="url(#areaGradAmount)" isAnimationActive animationDuration={900} />
                <Area type="monotone" dataKey="count" stroke="none" fill="url(#areaGradCount)" isAnimationActive animationDuration={900} />
                <Line type="monotone" dataKey="amount" stroke="hsl(var(--chart-1))" name="Montant" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--card))', stroke: 'hsl(var(--chart-1))' }} activeDot={{ r: 6 }} animationDuration={900} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-4))" name="Nombre" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'hsl(var(--card))', stroke: 'hsl(var(--chart-4))' }} activeDot={{ r: 6 }} animationDuration={900} animationBegin={120} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative bg-card/80 backdrop-blur-xl rounded-[var(--radius)] p-6 border border-border overflow-hidden">
          <div className="absolute -top-16 -left-16 w-56 h-56 bg-[hsl(var(--chart-5)/0.10)] rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-[hsl(var(--chart-3)/0.10)] rounded-full blur-3xl pointer-events-none" />
          <h3 className="relative text-lg font-display font-semibold text-foreground mb-4">Par Statut</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <defs>
                  {PIE_GRADIENTS.map((g, i) => (
                    <linearGradient key={i} id={`sinistrePieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor={g[0]} />
                      <stop offset="100%" stopColor={g[1]} />
                    </linearGradient>
                  ))}
                </defs>
                <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={64} outerRadius={104} paddingAngle={3} cornerRadius={6} activeShape={renderActivePieShape} label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`} labelLine={{ stroke: 'hsl(var(--border))' } as any}>
                  {byStatus?.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={`url(#sinistrePieGrad${index % PIE_GRADIENTS.length})`} stroke="hsl(var(--card))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<GlassChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 12 }} formatter={(value: string) => <span className="text-sm text-muted-foreground">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative bg-card/80 backdrop-blur-xl rounded-[var(--radius)] p-6 border border-border overflow-hidden">
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-[hsl(var(--chart-4)/0.08)] rounded-full blur-3xl pointer-events-none" />
          <h3 className="relative text-lg font-display font-semibold text-foreground mb-4">Top Cédantes</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byCedante}>
                <defs>
                  <linearGradient id="barGradCedante" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" />
                    <stop offset="100%" stopColor="hsl(var(--chart-1) / 0.55)" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="hsl(var(--border))" />
                <XAxis dataKey="cedante" angle={-45} textAnchor="end" height={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassChartTooltip formatValue={formatCurrency} dotColors={{ amount: 'hsl(var(--chart-1))' }} />} cursor={{ fill: 'hsl(var(--primary) / 0.05)' } as any} />
                <Bar dataKey="amount" name="Montant" fill="url(#barGradCedante)" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative bg-card/80 backdrop-blur-xl rounded-[var(--radius)] p-6 border border-border overflow-hidden">
          <div className="absolute -top-16 -left-16 w-56 h-56 bg-[hsl(var(--chart-2)/0.10)] rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-[hsl(var(--chart-2)/0.06)] rounded-full blur-3xl pointer-events-none" />
          <h3 className="relative text-lg font-display font-semibold text-foreground mb-4">Analyse d'Âge (sinistres ouverts)</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agingData}>
                <defs>
                  <linearGradient id="barGradAge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-2))" />
                    <stop offset="100%" stopColor="hsl(var(--chart-2) / 0.55)" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={{ stroke: 'hsl(var(--border))' }} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassChartTooltip formatValue={formatCurrency} dotColors={{ amount: 'hsl(var(--chart-2))' }} />} cursor={{ fill: 'hsl(var(--chart-2) / 0.06)' } as any} />
                <Bar dataKey="amount" name="Montant" fill="url(#barGradAge)" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}