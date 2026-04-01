import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sinistresApi } from '../../api/sinistres.api';
import { Sinistre, SinistreStatus } from '../../types/sinistre.types';
import { formatCurrency } from '../../lib/currency';

const statusConfig = {
  [SinistreStatus.DECLARE]: { label: 'Déclaré', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
  [SinistreStatus.EN_EXPERTISE]: { label: 'En Expertise', color: 'bg-purple-100 text-purple-800', icon: Clock },
  [SinistreStatus.EN_REGLEMENT]: { label: 'En Règlement', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  [SinistreStatus.PARTIEL]: { label: 'Partiel', color: 'bg-orange-100 text-orange-800', icon: Clock },
  [SinistreStatus.REGLE]: { label: 'Réglé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  [SinistreStatus.CONTESTE]: { label: 'Contesté', color: 'bg-red-100 text-red-800', icon: XCircle },
  [SinistreStatus.CLOS]: { label: 'Clos', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
};

export default function SinistresList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ statut: '', cedanteId: '' });

  const { data: sinistres, isLoading } = useQuery({
    queryKey: ['sinistres', filters],
    queryFn: async () => {
      const { data } = await sinistresApi.getAll(filters);
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['sinistres-stats'],
    queryFn: async () => {
      const { data } = await sinistresApi.getDashboardStats();
      return data;
    },
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Sinistres</h1>
        <button
          onClick={() => navigate('/sinistres/new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          <Plus size={20} />
          Nouveau Sinistre
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Sinistres</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Ouverts</div>
            <div className="text-2xl font-bold text-blue-600">{stats.ouverts}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">En Retard</div>
            <div className="text-2xl font-bold text-red-600">{stats.enRetard}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">SAP Total</div>
            <div className="text-2xl font-bold">{formatCurrency(stats.sapTotal)}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-4 p-4">
        <div className="flex gap-4">
          <select
            value={filters.statut}
            onChange={(e) => setFilters({ ...filters, statut: e.target.value })}
            className="border rounded px-3 py-2"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(statusConfig).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">N° Sinistre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affaire</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cédante</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Survenance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SAP Actuel</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sinistres?.map((sinistre: Sinistre) => {
                const StatusIcon = statusConfig[sinistre.statut].icon;
                return (
                  <tr key={sinistre.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{sinistre.numero}</td>
                    <td className="px-6 py-4 text-sm">{sinistre.affaire?.numeroAffaire}</td>
                    <td className="px-6 py-4 text-sm">{sinistre.cedante?.nom}</td>
                    <td className="px-6 py-4 text-sm">{new Date(sinistre.dateSurvenance).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(sinistre.montantTotal)}</td>
                    <td className="px-6 py-4 text-sm">{formatCurrency(sinistre.sapActuel)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusConfig[sinistre.statut].color}`}>
                        <StatusIcon size={14} />
                        {statusConfig[sinistre.statut].label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigate(`/sinistres/${sinistre.id}`)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sinistres?.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              Aucun sinistre trouvé
            </div>
          )}
        </div>
      )}
    </div>
  );
}
