import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, FileText, CheckCircle, Send, Archive, DollarSign, 
  Download, Clock, AlertCircle, Edit, Trash2, Mail, XCircle 
} from 'lucide-react';
import { bordereauxApi } from '../../api/bordereaux.api';
import type { Bordereau } from '../../types/bordereau.types';
import BordereauDocuments from './BordereauDocuments';
import BordereauPaymentModal from './BordereauPaymentModal';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

const STATUS_CONFIG = {
  brouillon: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800', icon: FileText },
  en_validation: { label: 'En Validation', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  valide: { label: 'Validé', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  envoye: { label: 'Envoyé', color: 'bg-blue-100 text-blue-800', icon: Send },
  comptabilise: { label: 'Comptabilisé', color: 'bg-purple-100 text-purple-800', icon: DollarSign },
  archive: { label: 'Archivé', color: 'bg-gray-100 text-gray-600', icon: Archive },
};

const TYPE_LABELS = {
  cession: 'Bordereau de Cession',
  reassureur: 'Bordereau Réassureur',
  sinistre: 'Bordereau Sinistre',
  situation: 'Bordereau de Situation',
};

export default function BordereauDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [paymentModal, setPaymentModal] = useState(false);
  const [sendModal, setSendModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [activeTab, setActiveTab] = useState('details');

  const { data, isLoading } = useQuery({
    queryKey: ['bordereau', id],
    queryFn: () => bordereauxApi.getOne(id!),
    enabled: !!id,
  });

  const { data: documents } = useQuery({
    queryKey: ['bordereau-documents', id],
    queryFn: () => bordereauxApi.getDocuments(id!),
    enabled: !!id,
  });

  const { data: docValidation } = useQuery({
    queryKey: ['bordereau-doc-validation', id],
    queryFn: () => bordereauxApi.validateDocuments(id!),
    enabled: !!id,
  });

  const submitMutation = useMutation({
    mutationFn: () => bordereauxApi.submitForValidation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau', id] });
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
    },
  });

  const validateMutation = useMutation({
    mutationFn: () => bordereauxApi.validate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau', id] });
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => bordereauxApi.reject(id!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau', id] });
      setRejectModal(false);
      setRejectReason('');
    },
  });

  const sendMutation = useMutation({
    mutationFn: (emails: string[]) => bordereauxApi.send(id!, emails),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau', id] });
      setSendModal(false);
      setRecipients('');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => bordereauxApi.archive(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bordereau', id] });
      queryClient.invalidateQueries({ queryKey: ['bordereaux'] });
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: async () => {
      const response = await bordereauxApi.generatePdf(id!);
      const blob = response.data as Blob;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bordereau_${bordereau?.numero || id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: () => bordereauxApi.sendReminder(id!),
    onSuccess: () => {
      alert('Rappel envoyé avec succès');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => bordereauxApi.delete(id!),
    onSuccess: () => {
      navigate('/bordereaux');
    },
  });

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!data?.data) {
    return (
      <div className="p-8">
        <Card className="p-12 text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h2 className="text-xl font-semibold mb-2">Bordereau non trouvé</h2>
          <Button onClick={() => navigate('/bordereaux')} className="mt-4">
            Retour à la liste
          </Button>
        </Card>
      </div>
    );
  }

  const bordereau = data.data as Bordereau;
  const StatusIcon = STATUS_CONFIG[bordereau.status].icon;
  const isOverdue = bordereau.dateLimitePaiement && 
    new Date(bordereau.dateLimitePaiement) < new Date() && 
    bordereau.status === 'envoye';

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/bordereaux')}
            className="gap-2"
          >
            <ArrowLeft size={20} />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{bordereau.numero}</h1>
            <p className="text-gray-600 mt-1">{TYPE_LABELS[bordereau.type]}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <StatusIcon size={20} />
            <Badge className={STATUS_CONFIG[bordereau.status].color}>
              {STATUS_CONFIG[bordereau.status].label}
            </Badge>
          </div>
          {isOverdue && (
            <Badge className="bg-red-100 text-red-800">
              <AlertCircle size={14} className="mr-1" />
              En Retard
            </Badge>
          )}
        </div>
      </div>

      {/* Alert for overdue */}
      {isOverdue && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-600" size={24} />
              <div>
                <p className="font-semibold text-red-900">Paiement en retard</p>
                <p className="text-sm text-red-700">
                  Date limite dépassée: {new Date(bordereau.dateLimitePaiement!).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => sendReminderMutation.mutate()}
              disabled={sendReminderMutation.isPending}
            >
              <Mail size={16} className="mr-2" />
              Envoyer Rappel
            </Button>
          </div>
        </Card>
      )}

      {/* Document Validation Alert */}
      {docValidation?.data && !docValidation.data.complete && (
        <Card className="p-4 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-yellow-600" size={24} />
            <div>
              <p className="font-semibold text-yellow-900">Documents manquants</p>
              <p className="text-sm text-yellow-700">
                {docValidation.data.missing.join(', ')}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Détails</TabsTrigger>
              <TabsTrigger value="lines">Lignes ({bordereau.lignes?.length || 0})</TabsTrigger>
              <TabsTrigger value="documents">Documents ({documents?.data?.length || 0})</TabsTrigger>
              <TabsTrigger value="history">Historique</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card className="p-6">
                <h3 className="font-semibold text-lg mb-4">Informations Générales</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Cédante</label>
                    <p className="font-medium">{bordereau.cedante?.raisonSociale || '-'}</p>
                  </div>
                  {bordereau.reassureur && (
                    <div>
                      <label className="text-sm text-gray-600">Réassureur</label>
                      <p className="font-medium">{bordereau.reassureur.raisonSociale}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-600">Date Début</label>
                    <p className="font-medium">{new Date(bordereau.dateDebut).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Date Fin</label>
                    <p className="font-medium">{new Date(bordereau.dateFin).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Date Émission</label>
                    <p className="font-medium">{new Date(bordereau.dateEmission).toLocaleDateString('fr-FR')}</p>
                  </div>
                  {bordereau.dateLimitePaiement && (
                    <div>
                      <label className="text-sm text-gray-600">Date Limite Paiement</label>
                      <p className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                        {new Date(bordereau.dateLimitePaiement).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-gray-600">Devise</label>
                    <p className="font-medium">{bordereau.devise}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Créé par</label>
                    <p className="font-medium">{bordereau.createdBy?.name || '-'}</p>
                  </div>
                </div>

                {/* Treaty Information (if applicable) */}
                {bordereau.type === 'reassureur' && bordereau.lignes?.[0]?.affaire?.category === 'traitee' && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-semibold mb-3">Informations Traité</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {bordereau.lignes[0].affaire.type && (
                        <div>
                          <label className="text-sm text-gray-600">Type de Traité</label>
                          <p className="font-medium uppercase">{bordereau.lignes[0].affaire.type}</p>
                        </div>
                      )}
                      {bordereau.lignes[0].partReassureur && (
                        <div>
                          <label className="text-sm text-gray-600">Part Réassureur</label>
                          <p className="font-medium">{bordereau.lignes[0].partReassureur}%</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {bordereau.notes && (
                  <div className="mt-4 pt-4 border-t">
                    <label className="text-sm text-gray-600">Notes</label>
                    <p className="mt-1 text-gray-900">{bordereau.notes}</p>
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="lines">
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant Brut</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Taux</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Montant Cédé</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Commission</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net à Payer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bordereau.lignes?.map((ligne) => (
                        <tr key={ligne.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{ligne.numLigne}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs uppercase">
                              {ligne.typeLigne || 'prime'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{ligne.description}</td>
                          <td className="px-4 py-3 text-sm text-right">{ligne.montantBrut.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right">
                            {ligne.tauxCession ? `${ligne.tauxCession}%` : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">{ligne.montantCede.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right">{ligne.commissionMontant.toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-right font-semibold">
                            {ligne.netAPayer.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <BordereauDocuments bordereauId={id!} />
            </TabsContent>

            <TabsContent value="history">
              <Card className="p-6">
                <div className="space-y-4">
                  {bordereau.historique?.map((entry, index) => (
                    <div key={index} className="flex gap-4 pb-4 border-b last:border-0">
                      <div className="text-sm text-gray-500 w-40">
                        {new Date(entry.date).toLocaleString('fr-FR')}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{entry.action}</p>
                        {entry.details && (
                          <p className="text-sm text-gray-600 mt-1">{entry.details}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">Par: {entry.user}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Résumé Financier</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Prime Totale</span>
                <span className="font-semibold">{bordereau.primeTotale.toLocaleString()} {bordereau.devise}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Commission Cédante</span>
                <span className="font-semibold">{bordereau.commissionCedante.toLocaleString()} {bordereau.devise}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Commission ARS</span>
                <span className="font-semibold">{bordereau.commissionARS.toLocaleString()} {bordereau.devise}</span>
              </div>
              {bordereau.sinistres > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Sinistres</span>
                  <span className="font-semibold text-red-600">{bordereau.sinistres.toLocaleString()} {bordereau.devise}</span>
                </div>
              )}
              {bordereau.acompteRecu > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Acompte Reçu</span>
                  <span className="font-semibold text-green-600">{bordereau.acompteRecu.toLocaleString()} {bordereau.devise}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t">
                <span className="font-bold">Solde</span>
                <span className="font-bold text-lg">{bordereau.solde.toLocaleString()} {bordereau.devise}</span>
              </div>
            </div>
          </Card>

          {/* Actions */}
          <Card className="p-6">
            <h3 className="font-semibold text-lg mb-4">Actions</h3>
            <div className="space-y-2">
              {bordereau.status === 'brouillon' && (
                <>
                  <Button
                    className="w-full gap-2"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                  >
                    <CheckCircle size={18} />
                    Soumettre à Validation
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => navigate(`/bordereaux/${id}/edit`)}
                  >
                    <Edit size={18} />
                    Modifier
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => {
                      if (confirm('Êtes-vous sûr de vouloir supprimer ce bordereau ?')) {
                        deleteMutation.mutate();
                      }
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={18} />
                    Supprimer
                  </Button>
                </>
              )}

              {bordereau.status === 'en_validation' && (
                <>
                  <Button
                    className="w-full gap-2"
                    onClick={() => validateMutation.mutate()}
                    disabled={validateMutation.isPending}
                  >
                    <CheckCircle size={18} />
                    Valider
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2 text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => setRejectModal(true)}
                  >
                    <XCircle size={18} />
                    Rejeter
                  </Button>
                </>
              )}

              {bordereau.status === 'valide' && (
                <Button
                  className="w-full gap-2"
                  onClick={() => setSendModal(true)}
                >
                  <Send size={18} />
                  Envoyer
                </Button>
              )}

              {bordereau.status === 'envoye' && (
                <Button
                  className="w-full gap-2"
                  onClick={() => setPaymentModal(true)}
                >
                  <DollarSign size={18} />
                  Enregistrer Paiement
                </Button>
              )}

              {bordereau.status === 'comptabilise' && (
                <Button
                  className="w-full gap-2"
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                >
                  <Archive size={18} />
                  Archiver
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => downloadPdfMutation.mutate()}
                disabled={downloadPdfMutation.isPending}
              >
                <Download size={18} />
                {downloadPdfMutation.isPending ? 'Génération...' : 'Télécharger PDF'}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Send Modal */}
      {sendModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Envoyer le Bordereau</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Destinataires (emails séparés par des virgules)
                </label>
                <textarea
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  rows={3}
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    const emails = recipients.split(',').map(e => e.trim()).filter(Boolean);
                    if (emails.length > 0) {
                      sendMutation.mutate(emails);
                    }
                  }}
                  disabled={sendMutation.isPending || !recipients.trim()}
                >
                  Envoyer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSendModal(false);
                    setRecipients('');
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Rejeter le Bordereau</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Raison du rejet</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full border rounded-lg p-2"
                  rows={3}
                  placeholder="Expliquez pourquoi ce bordereau est rejeté..."
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => rejectMutation.mutate(rejectReason)}
                  disabled={rejectMutation.isPending || !rejectReason.trim()}
                >
                  Rejeter
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setRejectModal(false);
                    setRejectReason('');
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModal && (
        <BordereauPaymentModal
          isOpen={paymentModal}
          onClose={() => setPaymentModal(false)}
          bordereau={bordereau}
        />
      )}
    </div>
  );
}
