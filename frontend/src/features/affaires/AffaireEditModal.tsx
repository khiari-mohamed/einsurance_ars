import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, AlertCircle, Plus, Trash2 } from 'lucide-react';
import masterDataApi from '../../api/master-data.api';
import CountrySelect from '../../components/ui/CountrySelect';
import { affairesApi } from '../../api/affaires.api';
import {
  Affaire, AffaireType, UpdateAffaireDto, AffaireReassureurInput, CommissionMode,
  GuaranteeLineInput, ReassuranceType, ModeRenouvellement,
  reassuranceTypeLabels, modeRenouvellementLabels,
} from '../../types/affaire.types';

interface Props {
  affaire: Affaire;
  onClose: () => void;
}

// FIX (Affaires pass): full rewrite — the old version edited a flat,
// nonexistent shape (assureId/capitalAssure100/tauxCommissionARS directly on
// Affaire, single global commission). This edits the real nested structure
// and — per AffairesService.update()'s contract — sends the FULL
// facultativeData/traiteData object on every save (the backend's nested
// DTOs require their base fields even on partial updates), not a delta.
export default function AffaireEditModal({ affaire, onClose }: Props) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<string[]>([]);

  const [modePaiement, setModePaiement] = useState(affaire.modePaiement);
  const [currency, setCurrency] = useState(affaire.currency);

  const [fac, setFac] = useState(affaire.facultativeData ? { ...affaire.facultativeData } : null);
  const [guaranteeLines, setGuaranteeLines] = useState<GuaranteeLineInput[]>(
    affaire.facultativeData?.guaranteeLines?.map((g) => ({ garantie: g.garantie, capitauxAssures100: g.capitauxAssures100, ordre: g.ordre })) || []
  );

  const [traite, setTraite] = useState(affaire.traiteData ? { ...affaire.traiteData } : null);

  const [reassureurs, setReassureurs] = useState<AffaireReassureurInput[]>(
    affaire.reassureurs.map((r) => ({
      reassureurId: r.reassureurId,
      partPct: r.partPct,
      isLeader: r.isLeader,
      commissionMode: r.commissionMode,
      tauxCommissionArs: r.tauxCommissionArs,
      commissionForfait: r.commissionForfait,
    }))
  );

  const { data: assuresOptions = [] } = useQuery({
    queryKey: ['assures'],
    queryFn: async () => (await masterDataApi.assures.getAll({ limit: 500 })).data.data,
  });
  const { data: reassureursOptions = [] } = useQuery({
    queryKey: ['reassureurs'],
    queryFn: async () => (await masterDataApi.reassureurs.getAll({ limit: 500 })).data.data,
  });

  const mutation = useMutation({
    mutationFn: (data: UpdateAffaireDto) => affairesApi.update(affaire.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affaire', affaire.id] });
      queryClient.invalidateQueries({ queryKey: ['affaires'] });
      onClose();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erreur lors de la modification';
      setErrors([Array.isArray(message) ? message.join(', ') : message]);
    },
  });

  const totalShare = reassureurs.reduce((sum, r) => sum + (r.partPct || 0), 0);

  const validateForm = (): boolean => {
    const errs: string[] = [];
    if (Math.abs(totalShare - 100) > 0.001) errs.push('La somme des participations doit être 100%');
    const seen = new Set<string>();
    for (const r of reassureurs) {
      if (!r.reassureurId) errs.push('Chaque ligne doit avoir un réassureur sélectionné');
      if (seen.has(r.reassureurId)) errs.push('Un même réassureur ne peut apparaître qu\'une seule fois');
      seen.add(r.reassureurId);
    }
    const dateEffet = affaire.type === AffaireType.FACULTATIVE ? fac?.dateEffet : traite?.dateEffet;
    const dateEcheance = affaire.type === AffaireType.FACULTATIVE ? fac?.dateEcheance : traite?.dateEcheance;
    if (dateEffet && dateEcheance && new Date(dateEffet) >= new Date(dateEcheance)) {
      errs.push('La date d\'effet doit être antérieure à la date d\'échéance');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const dto: UpdateAffaireDto = {
      modePaiement,
      currency,
      reassureurs,
      ...(affaire.type === AffaireType.FACULTATIVE && fac
        ? {
            facultativeData: {
              reassuranceType: fac.reassuranceType,
              assureId: fac.assureId,
              numeroPoliceCedante: fac.numeroPoliceCedante,
              dateEffet: fac.dateEffet,
              dateEcheance: fac.dateEcheance,
              modeRenouvellement: fac.modeRenouvellement,
              paysAssure: fac.paysAssure,
              branche: fac.branche,
              produit: fac.produit,
              garantie: fac.garantie,
              prime100Pct: fac.prime100Pct,
              tauxPrime: fac.tauxPrime,
              tauxCession: fac.tauxCession,
              tauxCommissionCedante: fac.tauxCommissionCedante,
              guaranteeLines,
            },
          }
        : {}),
      ...(affaire.type === AffaireType.TRAITE && traite
        ? {
            traiteData: {
              referenceTraite: traite.referenceTraite,
              reassuranceType: traite.reassuranceType,
              formeCouverture: traite.formeCouverture,
              dateEffet: traite.dateEffet,
              dateEcheance: traite.dateEcheance,
              modeRenouvellement: traite.modeRenouvellement,
              dateAvisResiliation: traite.dateAvisResiliation,
              zoneGeographique: traite.zoneGeographique,
              branche: traite.branche,
              produit: traite.produit,
              garantie: traite.garantie,
              periodicite: traite.periodicite,
              primePrevisionnelle: traite.primePrevisionnelle,
              pmd: traite.pmd,
              tauxCommissionCedante: traite.tauxCommissionCedante,
              commissionLiquidationArs: traite.commissionLiquidationArs,
              seuilNotification: traite.seuilNotification,
              // accountRubriques/pmdInstalments intentionally omitted here —
              // left unchanged unless edited; a dedicated manager UI for
              // those (TreatyParametersManager / PmdInstalmentsManager,
              // already in the tree) is reviewed in the Traité pass.
            },
          }
        : {}),
    };
    mutation.mutate(dto);
  };

  const addReassureur = () =>
    setReassureurs((prev) => [...prev, { reassureurId: '', partPct: 0, commissionMode: CommissionMode.CALCULABLE, tauxCommissionArs: 0 }]);
  const updateReassureur = (idx: number, patch: Partial<AffaireReassureurInput>) =>
    setReassureurs((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeReassureur = (idx: number) => setReassureurs((prev) => prev.filter((_, i) => i !== idx));

  const addGuaranteeLine = () => setGuaranteeLines((prev) => [...prev, { garantie: '', capitauxAssures100: 0 }]);
  const updateGuaranteeLine = (idx: number, patch: Partial<GuaranteeLineInput>) =>
    setGuaranteeLines((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  const removeGuaranteeLine = (idx: number) => setGuaranteeLines((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-[18px] font-semibold text-gray-900">Modifier l'Affaire {affaire.numero}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mode de paiement</label>
              <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value as any)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="PAR_AFFAIRE">Par Affaire</option>
                <option value="PAR_SITUATION">Par Situation</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Devise</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                {['TND', 'EUR', 'USD', 'GBP'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {affaire.type === AffaireType.FACULTATIVE && fac && (
            <div className="space-y-4">
              <h3 className="text-[14px] font-semibold text-gray-900">Données Facultative</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Assuré</label>
                  <select value={fac.assureId || ''} onChange={(e) => setFac({ ...fac, assureId: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Sélectionner</option>
                    {assuresOptions.map((a: any) => <option key={a.id} value={a.id}>{a.raisonSociale} ({a.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Type de réassurance</label>
                  <select value={fac.reassuranceType || ''} onChange={(e) => setFac({ ...fac, reassuranceType: e.target.value as ReassuranceType })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(reassuranceTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">N° Police cédante</label>
                  <input type="text" value={fac.numeroPoliceCedante || ''} onChange={(e) => setFac({ ...fac, numeroPoliceCedante: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mode de renouvellement</label>
                  <select value={fac.modeRenouvellement || ''} onChange={(e) => setFac({ ...fac, modeRenouvellement: (e.target.value || undefined) as ModeRenouvellement })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">—</option>
                    {Object.entries(modeRenouvellementLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Effet</label>
                  <input type="date" value={fac.dateEffet.split('T')[0]} onChange={(e) => setFac({ ...fac, dateEffet: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Échéance</label>
                  <input type="date" value={fac.dateEcheance.split('T')[0]} onChange={(e) => setFac({ ...fac, dateEcheance: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Pays de l'assuré</label>
                  <CountrySelect
                    value={fac.paysAssure || ''}
                    onChange={(v) => setFac({ ...fac, paysAssure: v })}
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Branche</label>
                  <input type="text" value={fac.branche || ''} onChange={(e) => setFac({ ...fac, branche: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Produit</label>
                  <input type="text" value={fac.produit || ''} onChange={(e) => setFac({ ...fac, produit: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Garantie</label>
                  <input type="text" value={fac.garantie || ''} onChange={(e) => setFac({ ...fac, garantie: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime 100%</label>
                  <input type="number" step="0.001" value={fac.prime100Pct} onChange={(e) => setFac({ ...fac, prime100Pct: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Cession (%)</label>
                  <input type="number" step="0.0001" value={fac.tauxCession} onChange={(e) => setFac({ ...fac, tauxCession: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Commission Cédante (%)</label>
                  <input type="number" step="0.0001" value={fac.tauxCommissionCedante || 0} onChange={(e) => setFac({ ...fac, tauxCommissionCedante: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[13px] font-semibold text-gray-900">Capitaux assurés par garantie</h4>
                  <button type="button" onClick={addGuaranteeLine} className="flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-700 font-medium">
                    <Plus size={13} /> Ajouter
                  </button>
                </div>
                {guaranteeLines.map((g, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input placeholder="Garantie" value={g.garantie} onChange={(e) => updateGuaranteeLine(idx, { garantie: e.target.value })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                    <input type="number" step="0.001" placeholder="Capitaux 100%" value={g.capitauxAssures100} onChange={(e) => updateGuaranteeLine(idx, { capitauxAssures100: parseFloat(e.target.value) || 0 })} className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                    <button type="button" onClick={() => removeGuaranteeLine(idx)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {affaire.type === AffaireType.TRAITE && traite && (
            <div className="space-y-4">
              <h3 className="text-[14px] font-semibold text-gray-900">Données Traité</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Référence traité</label>
                  <input type="text" value={traite.referenceTraite || ''} onChange={(e) => setTraite({ ...traite, referenceTraite: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Effet</label>
                  <input type="date" value={traite.dateEffet.split('T')[0]} onChange={(e) => setTraite({ ...traite, dateEffet: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Échéance</label>
                  <input type="date" value={traite.dateEcheance.split('T')[0]} onChange={(e) => setTraite({ ...traite, dateEcheance: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime Prévisionnelle</label>
                  <input type="number" step="0.001" value={traite.primePrevisionnelle || 0} onChange={(e) => setTraite({ ...traite, primePrevisionnelle: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">PMD</label>
                  <input type="number" step="0.001" value={traite.pmd || 0} onChange={(e) => setTraite({ ...traite, pmd: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Commission Cédante (%)</label>
                  <input type="number" step="0.0001" value={traite.tauxCommissionCedante || 0} onChange={(e) => setTraite({ ...traite, tauxCommissionCedante: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <p className="text-[11px] text-gray-400">
                Rubriques comptables et échéancier PMD se gèrent depuis les gestionnaires dédiés (onglet Traité de la fiche détail).
              </p>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-semibold text-gray-900">Réassureurs</h3>
              <button type="button" onClick={addReassureur} className="text-[13px] text-blue-600 hover:text-blue-700 font-medium">+ Ajouter</button>
            </div>
            {reassureurs.map((r, idx) => (
              <div key={idx} className="p-3 border border-gray-200 rounded-lg mb-2 space-y-2">
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <select value={r.reassureurId} onChange={(e) => updateReassureur(idx, { reassureurId: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Sélectionner</option>
                      {reassureursOptions.map((ro: any) => <option key={ro.id} value={ro.id}>{ro.raisonSociale}</option>)}
                    </select>
                  </div>
                  <input type="number" step="0.0001" placeholder="Part %" value={r.partPct} onChange={(e) => updateReassureur(idx, { partPct: parseFloat(e.target.value) || 0 })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => removeReassureur(idx)} className="px-2 text-red-600 hover:bg-red-50 rounded">×</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <select value={r.commissionMode} onChange={(e) => updateReassureur(idx, { commissionMode: e.target.value as CommissionMode })} className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={CommissionMode.CALCULABLE}>Calculable</option>
                    <option value={CommissionMode.FORFAITAIRE}>Forfaitaire</option>
                  </select>
                  {r.commissionMode === CommissionMode.CALCULABLE ? (
                    <input type="number" step="0.0001" placeholder="Taux ARS %" value={r.tauxCommissionArs || 0} onChange={(e) => updateReassureur(idx, { tauxCommissionArs: parseFloat(e.target.value) || 0 })} className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  ) : (
                    <input type="number" step="0.001" placeholder="Montant forfaitaire" value={r.commissionForfait || 0} onChange={(e) => updateReassureur(idx, { commissionForfait: parseFloat(e.target.value) || 0 })} className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>
              </div>
            ))}
            <div className={`p-2 rounded-lg text-[12px] ${Math.abs(totalShare - 100) < 0.001 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
              Total: {totalShare.toFixed(4)}%
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
          <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            Annuler
          </button>
          <button type="submit" onClick={handleSubmit} disabled={mutation.isPending} className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
            <Save size={16} />
            {mutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}