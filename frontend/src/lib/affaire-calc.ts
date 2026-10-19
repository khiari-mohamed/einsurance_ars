import { CommissionMode } from '../types/affaire.types';

export const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export interface RubriqueLineInput {
  key: string;
  partPct: number;
  commissionMode?: CommissionMode;
  tauxCommissionArs?: number;
  commissionForfait?: number;
}

export interface RubriqueLine {
  key: string;
  partPct: number;
  primeCedee: number;
  commissionCedante: number;
  commissionArs: number;
  primeNetteCedante: number;
  primeNetteReassureur: number;
}

export interface RubriqueTotals {
  partPct: number;
  primeCedee: number;
  commissionCedante: number;
  commissionArs: number;
  primeNetteCedante: number;
  primeNetteReassureur: number;
}

/** Same formulas as CommissionCalculatorService (unrounded intermediates, round once). */
export function computeFacRubriques(
  prime100Pct: number,
  tauxCommissionCedante: number,
  lines: RubriqueLineInput[],
): { lines: RubriqueLine[]; totals: RubriqueTotals } {
  const p100 = Number(prime100Pct) || 0;
  const tCed = Number(tauxCommissionCedante) || 0;
  let sPart = 0, sPc = 0, sCc = 0, sCa = 0;

  const out = lines.map((l) => {
    const part = Number(l.partPct) || 0;
    const pc = p100 * (part / 100);
    const cc = pc * (tCed / 100);
    const ca =
      l.commissionMode === CommissionMode.FORFAITAIRE
        ? Number(l.commissionForfait) || 0
        : pc * ((Number(l.tauxCommissionArs) || 0) / 100);
    sPart += part; sPc += pc; sCc += cc; sCa += ca;
    return {
      key: l.key,
      partPct: part,
      primeCedee: round3(pc),
      commissionCedante: round3(cc),
      commissionArs: round3(ca),
      primeNetteCedante: round3(pc - cc),
      primeNetteReassureur: round3(pc - cc - ca),
    };
  });

  return {
    lines: out,
    totals: {
      partPct: sPart,
      primeCedee: round3(sPc),
      commissionCedante: round3(sCc),
      commissionArs: round3(sCa),
      primeNetteCedante: round3(sPc - sCc),
      primeNetteReassureur: round3(sPc - sCc - sCa),
    },
  };
}

/** ROE: TND → 1; foreign currency → stored ROE or undefined if missing. */
export function effectiveRoe(currency: string, roe?: number | null): number | undefined {
  if (currency === 'TND') return 1;
  const r = Number(roe);
  return r > 0 ? r : undefined;
}

export function toTnd(amount: number, roe: number | undefined): number | undefined {
  return roe === undefined ? undefined : round3(amount * roe);
}