import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, AlertCircle, Plus, Trash2, CheckCircle2 } from 'lucide-react';
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

const fieldClass =
  'w-full rounded-xl border border-border bg-secondary px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background';
const labelClass = 'block text-[12px] font-medium text-muted-foreground mb-1.5';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-foreground">Nouvelle Affaire</h2>
            <p className="text-[12px] text-muted-foreground mt-1">Étape {step} sur 3</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-foreground mb-4">Informations Générales</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Type d'affaire *</label>
                  <select value={type} onChange={(e) => setType(e.target.value as AffaireType)} className={fieldClass}>
                    {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Cédante *</label>
                  <select value={cedanteId} onChange={(e) => setCedanteId(e.target.value)} required className={fieldClass}>
                    <option value="">Sélectionner une cédante</option>
                    {cedantes.map((c: any) => <option key={c.id} value={c.id}>{c.raisonSociale}</option>)}
                  </select>
                </div>
                {type === AffaireType.FACULTATIVE && (
                  <div>
                    <label className={labelClass}>Assuré *</label>
                    <select
                      value={fac.assureId || ''}
                      onChange={(e) => setFac({ ...fac, assureId: e.target.value })}
                      required
                      className={fieldClass}
                    >
                      <option value="">Sélectionner un assuré</option>
                      {assures.map((a: any) => <option key={a.id} value={a.id}>{a.raisonSociale} ({a.code})</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelClass}>Devise</label>
                  <CurrencySelect value={currency} onChange={setCurrency} placeholder="Sélectionner une devise..." />
                </div>
                <div>
                  <label className={labelClass}>Mode de paiement</label>
                  <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value as ModePaiement)} className={fieldClass}>
                    <option value={ModePaiement.PAR_AFFAIRE}>Par Affaire (hors situation)</option>
                    <option value={ModePaiement.PAR_SITUATION}>Par Situation (inclus)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && type === AffaireType.FACULTATIVE && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-foreground mb-4">Facultative — Données Contractuelles &amp; Financières</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Type de réassurance</label>
                  <select
                    value={fac.reassuranceType}
                    onChange={(e) => setFac({ ...fac, reassuranceType: e.target.value as ReassuranceType })}
                    className={fieldClass}
                  >
                    {Object.entries(reassuranceTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>
                    N° Police cédante
                    <span className="ml-1 font-normal text-muted-foreground/60" title="Numéro de police interne de la cédante — distinct du numéro d'affaire ARS (attribué automatiquement au format AFF-xxxx). Facultatif.">
                      (référence cédante)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={fac.numeroPoliceCedante || ''}
                    onChange={(e) => setFac({ ...fac, numeroPoliceCedante: e.target.value })}
                    placeholder="Ex: POL-2026-00123"
                    className={fieldClass}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    Le numéro de police propre à la cédante (pas le numéro d'affaire ARS, généré automatiquement).
                  </p>
                </div>
                <div>
                  <label className={labelClass}>Mode de renouvellement</label>
                  <select
                    value={fac.modeRenouvellement || ''}
                    onChange={(e) => setFac({ ...fac, modeRenouvellement: (e.target.value || undefined) as ModeRenouvellement })}
                    className={fieldClass}
                  >
                    <option value="">—</option>
                    {Object.entries(modeRenouvellementLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Date Effet *</label>
                  <input type="date" value={fac.dateEffet || ''} onChange={(e) => setFac({ ...fac, dateEffet: e.target.value })} required className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Date Échéance *</label>
                  <input type="date" value={fac.dateEcheance || ''} onChange={(e) => setFac({ ...fac, dateEcheance: e.target.value })} required className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Pays de l'assuré</label>
                  <CountrySelect value={fac.paysAssure || ''} onChange={(v) => setFac({ ...fac, paysAssure: v })} />
                </div>
                <div>
                  <label className={labelClass}>Branche</label>
                  <input type="text" value={fac.branche || ''} onChange={(e) => setFac({ ...fac, branche: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Produit</label>
                  <input type="text" value={fac.produit || ''} onChange={(e) => setFac({ ...fac, produit: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Garantie</label>
                  <input type="text" value={fac.garantie || ''} onChange={(e) => setFac({ ...fac, garantie: e.target.value })} className={fieldClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border mt-2">
                <div>
                  <label className={labelClass}>Prime 100% *</label>
                  <input type="number" step="0.001" value={fac.prime100Pct || 0} onChange={(e) => setFac({ ...fac, prime100Pct: parseFloat(e.target.value) || 0 })} required className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Taux Prime (%)</label>
                  <input type="number" step="0.0001" value={fac.tauxPrime || 0} onChange={(e) => setFac({ ...fac, tauxPrime: parseFloat(e.target.value) || 0 })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Taux Cession (%) *</label>
                  <input type="number" step="0.0001" min="0" max="100" value={fac.tauxCession || 0} onChange={(e) => setFac({ ...fac, tauxCession: parseFloat(e.target.value) || 0 })} required className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Prime Cédée (calculée)</label>
                  <input type="text" value={primeCedeeCalc.toFixed(3)} disabled className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground" />
                </div>
                <div>
                  <label className={labelClass}>Taux Commission Cédante (%)</label>
                  <input type="number" step="0.0001" value={fac.tauxCommissionCedante || 0} onChange={(e) => setFac({ ...fac, tauxCommissionCedante: parseFloat(e.target.value) || 0 })} className={fieldClass} />
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[13px] font-semibold text-foreground">Capitaux assurés par garantie</h4>
                  <button type="button" onClick={addGuaranteeLine} className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80">
                    <Plus size={13} /> Ajouter une ligne
                  </button>
                </div>
                {guaranteeLines.map((g, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input placeholder="Garantie" value={g.garantie} onChange={(e) => updateGuaranteeLine(idx, { garantie: e.target.value })} className={`flex-1 ${fieldClass}`} />
                    <input type="number" step="0.001" placeholder="Capitaux 100%" value={g.capitauxAssures100} onChange={(e) => updateGuaranteeLine(idx, { capitauxAssures100: parseFloat(e.target.value) || 0 })} className={`w-40 ${fieldClass}`} />
                    <button type="button" onClick={() => removeGuaranteeLine(idx)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && type === AffaireType.TRAITE && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-foreground mb-4">Traité — Données Contractuelles &amp; Financières</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Référence traité</label>
                  <input type="text" value={traite.referenceTraite || ''} onChange={(e) => setTraite({ ...traite, referenceTraite: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Type de réassurance</label>
                  <select value={traite.reassuranceType} onChange={(e) => setTraite({ ...traite, reassuranceType: e.target.value as ReassuranceType })} className={fieldClass}>
                    {Object.entries(reassuranceTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Forme de couverture</label>
                  <select value={traite.formeCouverture || ''} onChange={(e) => setTraite({ ...traite, formeCouverture: (e.target.value || undefined) as FormeCouverture })} className={fieldClass}>
                    <option value="">—</option>
                    {Object.entries(formeCouvertureLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Périodicité *</label>
                  <select value={traite.periodicite} onChange={(e) => setTraite({ ...traite, periodicite: e.target.value as Periodicite })} required className={fieldClass}>
                    {Object.entries(periodiciteLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Date Effet *</label>
                  <input type="date" value={traite.dateEffet || ''} onChange={(e) => setTraite({ ...traite, dateEffet: e.target.value })} required className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Date Échéance *</label>
                  <input type="date" value={traite.dateEcheance || ''} onChange={(e) => setTraite({ ...traite, dateEcheance: e.target.value })} required className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Mode de renouvellement</label>
                  <select value={traite.modeRenouvellement || ''} onChange={(e) => setTraite({ ...traite, modeRenouvellement: (e.target.value || undefined) as ModeRenouvellement })} className={fieldClass}>
                    <option value="">—</option>
                    {Object.entries(modeRenouvellementLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Date avis résiliation</label>
                  <input type="date" value={traite.dateAvisResiliation || ''} onChange={(e) => setTraite({ ...traite, dateAvisResiliation: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Zone géographique</label>
                  <input type="text" value={traite.zoneGeographique || ''} onChange={(e) => setTraite({ ...traite, zoneGeographique: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Branche</label>
                  <input type="text" value={traite.branche || ''} onChange={(e) => setTraite({ ...traite, branche: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Produit</label>
                  <input type="text" value={traite.produit || ''} onChange={(e) => setTraite({ ...traite, produit: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Garantie</label>
                  <input type="text" value={traite.garantie || ''} onChange={(e) => setTraite({ ...traite, garantie: e.target.value })} className={fieldClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border mt-2">
                <div>
                  <label className={labelClass}>Prime Prévisionnelle</label>
                  <input type="number" step="0.001" value={traite.primePrevisionnelle || 0} onChange={(e) => setTraite({ ...traite, primePrevisionnelle: parseFloat(e.target.value) || 0 })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>PMD (Prime Minimum et Dépôt)</label>
                  <input type="number" step="0.001" value={traite.pmd || 0} onChange={(e) => setTraite({ ...traite, pmd: parseFloat(e.target.value) || 0 })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Taux Commission Cédante (%)</label>
                  <input type="number" step="0.0001" value={traite.tauxCommissionCedante || 0} onChange={(e) => setTraite({ ...traite, tauxCommissionCedante: parseFloat(e.target.value) || 0 })} className={fieldClass} />
                </div>
                                <div>
                  <label className={labelClass}>
                    Commission Liquidation ARS
                    <span className="ml-1 font-normal text-muted-foreground/60">(saisie manuelle)</span>
                  </label>
                  <input type="number" step="0.001" value={traite.commissionLiquidationArs || 0} onChange={(e) => setTraite({ ...traite, commissionLiquidationArs: parseFloat(e.target.value) || 0 })} className={fieldClass} />
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    Montant fixe saisi manuellement — non calculé automatiquement (distinct de la commission de courtage par réassureur, définie à l'étape 3).
                  </p>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Seuil de notification sinistre</label>
                  <input type="number" step="0.001" value={traite.seuilNotification || 0} onChange={(e) => setTraite({ ...traite, seuilNotification: parseFloat(e.target.value) || 0 })} className={fieldClass} />
                  <p className="mt-1 text-[11px] text-muted-foreground/70">Montant au-delà duquel les réassureurs proportionnels doivent être notifiés (avis de sinistre)</p>
                </div>
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[13px] font-semibold text-foreground">Rubriques comptables</h4>
                  <button type="button" onClick={addRubrique} className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80">
                    <Plus size={13} /> Ajouter une rubrique
                  </button>
                </div>
                {accountRubriques.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input placeholder="Rubrique (ex: Incendie)" value={r.rubrique} onChange={(e) => updateRubrique(idx, { rubrique: e.target.value })} className={`flex-1 ${fieldClass}`} />
                    <input placeholder="Compte de référence" value={r.compteReference} onChange={(e) => updateRubrique(idx, { compteReference: e.target.value })} className={`flex-1 font-mono ${fieldClass}`} />
                    <button type="button" onClick={() => removeRubrique(idx)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[13px] font-semibold text-foreground">Échéancier PMD</h4>
                  <button type="button" onClick={addInstalment} className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80">
                    <Plus size={13} /> Ajouter une tranche
                  </button>
                </div>
                {pmdInstalments.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input type="number" placeholder="N° tranche" value={p.numeroTranche} onChange={(e) => updateInstalment(idx, { numeroTranche: parseInt(e.target.value) || 1 })} className={`w-24 ${fieldClass}`} />
                    <input type="date" value={p.dateEcheance} onChange={(e) => updateInstalment(idx, { dateEcheance: e.target.value })} className={`flex-1 ${fieldClass}`} />
                    <input type="number" step="0.001" placeholder="Montant" value={p.montant} onChange={(e) => updateInstalment(idx, { montant: parseFloat(e.target.value) || 0 })} className={`flex-1 ${fieldClass}`} />
                    <input type="number" step="0.0001" placeholder="Taux déduction %" value={p.tauxDeduction || ''} onChange={(e) => updateInstalment(idx, { tauxDeduction: parseFloat(e.target.value) || undefined })} className={`w-32 ${fieldClass}`} />
                    <button type="button" onClick={() => removeInstalment(idx)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-foreground">Table de participation des Réassureurs</h3>
                <button type="button" onClick={addReassureur} className="text-[13px] font-medium text-primary hover:text-primary/80">
                  + Ajouter un réassureur
                </button>
              </div>

              {reassureurs.map((r, idx) => (
                <div key={idx} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-muted-foreground">Ligne {idx + 1}</span>
                    <button type="button" onClick={() => removeReassureur(idx)} className="text-[12px] text-destructive hover:text-destructive/80">Supprimer</button>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-2">
                      <select
                        value={r.reassureurId}
                        onChange={(e) => updateReassureur(idx, { reassureurId: e.target.value })}
                        required
                        className={fieldClass}
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
                        className={fieldClass}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!r.isLeader}
                        onChange={(e) => updateReassureur(idx, { isLeader: e.target.checked })}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <span className="text-[12px] text-muted-foreground">Leader / Apériteur</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-1">Mode de commission</label>
                      <select
                        value={r.commissionMode}
                        onChange={(e) => updateReassureur(idx, { commissionMode: e.target.value as CommissionMode })}
                        className={fieldClass}
                      >
                        <option value={CommissionMode.CALCULABLE}>Calculable (taux × prime)</option>
                        <option value={CommissionMode.FORFAITAIRE}>Forfaitaire (montant fixe)</option>
                      </select>
                    </div>
                    {r.commissionMode === CommissionMode.CALCULABLE ? (
                      <div className="col-span-2">
                        <label className="block text-[11px] text-muted-foreground mb-1">Taux commission ARS (%)</label>
                        <input
                          type="number" step="0.0001" min="0" max="100"
                          value={r.tauxCommissionArs || 0}
                          onChange={(e) => updateReassureur(idx, { tauxCommissionArs: parseFloat(e.target.value) || 0 })}
                          className={fieldClass}
                        />
                      </div>
                    ) : (
                      <div className="col-span-2">
                        <label className="block text-[11px] text-muted-foreground mb-1">Commission forfaitaire (montant)</label>
                        <input
                          type="number" step="0.001"
                          value={r.commissionForfait || 0}
                          onChange={(e) => updateReassureur(idx, { commissionForfait: parseFloat(e.target.value) || 0 })}
                          className={fieldClass}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className={`flex items-center gap-2 rounded-xl border p-3 ${
                Math.abs(totalShare - 100) < 0.001
                  ? 'border-success/20 bg-success/10'
                  : 'border-warning/20 bg-warning/10'
              }`}>
                {Math.abs(totalShare - 100) < 0.001 && <CheckCircle2 size={15} className="text-success flex-shrink-0" />}
                <p className={`text-[13px] font-medium ${Math.abs(totalShare - 100) < 0.001 ? 'text-success' : 'text-warning'}`}>
                  Total des parts: {totalShare.toFixed(4)}% {Math.abs(totalShare - 100) >= 0.001 && '(doit être 100%)'}
                </p>
              </div>

              {errors.length > 0 && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[13px] font-medium text-destructive mb-1">Erreurs de validation:</p>
                      <ul className="text-[12px] text-destructive/90 space-y-1">
                        {errors.map((err, i) => <li key={i}>· {err}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border p-6">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/60"
          >
            <ChevronLeft size={16} />
            {step > 1 ? 'Précédent' : 'Annuler'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !validateStep1() : !validateStep2()}
              className="flex items-center gap-2 rounded-xl border border-primary-border bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="rounded-xl border border-primary-border bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutation.isPending ? 'Création...' : "Créer l'affaire"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}