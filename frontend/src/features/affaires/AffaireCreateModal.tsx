import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import { affairesApi } from '../../api/affaires.api';
import { CreateAffaireData, AffaireCategory, AffaireType, PaymentMode, CommissionCalculMode, CreateAffaireReinsurer, TreatyType, PeriodiciteComptes } from '../../types/affaire.types';

interface Props {
  onClose: () => void;
}

export default function AffaireCreateModal({ onClose }: Props) {
  const [step, setStep] = useState(1);
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateAffaireData>({
    category: AffaireCategory.FACULTATIVE,
    type: AffaireType.PROPORTIONNEL,
    assureId: '',
    cedanteId: '',
    dateEffet: '',
    dateEcheance: '',
    devise: 'TND',
    capitalAssure100: 0,
    prime100: 0,
    tauxCession: 0,
    tauxCommissionCedante: 0,
    modeCalculCommissionCedante: CommissionCalculMode.AUTO,
    tauxCommissionARS: 0,
    modeCalculCommissionARS: CommissionCalculMode.AUTO,
    paymentMode: PaymentMode.INCLUS_SITUATION,
    reinsurers: [],
  });

  const { data: assures = [] } = useQuery({
    queryKey: ['assures'],
    queryFn: async () => {
      const { data } = await api.get('/assures');
      return data;
    },
  });

  const { data: cedantes = [] } = useQuery({
    queryKey: ['cedantes'],
    queryFn: async () => {
      const { data } = await api.get('/cedantes');
      return data;
    },
  });

  const { data: reassureurs = [] } = useQuery({
    queryKey: ['reassureurs'],
    queryFn: async () => {
      const { data } = await api.get('/reassureurs');
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: (data: CreateAffaireData) => affairesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affaires'] });
      queryClient.invalidateQueries({ queryKey: ['affaires-stats'] });
      onClose();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erreur lors de la création';
      setErrors([message]);
    },
  });

  const primeCedee = formData.category === AffaireCategory.TRAITEE 
    ? (formData.primePrevisionnelle || 0)
    : (formData.prime100 * formData.tauxCession) / 100;
  
  const commissionCedante = formData.modeCalculCommissionCedante === CommissionCalculMode.MANUEL
    ? (formData.montantCommissionCedante || 0)
    : (primeCedee * (formData.tauxCommissionCedante || 0)) / 100;
  
  const commissionARS = formData.modeCalculCommissionARS === CommissionCalculMode.MANUEL
    ? (formData.montantCommissionARS || 0)
    : (primeCedee * (formData.tauxCommissionARS || 0)) / 100;

  const totalReinsurerShare = formData.reinsurers.reduce((sum, r) => sum + r.share, 0);

  const [errors, setErrors] = useState<string[]>([]);

  const validateForm = (): boolean => {
    const errs: string[] = [];
    
    if (totalReinsurerShare !== 100) {
      errs.push('La somme des parts des réassureurs doit être égale à 100%');
    }
    
    if (commissionARS > commissionCedante) {
      errs.push('Commission ARS ne peut pas dépasser la commission cédante');
    }
    
    if (commissionARS > primeCedee) {
      errs.push('Commission ARS ne peut pas dépasser la prime cédée');
    }
    
    if (new Date(formData.dateEffet) >= new Date(formData.dateEcheance)) {
      errs.push('Date effet doit être avant date échéance');
    }
    
    if (formData.category === AffaireCategory.TRAITEE) {
      if (!formData.treatyType) errs.push('Type de traité requis pour les affaires traitées');
      if (!formData.periodiciteComptes) errs.push('Périodicité des comptes requise');
      if (!formData.primePrevisionnelle || formData.primePrevisionnelle <= 0) {
        errs.push('Prime prévisionnelle requise pour les affaires traitées');
      }
      if (formData.pmd && formData.primePrevisionnelle && formData.primePrevisionnelle < formData.pmd) {
        errs.push('Prime prévisionnelle doit être ≥ PMD');
      }
    }
    
    if (formData.reinsurers.length === 0) {
      errs.push('Au moins un réassureur est requis');
    }
    
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    mutation.mutate(formData);
  };

  const addReinsurer = () => {
    setFormData({
      ...formData,
      reinsurers: [...formData.reinsurers, { reassureurId: '', share: 0, role: 'FOLLOWER' }],
    });
  };

  const updateReinsurer = (index: number, field: keyof CreateAffaireReinsurer, value: any) => {
    const updated = [...formData.reinsurers];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, reinsurers: updated });
  };

  const removeReinsurer = (index: number) => {
    setFormData({
      ...formData,
      reinsurers: formData.reinsurers.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-[18px] font-semibold text-gray-900">Nouvelle Affaire</h2>
            <p className="text-[12px] text-gray-500 mt-1">Étape {step} sur 3</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Informations Générales</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Catégorie *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as AffaireCategory })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={AffaireCategory.FACULTATIVE}>Facultative</option>
                    <option value={AffaireCategory.TRAITEE}>Traitée</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as AffaireType })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={AffaireType.PROPORTIONNEL}>Proportionnel</option>
                    <option value={AffaireType.NON_PROPORTIONNEL}>Non Proportionnel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Assuré *</label>
                  <select
                    value={formData.assureId}
                    onChange={(e) => setFormData({ ...formData, assureId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner un assuré</option>
                    {assures.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.raisonSociale}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Cédante *</label>
                  <select
                    value={formData.cedanteId}
                    onChange={(e) => setFormData({ ...formData, cedanteId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner une cédante</option>
                    {cedantes.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.raisonSociale}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">N° Police</label>
                  <input
                    type="text"
                    value={formData.numeroPolice || ''}
                    onChange={(e) => setFormData({ ...formData, numeroPolice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Branche</label>
                  <input
                    type="text"
                    value={formData.branche || ''}
                    onChange={(e) => setFormData({ ...formData, branche: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Effet *</label>
                  <input
                    type="date"
                    value={formData.dateEffet}
                    onChange={(e) => setFormData({ ...formData, dateEffet: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Échéance *</label>
                  <input
                    type="date"
                    value={formData.dateEcheance}
                    onChange={(e) => setFormData({ ...formData, dateEcheance: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Devise</label>
                  <select
                    value={formData.devise}
                    onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="TND">TND</option>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Garantie</label>
                  <input
                    type="text"
                    value={formData.garantie || ''}
                    onChange={(e) => setFormData({ ...formData, garantie: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mode Paiement</label>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value as PaymentMode })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={PaymentMode.INCLUS_SITUATION}>Inclus Situation</option>
                    <option value={PaymentMode.PAYE_HORS_SITUATION}>Payé Hors Situation</option>
                  </select>
                </div>
              </div>

              {formData.category === AffaireCategory.TRAITEE && (
                <div className="mt-6 p-4 bg-purple-50 rounded-lg space-y-4">
                  <h4 className="text-[13px] font-semibold text-purple-900">Paramètres Traité</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Type de Traité *</label>
                      <select
                        value={formData.treatyType || ''}
                        onChange={(e) => setFormData({ ...formData, treatyType: e.target.value as TreatyType })}
                        required={formData.category === AffaireCategory.TRAITEE}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sélectionner</option>
                        <option value={TreatyType.QP}>Quote-Part (QP)</option>
                        <option value={TreatyType.XOL}>Excédent de Perte (XOL)</option>
                        <option value={TreatyType.SURPLUS}>Surplus</option>
                        <option value={TreatyType.STOP_LOSS}>Stop Loss</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Périodicité Comptes *</label>
                      <select
                        value={formData.periodiciteComptes || ''}
                        onChange={(e) => setFormData({ ...formData, periodiciteComptes: e.target.value as PeriodiciteComptes })}
                        required={formData.category === AffaireCategory.TRAITEE}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sélectionner</option>
                        <option value={PeriodiciteComptes.TRIMESTRIEL}>Trimestriel</option>
                        <option value={PeriodiciteComptes.SEMESTRIEL}>Semestriel</option>
                        <option value={PeriodiciteComptes.ANNUEL}>Annuel</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Données Financières</h3>
              
              {formData.category === AffaireCategory.TRAITEE ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime Prévisionnelle *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.primePrevisionnelle || 0}
                      onChange={(e) => setFormData({ ...formData, primePrevisionnelle: parseFloat(e.target.value) || 0 })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">PMD (Prime Minimum Déposée)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.pmd || 0}
                      onChange={(e) => setFormData({ ...formData, pmd: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Capital Assuré 100% *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.capitalAssure100}
                      onChange={(e) => setFormData({ ...formData, capitalAssure100: parseFloat(e.target.value) || 0 })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime 100% *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.prime100}
                      onChange={(e) => setFormData({ ...formData, prime100: parseFloat(e.target.value) || 0 })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Cession (%) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.tauxCession}
                      onChange={(e) => setFormData({ ...formData, tauxCession: parseFloat(e.target.value) || 0 })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime Cédée (calculée)</label>
                    <input
                      type="text"
                      value={primeCedee.toFixed(2)}
                      disabled
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] bg-gray-50 text-gray-700"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-4">

                <div className="col-span-2">
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mode Calcul Commission Cédante</label>
                  <select
                    value={formData.modeCalculCommissionCedante}
                    onChange={(e) => setFormData({ ...formData, modeCalculCommissionCedante: e.target.value as CommissionCalculMode })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={CommissionCalculMode.AUTO}>Automatique</option>
                    <option value={CommissionCalculMode.MANUEL}>Manuel</option>
                  </select>
                </div>

                {formData.modeCalculCommissionCedante === CommissionCalculMode.AUTO ? (
                  <>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Commission Cédante (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.tauxCommissionCedante}
                        onChange={(e) => setFormData({ ...formData, tauxCommissionCedante: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Montant (calculé)</label>
                      <input
                        type="text"
                        value={commissionCedante.toFixed(2)}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] bg-gray-50 text-gray-700"
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Montant Commission Cédante</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.montantCommissionCedante || 0}
                      onChange={(e) => setFormData({ ...formData, montantCommissionCedante: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}

                <div className="col-span-2">
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mode Calcul Commission ARS</label>
                  <select
                    value={formData.modeCalculCommissionARS}
                    onChange={(e) => setFormData({ ...formData, modeCalculCommissionARS: e.target.value as CommissionCalculMode })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={CommissionCalculMode.AUTO}>Automatique</option>
                    <option value={CommissionCalculMode.MANUEL}>Manuel</option>
                  </select>
                </div>

                {formData.modeCalculCommissionARS === CommissionCalculMode.AUTO ? (
                  <>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Commission ARS (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.tauxCommissionARS}
                        onChange={(e) => setFormData({ ...formData, tauxCommissionARS: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Montant (calculé)</label>
                      <input
                        type="text"
                        value={commissionARS.toFixed(2)}
                        disabled
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] bg-green-50 text-green-700 font-medium"
                      />
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Montant Commission ARS</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.montantCommissionARS || 0}
                      onChange={(e) => setFormData({ ...formData, montantCommissionARS: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                )}
              </div>

              {commissionARS > commissionCedante && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Commission ARS ne peut pas dépasser commission cédante
                </div>
              )}
              {commissionARS > primeCedee && (
                <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700 flex items-center gap-1">
                  <AlertCircle size={12} />
                  Commission ARS ne peut pas dépasser prime cédée
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-gray-900">Réassureurs</h3>
                <button
                  type="button"
                  onClick={addReinsurer}
                  className="text-[13px] text-blue-600 hover:text-blue-700 font-medium"
                >
                  + Ajouter un réassureur
                </button>
              </div>

              {formData.reinsurers.map((reinsurer, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-gray-700">Réassureur {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeReinsurer(index)}
                      className="text-[12px] text-red-600 hover:text-red-700"
                    >
                      Supprimer
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <select
                        value={reinsurer.reassureurId}
                        onChange={(e) => updateReinsurer(index, 'reassureurId', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sélectionner</option>
                        {reassureurs.map((r: any) => (
                          <option key={r.id} value={r.id}>{r.raisonSociale}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        placeholder="Part %"
                        value={reinsurer.share}
                        onChange={(e) => updateReinsurer(index, 'share', parseFloat(e.target.value) || 0)}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className={`p-3 rounded-lg ${totalReinsurerShare === 100 ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <p className={`text-[13px] font-medium ${totalReinsurerShare === 100 ? 'text-green-700' : 'text-yellow-700'}`}>
                  Total des parts: {totalReinsurerShare.toFixed(2)}% {totalReinsurerShare === 100 ? '✓' : '(doit être 100%)'}
                </p>
              </div>

              {errors.length > 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-600 mt-0.5" />
                    <div>
                      <p className="text-[13px] font-medium text-red-900 mb-1">Erreurs de validation:</p>
                      <ul className="text-[12px] text-red-700 space-y-1">
                        {errors.map((err, i) => <li key={i}>• {err}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        <div className="flex items-center justify-between p-6 border-t border-gray-100">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={16} />
            {step > 1 ? 'Précédent' : 'Annuler'}
          </button>
          
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && (!formData.assureId || !formData.cedanteId || !formData.dateEffet || !formData.dateEcheance)}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={mutation.isPending || totalReinsurerShare !== 100}
              className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Création...' : 'Créer l\'affaire'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
