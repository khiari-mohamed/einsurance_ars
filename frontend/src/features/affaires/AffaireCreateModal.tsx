import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, AlertCircle, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { affairesApi } from '../../api/affaires.api';
import CountrySelect from '../../components/ui/CountrySelect';
import CurrencySelect from '../../components/ui/CurrencySelect';
import ReferenceSelect from '../../components/ui/ReferenceSelect';
import DecimalInput from '../../components/ui/DecimalInput';
import ReassureurRubriquesTable, { previewRows } from '../../components/affaires/ReassureurRubriquesTable';
import { extractApiErrors } from '../../lib/api-errors';
import { computeFacRubriques, effectiveRoe, round3 } from '../../lib/affaire-calc';
import {
  CreateAffaireDto, AffaireType, ModePaiement, ReassuranceType, FormeCouverture,
  ModeRenouvellement, Periodicite, CommissionMode, AffaireReassureurInput,
  GuaranteeLineInput, TreatyAccountRubriqueInput, PmdInstalmentInput,
  typeLabels, reassuranceTypeLabels, formeCouvertureLabels, periodiciteLabels,
  modeRenouvellementLabels,
} from '../../types/affaire.types';

interface Props {
  onClose: () => void;
  initialType?: AffaireType;
  lockType?: boolean;
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

export default function AffaireCreateModal({ onClose, initialType = AffaireType.FACULTATIVE, lockType = false }: Props) {
  const [step, setStep] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [type, setType] = useState<AffaireType>(initialType);
  const [cedanteId, setCedanteId] = useState('');
  const [modePaiement, setModePaiement] = useState<ModePaiement>(ModePaiement.PAR_AFFAIRE);
  const [currency, setCurrency] = useState('TND');
  const [roe, setRoe] = useState<number | undefined>(undefined);
  const [chargeDossier, setChargeDossier] = useState('');

  const [fac, setFac] = useState<Partial<import('../../types/affaire.types').FacultativeDataInput>>({
    reassuranceType: ReassuranceType.PROPORTIONNEL,
    assureId: '',
    dateEffet: '',
    dateEcheance: '',
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



  const mutation = useMutation({
    mutationFn: (data: CreateAffaireDto) => affairesApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['affaires'] });
      onClose();
      const newId = (res as any)?.data?.id;
      if (newId) navigate(`/affaires/${newId}`);
    },
    onError: (error: any) => setErrors(extractApiErrors(error, 'Erreur lors de la création')),
  });

  const primeCedeeCalc =
    type === AffaireType.FACULTATIVE
      ? Number(fac.prime100Pct || 0) * (Number(fac.tauxCession || 0) / 100)
      : Number(traite.primePrevisionnelle || 0);

  const totalShare = reassureurs.reduce((sum, r) => sum + (r.partPct || 0), 0);
  const expectedShareTotal = type === AffaireType.FACULTATIVE ? Number(fac.tauxCession || 0) : 100;
  const shareOk = Math.abs(totalShare - expectedShareTotal) <= 0.001;
  const capitauxTotal = guaranteeLines.reduce((sum, line) => sum + Number(line.capitauxAssures100 || 0), 0);
  const commissionCedanteCalc = round3(
    Number(fac.prime100Pct || 0) *
      (Number(fac.tauxCession || 0) / 100) *
      (Number(fac.tauxCommissionCedante || 0) / 100),
  );
  const reassureurOptions =
    queryClient.getQueryData<{ id: string; raisonSociale: string; code?: string }[]>(['reassureurs']) ?? [];
  const cedanteOptions =
    queryClient.getQueryData<{ id: string; raisonSociale: string }[]>(['cedantes']) ?? [];
  const rubriques =
    type === AffaireType.FACULTATIVE
      ? computeFacRubriques(
          Number(fac.prime100Pct || 0),
          Number(fac.tauxCommissionCedante || 0),
          reassureurs.map((r, i) => ({
            key: `row-${i}`,
            partPct: r.partPct,
            commissionMode: r.commissionMode,
            tauxCommissionArs: r.tauxCommissionArs,
            commissionForfait: r.commissionForfait,
          })),
        )
      : null;

