import api from '../lib/api';

export const dashboardApi = {
  getKPIs: (filters?: { startDate?: string; endDate?: string; cedanteId?: string; reassureurId?: string }) =>
    api.get('/reporting/dashboard/kpis', { params: filters }),
  getCAEvolution: (filters?: { period?: string; year?: number }) =>
    api.get('/reporting/dashboard/ca-evolution', { params: filters }),
  getCACedantes: (filters?: { limit?: number; startDate?: string; endDate?: string }) =>
    api.get('/reporting/dashboard/ca-cedantes', { params: filters }),
  getCAReassureurs: (filters?: { limit?: number; startDate?: string; endDate?: string }) =>
    api.get('/reporting/dashboard/ca-reassureurs', { params: filters }),
  getCABranches: (filters?: { startDate?: string; endDate?: string }) =>
    api.get('/reporting/dashboard/ca-branches', { params: filters }),
  getSinistresTrend: (filters?: { months?: number }) =>
    api.get('/reporting/dashboard/sinistres-trend', { params: filters }),
  getTopAffaires: (filters?: { limit?: number; month?: string }) =>
    api.get('/reporting/dashboard/top-affaires', { params: filters }),
  getSinistresMajeurs: (filters?: { minAmount?: number; limit?: number }) =>
    api.get('/reporting/dashboard/sinistres-majeurs', { params: filters }),
  getEcheances: (filters?: { days?: number }) =>
    api.get('/reporting/dashboard/echeances', { params: filters }),
  getAlerts: () =>
    api.get('/reporting/dashboard/alerts'),
  getCashFlow: (filters?: { startDate?: string; endDate?: string }) =>
    api.get('/reporting/dashboard/cash-flow', { params: filters }),
  getFinanceDashboard: (filters?: { startDate?: string; endDate?: string }) =>
    api.get('/reporting/dashboard/finance', { params: filters }),
};
