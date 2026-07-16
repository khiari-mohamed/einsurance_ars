import { useState, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, ArrowRightLeft, RefreshCw,
  AlertTriangle, Printer, BarChart3, Wifi, WifiOff,
} from 'lucide-react';
import { useAuthStore } from '../../lib/store';
import type { UserRole } from '../../lib/store';
import api from '../../lib/api';
import { dashboardApi, type DashboardFilters } from '../../api/dashboard.api';
import { cedantesApi, reassureursApi } from '../../api/master-data.api';

// ── Palette used across all charts ────────────────────────────────────────────

const C = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6'] as const;

// ── Domain types ───────────────────────────────────────────────────────────────

interface KPIData {
  ca:                { realise: number; previsionnel: number; trend: number; tauxRealisation: number };
  margeARS:          { value: number; trend: number };
  tresorerie:        { value: number; trend: number };
  sinistres:         { ouverts: number; trend: number; montantTotal: number; tauxSinistralite: number };
  affaires:          { total: number; trend: number };
  cedantes:          { actives: number; trend: number };
  primesAEncaisser:  { montant: number };
}

interface TopAffaire {
  id: string;
  numeroAffaire: string;
  cedanteName: string;
  prime: number;
  commissionARS: number;
}

interface SinistreMajeur {
  id: string;
  numeroSinistre: string;
  affaireNumero: string;
  cedanteName: string;
  montant: number;
  joursOuvert: number;
  statut: string;
}

interface Echeance {
  id: string;
  type: string;
  affaireNumero: string;
  montant: number;
  dateEcheance: string;
  responsable: string;
}

