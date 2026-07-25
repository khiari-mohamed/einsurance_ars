import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Eye, Clock, X } from 'lucide-react';
import { traitesApi } from '../../api/traites.api';
import { formatCurrency } from '../../lib/currency';
import {
  statutColors, statutLabels, AffaireStatut, reassuranceTypeLabels,
  formeCouvertureLabels, periodiciteLabels, Periodicite, ReassuranceType,
} from '../../types/affaire.types';
import { TraiteListItem } from '../../types/traite.types';
import AffaireCreateModal from '../affaires/AffaireCreateModal';
import { AffaireType } from '../../types/affaire.types';

const LIMIT = 20;

export default function TraitesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showRenewals, setShowRenewals] = useState(false);
  const navigate = useNavigate();

  const searchTerm = searchParams.get('search') || '';
  const statutFilter = (searchParams.get('statut') as AffaireStatut) || '';
  const periodiciteFilter = (searchParams.get('periodicite') as Periodicite) || '';
  const page = Number(searchParams.get('page') || '1');

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.delete('page');
    setSearchParams(params);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['traites', searchTerm, statutFilter, periodiciteFilter, page],
    queryFn: async () => {
      const { data } = await traitesApi.getAll({
        search: searchTerm || undefined,
        statut: statutFilter || undefined,
        periodicite: periodiciteFilter || undefined,
        page,
        limit: LIMIT,
      });
      return data;
    },
    placeholderData: (prev) => prev,
    enabled: !showRenewals,
  });

  const { data: renewals } = useQuery({
    queryKey: ['traites-renewals'],
    queryFn: async () => (await traitesApi.getRenewalsAlert(60)).data,
  });

  const { data: stats } = useQuery({
    queryKey: ['traites-stats'],
    queryFn: async () => (await traitesApi.getStats()).data,
  });

  const items = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  const commissionTotal = (item: TraiteListItem) =>
    item.affaire.reassureurs.reduce((sum, r) => sum + (r.commissionArs ?? 0), 0);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h1 className="text-[24px] font-semibold text-gray-900">Traités</h1>
          <p className="text-[13px] text-gray-500 mt-1">
            {total} traité{total !== 1 ? 's' : ''}
            {stats && <> • {stats.totalTraitesActifs} actif{stats.totalTraitesActifs !== 1 ? 's' : ''} (placés)</>}
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

      {renewals && renewals.length > 0 && !showRenewals && (
        <button
          onClick={() => setShowRenewals(true)}
          className="w-full mb-4 flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left hover:bg-amber-100 transition-colors"
        >
          <Clock size={18} className="text-amber-600 shrink-0" />
          <span className="text-[13px] text-amber-800">
            <strong>{renewals.length}</strong> traité{renewals.length !== 1 ? 's' : ''} arrive{renewals.length === 1 ? '' : 'nt'} à échéance dans les 60 prochains jours
          </span>
        </button>
      )}

      {showRenewals && (
        <div className="mb-4 flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-[13px] font-medium text-amber-800">Vue: renouvellements à venir (60 jours)</span>
          <button onClick={() => setShowRenewals(false)} className="p-1 rounded hover:bg-amber-100 text-amber-700">
            <X size={16} />
          </button>
        </div>
      )}

      {stats && stats.byType.length > 0 && !showRenewals && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {stats.byType.map((b) => (
            <div key={b.type} className="shrink-0 px-3 py-2 bg-white border border-gray-100 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
              <p className="text-[11px] text-gray-500">{reassuranceTypeLabels[b.type]}</p>
              <p className="text-[13px] font-semibold text-gray-900">
                {formatCurrency(b.totalPrimePrevisionnelle, 'TND')} <span className="text-[11px] font-normal text-gray-400">({b.count})</span>
              </p>
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
                placeholder="Rechercher par numéro, référence, branche, cédante..."
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
              <select
                value={periodiciteFilter}
                onChange={(e) => updateFilter('periodicite', e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Toutes périodicités</option>
                {Object.entries(periodiciteLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        )}

        {showRenewals ? (
          (renewals?.length ?? 0) === 0 ? (
            <div className="p-8 text-center text-gray-500">Aucune échéance dans les 60 prochains jours</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Référence</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Cédante</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Échéance</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {renewals!.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-[13px] text-gray-900">{r.referenceTraite || <span className="text-gray-400">Sans référence</span>}</td>
                      <td className="px-4 py-3 text-[13px] text-gray-900">{r.affaire?.cedante?.raisonSociale}</td>
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
          <div className="p-8 text-center text-gray-500">Aucun traité trouvé</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">N° Affaire</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Référence</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Cédante</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Forme de couverture</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Prime Prév.</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">PMD</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Statut</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-[13px] font-medium text-gray-900 font-mono">{item.affaire.numero}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-600">{item.referenceTraite || '-'}</td>
                    <td className="px-4 py-3 text-[13px] text-gray-900">{item.affaire.cedante?.raisonSociale || '-'}</td>
                    <td className="px-4 py-3 text-[13px]">
                      {item.formeCouverture ? (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[11px] rounded-full">
                          {formeCouvertureLabels[item.formeCouverture]}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-gray-900">
                      {item.primePrevisionnelle != null ? formatCurrency(item.primePrevisionnelle, item.affaire.currency) : '-'}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-right font-medium text-gray-900">
                      {item.pmd != null ? formatCurrency(item.pmd, item.affaire.currency) : '-'}
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