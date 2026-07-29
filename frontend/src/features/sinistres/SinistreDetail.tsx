import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Send, CheckCircle, XCircle, ShieldCheck, Undo2, Lock,
  Clock, AlertCircle, FileText,
} from 'lucide-react';
import { sinistresApi } from '../../api/sinistres.api';
import { useAuthStore } from '../../lib/store';
import { formatCurrency } from '../../lib/currency';
import { STATUT_LABELS, STATUT_COLORS } from '../../types/sinistre.types';
import type { SinistreStatut } from '../../types/sinistre.types';
import SinistreDocuments from './SinistreDocuments';
import SinistreSAP from './SinistreSAP';
import CashCallManager from './CashCallManager';
import SinistreCommunication from './SinistreCommunication';

const STATUT_ICON: Record<SinistreStatut, any> = {
  DECLARE: AlertCircle,
  EN_COURS_VALIDATION: Clock,
  VALIDE: CheckCircle,
  REJETE: XCircle,
  DECLARE_REASSUREURS: ShieldCheck,
  EN_RECUPERATION: Clock,
  RECUPERE: Undo2,
  CLOS: Lock,
};

export default function SinistreDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [activeTab, setActiveTab] = useState<'fiche' | 'participations' | 'sap' | 'cashcall' | 'communication' | 'documents' | 'timeline'>('fiche');
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sinistre', id],
    queryFn: () => sinistresApi.getOne(id!),
    enabled: !!id,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sinistre', id] });

  const submitMutation = useMutation({ mutationFn: () => sinistresApi.submitValidation(id!), onSuccess: invalidate });
  const approveMutation = useMutation({ mutationFn: () => sinistresApi.approve(id!), onSuccess: invalidate });
  const rejectMutation = useMutation({
    mutationFn: () => sinistresApi.reject(id!, rejectNote),
    onSuccess: () => { invalidate(); setShowRejectForm(false); setRejectNote(''); },
  });
  const declareMutation = useMutation({ mutationFn: () => sinistresApi.declareToReassureurs(id!), onSuccess: invalidate });
  const recoveryMutation = useMutation({ mutationFn: () => sinistresApi.markRecovery(id!), onSuccess: invalidate });
  const closeMutation = useMutation({ mutationFn: () => sinistresApi.close(id!), onSuccess: invalidate });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const sinistre = data?.data;
  if (!sinistre) return null;

  const StatusIcon = STATUT_ICON[sinistre.statut];

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: 'fiche', label: 'Fiche Sinistre' },
    { key: 'participations', label: 'Participations Réassureurs' },
    { key: 'sap', label: 'SAP & Réserves' },
    { key: 'cashcall', label: 'Cash Call' },
    { key: 'communication', label: 'Communication' },
    { key: 'documents', label: 'Documents' },
    { key: 'timeline', label: 'Timeline' },
  ];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sinistres')} className="text-gray-600 hover:text-gray-800">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{sinistre.numero}</h1>
            <p className="text-gray-600">{sinistre.affaire?.numero} — {sinistre.affaire?.cedante?.raisonSociale}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium ${STATUT_COLORS[sinistre.statut]}`}>
          <StatusIcon size={16} />
          {STATUT_LABELS[sinistre.statut]}
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Réserves</div>
          <div className="text-2xl font-bold">{formatCurrency(sinistre.reserves ?? 0)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Part Réassureurs</div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(sinistre.partReassureurs ?? 0)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Règlement Exercice N</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(sinistre.reglementExerciceN ?? 0)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">SAP Actuel</div>
          <div className="text-2xl font-bold text-orange-600">{formatCurrency(sinistre.sap ?? 0)}</div>
        </div>
      </div>

      {sinistre.appelAuComptant && !sinistre.cashCall && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="text-yellow-600 shrink-0" size={20} />
          <p className="text-sm text-yellow-800">
            Appel au comptant anticipé — aucun cash call n'a encore été déclenché. Voir l'onglet Cash Call.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 bg-white rounded-lg shadow">
          <div className="border-b">
            <div className="flex overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-6 py-3 font-medium whitespace-nowrap ${
                    activeTab === t.key ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'fiche' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">N° Police Cédante</label>
                    <div className="text-lg">{sinistre.numerPolice || '—'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Période de Couverture</label>
                    <div className="text-lg">{sinistre.periodeCouverture || '—'}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Survenance</label>
                    <div className="text-lg">{new Date(sinistre.dateSurvenance).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date Déclaration</label>
                    <div className="text-lg">{new Date(sinistre.dateDeclaration).toLocaleString('fr-FR')}</div>
                  </div>
                  {sinistre.cause && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cause</label>
                      <div className="text-lg">{sinistre.cause}</div>
                    </div>
                  )}
                  {sinistre.lieu && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lieu</label>
                      <div className="text-lg">{sinistre.lieu}</div>
                    </div>
                  )}
                  {sinistre.cumulReglementAnterieurs != null && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cumul Règlements Antérieurs</label>
                      <div className="text-lg">{formatCurrency(sinistre.cumulReglementAnterieurs)}</div>
                    </div>
                  )}
                  {sinistre.recoveryMethod && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Méthode de Récupération</label>
                      <div className="text-lg">{sinistre.recoveryMethod === 'ENCAISSEMENT_DIRECT' ? 'Encaissement Direct' : 'Compensation'}</div>
                    </div>
                  )}
                </div>
                {sinistre.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <div className="text-gray-800 bg-gray-50 p-4 rounded">{sinistre.description}</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'participations' && (
              <div>
                {(sinistre.participations?.length ?? 0) === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
                    Aucune participation — le sinistre doit être validé puis déclaré aux réassureurs pour générer la répartition.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Réassureur</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Part %</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Montant Part</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Notifié</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {sinistre.participations?.map((p) => (
                        <tr key={p.id}>
                          <td className="px-4 py-3 text-sm font-medium">{p.reassureurCode}</td>
                          <td className="px-4 py-3 text-sm">{p.partPct}%</td>
                          <td className="px-4 py-3 text-sm font-semibold">{p.montantPart != null ? formatCurrency(p.montantPart) : '—'}</td>
                          <td className="px-4 py-3 text-sm">
                            {p.isNotified ? (
                              <span className="text-green-700">Oui — {p.notifiedAt ? new Date(p.notifiedAt).toLocaleDateString('fr-FR') : ''}</span>
                            ) : (
                              <span className="text-gray-500">Non</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab === 'sap' && <SinistreSAP sinistre={sinistre} />}
            {activeTab === 'cashcall' && <CashCallManager sinistreId={sinistre.id} cashCall={sinistre.cashCall} />}
            {activeTab === 'communication' && <SinistreCommunication sinistre={sinistre} />}
            {activeTab === 'documents' && <SinistreDocuments sinistreId={sinistre.id} />}

            {activeTab === 'timeline' && (
              <div className="space-y-3">
                {(sinistre.events?.length ?? 0) === 0 ? (
                  <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">Aucun événement</div>
                ) : (
                  sinistre.events?.map((e) => (
                    <div key={e.id} className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-blue-900">{e.action}</p>
                          <p className="text-sm text-blue-700 mt-1">{e.actorLabel}{e.note && ` — ${e.note}`}</p>
                        </div>
                        <span className="text-sm text-blue-600 whitespace-nowrap ml-4">
                          {new Date(e.date).toLocaleString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Workflow action sidebar — gated on both the sinistre's real
            SinistreStatut state machine AND the viewing user's real
            role-derived permission, same pattern as Bordereaux. */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold text-lg mb-4">Actions</h3>
            <div className="space-y-2">
              {sinistre.statut === 'DECLARE' && hasPermission('sinistres:update') && (
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Send size={16} /> Soumettre à Validation
                </button>
              )}

              {sinistre.statut === 'EN_COURS_VALIDATION' && hasPermission('sinistres:validate') && !showRejectForm && (
                <>
                  <button
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle size={16} /> Valider
                  </button>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="w-full flex items-center justify-center gap-2 border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50"
                  >
                    <XCircle size={16} /> Rejeter
                  </button>
                </>
              )}

              {sinistre.statut === 'EN_COURS_VALIDATION' && hasPermission('sinistres:validate') && showRejectForm && (
                <div className="space-y-2 border rounded-lg p-3">
                  <textarea
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Motif du rejet (obligatoire)"
                    rows={3}
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => rejectMutation.mutate()}
                      disabled={!rejectNote.trim() || rejectMutation.isPending}
                      className="flex-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => { setShowRejectForm(false); setRejectNote(''); }}
                      className="flex-1 border px-3 py-1.5 rounded text-sm hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}

              {sinistre.statut === 'VALIDE' && hasPermission('sinistres:update') && (
                <button
                  onClick={() => declareMutation.mutate()}
                  disabled={declareMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <ShieldCheck size={16} /> Déclarer aux Réassureurs
                </button>
              )}

              {sinistre.statut === 'DECLARE_REASSUREURS' && hasPermission('sinistres:update') && (
                <button
                  onClick={() => recoveryMutation.mutate()}
                  disabled={recoveryMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  <Undo2 size={16} /> Mettre en Récupération
                </button>
              )}

              {(sinistre.statut === 'EN_RECUPERATION' || sinistre.statut === 'RECUPERE' || sinistre.statut === 'DECLARE_REASSUREURS') && hasPermission('sinistres:close') && (
                <button
                  onClick={() => { if (confirm('Clôturer ce sinistre ?')) closeMutation.mutate(); }}
                  disabled={closeMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                >
                  <Lock size={16} /> Clôturer le Dossier
                </button>
              )}

              {(sinistre.statut === 'CLOS' || sinistre.statut === 'REJETE') && (
                <p className="text-sm text-gray-500 text-center py-2">Dossier {sinistre.statut === 'CLOS' ? 'clos' : 'rejeté'} — lecture seule.</p>
              )}
            </div>
          </div>

          {sinistre.auditRecords && sinistre.auditRecords.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-sm mb-3 text-gray-600 flex items-center gap-2">
                <FileText size={14} /> Derniers Audits
              </h3>
              <div className="space-y-2 text-xs text-gray-600">
                {sinistre.auditRecords.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex justify-between">
                    <span>{a.action}</span>
                    <span>{new Date(a.createdAt).toLocaleDateString('fr-FR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}