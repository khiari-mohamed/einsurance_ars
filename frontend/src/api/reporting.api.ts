import api from '../lib/api';

export const reportingApi = {
  getBordereauxSummary: (filters?: { startDate?: string; endDate?: string; type?: string }) =>
    api.get('/reporting/bordereaux/summary', { params: filters }),
  
  getPortfolioPerformance: (filters?: { startDate?: string; endDate?: string; groupBy?: string }) =>
    api.get('/reporting/portfolio/performance', { params: filters }),
  
  getRiskConcentration: (filters?: { type?: string }) =>
    api.get('/reporting/portfolio/concentration', { params: filters }),
  
  getReinsurersPerformance: (filters?: { startDate?: string; endDate?: string }) =>
    api.get('/reporting/reinsurers/performance', { params: filters }),
  
  getSAPReport: (filters?: { startDate?: string; endDate?: string }) =>
    api.get('/reporting/sap/report', { params: filters }),
  
  getMonthlyProduction: (filters?: { year?: number; month?: number }) =>
    api.get('/reporting/production/monthly', { params: filters }),
  
  getCommissionAnalysis: (filters?: { startDate?: string; endDate?: string }) =>
    api.get('/reporting/commissions/analysis', { params: filters }),
  
  getCedantesPerformance: (filters?: { startDate?: string; endDate?: string }) =>
    api.get('/reporting/cedantes/performance', { params: filters }),
  
  getBranchesAnalysis: (filters?: { startDate?: string; endDate?: string }) =>
    api.get('/reporting/branches/analysis', { params: filters }),
  
  getPaymentAging: (filters?: { type?: string }) =>
    api.get('/reporting/payment/aging', { params: filters }),
};
