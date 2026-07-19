import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Download, Filter, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auditApi } from '../../api/master-data.api';

type EntityType = '' | 'ASSURE' | 'CEDANTE' | 'REASSUREUR' | 'CO_COURTIER';

export default function ReferentielHistory() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [entityType, setEntityType] = useState<EntityType>('');
  const [search, setSearch] = useState('');

  const { data: history, isLoading, isError } = useQuery({
    queryKey: ['referentiel-history', page, limit, entityType, search],
    queryFn: async () => {
      const response = await auditApi.getReferentielHistory({
        page,
        limit,
        entityType: entityType || undefined,
        search: search || undefined,
      });
      return response.data;
    },
  });

  const getDetailRoute = (entityType: string, entityId: string): string => {
    const routes: Record<string, string> = {
      ASSURE: `/assures/${entityId}`,
      CEDANTE: `/cedantes/${entityId}`,
      REASSUREUR: `/reassureurs/${entityId}`,
      CO_COURTIER: `/co-courtiers/${entityId}`,
    };
    return routes[entityType] || '#';
  };

  const entityTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      ASSURE: 'Client',
      CEDANTE: "Compagnie d'assurances",
      REASSUREUR: 'Réassureur',
      CO_COURTIER: 'Courtier en réassurance',
    };
    return labels[type] || type;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('DEACTIVATE')) return 'bg-red-100 text-red-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/assures')}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Historique Référentiel</h1>
            <p className="text-gray-600 mt-1">
              Journal de tous les désactivations pour les clients, compagnies, réassureurs et courtiers
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter size={16} className="inline mr-2" />
                Type d'entité
              </label>
              <select
                value={entityType}
                onChange={(e) => {
                  setEntityType(e.target.value as EntityType);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tous les types</option>
                <option value="ASSURE">Clients</option>
                <option value="CEDANTE">Compagnies d'assurances</option>
                <option value="REASSUREUR">Réassureurs</option>
                <option value="CO_COURTIER">Courtiers en réassurance</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Recherche</label>
              <input
                type="text"
                placeholder="Nom ou code..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2">
              <Download size={16} />
              Exporter
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-600">Chargement...</div>
          ) : isError ? (
            <div className="p-8 text-center text-red-600">Erreur lors du chargement</div>
          ) : !history?.data || history.data.length === 0 ? (
            <div className="p-8 text-center text-gray-600">Aucun enregistrement trouvé</div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date / Heure
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Entité
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Affichage
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {history.data.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{log.userName}</div>
                        <div className="text-xs text-gray-500">{log.user?.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {log.entityLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {log.entityName}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-600">
                        {log.after?.code}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                          {log.action === 'DEACTIVATE' && 'Désactivé'}
                          {log.action === 'BULK_DEACTIVATE' && 'Désactivé (lot)'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => navigate(getDetailRoute(log.entityType, log.entityId))}
                          className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                          title="Afficher les détails"
                        >
                          <Eye size={16} />
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Affichage {(page - 1) * limit + 1} à{' '}
                  {Math.min(page * limit, history.total)} sur {history.total}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Précédent
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">
                    Page {page} / {history.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(history.totalPages, page + 1))}
                    disabled={page >= history.totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
