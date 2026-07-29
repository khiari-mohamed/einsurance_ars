// FIX (Finances pass): full rewrite. Removed every fictional route —
// /finances/encaissements/:id/comptabilize, /finances/decaissements/:id/
// ordonnancer, /finances/bank-movements, /finances/lettrage/auto,
// /finances/ordres-paiement/:id/verify|sign|transmit,
// /finances/accounting/*, /finances/aml/screen|report, /finances/tax/*
// (no tax module exists at all), /finances/bank-reconciliation/*
// (real prefix is /finances/reconciliation/*), /finances/lettrage/aging,
// /finances/lettrage/unmatched — none of these exist on the real
// FinancesController. Rebuilt against the exact route set reviewed.
import api from '../lib/api';
import {
  Encaissement, Decaissement, CreateEncaissementInput, CreateDecaissementInput,
  CommissionLine, CommissionStatement, Settlement, CreateSettlementInput,
  Situation, CreateSituationInput, Lettrage, CreateLettrageInput,
  OrdrePaiement, CreateOrdrePaiementInput, OrdreVirementStatut,
  FourStepPaymentResult, CashFlowReport, AgingReport, AmlFlaggedEntry,
  ImportBankMovementInput, PaginatedResponse, Encaissement as EncaissementT, Decaissement as DecaissementT,
  BankMovement, FinancialMovementType,
} from '../types/finance.types';

interface ListParams { page?: number; limit?: number }

