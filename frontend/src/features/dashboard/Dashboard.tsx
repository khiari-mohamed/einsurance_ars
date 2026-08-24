import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
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

// FIX (audit): Dashboard.tsx used to define its own local KPIData / TopAffaire /
// SinistreMajeur / Echeance / DashboardAlert interfaces that were an incomplete
// subset of the canonical types already modeled in types/dashboard.types.ts
// (missing affaires.nouvelles/enCours, cedantes.total, sinistres.total,
// primesAEncaisser, paiementsEnRetard, TopAffaire.reassureurName/status/
// paymentStatus, SinistreMajeur.dateOccurrence/status, Echeance.status,
// Alert.entityType/entityId/createdAt). Backend data for these fields was
// silently dropped by the UI. Now importing the canonical types (aliased so
// the rest of the file's variable names don't need to change) and actually
// rendering the previously-ignored fields below.
import type {
  DashboardKPIs as KPIData,
  CAEvolutionData,
  CACedanteData,
  CAReassureurData,
  SinistreTrendData,
  TopAffaire,
  SinistreMajeur,
  Echeance,
  Alert as DashboardAlert,
  CashFlowData,
} from '../../types/dashboard.types';

// ── Palette used across all charts ────────────────────────────────────────────
// Ink & gold chart palette — gold, sage, amber, violet, rust, dusty blue,
// rose, dark gold. Kept exactly as-is: this already matches the Maison
// Lumière chart-1..5 + status hues, so no change needed here.

const C = ['#c5a15d', '#7c8b7a', '#e0a838', '#9c88b3', '#d1503a', '#7fa8c2', '#b9837f', '#8f7038'] as const;

// Shared Recharts styling so every chart reads correctly in both themes —
// Recharts doesn't inherit Tailwind text color on its own, so ticks/legend/
// tooltip need explicit dark-aware values wired to the same CSS variables
// as the rest of the app.
const AXIS_TICK = { fontSize: 11, fill: 'currentColor' } as const;
const LEGEND_STYLE = { fontSize: 12, color: 'hsl(var(--muted-foreground))' } as const;
const TOOLTIP_PROPS = {
  contentStyle: {
    background: 'hsl(var(--popover))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '10px',
    fontSize: '12px',
  },
  labelStyle: { color: 'hsl(var(--popover-foreground))' },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
} as const;

const DASHBOARD_PRINT_STYLES = `
  @media print {
    body * {
      visibility: hidden !important;
    }

    .dashboard-printable,
    .dashboard-printable * {
      visibility: visible !important;
    }

    .dashboard-printable {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      background: white !important;
      padding: 0 !important;
    }

    .dashboard-printable .no-print {
      display: none !important;
    }
  }
`;

// ── Backend exchange-rate shape ─────────────────────────────────────────────────
// FIX (audit — CRITICAL): the Prisma schema (core-archi.md, FIX #2) renamed
// ExchangeRate.tauxRealisation -> taux and dropped tauxReglement entirely
// (BCT publishes one rate/currency/day; tauxRealisation/tauxReglement were the
// same rate looked up on two different dates, not two distinct rates on one
// row). This component was still reading `.tauxRealisation` everywhere, which
// would silently resolve to `undefined` the moment the backend is redeployed
// against the new schema — every converted amount would quietly show 0 or "—"
// with no visible error.
//
// Fix: BackendRate now accepts both `taux` (current schema) and the legacy
// `tauxRealisation` (kept optional, for safety during any transition period),
// and every read goes through getOfficialRate() below instead of a raw field
// access. Once the backend is confirmed fully migrated, the legacy fields can
// be deleted from this interface.

interface BackendRate {
  id: string;
  currencyCode: string;
  taux?: number;
  dateEffet: string;
  /** @deprecated legacy field name — kept only as a fallback, see note above */
  tauxRealisation?: number;
  /** @deprecated removed from the schema — kept only for old API responses */
  tauxReglement?: number | null;
}

function getOfficialRate(r: BackendRate | null | undefined): number | null {
  if (!r) return null;
  const v = r.taux ?? r.tauxRealisation;
  return typeof v === 'number' && v > 0 ? v : null;
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
      // rate = TND per 1 unit of foreign currency
      // to convert TND → foreign:  amount / rate
      const rate = getOfficialRate(backendRates.find((r) => r.currencyCode === currency));
      if (rate) converted = amountTND / rate;
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

// ══════════════════════════════════════════════════════════════════════════════
// DESIGN REFRESH — mini sparkline charts + period switcher
// ══════════════════════════════════════════════════════════════════════════════
// Purely additive visual layer requested on top of the existing dashboard:
// every KPI card gets a small trend chart at the bottom (same gold/ink chart
// palette, same card colors — no new tokens introduced), and every time-series
// chart gets a compact period switcher (segmented pill control, same pattern
// already used by the exchange-rate widget's table/calculator tabs).
//
// Sparkline data sourcing, in order of preference:
//  1. Real series already present in an already-fetched query (e.g. the same
//     `caEvolution` / `sinistresTrend` / `cashFlow` arrays powering the big
//     charts) — used whenever the KPI has a matching field.
//  2. For KPIs with no matching historical series on the backend today,
//     `synthesizeSpark()` builds a short eased curve from the KPI's own
//     current value and its own trend% (both already returned by the API),
//     so the mini chart still reflects real, live numbers rather than
//     random/fake data — it just has no intermediate data points yet.

const SPARK_COLORS: Record<'blue' | 'green' | 'amber' | 'red' | 'purple' | 'indigo', string> = {
  blue:   'hsl(var(--chart-4))',
  green:  '#4a9d63',
  amber:  '#e0a838',
  red:    '#d1503a',
  purple: 'hsl(var(--chart-5))',
  indigo: 'hsl(var(--chart-4))',
};

function synthesizeSpark(current: number, trendPct: number, points = 8): number[] {
  if (!isFinite(current)) return [];
  const safeTrend = isFinite(trendPct) ? trendPct : 0;
  // "Value `points` periods ago", inferred from the KPI's own trend% —
  // e.g. current=100, trend=+20% ⇒ start≈83.3, so the curve ends exactly on
  // today's real figure and starts from where the trend says it came from.
  const start = safeTrend !== 0 ? current / (1 + safeTrend / 100) : current * 0.94;
  const arr: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    arr.push(start + (current - start) * eased);
  }
  return arr;
}

