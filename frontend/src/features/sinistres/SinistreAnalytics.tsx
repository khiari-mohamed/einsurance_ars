import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, ComposedChart, Line, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Sector } from 'recharts';
import { sinistresApi } from '../../api/sinistres.api';
import { formatCurrency } from '../../lib/currency';
import { STATUT_LABELS } from '../../types/sinistre.types';

const PIE_GRADIENTS: [string, string][] = [
  ['#66B2FF', '#0066CC'],
  ['#6EE7C9', '#00997A'],
  ['#FFD666', '#D99A00'],
  ['#FFA873', '#E8630A'],
  ['#B4B0F0', '#6C63C7'],
];

function GlassChartTooltip({ active, payload, label, dotColors, formatValue }: any) {
  if (!active || !payload || !payload.length) return null;
  const title = label ?? payload[0]?.payload?.status ?? payload[0]?.name ?? payload[0]?.payload?.name;
  const fmt = (v: any) => (formatValue ? formatValue(v) : (typeof v === 'number' ? v.toLocaleString('fr-FR') : v));
  return (
    <div className="backdrop-blur-xl bg-white/90 border border-white/70 rounded-xl shadow-2xl px-4 py-3 min-w-[170px]">
      {title && <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>}
      <div className="space-y-1.5">
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex items-center gap-2 text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColors?.[entry.dataKey] || entry.payload?.fill || entry.color || '#9CA3AF' }} />
              {entry.name || entry.payload?.status}
            </span>
            <span className="font-semibold text-gray-900">{fmt(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderActivePieShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 10} startAngle={startAngle} endAngle={endAngle} fill={fill} cornerRadius={8} style={{ filter: 'drop-shadow(0px 8px 16px rgba(15,23,42,0.28))' }} />
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
      <h1 className="text-3xl font-bold text-gray-800">Analytiques Sinistres</h1>

      {kpis && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Réserves Totales</div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(kpis.reservesTotales)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Part Réassureurs</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(kpis.partReassureursTotale)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">SAP Total</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(kpis.sapTotal)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Sinistres ({kpis.year})</div>
            <div className="text-2xl font-bold">{kpis.totalSinistres}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)] border border-white/60 overflow-hidden">
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-blue-200/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-orange-200/20 rounded-full blur-3xl pointer-events-none" />
          <h3 className="relative text-lg font-semibold mb-4">Évolution (12 mois)</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={evolution}>
                <defs>
                  <linearGradient id="areaGradAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1976d2" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#1976d2" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="areaGradCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff9800" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#ff9800" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="#E5E7EB" />
                <XAxis dataKey="period" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassChartTooltip formatValue={formatCurrency} dotColors={{ amount: '#1976d2', count: '#ff9800' }} />} cursor={{ stroke: '#CBD5E1', strokeDasharray: '4 4' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 12 }} formatter={(value: string) => <span className="text-sm text-gray-600">{value}</span>} />
                <Area type="monotone" dataKey="amount" stroke="none" fill="url(#areaGradAmount)" isAnimationActive animationDuration={900} />
                <Area type="monotone" dataKey="count" stroke="none" fill="url(#areaGradCount)" isAnimationActive animationDuration={900} />
                <Line type="monotone" dataKey="amount" stroke="#1976d2" name="Montant" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#1976d2' }} activeDot={{ r: 6 }} animationDuration={900} />
                <Line type="monotone" dataKey="count" stroke="#ff9800" name="Nombre" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff', stroke: '#ff9800' }} activeDot={{ r: 6 }} animationDuration={900} animationBegin={120} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)] border border-white/60 overflow-hidden">
          <div className="absolute -top-16 -left-16 w-56 h-56 bg-purple-200/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-teal-200/20 rounded-full blur-3xl pointer-events-none" />
          <h3 className="relative text-lg font-semibold mb-4">Par Statut</h3>
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
                <Pie data={byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={64} outerRadius={104} paddingAngle={3} cornerRadius={6} activeShape={renderActivePieShape} label={({ name, percent }: any) => `${name}: ${((percent || 0) * 100).toFixed(1)}%`} labelLine={{ stroke: '#D1D5DB' } as any}>
                  {byStatus?.map((_entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={`url(#sinistrePieGrad${index % PIE_GRADIENTS.length})`} stroke="#ffffff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip content={<GlassChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: 12 }} formatter={(value: string) => <span className="text-sm text-gray-600">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)] border border-white/60 overflow-hidden">
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-blue-200/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-blue-100/25 rounded-full blur-3xl pointer-events-none" />
          <h3 className="relative text-lg font-semibold mb-4">Top Cédantes</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byCedante}>
                <defs>
                  <linearGradient id="barGradCedante" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#64B5F6" />
                    <stop offset="100%" stopColor="#1565C0" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="#E5E7EB" />
                <XAxis dataKey="cedante" angle={-45} textAnchor="end" height={100} tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassChartTooltip formatValue={formatCurrency} dotColors={{ amount: '#1565C0' }} />} cursor={{ fill: 'rgba(25,118,210,0.05)' } as any} />
                <Bar dataKey="amount" name="Montant" fill="url(#barGradCedante)" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative bg-white/80 backdrop-blur-xl rounded-2xl p-6 shadow-[0_8px_30px_rgba(15,23,42,0.08)] border border-white/60 overflow-hidden">
          <div className="absolute -top-16 -left-16 w-56 h-56 bg-orange-200/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-amber-100/25 rounded-full blur-3xl pointer-events-none" />
          <h3 className="relative text-lg font-semibold mb-4">Analyse d'Âge (sinistres ouverts)</h3>
          <div className="relative">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agingData}>
                <defs>
                  <linearGradient id="barGradAge" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFB74D" />
                    <stop offset="100%" stopColor="#EF6C00" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fill: '#6B7280', fontSize: 12 }} axisLine={{ stroke: '#E5E7EB' }} tickLine={false} />
                <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassChartTooltip formatValue={formatCurrency} dotColors={{ amount: '#EF6C00' }} />} cursor={{ fill: 'rgba(255,152,0,0.06)' } as any} />
                <Bar dataKey="amount" name="Montant" fill="url(#barGradAge)" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={800} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}