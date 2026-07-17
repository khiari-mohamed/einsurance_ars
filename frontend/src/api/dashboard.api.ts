import api from '../lib/api';

// ── Filter shapes ──────────────────────────────────────────────────────────────

export interface DashboardFilters {
  startDate?: string;
  endDate?: string;
  cedanteId?: string;
  reassureurId?: string;
}

// ── API ────────────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getKPIs: (filters?: DashboardFilters) =>
    api.get('/reporting/dashboard/kpis', { params: filters }),

  getCAEvolution: (params?: { period?: string; year?: number }) =>
    api.get('/reporting/dashboard/ca-evolution', { params }),

  getCACedantes: (params?: { limit?: number; startDate?: string; endDate?: string }) =>
    api.get('/reporting/dashboard/ca-cedantes', { params }),

  getCAReassureurs: (params?: { limit?: number; startDate?: string; endDate?: string }) =>
    api.get('/reporting/dashboard/ca-reassureurs', { params }),

  getSinistresTrend: (params?: { months?: number }) =>
    api.get('/reporting/dashboard/sinistres-trend', { params }),

  getTopAffaires: (params?: { limit?: number }) =>
    api.get('/reporting/dashboard/top-affaires', { params }),

  getSinistresMajeurs: (params?: { minAmount?: number; limit?: number }) =>
    api.get('/reporting/dashboard/sinistres-majeurs', { params }),

  getEcheances: (params?: { days?: number; page?: number; pageSize?: number }) =>
    api.get('/reporting/dashboard/echeances', { params }),

  getAlerts: () =>
    api.get('/reporting/dashboard/alerts'),

  getCashFlow: (params?: { startDate?: string; endDate?: string }) =>
    api.get('/reporting/dashboard/cash-flow', { params }),

  getFinanceDashboard: (params?: DashboardFilters) =>
    api.get('/reporting/dashboard/finance', { params }),

  getBudgetVsActual: (params?: { year?: number }) =>
    api.get('/reporting/dashboard/budget-vs-actual', { params }),
};