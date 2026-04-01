import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, Filter, Eye, FileText, Zap, Download, Send, CheckCircle, 
  XCircle, Archive, AlertCircle, Clock, TrendingUp, DollarSign 
} from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import type { Bordereau, BordereauFilters } from '../../types/bordereau.types';
import BordereauCreateModal from './BordereauCreateModal';
import BordereauGenerateModal from './BordereauGenerateModal';
import BordereauPaymentModal from './BordereauPaymentModal';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';

const STATUS_CONFIG = {
  brouillon: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800', icon: FileText },
  en_validation: { label: 'En Validation', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  valide: { label: 'Validé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  envoye: { label: 'Envoyé', color: 'bg-blue-100 text-blue-800', icon: Send },
  comptabilise: { label: 'Comptabilisé', color: 'bg-purple-100 text-purple-800', icon: DollarSign },
  archive: { label: 'Archivé', color: 'bg-gray-100 text-gray-600', icon: Archive },
};

const TYPE_LABELS = {
  cession: 'Cession',
  reassureur: 'Réassureur',
  sinistre: 'Sinistre',
  situation: 'Situation',
};

export default function BordereauxList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{ isOpen: boolean; bordereau?: Bordereau }>({ isOpen: false });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [filters, setFilters] = useState<BordereauFilters & { 
    minAmount?: number; 
    maxAmount?: number; 
    overdue?: string;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['bordereaux', filters],
    queryFn: () => bordereauxApi.getAll(filters),
  });

  const { data: stats } = useQuery({
    queryKey: ['bordereaux-stats', filters.cedanteId, filters.reassureurId, filters.startDate, filters.endDate],
    queryFn: () => bordereauxApi.getStatistics({
      cedanteId: filters.cedanteId,
      reassureurId: filters.reassureurId,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }),
  });

  const { data: overdue } = useQuery({
    queryKey: ['bordereaux-overdue'],
    queryFn: () => bordereauxApi.getOverdue(),
  });

  const { data: dueSoon } = useQuery({
    queryKey: ['bordereaux-due-soon'],
    queryFn: () => bordereauxApi.getDueSoon(7),
  });

  const bulkValidateMutation = useMutation({
    mutationFn: (ids: string[]) => bordereauxApi.bulkValidate(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
      setSelectedIds([]);
    },
  });



  const bulkArchiveMutation = useMutation({
    mutationFn: (ids: string[]) => bordereauxApi.bulkArchive(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
      setSelectedIds([]);
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async (id: string) => {
      const blob = await bordereauxApi.generatePdf(id);
      const url = window.URL.createObjectURL(blob.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bordereau-${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
  });

  const handleSelectAll = () => {
    if (selectedIds.length === data?.data.data.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data?.data.data.map((b: Bordereau) => b.id) || []);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bordereaux</h1>
          <p className="text-gray-600 mt-1">Gestion des bordereaux de cession, réassureur, sinistre et situation</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => setIsGenerateModalOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <Zap size={18} />
            Générer Auto
          </Button>
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            className="gap-2"
          >
            <Plus size={18} />
            Nouveau Bordereau
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Bordereaux</p>
              <p className="text-3xl font-bold mt-1">{stats?.data?.total || 0}</p>
            </div>
            <FileText className="text-blue-500" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Prime Totale</p>
              <p className="text-2xl font-bold mt-1">
                {(stats?.data?.totalPrime || 0).toLocaleString()} TND
              </p>
            </div>
            <TrendingUp className="text-green-500" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">En Retard</p>
              <p className="text-3xl font-bold mt-1 text-red-600">{overdue?.data?.length || 0}</p>
            </div>
            <AlertCircle className="text-red-500" size={32} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">À Échoir (7j)</p>
              <p className="text-3xl font-bold mt-1 text-orange-600">{dueSoon?.data?.length || 0}</p>
            </div>
            <Clock className="text-orange-500" size={32} />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter size={20} className="text-gray-400" />
          
          <select
            value={filters.type || ''}
            onChange={(e) => setFilters({ ...filters, type: e.target.value as any, page: 1 })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Tous les types</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={filters.status || ''}
            onChange={(e) => setFilters({ ...filters, status: e.target.value as any, page: 1 })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Tous les statuts</option>
            {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Rechercher..."
            value={filters.search || ''}
            onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            className="flex-1 border rounded-lg px-3 py-2 text-sm min-w-[200px]"
          />

          <select
            value={filters.overdue || ''}
            onChange={(e) => setFilters({ ...filters, overdue: e.target.value, page: 1 })}
            className="border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Tous</option>
            <option value="true">En retard uniquement</option>
          </select>
        </div>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{selectedIds.length} bordereau(x) sélectionné(s)</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkValidateMutation.mutate(selectedIds)}
                disabled={bulkValidateMutation.isPending}
              >
                <CheckCircle size={16} className="mr-1" />
                Valider
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkArchiveMutation.mutate(selectedIds)}
                disabled={bulkArchiveMutation.isPending}
              >
                <Archive size={16} className="mr-1" />
                Archiver
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedIds([])}
              >
                <XCircle size={16} className="mr-1" />
                Annuler
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      {isLoading ? (
        <Card className="p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === data?.data.data.length && data?.data.data.length > 0}
                      onChange={handleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    N° Bordereau
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cédante
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Période
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Solde
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data?.data?.data?.map((bordereau: Bordereau) => {
                  const StatusIcon = STATUS_CONFIG[bordereau.status].icon;
                  return (
                    <tr key={bordereau.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(bordereau.id)}
                          onChange={() => handleSelectOne(bordereau.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{bordereau.numero}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(bordereau.dateEmission).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className="uppercase bg-gray-100 text-gray-800">
                          {TYPE_LABELS[bordereau.type]}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {bordereau.cedante?.raisonSociale || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(bordereau.dateDebut).toLocaleDateString('fr-FR')} - {' '}
                        {new Date(bordereau.dateFin).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <StatusIcon size={16} />
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[bordereau.status].color}`}>
                            {STATUS_CONFIG[bordereau.status].label}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm font-semibold text-gray-900">
                          {bordereau.solde.toLocaleString()} {bordereau.devise}
                        </div>
                        {bordereau.acompteRecu > 0 && (
                          <div className="text-xs text-green-600">
                            Acompte: {bordereau.acompteRecu.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/bordereaux/${bordereau.id}`)}
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => downloadPdfMutation.mutate(bordereau.id)}
                            disabled={downloadPdfMutation.isPending}
                            title="Télécharger PDF"
                          >
                            <Download size={16} />
                          </Button>
                          {bordereau.status === 'envoye' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPaymentModal({ isOpen: true, bordereau })}
                              title="Enregistrer paiement"
                            >
                              <DollarSign size={16} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data?.data && data.data.total > 0 && (
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Affichage de {((filters.page! - 1) * filters.limit!) + 1} à {Math.min(filters.page! * filters.limit!, data.data.total)} sur {data.data.total} résultats
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFilters({ ...filters, page: filters.page! - 1 })}
                  disabled={filters.page === 1}
                >
                  Précédent
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFilters({ ...filters, page: filters.page! + 1 })}
                  disabled={filters.page! * filters.limit! >= data.data.total}
                >
                  Suivant
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Modals */}
      <BordereauCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      <BordereauGenerateModal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
      />

      {paymentModal.bordereau && (
        <BordereauPaymentModal
          isOpen={paymentModal.isOpen}
          onClose={() => setPaymentModal({ isOpen: false })}
          bordereau={paymentModal.bordereau}
        />
      )}
    </div>
  );
}
