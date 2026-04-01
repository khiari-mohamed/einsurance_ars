import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bell, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { sinistresApi } from '../../api/sinistres.api';
import {  SinistreStatus, PaymentStatus } from '../../types/sinistre.types';
import { formatCurrency } from '../../lib/currency';
import SinistreDocuments from './SinistreDocuments';
import SinistreSAP from './SinistreSAP';

const statusConfig = {
  [SinistreStatus.DECLARE]: { label: 'Déclaré', color: 'bg-blue-100 text-blue-800' },
  [SinistreStatus.EN_EXPERTISE]: { label: 'En Expertise', color: 'bg-purple-100 text-purple-800' },
  [SinistreStatus.EN_REGLEMENT]: { label: 'En Règlement', color: 'bg-yellow-100 text-yellow-800' },
  [SinistreStatus.PARTIEL]: { label: 'Partiel', color: 'bg-orange-100 text-orange-800' },
  [SinistreStatus.REGLE]: { label: 'Réglé', color: 'bg-green-100 text-green-800' },
  [SinistreStatus.CONTESTE]: { label: 'Contesté', color: 'bg-red-100 text-red-800' },
  [SinistreStatus.CLOS]: { label: 'Clos', color: 'bg-gray-100 text-gray-800' },
};

const paymentStatusConfig = {
  [PaymentStatus.EN_ATTENTE]: { label: 'En Attente', color: 'text-gray-600', icon: Clock },
  [PaymentStatus.PARTIEL]: { label: 'Partiel', color: 'text-orange-600', icon: AlertTriangle },
  [PaymentStatus.PAYE]: { label: 'Payé', color: 'text-green-600', icon: CheckCircle },
  [PaymentStatus.EN_RETARD]: { label: 'En Retard', color: 'text-red-600', icon: AlertTriangle },
};