interface DashboardAlert {
  id: string;
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface BackendRate {
  id: string;
  currencyCode: string;
  tauxRealisation: number;
  tauxReglement: number | null;
  dateEffet: string;
}

// ── Currencies shown in the exchange widget ────────────────────────────────────
// Ordered by relevance for ARS Tunisie (MENA + major reinsurance markets)

const DISPLAY_CURRENCIES: { code: string; label: string; flag: string }[] = [
  { code: 'EUR', label: 'Euro',            flag: '🇪🇺' },
  { code: 'USD', label: 'Dollar US',       flag: '🇺🇸' },
  { code: 'GBP', label: 'Livre Sterling',  flag: '🇬🇧' },
  { code: 'CHF', label: 'Franc Suisse',    flag: '🇨🇭' },
  { code: 'AED', label: 'Dirham EAU',      flag: '🇦🇪' },
  { code: 'SAR', label: 'Riyal Saoudien',  flag: '🇸🇦' },
  { code: 'KWD', label: 'Dinar Koweïtien', flag: '🇰🇼' },
  { code: 'OMR', label: 'Rial Omanais',    flag: '🇴🇲' },
  { code: 'QAR', label: 'Riyal Qatari',   flag: '🇶🇦' },
  { code: 'BHD', label: 'Dinar Bahreïni', flag: '🇧🇭' },
  { code: 'MAD', label: 'Dirham Marocain', flag: '🇲🇦' },
  { code: 'DZD', label: 'Dinar Algérien',  flag: '🇩🇿' },
  { code: 'LYD', label: 'Dinar Libyen',    flag: '🇱🇾' },
  { code: 'EGP', label: 'Livre Égyptienne',flag: '🇪🇬' },
  { code: 'JPY', label: 'Yen Japonais',    flag: '🇯🇵' },
  { code: 'CNY', label: 'Yuan Chinois',    flag: '🇨🇳' },
];

// ── Simple localStorage hook replacing the missing useDashboardSettings ────────

function useDashboardSettings() {
  const [currency, setCurrency] = useState<string>(() =>
    localStorage.getItem('ars-dash-currency') ?? 'TND',
  );
  const [savedFilters, setSavedFilters] = useState<DashboardFilters>(() => {
    try {
      return JSON.parse(localStorage.getItem('ars-dash-filters') ?? '{}');
    } catch {
      return {};
    }
  });

  const saveCurrency = useCallback((c: string) => {
    setCurrency(c);
    localStorage.setItem('ars-dash-currency', c);
  }, []);

  const saveFilters = useCallback((f: DashboardFilters) => {
    setSavedFilters(f);
    localStorage.setItem('ars-dash-filters', JSON.stringify(f));
  }, []);

  return { currency, saveCurrency, savedFilters, saveFilters };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeCurrencyFormatter(
  currency: string,
  backendRates: BackendRate[],
) {
  return (amountTND: number): string => {
    let converted = amountTND;

    if (currency !== 'TND') {
      // tauxRealisation = TND per 1 unit of foreign currency
      // to convert TND → foreign:  amount / tauxRealisation
      const rate = backendRates.find((r) => r.currencyCode === currency)?.tauxRealisation;
      if (rate && rate > 0) converted = amountTND / rate;
    }

    return new Intl.NumberFormat('fr-TN', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : 3,
    }).format(converted);
  };
}

// ── Role → dashboard view map ──────────────────────────────────────────────────

function resolveView(role: UserRole | undefined): 'finance' | 'sinistres' | 'general' {
  if (role === 'DAF') return 'finance';
  if (role === 'SERVICE_IRDS') return 'sinistres';
  return 'general';
}

// ── Dashboard (role router) ────────────────────────────────────────────────────

export default function Dashboard() {
  const { user } = useAuthStore();
  const { currency, saveCurrency, savedFilters, saveFilters } = useDashboardSettings();
  const queryClient = useQueryClient();

  const view = resolveView(user?.role);

  // Backend exchange rates (used for currency conversion in all sub-dashboards)
  const { data: backendRates = [] } = useQuery<BackendRate[]>({
    queryKey: ['exchange-rates-list'],
    queryFn:  () => api.get('/exchange-rates').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const fmt = makeCurrencyFormatter(currency, backendRates);

  const sharedProps = {
    currency,
    saveCurrency,
    savedFilters,
    saveFilters,
    fmt,
    queryClient,
    backendRates,
  };

  if (view === 'finance')   return <FinanceDashboard   {...sharedProps} />;
  if (view === 'sinistres') return <SinistresDashboard {...sharedProps} />;
  return <GeneralDashboard {...sharedProps} />;
}

// ── Shared prop type ───────────────────────────────────────────────────────────

interface SharedProps {
  currency: string;
  saveCurrency: (c: string) => void;
  savedFilters: DashboardFilters;
  saveFilters: (f: DashboardFilters) => void;
  fmt: (n: number) => string;
  queryClient: ReturnType<typeof useQueryClient>;
  backendRates: BackendRate[];
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERAL DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

function GeneralDashboard({ currency, saveCurrency, savedFilters, saveFilters, fmt }: SharedProps) {
  const navigate = useNavigate();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [filters, setFilters] = useState<DashboardFilters>(savedFilters);

  const handleFilterChange = (f: DashboardFilters) => {
    setFilters(f);
    saveFilters(f);
  };

  const qOpts = { staleTime: 30_000, retry: 1 };

  const { data: kpis, isLoading } = useQuery<KPIData>({
    queryKey: ['dashboard-kpis', filters],
    queryFn:  () => dashboardApi.getKPIs(filters).then((r) => r.data),
    ...qOpts,
  });

  const { data: caEvolution = [] } = useQuery({
    queryKey: ['ca-evolution'],
    queryFn:  () => dashboardApi.getCAEvolution().then((r) => r.data),
    ...qOpts,
  });

  const { data: caCedantes = [] } = useQuery({
    queryKey: ['ca-cedantes'],
    queryFn:  () => dashboardApi.getCACedantes({ limit: 8 }).then((r) => r.data),
    ...qOpts,
  });

  const { data: caReassureurs = [] } = useQuery({
    queryKey: ['ca-reassureurs'],
    queryFn:  () => dashboardApi.getCAReassureurs({ limit: 6 }).then((r) => r.data),
    ...qOpts,
  });

  const { data: sinistresTrend = [] } = useQuery({
    queryKey: ['sinistres-trend'],
    queryFn:  () => dashboardApi.getSinistresTrend({ months: 12 }).then((r) => r.data),
    ...qOpts,
  });

  const { data: topAffaires = [] } = useQuery<TopAffaire[]>({
    queryKey: ['top-affaires'],
    queryFn:  () => dashboardApi.getTopAffaires({ limit: 10 }).then((r) => r.data),
    ...qOpts,
  });

  const { data: sinistresMajeurs = [] } = useQuery<SinistreMajeur[]>({
    queryKey: ['sinistres-majeurs'],
    queryFn:  () => dashboardApi.getSinistresMajeurs({ minAmount: 50_000, limit: 10 }).then((r) => r.data),
    ...qOpts,
  });

  const { data: echeances = [] } = useQuery<Echeance[]>({
    queryKey: ['echeances'],
    queryFn:  () => dashboardApi.getEcheances({ days: 7 }).then((r) => r.data),
    ...qOpts,
  });

  const { data: alerts = [] } = useQuery<DashboardAlert[]>({
    queryKey: ['alerts'],
    queryFn:  () => dashboardApi.getAlerts().then((r) => r.data),
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="p-6"><SkeletonLoader /></div>;

  return (
    <div ref={dashboardRef} className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de Bord</h1>
          <p className="text-sm text-slate-500 mt-0.5">Vue d'ensemble des opérations de réassurance</p>
        </div>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <Printer className="h-4 w-4" />
          Imprimer
        </button>
      </div>

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        currency={currency}
        onCurrencyChange={saveCurrency}
      />

      <AlertPanel alerts={alerts} />

      {/* KPI Row 1 — Primary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="CA Réalisé"
          value={fmt(kpis?.ca.realise ?? 0)}
          trend={kpis?.ca.trend ?? 0}
          onClick={() => navigate('/affaires')}
          color="blue"
        />
        <KPICard
          title="Marge ARS"
          value={fmt(kpis?.margeARS.value ?? 0)}
          trend={kpis?.margeARS.trend ?? 0}
          onClick={() => navigate('/finances')}
          color="green"
        />
        <KPICard
          title="Trésorerie"
          value={fmt(kpis?.tresorerie.value ?? 0)}
          trend={kpis?.tresorerie.trend ?? 0}
          isNegative={(kpis?.tresorerie.value ?? 0) < 0}
          onClick={() => navigate('/finances')}
          color="purple"
        />
        <KPICard
          title="Sinistres Ouverts"
          value={kpis?.sinistres.ouverts ?? 0}
          trend={kpis?.sinistres.trend ?? 0}
          isNegative
          onClick={() => navigate('/sinistres')}
          color="amber"
        />
      </div>

      {/* KPI Row 2 — Secondary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Affaires"     value={kpis?.affaires.total ?? 0}                           trend={kpis?.affaires.trend ?? 0}  color="blue" />
        <KPICard title="Cédantes Actives"   value={kpis?.cedantes.actives ?? 0}                         trend={kpis?.cedantes.trend ?? 0}  color="green" />
        <KPICard title="Taux de Réalisation" value={`${(kpis?.ca.tauxRealisation ?? 0).toFixed(1)}%`}   trend={kpis?.ca.trend ?? 0}        color="indigo" />
        <KPICard title="Taux Sinistralité"  value={`${(kpis?.sinistres.tauxSinistralite ?? 0).toFixed(1)}%`} trend={kpis?.sinistres.trend ?? 0} isNegative color="red" />
      </div>

      {/* Charts 2×2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Évolution du Chiffre d'Affaires">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={caEvolution} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="realise"      stroke={C[0]} strokeWidth={2} dot={false} name="Réalisé" />
              <Line type="monotone" dataKey="previsionnel" stroke={C[1]} strokeWidth={2} dot={false} strokeDasharray="5 5" name="Prévisionnel" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="CA par Cédante">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={caCedantes}
                dataKey="ca"
                nameKey="cedanteName"
                cx="50%" cy="50%"
                outerRadius={100}
                label={({ cedanteName, percentage }) =>
                  `${cedanteName}: ${Number(percentage).toFixed(1)}%`
                }
                labelLine={false}
              >
                {caCedantes.map((_: unknown, i: number) => (
                  <Cell key={i} fill={C[i % C.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => fmt(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="CA par Réassureur">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={caReassureurs} layout="vertical" margin={{ left: 16 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="reassureurName" type="category" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Bar dataKey="ca" fill={C[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tendance Sinistralité (12 mois)">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={sinistresTrend} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="primes"    stroke={C[0]} fill={C[0]} fillOpacity={0.2} name="Primes" />
              <Area type="monotone" dataKey="sinistres" stroke={C[4]} fill={C[4]} fillOpacity={0.2} name="Sinistres" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TableCard title="Top 10 Affaires">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Affaire</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Cédante</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Prime</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Commission</th>
              </tr>
            </thead>
            <tbody>
              {topAffaires.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{a.numeroAffaire}</td>
                  <td className="px-3 py-2.5 text-slate-700">{a.cedanteName}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{fmt(a.prime)}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-green-600">{fmt(a.commissionARS)}</td>
                </tr>
              ))}
              {topAffaires.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">Aucune affaire trouvée</td></tr>
              )}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Sinistres Majeurs">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Sinistre</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Cédante</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Montant</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Jours</th>
              </tr>
            </thead>
            <tbody>
              {sinistresMajeurs.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{s.numeroSinistre}</td>
                  <td className="px-3 py-2.5 text-slate-700">{s.cedanteName}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-red-600">{fmt(s.montant)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      s.joursOuvert > 60 ? 'bg-red-100 text-red-700' :
                      s.joursOuvert > 30 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>{s.joursOuvert}j</span>
                  </td>
                </tr>
              ))}
              {sinistresMajeurs.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">Aucun sinistre majeur</td></tr>
              )}
            </tbody>
          </table>
        </TableCard>
      </div>

      <TableCard title="Échéances à Venir (7 jours)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Affaire</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Montant</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Responsable</th>
            </tr>
          </thead>
          <tbody>
            {echeances.map((e) => (
              <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2.5">
                  <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{e.type}</span>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{e.affaireNumero}</td>
                <td className="px-3 py-2.5 text-right font-medium">{fmt(e.montant ?? 0)}</td>
                <td className="px-3 py-2.5 text-slate-700">{new Date(e.dateEcheance).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-2.5 text-slate-500">{e.responsable}</td>
              </tr>
            ))}
            {echeances.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">Aucune échéance dans les 7 prochains jours</td></tr>
            )}
          </tbody>
        </table>
      </TableCard>

      <ExchangeRateWidget />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// FINANCE DASHBOARD (DAF)
// ══════════════════════════════════════════════════════════════════════════════

function FinanceDashboard({ savedFilters, saveFilters, fmt, currency, saveCurrency }: SharedProps) {
  const [filters, setFilters] = useState<DashboardFilters>(savedFilters);

  const handleFilterChange = (f: DashboardFilters) => {
    setFilters(f);
    saveFilters(f);
  };

  const qOpts = { staleTime: 30_000, retry: 1 };

  const { data: kpis } = useQuery<KPIData>({
    queryKey: ['dashboard-kpis', filters],
    queryFn:  () => dashboardApi.getKPIs(filters).then((r) => r.data),
    ...qOpts,
  });

  const { data: cashFlow = [], isLoading } = useQuery({
    queryKey: ['cash-flow', filters],
    queryFn:  () => dashboardApi.getCashFlow(filters).then((r) => r.data),
    ...qOpts,
  });

  const { data: financeData } = useQuery({
    queryKey: ['finance-dashboard', filters],
    queryFn:  () => dashboardApi.getFinanceDashboard(filters).then((r) => r.data),
    ...qOpts,
  });

  const totalEnc = (cashFlow as { encaissements: number }[]).reduce((s, d) => s + d.encaissements, 0);
  const totalDec = (cashFlow as { decaissements: number }[]).reduce((s, d) => s + d.decaissements, 0);
  const solde    = totalEnc - totalDec;

  const AGING_BUCKETS = [
    { label: '0 – 30 jours',   badge: 'bg-green-100 text-green-800' },
    { label: '31 – 60 jours',  badge: 'bg-yellow-100 text-yellow-800' },
    { label: '61 – 90 jours',  badge: 'bg-orange-100 text-orange-800' },
    { label: '91 – 180 jours', badge: 'bg-red-100 text-red-800' },
    { label: '+180 jours',     badge: 'bg-slate-100 text-slate-700' },
  ];

  if (isLoading) return <div className="p-6"><SkeletonLoader /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tableau de Bord — Finances</h1>
          <p className="text-sm text-slate-500 mt-0.5">Vue DAF — Flux de trésorerie et situations financières</p>
        </div>
      </div>

      <FilterBar filters={filters} onFilterChange={handleFilterChange} currency={currency} onCurrencyChange={saveCurrency} />

      {/* Trésorerie KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={`sm:col-span-2 rounded-2xl p-5 ${solde >= 0 ? 'bg-gradient-to-br from-blue-50 to-blue-100' : 'bg-gradient-to-br from-red-50 to-red-100'}`}>
          <p className={`text-sm font-medium ${solde >= 0 ? 'text-blue-700' : 'text-red-700'}`}>Trésorerie Nette</p>
          <p className={`mt-1 text-3xl font-bold ${solde >= 0 ? 'text-blue-900' : 'text-red-900'}`}>{fmt(solde)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-green-50 to-green-100 p-5">
          <p className="text-sm font-medium text-green-700">Encaissements</p>
          <p className="mt-1 text-2xl font-bold text-green-900">{fmt(totalEnc)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-red-50 to-red-100 p-5">
          <p className="text-sm font-medium text-red-700">Décaissements</p>
          <p className="mt-1 text-2xl font-bold text-red-900">{fmt(totalDec)}</p>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 p-5">
          <p className="text-sm font-medium text-purple-700">Commission ARS</p>
          <p className="mt-1 text-2xl font-bold text-purple-900">{fmt(kpis?.margeARS.value ?? 0)}</p>
        </div>
      </div>

      {/* Cash Flow chart */}
      <ChartCard title="Flux de Trésorerie">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={cashFlow as object[]} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="encaissements" stroke="#10B981" fill="#10B981" fillOpacity={0.2} name="Encaissements" />
            <Area type="monotone" dataKey="decaissements" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} name="Décaissements" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Aging report */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900 mb-4">Primes à Encaisser — Vieillissement</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {AGING_BUCKETS.map((bucket) => {
            const amount = (financeData?.agingReport ?? [])
              .filter((a: { bucket: string; montantDu: number }) => a.bucket === bucket.label)
              .reduce((s: number, a: { montantDu: number }) => s + a.montantDu, 0);
            return (
              <div key={bucket.label} className="text-center rounded-xl border border-slate-100 p-4">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${bucket.badge} mb-2`}>
                  {bucket.label}
                </span>
                <p className="text-xl font-bold text-slate-900">{fmt(amount)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending approvals */}
      <TableCard title="Paiements à Approuver">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Type</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Bénéficiaire</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Montant</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Date</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(financeData?.pendingApprovals?.items ?? []).map((p: {
              id: string; type: string; beneficiaire: string; montant: number; date: string;
            }) => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    p.type === 'decaissement' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                  }`}>{p.type}</span>
                </td>
                <td className="px-3 py-2.5 text-slate-700">{p.beneficiaire}</td>
                <td className="px-3 py-2.5 text-right font-medium">{fmt(p.montant)}</td>
                <td className="px-3 py-2.5 text-slate-500">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-2.5 text-center">
                  <button className="mr-3 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 transition">✓ Approuver</button>
                  <button className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition">✗ Rejeter</button>
                </td>
              </tr>
            ))}
            {!(financeData?.pendingApprovals?.items?.length) && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">Aucun paiement en attente</td></tr>
            )}
          </tbody>
        </table>
      </TableCard>

      <ExchangeRateWidget />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SINISTRES DASHBOARD (SERVICE_IRDS)
// ══════════════════════════════════════════════════════════════════════════════

function SinistresDashboard({ fmt }: SharedProps) {
  const qOpts = { staleTime: 30_000, retry: 1 };

  const { data: kpis }               = useQuery<KPIData>({ queryKey: ['dashboard-kpis'], queryFn: () => dashboardApi.getKPIs().then((r) => r.data), ...qOpts });
  const { data: trend = [] }         = useQuery({ queryKey: ['sinistres-trend'], queryFn: () => dashboardApi.getSinistresTrend({ months: 12 }).then((r) => r.data), ...qOpts });
  const { data: sinistres = [], isLoading } = useQuery<SinistreMajeur[]>({ queryKey: ['sinistres-majeurs'], queryFn: () => dashboardApi.getSinistresMajeurs({ limit: 20 }).then((r) => r.data), ...qOpts });

  if (isLoading) return <div className="p-6"><SkeletonLoader /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tableau de Bord — Sinistres</h1>
        <p className="text-sm text-slate-500 mt-0.5">Vue Service IRDS — Suivi et gestion des sinistres</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Sinistres Ouverts"   value={kpis?.sinistres.ouverts ?? 0}                                trend={kpis?.sinistres.trend ?? 0}                         isNegative color="amber" />
        <KPICard title="Montant Total"        value={fmt(kpis?.sinistres.montantTotal ?? 0)}                      trend={0}                                                  isNegative color="red" />
        <KPICard title="Taux Sinistralité"    value={`${(kpis?.sinistres.tauxSinistralite ?? 0).toFixed(1)}%`}   trend={kpis?.sinistres.trend ?? 0}                         isNegative color="amber" />
        <KPICard title="Réserves SAP"         value={fmt((kpis?.sinistres.montantTotal ?? 0) * 0.3)}              trend={0}                                                  color="purple" />
      </div>

      <ChartCard title="Tendance Primes / Sinistres (12 mois)">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trend as object[]} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => fmt(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="primes"    stroke={C[0]} fill={C[0]} fillOpacity={0.2} name="Primes" />
            <Area type="monotone" dataKey="sinistres" stroke={C[4]} fill={C[4]} fillOpacity={0.2} name="Sinistres" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <TableCard title="Sinistres Majeurs — Suivi Détaillé">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Numéro', 'Affaire', 'Cédante', 'Montant', 'Jours', 'Statut'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sinistres.map((s) => (
              <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2.5 font-mono text-xs">{s.numeroSinistre}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{s.affaireNumero}</td>
                <td className="px-3 py-2.5">{s.cedanteName}</td>
                <td className="px-3 py-2.5 font-medium text-red-600">{fmt(s.montant)}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.joursOuvert > 60 ? 'bg-red-100 text-red-700' :
                    s.joursOuvert > 30 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                  }`}>{s.joursOuvert}j</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.statut === 'RECUPERE' || s.statut === 'CLOS' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>{s.statut}</span>
                </td>
              </tr>
            ))}
            {sinistres.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-400">Aucun sinistre trouvé</td></tr>
            )}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXCHANGE RATE WIDGET
// Free API: api.exchangerate-api.com/v4/latest/TND (no key, ~1 500 req/month)
// Replace with a paid provider when needed (ExchangeRate-API, Fixer.io, etc.)
// Official ARS rates always come from the backend /exchange-rates table.
// ══════════════════════════════════════════════════════════════════════════════

interface LiveRateResponse {
  base: string;
  date: string;
  rates: Record<string, number>;
}

function ExchangeRateWidget() {
  const [fromCurrency, setFrom]  = useState('TND');
  const [toCurrency,   setTo]    = useState('EUR');
  const [amount,       setAmount]= useState('1');
  const [tab, setTab]            = useState<'table' | 'calc'>('table');

  // Official rates from backend
  const { data: officialRates = [] } = useQuery<BackendRate[]>({
    queryKey: ['exchange-rates-list'],
    queryFn:  () => api.get('/exchange-rates').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  // Live rates from free public API — uses native fetch to avoid sending auth headers
  const {
    data:        liveData,
    isFetching:  liveLoading,
    isError:     liveError,
    refetch:     refetchLive,
    dataUpdatedAt,
  } = useQuery<LiveRateResponse>({
    queryKey: ['live-exchange-rates'],
    queryFn:  async () => {
      // Free API — no key required. Replace URL with paid provider when needed.
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/TND');
      if (!res.ok) throw new Error('Live API unavailable');
      return res.json() as Promise<LiveRateResponse>;
    },
    staleTime:  10 * 60_000,
    retry: 1,
  });

  // Calculate conversion result
  const calcResult = (() => {
    const n = parseFloat(amount);
    if (!isFinite(n) || n < 0) return null;

    // Both in terms of TND:
    // fromCurrency: how many TND = 1 unit of fromCurrency
    const fromRate = fromCurrency === 'TND' ? 1
      : (officialRates.find((r) => r.currencyCode === fromCurrency)?.tauxRealisation
        ?? liveData?.rates[fromCurrency]
        ?? null);
    const toRate = toCurrency === 'TND' ? 1
      : (officialRates.find((r) => r.currencyCode === toCurrency)?.tauxRealisation
        ?? liveData?.rates[toCurrency]
        ?? null);

    if (!fromRate || !toRate) return null;

    // amount in fromCurrency → TND → toCurrency
    const inTND = n * fromRate;
    return inTND / toRate;
  })();

  const allCurrencies = ['TND', ...DISPLAY_CURRENCIES.map((c) => c.code)];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-slate-400" />
          <h3 className="text-base font-semibold text-slate-900">Taux de Change</h3>
          {liveData && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <Wifi className="h-3 w-3" />
              Marché en direct
            </span>
          )}
          {liveError && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <WifiOff className="h-3 w-3" />
              Taux officiels uniquement
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-slate-400">
              Mis à jour : {new Date(dataUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => refetchLive()}
            disabled={liveLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${liveLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          {/* Tabs */}
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button onClick={() => setTab('table')} className={`px-3 py-1.5 text-xs font-medium transition ${tab === 'table' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setTab('calc')} className={`px-3 py-1.5 text-xs font-medium transition ${tab === 'calc' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
              <ArrowRightLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Table view */}
      {tab === 'table' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Devise</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">1 TND →</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">1 Unité → TND</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Taux ARS</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Taux Marché</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Variation</th>
              </tr>
            </thead>
            <tbody>
              {DISPLAY_CURRENCIES.map((cur) => {
                const official = officialRates.find((r) => r.currencyCode === cur.code);
                // liveData.rates[cur.code] = how many cur.code per 1 TND
                const liveRate = liveData?.rates[cur.code];
                const arsRate  = official ? Number(official.tauxRealisation) : null; // TND per 1 foreign unit
                // 1 TND in foreign = 1 / arsRate
                const arsForward = arsRate ? (1 / arsRate) : null;

                const diff = arsForward && liveRate
                  ? ((liveRate - arsForward) / arsForward) * 100
                  : null;

                return (
                  <tr key={cur.code} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cur.flag}</span>
                        <div>
                          <span className="font-semibold text-slate-900">{cur.code}</span>
                          <span className="ml-2 text-xs text-slate-400">{cur.label}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {liveRate != null ? liveRate.toFixed(4) : (arsForward != null ? arsForward.toFixed(4) : '—')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {arsRate != null ? arsRate.toFixed(4) : (liveRate != null ? (1 / liveRate).toFixed(4) : '—')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {arsRate != null ? (
                        <span className="font-mono text-sm font-medium text-blue-700">{arsRate.toFixed(4)}</span>
                      ) : (
                        <span className="text-slate-300 text-xs">Non configuré</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {liveRate != null ? (
                        <span className="font-mono text-sm">{(1 / liveRate).toFixed(4)}</span>
                      ) : (
                        <span className="text-slate-300 text-xs">Hors ligne</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {diff != null ? (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                          Math.abs(diff) < 0.5 ? 'text-slate-500' :
                          diff > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                          {diff > 0 ? '+' : ''}{diff.toFixed(2)}%
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs text-slate-400">
              Taux ARS = taux officiels enregistrés dans le système (source BCT).
              Taux marché = indicatif, source : ExchangeRate-API (gratuit — remplaçable par un fournisseur payant).
            </p>
          </div>
        </div>
      )}

      {/* Calculator view */}
      {tab === 'calc' && (
        <div className="p-6">
          <p className="text-sm text-slate-500 mb-5">
            Convertisseur utilisant les taux officiels ARS (si disponibles) ou les taux marché.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            {/* Amount */}
            <div className="flex-1 min-w-0">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Montant</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="Saisir un montant..."
              />
            </div>

            {/* From */}
            <div className="w-full sm:w-44">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">De</label>
              <select
                value={fromCurrency}
                onChange={(e) => setFrom(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {allCurrencies.map((c) => {
                  const meta = DISPLAY_CURRENCIES.find((d) => d.code === c);
                  return <option key={c} value={c}>{meta ? `${meta.flag} ${c}` : c}</option>;
                })}
              </select>
            </div>

            {/* Swap */}
            <button
              onClick={() => { setFrom(toCurrency); setTo(fromCurrency); }}
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
              aria-label="Inverser les devises"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>

            {/* To */}
            <div className="w-full sm:w-44">
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Vers</label>
              <select
                value={toCurrency}
                onChange={(e) => setTo(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {allCurrencies.map((c) => {
                  const meta = DISPLAY_CURRENCIES.find((d) => d.code === c);
                  return <option key={c} value={c}>{meta ? `${meta.flag} ${c}` : c}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Result */}
          <div className={`mt-5 rounded-2xl p-5 ${calcResult != null ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50 border border-slate-100'}`}>
            {calcResult != null ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm text-blue-700">
                  {parseFloat(amount).toLocaleString('fr-FR')} {fromCurrency}
                </span>
                <span className="text-xl font-bold text-blue-900">
                  = {calcResult.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {toCurrency}
                </span>
                <span className="text-xs text-blue-500 ml-auto">
                  {officialRates.find((r) => r.currencyCode === fromCurrency || r.currencyCode === toCurrency)
                    ? 'Taux ARS officiels utilisés'
                    : 'Taux marché (indicatif)'}
                </span>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center">
                Saisissez un montant valide et vérifiez que les devises sont configurées.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SHARED SMALL COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

type CardColor = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'indigo';

const COLOR_MAP: Record<CardColor, { bg: string; text: string; badge: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   badge: 'bg-blue-100 text-blue-700' },
  green:  { bg: 'bg-green-50',  text: 'text-green-600',  badge: 'bg-green-100 text-green-700' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700' },
  red:    { bg: 'bg-red-50',    text: 'text-red-600',    badge: 'bg-red-100 text-red-700' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', badge: 'bg-purple-100 text-purple-700' },
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', badge: 'bg-indigo-100 text-indigo-700' },
};

function KPICard({
  title, value, trend, isNegative = false, color = 'blue', onClick,
}: {
  title: string;
  value: string | number;
  trend: number;
  isNegative?: boolean;
  color?: CardColor;
  onClick?: () => void;
}) {
  const c = COLOR_MAP[color];
  const trendPositive = isNegative ? trend < 0 : trend > 0;
  const trendNeutral  = trend === 0;

  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${c.bg}`}>
        <BarChart3 className={`h-4 w-4 ${c.text}`} />
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900 truncate">{value}</p>
      {!trendNeutral && (
        <div className="mt-2 flex items-center gap-1">
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
            trendPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {trendPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
          <span className="text-xs text-slate-400">vs période précédente</span>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </div>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function FilterBar({
  filters, onFilterChange, currency, onCurrencyChange,
}: {
  filters: DashboardFilters;
  onFilterChange: (f: DashboardFilters) => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
}) {
  const { data: cedantesResponse } = useQuery({
    queryKey: ['cedantes-list'],
    queryFn:  () => cedantesApi.getAll({ limit: 1000 }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const { data: reassureursResponse } = useQuery({
    queryKey: ['reassureurs-list'],
    queryFn:  () => reassureursApi.getAll({ limit: 1000 }).then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const cedantes = cedantesResponse?.data ?? [];
  const reassureurs = reassureursResponse?.data ?? [];

  const f = (field: keyof DashboardFilters, value: string) =>
    onFilterChange({ ...filters, [field]: value });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Date début</label>
          <input type="date" className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" value={filters.startDate ?? ''} onChange={(e) => f('startDate', e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Date fin</label>
          <input type="date" className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" value={filters.endDate ?? ''} onChange={(e) => f('endDate', e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Cédante</label>
          <select className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" value={filters.cedanteId ?? ''} onChange={(e) => f('cedanteId', e.target.value)}>
            <option value="">Toutes</option>
            {(cedantes as { id: string; raisonSociale: string }[]).map((c) => (
              <option key={c.id} value={c.id}>{c.raisonSociale}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Réassureur</label>
          <select className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" value={filters.reassureurId ?? ''} onChange={(e) => f('reassureurId', e.target.value)}>
            <option value="">Tous</option>
            {(reassureurs as { id: string; raisonSociale: string }[]).map((r) => (
              <option key={r.id} value={r.id}>{r.raisonSociale}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Devise d'affichage</label>
          <select className="h-9 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100" value={currency} onChange={(e) => onCurrencyChange(e.target.value)}>
            <option value="TND">TND — Dinar Tunisien</option>
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dollar US</option>
            <option value="GBP">GBP — Livre Sterling</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function AlertPanel({ alerts }: { alerts: DashboardAlert[] }) {
  const critical = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high');
  if (critical.length === 0) return null;

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
        <h3 className="text-sm font-semibold text-red-800">
          {critical.length} alerte{critical.length > 1 ? 's' : ''} critique{critical.length > 1 ? 's' : ''}
        </h3>
      </div>
      <ul className="space-y-1">
        {critical.map((alert) => (
          <li key={alert.id} className="text-sm text-red-700">
            <span className="font-medium">{alert.title} :</span> {alert.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-slate-200" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl bg-slate-200" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => <div key={i} className="h-80 rounded-2xl bg-slate-200" />)}
      </div>
    </div>
  );
}