/**
 * Parse a user-typed decimal. Accepts comma or dot as the decimal separator
 * and ignores spaces: "569 335,494", "569335.494", "569.335,494", "12,".
 * Returns undefined for empty or invalid input.
 */
export function parseDecimalInput(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  let s = String(raw).trim().replace(/[\s\u00A0\u202F]/g, '');
  if (s === '' || s === '-') return undefined;

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma !== -1 && lastDot !== -1) {
    // both present: the last one is the decimal separator
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    s = s.replace(',', '.');
  }
  if (!/^-?\d*\.?\d*$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}