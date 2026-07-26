const currencyNames: Record<string, string> = {
  TND: 'DT',
  EUR: 'EUR',
  USD: 'USD',
};

export const formatCurrency = (amount: number, currency: string = 'TND'): string => {
  const formatted = new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
  
  const currencySymbol = currencyNames[currency] || currency;
  return `${formatted} ${currencySymbol}`;
};

export const parseCurrency = (value: string): number => {
  return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
};

// NEW (Finances pass): every Finances screen imported formatDate from
// '@/lib/utils' — a file not part of this review. Added here instead,
// alongside the already-confirmed-correct formatCurrency, rather than
// guess at utils.ts's implementation.
export const formatDate = (date: string | Date | null | undefined, withTime = false): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return withTime ? d.toLocaleString('fr-FR') : d.toLocaleDateString('fr-FR');
};