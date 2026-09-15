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
      alert(error.response?.data?.message || 'Erreur lors de la suppression');
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
    return <div className="p-6 flex items-center justify-center h-96 text-sm text-muted-foreground">Chargement...</div>;
  }

  if (!affaire) {
    return <div className="p-6 flex items-center justify-center h-96 text-sm text-muted-foreground">Affaire non trouvée</div>;
  }

  // FIX (Affaires pass — Number() coercion, same rationale as AffairesList).
  const commissionArsTotal = affaire.reassureurs.reduce((sum, r) => sum + Number(r.commissionArs ?? 0), 0);
  const primeAffichee = affaire.type === AffaireType.FACULTATIVE
    ? Number(affaire.facultativeData?.primeCedee ?? 0)
    : Number(affaire.traiteData?.primePrevisionnelle ?? 0);

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate('/affaires')}
          className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Retour aux affaires
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground font-mono">{affaire.numero}</h1>
            <p className="text-[13px] text-muted-foreground mt-1">
              {typeLabels[affaire.type]} · Créée le {formatDate(affaire.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1.5 text-[12px] rounded-full font-medium ${statutColors[affaire.statut]}`}>
              {statutLabels[affaire.statut]}
            </span>
            {affaire.statut !== AffaireStatut.PLACEMENT_REALISE && (
              <button
                onClick={() => setShowEditModal(true)}
                className="rounded-xl p-2 text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                title="Modifier"
              >
                <Edit2 size={18} />
              </button>
            )}
            {affaire.statut !== AffaireStatut.PLACEMENT_REALISE && (
              <button
                onClick={handleDelete}
                className="rounded-xl p-2 text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                title="Supprimer"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--chart-4)/0.3)] bg-[hsl(var(--chart-4)/0.15)]">
              <DollarSign size={20} className="text-[hsl(var(--chart-4))]" />
            </div>
            <div>
              <p className="text-[11px] uppercase font-medium text-muted-foreground">
                {affaire.type === AffaireType.FACULTATIVE ? 'Prime Cédée' : 'Prime Prévisionnelle'}
              </p>
              <p className="text-[20px] font-semibold text-foreground">{formatCurrency(primeAffichee, affaire.currency)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-success/25 bg-success/15">
              <TrendingUp size={20} className="text-success" />
            </div>
            <div>
              <p className="text-[11px] uppercase font-medium text-muted-foreground">Commission ARS (total)</p>
              <p className="text-[20px] font-semibold text-success">{formatCurrency(commissionArsTotal, affaire.currency)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--chart-5)/0.3)] bg-[hsl(var(--chart-5)/0.15)]">
              <Users size={20} className="text-[hsl(var(--chart-5))]" />
            </div>
            <div>
              <p className="text-[11px] uppercase font-medium text-muted-foreground">Réassureurs</p>
              <p className="text-[20px] font-semibold text-foreground">{affaire.reassureurs.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-warning/25 bg-warning/15">
              <AlertTriangle size={20} className="text-warning" />
            </div>
            <div>
              <p className="text-[11px] uppercase font-medium text-muted-foreground">Sinistres</p>
              <p className="text-[20px] font-semibold text-foreground">{affaire._count?.sinistres ?? affaire.sinistres?.length ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-6 py-4">
              <div className="flex gap-6">
                {['overview', 'financials', 'reinsurers', 'related'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-[13px] font-medium pb-2 border-b-2 transition-colors ${
                      activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
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
                    <h3 className="text-[14px] font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Building2 size={16} /> Parties Prenantes
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Cédante</p>
                        <p className="text-[13px] text-foreground">{affaire.cedante?.raisonSociale || '-'}</p>
                      </div>
                      {affaire.type === AffaireType.FACULTATIVE && (
                        <div>
                          <p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Assuré</p>
                          <p className="text-[13px] text-foreground">{affaire.facultativeData?.assure?.raisonSociale || '-'}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-foreground mb-4 flex items-center gap-2">
                      <FileText size={16} /> Informations Contractuelles
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Type</p>
                        <p className="text-[13px] text-foreground">{typeLabels[affaire.type]}</p>
                      </div>
                      {affaire.type === AffaireType.FACULTATIVE && affaire.facultativeData && (
                        <>
                          <div><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Type de réassurance</p><p className="text-[13px] text-foreground">{reassuranceTypeLabels[affaire.facultativeData.reassuranceType]}</p></div>
                          {affaire.facultativeData.numeroPoliceCedante && <div><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">N° Police</p><p className="text-[13px] text-foreground">{affaire.facultativeData.numeroPoliceCedante}</p></div>}
                          {affaire.facultativeData.branche && <div><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Branche</p><p className="text-[13px] text-foreground">{affaire.facultativeData.branche}</p></div>}
                          <div><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Période</p><p className="text-[13px] text-foreground">{formatDate(affaire.facultativeData.dateEffet)} → {formatDate(affaire.facultativeData.dateEcheance)}</p></div>
                          {affaire.facultativeData.modeRenouvellement && <div><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Renouvellement</p><p className="text-[13px] text-foreground">{modeRenouvellementLabels[affaire.facultativeData.modeRenouvellement]}</p></div>}
                        </>
                      )}
                      {affaire.type === AffaireType.TRAITE && affaire.traiteData && (
                        <>
                          {affaire.traiteData.referenceTraite && <div><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Référence</p><p className="text-[13px] text-foreground">{affaire.traiteData.referenceTraite}</p></div>}
                          <div><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Type de réassurance</p><p className="text-[13px] text-foreground">{reassuranceTypeLabels[affaire.traiteData.reassuranceType]}</p></div>
                          {affaire.traiteData.formeCouverture && <div><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Forme de couverture</p><p className="text-[13px] text-foreground">{formeCouvertureLabels[affaire.traiteData.formeCouverture]}</p></div>}
                          <div><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Périodicité</p><p className="text-[13px] text-foreground">{periodiciteLabels[affaire.traiteData.periodicite]}</p></div>
                          <div><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Période</p><p className="text-[13px] text-foreground">{formatDate(affaire.traiteData.dateEffet)} → {formatDate(affaire.traiteData.dateEcheance)}</p></div>
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
                        <h3 className="text-[14px] font-semibold text-foreground mb-4">Données de Base</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="rounded-xl border border-border bg-secondary/40 p-4"><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Prime 100%</p><p className="text-[15px] font-semibold text-foreground">{formatCurrency(Number(affaire.facultativeData.prime100Pct), affaire.currency)}</p></div>
                          <div className="rounded-xl border border-border bg-secondary/40 p-4"><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Taux Cession</p><p className="text-[15px] font-semibold text-foreground">{affaire.facultativeData.tauxCession}%</p></div>
                          <div className="rounded-xl border border-[hsl(var(--chart-4)/0.2)] bg-[hsl(var(--chart-4)/0.10)] p-4"><p className="text-[11px] uppercase font-medium text-[hsl(var(--chart-4))] mb-1">Prime Cédée</p><p className="text-[15px] font-semibold text-[hsl(var(--chart-4))]">{formatCurrency(Number(affaire.facultativeData.primeCedee ?? 0), affaire.currency)}</p></div>
                          <div className="rounded-xl border border-border bg-secondary/40 p-4"><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Commission Cédante</p><p className="text-[15px] font-semibold text-foreground">{formatCurrency(Number(affaire.facultativeData.commissionCedante ?? 0), affaire.currency)}</p></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border">
                        {/* FIX (Affaires pass): now passes the affaire's real
                            currency instead of leaving GuaranteeLinesManager
                            to hardcode 'TND' internally. */}
                        <GuaranteeLinesManager affaireId={affaire.id} currency={affaire.currency} />
                      </div>
                    </>
                  ) : affaire.traiteData ? (
                    <>
                      <div>
                        <h3 className="text-[14px] font-semibold text-foreground mb-4">Données de Base</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="rounded-xl border border-[hsl(var(--chart-4)/0.2)] bg-[hsl(var(--chart-4)/0.10)] p-4"><p className="text-[11px] uppercase font-medium text-[hsl(var(--chart-4))] mb-1">Prime Prévisionnelle</p><p className="text-[15px] font-semibold text-[hsl(var(--chart-4))]">{formatCurrency(Number(affaire.traiteData.primePrevisionnelle ?? 0), affaire.currency)}</p></div>
                          <div className="rounded-xl border border-border bg-secondary/40 p-4"><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">PMD</p><p className="text-[15px] font-semibold text-foreground">{formatCurrency(Number(affaire.traiteData.pmd ?? 0), affaire.currency)}</p></div>
                          <div className="rounded-xl border border-border bg-secondary/40 p-4"><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Commission Cédante</p><p className="text-[15px] font-semibold text-foreground">{affaire.traiteData.tauxCommissionCedante ?? 0}%</p></div>
                          <div className="rounded-xl border border-border bg-secondary/40 p-4"><p className="text-[11px] uppercase font-medium text-muted-foreground mb-1">Seuil Notification</p><p className="text-[15px] font-semibold text-foreground">{formatCurrency(Number(affaire.traiteData.seuilNotification ?? 0), affaire.currency)}</p></div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border">
                        <TreatyAccountRubriquesManager affaireId={affaire.id} />
                      </div>

                      <div className="pt-2 border-t border-border">
                        <PmdInstalmentsManager affaireId={affaire.id} />
                      </div>

                      <div className="pt-2 border-t border-border">
                        <TreatyParametersManager affaireId={affaire.id} currency={affaire.currency} />
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {activeTab === 'reinsurers' && (
                <div className="space-y-3">
                  {affaire.reassureurs.map((r) => (
                    <div key={r.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-[14px] font-medium text-foreground">{r.reassureur?.raisonSociale}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[12px] text-muted-foreground font-mono">{r.reassureur?.code}</span>
                            {r.isLeader && (
                              <span className="inline-block rounded-full border border-[hsl(var(--chart-4)/0.3)] bg-[hsl(var(--chart-4)/0.15)] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--chart-4))]">
                                Leader / Apériteur
                              </span>
                            )}
                            <span className="inline-block rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {r.commissionMode === 'CALCULABLE' ? `Calculable (${r.tauxCommissionArs ?? 0}%)` : 'Forfaitaire'}
                            </span>
                          </div>
                        </div>
                        <span className="inline-block rounded-full border border-[hsl(var(--chart-4)/0.3)] bg-[hsl(var(--chart-4)/0.15)] px-3 py-1 text-[13px] font-semibold text-[hsl(var(--chart-4))]">{Number(r.partPct).toFixed(4)}%</span>
                      </div>
                      <div className={`grid ${affaire.type === AffaireType.FACULTATIVE ? 'grid-cols-5' : 'grid-cols-4'} gap-4 text-[12px]`}>
                        <div><p className="text-muted-foreground mb-1">Prime Brute</p><p className="font-medium text-foreground">{formatCurrency(Number(r.primeBrute ?? 0), affaire.currency)}</p></div>
                        <div><p className="text-muted-foreground mb-1">Commission ARS</p><p className="font-medium text-success">{formatCurrency(Number(r.commissionArs ?? 0), affaire.currency)}</p></div>
                        {affaire.type === AffaireType.FACULTATIVE && (
                          <div><p className="text-muted-foreground mb-1">Commission Cédante</p><p className="font-medium text-foreground">{formatCurrency(Number(r.commissionCedante ?? 0), affaire.currency)}</p></div>
                        )}
                        {affaire.type === AffaireType.FACULTATIVE && (
                          <div><p className="text-muted-foreground mb-1">Prime Nette Cédante</p><p className="font-medium text-foreground">{formatCurrency(Number(r.primeNetteCedante ?? 0), affaire.currency)}</p></div>
                        )}
                        <div><p className="text-muted-foreground mb-1">Net Réassureur</p><p className="font-medium text-foreground">{formatCurrency(Number(r.primeNetteReassureur ?? 0), affaire.currency)}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'related' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-[13px] font-semibold text-foreground mb-2">Sinistres récents</h4>
                    {(affaire.sinistres?.length ?? 0) === 0 ? (
                      <p className="text-[13px] text-muted-foreground">Aucun sinistre.</p>
                    ) : (
                      <div className="space-y-2">
                        {affaire.sinistres!.map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                            <span className="text-[13px] font-mono text-foreground">{s.numero}</span>
                            <span className="text-[12px] text-muted-foreground">{s.statut}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-foreground mb-2">Bordereaux récents</h4>
                    {(affaire.bordereaux?.length ?? 0) === 0 ? (
                      <p className="text-[13px] text-muted-foreground">Aucun bordereau.</p>
                    ) : (
                      <div className="space-y-2">
                        {affaire.bordereaux!.map((b: any) => (
                          <div key={b.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                            <span className="text-[13px] font-mono text-foreground">{b.numero}</span>
                            <span className="text-[12px] text-muted-foreground">{b.type} · {b.statut}</span>
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
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="text-[14px] font-semibold text-foreground mb-4">Actions Workflow</h3>
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