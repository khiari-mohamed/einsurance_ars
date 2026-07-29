// FIX (Comptabilité pass): full rewrite. Old version called getAccounts,
// getBalanceSheet, getProfitLoss(wrong signature), getCurrentPeriod
// (wrong path), closePeriod/reopenPeriod with a single `id` param where the
// real DTO needs {annee, mois}, deleteAccount/updateAccount hitting routes
// that were never wired to the controller. Rebuilt against the exact
// ComptabiliteController route set reviewed in this pass.
import api from '../lib/api';
import {
  PlanComptable, LedgerResult, TrialBalanceLine, PaginatedEntries, JournalEntry,
  ProfitLossReport, FiscalPeriod, AuxiliaryAccount, ExportResult, JournalEntryStatut,
} from '../types/comptabilite.types';

export const comptabiliteApi = {
  // ── Entries ──────────────────────────────────────────────────────
  getEntries: (params?: { statut?: JournalEntryStatut; type?: string; affaireId?: string; fiscalPeriodId?: string; page?: number; limit?: number }) =>
    api.get<PaginatedEntries>('/comptabilite/entries', { params }),
  getEntry: (id: string) => api.get<JournalEntry>(`/comptabilite/entries/${id}`),
  validateEntry: (id: string, pieceComptable?: string, codeJournal?: string) =>
    api.patch<JournalEntry>(`/comptabilite/entries/${id}/validate`, { pieceComptable, codeJournal }),
  deleteEntry: (id: string) => api.delete<void>(`/comptabilite/entries/${id}`),

  // ── Generation ───────────────────────────────────────────────────
  generateFacultative: (affaireId: string) => api.post<JournalEntry>(`/comptabilite/generate/facultative/${affaireId}`),
  generateTraite: (situationId: string) => api.post<JournalEntry>(`/comptabilite/generate/traite-situation/${situationId}`),
  generateEncaissement: (encaissementId: string) => api.post<JournalEntry>(`/comptabilite/generate/encaissement/${encaissementId}`),
  generateDecaissement: (decaissementId: string) => api.post<JournalEntry>(`/comptabilite/generate/decaissement/${decaissementId}`),

  // ── Ledger / reports ─────────────────────────────────────────────
  getLedger: (params: { compte?: string; cedanteId?: string; reassureurId?: string; year?: number }) =>
    api.get<LedgerResult>('/comptabilite/ledger', { params }),
  getTrialBalance: (year?: number, mois?: number) =>
    api.get<TrialBalanceLine[]>('/comptabilite/trial-balance', { params: { year, mois } }),
  getProfitLoss: (year?: number) => api.get<ProfitLossReport>('/comptabilite/profit-loss', { params: { year } }),
  exportEntries: (dateFrom?: string, dateTo?: string, codeJournal?: string, format: 'csv' | 'json' = 'csv') =>
    api.post<ExportResult>('/comptabilite/export', { dateFrom, dateTo, codeJournal, format }),
  generateIntegrationExport: (data: { format?: 'SAGE' | 'CSV_GENERIC'; dateFrom?: string; dateTo?: string; codeJournal?: string }) =>
    api.post<{ id: string; reference: string; format: string; entryCount: number; content: string }>('/comptabilite/integration-export', data),
  listExportBatches: (page?: number, limit?: number) =>
    api.get<{ data: any[]; total: number; page: number; limit: number }>('/comptabilite/integration-export/batches', { params: { page, limit } }),
  getExportBatch: (id: string) => api.get<any>(`/comptabilite/integration-export/batches/${id}`),
  voidExportBatch: (id: string) => api.post(`/comptabilite/integration-export/batches/${id}/void`),

  // ── Plan comptable ───────────────────────────────────────────────
  getPlanComptable: (search?: string, classe?: string) =>
    api.get<PlanComptable[]>('/comptabilite/plan-comptable', { params: { search, classe } }),
  getPlanComptableOne: (id: string) => api.get<PlanComptable>(`/comptabilite/plan-comptable/${id}`),
  createPlanComptable: (data: { compte: string; libelle: string; type: string; classe: string; isAuxiliary?: boolean }) =>
    api.post<PlanComptable>('/comptabilite/plan-comptable', data),
  updatePlanComptable: (id: string, data: { libelle?: string; isActive?: boolean }) =>
    api.put<PlanComptable>(`/comptabilite/plan-comptable/${id}`, data),
  deletePlanComptable: (id: string) => api.delete<PlanComptable>(`/comptabilite/plan-comptable/${id}`),
  seedPlanComptable: () => api.post<{ seeded: number }>('/comptabilite/plan-comptable/seed'),

  // ── Auxiliary accounts ───────────────────────────────────────────
  getAuxiliaryAccounts: (planComptableId?: string) =>
    api.get<AuxiliaryAccount[]>('/comptabilite/auxiliary-accounts', { params: { planComptableId } }),
  createAuxiliaryAccount: (data: { planComptableId: string; code: string; libelle: string; cedanteId?: string; reassureurId?: string }) =>
    api.post<AuxiliaryAccount>('/comptabilite/auxiliary-accounts', data),

  // ── Fiscal periods ───────────────────────────────────────────────
  getFiscalPeriods: () => api.get<FiscalPeriod[]>('/comptabilite/fiscal-periods'),
  getCurrentPeriod: () => api.get<FiscalPeriod>('/comptabilite/fiscal-periods/current'),
  initYear: (year: number) => api.post<{ created: number; annee: number }>(`/comptabilite/fiscal-periods/init/${year}`),
  closePeriod: (annee: number, mois: number) => api.patch<FiscalPeriod>('/comptabilite/fiscal-periods/close', { annee, mois }),
  reopenPeriod: (annee: number, mois: number) => api.patch<FiscalPeriod>('/comptabilite/fiscal-periods/reopen', { annee, mois }),
};

export default comptabiliteApi;