import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye } from 'lucide-react';
import { affairesApi } from '../../api/affaires.api';
import { formatCurrency } from '../../lib/currency';
import { Affaire, AffaireStatus, AffaireCategory } from '../../types/affaire.types';
import AffaireCreateModal from './AffaireCreateModal';

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

export default function AffairesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const searchTerm = searchParams.get('search') || '';
  const statusFilter = (searchParams.get('status') as AffaireStatus) || '';
  const categoryFilter = (searchParams.get('category') as AffaireCategory) || '';

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  const { data: affaires = [], isLoading } = useQuery({
    queryKey: ['affaires', searchTerm, statusFilter, categoryFilter],
    queryFn: async () => {
      const { data } = await affairesApi.getAll({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      });
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['affaires-stats'],
    queryFn: async () => {
      const { data } = await affairesApi.getStatistics();
      return data;
    },
  });



  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-[24px] font-semibold text-gray-900">Affaires</h1>
            {stats && (
              <p className="text-[13px] text-gray-600 mt-1">
                {stats.total} affaires • {stats.byStatus.active} actives • CA: {formatCurrency(stats.financials.totalPrimeCedee, 'TND')}
              </p>
            )}
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-[13px] font-medium"
          >
            <Plus size={18} />
            Nouvelle Affaire
          </button>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => updateFilter('category', '')}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              !categoryFilter ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => updateFilter('category', 'facultative')}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              categoryFilter === 'facultative' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Facultatives
          </button>
          <button
            onClick={() => updateFilter('category', 'traitee')}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              categoryFilter === 'traitee' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Traités
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        <div className="p-4 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par numéro, assuré, cédante..."
              value={searchTerm}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => updateFilter('category', e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Toutes les catégories</option>
              <option value={AffaireCategory.FACULTATIVE}>Facultative</option>
              <option value={AffaireCategory.TRAITEE}>Traitée</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : affaires.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucune affaire trouvée</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">N° Affaire</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Catégorie</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Assuré</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Cédante</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Prime Cédée</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Commission ARS</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {affaires.map((affaire: Affaire) => (
                  <tr key={affaire.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-900">{affaire.numeroAffaire}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-600">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-[11px] rounded-full ${
                          affaire.category === AffaireCategory.FACULTATIVE 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-purple-100 text-purple-700'
                        }`}>
                          {affaire.category === AffaireCategory.FACULTATIVE ? 'Facultative' : 'Traitée'}
                        </span>
                        {affaire.category === AffaireCategory.TRAITEE && affaire.treatyType && (
                          <span className="text-[10px] text-gray-500">({affaire.treatyType.toUpperCase()})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-900">{affaire.assure.raisonSociale}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-900">{affaire.cedante.raisonSociale}</td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-gray-900">
                      {formatCurrency(affaire.primeCedee, affaire.devise)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-green-600">
                      {formatCurrency(affaire.montantCommissionARS, affaire.devise)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-[11px] rounded-full ${statusColors[affaire.status]}`}>
                        {statusLabels[affaire.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/affaires/${affaire.id}`)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors"
                          title="Voir détails"
                        >
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <AffaireCreateModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
