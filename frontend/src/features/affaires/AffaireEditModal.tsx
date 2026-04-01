import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, AlertCircle } from 'lucide-react';
import api from '../../lib/api';
import { affairesApi } from '../../api/affaires.api';
import { Affaire, AffaireCategory, CommissionCalculMode, CreateAffaireReinsurer } from '../../types/affaire.types';

interface Props {
  affaire: Affaire;
  onClose: () => void;
}

export default function AffaireEditModal({ affaire, onClose }: Props) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    category: affaire.category,
    type: affaire.type,
    assureId: affaire.assureId,
    cedanteId: affaire.cedanteId,
    coCourtierId: affaire.coCourtierId,
    numeroPolice: affaire.numeroPolice,
    branche: affaire.branche,
    garantie: affaire.garantie,
    dateEffet: affaire.dateEffet.split('T')[0],
    dateEcheance: affaire.dateEcheance.split('T')[0],
    devise: affaire.devise,
    capitalAssure100: affaire.capitalAssure100,
    prime100: affaire.prime100,
    tauxCession: affaire.tauxCession,
    tauxCommissionCedante: affaire.tauxCommissionCedante,
    modeCalculCommissionCedante: affaire.modeCalculCommissionCedante,
    montantCommissionCedante: affaire.montantCommissionCedante,
    tauxCommissionARS: affaire.tauxCommissionARS,
    modeCalculCommissionARS: affaire.modeCalculCommissionARS,
    montantCommissionARS: affaire.montantCommissionARS,
    treatyType: affaire.treatyType,
    periodiciteComptes: affaire.periodiciteComptes,
    primePrevisionnelle: affaire.primePrevisionnelle,
    pmd: affaire.pmd,
    reinsurers: affaire.reinsurers.map(r => ({
      reassureurId: r.reassureurId,
      share: r.share,
      role: r.role,
    })),
    notes: affaire.notes,
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
    mutationFn: (data: any) => affairesApi.update(affaire.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affaire', affaire.id] });
      queryClient.invalidateQueries({ queryKey: ['affaires'] });
      alert('✅ Affaire modifiée avec succès');
      onClose();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erreur lors de la modification';
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
          <h2 className="text-[18px] font-semibold text-gray-900">Modifier l'Affaire</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Assuré *</label>
              <select
                value={formData.assureId}
                onChange={(e) => setFormData({ ...formData, assureId: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Sélectionner</option>
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
                <option value="">Sélectionner</option>
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

            {formData.category === AffaireCategory.FACULTATIVE ? (
              <>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Capital Assuré 100%</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.capitalAssure100}
                    onChange={(e) => setFormData({ ...formData, capitalAssure100: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime 100%</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.prime100}
                    onChange={(e) => setFormData({ ...formData, prime100: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Cession (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.tauxCession}
                    onChange={(e) => setFormData({ ...formData, tauxCession: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime Prévisionnelle</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.primePrevisionnelle || 0}
                    onChange={(e) => setFormData({ ...formData, primePrevisionnelle: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">PMD</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.pmd || 0}
                    onChange={(e) => setFormData({ ...formData, pmd: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Commission ARS (%)</label>
              <input
                type="number"
                step="0.01"
                value={formData.tauxCommissionARS}
                onChange={(e) => setFormData({ ...formData, tauxCommissionARS: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-semibold text-gray-900">Réassureurs</h3>
              <button
                type="button"
                onClick={addReinsurer}
                className="text-[13px] text-blue-600 hover:text-blue-700 font-medium"
              >
                + Ajouter
              </button>
            </div>
            {formData.reinsurers.map((reinsurer, index) => (
              <div key={index} className="p-3 border border-gray-200 rounded-lg mb-2">
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
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Part %"
                      value={reinsurer.share}
                      onChange={(e) => updateReinsurer(index, 'share', parseFloat(e.target.value) || 0)}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeReinsurer(index)}
                      className="px-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className={`p-2 rounded-lg text-[12px] ${totalReinsurerShare === 100 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
              Total: {totalReinsurerShare.toFixed(2)}%
            </div>
          </div>

          {errors.length > 0 && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="text-red-600 mt-0.5" />
                <div>
                  <p className="text-[13px] font-medium text-red-900 mb-1">Erreurs:</p>
                  <ul className="text-[12px] text-red-700 space-y-1">
                    {errors.map((err, i) => <li key={i}>• {err}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </form>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
