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
