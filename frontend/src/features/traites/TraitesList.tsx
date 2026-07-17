import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye } from 'lucide-react';
import { affairesApi } from '../../api/affaires.api';
import { formatCurrency } from '../../lib/currency';
import { Affaire, AffaireStatus, AffaireCategory } from '../../types/affaire.types';
import AffaireCreateModal from '../affaires/AffaireCreateModal';

const statusColors: Record<AffaireStatus, string> = {
  [AffaireStatus.DRAFT]: 'bg-gray-100 text-gray-800',
  [AffaireStatus.COTATION]: 'bg-blue-100 text-blue-800',
  [AffaireStatus.PREVISION]: 'bg-yellow-100 text-yellow-800',
  [AffaireStatus.PLACEMENT_REALISE]: 'bg-purple-100 text-purple-800',
  [AffaireStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [AffaireStatus.TERMINE]: 'bg-gray-100 text-gray-600',
  [AffaireStatus.ANNULE]: 'bg-red-100 text-red-800',
};

const statusLabels: Record<AffaireStatus, string> = {
  [AffaireStatus.DRAFT]: 'Brouillon',
  [AffaireStatus.COTATION]: 'Cotation',
  [AffaireStatus.PREVISION]: 'Prévision',
  [AffaireStatus.PLACEMENT_REALISE]: 'Placement Réalisé',
  [AffaireStatus.ACTIVE]: 'Active',
  [AffaireStatus.TERMINE]: 'Terminée',
  [AffaireStatus.ANNULE]: 'Annulée',
};

const treatyTypeLabels: Record<string, string> = {
  qp: 'Quote-Part',
  xol: 'Excédent de Sinistres',
  surplus: 'Excédent de Plein',
  stop_loss: 'Stop Loss',
};

export default function TraitesList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const { data: traites = [], isLoading } = useQuery({
    queryKey: ['traites', searchTerm, statusFilter],
    queryFn: async () => {
      const { data } = await affairesApi.getAll({
        category: AffaireCategory.TRAITEE,
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        limit: 200,
      });
      return data.data || data;
    },
  });

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-[24px] font-semibold text-gray-900">Traités</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            {traites.length} traité{traites.length > 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors text-[13px] font-medium"
        >
          <Plus size={18} />
          Nouveau Traité
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par numéro, cédante..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : traites.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucun traité trouvé</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">N° Affaire</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Cédante</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Réassurance</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Prime Prév.</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">PMD</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {traites.map((affaire: Affaire) => (
                  <tr key={affaire.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{affaire.numeroAffaire}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-600">
                      {affaire.treatyType ? (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[11px] rounded-full">
                          {treatyTypeLabels[affaire.treatyType] || affaire.treatyType.toUpperCase()}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-900">{affaire.cedante?.raisonSociale || '-'}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-600">{affaire.type === 'proportionnel' ? 'Proportionnel' : 'Non Proportionnel'}</td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-gray-900">
                      {affaire.primePrevisionnelle != null ? formatCurrency(affaire.primePrevisionnelle, affaire.devise) : '-'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-gray-900">
                      {affaire.pmd != null ? formatCurrency(affaire.pmd, affaire.devise) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-[11px] rounded-full ${statusColors[affaire.status]}`}>
                        {statusLabels[affaire.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/affaires/${affaire.id}`)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                        title="Voir détails"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <AffaireCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          initialCategory={AffaireCategory.TRAITEE}
        />
      )}
    </div>
  );
}
