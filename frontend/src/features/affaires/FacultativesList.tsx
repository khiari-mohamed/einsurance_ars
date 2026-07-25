import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye, Clock, X } from 'lucide-react';
import { facultativeApi } from '../../api/facultative.api';
import { formatCurrency } from '../../lib/currency';
import { statutColors, statutLabels, AffaireStatut } from '../../types/affaire.types';
import { FacultativeListItem } from '../../types/facultative.types';
import AffaireCreateModal from './AffaireCreateModal';

const LIMIT = 20;

export default function FacultativesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showRenewals, setShowRenewals] = useState(false);
  const navigate = useNavigate();

  const searchTerm = searchParams.get('search') || '';
  const statutFilter = (searchParams.get('statut') as AffaireStatut) || '';
  const brancheFilter = searchParams.get('branche') || '';
  const page = Number(searchParams.get('page') || '1');

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.delete('page');
    setSearchParams(params);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['facultatives', searchTerm, statutFilter, brancheFilter, page],
    queryFn: async () => {
      const { data } = await facultativeApi.getAll({
        search: searchTerm || undefined,
        statut: statutFilter || undefined,
        branche: brancheFilter || undefined,
        page,
        limit: LIMIT,
      });
      return data;
    },
    placeholderData: (prev) => prev,
    enabled: !showRenewals,
  });

  // FIX (Affaires Pass 2): the backend's renewals-alert endpoint had zero
  // frontend consumers. Wired here as a toggle view, since it's directly
  // useful for the "alerte de renouvellement" requirement (CDC §6.6).
  const { data: renewals } = useQuery({
    queryKey: ['facultatives-renewals'],
    queryFn: async () => (await facultativeApi.getRenewalsAlert(30)).data,
  });

  const { data: branchStats } = useQuery({
    queryKey: ['facultatives-branch-stats'],
    queryFn: async () => (await facultativeApi.getStatsByBranch()).data,
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const commissionTotal = (item: FacultativeListItem) =>
    item.affaire.reassureurs.reduce((sum, r) => sum + (r.commissionArs ?? 0), 0);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h1 className="text-[24px] font-semibold text-gray-900">Facultatives</h1>
          <p className="text-[13px] text-gray-500 mt-1">{total} affaire{total !== 1 ? 's' : ''} facultative{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 transition-colors text-[13px] font-medium"
        >
          <Plus size={18} />
          Nouvelle Facultative
        </button>
      </div>

      {renewals && renewals.length > 0 && !showRenewals && (
        <button
          onClick={() => setShowRenewals(true)}
          className="w-full mb-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left hover:bg-amber-100 transition-colors"
        >
          <Clock size={18} className="text-amber-600 shrink-0" />
          <span className="text-[13px] text-amber-800">
            <strong>{renewals.length}</strong> affaire{renewals.length !== 1 ? 's' : ''} facultative{renewals.length !== 1 ? 's' : ''} arrive{renewals.length === 1 ? '' : 'nt'} à échéance dans les 30 prochains jours
          </span>
        </button>
      )}

      {showRenewals && (
        <div className="mb-4 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-[13px] font-medium text-amber-800">Vue: renouvellements à venir (30 jours)</span>
          <button onClick={() => setShowRenewals(false)} className="p-1 rounded hover:bg-amber-100 text-amber-700">
            <X size={16} />
          </button>
        </div>
      )}

      {branchStats && branchStats.length > 0 && !showRenewals && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {branchStats.slice(0, 6).map((b) => (
            <div key={b.branche} className="shrink-0 px-3 py-2 bg-white border border-gray-100 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
              <p className="text-[11px] text-gray-500">{b.branche}</p>
              <p className="text-[13px] font-semibold text-gray-900">{formatCurrency(b.totalPrime, 'TND')} <span className="text-[11px] font-normal text-gray-400">({b.count})</span></p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
        {!showRenewals && (
          <div className="p-4 border-b border-gray-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher par numéro, assuré, cédante, branche, garantie..."
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
                {Object.entries(statutLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input
                type="text"
                placeholder="Filtrer par branche"
                value={brancheFilter}
                onChange={(e) => updateFilter('branche', e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {showRenewals ? (
          (renewals?.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-gray-500">Aucune échéance dans les 30 prochains jours</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Assuré</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Cédante</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Branche</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Échéance</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {renewals!.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-[13px] text-gray-900">{r.assure?.raisonSociale}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-900">{r.affaire?.cedante?.raisonSociale}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-600">{r.branche || '-'}</td>
                      <td className="px-4 py-3 text-[13px] text-amber-700 font-medium">{new Date(r.dateEcheance).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => navigate(`/affaires/${r.affaireId}`)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : isLoading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Aucune affaire facultative trouvée</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">N° Affaire</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Assuré</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Cédante</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Police</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Branche</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Prime Cédée</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Commission ARS</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-900 font-mono">{item.affaire.numero}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-900">{item.assure?.raisonSociale || '-'}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-900">{item.affaire.cedante?.raisonSociale || '-'}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-600 font-mono">{item.numeroPoliceCedante || '-'}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-600">{item.branche || '-'}</td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-gray-900">
                      {formatCurrency(item.primeCedee ?? 0, item.affaire ? 'TND' : 'TND')}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-green-600">
                      {formatCurrency(commissionTotal(item), 'TND')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-[11px] rounded-full ${statutColors[item.affaire.statut]}`}>
                        {statutLabels[item.affaire.statut]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => navigate(`/affaires/${item.affaireId}`)}
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