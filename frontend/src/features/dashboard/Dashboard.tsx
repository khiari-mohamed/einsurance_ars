import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { dashboardApi } from '../../api/dashboard.api';
import { TopAffaire, SinistreMajeur, Echeance, Alert } from '../../types/dashboard.types';
import { useAuthStore } from '../../lib/store';
import { ExportControls } from './ExportControls';
import { useDashboardSettings } from './useDashboardSettings';
import api from '../../lib/api';

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dashboardRef = useRef<HTMLDivElement>(null);
  const { currency, saveCurrency, saveFilters } = useDashboardSettings();
  const [filters, setFilters] = useState({ startDate: '', endDate: '', cedanteId: '', reassureurId: '' });
  
  const formatCurrency = (amount: number) => {
    const rates: any = { TND: 1, EUR: 0.31, USD: 0.32 };
    const converted = amount * (rates[currency] || 1);
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(converted);
  };
  
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient]);
  
  useEffect(() => {
    saveFilters(filters);
  }, [filters, saveFilters]);
  
  const { data: kpis, isLoading: kpisLoading } = useQuery({ queryKey: ['dashboard-kpis', filters], queryFn: () => dashboardApi.getKPIs(filters).then(r => r.data) });
  const { data: caEvolution } = useQuery({ queryKey: ['ca-evolution'], queryFn: () => dashboardApi.getCAEvolution().then(r => r.data) });
  const { data: caCedantes } = useQuery({ queryKey: ['ca-cedantes'], queryFn: () => dashboardApi.getCACedantes({ limit: 10 }).then(r => r.data) });
  const { data: caReassureurs } = useQuery({ queryKey: ['ca-reassureurs'], queryFn: () => dashboardApi.getCAReassureurs({ limit: 5 }).then(r => r.data) });
  const { data: sinistresTrend } = useQuery({ queryKey: ['sinistres-trend'], queryFn: () => dashboardApi.getSinistresTrend({ months: 12 }).then(r => r.data) });
  const { data: topAffaires } = useQuery({ queryKey: ['top-affaires'], queryFn: () => dashboardApi.getTopAffaires({ limit: 10 }).then(r => r.data) });
  const { data: sinistresMajeurs } = useQuery({ queryKey: ['sinistres-majeurs'], queryFn: () => dashboardApi.getSinistresMajeurs({ minAmount: 50000, limit: 10 }).then(r => r.data) });
  const { data: echeances } = useQuery({ queryKey: ['echeances'], queryFn: () => dashboardApi.getEcheances({ days: 7 }).then(r => r.data) });
  const { data: alerts } = useQuery({ queryKey: ['alerts'], queryFn: () => dashboardApi.getAlerts().then(r => r.data) });
  const { data: cashFlow } = useQuery({ queryKey: ['cash-flow'], queryFn: () => dashboardApi.getCashFlow().then(r => r.data) });

  if (kpisLoading) return <div className="p-6 text-center">Chargement...</div>;

  if (user?.role === 'AGENT_FINANCIER' || user?.role === 'DIRECTEUR_FINANCIER') {
    return <FinanceDashboard kpis={kpis} cashFlow={cashFlow} filters={filters} setFilters={setFilters} />;
  }

  if (user?.role === 'TECHNICIEN_SINISTRES') {
    return <SinistresDashboard sinistres={sinistresMajeurs} trend={sinistresTrend} kpis={kpis} />;
  }

  const exportData = { kpis, topAffaires, sinistresMajeurs, echeances };

  return (
    <div ref={dashboardRef} className="p-4 lg:p-6 space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Tableau de Bord</h1>
        <ExportControls dashboardRef={dashboardRef} data={exportData} />
      </div>
      <FilterBar filters={filters} onFilterChange={setFilters} currency={currency} onCurrencyChange={saveCurrency} />
      <AlertPanel alerts={alerts} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="CA Réalisé" value={formatCurrency(kpis?.ca.realise || 0)} trend={kpis?.ca.trend || 0} color="#3B82F6" onClick={() => navigate('/affaires', { state: { filters } })} />
        <KPICard title="Marge ARS" value={formatCurrency(kpis?.margeARS.value || 0)} trend={kpis?.margeARS.trend || 0} color="#10B981" onClick={() => navigate('/finances')} />
        <KPICard title="Trésorerie" value={formatCurrency(kpis?.tresorerie.value || 0)} trend={kpis?.tresorerie.trend || 0} color="#8B5CF6" isNegative={kpis?.tresorerie.value < 0} onClick={() => navigate('/finances')} />
        <KPICard title="Sinistres Ouverts" value={kpis?.sinistres.ouverts || 0} trend={kpis?.sinistres.trend || 0} color="#F59E0B" isNegative onClick={() => navigate('/sinistres')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Affaires" value={kpis?.affaires.total || 0} trend={kpis?.affaires.trend || 0} color="#3B82F6" />
        <KPICard title="Cédantes Actives" value={kpis?.cedantes.actives || 0} trend={kpis?.cedantes.trend || 0} color="#22C55E" />
        <KPICard title="Taux Réalisation" value={`${kpis?.ca.tauxRealisation.toFixed(1) || 0}%`} trend={kpis?.ca.trend || 0} color="#6366F1" />
        <KPICard title="Taux Sinistralité" value={`${kpis?.sinistres.tauxSinistralite.toFixed(1) || 0}%`} trend={kpis?.sinistres.trend || 0} color="#EF4444" isNegative />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Évolution CA">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={caEvolution || []}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="realise" stroke="#3B82F6" strokeWidth={2} name="Réalisé" />
              <Line type="monotone" dataKey="previsionnel" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" name="Prévisionnel" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="CA par Cédante">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={caCedantes || []} dataKey="ca" nameKey="cedanteName" cx="50%" cy="50%" outerRadius={100} label={(e: any) => `${e.cedanteName}: ${e.percentage.toFixed(1)}%`}>
                {(caCedantes || []).map((_: any, i: number) => <Cell key={i} fill={['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6'][i % 8]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="CA par Réassureur">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={caReassureurs || []} layout="vertical">
              <XAxis type="number" />
              <YAxis dataKey="reassureurName" type="category" width={100} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="ca" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sinistralité Trend">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={sinistresTrend || []}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Area type="monotone" dataKey="primes" stackId="1" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="Primes" />
              <Area type="monotone" dataKey="sinistres" stackId="2" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} name="Sinistres" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TableCard title="Top 10 Affaires">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Affaire</th>
                <th className="px-4 py-2 text-left">Cédante</th>
                <th className="px-4 py-2 text-right">Prime</th>
                <th className="px-4 py-2 text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {(topAffaires || []).map((a: TopAffaire) => (
                <tr key={a.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{a.numeroAffaire}</td>
                  <td className="px-4 py-2">{a.cedanteName}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(a.prime)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(a.commissionARS)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>

        <TableCard title="Sinistres Majeurs">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Sinistre</th>
                <th className="px-4 py-2 text-left">Cédante</th>
                <th className="px-4 py-2 text-right">Montant</th>
                <th className="px-4 py-2 text-center">Jours</th>
              </tr>
            </thead>
            <tbody>
              {(sinistresMajeurs || []).map((s: SinistreMajeur) => (
                <tr key={s.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{s.numeroSinistre}</td>
                  <td className="px-4 py-2">{s.cedanteName}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(s.montant)}</td>
                  <td className="px-4 py-2 text-center">{s.joursOuvert}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableCard>
      </div>

      <TableCard title="Échéances à Venir (7 jours)">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Affaire</th>
              <th className="px-4 py-2 text-right">Montant</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Responsable</th>
            </tr>
          </thead>
          <tbody>
            {(echeances || []).map((e: Echeance) => (
              <tr key={e.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{e.type}</td>
                <td className="px-4 py-2">{e.affaireNumero}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(e.montant || 0)}</td>
                <td className="px-4 py-2">{new Date(e.dateEcheance).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-2">{e.responsable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function FilterBar({ filters, onFilterChange, currency, onCurrencyChange }: any) {
  const { data: cedantes } = useQuery({ queryKey: ['cedantes'], queryFn: () => api.get('/cedantes').then(r => r.data) });
  const { data: reassureurs } = useQuery({ queryKey: ['reassureurs'], queryFn: () => api.get('/reassureurs').then(r => r.data) });

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date Début</label>
          <input type="date" className="w-full border rounded-lg p-2" value={filters.startDate} onChange={(e) => onFilterChange({ ...filters, startDate: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date Fin</label>
          <input type="date" className="w-full border rounded-lg p-2" value={filters.endDate} onChange={(e) => onFilterChange({ ...filters, endDate: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cédante</label>
          <select className="w-full border rounded-lg p-2" value={filters.cedanteId} onChange={(e) => onFilterChange({ ...filters, cedanteId: e.target.value })}>
            <option value="">Toutes</option>
            {cedantes?.map((c: any) => <option key={c.id} value={c.id}>{c.raisonSociale}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Réassureur</label>
          <select className="w-full border rounded-lg p-2" value={filters.reassureurId} onChange={(e) => onFilterChange({ ...filters, reassureurId: e.target.value })}>
            <option value="">Tous</option>
            {reassureurs?.map((r: any) => <option key={r.id} value={r.id}>{r.raisonSociale}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Devise</label>
          <select className="w-full border rounded-lg p-2" value={currency} onChange={(e) => onCurrencyChange(e.target.value)}>
            <option value="TND">TND</option>
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function AlertPanel({ alerts }: { alerts?: Alert[] }) {
  const criticalAlerts = alerts?.filter(a => a.severity === 'critical' || a.severity === 'high') || [];
  if (criticalAlerts.length === 0) return null;
  
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4">
      <div className="flex items-center mb-2">
        <svg className="h-5 w-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
        </svg>
        <h3 className="text-red-800 font-semibold">Alertes Critiques ({criticalAlerts.length})</h3>
      </div>
      <ul className="space-y-1">
        {criticalAlerts.map(alert => (
          <li key={alert.id} className="text-red-700 text-sm">• {alert.title}: {alert.message}</li>
        ))}
      </ul>
    </div>
  );
}

function FinanceDashboard({ kpis, cashFlow, filters, setFilters }: any) {
  const { data: financeData, isLoading } = useQuery({
    queryKey: ['finance-dashboard', filters],
    queryFn: () => dashboardApi.getFinanceDashboard(filters).then(r => r.data)
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(amount);
  };

  const totalEnc = cashFlow?.reduce((s: number, d: any) => s + d.encaissements, 0) || 0;
  const totalDec = cashFlow?.reduce((s: number, d: any) => s + d.decaissements, 0) || 0;
  const solde = totalEnc - totalDec;

  if (isLoading) return <div className="p-6"><SkeletonLoader /></div>;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <FilterBar filters={filters} onFilterChange={setFilters} />
      
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="col-span-2 bg-gradient-to-r from-blue-50 to-blue-100 p-4 rounded-xl">
          <div className="text-sm text-blue-800 mb-1">Trésorerie Nette</div>
          <div className="text-2xl font-bold text-blue-900">{formatCurrency(solde)}</div>
        </div>
        <div className="bg-gradient-to-r from-green-50 to-green-100 p-4 rounded-xl">
          <div className="text-sm text-green-800 mb-1">Encaissements</div>
          <div className="text-lg font-bold text-green-900">{formatCurrency(totalEnc)}</div>
        </div>
        <div className="bg-gradient-to-r from-red-50 to-red-100 p-4 rounded-xl">
          <div className="text-sm text-red-800 mb-1">Décaissements</div>
          <div className="text-lg font-bold text-red-900">{formatCurrency(totalDec)}</div>
        </div>
        <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-4 rounded-xl">
          <div className="text-sm text-purple-800 mb-1">Commission ARS</div>
          <div className="text-lg font-bold text-purple-900">{formatCurrency(kpis?.margeARS.value || 0)}</div>
        </div>
        <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-xl">
          <div className="text-sm text-orange-800 mb-1">À Encaisser</div>
          <div className="text-lg font-bold text-orange-900">{formatCurrency(kpis?.primesAEncaisser.montant || 0)}</div>
        </div>
      </div>

      <ChartCard title="Cash Flow">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={cashFlow || []}>
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Area type="monotone" dataKey="encaissements" stroke="#10B981" fill="#10B981" fillOpacity={0.6} name="Encaissements" />
            <Area type="monotone" dataKey="decaissements" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} name="Décaissements" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Primes à Encaisser par Période</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { label: '0-30 jours', color: 'bg-green-100 text-green-800' },
            { label: '31-60 jours', color: 'bg-yellow-100 text-yellow-800' },
            { label: '61-90 jours', color: 'bg-orange-100 text-orange-800' },
            { label: '91-180 jours', color: 'bg-red-100 text-red-800' },
            { label: '+180 jours', color: 'bg-gray-100 text-gray-800' }
          ].map((bucket, i) => {
            const amount = financeData?.agingReport?.filter((a: any) => a.bucket === bucket.label).reduce((s: number, a: any) => s + a.montantDu, 0) || 0;
            return (
              <div key={i} className="text-center p-3 rounded-lg">
                <div className={`text-xs px-2 py-1 rounded-full ${bucket.color} mb-2`}>{bucket.label}</div>
                <div className="text-xl font-bold">{formatCurrency(amount)}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Commissions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Commission ARS</div>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(financeData?.commissionDashboard?.commissionARS || 0)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">Commission Cédante</div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(financeData?.commissionDashboard?.commissionCedante || 0)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-1">À Payer</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(financeData?.commissionDashboard?.aPayer || 0)}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Paiements à Approuver</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Type</th>
              <th className="px-4 py-2 text-left">Bénéficiaire</th>
              <th className="px-4 py-2 text-right">Montant</th>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {financeData?.pendingApprovals?.items?.map((p: any) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${p.type === 'decaissement' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                    {p.type}
                  </span>
                </td>
                <td className="px-4 py-2">{p.beneficiaire}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(p.montant)}</td>
                <td className="px-4 py-2">{new Date(p.date).toLocaleDateString('fr-FR')}</td>
                <td className="px-4 py-2">
                  <button className="text-green-600 hover:text-green-800 mr-2">✓</button>
                  <button className="text-red-600 hover:text-red-800">✗</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SinistresDashboard({ sinistres, trend, kpis }: any) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(amount);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Sinistres Ouverts" value={kpis?.sinistres.ouverts || 0} trend={kpis?.sinistres.trend || 0} color="#F59E0B" isNegative />
        <KPICard title="Montant Total" value={formatCurrency(kpis?.sinistres.montantTotal || 0)} trend={0} color="#EF4444" />
        <KPICard title="Taux Sinistralité" value={`${kpis?.sinistres.tauxSinistralite.toFixed(1) || 0}%`} trend={kpis?.sinistres.trend || 0} color="#F59E0B" isNegative />
        <KPICard title="SAP Réserves" value={formatCurrency(kpis?.sinistres.montantTotal * 0.3 || 0)} trend={0} color="#8B5CF6" />
      </div>

      <ChartCard title="Sinistralité Trend">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={trend || []}>
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Legend />
            <Area type="monotone" dataKey="primes" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} name="Primes" />
            <Area type="monotone" dataKey="sinistres" stroke="#EF4444" fill="#EF4444" fillOpacity={0.6} name="Sinistres" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <TableCard title="Sinistres Majeurs">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Sinistre</th>
              <th className="px-4 py-2 text-left">Affaire</th>
              <th className="px-4 py-2 text-left">Cédante</th>
              <th className="px-4 py-2 text-right">Montant</th>
              <th className="px-4 py-2 text-center">Jours Ouvert</th>
              <th className="px-4 py-2 text-center">Statut</th>
            </tr>
          </thead>
          <tbody>
            {(sinistres || []).map((s: SinistreMajeur) => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{s.numeroSinistre}</td>
                <td className="px-4 py-2">{s.affaireNumero}</td>
                <td className="px-4 py-2">{s.cedanteName}</td>
                <td className="px-4 py-2 text-right">{formatCurrency(s.montant)}</td>
                <td className="px-4 py-2 text-center">{s.joursOuvert}</td>
                <td className="px-4 py-2 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs ${s.status === 'cloture' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

function KPICard({ title, value, trend, isNegative, onClick }: { title: string; value: string | number; trend: number; color?: string; isNegative?: boolean; onClick?: () => void }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={onClick}>
      <p className="text-xs text-gray-500 font-medium mb-1">{title}</p>
      <div className="flex items-end justify-between mb-2">
        <h2 className="text-3xl font-semibold text-gray-900">{value}</h2>
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${isNegative ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
          {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-200 h-24 rounded-2xl"></div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2].map(i => (
          <div key={i} className="bg-gray-200 h-80 rounded-2xl"></div>
        ))}
      </div>
    </div>
  );
}
