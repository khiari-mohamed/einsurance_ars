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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des données...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tableau de Bord</h1>
        <div className="flex gap-3">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="2024">2024</option>
            <option value="2023">2023</option>
            <option value="Q1-2024">Q1 2024</option>
            <option value="Q2-2024">Q2 2024</option>
            <option value="Q3-2024">Q3 2024</option>
            <option value="Q4-2024">Q4 2024</option>
          </select>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download size={16} />
            Exporter
          </button>
        </div>
      </div>

      {/* Panel 1: Chiffre d'Affaires */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold">Chiffre d'Affaires</h2>
          </div>
          <div className="flex gap-2">
            {['affaire', 'cedante', 'reassureur', 'combined'].map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode as any)}
                className={`px-3 py-1 rounded-lg text-sm ${
                  viewMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {mode === 'affaire' ? 'Par Affaire' : mode === 'cedante' ? 'Par Cédante' : mode === 'reassureur' ? 'Par Réassureur' : 'Combiné'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">CA Total</p>
            <p className="text-2xl font-bold text-blue-600">{caData?.total?.toLocaleString() || '0'} TND</p>
            <p className="text-xs text-green-600 mt-1">+12.5% vs année précédente</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Facultatives</p>
            <p className="text-2xl font-bold text-green-600">{caData?.facultatives?.toLocaleString() || '0'} TND</p>
            <p className="text-xs text-gray-600 mt-1">{caData?.facultativesPercent || 0}% du total</p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Traités</p>
            <p className="text-2xl font-bold text-purple-600">{caData?.traites?.toLocaleString() || '0'} TND</p>
            <p className="text-xs text-gray-600 mt-1">{caData?.traitesPercent || 0}% du total</p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Commissions ARS</p>
            <p className="text-2xl font-bold text-orange-600">{caData?.commissions?.toLocaleString() || '0'} TND</p>
            <p className="text-xs text-gray-600 mt-1">Marge moyenne: {caData?.marginPercent || 0}%</p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={caData?.chartData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="montant" fill="#3b82f6" name="Montant (TND)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Panel 2: Primes Encaissées vs Non Encaissées */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="text-green-600" size={24} />
          <h2 className="text-xl font-bold">État des Primes</h2>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Encaissées</p>
                <p className="text-2xl font-bold text-green-600">{primesData?.encaissees?.toLocaleString() || '0'} TND</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Non Encaissées</p>
                <p className="text-2xl font-bold text-red-600">{primesData?.nonEncaissees?.toLocaleString() || '0'} TND</p>
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
                  fill="#8884d8"
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="text-orange-600" size={18} />
              Aging des Créances
            </h3>
            <div className="space-y-3">
              {[
                { label: '0-30 jours', value: primesData?.aging?.['0-30'] || 0, color: 'bg-green-500' },
                { label: '31-60 jours', value: primesData?.aging?.['31-60'] || 0, color: 'bg-yellow-500' },
                { label: '61-90 jours', value: primesData?.aging?.['61-90'] || 0, color: 'bg-orange-500' },
                { label: '90+ jours', value: primesData?.aging?.['90+'] || 0, color: 'bg-red-500' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span className="font-semibold">{item.value.toLocaleString()} TND</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
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
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <Target className="text-purple-600" size={24} />
          <h2 className="text-xl font-bold">Budget vs Réalisé</h2>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Budget Annuel</p>
            <p className="text-2xl font-bold text-purple-600">{budgetData?.budget?.toLocaleString() || '0'} TND</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Réalisé</p>
            <p className="text-2xl font-bold text-blue-600">{budgetData?.actual?.toLocaleString() || '0'} TND</p>
          </div>
          <div className={`p-4 rounded-lg ${(budgetData?.variance || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <p className="text-sm text-gray-600 mb-1">Écart</p>
            <p className={`text-2xl font-bold ${(budgetData?.variance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(budgetData?.variance || 0) >= 0 ? '+' : ''}{budgetData?.variance?.toFixed(1) || '0'}%
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={budgetData?.monthlyData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="budget" stroke="#8b5cf6" name="Budget" strokeWidth={2} />
            <Line type="monotone" dataKey="actual" stroke="#3b82f6" name="Réalisé" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Panel 4: Rapport Trimestriel */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="text-blue-600" size={24} />
            <h2 className="text-xl font-bold">Rapport Trimestriel CA</h2>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Download size={16} />
            Télécharger PDF
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Trimestre</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Facultatives</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Traités</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Total CA</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Évolution</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(budgetData?.quarterlyReport || []).map((q: any) => (
                <tr key={q.quarter} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{q.quarter}</td>
                  <td className="px-4 py-3 text-right">{q.facultatives?.toLocaleString()} TND</td>
                  <td className="px-4 py-3 text-right">{q.traites?.toLocaleString()} TND</td>
                  <td className="px-4 py-3 text-right font-semibold">{q.total?.toLocaleString()} TND</td>
                  <td className={`px-4 py-3 text-right font-semibold ${q.evolution >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
