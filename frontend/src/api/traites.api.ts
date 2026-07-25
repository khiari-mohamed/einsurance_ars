import api from '../lib/api';
import {
  TraitesListResponse, TraiteDetail, TraiteFilters, TraitesStats, RenewalAlertItem,
  TreatyAccountRubriqueInput, PmdInstalmentInput, PmdInstalment,
  LiquidationInput, LiquidationResult, TreatyDistributionResult,
} from '../types/traite.types';

export const traitesApi = {
  getAll: (filters?: TraiteFilters) =>
    api.get<TraitesListResponse>('/traites', { params: filters }),

  getOne: (affaireId: string) =>
    api.get<TraiteDetail>(`/traites/${affaireId}`),

  getRenewalsAlert: (daysAhead = 60) =>
    api.get<RenewalAlertItem[]>('/traites/renewals-alert', { params: { daysAhead } }),

  getStats: (year?: number) =>
    api.get<TraitesStats>('/traites/stats', { params: { year } }),

  replaceAccountRubriques: (affaireId: string, rubriques: TreatyAccountRubriqueInput[]) =>
    api.put(`/traites/${affaireId}/account-rubriques`, rubriques),

  getPmdInstalments: (affaireId: string) =>
    api.get<PmdInstalment[]>(`/traites/${affaireId}/pmd-instalments`),

  replacePmdInstalments: (affaireId: string, instalments: PmdInstalmentInput[]) =>
    api.put(`/traites/${affaireId}/pmd-instalments`, instalments),

  regeneratePmdInstalments: (affaireId: string) =>
    api.post<PmdInstalment[]>(`/traites/${affaireId}/pmd-instalments/regenerate`),

  markInstalmentPaid: (affaireId: string, instalmentId: string) =>
    api.patch<PmdInstalment>(`/traites/${affaireId}/pmd-instalments/${instalmentId}/pay`),

  calculateLiquidation: (affaireId: string, input: LiquidationInput) =>
    api.post<LiquidationResult>(`/traites/${affaireId}/calculate-liquidation`, input),

  calculateDistribution: (affaireId: string, primeNetteCedante: number) =>
    api.post<TreatyDistributionResult[]>(`/traites/${affaireId}/calculate-distribution`, { primeNetteCedante }),

  downloadTreatyStatementPdf: (affaireId: string) =>
    api.get(`/traites/${affaireId}/treaty-statement/pdf`, { responseType: 'blob' }),

  downloadPmdInvoicePdf: (affaireId: string) =>
    api.get(`/traites/${affaireId}/pmd-invoice/pdf`, { responseType: 'blob' }),
};

export default traitesApi;