  const validateStep1 = () => {
    if (!cedanteId) return false;
    if (type === AffaireType.FACULTATIVE && !fac.assureId) return false;
    return true;
  };
  const step2Issues = (): string[] => {
    const issues: string[] = [];
    const dateEffet = type === AffaireType.FACULTATIVE ? fac.dateEffet : traite.dateEffet;
    const dateEcheance = type === AffaireType.FACULTATIVE ? fac.dateEcheance : traite.dateEcheance;
    if (!dateEffet) issues.push("La date d'effet est obligatoire");
    if (!dateEcheance) issues.push("La date d'échéance est obligatoire");
    if (dateEffet && dateEcheance && new Date(dateEffet) >= new Date(dateEcheance)) {
      issues.push("La date d'effet doit être antérieure à la date d'échéance");
    }
    if (type === AffaireType.FACULTATIVE) {
      if (!fac.assureId) issues.push("L'assuré est obligatoire");
      if (!(Number(fac.prime100Pct) > 0)) issues.push('La prime à 100% doit être supérieure à 0');
      const tauxCession = Number(fac.tauxCession ?? 0);
      if (!(tauxCession > 0 && tauxCession <= 100)) {
        issues.push('Le taux de cession doit être compris entre 0 et 100');
      }
    } else if (!traite.periodicite) {
      issues.push('La périodicité est obligatoire');
    }
    return issues;
  };
  const validateStep2 = () => step2Issues().length === 0;

