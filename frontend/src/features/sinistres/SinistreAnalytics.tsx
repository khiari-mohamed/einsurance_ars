import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { sinistresApi } from '../../api/sinistres.api';
import { formatCurrency } from '../../lib/currency';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function SinistreAnalytics() {
  const { data: evolution } = useQuery({
    queryKey: ['sinistres-evolution'],
    queryFn: async () => {
      const { data } = await sinistresApi.getEvolution(12);
      return data;
    },
  });

  const { data: byCedante } = useQuery({
    queryKey: ['sinistres-by-cedante'],
    queryFn: async () => {
      const { data } = await sinistresApi.getByCedante();
      return data;
    },
  });

  const { data: byStatus } = useQuery({
    queryKey: ['sinistres-by-status'],
    queryFn: async () => {
      const { data } = await sinistresApi.getByStatus();
      return data;
    },
  });

  const { data: aging } = useQuery({
    queryKey: ['sinistres-aging'],
    queryFn: async () => {
      const { data } = await sinistresApi.getAging();
      return data;
    },
  });

  const { data: sapAnalysis } = useQuery({
    queryKey: ['sinistres-sap'],
    queryFn: async () => {
      const { data } = await sinistresApi.getSAPAnalysis();
      return data;
    },
  });

  const agingData = aging ? Object.entries(aging).map(([key, value]: [string, any]) => ({
    name: key,
    count: value.count,
    amount: value.amount,
  })) : [];

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Analytiques Sinistres</h1>

      {sapAnalysis && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Réserves Totales</div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(sapAnalysis.totalReserves)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Montant Restant</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(sapAnalysis.totalOutstanding)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Taux de Couverture</div>
            <div className="text-2xl font-bold text-green-600">{sapAnalysis.coverageRatio.toFixed(1)}%</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Réserve Moyenne</div>
            <div className="text-2xl font-bold">{formatCurrency(sapAnalysis.averageReserve)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Évolution (12 mois)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={evolution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="amount" stroke="#1976d2" name="Montant" />
              <Line type="monotone" dataKey="count" stroke="#ff9800" name="Nombre" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Par Statut</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={byStatus}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {byStatus?.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top Cédantes</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byCedante?.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="cedante" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="amount" fill="#1976d2" name="Montant" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Analyse d'Âge</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="amount" fill="#ff9800" name="Montant" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
