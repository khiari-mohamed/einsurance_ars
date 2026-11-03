import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2, AlertCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { traitesApi } from '../../api/traites.api';
import type { NonProportionalLineInput } from '../../types/traite.types';
import { formatCurrency } from '../../lib/currency';

interface Props { affaireId: string; devise?: string; }
const empty = (): NonProportionalLineInput => ({
  priorite: 0, pmd: 0, portee: 0, epi: 0, tauxPrime: 0, tauxCommissionCedante: 0, tauxCommissionArs: 0,
});

export default function NonProportionalLinesManager({ affaireId, devise = 'TND' }: Props) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<NonProportionalLineInput[]>([]);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['non-proportional-lines', affaireId],
    queryFn: () => traitesApi.getNonProportionalLines(affaireId),
  });
  useEffect(() => {
    if (data && !dirty) setRows(data.data.map((r) => ({
      priorite: Number(r.priorite), pmd: Number(r.pmd), portee: Number(r.portee), epi: Number(r.epi),
      tauxPrime: Number(r.tauxPrime), tauxCommissionCedante: Number(r.tauxCommissionCedante), tauxCommissionArs: Number(r.tauxCommissionArs), ordre: r.ordre,
    })));
  }, [data, dirty]);
  const totals = useMemo(() => rows.reduce((a, r) => ({
    epi: a.epi + Number(r.epi || 0),
    pmd: a.pmd + Number(r.pmd || 0),
    prime: a.prime + Number(r.epi || 0) * Number(r.tauxPrime || 0) / 100,
  }), { epi: 0, pmd: 0, prime: 0 }), [rows]);
  const save = useMutation({
    mutationFn: () => traitesApi.replaceNonProportionalLines(affaireId, rows.map((r, i) => ({ ...r, ordre: i + 1 }))),
    onSuccess: () => { setDirty(false); setError(''); queryClient.invalidateQueries({ queryKey: ['non-proportional-lines', affaireId] }); },
    onError: (e: any) => setError(e.response?.data?.message || 'Erreur lors de l’enregistrement'),
  });
  if (isLoading) return <p className="text-[13px] text-muted-foreground">Chargement des lignes non proportionnelles…</p>;
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div><h4 className="text-[13px] font-semibold">Lignes non proportionnelles (XOL)</h4><p className="text-[11px] text-muted-foreground">Prime annuelle = EPI × taux de prime ÷ 100.</p></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { setRows((p) => [...p, empty()]); setDirty(true); }} className="flex items-center gap-1 text-[12px] text-primary"><Plus size={14} /> Ajouter</button>
          {dirty && <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-[12px] text-primary-foreground"><Save size={13} /> Enregistrer</button>}
        </div>
      </div>
      {error && <p className="mb-2 flex items-center gap-1 text-[12px] text-destructive"><AlertCircle size={13} /> {error}</p>}
      {rows.map((r, i) => (
        <div key={i} className="mb-2 grid grid-cols-8 gap-2">
          {(['priorite', 'pmd', 'portee', 'epi', 'tauxPrime', 'tauxCommissionCedante', 'tauxCommissionArs'] as const).map((field) => (
            <input key={field} type="number" min="0" step="0.001" value={r[field] ?? 0} placeholder={field} onChange={(e) => { setRows((p) => p.map((x, j) => j === i ? { ...x, [field]: Number(e.target.value) || 0 } : x)); setDirty(true); }} className="w-full rounded border border-border bg-background px-2 py-1.5 text-[11px]" />
          ))}
          <button type="button" onClick={() => { setRows((p) => p.filter((_, j) => j !== i)); setDirty(true); }} className="text-destructive"><Trash2 size={14} /></button>
        </div>
      ))}
      <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-[12px]">
        <span>EPI: {formatCurrency(totals.epi, devise)}</span><span>PMD: {formatCurrency(totals.pmd, devise)}</span><span>Prime annuelle: {formatCurrency(totals.prime, devise)}</span>
      </div>
    </div>
  );
}