  const validateFinal = (): boolean => {
    const errs: string[] = [];
    if (!shareOk) {
      errs.push(
        type === AffaireType.FACULTATIVE
          ? `La somme des parts placées doit être égale au taux de cession (${expectedShareTotal}%)`
          : 'La somme des participations des réassureurs doit être 100%',
      );
    }
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
      ...(currency !== 'TND' && roe !== undefined ? { roe } : {}),
      ...(chargeDossier.trim() ? { chargeDossier: chargeDossier.trim() } : {}),
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
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AffaireType)}
                    disabled={lockType}
                    className={`${fieldClass} ${lockType ? 'cursor-not-allowed bg-muted text-muted-foreground opacity-80' : ''}`}
                  >
                    {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  {lockType && <p className="mt-1 text-[11px] text-muted-foreground">Type fixé par le parcours sélectionné.</p>}
                </div>
                <div>
                  <label className={labelClass}>Cédante *</label>
                  <ReferenceSelect kind="cedante" value={cedanteId} onChange={setCedanteId} required />
                </div>
                {type === AffaireType.FACULTATIVE && (
                  <div>
                    <label className={labelClass}>Assuré *</label>
                    <ReferenceSelect
                      kind="assure"
                      value={fac.assureId || ''}
                      onChange={(id) => setFac({ ...fac, assureId: id })}
                      required
                    />
                  </div>
                )}
                <div>
                  <label className={labelClass}>Devise</label>
                  <CurrencySelect value={currency} onChange={setCurrency} placeholder="Sélectionner une devise..." />
                </div>
                {currency !== 'TND' && (
                  <div>
                    <label className={labelClass}>ROE — taux de change vers TND</label>
                    <DecimalInput value={roe} onChange={setRoe} placeholder="Ex: 3,350000" className={fieldClass} />
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      Sert au calcul des montants en DT. Sans ROE, les colonnes DT restent vides.
                    </p>
                  </div>
                )}
                <div>
                  <label className={labelClass}>Mode de paiement</label>
                  <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value as ModePaiement)} className={fieldClass}>
                    <option value={ModePaiement.PAR_AFFAIRE}>Par Affaire (hors situation)</option>
                    <option value={ModePaiement.PAR_SITUATION}>Par Situation (inclus)</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Chargé de dossier</label>
                  <input
                    type="text"
                    value={chargeDossier}
                    onChange={(event) => setChargeDossier(event.target.value)}
                    placeholder="Ex: Manel"
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && type === AffaireType.FACULTATIVE && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-foreground mb-4">Facultative — Données Contractuelles &amp; Financières</h3>
              <p className="rounded-xl border border-[hsl(var(--chart-4)/0.25)] bg-[hsl(var(--chart-4)/0.08)] px-3 py-2 text-[12px] text-foreground">
                Parcours Facultative : la prime cédée est calculée à partir de la prime 100% et du taux de cession.
              </p>
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
                  <DecimalInput value={fac.prime100Pct} onChange={(value) => setFac({ ...fac, prime100Pct: value })} placeholder="0,000" className={fieldClass} required />
                </div>
                <div>
                  <label className={labelClass}>Taux Prime (%)</label>
                  <DecimalInput value={fac.tauxPrime} onChange={(value) => setFac({ ...fac, tauxPrime: value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Taux Cession (%) *</label>
                  <DecimalInput value={fac.tauxCession} onChange={(value) => setFac({ ...fac, tauxCession: value })} placeholder="Ex: 15" className={fieldClass} required />
                </div>
                <div>
                  <label className={labelClass}>Prime Cédée (calculée)</label>
                  <input type="text" value={primeCedeeCalc.toFixed(3)} disabled className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground" />
                </div>
                <div>
                  <label className={labelClass}>Taux Commission Cédante (%)</label>
                  <DecimalInput value={fac.tauxCommissionCedante} onChange={(value) => setFac({ ...fac, tauxCommissionCedante: value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Commission Cédante (calculée)</label>
                  <input type="text" value={commissionCedanteCalc.toFixed(3)} disabled className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground" />
                </div>
                <div>
                  <label className={labelClass}>Capitaux assurés (total des garanties)</label>
                  <input type="text" value={capitauxTotal.toFixed(3)} disabled className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground" />
                </div>
                <div>
                  <label className={labelClass}>Commission de courtage (total)</label>
                  <input type="text" value={(rubriques?.totals.commissionArs ?? 0).toFixed(3)} disabled className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground" />
                </div>
                <p className="col-span-2 text-[11px] text-muted-foreground/70">
                  Le taux et le montant de courtage se saisissent par réassureur à l'étape 3.
                </p>
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
                    <DecimalInput value={g.capitauxAssures100 || undefined} onChange={(value) => updateGuaranteeLine(idx, { capitauxAssures100: value ?? 0 })} placeholder="Capitaux 100%" className={`w-40 ${fieldClass}`} />
                    <button type="button" onClick={() => removeGuaranteeLine(idx)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && type === AffaireType.TRAITE && (
            <div className="space-y-4">
              <h3 className="text-[15px] font-semibold text-foreground mb-4">Traité — Données Contractuelles &amp; Financières</h3>
              <p className="rounded-xl border border-[hsl(var(--chart-5)/0.25)] bg-[hsl(var(--chart-5)/0.08)] px-3 py-2 text-[12px] text-foreground">
                Parcours Traité : la périodicité pilote les situations et le seuil de notification concerne les sinistres.
              </p>
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
                  <DecimalInput value={traite.primePrevisionnelle} onChange={(value) => setTraite({ ...traite, primePrevisionnelle: value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>PMD (Prime Minimum et Dépôt)</label>
                  <DecimalInput value={traite.pmd} onChange={(value) => setTraite({ ...traite, pmd: value })} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>Taux Commission Cédante (%)</label>
                  <DecimalInput value={traite.tauxCommissionCedante} onChange={(value) => setTraite({ ...traite, tauxCommissionCedante: value })} className={fieldClass} />
                </div>
                                <div>
                  <label className={labelClass}>
                    Commission Liquidation ARS
                    <span className="ml-1 font-normal text-muted-foreground/60">(saisie manuelle)</span>
                  </label>
                  <DecimalInput value={traite.commissionLiquidationArs} onChange={(value) => setTraite({ ...traite, commissionLiquidationArs: value })} className={fieldClass} />
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    Montant fixe saisi manuellement — non calculé automatiquement (distinct de la commission de courtage par réassureur, définie à l'étape 3).
                  </p>
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Seuil de notification sinistre</label>
                  <DecimalInput value={traite.seuilNotification} onChange={(value) => setTraite({ ...traite, seuilNotification: value })} className={fieldClass} />
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
                    <DecimalInput value={p.montant || undefined} onChange={(value) => updateInstalment(idx, { montant: value ?? 0 })} placeholder="Montant" className={`flex-1 ${fieldClass}`} />
                    <DecimalInput value={p.tauxDeduction} onChange={(value) => updateInstalment(idx, { tauxDeduction: value })} placeholder="Taux déduction %" className={`w-32 ${fieldClass}`} />
                    <button type="button" onClick={() => removeInstalment(idx)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 2 && step2Issues().length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl border border-warning/25 bg-warning/10 p-3 text-[12px] text-foreground">
              <li className="font-medium">Pour continuer :</li>
              {step2Issues().map((issue) => <li key={issue}>· {issue}</li>)}
            </ul>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground">Table de participation des Réassureurs</h3>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {type === AffaireType.FACULTATIVE
                      ? 'Commission calculée sur la prime cédée.'
                      : 'Commission calculée sur la prime nette cédante du traité.'}
                  </p>
                </div>
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
                      <ReferenceSelect
                        kind="reassureur"
                        value={r.reassureurId}
                        onChange={(id) => updateReassureur(idx, { reassureurId: id })}
                        required
                      />
                    </div>
                    <div>
                      <DecimalInput
                        value={r.partPct || undefined}
                        onChange={(value) => updateReassureur(idx, { partPct: value ?? 0 })}
                        placeholder={type === AffaireType.FACULTATIVE ? 'Part placée %' : 'Part %'}
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
                        <label className="block text-[11px] text-muted-foreground mb-1">Taux commission courtage (%)</label>
                        <DecimalInput value={r.tauxCommissionArs || undefined} onChange={(value) => updateReassureur(idx, { tauxCommissionArs: value ?? 0 })} className={fieldClass} />
                      </div>
                    ) : (
                      <div className="col-span-2">
                        <label className="block text-[11px] text-muted-foreground mb-1">Commission forfaitaire (montant)</label>
                        <DecimalInput value={r.commissionForfait || undefined} onChange={(value) => updateReassureur(idx, { commissionForfait: value ?? 0 })} className={fieldClass} />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className={`flex items-center gap-2 rounded-xl border p-3 ${
                shareOk
                  ? 'border-success/20 bg-success/10'
                  : 'border-warning/20 bg-warning/10'
              }`}>
                {shareOk && <CheckCircle2 size={15} className="text-success flex-shrink-0" />}
                <p className={`text-[13px] font-medium ${shareOk ? 'text-success' : 'text-warning'}`}>
                  Total des parts: {totalShare.toFixed(4)}% {!shareOk && `(doit être ${expectedShareTotal}%)`}
                </p>
              </div>

              {type === AffaireType.FACULTATIVE && rubriques && Number(fac.prime100Pct) > 0 && (
                <ReassureurRubriquesTable
                  rows={previewRows(
                    rubriques.lines,
                    reassureurs.map((r) => {
                      const option = reassureurOptions.find((item) => item.id === r.reassureurId);
                      return {
                        label: option?.raisonSociale ?? '—',
                        code: option?.code,
                        isLeader: r.isLeader,
                        commissionMode: r.commissionMode,
                        tauxCommissionArs: r.tauxCommissionArs,
                      };
                    }),
                  )}
                  totals={rubriques.totals}
                  compagnie={cedanteOptions.find((option) => option.id === cedanteId)?.raisonSociale ?? ''}
                  type={typeLabels[AffaireType.FACULTATIVE]}
                  cover={fac.garantie || ''}
                  dateEffet={fac.dateEffet}
                  dateExpiration={fac.dateEcheance}
                  chargeDossier={chargeDossier}
                  currency={currency}
                  roe={effectiveRoe(currency, roe)}
                  prime100Pct={Number(fac.prime100Pct || 0)}
                  tauxCommissionCedante={Number(fac.tauxCommissionCedante || 0)}
                />
              )}

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