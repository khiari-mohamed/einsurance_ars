import api from '../lib/api';

export interface Account {
  id: string;
  code: string;
  libelle: string;
  type: 'actif' | 'passif' | 'charge' | 'produit';
  classe: '1' | '2' | '3' | '4' | '5' | '6' | '7';
  parentCode?: string;
  isActive: boolean;
  isAuxiliary: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LedgerEntry {
  id: string;
  accountCode: string;
  accountLabel: string;
  dateOperation: string;
  periode: string;
  journalCode: string;
  pieceReference: string;
  libelle: string;
  debit: number;
  credit: number;
  solde: number;
  accountingEntryId: string;
  createdAt: string;
}

export interface FiscalPeriod {
  id: string;
  exercice: number;
  mois: number;
  code: string;
  dateDebut: string;
  dateFin: string;
  statut: 'open' | 'closed' | 'locked';
  closedById?: string;
  dateCloture?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TrialBalance {
  exercice: number;
  mois?: number;
  accounts: Array<{
    code: string;
    label: string;
    debit: number;
    credit: number;
    solde: number;
  }>;
  totalDebit: number;
  totalCredit: number;
}

export interface BalanceSheet {
  exercice: number;
  actif: {
    accounts: any[];
    total: number;
  };
  passif: {
    accounts: any[];
    total: number;
  };
  resultat: number;
}

export interface ProfitLoss {
  exercice: number;
  charges: {
    accounts: any[];
    total: number;
  };
  produits: {
    accounts: any[];
    total: number;
  };
  resultat: number;
}

export interface JournalEntry {
  id: string;
  reference: string;
  entryDate: string;
  journalType: 'ventes' | 'achats' | 'banque' | 'caisse' | 'divers';
  description: string;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  status: 'brouillon' | 'valide' | 'comptabilise' | 'annule';
  lines: Array<{
    id: string;
    accountNumber: string;
    accountLabel: string;
    debit: number;
    credit: number;
    description: string;
  }>;
}

export const comptabiliteApi = {
  createAccount: (data: Partial<Account>) => api.post('/comptabilite/accounts', data),
  
  getAccounts: (params?: { classe?: string; isActive?: boolean }) => 
    api.get('/comptabilite/accounts', { params }),
  
  getAccount: (id: string) => api.get(`/comptabilite/accounts/${id}`),
  
  updateAccount: (id: string, data: Partial<Account>) => 
    api.put(`/comptabilite/accounts/${id}`, data),
  
  deleteAccount: (id: string) => api.delete(`/comptabilite/accounts/${id}`),
  
  getLedger: (accountCode: string, startDate: string, endDate: string) =>
    api.get(`/comptabilite/ledger/${accountCode}`, { params: { startDate, endDate } }),
  
  getTrialBalance: (exercice: number, mois?: number) =>
    api.get('/comptabilite/trial-balance', { params: { exercice, mois } }),
  
  getBalanceSheet: (exercice: number) =>
    api.get('/comptabilite/balance-sheet', { params: { exercice } }),
  
  getProfitLoss: (exercice: number) =>
    api.get('/comptabilite/profit-loss', { params: { exercice } }),
  
  getCurrentPeriod: () => api.get('/comptabilite/periods/current'),
  
  closePeriod: (exercice: number, mois: number) =>
    api.post('/comptabilite/periods/close', { exercice, mois }),
  
  reopenPeriod: (exercice: number, mois: number) =>
    api.post('/comptabilite/periods/reopen', { exercice, mois }),

  getJournalEntries: (params?: { journalType?: string; startDate?: string; endDate?: string }) =>
    api.get('/comptabilite/journal-entries', { params }),

  getJournalEntry: (id: string) => api.get(`/comptabilite/journal-entries/${id}`),
};
