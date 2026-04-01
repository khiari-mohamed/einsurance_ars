import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, DollarSign, Users, TrendingUp, Building2, FileText, Edit2, Activity, AlertTriangle } from 'lucide-react';
import { affairesApi } from '../../api/affaires.api';
import { formatCurrency } from '../../lib/currency';
import { Affaire, AffaireStatus } from '../../types/affaire.types';
import AffaireWorkflowActions from './AffaireWorkflowActions';
import AffaireEditModal from './AffaireEditModal';

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

export default function AffaireDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showEditModal, setShowEditModal] = useState(false);

  const { data: affaire, isLoading } = useQuery<Affaire>({
    queryKey: ['affaire', id],
    queryFn: async () => {
      const { data } = await affairesApi.getOne(id!);
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => affairesApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affaires'] });
      alert('✅ Affaire supprimée avec succès');
      navigate('/affaires');
    },
    onError: (error: any) => {
      alert('❌ ' + (error.response?.data?.message || 'Erreur lors de la suppression'));
    },
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR');
  };

  const handleDelete = () => {
    if (!affaire) return;
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'affaire ${affaire.numeroAffaire} ? Cette action est irréversible.`)) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  if (!affaire) {
    return (
      <div className="p-6 flex items-center justify-center h-96">
        <div className="text-gray-500">Affaire non trouvée</div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/affaires')}
          className="flex items-center gap-2 text-[13px] text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft size={16} />
          Retour aux affaires
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[24px] font-semibold text-gray-900">{affaire.numeroAffaire}</h1>
            <p className="text-[13px] text-gray-600 mt-1">
              Créée le {formatDate(affaire.createdAt)} par {affaire.createdBy.firstName} {affaire.createdBy.lastName}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 text-[12px] rounded-full font-medium ${statusColors[affaire.status]}`}>
              {statusLabels[affaire.status]}
            </span>
            {affaire.status === AffaireStatus.DRAFT && (
              <button
                onClick={() => setShowEditModal(true)}
                className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                title="Modifier"
              >
                <Edit2 size={18} />
              </button>
            )}
            {(affaire.status === AffaireStatus.DRAFT || affaire.status === AffaireStatus.ANNULE) && (
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                title="Supprimer"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <DollarSign size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase font-medium">Prime Cédée</p>
              <p className="text-[20px] font-semibold text-gray-900">{formatCurrency(affaire.primeCedee, affaire.devise)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase font-medium">Commission ARS</p>
              <p className="text-[20px] font-semibold text-green-600">{formatCurrency(affaire.montantCommissionARS, affaire.devise)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <Users size={20} className="text-purple-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase font-medium">Réassureurs</p>
              <p className="text-[20px] font-semibold text-gray-900">{affaire.reinsurers.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-50 rounded-lg">
              <AlertTriangle size={20} className="text-orange-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase font-medium">Sinistres</p>
              <p className="text-[20px] font-semibold text-gray-900">{affaire.sinistresCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex gap-6">
                {['overview', 'financials', 'reinsurers', 'activity'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-[13px] font-medium pb-2 border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab === 'overview' && 'Vue d\'ensemble'}
                    {tab === 'financials' && 'Données Financières'}
                    {tab === 'reinsurers' && 'Réassureurs'}
                    {tab === 'activity' && 'Activité'}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-[14px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Building2 size={16} />
                      Parties Prenantes
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Assuré</p>
                        <p className="text-[13px] text-gray-900">{affaire.assure.raisonSociale}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Cédante</p>
                        <p className="text-[13px] text-gray-900">{affaire.cedante.raisonSociale}</p>
                      </div>
                      {affaire.coCourtier && (
                        <div>
                          <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Co-Courtier</p>
                          <p className="text-[13px] text-gray-900">{affaire.coCourtier.raisonSociale}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[14px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText size={16} />
                      Informations Contractuelles
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Catégorie</p>
                        <p className="text-[13px] text-gray-900">{affaire.category === 'facultative' ? 'Facultative' : 'Traitée'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Type</p>
                        <p className="text-[13px] text-gray-900">{affaire.type === 'proportionnel' ? 'Proportionnel' : 'Non Proportionnel'}</p>
                      </div>
                      {affaire.numeroPolice && (
                        <div>
                          <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">N° Police</p>
                          <p className="text-[13px] text-gray-900">{affaire.numeroPolice}</p>
                        </div>
                      )}
                      {affaire.branche && (
                        <div>
                          <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Branche</p>
                          <p className="text-[13px] text-gray-900">{affaire.branche}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Période</p>
                        <p className="text-[13px] text-gray-900">
                          {formatDate(affaire.dateEffet)} → {formatDate(affaire.dateEcheance)}
                        </p>
                      </div>
                      {affaire.category === 'traitee' && affaire.treatyType && (
                        <>
                          <div>
                            <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Type Traité</p>
                            <p className="text-[13px] text-gray-900">{affaire.treatyType.toUpperCase()}</p>
                          </div>
                          {affaire.periodiciteComptes && (
                            <div>
                              <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Périodicité</p>
                              <p className="text-[13px] text-gray-900">{affaire.periodiciteComptes}</p>
                            </div>
                          )}
                          {affaire.pmd && (
                            <div>
                              <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">PMD</p>
                              <p className="text-[13px] text-gray-900">{formatCurrency(affaire.pmd, affaire.devise)}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'financials' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-[14px] font-semibold text-gray-900 mb-4">Données de Base</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Capital Assuré 100%</p>
                        <p className="text-[15px] font-semibold text-gray-900">{formatCurrency(affaire.capitalAssure100, affaire.devise)}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Prime 100%</p>
                        <p className="text-[15px] font-semibold text-gray-900">{formatCurrency(affaire.prime100, affaire.devise)}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Taux Cession</p>
                        <p className="text-[15px] font-semibold text-gray-900">{affaire.tauxCession}%</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-[11px] text-blue-600 uppercase font-medium mb-1">Prime Cédée</p>
                        <p className="text-[15px] font-semibold text-blue-600">{formatCurrency(affaire.primeCedee, affaire.devise)}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[14px] font-semibold text-gray-900 mb-4">Commissions</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <p className="text-[12px] text-gray-600 mb-2">Commission Cédante</p>
                        <p className="text-[13px] text-gray-700 mb-1">Taux: {affaire.tauxCommissionCedante}%</p>
                        <p className="text-[16px] font-semibold text-gray-900">{formatCurrency(affaire.montantCommissionCedante, affaire.devise)}</p>
                      </div>
                      <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                        <p className="text-[12px] text-green-700 mb-2">Commission ARS</p>
                        <p className="text-[13px] text-green-700 mb-1">Taux: {affaire.tauxCommissionARS}%</p>
                        <p className="text-[16px] font-semibold text-green-700">{formatCurrency(affaire.montantCommissionARS, affaire.devise)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'reinsurers' && (
                <div>
                  <h3 className="text-[14px] font-semibold text-gray-900 mb-4">Distribution des Réassureurs</h3>
                  <div className="space-y-3">
                    {affaire.reinsurers.map((reinsurer) => (
                      <div key={reinsurer.id} className="p-4 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-[14px] font-medium text-gray-900">{reinsurer.reassureur.raisonSociale}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[12px] text-gray-500">{reinsurer.role}</p>
                              {reinsurer.signed && (
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full">Signé</span>
                              )}
                              {reinsurer.slipReceived && (
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full">Slip Reçu</span>
                              )}
                            </div>
                          </div>
                          <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[13px] font-semibold rounded-full">
                            {reinsurer.share}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-[12px]">
                          <div>
                            <p className="text-gray-500 mb-1">Prime Part</p>
                            <p className="font-medium text-gray-900">{formatCurrency(reinsurer.primePart, affaire.devise)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Commission Part</p>
                            <p className="font-medium text-gray-900">{formatCurrency(reinsurer.commissionPart, affaire.devise)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 mb-1">Net Amount</p>
                            <p className="font-medium text-green-600">{formatCurrency(reinsurer.netAmount, affaire.devise)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'activity' && (
                <div>
                  <h3 className="text-[14px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Activity size={16} />
                    Informations Système
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Exercice</p>
                        <p className="text-[15px] font-semibold text-gray-900">{affaire.exercice}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Mode Paiement</p>
                        <p className="text-[15px] font-semibold text-gray-900">
                          {affaire.paymentMode === 'inclus_situation' ? 'Inclus Situation' : 'Payé Hors Situation'}
                        </p>
                      </div>
                      {affaire.bordereauReference && (
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <p className="text-[11px] text-blue-600 uppercase font-medium mb-1">Bordereau</p>
                          <p className="text-[13px] font-medium text-blue-900">{affaire.bordereauReference}</p>
                        </div>
                      )}
                      {affaire.slipCouvReference && (
                        <div className="p-4 bg-purple-50 rounded-lg">
                          <p className="text-[11px] text-purple-600 uppercase font-medium mb-1">Slip Couverture</p>
                          <p className="text-[13px] font-medium text-purple-900">{affaire.slipCouvReference}</p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <p className="text-[12px] text-gray-600 mb-2">Statut Paiement Cédante</p>
                        <p className="text-[14px] font-semibold text-gray-900">{affaire.paymentStatusCedante}</p>
                        <p className="text-[12px] text-gray-500 mt-1">Encaissé: {formatCurrency(affaire.primeEncaissee, affaire.devise)}</p>
                      </div>
                      <div className="p-4 border border-gray-200 rounded-lg">
                        <p className="text-[12px] text-gray-600 mb-2">Statut Paiement Réassureurs</p>
                        <p className="text-[14px] font-semibold text-gray-900">{affaire.paymentStatusReinsurers}</p>
                        <p className="text-[12px] text-gray-500 mt-1">Décaissé: {formatCurrency(affaire.primeDecaissee, affaire.devise)}</p>
                      </div>
                    </div>
                    {affaire.notes && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-[12px] text-yellow-800 font-medium mb-1">Notes</p>
                        <p className="text-[13px] text-yellow-900">{affaire.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5">
            <h3 className="text-[14px] font-semibold text-gray-900 mb-4">Actions Workflow</h3>
            <AffaireWorkflowActions affaire={affaire} />
          </div>
        </div>
      </div>

      {showEditModal && (
        <AffaireEditModal affaire={affaire} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}
