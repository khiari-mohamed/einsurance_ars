// FIX (Affaires Pass 2): no API layer previously wired the /facultatives
// controller at all — FacultativesList.tsx called the generic /affaires
// endpoint instead, and GuaranteeLinesManager.tsx called a nonexistent
// guaranteeLinesApi. This is the real, complete wiring.
import api from '../lib/api';
import {
  FacultativesListResponse, FacultativeDetail, FacultativeFilters,
  CreateFacultativeDto, UpdateFacultativeDto, GuaranteeLineInput,
  RenewalAlertItem, BranchStat,
} from '../types/facultative.types';

export const facultativeApi = {
  getAll: (filters?: FacultativeFilters) =>
    api.get<FacultativesListResponse>('/facultatives', { params: filters }),

  getOne: (affaireId: string) =>
    api.get<FacultativeDetail>(`/facultatives/${affaireId}`),

  create: (data: CreateFacultativeDto) =>
    api.post<FacultativeDetail>('/facultatives', data),

  update: (affaireId: string, data: UpdateFacultativeDto) =>
    api.put<FacultativeDetail>(`/facultatives/${affaireId}`, data),

  recalculateCommissions: (affaireId: string) =>
    api.post<{ recalculated: number }>(`/facultatives/${affaireId}/recalculate-commissions`),

  replaceGuaranteeLines: (affaireId: string, lines: GuaranteeLineInput[]) =>
    api.put(`/facultatives/${affaireId}/guarantee-lines`, lines),

  addGuaranteeLine: (affaireId: string, line: GuaranteeLineInput) =>
    api.post(`/facultatives/${affaireId}/guarantee-lines`, line),

  removeGuaranteeLine: (affaireId: string, lineId: string) =>
    api.delete(`/facultatives/${affaireId}/guarantee-lines/${lineId}`),

  getRenewalsAlert: (daysAhead = 30) =>
    api.get<RenewalAlertItem[]>('/facultatives/renewals-alert', { params: { daysAhead } }),

  getStatsByBranch: (year?: number) =>
    api.get<BranchStat[]>('/facultatives/stats/by-branch', { params: { year } }),

  downloadSlipPdf: (affaireId: string) =>
    api.get(`/facultatives/${affaireId}/slip/pdf`, { responseType: 'blob' }),
};

export default facultativeApi;