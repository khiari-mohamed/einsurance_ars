import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye } from 'lucide-react';
import { affairesApi } from '../../api/affaires.api';
import { formatCurrency } from '../../lib/currency';
import {
  Affaire, AffaireStatut, AffaireType, statutColors, statutLabels, typeLabels,
} from '../../types/affaire.types';
import AffaireCreateModal from './AffaireCreateModal';

const LIMIT = 20;

export default function AffairesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  const searchTerm = searchParams.get('search') || '';
  const statutFilter = (searchParams.get('statut') as AffaireStatut) || '';
  const typeFilter = (searchParams.get('type') as AffaireType) || '';
  const page = Number(searchParams.get('page') || '1');

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.delete('page');
    setSearchParams(params);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['affaires', searchTerm, statutFilter, typeFilter, page],
    queryFn: async () => {
      const { data } = await affairesApi.getAll({
        search: searchTerm || undefined,
        statut: statutFilter || undefined,
        type: typeFilter || undefined,
        page,
        limit: LIMIT,
      });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  // FIX (Affaires pass): there is no /affaires/statistics/summary endpoint on
  // the backend — the old stats bar called a route that 404'd every time.
  // Rather than fabricate a backend endpoint that wasn't reviewed/requested,
  // this derives a lightweight, honest summary from pagination metadata
  // (total count) plus per-statut counts via three cheap filtered calls.
  const { data: statutCounts } = useQuery({
    queryKey: ['affaires-statut-counts'],
    queryFn: async () => {
      const [enCotation, prevision, placement] = await Promise.all([
        affairesApi.getAll({ statut: AffaireStatut.EN_COTATION, limit: 1 }),
        affairesApi.getAll({ statut: AffaireStatut.PREVISION, limit: 1 }),
        affairesApi.getAll({ statut: AffaireStatut.PLACEMENT_REALISE, limit: 1 }),
      ]);
      return {
        enCotation: enCotation.data.total,
        prevision: prevision.data.total,
        placement: placement.data.total,
      };
    },
  });

  const affaires = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const commissionTotal = (affaire: Affaire) =>
    affaire.reassureurs.reduce((sum, r) => sum + (r.commissionArs ?? 0), 0);

  const primeAffichee = (affaire: Affaire) =>
    affaire.type === AffaireType.FACULTATIVE
      ? affaire.facultativeData?.primeCedee ?? 0
      : affaire.traiteData?.primePrevisionnelle ?? 0;

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h1 className="text-[24px] font-semibold text-gray-900">Affaires</h1>
            <p className="text-[13px] text-gray-600 mt-1">
              {total} affaire{total !== 1 ? 's' : ''}
              {statutCounts && (
                <> • {statutCounts.enCotation} en cotation • {statutCounts.prevision} en prévision • {statutCounts.placement} placées</>
              )}
            </p>
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
            onClick={() => updateFilter('type', '')}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              !typeFilter ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Tous
          </button>
          <button
            onClick={() => updateFilter('type', AffaireType.FACULTATIVE)}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              typeFilter === AffaireType.FACULTATIVE ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Facultatives
          </button>
          <button
            onClick={() => updateFilter('type', AffaireType.TRAITE)}
            className={`px-4 py-2 text-[13px] font-medium rounded-lg transition-colors ${
              typeFilter === AffaireType.TRAITE ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
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
              placeholder="Rechercher par numéro, assuré, cédante, référence traité..."
              value={searchTerm}
              onChange={(e) => updateFilter('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statutFilter}
              onChange={(e) => updateFilter('statut', e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(statutLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
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
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Assuré / Traité</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Cédante</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Prime</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Commission ARS</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {affaires.map((affaire: Affaire) => (
                  <tr key={affaire.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-900 font-mono">{affaire.numero}</td>
                    <td className="px-4 py-3 text-[13px]">
                      <span className={`px-2 py-1 text-[11px] rounded-full ${
                        affaire.type === AffaireType.FACULTATIVE ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {typeLabels[affaire.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-900">
                      {affaire.type === AffaireType.FACULTATIVE
                        ? affaire.facultativeData?.assure?.raisonSociale || '-'
                        : affaire.traiteData?.referenceTraite || <span className="text-gray-400">Sans référence</span>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-gray-900">{affaire.cedante?.raisonSociale || '-'}</td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-gray-900">
                      {formatCurrency(primeAffichee(affaire), affaire.currency)}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-green-600">
                      {formatCurrency(commissionTotal(affaire), affaire.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-[11px] rounded-full ${statutColors[affaire.statut]}`}>
                        {statutLabels[affaire.statut]}
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

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-[12px] text-gray-500">Page {page} / {totalPages}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => updateFilter('page', String(Math.max(1, page - 1)))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Précédent
                </button>
                <button
                  onClick={() => updateFilter('page', String(Math.min(totalPages, page + 1)))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 text-[12px] rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isCreateModalOpen && (
        <AffaireCreateModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}