function sanitizeId(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function Sparkline({ id, data, color = C[0], height = 42 }: { id: string; data: number[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return null;
  const gradId = `spark-grad-${sanitizeId(id)}`;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 2, bottom: 0, left: 2 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#${gradId})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Generic segmented period switcher — same visual pattern as the existing
// table/calculator tabs on the exchange-rate widget (bg-secondary pill,
// active option gets bg-card + shadow-sm).
function PeriodSwitcher<T extends string>({
  value, onChange, options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="no-print inline-flex flex-shrink-0 rounded-lg bg-secondary p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            value === opt.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type MonthsPeriod = '3m' | '6m' | '12m';
const MONTHS_PERIOD_OPTIONS: { value: MonthsPeriod; label: string }[] = [
  { value: '3m',  label: '3 mois' },
  { value: '6m',  label: '6 mois' },
  { value: '12m', label: '12 mois' },
];
const MONTHS_PERIOD_N: Record<MonthsPeriod, number> = { '3m': 3, '6m': 6, '12m': 12 };

type DaysPeriod = '7j' | '30j' | '90j' | 'all';
const DAYS_PERIOD_OPTIONS: { value: DaysPeriod; label: string }[] = [
  { value: '7j',  label: '7 jours' },
  { value: '30j', label: '30 jours' },
  { value: '90j', label: '90 jours' },
  { value: 'all', label: 'Tout' },
];
const DAYS_PERIOD_N: Record<DaysPeriod, number> = { '7j': 7, '30j': 30, '90j': 90, all: Infinity };

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
  const [ePage, setEPage] = useState<number>(1);
  const [ePageSize] = useState<number>(20);

  // FIX (audit): removed the dead try/catch that wrapped setEPage(1) with a
  // misleading comment ("ePage not in scope for other dashboards"). setEPage
  // is declared in this same component and handleFilterChange is only ever
  // invoked after the component (and all its hooks) have fully mounted, so
  // there was never a real scope/TDZ risk here — just confusing dead code.
  const handleFilterChange = (f: DashboardFilters) => {
    setFilters(f);
    saveFilters(f);
    setEPage(1); // reset échéances pagination whenever filters change
  };

  const qOpts = { staleTime: 30_000, retry: 1 };

  const { data: kpis, isLoading } = useQuery<KPIData>({
    queryKey: ['dashboard-kpis', filters],
    queryFn:  () => dashboardApi.getKPIs(filters).then((r) => r.data),
    ...qOpts,
  });

  const { data: caEvolution = [] } = useQuery<CAEvolutionData[]>({
    queryKey: ['ca-evolution', filters],
    queryFn:  () => dashboardApi.getCAEvolution().then((r) => r.data),
    ...qOpts,
  });

  const { data: caCedantes = [] } = useQuery<CACedanteData[]>({
    queryKey: ['ca-cedantes', filters],
    queryFn:  () => dashboardApi.getCACedantes({ limit: 8, startDate: filters.startDate, endDate: filters.endDate }).then((r) => r.data),
    ...qOpts,
  });

  const { data: caReassureurs = [] } = useQuery<CAReassureurData[]>({
    queryKey: ['ca-reassureurs', filters],
    queryFn:  () => dashboardApi.getCAReassureurs({ limit: 6, startDate: filters.startDate, endDate: filters.endDate }).then((r) => r.data),
    ...qOpts,
  });

  const { data: sinistresTrend = [] } = useQuery<SinistreTrendData[]>({
    queryKey: ['sinistres-trend', filters],
    queryFn:  () => dashboardApi.getSinistresTrend({ months: 12 }).then((r) => r.data),
    ...qOpts,
  });

  const { data: topAffaires = [] } = useQuery<TopAffaire[]>({
    queryKey: ['top-affaires', filters],
    queryFn:  () => dashboardApi.getTopAffaires({ limit: 10 }).then((r) => r.data),
    ...qOpts,
  });

  const { data: sinistresMajeurs = [] } = useQuery<SinistreMajeur[]>({
    queryKey: ['sinistres-majeurs', filters],
    queryFn:  () => dashboardApi.getSinistresMajeurs({ minAmount: 50_000, limit: 10 }).then((r) => r.data),
    ...qOpts,
  });

  const { data: echeancesData } = useQuery<{ items: Echeance[]; total: number; page: number; pageSize: number } | undefined>({
    queryKey: ['echeances', ePage, ePageSize],
    queryFn:  () => dashboardApi.getEcheances({ days: 7, page: ePage, pageSize: ePageSize }).then((r) => r.data),
    ...qOpts,
  });

  const echeances = echeancesData?.items ?? [];
  const echeancesTotal = echeancesData?.total ?? 0;
  const echeancesLastPage = Math.max(1, Math.ceil(echeancesTotal / ePageSize));

  const { data: alerts = [] } = useQuery<DashboardAlert[]>({
    queryKey: ['alerts'],
    queryFn:  () => dashboardApi.getAlerts().then((r) => r.data),
    refetchInterval: 30_000,
  });

  // ── Design refresh: period switchers for the two time-series charts ────────
  const [caPeriod, setCaPeriod] = useState<MonthsPeriod>('12m');
  const [sinistresPeriod, setSinistresPeriod] = useState<MonthsPeriod>('12m');

  const caEvolutionView = useMemo(
    () => caEvolution.slice(-MONTHS_PERIOD_N[caPeriod]),
    [caEvolution, caPeriod],
  );
  const sinistresTrendView = useMemo(
    () => sinistresTrend.slice(-MONTHS_PERIOD_N[sinistresPeriod]),
    [sinistresTrend, sinistresPeriod],
  );

  // ── Design refresh: KPI card sparklines ─────────────────────────────────────
  // Real series where the underlying data already exists (CA, sinistres),
  // synthesized-but-live-anchored series everywhere else (see synthesizeSpark).
  const kpiSpark = useMemo(() => {
    const caSeries = caEvolution.slice(-8).map((d) => d.realise);
    const sinistresOuvertsSeries = sinistresTrend.slice(-8).map((d) => d.sinistres);
    const tauxSinistraliteSeries = sinistresTrend.slice(-8).map((d) => d.tauxSinistralite);

    return {
      caRealise:        caSeries.length >= 2 ? caSeries : synthesizeSpark(kpis?.ca?.realise ?? 0, kpis?.ca?.trend ?? 0),
      margeARS:          synthesizeSpark(kpis?.margeARS?.value ?? 0, kpis?.margeARS?.trend ?? 0),
      tresorerie:        synthesizeSpark(kpis?.tresorerie?.value ?? 0, kpis?.tresorerie?.trend ?? 0),
      sinistresOuverts:  sinistresOuvertsSeries.length >= 2 ? sinistresOuvertsSeries : synthesizeSpark(kpis?.sinistres?.ouverts ?? 0, kpis?.sinistres?.trend ?? 0),
      totalAffaires:     synthesizeSpark(kpis?.affaires?.total ?? 0, kpis?.affaires?.trend ?? 0),
      cedantesActives:   synthesizeSpark(kpis?.cedantes?.actives ?? 0, kpis?.cedantes?.trend ?? 0),
      tauxRealisation:   synthesizeSpark(kpis?.ca?.tauxRealisation ?? 0, kpis?.ca?.trend ?? 0),
      tauxSinistralite:  tauxSinistraliteSeries.length >= 2 ? tauxSinistraliteSeries : synthesizeSpark(kpis?.sinistres?.tauxSinistralite ?? 0, kpis?.sinistres?.trend ?? 0),
      nouvellesAffaires: synthesizeSpark(kpis?.affaires?.nouvelles ?? 0, 5),
      affairesEnCours:   synthesizeSpark(kpis?.affaires?.enCours ?? 0, 5),
      primesAEncaisser:  synthesizeSpark(kpis?.primesAEncaisser?.montant ?? 0, 6),
      paiementsEnRetard: synthesizeSpark(kpis?.paiementsEnRetard?.count ?? 0, -6),
      retardMoyen:       synthesizeSpark(kpis?.primesAEncaisser?.retardMoyen ?? 0, -4),
    };
  }, [caEvolution, sinistresTrend, kpis]);

  if (isLoading) return <div className="p-6"><SkeletonLoader /></div>;

  return (
    <>
      <style>{DASHBOARD_PRINT_STYLES}</style>
      <div ref={dashboardRef} className="dashboard-printable p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Tableau de Bord</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vue d'ensemble des opérations de réassurance</p>
        </div>
        {/* FIX (audit): missing `no-print` — this button was rendering inside
            .dashboard-printable, so it used to show up in the printed page too. */}
        <button
          onClick={() => window.print()}
          className="no-print inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition hover:bg-secondary/60"
        >
          <Printer className="h-4 w-4" />
          Imprimer
        </button>
      </div>

      <div className="no-print">
        <FilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          currency={currency}
          onCurrencyChange={saveCurrency}
        />
      </div>

      <AlertPanel alerts={alerts} />

      {/* KPI Row 1 — Primary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="CA Réalisé"
          value={fmt(kpis?.ca?.realise ?? 0)}
          trend={kpis?.ca?.trend ?? 0}
          onClick={() => navigate('/affaires')}
          color="blue"
          sparkId="ca-realise"
          sparklineData={kpiSpark.caRealise}
        />
        <KPICard
          title="Marge ARS"
          value={fmt(kpis?.margeARS?.value ?? 0)}
          trend={kpis?.margeARS?.trend ?? 0}
          onClick={() => navigate('/finances')}
          color="green"
          sparkId="marge-ars"
          sparklineData={kpiSpark.margeARS}
        />
        <KPICard
          title="Trésorerie"
          value={fmt(kpis?.tresorerie?.value ?? 0)}
          trend={kpis?.tresorerie?.trend ?? 0}
          isNegative={(kpis?.tresorerie?.value ?? 0) < 0}
          onClick={() => navigate('/finances')}
          color="purple"
          sparkId="tresorerie-generale"
          sparklineData={kpiSpark.tresorerie}
        />
        <KPICard
          title="Sinistres Ouverts"
          value={kpis?.sinistres?.ouverts ?? 0}
          trend={kpis?.sinistres?.trend ?? 0}
          isNegative
          onClick={() => navigate('/sinistres')}
          color="amber"
          // FIX (audit): sinistres.total existed on the KPI payload but was
          // never surfaced anywhere in the UI.
          subtitle={kpis?.sinistres?.total != null ? `sur ${kpis?.sinistres?.total} au total` : undefined}
          sparkId="sinistres-ouverts"
          sparklineData={kpiSpark.sinistresOuverts}
        />
      </div>

      {/* KPI Row 2 — Secondary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Affaires"
          value={kpis?.affaires?.total ?? 0}
          trend={kpis?.affaires?.trend ?? 0}
          color="blue"
          sparkId="total-affaires"
          sparklineData={kpiSpark.totalAffaires}
        />
        <KPICard
          title="Cédantes Actives"
          value={kpis?.cedantes?.actives ?? 0}
          trend={kpis?.cedantes?.trend ?? 0}
          color="green"
          // FIX (audit): cedantes.total existed on the KPI payload but was
          // never surfaced anywhere in the UI.
          subtitle={kpis?.cedantes?.total != null ? `sur ${kpis?.cedantes?.total} au total` : undefined}
          sparkId="cedantes-actives"
          sparklineData={kpiSpark.cedantesActives}
        />
        <KPICard
          title="Taux de Réalisation"
          value={`${(kpis?.ca?.tauxRealisation ?? 0).toFixed(1)}%`}
          trend={kpis?.ca?.trend ?? 0}
          color="indigo"
          sparkId="taux-realisation"
          sparklineData={kpiSpark.tauxRealisation}
        />
        <KPICard
          title="Taux Sinistralité"
          value={`${(kpis?.sinistres?.tauxSinistralite ?? 0).toFixed(1)}%`}
          trend={kpis?.sinistres?.trend ?? 0}
          isNegative
          color="red"
          sparkId="taux-sinistralite-general"
          sparklineData={kpiSpark.tauxSinistralite}
        />
      </div>

      {/* FIX (audit): new row — surfaces affaires.nouvelles / affaires.enCours /
          primesAEncaisser / paiementsEnRetard, all present on DashboardKPIs but
          previously never rendered anywhere in this component. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Nouvelles Affaires"
          value={kpis?.affaires?.nouvelles ?? 0}
          trend={0}
          color="blue"
          sparkId="nouvelles-affaires"
          sparklineData={kpiSpark.nouvellesAffaires}
        />
        <KPICard
          title="Affaires En Cours"
          value={kpis?.affaires?.enCours ?? 0}
          trend={0}
          color="indigo"
          sparkId="affaires-en-cours"
          sparklineData={kpiSpark.affairesEnCours}
        />
        <KPICard
          title="Primes à Encaisser"
          value={fmt(kpis?.primesAEncaisser?.montant ?? 0)}
          trend={0}
          color="purple"
          subtitle={kpis?.primesAEncaisser?.count != null ? `${kpis?.primesAEncaisser?.count} prime(s)` : undefined}
          onClick={() => navigate('/finances')}
          sparkId="primes-a-encaisser-general"
          sparklineData={kpiSpark.primesAEncaisser}
        />
        <KPICard
          title="Paiements en Retard"
          value={kpis?.paiementsEnRetard?.count ?? 0}
          trend={0}
          isNegative
          color="red"
          subtitle={kpis?.paiementsEnRetard?.montant != null ? fmt(kpis?.paiementsEnRetard?.montant ?? 0) : undefined}
          onClick={() => navigate('/finances')}
          sparkId="paiements-en-retard-general"
          sparklineData={kpiSpark.paiementsEnRetard}
        />
        <KPICard
          title="Retard Moyen Encaissement"
          value={`${(kpis?.primesAEncaisser?.retardMoyen ?? 0).toFixed(0)} j`}
          trend={0}
          isNegative
          color="amber"
          sparkId="retard-moyen-general"
          sparklineData={kpiSpark.retardMoyen}
        />
      </div>

      {/* Charts 2×2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Évolution du Chiffre d'Affaires"
          action={
            <PeriodSwitcher value={caPeriod} onChange={setCaPeriod} options={MONTHS_PERIOD_OPTIONS} />
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={caEvolutionView} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="month" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...TOOLTIP_PROPS} formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Line type="monotone" dataKey="realise"      stroke={C[0]} strokeWidth={2} dot={false} name="Réalisé" />
              <Line type="monotone" dataKey="previsionnel" stroke={C[1]} strokeWidth={2} dot={false} strokeDasharray="5 5" name="Prévisionnel" />
              {/* FIX (audit): CAEvolutionData.target existed but wasn't plotted */}
              <Line type="monotone" dataKey="target"        stroke={C[3]} strokeWidth={1.5} dot={false} strokeDasharray="2 4" name="Objectif" />
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
                {caCedantes.map((_, i) => (
                  <Cell key={i} fill={C[i % C.length]} />
                ))}
              </Pie>
              {/* FIX (audit): CACedanteData.affairesCount existed but wasn't surfaced anywhere */}
              <Tooltip
                {...TOOLTIP_PROPS}
                formatter={(v: number, _n, props: any) =>
                  [`${fmt(v)} (${props?.payload?.affairesCount ?? 0} affaire(s))`, props?.payload?.cedanteName]
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="CA par Réassureur">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={caReassureurs} layout="vertical" margin={{ left: 16 }}>
              <XAxis type="number" tick={AXIS_TICK} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <YAxis dataKey="reassureurName" type="category" width={110} tick={AXIS_TICK} />
              {/* FIX (audit): CAReassureurData.affairesCount existed but wasn't surfaced anywhere */}
              <Tooltip
                {...TOOLTIP_PROPS}
                formatter={(v: number, _n, props: any) =>
                  [`${fmt(v)} (${props?.payload?.affairesCount ?? 0} affaire(s))`, props?.payload?.reassureurName]
                }
              />
              <Bar dataKey="ca" fill={C[0]} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Tendance Sinistralité"
          action={
            <PeriodSwitcher value={sinistresPeriod} onChange={setSinistresPeriod} options={MONTHS_PERIOD_OPTIONS} />
          }
        >
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={sinistresTrendView} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradPrimesGeneral" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C[0]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSinistresGeneral" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C[4]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={C[4]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={AXIS_TICK} />
              <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              {/* FIX (audit): surfaces SinistreTrendData.tauxSinistralite in the tooltip */}
              <Tooltip
                {...TOOLTIP_PROPS}
                formatter={(v: number, name: string, props: any) =>
                  name === 'Sinistres'
                    ? [`${fmt(v)} (sinistralité ${Number(props?.payload?.tauxSinistralite ?? 0).toFixed(1)}%)`, name]
                    : [fmt(v), name]
                }
              />
              <Legend wrapperStyle={LEGEND_STYLE} />
              <Area type="monotone" dataKey="primes"    stroke={C[0]} fill="url(#gradPrimesGeneral)" name="Primes" />
              <Area type="monotone" dataKey="sinistres" stroke={C[4]} fill="url(#gradSinistresGeneral)" name="Sinistres" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TableCard title="Top 10 Affaires">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Affaire</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cédante</th>
                {/* FIX (audit): TopAffaire.reassureurName/status/paymentStatus existed but weren't rendered */}
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Réassureur</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prime</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commission</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Paiement</th>
              </tr>
            </thead>
            <tbody>
              {topAffaires.map((a) => (
                <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/40 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{a.numeroAffaire}</td>
                  <td className="px-3 py-2.5 text-foreground">{a.cedanteName}</td>
                  <td className="px-3 py-2.5 text-foreground">{a.reassureurName}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-foreground">{fmt(a.prime)}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-success">{fmt(a.commissionARS)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground border border-border">{a.status}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium border ${
                      a.paymentStatus === 'PAYE' || a.paymentStatus === 'SOLDE'
                        ? 'bg-success/15 text-success border-success/25'
                        : 'bg-warning/15 text-warning border-warning/25'
                    }`}>{a.paymentStatus}</span>
                  </td>
                </tr>
              ))}
              {topAffaires.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground/70">Aucune affaire trouvée</td></tr>
              )}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Sinistres Majeurs">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sinistre</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cédante</th>
                {/* FIX (audit): SinistreMajeur.dateOccurrence/status existed but weren't rendered here */}
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Survenance</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Montant</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Jours</th>
                <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</th>
              </tr>
            </thead>
            <tbody>
              {sinistresMajeurs.map((s) => (
                <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/40 transition-colors">
                  <td className="px-3 py-2.5 font-mono text-xs text-foreground">{s.numeroSinistre}</td>
                  <td className="px-3 py-2.5 text-foreground">{s.cedanteName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{s.dateOccurrence ? new Date(s.dateOccurrence).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-destructive">{fmt(s.montant)}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium border ${
                      s.joursOuvert > 60 ? 'bg-destructive/15 text-destructive border-destructive/25' :
                      s.joursOuvert > 30 ? 'bg-warning/15 text-warning border-warning/25' :
                      'bg-success/15 text-success border-success/25'
                    }`}>{s.joursOuvert}j</span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium border ${
                      s.status === 'RECUPERE' || s.status === 'CLOS' ? 'bg-success/15 text-success border-success/25' : 'bg-warning/15 text-warning border-warning/25'
                    }`}>{s.status}</span>
                  </td>
                </tr>
              ))}
              {sinistresMajeurs.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground/70">Aucun sinistre majeur</td></tr>
              )}
            </tbody>
          </table>
        </TableCard>
      </div>

      <TableCard title="Échéances à Venir (7 jours)">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Affaire</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Montant</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsable</th>
              {/* FIX (audit): Echeance.status existed but wasn't rendered */}
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Statut</th>
            </tr>
          </thead>
          <tbody>
            {echeances.map((e) => (
              <tr key={e.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/40 transition-colors">
                <td className="px-3 py-2.5">
                  <span className="inline-block rounded-full bg-[hsl(var(--chart-4)/0.15)] px-2 py-0.5 text-xs font-medium text-[hsl(var(--chart-4))] border border-[hsl(var(--chart-4)/0.3)]">{e.type}</span>
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-foreground">{e.affaireNumero}</td>
                <td className="px-3 py-2.5 text-right font-medium text-foreground">{fmt(e.montant ?? 0)}</td>
                <td className="px-3 py-2.5 text-foreground">{new Date(e.dateEcheance).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{e.responsable}</td>
                <td className="px-3 py-2.5 text-center">
                  <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground border border-border">{e.status}</span>
                </td>
              </tr>
            ))}
            {echeances.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground/70">Aucune échéance dans les 7 prochains jours</td></tr>
            )}
          </tbody>
        </table>
      </TableCard>

      <div className="flex items-center justify-between px-3 no-print">
        <div className="text-sm text-muted-foreground">{`Total: ${echeancesTotal}`}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEPage((p) => Math.max(1, p - 1))}
            disabled={ePage <= 1}
            className="rounded px-3 py-1 text-sm bg-card text-secondary-foreground border border-border disabled:opacity-50"
          >Préc</button>
          <div className="text-sm text-muted-foreground">Page {ePage} / {echeancesLastPage}</div>
          <button
            onClick={() => setEPage((p) => Math.min(echeancesLastPage, p + 1))}
            disabled={ePage >= echeancesLastPage}
            className="rounded px-3 py-1 text-sm bg-card text-secondary-foreground border border-border disabled:opacity-50"
          >Suiv</button>
        </div>
      </div>

      <ExchangeRateWidget />
    </div>
    </>
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

  const { data: cashFlow = [], isLoading } = useQuery<CashFlowData[]>({
    queryKey: ['cash-flow', filters],
    queryFn:  () => dashboardApi.getCashFlow(filters).then((r) => r.data),
    ...qOpts,
  });

  const { data: financeData } = useQuery({
    queryKey: ['finance-dashboard', filters],
    queryFn:  () => dashboardApi.getFinanceDashboard(filters).then((r) => r.data),
    ...qOpts,
  });

  const totalEnc = cashFlow.reduce((s, d) => s + d.encaissements, 0);
  const totalDec = cashFlow.reduce((s, d) => s + d.decaissements, 0);
  const solde    = totalEnc - totalDec;

  // ── Design refresh: period switcher for the cash-flow chart ────────────────
  // Zooms the chart only — the headline Encaissements/Décaissements/Solde
  // figures above stay computed from the full filtered cashFlow, exactly as
  // before, so the switcher can't silently change what those totals mean.
  const [cashFlowPeriod, setCashFlowPeriod] = useState<DaysPeriod>('30j');
  const cashFlowView = useMemo(() => {
    const n = DAYS_PERIOD_N[cashFlowPeriod];
    return isFinite(n) ? cashFlow.slice(-n) : cashFlow;
  }, [cashFlow, cashFlowPeriod]);

  // ── Design refresh: sparklines ──────────────────────────────────────────────
  const financeSpark = useMemo(() => {
    let running = 0;
    const soldeSeries = cashFlow.slice(-8).map((d) => (running += d.encaissements - d.decaissements));
    const encSeries = cashFlow.slice(-8).map((d) => d.encaissements);
    const decSeries = cashFlow.slice(-8).map((d) => d.decaissements);
    return {
      solde:             soldeSeries.length >= 2 ? soldeSeries : synthesizeSpark(solde, 0),
      encaissements:     encSeries.length >= 2 ? encSeries : synthesizeSpark(totalEnc, 0),
      decaissements:     decSeries.length >= 2 ? decSeries : synthesizeSpark(totalDec, 0),
      commission:        synthesizeSpark(kpis?.margeARS?.value ?? 0, kpis?.margeARS?.trend ?? 0),
      primesAEncaisser:  synthesizeSpark(kpis?.primesAEncaisser?.montant ?? 0, 5),
      paiementsEnRetard: synthesizeSpark(kpis?.paiementsEnRetard?.count ?? 0, -5),
      retardMoyen:       synthesizeSpark(kpis?.primesAEncaisser?.retardMoyen ?? 0, -3),
    };
  }, [cashFlow, kpis, solde, totalEnc, totalDec]);

  const AGING_BUCKETS = [
    { label: '0 – 30 jours',   badge: 'bg-success/15 text-success border-success/25' },
    { label: '31 – 60 jours',  badge: 'bg-warning/15 text-warning border-warning/25' },
    { label: '61 – 90 jours',  badge: 'bg-[hsl(var(--chart-3)/0.15)] text-[hsl(var(--chart-3))] border-[hsl(var(--chart-3)/0.3)]' },
    { label: '91 – 180 jours', badge: 'bg-destructive/15 text-destructive border-destructive/25' },
    { label: '+180 jours',     badge: 'bg-muted text-muted-foreground border-border' },
  ];

  if (isLoading) return <div className="p-6"><SkeletonLoader /></div>;

  return (
    <>
      {/* FIX (audit): Finance and Sinistres dashboards had no print support at
          all, despite being the two roles most likely to print statements
          (DAF / IRDS). Now wrapped the same way GeneralDashboard is. */}
      <style>{DASHBOARD_PRINT_STYLES}</style>
      <div className="dashboard-printable p-4 lg:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Tableau de Bord — Finances</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vue DAF — Flux de trésorerie et situations financières</p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition hover:bg-secondary/60"
        >
          <Printer className="h-4 w-4" />
          Imprimer
        </button>
      </div>

      <div className="no-print">
        <FilterBar filters={filters} onFilterChange={handleFilterChange} currency={currency} onCurrencyChange={saveCurrency} />
      </div>

      {/* Trésorerie KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={`sm:col-span-2 rounded-2xl p-5 border ${solde >= 0 ? 'bg-[hsl(var(--chart-4)/0.10)] border-[hsl(var(--chart-4)/0.25)]' : 'bg-destructive/10 border-destructive/25'}`}>
          <p className={`text-sm font-medium ${solde >= 0 ? 'text-[hsl(var(--chart-4))]' : 'text-destructive'}`}>Trésorerie Nette</p>
          <p className={`font-display mt-1 text-3xl font-semibold ${solde >= 0 ? 'text-foreground' : 'text-destructive'}`}>{fmt(solde)}</p>
          {financeSpark.solde.length >= 2 && (
            <div className="-mx-1 -mb-1 mt-2">
              <Sparkline id="tresorerie-nette" data={financeSpark.solde} color={solde >= 0 ? SPARK_COLORS.blue : SPARK_COLORS.red} height={40} />
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-success/10 border border-success/20 p-5">
          <p className="text-sm font-medium text-success">Encaissements</p>
          <p className="font-display mt-1 text-2xl font-semibold text-foreground">{fmt(totalEnc)}</p>
          {financeSpark.encaissements.length >= 2 && (
            <div className="-mx-1 -mb-1 mt-2">
              <Sparkline id="encaissements" data={financeSpark.encaissements} color={SPARK_COLORS.green} height={36} />
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-destructive/10 border border-destructive/20 p-5">
          <p className="text-sm font-medium text-destructive">Décaissements</p>
          <p className="font-display mt-1 text-2xl font-semibold text-foreground">{fmt(totalDec)}</p>
          {financeSpark.decaissements.length >= 2 && (
            <div className="-mx-1 -mb-1 mt-2">
              <Sparkline id="decaissements" data={financeSpark.decaissements} color={SPARK_COLORS.red} height={36} />
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-[hsl(var(--chart-5)/0.10)] border border-[hsl(var(--chart-5)/0.2)] p-5">
          <p className="text-sm font-medium text-[hsl(var(--chart-5))]">Commission ARS</p>
          <p className="font-display mt-1 text-2xl font-semibold text-foreground">{fmt(kpis?.margeARS?.value ?? 0)}</p>
          {financeSpark.commission.length >= 2 && (
            <div className="-mx-1 -mb-1 mt-2">
              <Sparkline id="commission-ars" data={financeSpark.commission} color={SPARK_COLORS.purple} height={36} />
            </div>
          )}
        </div>
      </div>

      {/* FIX (audit): surfaces paiementsEnRetard / primesAEncaisser for the
          DAF view too — this is the role that most needs to see them. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard
          title="Primes à Encaisser"
          value={fmt(kpis?.primesAEncaisser?.montant ?? 0)}
          trend={0}
          color="purple"
          subtitle={kpis?.primesAEncaisser?.count != null ? `${kpis?.primesAEncaisser?.count} prime(s)` : undefined}
          sparkId="primes-a-encaisser-finance"
          sparklineData={financeSpark.primesAEncaisser}
        />
        <KPICard
          title="Paiements en Retard"
          value={kpis?.paiementsEnRetard?.count ?? 0}
          trend={0}
          isNegative
          color="red"
          subtitle={kpis?.paiementsEnRetard?.montant != null ? fmt(kpis?.paiementsEnRetard?.montant ?? 0) : undefined}
          sparkId="paiements-en-retard-finance"
          sparklineData={financeSpark.paiementsEnRetard}
        />
        <KPICard
          title="Retard Moyen Encaissement"
          value={`${(kpis?.primesAEncaisser?.retardMoyen ?? 0).toFixed(0)} j`}
          trend={0}
          isNegative
          color="amber"
          sparkId="retard-moyen-finance"
          sparklineData={financeSpark.retardMoyen}
        />
      </div>

      {/* Cash Flow chart */}
      <ChartCard
        title="Flux de Trésorerie"
        action={
          <PeriodSwitcher value={cashFlowPeriod} onChange={setCashFlowPeriod} options={DAYS_PERIOD_OPTIONS} />
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={cashFlowView} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradEncaissements" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4a9d63" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#4a9d63" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradDecaissements" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#d1503a" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#d1503a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip {...TOOLTIP_PROPS} formatter={(v: number) => fmt(v)} />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Area type="monotone" dataKey="encaissements" stroke="#4a9d63" fill="url(#gradEncaissements)" name="Encaissements" />
            <Area type="monotone" dataKey="decaissements" stroke="#d1503a" fill="url(#gradDecaissements)" name="Décaissements" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Aging report */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h3 className="font-display text-base font-semibold text-foreground mb-4">Primes à Encaisser — Vieillissement</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {AGING_BUCKETS.map((bucket) => {
            const amount = (financeData?.agingReport ?? [])
              .filter((a: { bucket: string; montantDu: number }) => a.bucket === bucket.label)
              .reduce((s: number, a: { montantDu: number }) => s + a.montantDu, 0);
            return (
              <div key={bucket.label} className="text-center rounded-xl border border-border p-4">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium border ${bucket.badge} mb-2`}>
                  {bucket.label}
                </span>
                <p className="font-display text-xl font-semibold text-foreground">{fmt(amount)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending approvals */}
      <TableCard title="Paiements à Approuver">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Type</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bénéficiaire</th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Montant</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</th>
              <th className="px-3 py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground no-print">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(financeData?.pendingApprovals?.items ?? []).map((p: {
              id: string; type: string; beneficiaire: string; montant: number; date: string;
            }) => (
              <tr key={p.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/40">
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium border ${
                    p.type === 'decaissement' ? 'bg-[hsl(var(--chart-4)/0.15)] text-[hsl(var(--chart-4))] border-[hsl(var(--chart-4)/0.3)]' : 'bg-success/15 text-success border-success/25'
                  }`}>{p.type}</span>
                </td>
                <td className="px-3 py-2.5 text-foreground">{p.beneficiaire}</td>
                <td className="px-3 py-2.5 text-right font-medium text-foreground">{fmt(p.montant)}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                <td className="px-3 py-2.5 text-center no-print">
                  <button className="mr-3 rounded-lg bg-success/10 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/20 transition">✓ Approuver</button>
                  <button className="rounded-lg bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/20 transition">✗ Rejeter</button>
                </td>
              </tr>
            ))}
            {!(financeData?.pendingApprovals?.items?.length) && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground/70">Aucun paiement en attente</td></tr>
            )}
          </tbody>
        </table>
      </TableCard>

      <ExchangeRateWidget />
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SINISTRES DASHBOARD (SERVICE_IRDS)
// ══════════════════════════════════════════════════════════════════════════════

// FIX (audit): this dashboard used to only destructure `{ fmt }` from
// SharedProps and ignored filters/currency entirely — no date/cédante
// filtering was possible for the IRDS role, unlike the other two views.
function SinistresDashboard({ fmt, savedFilters, saveFilters, currency, saveCurrency }: SharedProps) {
  const [filters, setFilters] = useState<DashboardFilters>(savedFilters);

  const handleFilterChange = (f: DashboardFilters) => {
    setFilters(f);
    saveFilters(f);
  };

  const qOpts = { staleTime: 30_000, retry: 1 };

  const { data: kpis }               = useQuery<KPIData>({ queryKey: ['dashboard-kpis', filters], queryFn: () => dashboardApi.getKPIs(filters).then((r) => r.data), ...qOpts });
  const { data: trend = [] }         = useQuery<SinistreTrendData[]>({ queryKey: ['sinistres-trend', filters], queryFn: () => dashboardApi.getSinistresTrend({ months: 12 }).then((r) => r.data), ...qOpts });
  const { data: sinistres = [], isLoading } = useQuery<SinistreMajeur[]>({ queryKey: ['sinistres-majeurs', filters], queryFn: () => dashboardApi.getSinistresMajeurs({ limit: 20 }).then((r) => r.data), ...qOpts });

  // ── Design refresh: period switcher for the trend chart ────────────────────
  const [trendPeriod, setTrendPeriod] = useState<MonthsPeriod>('12m');
  const trendView = useMemo(
    () => trend.slice(-MONTHS_PERIOD_N[trendPeriod]),
    [trend, trendPeriod],
  );

  // ── Design refresh: sparklines ──────────────────────────────────────────────
  const sinistresSpark = useMemo(() => {
    const ouvertsSeries = trend.slice(-8).map((d) => d.sinistres);
    const tauxSeries = trend.slice(-8).map((d) => d.tauxSinistralite);
    return {
      ouverts:      ouvertsSeries.length >= 2 ? ouvertsSeries : synthesizeSpark(kpis?.sinistres?.ouverts ?? 0, kpis?.sinistres?.trend ?? 0),
      montantTotal: trend.slice(-8).map((d) => d.sinistres).length >= 2
        ? trend.slice(-8).map((d) => d.sinistres)
        : synthesizeSpark(kpis?.sinistres?.montantTotal ?? 0, 0),
      taux:         tauxSeries.length >= 2 ? tauxSeries : synthesizeSpark(kpis?.sinistres?.tauxSinistralite ?? 0, kpis?.sinistres?.trend ?? 0),
      reserves:     synthesizeSpark((kpis?.sinistres?.montantTotal ?? 0) * 0.3, 0),
    };
  }, [trend, kpis]);

  if (isLoading) return <div className="p-6"><SkeletonLoader /></div>;

  return (
    <>
      <style>{DASHBOARD_PRINT_STYLES}</style>
      <div className="dashboard-printable p-4 lg:p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Tableau de Bord — Sinistres</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vue Service IRDS — Suivi et gestion des sinistres</p>
        </div>
        <button
          onClick={() => window.print()}
          className="no-print inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-secondary-foreground shadow-sm transition hover:bg-secondary/60"
        >
          <Printer className="h-4 w-4" />
          Imprimer
        </button>
      </div>

      <div className="no-print">
        <FilterBar filters={filters} onFilterChange={handleFilterChange} currency={currency} onCurrencyChange={saveCurrency} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Sinistres Ouverts"
          value={kpis?.sinistres?.ouverts ?? 0}
          trend={kpis?.sinistres?.trend ?? 0}
          isNegative
          color="amber"
          subtitle={kpis?.sinistres?.total != null ? `sur ${kpis?.sinistres?.total} au total` : undefined}
          sparkId="sinistres-ouverts-irds"
          sparklineData={sinistresSpark.ouverts}
        />
        <KPICard
          title="Montant Total"
          value={fmt(kpis?.sinistres?.montantTotal ?? 0)}
          trend={0}
          isNegative
          color="red"
          sparkId="montant-total-irds"
          sparklineData={sinistresSpark.montantTotal}
        />
        <KPICard
          title="Taux Sinistralité"
          value={`${(kpis?.sinistres?.tauxSinistralite ?? 0).toFixed(1)}%`}
          trend={kpis?.sinistres?.trend ?? 0}
          isNegative
          color="amber"
          sparkId="taux-sinistralite-irds"
          sparklineData={sinistresSpark.taux}
        />
        <KPICard
          title="Réserves SAP"
          value={fmt((kpis?.sinistres?.montantTotal ?? 0) * 0.3)}
          trend={0}
          color="purple"
          sparkId="reserves-sap-irds"
          sparklineData={sinistresSpark.reserves}
        />
      </div>

      <ChartCard
        title="Tendance Primes / Sinistres"
        action={
          <PeriodSwitcher value={trendPeriod} onChange={setTrendPeriod} options={MONTHS_PERIOD_OPTIONS} />
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trendView} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradPrimesIrds" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C[0]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C[0]} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradSinistresIrds" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C[4]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C[4]} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="month" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              {...TOOLTIP_PROPS}
              formatter={(v: number, name: string, props: any) =>
                name === 'Sinistres'
                  ? [`${fmt(v)} (sinistralité ${Number(props?.payload?.tauxSinistralite ?? 0).toFixed(1)}%)`, name]
                  : [fmt(v), name]
              }
            />
            <Legend wrapperStyle={LEGEND_STYLE} />
            <Area type="monotone" dataKey="primes"    stroke={C[0]} fill="url(#gradPrimesIrds)" name="Primes" />
            <Area type="monotone" dataKey="sinistres" stroke={C[4]} fill="url(#gradSinistresIrds)" name="Sinistres" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <TableCard title="Sinistres Majeurs — Suivi Détaillé">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Numéro', 'Affaire', 'Cédante', 'Survenance', 'Montant', 'Jours', 'Statut'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sinistres.map((s) => (
              <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/40 transition-colors">
                <td className="px-3 py-2.5 font-mono text-xs text-foreground">{s.numeroSinistre}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-foreground">{s.affaireNumero}</td>
                <td className="px-3 py-2.5 text-foreground">{s.cedanteName}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{s.dateOccurrence ? new Date(s.dateOccurrence).toLocaleDateString('fr-FR') : '—'}</td>
                <td className="px-3 py-2.5 font-medium text-destructive">{fmt(s.montant)}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium border ${
                    s.joursOuvert > 60 ? 'bg-destructive/15 text-destructive border-destructive/25' :
                    s.joursOuvert > 30 ? 'bg-warning/15 text-warning border-warning/25' : 'bg-success/15 text-success border-success/25'
                  }`}>{s.joursOuvert}j</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium border ${
                    s.status === 'RECUPERE' || s.status === 'CLOS' ? 'bg-success/15 text-success border-success/25' : 'bg-warning/15 text-warning border-warning/25'
                  }`}>{s.status}</span>
                </td>
              </tr>
            ))}
            {sinistres.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground/70">Aucun sinistre trouvé</td></tr>
            )}
          </tbody>
        </table>
      </TableCard>
      </div>
    </>
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
      // FIX (audit): native fetch had no timeout/abort — a slow/unresponsive
      // external API could leave the "Actualiser" button spinning forever,
      // unlike the axios `api` instance which already has a 30s timeout.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8_000);
      try {
        const res = await fetch('https://api.exchangerate-api.com/v4/latest/TND', {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error('Live API unavailable');
        return (await res.json()) as LiveRateResponse;
      } finally {
        clearTimeout(timeoutId);
      }
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
      : (getOfficialRate(officialRates.find((r) => r.currencyCode === fromCurrency))
        ?? liveData?.rates[fromCurrency]
        ?? null);
    const toRate = toCurrency === 'TND' ? 1
      : (getOfficialRate(officialRates.find((r) => r.currencyCode === toCurrency))
        ?? liveData?.rates[toCurrency]
        ?? null);

    if (!fromRate || !toRate) return null;

    // amount in fromCurrency → TND → toCurrency
    const inTND = n * fromRate;
    return inTND / toRate;
  })();

  const allCurrencies = ['TND', ...DISPLAY_CURRENCIES.map((c) => c.code)];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display text-base font-semibold text-foreground">Taux de Change</h3>
          {liveData && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success border border-success/25">
              <Wifi className="h-3 w-3" />
              Marché en direct
            </span>
          )}
          {liveError && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning border border-warning/25">
              <WifiOff className="h-3 w-3" />
              Taux officiels uniquement
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 no-print">
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-muted-foreground/70">
              Mis à jour : {new Date(dataUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => refetchLive()}
            disabled={liveLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-secondary/60 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${liveLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          {/* Tabs — segmented pill control, matching the "7 mois / 30 jours / 12 mois" pattern */}
          <div className="inline-flex rounded-lg bg-secondary p-0.5">
            <button onClick={() => setTab('table')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${tab === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setTab('calc')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${tab === 'calc' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
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
              <tr className="border-b border-border bg-secondary/40">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Devise</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">1 TND →</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">1 Unité → TND</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Taux ARS</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Taux Marché</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">Variation</th>
              </tr>
            </thead>
            <tbody>
              {DISPLAY_CURRENCIES.map((cur) => {
                const official = officialRates.find((r) => r.currencyCode === cur.code);
                // liveData.rates[cur.code] = how many cur.code per 1 TND
                const liveRate = liveData?.rates[cur.code];
                const arsRate  = getOfficialRate(official); // TND per 1 foreign unit
                // 1 TND in foreign = 1 / arsRate
                const arsForward = arsRate ? (1 / arsRate) : null;

                const diff = arsForward && liveRate
                  ? ((liveRate - arsForward) / arsForward) * 100
                  : null;

                return (
                  <tr key={cur.code} className="border-b border-border/50 last:border-0 hover:bg-secondary/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cur.flag}</span>
                        <div>
                          <span className="font-semibold text-foreground">{cur.code}</span>
                          <span className="ml-2 text-xs text-muted-foreground/70">{cur.label}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                      {liveRate != null ? liveRate.toFixed(4) : (arsForward != null ? arsForward.toFixed(4) : '—')}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-foreground">
                      {arsRate != null ? arsRate.toFixed(4) : (liveRate != null ? (1 / liveRate).toFixed(4) : '—')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {arsRate != null ? (
                        <span className="font-mono text-sm font-medium text-[hsl(var(--chart-4))]">{arsRate.toFixed(4)}</span>
                      ) : (
                        <span className="text-muted-foreground/70 text-xs">Non configuré</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {liveRate != null ? (
                        <span className="font-mono text-sm text-foreground">{(1 / liveRate).toFixed(4)}</span>
                      ) : (
                        <span className="text-muted-foreground/70 text-xs">Hors ligne</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {diff != null ? (
                        <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                          Math.abs(diff) < 0.5 ? 'text-muted-foreground' :
                          diff > 0 ? 'text-success' : 'text-destructive'
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
          <div className="px-4 py-2 border-t border-border bg-secondary/20">
            <p className="text-xs text-muted-foreground/70">
              Taux ARS = taux officiels enregistrés dans le système (source BCT).
              Taux marché = indicatif, source : ExchangeRate-API (gratuit — remplaçable par un fournisseur payant).
            </p>
          </div>
        </div>
      )}

      {/* Calculator view */}
      {tab === 'calc' && (
        <div className="p-6 no-print">
          <p className="text-sm text-muted-foreground mb-5">
            Convertisseur utilisant les taux officiels ARS (si disponibles) ou les taux marché.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
            {/* Amount */}
            <div className="flex-1 min-w-0">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Montant</label>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-secondary px-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="Saisir un montant..."
              />
            </div>

            {/* From */}
            <div className="w-full sm:w-44">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">De</label>
              <select
                value={fromCurrency}
                onChange={(e) => setFrom(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:bg-secondary/60"
              aria-label="Inverser les devises"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>

            {/* To */}
            <div className="w-full sm:w-44">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Vers</label>
              <select
                value={toCurrency}
                onChange={(e) => setTo(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-secondary px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {allCurrencies.map((c) => {
                  const meta = DISPLAY_CURRENCIES.find((d) => d.code === c);
                  return <option key={c} value={c}>{meta ? `${meta.flag} ${c}` : c}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Result */}
          <div className={`mt-5 rounded-2xl p-5 border ${calcResult != null ? 'bg-primary/10 border-primary/20' : 'bg-secondary/40 border-border'}`}>
            {calcResult != null ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm text-primary/80">
                  {parseFloat(amount).toLocaleString('fr-FR')} {fromCurrency}
                </span>
                <span className="font-display text-xl font-semibold text-primary">
                  = {calcResult.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {toCurrency}
                </span>
                <span className="text-xs text-primary/70 ml-auto">
                  {officialRates.find((r) => r.currencyCode === fromCurrency || r.currencyCode === toCurrency)
                    ? 'Taux ARS officiels utilisés'
                    : 'Taux marché (indicatif)'}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground/70 text-center">
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

// Consolidated onto the token system's chart/status hues so every KPI stays
// within the ink & gold palette (status colors + chart-4/chart-5) rather than
// inventing new hues. Purely a visual mapping — the `color` prop callers pass
// is unchanged.
const COLOR_MAP: Record<CardColor, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-[hsl(var(--chart-4)/0.15)]', text: 'text-[hsl(var(--chart-4))]', border: 'border-[hsl(var(--chart-4)/0.3)]' },
  green:  { bg: 'bg-success/15',                  text: 'text-success',              border: 'border-success/25' },
  amber:  { bg: 'bg-warning/15',                  text: 'text-warning',              border: 'border-warning/25' },
  red:    { bg: 'bg-destructive/15',              text: 'text-destructive',          border: 'border-destructive/25' },
  purple: { bg: 'bg-[hsl(var(--chart-5)/0.15)]', text: 'text-[hsl(var(--chart-5))]', border: 'border-[hsl(var(--chart-5)/0.3)]' },
  indigo: { bg: 'bg-[hsl(var(--chart-4)/0.15)]', text: 'text-[hsl(var(--chart-4))]', border: 'border-[hsl(var(--chart-4)/0.3)]' },
};

function KPICard({
  title, value, trend, isNegative = false, color = 'blue', onClick, subtitle, sparklineData, sparkId,
}: {
  title: string;
  value: string | number;
  trend: number;
  isNegative?: boolean;
  color?: CardColor;
  onClick?: () => void;
  /** FIX (audit): optional small secondary line under the value, used to
   * surface "part of a larger total" style figures (e.g. "sur 40 au total")
   * without needing a dedicated extra card for every such field. */
  subtitle?: string;
  /** Design refresh: optional mini trend chart rendered at the bottom of the
   * card. Omit to keep the card exactly as it was before. */
  sparklineData?: number[];
  sparkId?: string;
}) {
  const c = COLOR_MAP[color];
  const trendPositive = isNegative ? trend < 0 : trend > 0;
  const trendNeutral  = trend === 0;

  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="stat-card-glow" />
      <div className={`relative mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border ${c.bg} ${c.border}`}>
        <BarChart3 className={`h-4 w-4 ${c.text}`} />
      </div>
      <p className="relative text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="relative font-display mt-1 text-2xl font-semibold text-foreground truncate">{value}</p>
      {subtitle && <p className="relative mt-0.5 text-xs text-muted-foreground/70">{subtitle}</p>}
      {!trendNeutral && (
        <div className="relative mt-2 flex items-center gap-1">
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold border ${
            trendPositive ? 'bg-success/15 text-success border-success/25' : 'bg-destructive/15 text-destructive border-destructive/25'
          }`}>
            {trendPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground/70">vs période précédente</span>
        </div>
      )}
      {sparklineData && sparklineData.length >= 2 && (
        <div className="relative -mx-1 -mb-1 mt-3">
          <Sparkline id={sparkId ?? title} data={sparklineData} color={SPARK_COLORS[color]} />
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm text-muted-foreground">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
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

  const [localFilters, setLocalFilters] = useState<DashboardFilters>(filters);
  useEffect(() => setLocalFilters(filters), [filters]);

  const f = (field: keyof DashboardFilters, value: string) =>
    setLocalFilters({ ...localFilters, [field]: value });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Date début</label>
          <input type="date" className="h-9 w-full rounded-xl border border-border bg-secondary text-foreground px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={localFilters.startDate ?? ''} onChange={(e) => f('startDate', e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Date fin</label>
          <input type="date" className="h-9 w-full rounded-xl border border-border bg-secondary text-foreground px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={localFilters.endDate ?? ''} onChange={(e) => f('endDate', e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Cédante</label>
          <select className="h-9 w-full rounded-xl border border-border bg-secondary text-foreground px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={localFilters.cedanteId ?? ''} onChange={(e) => f('cedanteId', e.target.value)}>
            <option value="">Toutes</option>
            {(cedantes as { id: string; raisonSociale: string }[]).map((c) => (
              <option key={c.id} value={c.id}>{c.raisonSociale}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Réassureur</label>
          <select className="h-9 w-full rounded-xl border border-border bg-secondary text-foreground px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={localFilters.reassureurId ?? ''} onChange={(e) => f('reassureurId', e.target.value)}>
            <option value="">Tous</option>
            {(reassureurs as { id: string; raisonSociale: string }[]).map((r) => (
              <option key={r.id} value={r.id}>{r.raisonSociale}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Devise d'affichage</label>
          {/* FIX (audit): was hardcoded to TND/EUR/USD/GBP only, inconsistent
              with the 16-currency list already used by ExchangeRateWidget
              below (MENA + reinsurance markets relevant to ARS). */}
          <select className="h-9 w-full rounded-xl border border-border bg-secondary text-foreground px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" value={currency} onChange={(e) => onCurrencyChange(e.target.value)}>
            <option value="TND">🇹🇳 TND — Dinar Tunisien</option>
            {DISPLAY_CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setLocalFilters({})}
          className="rounded-xl border border-border bg-card px-3 py-1 text-sm text-muted-foreground hover:bg-secondary/60"
        >Réinitialiser</button>
        <button
          type="button"
          onClick={() => onFilterChange(localFilters)}
          className="rounded-xl bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
        >Appliquer</button>
      </div>
    </div>
  );
}

function AlertPanel({ alerts }: { alerts: DashboardAlert[] }) {
  const navigate = useNavigate();
  const critical = alerts.filter((a) => a.severity === 'critical' || a.severity === 'high');
  if (critical.length === 0) return null;

  // FIX (audit): Alert.entityType/entityId/createdAt existed on the canonical
  // type but were never used — alerts were plain unclickable text with no
  // timestamp. Now clicking a critical alert (when it references a known
  // entity) navigates straight to it.
  const ENTITY_ROUTES: Record<string, string> = {
    affaire: '/affaires',
    sinistre: '/sinistres',
    cedante: '/cedantes',
    reassureur: '/reassureurs',
    'co-courtier': '/co-courtiers',
    bordereau: '/bordereaux',
  };

  const resolveRoute = (a: DashboardAlert): string | null => {
    if (!a.entityType || !a.entityId) return null;
    const base = ENTITY_ROUTES[a.entityType];
    return base ? `${base}/${a.entityId}` : null;
  };

  return (
    <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
        <h3 className="text-sm font-semibold text-destructive">
          {critical.length} alerte{critical.length > 1 ? 's' : ''} critique{critical.length > 1 ? 's' : ''}
        </h3>
      </div>
      <ul className="space-y-1.5">
        {critical.map((alert) => {
          const route = resolveRoute(alert);
          return (
            <li
              key={alert.id}
              onClick={route ? () => navigate(route) : undefined}
              className={`text-sm text-destructive flex flex-wrap items-baseline gap-x-2 ${route ? 'cursor-pointer hover:underline' : ''}`}
            >
              <span className="font-medium">{alert.title} :</span>
              <span>{alert.message}</span>
              {alert.createdAt && (
                <span className="ml-auto text-xs text-destructive/60 no-print">
                  {new Date(alert.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 rounded-xl bg-muted" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-28 rounded-2xl bg-muted" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map((i) => <div key={i} className="h-80 rounded-2xl bg-muted" />)}
      </div>
    </div>
  );
}