export default function SinistreDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('fiche');

  const { data: sinistre, isLoading } = useQuery({
    queryKey: ['sinistre', id],
    queryFn: async () => {
      const { data } = await sinistresApi.getOne(id!);
      return data;
    },
    enabled: !!id,
  });

  const notifyMutation = useMutation({
    mutationFn: () => sinistresApi.notifyReinsurers(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!sinistre) return null;

  const canNotify = !sinistre.dateNotificationReassureurs && sinistre.cedantePaymentVerified;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/sinistres')} className="text-gray-600 hover:text-gray-800">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{sinistre.numero}</h1>
            <p className="text-gray-600">{sinistre.affaire?.numeroAffaire} - {sinistre.cedante?.nom}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusConfig[sinistre.statut].color}`}>
            {statusConfig[sinistre.statut].label}
          </span>
          {canNotify && (
            <button
              onClick={() => notifyMutation.mutate()}
              disabled={notifyMutation.isPending}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Bell size={18} />
              Notifier Réassureurs
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Montant Total</div>
          <div className="text-2xl font-bold">{formatCurrency(sinistre.montantTotal)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Part Réassurance</div>
          <div className="text-2xl font-bold text-blue-600">{formatCurrency(sinistre.montantReassurance)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">Montant Réglé</div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(sinistre.montantRegle)}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">SAP Actuel</div>
          <div className="text-2xl font-bold text-orange-600">{formatCurrency(sinistre.sapActuel)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="border-b">
          <div className="flex overflow-x-auto">
            {['fiche', 'participations', 'documents', 'sap', 'communication', 'audit', 'timeline'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 font-medium whitespace-nowrap ${
                  activeTab === tab
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab === 'fiche' && 'Fiche Sinistre'}
                {tab === 'participations' && 'Participations Réassureurs'}
                {tab === 'documents' && 'Documents'}
                {tab === 'sap' && 'SAP & Réserves'}
                {tab === 'communication' && 'Communication'}
                {tab === 'audit' && 'Audit Trail'}
                {tab === 'timeline' && 'Timeline'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'fiche' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Référence Cédante</label>
                  <div className="text-lg">{sinistre.referenceCedante}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Survenance</label>
                  <div className="text-lg">{new Date(sinistre.dateSurvenance).toLocaleDateString('fr-FR')}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Déclaration</label>
                  <div className="text-lg">{new Date(sinistre.dateDeclarationCedante).toLocaleDateString('fr-FR')}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Notification ARS</label>
                  <div className="text-lg">{new Date(sinistre.dateNotificationARS).toLocaleString('fr-FR')}</div>
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
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Réassureur</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Part %</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Montant Part</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Montant Payé</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sinistre.participations?.map((p) => {
                    const StatusIcon = paymentStatusConfig[p.statutPaiement].icon;
                    return (
                      <tr key={p.id}>
                        <td className="px-4 py-3 text-sm font-medium">{p.reassureur?.nom}</td>
                        <td className="px-4 py-3 text-sm">{p.partPourcentage}%</td>
                        <td className="px-4 py-3 text-sm font-semibold">{formatCurrency(p.montantPart)}</td>
                        <td className="px-4 py-3 text-sm">{formatCurrency(p.montantPaye)}</td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1 text-sm font-medium ${paymentStatusConfig[p.statutPaiement].color}`}>
                            <StatusIcon size={16} />
                            {paymentStatusConfig[p.statutPaiement].label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'documents' && (
            <SinistreDocuments sinistreId={sinistre.id} />
          )}

          {activeTab === 'sap' && (
            <SinistreSAP sinistre={sinistre} />
          )}

          {activeTab === 'communication' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Notifications Réassureurs</h3>
                {canNotify && (
                  <button
                    onClick={() => notifyMutation.mutate()}
                    disabled={notifyMutation.isPending}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Bell size={16} />
                    Envoyer Notification
                  </button>
                )}
              </div>
              
              {sinistre.participations?.map((p) => (
                <div key={p.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-lg">{p.reassureur?.nom}</h4>
                      <p className="text-sm text-gray-600">Part: {p.partPourcentage}% - {formatCurrency(p.montantPart)}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      p.statutPaiement === PaymentStatus.PAYE ? 'bg-green-100 text-green-800' :
                      p.statutPaiement === PaymentStatus.PARTIEL ? 'bg-orange-100 text-orange-800' :
                      p.statutPaiement === PaymentStatus.EN_RETARD ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {paymentStatusConfig[p.statutPaiement].label}
                    </span>
                  </div>
                  
                  {p.notifications && p.notifications.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Historique des notifications:</p>
                      {p.notifications.map((notif: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 text-sm bg-gray-50 p-2 rounded">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            notif.type === 'INITIAL' ? 'bg-blue-100 text-blue-700' :
                            notif.type === 'RAPPEL' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {notif.type}
                          </span>
                          <span className="text-gray-600">{new Date(notif.date).toLocaleString('fr-FR')}</span>
                          <span className="text-gray-500">via {notif.moyen}</span>
                          <span className={`ml-auto px-2 py-0.5 rounded text-xs ${
                            notif.statut === 'ENVOYE' ? 'bg-green-100 text-green-700' :
                            notif.statut === 'LU' ? 'bg-blue-100 text-blue-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {notif.statut}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Aucune notification envoyée</p>
                  )}
                </div>
              ))}
              
              {!sinistre.dateNotificationReassureurs && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="text-yellow-600 mt-0.5" size={20} />
                    <div>
                      <p className="font-medium text-yellow-800">Réassureurs non notifiés</p>
                      <p className="text-sm text-yellow-700 mt-1">
                        {!sinistre.cedantePaymentVerified 
                          ? 'Veuillez d\'abord vérifier le paiement de la cédante avant de notifier les réassureurs.'
                          : 'Les réassureurs doivent être notifiés dans les 24 heures suivant la notification ARS.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-4">Journal d'Audit</h3>
              <div className="space-y-3">
                <div className="border-l-4 border-blue-500 bg-blue-50 p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-blue-900">Création du sinistre</p>
                      <p className="text-sm text-blue-700 mt-1">Par: {sinistre.createdBy?.firstName} {sinistre.createdBy?.lastName}</p>
                    </div>
                    <span className="text-sm text-blue-600">{new Date(sinistre.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                </div>
                
                {sinistre.dateNotificationReassureurs && (
                  <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-green-900">Notification des réassureurs</p>
                        <p className="text-sm text-green-700 mt-1">Tous les réassureurs ont été notifiés</p>
                      </div>
                      <span className="text-sm text-green-600">{new Date(sinistre.dateNotificationReassureurs).toLocaleString('fr-FR')}</span>
                    </div>
                  </div>
                )}
                
                {sinistre.dateDerniereRevisionSAP && (
                  <div className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-orange-900">Révision SAP</p>
                        <p className="text-sm text-orange-700 mt-1">Réserve ajustée: {formatCurrency(sinistre.sapActuel)}</p>
                      </div>
                      <span className="text-sm text-orange-600">{new Date(sinistre.dateDerniereRevisionSAP).toLocaleString('fr-FR')}</span>
                    </div>
                  </div>
                )}
                
                {sinistre.statut === SinistreStatus.REGLE && (
                  <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-green-900">Sinistre réglé</p>
                        <p className="text-sm text-green-700 mt-1">Montant total réglé: {formatCurrency(sinistre.montantRegle)}</p>
                      </div>
                      {sinistre.dateReglement && (
                        <span className="text-sm text-green-600">{new Date(sinistre.dateReglement).toLocaleString('fr-FR')}</span>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="border-l-4 border-gray-300 bg-gray-50 p-4 rounded">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">Dernière modification</p>
                      <p className="text-sm text-gray-700 mt-1">Statut actuel: {statusConfig[sinistre.statut].label}</p>
                    </div>
                    <span className="text-sm text-gray-600">{new Date(sinistre.updatedAt).toLocaleString('fr-FR')}</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> L'audit trail complet avec tous les changements de champs est disponible dans le système de logs backend.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <div className="w-0.5 h-full bg-gray-300"></div>
                </div>
                <div className="pb-8">
                  <div className="font-medium">Survenance</div>
                  <div className="text-sm text-gray-600">{new Date(sinistre.dateSurvenance).toLocaleString('fr-FR')}</div>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
                  <div className="w-0.5 h-full bg-gray-300"></div>
                </div>
                <div className="pb-8">
                  <div className="font-medium">Notification ARS</div>
                  <div className="text-sm text-gray-600">{new Date(sinistre.dateNotificationARS).toLocaleString('fr-FR')}</div>
                </div>
              </div>
              {sinistre.dateNotificationReassureurs && (
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 bg-green-600 rounded-full"></div>
                    <div className="w-0.5 h-full bg-gray-300"></div>
                  </div>
                  <div className="pb-8">
                    <div className="font-medium">Réassureurs Notifiés</div>
                    <div className="text-sm text-gray-600">{new Date(sinistre.dateNotificationReassureurs).toLocaleString('fr-FR')}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
