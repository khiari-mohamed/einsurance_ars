
import { useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, AlertCircle, Plus, Trash2, CheckCircle2, Info } from 'lucide-react';
import { affairesApi } from '../../api/affaires.api';
import CountrySelect from '../../components/ui/CountrySelect';
import CurrencySelect from '../../components/ui/CurrencySelect';
import ReferenceSelect from '../../components/ui/ReferenceSelect';
import DecimalInput from '../../components/ui/DecimalInput';
import ReassureurRubriquesTable, { previewRows } from '../../components/affaires/ReassureurRubriquesTable';
import { extractApiErrors } from '../../lib/api-errors';
import { computeFacRubriques, effectiveRoe } from '../../lib/affaire-calc';
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
  prime100Pct: 0,
  tauxCommissionCedante: 0,
  isLeader: false,
  commissionMode: CommissionMode.CALCULABLE,
  tauxCommissionArs: 0,
});

const fieldClass =
  'w-full rounded-xl border border-border bg-secondary px-3 py-2 text-[13px] text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background';
const labelClass = 'block text-[12px] font-medium text-muted-foreground mb-1.5';
const calculatedFieldClass = 'w-full rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[13px] font-medium text-blue-900';
const calculatedLabelClass = 'block text-[12px] font-medium text-blue-800 mb-1.5';

