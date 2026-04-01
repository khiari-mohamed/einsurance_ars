import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Filter, TrendingUp, TrendingDown, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { reportingApi } from '../../api/reporting.api';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6'];

export default function PortfolioReport() {
  const [filters, setFilters] = useState({ startDate: '', endDate: '', groupBy: 'branche' });
  const [showFilters, setShowFilters] = useState(false);

  const { data: performance, isLoading } = useQuery({
    queryKey: ['portfolio-performance', filters],
    queryFn: () => reportingApi.getPortfolioPerformance(filters).then(r => r.data)
  });

  const { data: concentration } = useQuery({
    queryKey: ['risk-concentration'],
    queryFn: () => reportingApi.getRiskConcentration().then(r => r.data)
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'TND' }).format(amount);
  };

  const exportToExcel = () => {
    const data = performance || [];
    const csv = [
      ['Nom', 'Primes', 'Sinistres', 'Commissions', 'Taux Sinistralité', 'Rentabilité', 'Affaires'],
      ...data.map((p: any) => [
        p.name,
        p.primes,
        p.sinistres,
        p.commissions,
        p.tauxSinistralite.toFixed(2),
        p.rentabilite.toFixed(2),
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

  if (isLoading) return <div className="p-6 text-center">Chargement...</div>;

  const totalPrimes = performance?.reduce((s: number, p: any) => s + p.primes, 0) || 0;
  const totalSinistres = performance?.reduce((s: number, p: any) => s + p.sinistres, 0) || 0;
  const totalCommissions = performance?.reduce((s: number, p: any) => s + p.commissions, 0) || 0;
  const avgSinistralite = totalPrimes > 0 ? (totalSinistres / totalPrimes) * 100 : 0;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Rapport Portfolio</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Filter size={20} />
            Filtrer
          </button>
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download size={20} />
            Exporter
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date Début</label>
              <input 
                type="date" 
                className="w-full border rounded-lg p-2" 
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date Fin</label>
              <input 
                type="date" 
                className="w-full border rounded-lg p-2" 
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Grouper par</label>
              <select 
                className="w-full border rounded-lg p-2"
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
          icon={<TrendingUp className="text-blue-600" />}
          color="blue"
        />
        <KPICard 
          title="Sinistres" 
          value={formatCurrency(totalSinistres)} 
          icon={<TrendingDown className="text-red-600" />}
          color="red"
        />
        <KPICard 
          title="Commissions ARS" 
          value={formatCurrency(totalCommissions)} 
          icon={<BarChart3 className="text-green-600" />}
          color="green"
        />
        <KPICard 
          title="Taux Sinistralité" 
          value={`${avgSinistralite.toFixed(1)}%`} 
          icon={<PieChartIcon className="text-orange-600" />}
          color="orange"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Performance par {filters.groupBy === 'branche' ? 'Branche' : filters.groupBy === 'cedante' ? 'Cédante' : 'Type'}</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={performance || []}>
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar dataKey="primes" fill="#3B82F6" name="Primes" />
              <Bar dataKey="sinistres" fill="#EF4444" name="Sinistres" />
              <Bar dataKey="commissions" fill="#10B981" name="Commissions" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Distribution des Primes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie 
                data={performance || []} 
                dataKey="primes" 
                nameKey="name" 
                cx="50%" 
                cy="50%" 
                outerRadius={100}
                label={(e: any) => `${e.name}: ${((e.primes / totalPrimes) * 100).toFixed(1)}%`}
              >
                {(performance || []).map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Détails Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nom</th>
                <th className="px-4 py-3 text-right font-semibold">Affaires</th>
                <th className="px-4 py-3 text-right font-semibold">Primes</th>
                <th className="px-4 py-3 text-right font-semibold">Sinistres</th>
                <th className="px-4 py-3 text-right font-semibold">Commissions</th>
                <th className="px-4 py-3 text-right font-semibold">Taux Sin.</th>
                <th className="px-4 py-3 text-right font-semibold">Rentabilité</th>
              </tr>
            </thead>
            <tbody>
              {(performance || []).map((p: any, i: number) => (
                <tr key={i} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-right">{p.affairesCount}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.primes)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.sinistres)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(p.commissions)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      p.tauxSinistralite > 70 ? 'bg-red-100 text-red-800' :
                      p.tauxSinistralite > 50 ? 'bg-orange-100 text-orange-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {p.tauxSinistralite.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${
                      p.rentabilite > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {p.rentabilite.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Concentration des Risques</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-3">Top 10 Affaires</h4>
            <div className="space-y-2">
              {(concentration?.top10Affaires || []).map((a: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{a.numeroAffaire}</span>
                  <span className="text-sm text-gray-600">{formatCurrency(a.exposure)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-3">Concentration par Cédante</h4>
            <div className="space-y-2">
              {(concentration?.byCedante || []).slice(0, 5).map((c: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-sm text-gray-600">{formatCurrency(c.exposure)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Indice de Concentration:</strong> {concentration?.concentrationIndex?.toFixed(1)}% 
            (Top 10 affaires représentent {concentration?.concentrationIndex?.toFixed(1)}% de l'exposition totale)
          </p>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`bg-white rounded-xl p-5 shadow-sm border-l-4 border-${color}-500`}>
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm text-gray-600 font-medium">{title}</p>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
