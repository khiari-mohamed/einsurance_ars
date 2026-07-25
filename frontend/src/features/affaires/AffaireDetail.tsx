import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Trash2, DollarSign, Users, TrendingUp, Building2, FileText,
  Edit2, AlertTriangle,
} from 'lucide-react';
import { affairesApi } from '../../api/affaires.api';
import { formatCurrency } from '../../lib/currency';
import {
  Affaire, AffaireStatut, AffaireType, statutColors, statutLabels, typeLabels,
  reassuranceTypeLabels, formeCouvertureLabels, periodiciteLabels, modeRenouvellementLabels,
} from '../../types/affaire.types';
import AffaireEditModal from './AffaireEditModal';
import AffaireWorkflowActions from './AffaireWorkflowActions';
import GuaranteeLinesManager from '../../components/affaires/GuaranteeLinesManager';
import PmdInstalmentsManager from '../../components/affaires/PmdInstalmentsManager';
import TreatyAccountRubriquesManager from '../../components/affaires/TreatyAccountRubriquesManager';
import TreatyParametersManager from '../../components/affaires/TreatyParametersManager';

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
      navigate('/affaires');
    },
    onError: (error: any) => {
      alert('❌ ' + (error.response?.data?.message || 'Erreur lors de la suppression'));
    },
  });

  const formatDate = (date?: string) => (date ? new Date(date).toLocaleDateString('fr-FR') : '-');

  const handleDelete = () => {
    if (!affaire) return;
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'affaire ${affaire.numero} ? Cette action est irréversible.`)) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return <div className="p-6 flex items-center justify-center h-96 text-gray-500">Chargement...</div>;
  }

  if (!affaire) {
    return <div className="p-6 flex items-center justify-center h-96 text-gray-500">Affaire non trouvée</div>;
  }

  const commissionArsTotal = affaire.reassureurs.reduce((sum, r) => sum + (r.commissionArs ?? 0), 0);
  const primeAffichee = affaire.type === AffaireType.FACULTATIVE
    ? affaire.facultativeData?.primeCedee ?? 0
    : affaire.traiteData?.primePrevisionnelle ?? 0;

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <button onClick={() => navigate('/affaires')} className="flex items-center gap-2 text-[13px] text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} />
          Retour aux affaires
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[24px] font-semibold text-gray-900 font-mono">{affaire.numero}</h1>
            <p className="text-[13px] text-gray-600 mt-1">
              {typeLabels[affaire.type]} · Créée le {formatDate(affaire.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 text-[12px] rounded-full font-medium ${statutColors[affaire.statut]}`}>
              {statutLabels[affaire.statut]}
            </span>
            {affaire.statut !== AffaireStatut.PLACEMENT_REALISE && (
              <button onClick={() => setShowEditModal(true)} className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Modifier">
                <Edit2 size={18} />
              </button>
            )}
            {affaire.statut !== AffaireStatut.PLACEMENT_REALISE && (
              <button onClick={handleDelete} className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors" title="Supprimer">
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><DollarSign size={20} className="text-blue-600" /></div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase font-medium">
                {affaire.type === AffaireType.FACULTATIVE ? 'Prime Cédée' : 'Prime Prévisionnelle'}
              </p>
              <p className="text-[20px] font-semibold text-gray-900">{formatCurrency(primeAffichee, affaire.currency)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><TrendingUp size={20} className="text-green-600" /></div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase font-medium">Commission ARS (total)</p>
              <p className="text-[20px] font-semibold text-green-600">{formatCurrency(commissionArsTotal, affaire.currency)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg"><Users size={20} className="text-purple-600" /></div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase font-medium">Réassureurs</p>
              <p className="text-[20px] font-semibold text-gray-900">{affaire.reassureurs.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg"><AlertTriangle size={20} className="text-orange-600" /></div>
            <div>
              <p className="text-[11px] text-gray-500 uppercase font-medium">Sinistres</p>
              <p className="text-[20px] font-semibold text-gray-900">{affaire._count?.sinistres ?? affaire.sinistres?.length ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            <div className="border-b border-gray-100 px-6 py-4">
              <div className="flex gap-6">
                {['overview', 'financials', 'reinsurers', 'related'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-[13px] font-medium pb-2 border-b-2 transition-colors ${
                      activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab === 'overview' && "Vue d'ensemble"}
                    {tab === 'financials' && 'Données Financières'}
                    {tab === 'reinsurers' && 'Réassureurs'}
                    {tab === 'related' && 'Sinistres & Bordereaux'}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-[14px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Building2 size={16} /> Parties Prenantes
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Cédante</p>
                        <p className="text-[13px] text-gray-900">{affaire.cedante?.raisonSociale || '-'}</p>
                      </div>
                      {affaire.type === AffaireType.FACULTATIVE && (
                        <div>
                          <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Assuré</p>
                          <p className="text-[13px] text-gray-900">{affaire.facultativeData?.assure?.raisonSociale || '-'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText size={16} /> Informations Contractuelles
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Type</p>
                        <p className="text-[13px] text-gray-900">{typeLabels[affaire.type]}</p>
                      </div>
                      {affaire.type === AffaireType.FACULTATIVE && affaire.facultativeData && (
                        <>
                          <div><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Type de réassurance</p><p className="text-[13px] text-gray-900">{reassuranceTypeLabels[affaire.facultativeData.reassuranceType]}</p></div>
                          {affaire.facultativeData.numeroPoliceCedante && <div><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">N° Police</p><p className="text-[13px] text-gray-900">{affaire.facultativeData.numeroPoliceCedante}</p></div>}
                          {affaire.facultativeData.branche && <div><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Branche</p><p className="text-[13px] text-gray-900">{affaire.facultativeData.branche}</p></div>}
                          <div><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Période</p><p className="text-[13px] text-gray-900">{formatDate(affaire.facultativeData.dateEffet)} → {formatDate(affaire.facultativeData.dateEcheance)}</p></div>
                          {affaire.facultativeData.modeRenouvellement && <div><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Renouvellement</p><p className="text-[13px] text-gray-900">{modeRenouvellementLabels[affaire.facultativeData.modeRenouvellement]}</p></div>}
                        </>
                      )}
                      {affaire.type === AffaireType.TRAITE && affaire.traiteData && (
                        <>
                          {affaire.traiteData.referenceTraite && <div><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Référence</p><p className="text-[13px] text-gray-900">{affaire.traiteData.referenceTraite}</p></div>}
                          <div><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Type de réassurance</p><p className="text-[13px] text-gray-900">{reassuranceTypeLabels[affaire.traiteData.reassuranceType]}</p></div>
                          {affaire.traiteData.formeCouverture && <div><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Forme de couverture</p><p className="text-[13px] text-gray-900">{formeCouvertureLabels[affaire.traiteData.formeCouverture]}</p></div>}
                          <div><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Périodicité</p><p className="text-[13px] text-gray-900">{periodiciteLabels[affaire.traiteData.periodicite]}</p></div>
                          <div><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Période</p><p className="text-[13px] text-gray-900">{formatDate(affaire.traiteData.dateEffet)} → {formatDate(affaire.traiteData.dateEcheance)}</p></div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'financials' && (
                <div className="space-y-8">
                  {affaire.type === AffaireType.FACULTATIVE && affaire.facultativeData ? (
                    <>
                      <div>
                        <h3 className="text-[14px] font-semibold text-gray-900 mb-4">Données de Base</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-gray-50 rounded-lg"><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Prime 100%</p><p className="text-[15px] font-semibold text-gray-900">{formatCurrency(affaire.facultativeData.prime100Pct, affaire.currency)}</p></div>
                          <div className="p-4 bg-gray-50 rounded-lg"><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Taux Cession</p><p className="text-[15px] font-semibold text-gray-900">{affaire.facultativeData.tauxCession}%</p></div>
                          <div className="p-4 bg-blue-50 rounded-lg"><p className="text-[11px] text-blue-600 uppercase font-medium mb-1">Prime Cédée</p><p className="text-[15px] font-semibold text-blue-600">{formatCurrency(affaire.facultativeData.primeCedee ?? 0, affaire.currency)}</p></div>
                          <div className="p-4 bg-gray-50 rounded-lg"><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Commission Cédante</p><p className="text-[15px] font-semibold text-gray-900">{formatCurrency(affaire.facultativeData.commissionCedante ?? 0, affaire.currency)}</p></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <GuaranteeLinesManager affaireId={affaire.id} />
                      </div>
                    </>
                  ) : affaire.traiteData ? (
                    <>
                      <div>
                        <h3 className="text-[14px] font-semibold text-gray-900 mb-4">Données de Base</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 bg-blue-50 rounded-lg"><p className="text-[11px] text-blue-600 uppercase font-medium mb-1">Prime Prévisionnelle</p><p className="text-[15px] font-semibold text-blue-600">{formatCurrency(affaire.traiteData.primePrevisionnelle ?? 0, affaire.currency)}</p></div>
                          <div className="p-4 bg-gray-50 rounded-lg"><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">PMD</p><p className="text-[15px] font-semibold text-gray-900">{formatCurrency(affaire.traiteData.pmd ?? 0, affaire.currency)}</p></div>
                          <div className="p-4 bg-gray-50 rounded-lg"><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Commission Cédante</p><p className="text-[15px] font-semibold text-gray-900">{affaire.traiteData.tauxCommissionCedante ?? 0}%</p></div>
                          <div className="p-4 bg-gray-50 rounded-lg"><p className="text-[11px] text-gray-500 uppercase font-medium mb-1">Seuil Notification</p><p className="text-[15px] font-semibold text-gray-900">{formatCurrency(affaire.traiteData.seuilNotification ?? 0, affaire.currency)}</p></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <TreatyAccountRubriquesManager affaireId={affaire.id} />
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <PmdInstalmentsManager affaireId={affaire.id} />
                      </div>

                      <div className="pt-2 border-t border-gray-100">
                        <TreatyParametersManager affaireId={affaire.id} currency={affaire.currency} />
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {activeTab === 'reinsurers' && (
                <div className="space-y-3">
                  {affaire.reassureurs.map((r) => (
                    <div key={r.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-[14px] font-medium text-gray-900">{r.reassureur?.raisonSociale}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[12px] text-gray-500 font-mono">{r.reassureur?.code}</span>
                            {r.isLeader && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full">Leader / Apériteur</span>}
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full">{r.commissionMode === 'CALCULABLE' ? `Calculable (${r.tauxCommissionArs ?? 0}%)` : 'Forfaitaire'}</span>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[13px] font-semibold rounded-full">{r.partPct}%</span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-[12px]">
                        <div><p className="text-gray-500 mb-1">Prime Brute</p><p className="font-medium text-gray-900">{formatCurrency(r.primeBrute ?? 0, affaire.currency)}</p></div>
                        <div><p className="text-gray-500 mb-1">Commission ARS</p><p className="font-medium text-green-600">{formatCurrency(r.commissionArs ?? 0, affaire.currency)}</p></div>
                        <div><p className="text-gray-500 mb-1">Commission Cédante</p><p className="font-medium text-gray-900">{formatCurrency(r.commissionCedante ?? 0, affaire.currency)}</p></div>
                        <div><p className="text-gray-500 mb-1">Net Réassureur</p><p className="font-medium text-gray-900">{formatCurrency(r.primeNetteReassureur ?? 0, affaire.currency)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'related' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[13px] font-semibold text-gray-900 mb-2">Sinistres récents</h4>
                    {(affaire.sinistres?.length ?? 0) === 0 ? (
                      <p className="text-[13px] text-gray-500">Aucun sinistre.</p>
                    ) : (
                      <div className="space-y-2">
                        {affaire.sinistres!.map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                            <span className="text-[13px] font-mono text-gray-900">{s.numero}</span>
                            <span className="text-[12px] text-gray-500">{s.statut}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-gray-900 mb-2">Bordereaux récents</h4>
                    {(affaire.bordereaux?.length ?? 0) === 0 ? (
                      <p className="text-[13px] text-gray-500">Aucun bordereau.</p>
                    ) : (
                      <div className="space-y-2">
                        {affaire.bordereaux!.map((b: any) => (
                          <div key={b.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                            <span className="text-[13px] font-mono text-gray-900">{b.numero}</span>
                            <span className="text-[12px] text-gray-500">{b.type} · {b.statut}</span>
                          </div>
                        ))}
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