/* ─── Reusable Section Wrapper ─── */
function SectionBlock({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card/50 p-4 ${className}`}>
      {title && <h4 className="text-[13px] font-semibold text-foreground mb-3">{title}</h4>}
      {children}
    </div>
  );
}

/* ─── Calculation Help Popover ─── */
function CalculationHelp({ id, activeId, onToggle, title, children }: {
  id: string;
  activeId: string | null;
  onToggle: (id: string | null) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex ml-1 align-middle">
      <button
        type="button"
        aria-label={`Explication : ${title}`}
        onClick={() => onToggle(id)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-blue-300 text-blue-700 hover:bg-blue-100"
      >
        <Info size={12} />
      </button>
      {activeId === id && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"
          role="presentation"
          onClick={() => onToggle(null)}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-blue-100 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-indigo-200 bg-indigo-700 px-5 py-4">
              <div>
                <p id={`${id}-title`} className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-[11px] text-indigo-100">Calcul automatique — valeur non saisissable</p>
              </div>
              <button type="button" onClick={() => onToggle(null)} aria-label="Fermer l'explication" className="rounded-lg p-1.5 text-white hover:bg-indigo-600">
                <X size={17} />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4 text-xs leading-5 text-slate-700">
              {children}
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-3">
              <button type="button" onClick={() => onToggle(null)} className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}

/* ─── Step Indicator ─── */
function StepIndicator({ current }: { current: number }) {
  const steps = [
    { num: 1, label: 'Informations Générales' },
    { num: 2, label: 'Données Contractuelles' },
    { num: 3, label: 'Réassureurs' },
  ];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <div key={s.num} className="flex items-center gap-2">
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
            s.num < current
              ? 'bg-primary text-primary-foreground'
              : s.num === current
                ? 'border-2 border-primary bg-primary/10 text-primary'
                : 'border border-border bg-secondary text-muted-foreground'
          }`}>
            {s.num < current ? <CheckCircle2 size={14} /> : s.num}
          </div>
          <span className={`text-[11px] font-medium ${s.num === current ? 'text-foreground' : 'text-muted-foreground'}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <div className="mx-1 h-px w-6 bg-border" />}
        </div>
      ))}
    </div>
  );
}

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
  const [nom, setNom] = useState('');
  const [renouvellementDetails, setRenouvellementDetails] = useState('');

  const [fac, setFac] = useState<Partial<import('../../types/affaire.types').FacultativeDataInput>>({
    reassuranceType: ReassuranceType.PROPORTIONNEL,
    assureId: '',
    dateEffet: '',
    dateEcheance: '',
  });
  const [guaranteeLines, setGuaranteeLines] = useState<GuaranteeLineInput[]>([
    { garantie: '', capitauxAssures100: 0 },
  ]);

  const [traite, setTraite] = useState<Partial<import('../../types/affaire.types').TraiteDataInput>>({
    reassuranceType: ReassuranceType.PROPORTIONNEL,
    periodicite: Periodicite.TRIMESTRIELLE,
    dateEffet: '',
    dateEcheance: '',
  });
  const [accountRubriques, setAccountRubriques] = useState<TreatyAccountRubriqueInput[]>([]);
  const [pmdInstalments, setPmdInstalments] = useState<PmdInstalmentInput[]>([]);

  const [reassureurs, setReassureurs] = useState<AffaireReassureurInput[]>([emptyReassureur()]);
  const [tauxCourtageDefault, setTauxCourtageDefault] = useState<number | undefined>(undefined);
  const [activeCalculationHelp, setActiveCalculationHelp] = useState<string | null>(null);
  const [tauxCourtageSelection, setTauxCourtageSelection] = useState('');
  const [customizedCourtageIndexes, setCustomizedCourtageIndexes] = useState<Set<number>>(new Set());

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

  const totalShare = reassureurs.reduce((sum, r) => sum + (r.partPct || 0), 0);
  const expectedShareTotal = type === AffaireType.FACULTATIVE ? Number(fac.tauxCession || 0) : 100;
  const shareOk = Math.abs(totalShare - expectedShareTotal) <= 0.001;
  const capitauxTotal = guaranteeLines.reduce((sum, line) => sum + Number(line.capitauxAssures100 || 0), 0);
  const reassureurOptions =
    queryClient.getQueryData<{ id: string; raisonSociale: string; code?: string }[]>(['reassureurs']) ?? [];
  const cedanteOptions =
    queryClient.getQueryData<{ id: string; raisonSociale: string }[]>(['cedantes']) ?? [];
  const rubriques =
    type === AffaireType.FACULTATIVE
      ? computeFacRubriques(
          Number(fac.prime100Pct ?? reassureurs[0]?.prime100Pct ?? 0),
          Number(fac.tauxCommissionCedante ?? reassureurs[0]?.tauxCommissionCedante ?? 0),
          reassureurs.map((r, i) => ({
            key: `row-${i}`,
            partPct: r.partPct,
            prime100Pct: r.prime100Pct,
            tauxCommissionCedante: r.tauxCommissionCedante,
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
    if (dateEffet && dateEcheance && new Date(dateEffet) > new Date(dateEcheance)) {
      issues.push("La date d'effet doit être antérieure ou égale à la date d'échéance");
    }
    if (type === AffaireType.FACULTATIVE) {
      if (!fac.assureId) issues.push("L'assuré est obligatoire");
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
      if (type === AffaireType.FACULTATIVE && !(Number(r.prime100Pct) > 0)) {
        errs.push(`La prime 100% est obligatoire pour le réassureur ${seen.size}`);
      }
      if (type === AffaireType.FACULTATIVE && (r.tauxCommissionCedante === undefined || r.tauxCommissionCedante === null)) {
        errs.push(`Le taux de commission cédante est obligatoire pour le réassureur ${seen.size}`);
      }
    }
    const dateEffet = type === AffaireType.FACULTATIVE ? fac.dateEffet : traite.dateEffet;
    const dateEcheance = type === AffaireType.FACULTATIVE ? fac.dateEcheance : traite.dateEcheance;
    if (dateEffet && dateEcheance && new Date(dateEffet) > new Date(dateEcheance)) {
      errs.push("La date d'effet doit être antérieure ou égale à la date d'échéance");
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
      ...(nom.trim() ? { nom: nom.trim() } : {}),
      ...(renouvellementDetails.trim() ? { renouvellementDetails: renouvellementDetails.trim() } : {}),
      reassureurs,
      ...(type === AffaireType.FACULTATIVE
        ? {
            facultativeData: {
              ...(fac as any),
              // Deprecated affaire-level columns are populated from the first
              // line for compatibility; calculations use line-level values.
              prime100Pct: fac.prime100Pct ?? reassureurs[0]?.prime100Pct ?? 0,
              tauxCommissionCedante: fac.tauxCommissionCedante
                ?? reassureurs[0]?.tauxCommissionCedante
                ?? 0,
              guaranteeLines: guaranteeLines.filter((line) => line.garantie.trim() || Number(line.capitauxAssures100) > 0),
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

  const addReassureur = () => setReassureurs((prev) => [
    ...prev,
    { ...emptyReassureur(), tauxCommissionArs: tauxCourtageDefault ?? 0 },
  ]);
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
        {/* ─── Header ─── */}
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

        {/* ─── Body ─── */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          <StepIndicator current={step} />

          {/* ═══════════════════════════════════════════════════════
              STEP 1 — Informations Générales
             ═══════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-5">
              <h3 className="text-[15px] font-semibold text-foreground">Informations Générales</h3>

              {/* — Type & Parties — */}
              <SectionBlock title="Type & Parties concernées">
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
                </div>
              </SectionBlock>

              {/* — Devise & Paiement — */}
              <SectionBlock title="Devise & Paiement">
                <div className="grid grid-cols-2 gap-4">
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
                </div>
              </SectionBlock>

              {/* — Informations complémentaires — */}
              <SectionBlock title="Informations complémentaires">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Nom de l'affaire <span className="font-normal text-muted-foreground/70">(optionnel)</span></label>
                    <input
                      type="text"
                      value={nom}
                      onChange={(event) => setNom(event.target.value)}
                      placeholder="Ex: Carte Incendie 2026"
                      className={fieldClass}
                    />
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
              </SectionBlock>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              STEP 2 — Facultative
             ═══════════════════════════════════════════════════════ */}
          {step === 2 && type === AffaireType.FACULTATIVE && (
            <div className="space-y-5">
              <h3 className="text-[15px] font-semibold text-foreground">Facultative — Données Contractuelles &amp; Financières</h3>

              {/* — Réassurance & Renouvellement — */}
              <SectionBlock title="Réassurance & Renouvellement">
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
                  {fac.modeRenouvellement === ModeRenouvellement.NEGOCIATION && (
                    <div className="col-span-2">
                      <label className={labelClass}>Détails de la négociation</label>
                      <textarea
                        value={renouvellementDetails}
                        onChange={(event) => setRenouvellementDetails(event.target.value)}
                        rows={3}
                        placeholder="Décrivez les conditions, interlocuteurs ou points à négocier. L'historique détaillé pourra être complété après création."
                        className={fieldClass}
                      />
                    </div>
                  )}
                </div>
              </SectionBlock>

              {/* — Période & Localisation — */}
              <SectionBlock title="Période & Localisation">
                <div className="grid grid-cols-2 gap-4">
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
                </div>
              </SectionBlock>

              {/* — Branche & Produit — */}
              <SectionBlock title="Branche & Produit">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Branche</label>
                    <input type="text" value={fac.branche || ''} onChange={(e) => setFac({ ...fac, branche: e.target.value })} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Produit</label>
                    <input type="text" value={fac.produit || ''} onChange={(e) => setFac({ ...fac, produit: e.target.value })} className={fieldClass} />
                  </div>
                </div>
                <div className="mt-4">
                  <label className={labelClass}>Garantie / Couverture</label>
                  <input
                    type="text"
                    value={fac.garantie || ''}
                    onChange={(e) => setFac({ ...fac, garantie: e.target.value })}
                    placeholder="Ex: Tous risques chantier"
                    className={fieldClass}
                  />
                </div>
              </SectionBlock>

              {/* — Capitaux assurés — */}
              <SectionBlock title="Capitaux assurés">
                <div className="mb-3">
                  <label className={calculatedLabelClass}>Total capitaux assurés <span className="font-normal text-blue-600">(total calculé des garanties)</span>
                    <CalculationHelp id="capitaux" activeId={activeCalculationHelp} onToggle={setActiveCalculationHelp} title="Capitaux assurés">
                      <p>Somme des montants saisis dans les lignes « Capitaux assurés par garantie ».</p>
                      <p className="mt-1">Exemple : Incendie 100 000 + Dégâts des eaux 50 000 = 150 000.</p>
                      <p className="mt-1">Ajoutez ou modifiez une ligne pour actualiser automatiquement le total.</p>
                    </CalculationHelp>
                  </label>
                  <input type="text" value={capitauxTotal.toFixed(3)} readOnly className={`max-w-xs ${calculatedFieldClass}`} />
                </div>
                <div className="border-t border-border pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[12px] font-medium text-muted-foreground">Libellé et montant par ligne</h4>
                    <button type="button" onClick={addGuaranteeLine} className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80">
                      <Plus size={13} /> Ajouter une ligne
                    </button>
                  </div>
                  {guaranteeLines.map((g, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-2">
                      <input placeholder="Libellé de la ligne" value={g.garantie} onChange={(e) => updateGuaranteeLine(idx, { garantie: e.target.value })} className={`flex-1 ${fieldClass}`} />
                      <DecimalInput value={g.capitauxAssures100 || undefined} onChange={(value) => updateGuaranteeLine(idx, { capitauxAssures100: value ?? 0 })} placeholder="Capitaux assurés 100%" className={`w-40 ${fieldClass}`} />
                      <button type="button" onClick={() => removeGuaranteeLine(idx)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </SectionBlock>

              {/* — Taux — */}
              <SectionBlock title="Primes & Taux de cession">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Taux Prime (%) <span className="font-normal text-muted-foreground/70">(optionnel)</span></label>
                    <DecimalInput value={fac.tauxPrime} onChange={(value) => setFac({ ...fac, tauxPrime: value })} className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Taux Cession (%) *</label>
                    <DecimalInput value={fac.tauxCession} onChange={(value) => setFac({ ...fac, tauxCession: value })} placeholder="Ex: 15" className={fieldClass} required />
                  </div>
                </div>
              </SectionBlock>
              <SectionBlock title="Courtage">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Taux de commission de courtage</label>
                    <select
                      value={tauxCourtageSelection}
                      onChange={(event) => {
                        const selection = event.target.value;
                        setTauxCourtageSelection(selection);
                        if (selection !== 'autre') {
                          const value = selection ? Number(selection) : undefined;
                          setTauxCourtageDefault(value);
                          setReassureurs((prev) => prev.map((r, index) => (
                            r.commissionMode === CommissionMode.CALCULABLE
                              && !customizedCourtageIndexes.has(index)
                              ? { ...r, tauxCommissionArs: value ?? 0 }
                              : r
                          )));
                        } else {
                          setTauxCourtageDefault(undefined);
                        }
                      }}
                      className={fieldClass}
                    >
                      <option value="">Sélectionner un taux</option>
                      <option value="4">4 %</option>
                      <option value="5">5 %</option>
                      <option value="7.5">7,5 %</option>
                      <option value="10">10 %</option>
                      <option value="autre">Autre taux</option>
                    </select>
                    {tauxCourtageSelection === 'autre' && (
                      <div className="mt-2">
                        <label className="block text-[11px] text-muted-foreground mb-1">Autre taux (%)</label>
                        <DecimalInput
                          value={tauxCourtageDefault}
                          onChange={(value) => {
                            setTauxCourtageDefault(value);
                            setReassureurs((prev) => prev.map((r, index) => (
                              r.commissionMode === CommissionMode.CALCULABLE
                                && !customizedCourtageIndexes.has(index)
                                ? { ...r, tauxCommissionArs: value ?? 0 }
                                : r
                            )));
                          }}
                          placeholder="Ex: 7,5"
                          className={fieldClass}
                        />
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      Le taux est saisi ici et appliqué aux réassureurs calculables.
                    </p>
                  </div>
                  <div>
                    <label className={calculatedLabelClass}>Commission de courtage <span className="font-normal text-blue-600">(calculée automatiquement)</span>
                      <CalculationHelp id="courtage" activeId={activeCalculationHelp} onToggle={setActiveCalculationHelp} title="Commission de courtage">
                        <p>Formule par réassureur : Prime cédée de sa part × Taux ARS ÷ 100.</p>
                        <p className="mt-1">Exemple communiqué : Prime 100 % 569 335,494, part 5 % et taux ARS 7,5 %.</p>
                        <p className="mt-1">569 335,494 × 5 % = 28 466,775 (avant arrondi) ; × 7,5 % = 2 135,008.</p>
                        <p className="mt-1">Le total additionne les commissions des réassureurs calculables. Une commission forfaitaire utilise le montant saisi, sans cette formule.</p>
                      </CalculationHelp>
                    </label>
                    <input
                      type="text"
                      value={(rubriques?.totals.commissionArs ?? 0).toFixed(3)}
                      readOnly
                      className={calculatedFieldClass}
                    />
                  </div>
                </div>
              </SectionBlock>

            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              STEP 2 — Traité
             ═══════════════════════════════════════════════════════ */}
          {step === 2 && type === AffaireType.TRAITE && (
            <div className="space-y-5">
              <h3 className="text-[15px] font-semibold text-foreground">Traité — Données Contractuelles &amp; Financières</h3>
              <p className="rounded-xl border border-[hsl(var(--chart-5)/0.25)] bg-[hsl(var(--chart-5)/0.08)] px-3 py-2 text-[12px] text-foreground">
                Parcours Traité : la périodicité pilote les situations et le seuil de notification concerne les sinistres.
              </p>

              {/* — Identification du traité — */}
              <SectionBlock title="Identification du traité">
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
                </div>
              </SectionBlock>

              {/* — Période & Renouvellement — */}
              <SectionBlock title="Période & Renouvellement">
                <div className="grid grid-cols-2 gap-4">
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
                  {traite.modeRenouvellement === ModeRenouvellement.NEGOCIATION && (
                    <div className="col-span-2">
                      <label className={labelClass}>Détails de la négociation</label>
                      <textarea
                        value={renouvellementDetails}
                        onChange={(event) => setRenouvellementDetails(event.target.value)}
                        rows={3}
                        placeholder="Décrivez les conditions, interlocuteurs ou points à négocier."
                        className={fieldClass}
                      />
                    </div>
                  )}
                  <div>
                    <label className={labelClass}>Date avis résiliation</label>
                    <input type="date" value={traite.dateAvisResiliation || ''} onChange={(e) => setTraite({ ...traite, dateAvisResiliation: e.target.value })} className={fieldClass} />
                  </div>
                </div>
              </SectionBlock>

              {/* — Zone & Classification — */}
              <SectionBlock title="Zone géographique & Classification">
                <div className="grid grid-cols-2 gap-4">
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
                </div>
              </SectionBlock>

              {/* — Données financières — */}
              <SectionBlock title="Données financières">
                <div className="grid grid-cols-2 gap-4">
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
                    <DecimalInput value={traite.seuilNotification} onChange={(value) => setTraite({ ...traite, seuilNotification: value })} className={`max-w-sm ${fieldClass}`} />
                    <p className="mt-1 text-[11px] text-muted-foreground/70">Montant au-delà duquel les réassureurs proportionnels doivent être notifiés (avis de sinistre)</p>
                  </div>
                </div>
              </SectionBlock>

              {/* — Rubriques comptables — */}
              <SectionBlock title="Rubriques comptables">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] text-muted-foreground">Définissez les rubriques et comptes de référence associés.</p>
                  <button type="button" onClick={addRubrique} className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80">
                    <Plus size={13} /> Ajouter une rubrique
                  </button>
                </div>
                {accountRubriques.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/60 italic">Aucune rubrique ajoutée.</p>
                )}
                {accountRubriques.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input placeholder="Rubrique (ex: Incendie)" value={r.rubrique} onChange={(e) => updateRubrique(idx, { rubrique: e.target.value })} className={`flex-1 ${fieldClass}`} />
                    <input placeholder="Compte de référence" value={r.compteReference} onChange={(e) => updateRubrique(idx, { compteReference: e.target.value })} className={`flex-1 font-mono ${fieldClass}`} />
                    <button type="button" onClick={() => removeRubrique(idx)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                  </div>
                ))}
              </SectionBlock>

              {/* — Échéancier PMD — */}
              <SectionBlock title="Échéancier PMD">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] text-muted-foreground">Planifiez les tranches de paiement de la Prime Minimum et Dépôt.</p>
                  <button type="button" onClick={addInstalment} className="flex items-center gap-1 text-[12px] font-medium text-primary hover:text-primary/80">
                    <Plus size={13} /> Ajouter une tranche
                  </button>
                </div>
                {pmdInstalments.length === 0 && (
                  <p className="text-[11px] text-muted-foreground/60 italic">Aucune tranche ajoutée.</p>
                )}
                {pmdInstalments.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-2 mb-2">
                    <input type="number" placeholder="N° tranche" value={p.numeroTranche} onChange={(e) => updateInstalment(idx, { numeroTranche: parseInt(e.target.value) || 1 })} className={`w-24 ${fieldClass}`} />
                    <input type="date" value={p.dateEcheance} onChange={(e) => updateInstalment(idx, { dateEcheance: e.target.value })} className={`flex-1 ${fieldClass}`} />
                    <DecimalInput value={p.montant || undefined} onChange={(value) => updateInstalment(idx, { montant: value ?? 0 })} placeholder="Montant" className={`flex-1 ${fieldClass}`} />
                    <DecimalInput value={p.tauxDeduction} onChange={(value) => updateInstalment(idx, { tauxDeduction: value })} placeholder="Taux déduction %" className={`w-32 ${fieldClass}`} />
                    <button type="button" onClick={() => removeInstalment(idx)} className="rounded-lg p-2 text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                  </div>
                ))}
              </SectionBlock>
            </div>
          )}

          {/* ─── Step 2 validation issues ─── */}
          {step === 2 && step2Issues().length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl border border-warning/25 bg-warning/10 p-3 text-[12px] text-foreground">
              <li className="font-medium">Pour continuer :</li>
              {step2Issues().map((issue) => <li key={issue}>· {issue}</li>)}
            </ul>
          )}

          {/* ═══════════════════════════════════════════════════════
              STEP 3 — Réassureurs
             ═══════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground">Table de participation des Réassureurs</h3>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {type === AffaireType.FACULTATIVE
                      ? 'Commission calculée sur la prime cédée.'
                      : 'Commission calculée sur la prime nette cédante du traité.'}
                  </p>
                </div>
                <button type="button" onClick={addReassureur} className="flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary/80">
                  <Plus size={14} /> Ajouter un réassureur
                </button>
              </div>

              {/* ─── Reassureur cards ─── */}
              {reassureurs.map((r, idx) => (
                <SectionBlock key={idx}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-semibold text-foreground">Réassureur {idx + 1}</span>
                    <button type="button" onClick={() => removeReassureur(idx)} className="flex items-center gap-1 text-[12px] text-destructive hover:text-destructive/80">
                      <Trash2 size={12} /> Supprimer
                    </button>
                  </div>

                  {/* Row 1: Identity & Part */}
                  <div className="grid grid-cols-12 gap-3 mb-3">
                    <div className="col-span-5">
                      <label className={labelClass}>Réassureur *</label>
                      <ReferenceSelect
                        kind="reassureur"
                        value={r.reassureurId}
                        onChange={(id) => updateReassureur(idx, { reassureurId: id })}
                        required
                      />
                    </div>
                    <div className="col-span-3">
                      <label className={labelClass}>{type === AffaireType.FACULTATIVE ? 'Part placée (%)' : 'Part (%)'}</label>
                      <DecimalInput
                        value={r.partPct || undefined}
                        onChange={(value) => updateReassureur(idx, { partPct: value ?? 0 })}
                        placeholder="Ex: 5"
                        className={fieldClass}
                      />
                      <DecimalInput
                        value={r.prime100Pct || undefined}
                        onChange={(value) => updateReassureur(idx, { prime100Pct: value ?? 0 })}
                        placeholder="Prime 100%"
                        className={fieldClass}
                      />
                    </div>
                    <div className="col-span-4 flex items-end pb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!r.isLeader}
                          onChange={(e) => updateReassureur(idx, { isLeader: e.target.checked })}
                          className="h-4 w-4 rounded border-border accent-primary"
                        />
                        <span className="text-[12px] text-muted-foreground">Leader / Apériteur</span>
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Commission cédante</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-muted-foreground mb-1">Taux cédante (%)</label>
                        <DecimalInput
                          value={r.tauxCommissionCedante}
                          onChange={(value) => updateReassureur(idx, { tauxCommissionCedante: value ?? 0 })}
                          placeholder="Ex: 30"
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-blue-800 mb-1">Commission cédante (calculée)</label>
                        <input type="text" readOnly value={rubriques?.lines[idx]?.commissionCedante?.toFixed(3) ?? '—'} className={calculatedFieldClass} />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Commission */}
                  <div className="border-t border-border pt-3">
                    <p className="text-[11px] font-medium text-muted-foreground mb-2 uppercase tracking-wide">Commission</p>
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
                        <>
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">Taux commission courtage (%)</label>
                            <DecimalInput
                              value={r.tauxCommissionArs}
                              onChange={(value) => {
                                setCustomizedCourtageIndexes((previous) => new Set(previous).add(idx));
                                updateReassureur(idx, { tauxCommissionArs: value ?? 0 });
                              }}
                              placeholder="Taux personnalisé (%)"
                              className={fieldClass}
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-muted-foreground mb-1">Commission de courtage (calculée)</label>
                            <input type="text" value={rubriques?.lines[idx]?.commissionArs?.toFixed(3) ?? '—'} disabled className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-muted-foreground" />
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2">
                          <label className="block text-[11px] text-muted-foreground mb-1">Commission forfaitaire (montant)</label>
                          <DecimalInput value={r.commissionForfait || undefined} onChange={(value) => updateReassureur(idx, { commissionForfait: value ?? 0 })} className={fieldClass} />
                        </div>
                      )}
                    </div>
                  </div>
                </SectionBlock>
              ))}

              {/* ─── Share total indicator ─── */}
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

              {/* ─── Preview table ─── */}
              {type === AffaireType.FACULTATIVE && rubriques && (
                <SectionBlock title="Aperçu des rubriques par réassureur">
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
                          tauxCommissionCedante: r.tauxCommissionCedante,
                          tauxCommissionArs: r.tauxCommissionArs,
                        };
                      }),
                    )}
                    totals={rubriques.totals}
                    compagnie={cedanteOptions.find((option) => option.id === cedanteId)?.raisonSociale ?? ''}
                    type={typeLabels[AffaireType.FACULTATIVE]}
                    cover=""
                    dateEffet={fac.dateEffet}
                    dateExpiration={fac.dateEcheance}
                    chargeDossier={chargeDossier}
                    currency={currency}
                    roe={effectiveRoe(currency, roe)}
                    prime100Pct={Number(fac.prime100Pct ?? reassureurs[0]?.prime100Pct ?? 0)}
                    tauxCommissionCedante={Number(fac.tauxCommissionCedante ?? reassureurs[0]?.tauxCommissionCedante ?? 0)}
                  />
                </SectionBlock>
              )}

              {/* ─── Validation errors ─── */}
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

        {/* ─── Footer ─── */}
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