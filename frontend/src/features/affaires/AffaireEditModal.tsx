import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Save, AlertCircle, Plus, Trash2 } from 'lucide-react';
import CountrySelect from '../../components/ui/CountrySelect';
import ReferenceSelect from '../../components/ui/ReferenceSelect';
import CurrencySelect from '../../components/ui/CurrencySelect';
import DecimalInput from '../../components/ui/DecimalInput';
import ReassureurRubriquesTable, { previewRows } from '../../components/affaires/ReassureurRubriquesTable';
import { affairesApi } from '../../api/affaires.api';
import { extractApiErrors } from '../../lib/api-errors';
import { computeFacRubriques, effectiveRoe, round3 } from '../../lib/affaire-calc';
import {
  Affaire, AffaireType, UpdateAffaireDto, AffaireReassureurInput, CommissionMode,
  GuaranteeLineInput, ReassuranceType, ModeRenouvellement, FormeCouverture, Periodicite,
  typeLabels, reassuranceTypeLabels, modeRenouvellementLabels, formeCouvertureLabels, periodiciteLabels,
} from '../../types/affaire.types';

interface Props {
  affaire: Affaire;
  onClose: () => void;
}

export default function AffaireEditModal({ affaire, onClose }: Props) {
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<string[]>([]);

  const [modePaiement, setModePaiement] = useState(affaire.modePaiement);
  const [currency, setCurrency] = useState(affaire.currency);
  const [roe, setRoe] = useState<number | undefined>(affaire.roe != null ? Number(affaire.roe) : undefined);
  const [chargeDossier, setChargeDossier] = useState(affaire.chargeDossier ?? '');
  const num = (value: unknown): number | undefined =>
    value === null || value === undefined || value === '' ? undefined : Number(value);

  const [fac, setFac] = useState(
    affaire.facultativeData
      ? {
          ...affaire.facultativeData,
          prime100Pct: Number(affaire.facultativeData.prime100Pct),
          tauxCession: Number(affaire.facultativeData.tauxCession),
          tauxPrime: num(affaire.facultativeData.tauxPrime),
          tauxCommissionCedante: num(affaire.facultativeData.tauxCommissionCedante),
        }
      : null,
  );
  const [guaranteeLines, setGuaranteeLines] = useState<GuaranteeLineInput[]>(
    affaire.facultativeData?.guaranteeLines?.map((g) => ({
      garantie: g.garantie,
      capitauxAssures100: Number(g.capitauxAssures100),
      ordre: g.ordre,
    })) || []
  );

  const [traite, setTraite] = useState(
    affaire.traiteData
      ? {
          ...affaire.traiteData,
          primePrevisionnelle: num(affaire.traiteData.primePrevisionnelle),
          pmd: num(affaire.traiteData.pmd),
          tauxCommissionCedante: num(affaire.traiteData.tauxCommissionCedante),
          commissionLiquidationArs: num(affaire.traiteData.commissionLiquidationArs),
          seuilNotification: num(affaire.traiteData.seuilNotification),
        }
      : null,
  );

  const [reassureurs, setReassureurs] = useState<AffaireReassureurInput[]>(
    affaire.reassureurs.map((r) => ({
      reassureurId: r.reassureurId,
      partPct: Number(r.partPct),
      isLeader: r.isLeader,
      commissionMode: r.commissionMode,
      tauxCommissionArs: num(r.tauxCommissionArs),
      commissionForfait: num(r.commissionForfait),
    }))
  );

  const mutation = useMutation({
    mutationFn: (data: UpdateAffaireDto) => affairesApi.update(affaire.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affaire', affaire.id] });
      queryClient.invalidateQueries({ queryKey: ['affaires'] });
      onClose();
    },
    onError: (error: any) => setErrors(extractApiErrors(error, 'Erreur lors de la modification')),
  });

  const totalShare = reassureurs.reduce((sum, r) => sum + (r.partPct || 0), 0);
  const expectedShareTotal =
    affaire.type === AffaireType.FACULTATIVE ? Number(fac?.tauxCession || 0) : 100;
  const shareOk = Math.abs(totalShare - expectedShareTotal) <= 0.001;
  const reassureurOptions =
    queryClient.getQueryData<{ id: string; raisonSociale: string; code?: string }[]>(['reassureurs']) ?? [];
  const rubriques =
    affaire.type === AffaireType.FACULTATIVE && fac
      ? computeFacRubriques(
          Number(fac.prime100Pct || 0),
          Number(fac.tauxCommissionCedante || 0),
          reassureurs.map((r, index) => ({
            key: `row-${index}`,
            partPct: r.partPct,
            commissionMode: r.commissionMode,
            tauxCommissionArs: r.tauxCommissionArs,
            commissionForfait: r.commissionForfait,
          })),
        )
      : null;
  const commissionCedanteCalc = fac
    ? round3(
        Number(fac.prime100Pct || 0) *
          (Number(fac.tauxCession || 0) / 100) *
          (Number(fac.tauxCommissionCedante || 0) / 100),
      )
    : 0;
  const capitauxAssuresTotal = guaranteeLines.reduce(
    (total, line) => total + Number(line.capitauxAssures100 || 0),
    0,
  );

  const validateForm = (): boolean => {
    const errs: string[] = [];
    if (!shareOk) {
      errs.push(
        affaire.type === AffaireType.FACULTATIVE
          ? `La somme des parts placées doit être égale au taux de cession (${expectedShareTotal}%)`
          : 'La somme des participations doit être 100%',
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
    const dateEffet = affaire.type === AffaireType.FACULTATIVE ? fac?.dateEffet : traite?.dateEffet;
    const dateEcheance = affaire.type === AffaireType.FACULTATIVE ? fac?.dateEcheance : traite?.dateEcheance;
    if (!dateEffet) errs.push("La date d'effet est obligatoire");
    if (!dateEcheance) errs.push("La date d'échéance est obligatoire");
    if (affaire.type === AffaireType.FACULTATIVE && fac) {
      if (!(Number(fac.prime100Pct) > 0)) errs.push('La prime à 100% doit être supérieure à 0');
      if (!(Number(fac.tauxCession) > 0 && Number(fac.tauxCession) <= 100)) {
        errs.push('Le taux de cession doit être compris entre 0 et 100');
      }
    }
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
      ...(currency !== 'TND' && roe !== undefined ? { roe } : {}),
      chargeDossier: chargeDossier.trim(),
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
              // left unchanged unless edited via their dedicated managers.
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
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-[var(--radius)] border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-[18px] font-semibold text-foreground">Modifier l'Affaire {affaire.numero}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Mode de paiement</label>
              <select value={modePaiement} onChange={(e) => setModePaiement(e.target.value as any)} className="w-full px-3 py-2 border border-border bg-background rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2">
                <option value="PAR_AFFAIRE">Par Affaire</option>
                <option value="PAR_SITUATION">Par Situation</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Chargé de dossier</label>
              <input
                type="text"
                value={chargeDossier}
                onChange={(event) => setChargeDossier(event.target.value)}
                placeholder="Ex: Manel"
                className="w-full px-3 py-2 border border-border bg-background rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Devise</label>
              <CurrencySelect value={currency} onChange={setCurrency} />
              {currency !== 'TND' && (
                <div className="mt-2">
                  <label className="block text-[11px] text-muted-foreground mb-1">ROE — taux de change vers TND</label>
                  <DecimalInput value={roe} onChange={setRoe} placeholder="Ex: 3,350000"
                    className="w-full px-3 py-2 border border-border bg-background rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2" />
                </div>
              )}
            </div>
          </div>

          {affaire.type === AffaireType.FACULTATIVE && fac && (
            <div className="space-y-4">
              <h3 className="text-[14px] font-semibold text-foreground">Données Facultative</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Assuré</label>
                  {/*
                    FIX (bug #7): this modal had no inline create at all — a
                    user editing an affaire hit the exact empty-dropdown wall
                    this whole feature exists to remove.
                  */}
                  <ReferenceSelect
                    kind="assure"
                    value={fac.assureId || ''}
                    onChange={(id) => setFac({ ...fac, assureId: id })}
                    className="w-full px-3 py-2 border border-border bg-background rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">Type de réassurance</label>
                  <select value={fac.reassuranceType || ''} onChange={(e) => setFac({ ...fac, reassuranceType: e.target.value as ReassuranceType })} className="w-full px-3 py-2 border border-border bg-background rounded-lg text-[13px] focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2">
                    {Object.entries(reassuranceTypeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">
                    N° Police cédante <span className="font-normal text-gray-400">(référence cédante)</span>
                  </label>
                  <input type="text" value={fac.numeroPoliceCedante || ''} onChange={(e) => setFac({ ...fac, numeroPoliceCedante: e.target.value })} placeholder="Ex: POL-2026-00123" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-1 text-[11px] text-gray-400">Numéro de police propre à la cédante — distinct du numéro d'affaire ARS.</p>
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
                  <DecimalInput value={fac.prime100Pct || undefined} onChange={(value) => setFac({ ...fac, prime100Pct: value ?? 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Prime (%)</label>
                  <DecimalInput value={fac.tauxPrime} onChange={(value) => setFac({ ...fac, tauxPrime: value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Cession (%)</label>
                  <DecimalInput value={fac.tauxCession || undefined} onChange={(value) => setFac({ ...fac, tauxCession: value ?? 0 })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Commission Cédante (%)</label>
                  <DecimalInput value={fac.tauxCommissionCedante} onChange={(value) => setFac({ ...fac, tauxCommissionCedante: value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime Cédée (calculée)</label>
                  <input type="text" value={(Number(fac.prime100Pct || 0) * Number(fac.tauxCession || 0) / 100).toFixed(3)} disabled className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-[13px] text-gray-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Commission Cédante (calculée)</label>
                  <input type="text" value={commissionCedanteCalc.toFixed(3)} disabled className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-[13px] text-gray-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Capitaux assurés (total des garanties)</label>
                  <input type="text" value={capitauxAssuresTotal.toFixed(3)} disabled className="w-full px-3 py-2 border border-gray-200 bg-gray-100 rounded-lg text-[13px] text-gray-500" />
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
                    <DecimalInput value={g.capitauxAssures100 || undefined} onChange={(value) => updateGuaranteeLine(idx, { capitauxAssures100: value ?? 0 })} placeholder="Capitaux 100%" className="w-40 px-3 py-2 border border-gray-200 rounded-lg text-[13px]" />
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
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Type de réassurance</label>
                  <select value={traite.reassuranceType || ''} onChange={(e) => setTraite({ ...traite, reassuranceType: e.target.value as ReassuranceType })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
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
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Effet</label>
                  <input type="date" value={traite.dateEffet.split('T')[0]} onChange={(e) => setTraite({ ...traite, dateEffet: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date Échéance</label>
                  <input type="date" value={traite.dateEcheance.split('T')[0]} onChange={(e) => setTraite({ ...traite, dateEcheance: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Mode de renouvellement</label>
                  <select value={traite.modeRenouvellement || ''} onChange={(e) => setTraite({ ...traite, modeRenouvellement: (e.target.value || undefined) as ModeRenouvellement })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">—</option>
                    {Object.entries(modeRenouvellementLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Périodicité</label>
                  <select value={traite.periodicite || ''} onChange={(e) => setTraite({ ...traite, periodicite: e.target.value as Periodicite })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(periodiciteLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Date avis résiliation</label>
                  <input type="date" value={traite.dateAvisResiliation?.split('T')[0] || ''} onChange={(e) => setTraite({ ...traite, dateAvisResiliation: e.target.value || undefined })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Prime Prévisionnelle</label>
                  <DecimalInput value={traite.primePrevisionnelle} onChange={(value) => setTraite({ ...traite, primePrevisionnelle: value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">PMD</label>
                  <DecimalInput value={traite.pmd} onChange={(value) => setTraite({ ...traite, pmd: value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Taux Commission Cédante (%)</label>
                  <DecimalInput value={traite.tauxCommissionCedante} onChange={(value) => setTraite({ ...traite, tauxCommissionCedante: value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Commission Liquidation ARS</label>
                  <DecimalInput value={traite.commissionLiquidationArs} onChange={(value) => setTraite({ ...traite, commissionLiquidationArs: value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-1 text-[11px] text-gray-400">Montant fixe saisi manuellement — non calculé automatiquement (distinct de la commission de courtage par réassureur, définie à l'étape 3).</p>
                </div>
                <div>
                  <label className="block text-[12px] font-medium text-gray-700 mb-1.5">Seuil de notification sinistre</label>
                  <DecimalInput value={traite.seuilNotification} onChange={(value) => setTraite({ ...traite, seuilNotification: value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="mt-1 text-[11px] text-gray-400">Seuil au-delà duquel les réassureurs doivent être notifiés.</p>
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
                    <ReferenceSelect
                      kind="reassureur"
                      value={r.reassureurId}
                      onChange={(id) => updateReassureur(idx, { reassureurId: id })}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <DecimalInput value={r.partPct || undefined} onChange={(value) => updateReassureur(idx, { partPct: value ?? 0 })} placeholder={affaire.type === AffaireType.FACULTATIVE ? 'Part placée %' : 'Part %'} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={() => removeReassureur(idx)} className="px-2 text-red-600 hover:bg-red-50 rounded">×</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <select value={r.commissionMode} onChange={(e) => updateReassureur(idx, { commissionMode: e.target.value as CommissionMode })} className="px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={CommissionMode.CALCULABLE}>Calculable</option>
                    <option value={CommissionMode.FORFAITAIRE}>Forfaitaire</option>
                  </select>
                  {r.commissionMode === CommissionMode.CALCULABLE ? (
                    <DecimalInput value={r.tauxCommissionArs || undefined} onChange={(value) => updateReassureur(idx, { tauxCommissionArs: value ?? 0 })} placeholder="Taux courtage %" className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  ) : (
                    <DecimalInput value={r.commissionForfait || undefined} onChange={(value) => updateReassureur(idx, { commissionForfait: value ?? 0 })} placeholder="Montant forfaitaire" className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  )}
                </div>
              </div>
            ))}
            <div className={`p-2 rounded-lg text-[12px] ${shareOk ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
              Total: {totalShare.toFixed(4)}% {!shareOk && `(doit être ${expectedShareTotal}%)`}
            </div>
            {affaire.type === AffaireType.FACULTATIVE && fac && rubriques && Number(fac.prime100Pct) > 0 && (
              <div className="mt-3">
                <ReassureurRubriquesTable
                  rows={previewRows(
                    rubriques.lines,
                    reassureurs.map((r) => {
                      const selected = reassureurOptions.find((option) => option.id === r.reassureurId);
                      const existing = affaire.reassureurs.find((item) => item.reassureurId === r.reassureurId)?.reassureur;
                      return {
                        label: selected?.raisonSociale ?? existing?.raisonSociale ?? '—',
                        code: selected?.code ?? existing?.code,
                        isLeader: r.isLeader,
                        commissionMode: r.commissionMode,
                        tauxCommissionArs: r.tauxCommissionArs,
                      };
                    }),
                  )}
                  totals={rubriques.totals}
                  compagnie={affaire.cedante.raisonSociale}
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
              </div>
            )}
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