export const financesApi = {
  // ── Encaissements ──────────────────────────────────────────────
  getEncaissements: (params?: ListParams & { affaireId?: string; cedanteId?: string }) =>
    api.get<PaginatedResponse<Encaissement>>('/finances/encaissements', { params }),
  getEncaissement: (id: string) => api.get<Encaissement>(`/finances/encaissements/${id}`),
  createEncaissement: (data: CreateEncaissementInput) =>
    api.post<EncaissementT & { amlFlagged?: boolean; amlReason?: string }>('/finances/encaissements', data),
  updateEncaissement: (id: string, data: Partial<CreateEncaissementInput>) =>
    api.put<Encaissement>(`/finances/encaissements/${id}`, data),
  validateEncaissement: (id: string) => api.put<Encaissement>(`/finances/encaissements/${id}/validate`),
  deleteEncaissement: (id: string) => api.delete<void>(`/finances/encaissements/${id}`),

  // ── Décaissements ──────────────────────────────────────────────
  getDecaissements: (params?: ListParams & { affaireId?: string }) =>
    api.get<PaginatedResponse<Decaissement>>('/finances/decaissements', { params }),
  getDecaissement: (id: string) => api.get<Decaissement>(`/finances/decaissements/${id}`),
  createDecaissement: (data: CreateDecaissementInput) =>
    api.post<DecaissementT & { amlFlagged?: boolean; amlReason?: string }>('/finances/decaissements', data),
  updateDecaissement: (id: string, data: Partial<CreateDecaissementInput>) =>
    api.put<Decaissement>(`/finances/decaissements/${id}`, data),
  approveDecaissement: (id: string, niveau?: number, note?: string) =>
    api.put<Decaissement>(`/finances/decaissements/${id}/approve`, { niveau, note }),
  rejectDecaissement: (id: string, motif: string) =>
    api.put<Decaissement>(`/finances/decaissements/${id}/reject`, { motif }),
  executeDecaissement: (id: string) => api.put<Decaissement>(`/finances/decaissements/${id}/execute`),
  deleteDecaissement: (id: string) => api.delete<void>(`/finances/decaissements/${id}`),

  // ── Balance ────────────────────────────────────────────────────
  getBalance: (affaireId: string) =>
    api.get<{ affaireId: string; encaisse: number; decaisse: number; solde: number }>(`/finances/balance/${affaireId}`),

  // ── Commissions (read-only view onto AffaireReassureur + mark-paid) ──
  getCommissions: (params?: ListParams & { affaireId?: string; reassureurId?: string; paid?: 'paid' | 'unpaid' }) =>
    api.get<PaginatedResponse<CommissionLine>>('/finances/commissions', { params }),
  getCommission: (id: string) => api.get<CommissionLine>(`/finances/commissions/${id}`),
  markCommissionPaid: (id: string, decaissementId: string) =>
    api.patch<CommissionLine>(`/finances/commissions/${id}/mark-paid`, { decaissementId }),
  getCommissionStatement: (cedanteId: string, period: string) =>
    api.get<CommissionStatement>(`/finances/commissions/statement/${cedanteId}/${period}`),

  // ── Reports ────────────────────────────────────────────────────
  getCashFlowReport: (startDate: string, endDate: string) =>
    api.get<CashFlowReport>('/finances/reports/cash-flow', { params: { startDate, endDate } }),
  getAgingReport: (type: 'creances' | 'dettes') =>
    api.get<AgingReport>('/finances/reports/aging', { params: { type } }),

  // ── Settlements ────────────────────────────────────────────────
  getSettlements: (params?: ListParams & { affaireId?: string; situationId?: string }) =>
    api.get<PaginatedResponse<Settlement>>('/finances/settlements', { params }),
  getSettlement: (id: string) => api.get<Settlement>(`/finances/settlements/${id}`),
  createSettlement: (data: CreateSettlementInput) => api.post<Settlement>('/finances/settlements', data),
  calculateSettlement: (id: string) => api.patch<Settlement>(`/finances/settlements/${id}/calculate`),
  validateSettlement: (id: string) => api.patch<Settlement>(`/finances/settlements/${id}/validate`),
  deleteSettlement: (id: string) => api.delete<void>(`/finances/settlements/${id}`),

  // ── Situations ─────────────────────────────────────────────────
  getSituations: (params?: ListParams & { cedanteId?: string }) =>
    api.get<PaginatedResponse<Situation>>('/finances/situations', { params }),
  getSituation: (id: string) => api.get<Situation>(`/finances/situations/${id}`),
  createSituation: (data: CreateSituationInput) => api.post<Situation>('/finances/situations', data),
  deleteSituation: (id: string) => api.delete<void>(`/finances/situations/${id}`),

  // ── Lettrage ───────────────────────────────────────────────────
  getOpenItems: (cedanteId: string) => api.get<any[]>(`/finances/lettrage/open-items/${cedanteId}`),
  getLettrages: (params?: ListParams & { cedanteId?: string }) =>
    api.get<PaginatedResponse<Lettrage>>('/finances/lettrage', { params }),
  getLettrage: (id: string) => api.get<Lettrage>(`/finances/lettrage/${id}`),
  createLettrage: (data: CreateLettrageInput) => api.post<Lettrage>('/finances/lettrage', data),

  // ── Ordres de paiement ─────────────────────────────────────────
  getOrdres: (params?: ListParams & { statut?: OrdreVirementStatut }) =>
    api.get<PaginatedResponse<OrdrePaiement>>('/finances/ordres-paiement', { params }),
  getOrdre: (id: string) => api.get<OrdrePaiement>(`/finances/ordres-paiement/${id}`),
  createOrdre: (data: CreateOrdrePaiementInput) => api.post<OrdrePaiement>('/finances/ordres-paiement', data),
  validateOrdre: (id: string) => api.patch<OrdrePaiement>(`/finances/ordres-paiement/${id}/validate`),
  executeOrdre: (id: string) => api.patch<OrdrePaiement>(`/finances/ordres-paiement/${id}/execute`),
  attachSwift: (id: string, swiftDocumentId: string) =>
    api.patch<OrdrePaiement>(`/finances/ordres-paiement/${id}/swift`, { swiftDocumentId }),
  downloadOrdrePdf: (id: string) => api.get(`/finances/ordres-paiement/${id}/pdf`, { responseType: 'blob' as const }),

  // ── 4-step payment ─────────────────────────────────────────────
  executeFourStepPayment: (affaireId: string) =>
    api.post<FourStepPaymentResult>(`/finances/four-step/${affaireId}`),

  // ── Bank reconciliation ────────────────────────────────────────
  listBankMovements: (params?: ListParams & { reconciled?: boolean; type?: FinancialMovementType }) =>
    api.get<PaginatedResponse<BankMovement>>('/finances/bank-movements', { params }),
  getUnreconciled: () =>
    api.get<{ unreconciled: { encaissements: Encaissement[]; decaissements: Decaissement[] } }>(
      '/finances/reconciliation/unreconciled',
    ),
  reconcileEncaissement: (encaissementId: string, bankMovementId: string) =>
    api.post<{ message: string }>('/finances/reconciliation/encaissement', { encaissementId, bankMovementId }),
  reconcileDecaissement: (decaissementId: string, bankMovementId: string) =>
    api.post<{ message: string }>('/finances/reconciliation/decaissement', { decaissementId, bankMovementId }),
  unreconcile: (bankMovementId: string) =>
    api.post<{ message: string }>(`/finances/reconciliation/${bankMovementId}/unreconcile`),
  importBankMovements: (movements: ImportBankMovementInput[]) =>
    api.post<{ total: number; imported: number; failed: number; results: any[] }>(
      '/finances/reconciliation/import', movements,
    ),

  // ── AML ────────────────────────────────────────────────────────
  getFlagged: (params?: ListParams) =>
    api.get<PaginatedResponse<AmlFlaggedEntry>>('/finances/aml/flagged', { params }),
};

export default financesApi;