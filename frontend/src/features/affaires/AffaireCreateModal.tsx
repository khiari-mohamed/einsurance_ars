import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, AlertCircle, Plus, Trash2 } from 'lucide-react';
import masterDataApi from '../../api/master-data.api';
import { affairesApi } from '../../api/affaires.api';
import CountrySelect from '../../components/ui/CountrySelect';
import CurrencySelect from '../../components/ui/CurrencySelect';
import {
  CreateAffaireDto, AffaireType, ModePaiement, ReassuranceType, FormeCouverture,
  ModeRenouvellement, Periodicite, CommissionMode, AffaireReassureurInput,
  GuaranteeLineInput, TreatyAccountRubriqueInput, PmdInstalmentInput,
  typeLabels, reassuranceTypeLabels, formeCouvertureLabels, periodiciteLabels,
  modeRenouvellementLabels,
} from '../../types/affaire.types';

interface Props {
  onClose: () => void;
}

const emptyReassureur = (): AffaireReassureurInput => ({
  reassureurId: '',
  partPct: 0,
  isLeader: false,
  commissionMode: CommissionMode.CALCULABLE,
  tauxCommissionArs: 0,
});

export default function AffaireCreateModal({ onClose }: Props) {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [type, setType] = useState<AffaireType>(AffaireType.FACULTATIVE);
  const [cedanteId, setCedanteId] = useState('');
  const [modePaiement, setModePaiement] = useState<ModePaiement>(ModePaiement.PAR_AFFAIRE);
  const [currency, setCurrency] = useState('TND');

  const [fac, setFac] = useState<Partial<import('../../types/affaire.types').FacultativeDataInput>>({
    reassuranceType: ReassuranceType.PROPORTIONNEL,
    assureId: '',
    dateEffet: '',
    dateEcheance: '',
    prime100Pct: 0,
    tauxCession: 0,
    tauxCommissionCedante: 0,
  });
  const [guaranteeLines, setGuaranteeLines] = useState<GuaranteeLineInput[]>([]);

  const [traite, setTraite] = useState<Partial<import('../../types/affaire.types').TraiteDataInput>>({
    reassuranceType: ReassuranceType.PROPORTIONNEL,
    periodicite: Periodicite.TRIMESTRIELLE,
    dateEffet: '',
    dateEcheance: '',
  });
  const [accountRubriques, setAccountRubriques] = useState<TreatyAccountRubriqueInput[]>([]);
  const [pmdInstalments, setPmdInstalments] = useState<PmdInstalmentInput[]>([]);

  const [reassureurs, setReassureurs] = useState<AffaireReassureurInput[]>([emptyReassureur()]);

  const { data: assures = [] } = useQuery({
    queryKey: ['assures'],
    queryFn: async () => (await masterDataApi.assures.getAll({ limit: 500 })).data.data,
  });
  const { data: cedantes = [] } = useQuery({
    queryKey: ['cedantes'],
    queryFn: async () => (await masterDataApi.cedantes.getAll({ limit: 500 })).data.data,
  });
  const { data: reassureursOptions = [] } = useQuery({
    queryKey: ['reassureurs'],
    queryFn: async () => (await masterDataApi.reassureurs.getAll({ limit: 500 })).data.data,
  });

  const mutation = useMutation({
    mutationFn: (data: CreateAffaireDto) => affairesApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['affaires'] });
      onClose();
      const newId = (res as any)?.data?.id;
      if (newId) navigate(`/affaires/${newId}`);
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || 'Erreur lors de la création';
      setErrors([Array.isArray(message) ? message.join(', ') : message]);
    },
  });

  const primeCedeeCalc =
    type === AffaireType.FACULTATIVE
      ? Number(fac.prime100Pct || 0) * (Number(fac.tauxCession || 0) / 100)
      : Number(traite.primePrevisionnelle || 0);

  const totalShare = reassureurs.reduce((sum, r) => sum + (r.partPct || 0), 0);

  const validateStep1 = () => {
    if (!cedanteId) return false;
    if (type === AffaireType.FACULTATIVE && !fac.assureId) return false;
    return true;
  };
  const validateStep2 = () => {
    if (type === AffaireType.FACULTATIVE) {
      return !!fac.assureId && !!fac.dateEffet && !!fac.dateEcheance && (fac.prime100Pct ?? 0) > 0 && (fac.tauxCession ?? 0) > 0;
    }
    return !!traite.dateEffet && !!traite.dateEcheance && !!traite.periodicite;
  };

  const validateFinal = (): boolean => {
    const errs: string[] = [];
    if (Math.abs(totalShare - 100) > 0.001) errs.push('La somme des participations des réassureurs doit être 100%');
    const seen = new Set<string>();
    for (const r of reassureurs) {
      if (!r.reassureurId) errs.push('Chaque ligne doit avoir un réassureur sélectionné');
      if (seen.has(r.reassureurId)) errs.push('Un même réassureur ne peut apparaître qu\'une seule fois');
      seen.add(r.reassureurId);
      if (r.commissionMode === CommissionMode.CALCULABLE && (r.tauxCommissionArs === undefined || r.tauxCommissionArs === null)) {
        errs.push('Taux de commission ARS requis en mode Calculable');
      }
      if (r.commissionMode === CommissionMode.FORFAITAIRE && (r.commissionForfait === undefined || r.commissionForfait === null)) {
        errs.push('Montant forfaitaire requis en mode Forfaitaire');
      }
    }
    const dateEffet = type === AffaireType.FACULTATIVE ? fac.dateEffet : traite.dateEffet;
    const dateEcheance = type === AffaireType.FACULTATIVE ? fac.dateEcheance : traite.dateEcheance;
    if (dateEffet && dateEcheance && new Date(dateEffet) >= new Date(dateEcheance)) {
      errs.push('La date d\'effet doit être antérieure à la date d\'échéance');
    }
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = () => {
    if (!validateFinal()) return;

    const dto: CreateAffaireDto = {
      type,
      cedanteId,
      modePaiement,
      currency,
      reassureurs,
      ...(type === AffaireType.FACULTATIVE
        ? {
            facultativeData: {
              ...(fac as any),
              guaranteeLines: guaranteeLines.length ? guaranteeLines : undefined,
            },
          }
        : {
            traiteData: {
              ...(traite as any),
              accountRubriques: accountRubriques.length ? accountRubriques : undefined,
              pmdInstalments: pmdInstalments.length ? pmdInstalments : undefined,
            },
          }),
    };
    mutation.mutate(dto);
  };

  const addReassureur = () => setReassureurs((prev) => [...prev, emptyReassureur()]);
  const updateReassureur = (idx: number, patch: Partial<AffaireReassureurInput>) =>
    setReassureurs((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeReassureur = (idx: number) => setReassureurs((prev) => prev.filter((_, i) => i !== idx));

  const addGuaranteeLine = () => setGuaranteeLines((prev) => [...prev, { garantie: '', capitauxAssures100: 0 }]);
  const updateGuaranteeLine = (idx: number, patch: Partial<GuaranteeLineInput>) =>
    setGuaranteeLines((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  const removeGuaranteeLine = (idx: number) => setGuaranteeLines((prev) => prev.filter((_, i) => i !== idx));

  const addRubrique = () => setAccountRubriques((prev) => [...prev, { rubrique: '', compteReference: '' }]);
  const updateRubrique = (idx: number, patch: Partial<TreatyAccountRubriqueInput>) =>
    setAccountRubriques((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeRubrique = (idx: number) => setAccountRubriques((prev) => prev.filter((_, i) => i !== idx));

  const addInstalment = () =>
    setPmdInstalments((prev) => [...prev, { numeroTranche: prev.length + 1, dateEcheance: '', montant: 0 }]);
  const updateInstalment = (idx: number, patch: Partial<PmdInstalmentInput>) =>
    setPmdInstalments((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const removeInstalment = (idx: number) => setPmdInstalments((prev) => prev.filter((_, i) => i !== idx));

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

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Informations Générales</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Type d'affaire *</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AffaireType)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Cédante *</label>
                  <select
                    value={cedanteId}
                    onChange={(e) => setCedanteId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sélectionner une cédante</option>
                    {cedantes.map((c: any) => <option key={c.id} value={c.id}>{c.raisonSociale}</option>)}
                  </select>
                </div>
                {type === AffaireType.FACULTATIVE && (
                  <div>
                    <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Assuré *</label>
                    <select
                      value={fac.assureId || ''}
                      onChange={(e) => setFac({ ...fac, assureId: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Sélectionner un assuré</option>
                      {assures.map((a: any) => <option key={a.id} value={a.id}>{a.raisonSociale} ({a.code})</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Devise</label>
                  <CurrencySelect
                    value={currency}
                    onChange={setCurrency}
                    placeholder="Sélectionner une devise..."
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mode de paiement</label>
                  <select
                    value={modePaiement}
                    onChange={(e) => setModePaiement(e.target.value as ModePaiement)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={ModePaiement.PAR_AFFAIRE}>Par Affaire (hors situation)</option>
                    <option value={ModePaiement.PAR_SITUATION}>Par Situation (inclus)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && type === AffaireType.FACULTATIVE && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Facultative — Données Contractuelles &amp; Financières</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Type de réassurance</label>
                  <select
                    value={fac.reassuranceType}
                    onChange={(e) => setFac({ ...fac, reassuranceType: e.target.value as ReassuranceType })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(reassuranceTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">N° Police cédante</label>
                  <input
                    type="text"
                    value={fac.numeroPoliceCedante || ''}
                    onChange={(e) => setFac({ ...fac, numeroPoliceCedante: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mode de renouvellement</label>
                  <select
                    value={fac.modeRenouvellement || ''}
                    onChange={(e) => setFac({ ...fac, modeRenouvellement: (e.target.value || undefined) as ModeRenouvellement })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">—</option>
                    {Object.entries(modeRenouvellementLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Effet *</label>
                  <input type="date" value={fac.dateEffet || ''} onChange={(e) => setFac({ ...fac, dateEffet: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Échéance *</label>
                  <input type="date" value={fac.dateEcheance || ''} onChange={(e) => setFac({ ...fac, dateEcheance: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 mt-2">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime 100% *</label>
                  <input type="number" step="0.001" value={fac.prime100Pct || 0} onChange={(e) => setFac({ ...fac, prime100Pct: parseFloat(e.target.value) || 0 })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Prime (%)</label>
                  <input type="number" step="0.0001" value={fac.tauxPrime || 0} onChange={(e) => setFac({ ...fac, tauxPrime: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Cession (%) *</label>
                  <input type="number" step="0.0001" min="0" max="100" value={fac.tauxCession || 0} onChange={(e) => setFac({ ...fac, tauxCession: parseFloat(e.target.value) || 0 })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime Cédée (calculée)</label>
                  <input type="text" value={primeCedeeCalc.toFixed(3)} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] bg-gray-50 text-gray-700" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Commission Cédante (%)</label>
                  <input type="number" step="0.0001" value={fac.tauxCommissionCedante || 0} onChange={(e) => setFac({ ...fac, tauxCommissionCedante: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[13px] font-semibold text-gray-900">Capitaux assurés par garantie</h4>
                  <button type="button" onClick={addGuaranteeLine} className="flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-700 font-medium">
                    <Plus size={13} /> Ajouter une ligne
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

          {step === 2 && type === AffaireType.TRAITE && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-gray-900 mb-4">Traité — Données Contractuelles &amp; Financières</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Référence traité</label>
                  <input type="text" value={traite.referenceTraite || ''} onChange={(e) => setTraite({ ...traite, referenceTraite: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Type de réassurance</label>
                  <select value={traite.reassuranceType} onChange={(e) => setTraite({ ...traite, reassuranceType: e.target.value as ReassuranceType })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(reassuranceTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Forme de couverture</label>
                  <select value={traite.formeCouverture || ''} onChange={(e) => setTraite({ ...traite, formeCouverture: (e.target.value || undefined) as FormeCouverture })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">—</option>
                    {Object.entries(formeCouvertureLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Périodicité *</label>
                  <select value={traite.periodicite} onChange={(e) => setTraite({ ...traite, periodicite: e.target.value as Periodicite })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(periodiciteLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Effet *</label>
                  <input type="date" value={traite.dateEffet || ''} onChange={(e) => setTraite({ ...traite, dateEffet: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Échéance *</label>
                  <input type="date" value={traite.dateEcheance || ''} onChange={(e) => setTraite({ ...traite, dateEcheance: e.target.value })} required className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mode de renouvellement</label>
                  <select value={traite.modeRenouvellement || ''} onChange={(e) => setTraite({ ...traite, modeRenouvellement: (e.target.value || undefined) as ModeRenouvellement })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">—</option>
                    {Object.entries(modeRenouvellementLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date avis résiliation</label>
                  <input type="date" value={traite.dateAvisResiliation || ''} onChange={(e) => setTraite({ ...traite, dateAvisResiliation: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Zone géographique</label>
                  <input type="text" value={traite.zoneGeographique || ''} onChange={(e) => setTraite({ ...traite, zoneGeographique: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Branche</label>
                  <input type="text" value={traite.branche || ''} onChange={(e) => setTraite({ ...traite, branche: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Produit</label>
                  <input type="text" value={traite.produit || ''} onChange={(e) => setTraite({ ...traite, produit: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Garantie</label>
                  <input type="text" value={traite.garantie || ''} onChange={(e) => setTraite({ ...traite, garantie: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100 mt-2">
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime Prévisionnelle</label>
                  <input type="number" step="0.001" value={traite.primePrevisionnelle || 0} onChange={(e) => setTraite({ ...traite, primePrevisionnelle: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">PMD (Prime Minimum et Dépôt)</label>
                  <input type="number" step="0.001" value={traite.pmd || 0} onChange={(e) => setTraite({ ...traite, pmd: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Commission Cédante (%)</label>
                  <input type="number" step="0.0001" value={traite.tauxCommissionCedante || 0} onChange={(e) => setTraite({ ...traite, tauxCommissionCedante: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Commission Liquidation ARS</label>
                  <input type="number" step="0.001" value={traite.commissionLiquidationArs || 0} onChange={(e) => setTraite({ ...traite, commissionLiquidationArs: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Seuil de notification sinistre</label>
                  <input type="number" step="0.001" value={traite.seuilNotification || 0} onChange={(e) => setTraite({ ...traite, seuilNotification: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-1 text-[11px] text-gray-400">Montant au-delà duquel les réassureurs proportionnels doivent être notifiés (avis de sinistre)</p>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[13px] font-semibold text-gray-900">Rubriques comptables</h4>
                  <button type="button" onClick={addRubrique} className="flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-700 font-medium">
                    <Plus size={13} /> Ajouter une rubrique
                  </button>
                </div>
                {accountRubriques.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input placeholder="Rubrique (ex: Incendie)" value={r.rubrique} onChange={(e) => updateRubrique(idx, { rubrique: e.target.value })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                    <input placeholder="Compte de référence" value={r.compteReference} onChange={(e) => updateRubrique(idx, { compteReference: e.target.value })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px] font-mono" />
                    <button type="button" onClick={() => removeRubrique(idx)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[13px] font-semibold text-gray-900">Échéancier PMD</h4>
                  <button type="button" onClick={addInstalment} className="flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-700 font-medium">
                    <Plus size={13} /> Ajouter une tranche
                  </button>
                </div>
                {pmdInstalments.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input type="number" placeholder="N° tranche" value={p.numeroTranche} onChange={(e) => updateInstalment(idx, { numeroTranche: parseInt(e.target.value) || 1 })} className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                    <input type="date" value={p.dateEcheance} onChange={(e) => updateInstalment(idx, { dateEcheance: e.target.value })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                    <input type="number" step="0.001" placeholder="Montant" value={p.montant} onChange={(e) => updateInstalment(idx, { montant: parseFloat(e.target.value) || 0 })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                    <input type="number" step="0.0001" placeholder="Taux déduction %" value={p.tauxDeduction || ''} onChange={(e) => updateInstalment(idx, { tauxDeduction: parseFloat(e.target.value) || undefined })} className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
                    <button type="button" onClick={() => removeInstalment(idx)} className="p-2 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-gray-900">Table de participation des Réassureurs</h3>
                <button type="button" onClick={addReassureur} className="text-[13px] text-blue-600 hover:text-blue-700 font-medium">
                  + Ajouter un réassureur
                </button>
              </div>

              {reassureurs.map((r, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-gray-700">Ligne {idx + 1}</span>
                    <button type="button" onClick={() => removeReassureur(idx)} className="text-[12px] text-red-600 hover:text-red-700">Supprimer</button>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <select
                        value={r.reassureurId}
                        onChange={(e) => updateReassureur(idx, { reassureurId: e.target.value })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sélectionner un réassureur</option>
                        {reassureursOptions.map((ro: any) => <option key={ro.id} value={ro.id}>{ro.raisonSociale}</option>)}
                      </select>
                    </div>
                    <div>
                      <input
                        type="number" step="0.0001" min="0" max="100" placeholder="Part %"
                        value={r.partPct}
                        onChange={(e) => updateReassureur(idx, { partPct: parseFloat(e.target.value) || 0 })}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={!!r.isLeader} onChange={(e) => updateReassureur(idx, { isLeader: e.target.checked })} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                      <span className="text-[12px] text-gray-700">Leader / Apériteur</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-1">Mode de commission</label>
                      <select
                        value={r.commissionMode}
                        onChange={(e) => updateReassureur(idx, { commissionMode: e.target.value as CommissionMode })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={CommissionMode.CALCULABLE}>Calculable (taux × prime)</option>
                        <option value={CommissionMode.FORFAITAIRE}>Forfaitaire (montant fixe)</option>
                      </select>
                    </div>
                    {r.commissionMode === CommissionMode.CALCULABLE ? (
                      <div className="col-span-2">
                        <label className="block text-[11px] text-gray-500 mb-1">Taux commission ARS (%)</label>
                        <input
                          type="number" step="0.0001" min="0" max="100"
                          value={r.tauxCommissionArs || 0}
                          onChange={(e) => updateReassureur(idx, { tauxCommissionArs: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ) : (
                      <div className="col-span-2">
                        <label className="block text-[11px] text-gray-500 mb-1">Commission forfaitaire (montant)</label>
                        <input
                          type="number" step="0.001"
                          value={r.commissionForfait || 0}
                          onChange={(e) => updateReassureur(idx, { commissionForfait: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className={`p-3 rounded-lg ${Math.abs(totalShare - 100) < 0.001 ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <p className={`text-[13px] font-medium ${Math.abs(totalShare - 100) < 0.001 ? 'text-green-700' : 'text-yellow-700'}`}>
                  Total des parts: {totalShare.toFixed(4)}% {Math.abs(totalShare - 100) < 0.001 ? '✓' : '(doit être 100%)'}
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
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-100">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ChevronLeft size={16} />
            {step > 1 ? 'Précédent' : 'Annuler'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !validateStep1() : !validateStep2()}
              className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Suivant
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="px-4 py-2 text-[13px] font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? 'Création...' : "Créer l'affaire"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}