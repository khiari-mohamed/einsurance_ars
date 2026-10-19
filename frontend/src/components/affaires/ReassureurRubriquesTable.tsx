import { CommissionMode } from '../../types/affaire.types';
import { RubriqueLine, RubriqueTotals, toTnd } from '../../lib/affaire-calc';

export interface RubriqueRow {
  key: string;
  label: string;
  code?: string;
  isLeader?: boolean;
  partPct: number;
  commissionMode?: CommissionMode;
  tauxCommissionArs?: number;
  primeCedee: number;
  commissionCedante: number;
  commissionArs: number;
  primeNetteCedante: number;
  primeNetteReassureur: number;
}

/** Combine computed lines (live preview) with display metadata. */
export function previewRows(
  lines: RubriqueLine[],
  meta: { label: string; code?: string; isLeader?: boolean; commissionMode?: CommissionMode; tauxCommissionArs?: number }[],
): RubriqueRow[] {
  return lines.map((l, i) => ({
    key: l.key,
    label: meta[i]?.label || `Réassureur ${i + 1}`,
    code: meta[i]?.code,
    isLeader: meta[i]?.isLeader,
    commissionMode: meta[i]?.commissionMode,
    tauxCommissionArs: meta[i]?.tauxCommissionArs,
    partPct: l.partPct,
    primeCedee: l.primeCedee,
    commissionCedante: l.commissionCedante,
    commissionArs: l.commissionArs,
    primeNetteCedante: l.primeNetteCedante,
    primeNetteReassureur: l.primeNetteReassureur,
  }));
}

interface Props {
  rows: RubriqueRow[];
  totals: RubriqueTotals;
  compagnie: string;
  type: string;
  cover: string;
  dateEffet?: string;
  dateExpiration?: string;
  chargeDossier?: string | null;
  currency: string;
  roe: number | undefined;
  prime100Pct: number;
  tauxCommissionCedante: number;
}

const nf = new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pf = new Intl.NumberFormat('fr-TN', { maximumFractionDigits: 4 });
const fmt = (n?: number) => (n === undefined ? '—' : nf.format(n));
const pct = (n?: number) => (n === undefined ? '—' : `${pf.format(n)} %`);
const fmtDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString('fr-FR') : '—';

export default function ReassureurRubriquesTable({
  rows, totals, compagnie, type, cover, dateEffet, dateExpiration,
  chargeDossier, currency, roe, prime100Pct, tauxCommissionCedante,
}: Props) {
  const dt = (n: number) => fmt(toTnd(n, roe));
  const rates = rows.map((r) =>
    r.commissionMode === CommissionMode.FORFAITAIRE ? undefined : r.tauxCommissionArs ?? 0,
  );
  const sameRate = rows.length > 0 && rates.every((x) => x !== undefined && x === rates[0]);
  const totalRate = sameRate ? pct(rates[0]) : 'Divers';

  const th = 'px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap';
  const td = 'px-3 py-2 text-right text-[12px] text-foreground whitespace-nowrap tabular-nums';

  if (rows.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Aucun réassureur.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full">
        <thead className="border-b border-border bg-secondary/40">
          <tr>
            <th className={`${th} text-left`}>Compagnie</th>
            <th className={th}>Type</th>
            <th className={th}>Cover</th>
            <th className={th}>Effet</th>
            <th className={th}>DATE D'EXPIRATION</th>
            <th className={`${th} text-left`}>Réassureur/Leader</th>
            <th className={th}>Monnaie</th>
            <th className={th}>PART PLACEE</th>
            <th className={th}>Prime à 100%</th>
            <th className={th}>Prime à 100% en DT</th>
            <th className={th}>Prime Cédée</th>
            <th className={th}>Prime Cédée en DT</th>
            <th className={th}>TAUX COM CEDANTE</th>
            <th className={th}>TAUX COMM COURTAGE</th>
            <th className={th}>Rému CEDANTE</th>
            <th className={th}>Rému cdte DT</th>
            <th className={th}>Rému . ARS Tunis</th>
            <th className={th}>Rému ARS TUN DT</th>
            <th className={th}>PRIME NETTE CEDANTE</th>
            <th className={th}>PRIME NETTE REASSUREUR</th>
            <th className={th}>ROE</th>
            <th className={th}>CHARGE</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className={`${td} text-left`}>{compagnie || '—'}</td>
              <td className={td}>{type || '—'}</td>
              <td className={td}>{cover || '—'}</td>
              <td className={td}>{fmtDate(dateEffet)}</td>
              <td className={td}>{fmtDate(dateExpiration)}</td>
              <td className="px-3 py-2 text-left text-[12px] text-foreground whitespace-nowrap">
                {r.label}
                {r.code ? <span className="ml-1 font-mono text-muted-foreground">({r.code})</span> : null}
                {r.isLeader ? <span className="ml-2 rounded-full border border-border px-1.5 text-[10px]">Leader</span> : null}
              </td>
              <td className={td}>{currency}</td>
              <td className={td}>{pct(r.partPct)}</td>
              <td className={td}>{fmt(prime100Pct)}</td>
              <td className={td}>{dt(prime100Pct)}</td>
              <td className={td}>{fmt(r.primeCedee)}</td>
              <td className={td}>{dt(r.primeCedee)}</td>
              <td className={td}>{pct(tauxCommissionCedante)}</td>
              <td className={td}>
                {r.commissionMode === CommissionMode.FORFAITAIRE ? 'Forfait' : pct(r.tauxCommissionArs ?? 0)}
              </td>
              <td className={td}>{fmt(r.commissionCedante)}</td>
              <td className={td}>{dt(r.commissionCedante)}</td>
              <td className={td}>{fmt(r.commissionArs)}</td>
              <td className={td}>{dt(r.commissionArs)}</td>
              <td className={td}>{fmt(r.primeNetteCedante)}</td>
              <td className={td}>{fmt(r.primeNetteReassureur)}</td>
              <td className={td}>{roe === undefined ? '—' : pf.format(roe)}</td>
              <td className={td}>{chargeDossier?.trim() || '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-border bg-secondary/40 font-semibold">
          <tr>
            <td className={`${td} text-left`}>{compagnie || '—'}</td>
            <td className={td}>{type || '—'}</td>
            <td className={td}>{cover || '—'}</td>
            <td className={td}>{fmtDate(dateEffet)}</td>
            <td className={td}>{fmtDate(dateExpiration)}</td>
            <td className="px-3 py-2 text-left text-[12px]">TOTAL FAC</td>
            <td className={td}>{currency}</td>
            <td className={td}>{pct(totals.partPct)}</td>
            <td className={td}>{fmt(prime100Pct)}</td>
            <td className={td}>{dt(prime100Pct)}</td>
            <td className={td}>{fmt(totals.primeCedee)}</td>
            <td className={td}>{dt(totals.primeCedee)}</td>
            <td className={td}>{pct(tauxCommissionCedante)}</td>
            <td className={td}>{totalRate}</td>
            <td className={td}>{fmt(totals.commissionCedante)}</td>
            <td className={td}>{dt(totals.commissionCedante)}</td>
            <td className={td}>{fmt(totals.commissionArs)}</td>
            <td className={td}>{dt(totals.commissionArs)}</td>
            <td className={td}>{fmt(totals.primeNetteCedante)}</td>
            <td className={td}>{fmt(totals.primeNetteReassureur)}</td>
            <td className={td}>{roe === undefined ? '—' : pf.format(roe)}</td>
            <td className={td}>{chargeDossier?.trim() || '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
