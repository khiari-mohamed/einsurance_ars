import api from '../lib/api';
import { 
  Encaissement, 
  Decaissement, 
  BankMovement, 
  Lettrage, 
  Commission,
  Settlement,
  OrdrePaiement,
  EncaissementStatus, 
  DecaissementStatus,
  CommissionStatus,
  SettlementStatus,
  PaymentOrderStatus
} from '../types/finance.types';

export const financesApi = {
  // ==================== ENCAISSEMENTS ====================
  
  createEncaissement: async (data: any): Promise<Encaissement> => {
    const response = await api.post('/finances/encaissements', data);
    return response.data;
  },

  getEncaissements: async (filters?: {
    startDate?: string;
    endDate?: string;
    sourceType?: string;
    statut?: EncaissementStatus;
    affaireId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Encaissement[]; total: number; page: number; totalPages: number }> => {
    const response = await api.get('/finances/encaissements', { params: filters });
    return response.data;
  },

  getEncaissement: async (id: string): Promise<Encaissement> => {
    const response = await api.get(`/finances/encaissements/${id}`);
    return response.data;
  },

  updateEncaissement: async (id: string, data: any): Promise<Encaissement> => {
    const response = await api.put(`/finances/encaissements/${id}`, data);
    return response.data;
  },

  validateEncaissement: async (id: string): Promise<Encaissement> => {
    const response = await api.put(`/finances/encaissements/${id}/validate`);
    return response.data;
  },

  comptabilizeEncaissement: async (id: string, pieceComptable: string): Promise<Encaissement> => {
    const response = await api.put(`/finances/encaissements/${id}/comptabilize`, { pieceComptable });
    return response.data;
  },

  deleteEncaissement: async (id: string): Promise<void> => {
    await api.delete(`/finances/encaissements/${id}`);
  },

  // ==================== DECAISSEMENTS ====================

  createDecaissement: async (data: any): Promise<Decaissement> => {
    const response = await api.post('/finances/decaissements', data);
    return response.data;
  },

  getDecaissements: async (filters?: {
    startDate?: string;
    endDate?: string;
    beneficiaireType?: string;
    statut?: DecaissementStatus;
    affaireId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Decaissement[]; total: number; page: number; totalPages: number }> => {
    const response = await api.get('/finances/decaissements', { params: filters });
    return response.data;
  },

  getDecaissement: async (id: string): Promise<Decaissement> => {
    const response = await api.get(`/finances/decaissements/${id}`);
    return response.data;
  },

  updateDecaissement: async (id: string, data: any): Promise<Decaissement> => {
    const response = await api.put(`/finances/decaissements/${id}`, data);
    return response.data;
  },

  approveDecaissement: async (id: string, niveau: number, commentaire?: string): Promise<Decaissement> => {
    const response = await api.put(`/finances/decaissements/${id}/approve`, { niveau, commentaire });
    return response.data;
  },

  ordonnancerDecaissement: async (id: string): Promise<Decaissement> => {
    const response = await api.put(`/finances/decaissements/${id}/ordonnancer`);
    return response.data;
  },

  executeDecaissement: async (id: string): Promise<Decaissement> => {
    const response = await api.put(`/finances/decaissements/${id}/execute`);
    return response.data;
  },

  deleteDecaissement: async (id: string): Promise<void> => {
    await api.delete(`/finances/decaissements/${id}`);
  },

  // ==================== BANK MOVEMENTS ====================

  getBankMovements: async (compteBancaire?: string): Promise<BankMovement[]> => {
    const response = await api.get('/finances/bank-movements', { params: { compteBancaire } });
    return response.data;
  },

  // ==================== LETTRAGE ====================

  runAutoLettrage: async (): Promise<{ matched: number; unmatched: number }> => {
    const response = await api.post('/finances/lettrage/auto');
    return response.data;
  },

  getLettrages: async (filters?: { type?: string; entityId?: string }): Promise<Lettrage[]> => {
    const response = await api.get('/finances/lettrage', { params: filters });
    return response.data;
  },

  getLettrage: async (id: string): Promise<Lettrage> => {
    const response = await api.get(`/finances/lettrage/${id}`);
    return response.data;
  },

  // ==================== REPORTS ====================

  getCashFlowReport: async (startDate: string, endDate: string): Promise<any> => {
    const response = await api.get('/finances/reports/cash-flow', {
      params: { startDate, endDate },
    });
    return response.data;
  },

  getAgingReport: async (type: 'creances' | 'dettes'): Promise<any> => {
    const response = await api.get('/finances/reports/aging', { params: { type } });
    return response.data;
  },

  // ==================== COMMISSIONS ====================

  createCommission: async (data: any): Promise<Commission> => {
    const response = await api.post('/finances/commissions', data);
    return response.data;
  },

  getCommissions: async (filters?: {
    affaireId?: string;
    type?: string;
    statut?: CommissionStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Commission[]; total: number; page: number; totalPages: number }> => {
    const response = await api.get('/finances/commissions', { params: filters });
    return response.data;
  },

  getCommission: async (id: string): Promise<Commission> => {
    const response = await api.get(`/finances/commissions/${id}`);
    return response.data;
  },

  markCommissionAsPaid: async (id: string, decaissementId: string): Promise<Commission> => {
    const response = await api.patch(`/finances/commissions/${id}/mark-paid`, { decaissementId });
    return response.data;
  },

  getCommissionStatement: async (cedanteId: string, period: string): Promise<any> => {
    const response = await api.get(`/finances/commissions/statement/${cedanteId}/${period}`);
    return response.data;
  },

  // ==================== SETTLEMENTS ====================

  createSettlement: async (data: any): Promise<Settlement> => {
    const response = await api.post('/finances/settlements', data);
    return response.data;
  },

  getSettlements: async (filters?: {
    cedanteId?: string;
    statut?: SettlementStatus;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Settlement[]; total: number; page: number; totalPages: number }> => {
    const response = await api.get('/finances/settlements', { params: filters });
    return response.data;
  },

  getSettlement: async (id: string): Promise<Settlement> => {
    const response = await api.get(`/finances/settlements/${id}`);
    return response.data;
  },

  calculateSettlement: async (id: string): Promise<Settlement> => {
    const response = await api.patch(`/finances/settlements/${id}/calculate`);
    return response.data;
  },

  validateSettlement: async (id: string): Promise<Settlement> => {
    const response = await api.patch(`/finances/settlements/${id}/validate`);
    return response.data;
  },

  // ==================== ORDRES DE PAIEMENT ====================

  createOrdrePaiement: async (data: any): Promise<OrdrePaiement> => {
    const response = await api.post('/finances/ordres-paiement', data);
    return response.data;
  },

  getOrdresPaiement: async (filters?: {
    statut?: PaymentOrderStatus;
  }): Promise<OrdrePaiement[]> => {
    const response = await api.get('/finances/ordres-paiement', { params: filters });
    return response.data;
  },

  getOrdrePaiement: async (id: string): Promise<OrdrePaiement> => {
    const response = await api.get(`/finances/ordres-paiement/${id}`);
    return response.data;
  },

  verifyOrdrePaiement: async (id: string): Promise<OrdrePaiement> => {
    const response = await api.patch(`/finances/ordres-paiement/${id}/verify`);
    return response.data;
  },

  signOrdrePaiement: async (id: string, commentaire?: string): Promise<OrdrePaiement> => {
    const response = await api.patch(`/finances/ordres-paiement/${id}/sign`, { commentaire });
    return response.data;
  },

  transmitOrdrePaiement: async (id: string, referenceBank: string): Promise<OrdrePaiement> => {
    const response = await api.patch(`/finances/ordres-paiement/${id}/transmit`, { referenceBank });
    return response.data;
  },

  // ==================== ACCOUNTING ====================

  getAccountingEntries: async (filters?: {
    journalCode?: string;
    compteDebit?: string;
    statut?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: any[]; total: number }> => {
    const response = await api.get('/finances/accounting', { params: filters });
    return response.data;
  },

  validateAccountingEntry: async (id: string): Promise<any> => {
    const response = await api.patch(`/finances/accounting/${id}/validate`);
    return response.data;
  },

  getTrialBalance: async (period: string): Promise<any> => {
    const response = await api.get(`/finances/accounting/trial-balance/${period}`);
    return response.data;
  },

  // ==================== AML & TAX ====================

  screenPayment: async (encaissementId?: string, decaissementId?: string): Promise<any> => {
    const response = await api.post('/finances/aml/screen', { encaissementId, decaissementId });
    return response.data;
  },

  getAMLReport: async (startDate: string, endDate: string): Promise<any> => {
    const response = await api.get(`/finances/aml/report/${startDate}/${endDate}`);
    return response.data;
  },

  getTaxObligation: async (startDate: string, endDate: string, type: string): Promise<any> => {
    const response = await api.get(`/finances/tax/obligation/${startDate}/${endDate}/${type}`);
    return response.data;
  },

  getWithholdingTaxReport: async (period: string): Promise<any> => {
    const response = await api.get(`/finances/tax/withholding/${period}`);
    return response.data;
  },

  getTaxComplianceStatus: async (): Promise<any> => {
    const response = await api.get('/finances/tax/compliance');
    return response.data;
  },

  // ==================== BANK RECONCILIATION ====================

  importBankStatement: async (compteBancaire: string, statement: any[]): Promise<any> => {
    const response = await api.post('/finances/bank-reconciliation/import', { compteBancaire, statement });
    return response.data;
  },

  reconcileAccount: async (compteBancaire: string, soldeBank: string): Promise<any> => {
    const response = await api.patch('/finances/bank-reconciliation/reconcile', { compteBancaire, soldeBank });
    return response.data;
  },

  getUnreconciledReport: async (compteBancaire: string): Promise<any> => {
    const response = await api.get(`/finances/bank-reconciliation/unreconciled/${compteBancaire}`);
    return response.data;
  },

  getReconciliationHistory: async (compteBancaire: string): Promise<any> => {
    const response = await api.get(`/finances/bank-reconciliation/history/${compteBancaire}`);
    return response.data;
  },

  // ==================== ADVANCED LETTRAGE ====================

  getAgingAnalysis: async (type: 'creances' | 'dettes', cedanteId?: string): Promise<any> => {
    const response = await api.get(`/finances/lettrage/aging/${type}`, { params: { cedanteId } });
    return response.data;
  },

  getUnmatchedItems: async (days?: number, minMontant?: number): Promise<any> => {
    const response = await api.get('/finances/lettrage/unmatched/items', { params: { days, minMontant } });
    return response.data;
  },
};
