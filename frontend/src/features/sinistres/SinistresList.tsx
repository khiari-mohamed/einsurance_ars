import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye, AlertCircle, CheckCircle, Clock, XCircle, ShieldCheck, Undo2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sinistresApi } from '../../api/sinistres.api';
import type { Sinistre, SinistreStatut } from '../../types/sinistre.types';
import { STATUT_LABELS, STATUT_COLORS } from '../../types/sinistre.types';
import { formatCurrency } from '../../lib/currency';

const STATUT_ICONS: Record<SinistreStatut, any> = {
  DECLARE: AlertCircle,
  EN_COURS_VALIDATION: Clock,
  VALIDE: CheckCircle,
  REJETE: XCircle,
  DECLARE_REASSUREURS: ShieldCheck,
  EN_RECUPERATION: Clock,
  RECUPERE: Undo2,
  CLOS: CheckCircle,
};

export default function SinistresList() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<{ statut?: SinistreStatut; cedanteId?: string }>({});

  const { data, isLoading } = useQuery({
    queryKey: ['sinistres', filters],
    queryFn: () => sinistresApi.getAll({ ...filters, limit: 50 }),
  });

  const { data: kpis } = useQuery({
    queryKey: ['sinistres-kpis'],
    queryFn: () => sinistresApi.getKpis(),
  });

  const sinistres = data?.data?.data ?? [];

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

      {kpis?.data && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Sinistres ({kpis.data.year})</div>
            <div className="text-2xl font-bold">{kpis.data.totalSinistres}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Réserves Totales</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(kpis.data.reservesTotales)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Part Réassureurs</div>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(kpis.data.partReassureursTotale)}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">SAP Total</div>
            <div className="text-2xl font-bold">{formatCurrency(kpis.data.sapTotal)}</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-4 p-4">
        <div className="flex gap-4">
          <select
            value={filters.statut || ''}
            onChange={(e) => setFilters({ ...filters, statut: (e.target.value || undefined) as SinistreStatut })}
            className="border rounded px-3 py-2"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_LABELS).map(([key, label]) => (
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Réserves</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part Réass.</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sinistres.map((s: Sinistre) => {
                const StatusIcon = STATUT_ICONS[s.statut];
                return (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-blue-600">{s.numero}</td>
                    <td className="px-6 py-4 text-sm">{s.affaire?.numero}</td>
                    <td className="px-6 py-4 text-sm">{s.affaire?.cedante?.raisonSociale}</td>
                    <td className="px-6 py-4 text-sm">{new Date(s.dateSurvenance).toLocaleDateString('fr-FR')}</td>
                    <td className="px-6 py-4 text-sm font-semibold">{formatCurrency(s.reserves ?? 0)}</td>
                    <td className="px-6 py-4 text-sm">{formatCurrency(s.partReassureurs ?? 0)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${STATUT_COLORS[s.statut]}`}>
                        <StatusIcon size={14} />
                        {STATUT_LABELS[s.statut]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={() => navigate(`/sinistres/${s.id}`)} className="text-blue-600 hover:text-blue-800">
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sinistres.length === 0 && (
            <div className="text-center py-12 text-gray-500">Aucun sinistre trouvé</div>
          )}
        </div>
      )}
    </div>
  );
}