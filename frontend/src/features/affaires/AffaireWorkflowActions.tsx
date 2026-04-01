import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, FileCheck, FileText, Calculator, CheckCircle } from 'lucide-react';
import { affairesApi } from '../../api/affaires.api';
import { Affaire, AffaireStatus } from '../../types/affaire.types';

interface Props {
  affaire: Affaire;
}

export default function AffaireWorkflowActions({ affaire }: Props) {
  const queryClient = useQueryClient();
  const [showSlipModal, setShowSlipModal] = useState(false);
  const [slipReference, setSlipReference] = useState('');
  const [selectedReinsurers, setSelectedReinsurers] = useState<string[]>([]);

  const sendToCotationMutation = useMutation({
    mutationFn: () => affairesApi.sendToCotation(affaire.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affaire', affaire.id] });
      queryClient.invalidateQueries({ queryKey: ['affaires'] });
      alert('✅ Affaire envoyée en cotation avec succès');
    },
    onError: (error: any) => {
      alert('❌ ' + (error.response?.data?.message || 'Erreur lors de l\'envoi'));
    },
  });

  const receiveSlipMutation = useMutation({
    mutationFn: (data: { slipReference: string; signedReinsurers: string[] }) =>
      affairesApi.receiveSlip(affaire.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affaire', affaire.id] });
      setShowSlipModal(false);
      setSlipReference('');
      setSelectedReinsurers([]);
      alert('✅ Slip de couverture enregistré avec succès');
    },
    onError: (error: any) => {
      alert('❌ ' + (error.response?.data?.message || 'Erreur lors de l\'enregistrement'));
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: AffaireStatus) => affairesApi.updateStatus(affaire.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affaire', affaire.id] });
      queryClient.invalidateQueries({ queryKey: ['affaires'] });
      alert('✅ Statut mis à jour avec succès');
    },
    onError: (error: any) => {
      alert('❌ ' + (error.response?.data?.message || 'Erreur lors de la mise à jour'));
    },
  });

  const generateBordereauMutation = useMutation({
    mutationFn: () => affairesApi.generateBordereauCedante(affaire.id),
    onSuccess: (data) => {
      alert('✅ Bordereau généré avec succès: ' + data.data.reference);
      queryClient.invalidateQueries({ queryKey: ['affaire', affaire.id] });
    },
    onError: (error: any) => {
      alert('❌ ' + (error.response?.data?.message || 'Erreur lors de la génération'));
    },
  });

  const generateAccountingMutation = useMutation({
    mutationFn: () => affairesApi.generateAccountingEntries(affaire.id),
    onSuccess: (data) => {
      alert(`✅ ${data.data.length} écritures comptables générées`);
    },
    onError: (error: any) => {
      alert('❌ ' + (error.response?.data?.message || 'Erreur lors de la génération'));
    },
  });

  const canSendToCotation = affaire.status === AffaireStatus.DRAFT && affaire.reinsurers.length > 0;
  const canReceiveSlip = affaire.status === AffaireStatus.PLACEMENT_REALISE;
  const canActivate = affaire.status === AffaireStatus.PLACEMENT_REALISE && affaire.slipReceived;
  const canGenerateBordereau = affaire.status === AffaireStatus.ACTIVE;

  return (
    <div className="space-y-3">
      {canSendToCotation && (
        <button
          onClick={() => {
            if (window.confirm('Envoyer cette affaire en cotation ? Les réassureurs seront notifiés.')) {
              sendToCotationMutation.mutate();
            }
          }}
          disabled={sendToCotationMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[13px] font-medium disabled:opacity-50"
        >
          <Send size={16} />
          {sendToCotationMutation.isPending ? 'Envoi...' : 'Envoyer en Cotation'}
        </button>
      )}

      {affaire.status === AffaireStatus.COTATION && (
        <button
          onClick={() => updateStatusMutation.mutate(AffaireStatus.PREVISION)}
          disabled={updateStatusMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-[13px] font-medium disabled:opacity-50"
        >
          <CheckCircle size={16} />
          Passer en Prévision
        </button>
      )}

      {affaire.status === AffaireStatus.PREVISION && (
        <button
          onClick={() => updateStatusMutation.mutate(AffaireStatus.PLACEMENT_REALISE)}
          disabled={updateStatusMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-[13px] font-medium disabled:opacity-50"
        >
          <CheckCircle size={16} />
          Placement Réalisé
        </button>
      )}

      {canReceiveSlip && (
        <button
          onClick={() => setShowSlipModal(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-[13px] font-medium"
        >
          <FileCheck size={16} />
          Recevoir Slip de Couverture
        </button>
      )}

      {canActivate && (
        <button
          onClick={() => updateStatusMutation.mutate(AffaireStatus.ACTIVE)}
          disabled={updateStatusMutation.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-[13px] font-medium disabled:opacity-50"
        >
          <CheckCircle size={16} />
          Activer l'Affaire
        </button>
      )}

      {canGenerateBordereau && (
        <>
          <button
            onClick={() => generateBordereauMutation.mutate()}
            disabled={generateBordereauMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-[13px] font-medium disabled:opacity-50"
          >
            <FileText size={16} />
            {generateBordereauMutation.isPending ? 'Génération...' : 'Générer Bordereau Cédante'}
          </button>

          <button
            onClick={() => generateAccountingMutation.mutate()}
            disabled={generateAccountingMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-[13px] font-medium disabled:opacity-50"
          >
            <Calculator size={16} />
            {generateAccountingMutation.isPending ? 'Génération...' : 'Générer Écritures Comptables'}
          </button>
        </>
      )}

      {showSlipModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-[16px] font-semibold text-gray-900">Recevoir Slip de Couverture</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Référence du Slip *</label>
                <input
                  type="text"
                  value={slipReference}
                  onChange={(e) => setSlipReference(e.target.value)}
                  placeholder="SLIP-2024-001"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[12px] font-medium text-gray-700 mb-2">Réassureurs Signataires</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {affaire.reinsurers.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedReinsurers.includes(r.reassureurId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedReinsurers([...selectedReinsurers, r.reassureurId]);
                          } else {
                            setSelectedReinsurers(selectedReinsurers.filter(id => id !== r.reassureurId));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-[13px] text-gray-900">{r.reassureur.raisonSociale}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={() => {
                  setShowSlipModal(false);
                  setSlipReference('');
                  setSelectedReinsurers([]);
                }}
                className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={() => receiveSlipMutation.mutate({ slipReference, signedReinsurers: selectedReinsurers })}
                disabled={!slipReference || receiveSlipMutation.isPending}
                className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {receiveSlipMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
