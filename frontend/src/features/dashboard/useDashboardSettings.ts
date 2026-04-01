import { useState } from 'react';

export function useDashboardSettings() {
  const [layout, setLayout] = useState<any>(() => {
    const saved = localStorage.getItem('dashboard-layout');
    return saved ? JSON.parse(saved) : { widgets: [], filters: {} };
  });

  const [currency, setCurrency] = useState<string>(() => {
    return localStorage.getItem('dashboard-currency') || 'TND';
  });

  const saveLayout = (newLayout: any) => {
    setLayout(newLayout);
    localStorage.setItem('dashboard-layout', JSON.stringify(newLayout));
  };

  const saveCurrency = (newCurrency: string) => {
    setCurrency(newCurrency);
    localStorage.setItem('dashboard-currency', newCurrency);
  };

  const saveFilters = (filters: any) => {
    const newLayout = { ...layout, filters };
    saveLayout(newLayout);
  };

  return { layout, saveLayout, currency, saveCurrency, saveFilters };
}
