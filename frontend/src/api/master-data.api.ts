import api from '../lib/api';
import {
  Assure,
  CreateAssureDto,
  UpdateAssureDto,
  AssuresListResponse,
  AssureSingleResponse,
} from '../types/assure.types';
import {
  Cedante,
  CreateCedanteDto,
  UpdateCedanteDto,
  CedantesListResponse,
  CedanteSingleResponse,
} from '../types/cedante.types';
import {
  Reassureur,
  CreateReassureurDto,
  UpdateReassureurDto,
  ReassureursListResponse,
  ReassureurSingleResponse,
} from '../types/reassureur.types';
import {
  CoCourtier,
  CreateCoCourtierDto,
  UpdateCoCourtierDto,
  CoCourtiersListResponse,
  CoCourtierSingleResponse,
} from '../types/co-courtier.types';

// ============================================================
// ASSURES (Clients)
// ============================================================

export const assuresApi = {
  /**
   * Get all clients (Assurés)
   */
  getAll: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<AssuresListResponse>('/master-data/assures', { params }),

  /**
   * Get a single client by ID
   */
  getOne: (id: string) =>
    api.get<AssureSingleResponse>(`/master-data/assures/${id}`),

  /**
   * Create a new client
   */
  create: (data: CreateAssureDto) =>
    api.post<Assure>('/master-data/assures', data),

  /**
   * Update a client
   */
  update: (id: string, data: UpdateAssureDto) =>
    api.put<Assure>(`/master-data/assures/${id}`, data),

  /**
   * Soft-delete a client (set inactive)
   */
  delete: (id: string) =>
    api.delete<void>(`/master-data/assures/${id}`),

  /**
   * ADMIN ONLY: Override auto-generated code
   * Requires SUPER_ADMIN role
   */
  overrideCode: (id: string, code: string) =>
    api.post<Assure>(`/master-data/assures/${id}/override-code`, { code }),

  /**
   * Get contacts for a client
   */
  getContacts: (id: string) =>
    api.get(`/master-data/assures/${id}/contacts`),

  /**
   * Add a contact to a client
   */
  addContact: (id: string, data: any) =>
    api.post(`/master-data/assures/${id}/contacts`, data),

  /**
   * Update a contact
   */
  updateContact: (assureId: string, contactId: string, data: any) =>
    api.put(`/master-data/assures/${assureId}/contacts/${contactId}`, data),

  /**
   * Delete a contact
   */
  deleteContact: (assureId: string, contactId: string) =>
    api.delete(`/master-data/assures/${assureId}/contacts/${contactId}`),
};

// ============================================================
// CEDANTES (Compagnies d'assurances)
// ============================================================

export const cedantesApi = {
  /**
   * Get all compagnies d'assurances (Cédantes)
   */
  getAll: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<CedantesListResponse>('/master-data/cedantes', { params }),

  /**
   * Get a single compagnie by ID
   */
  getOne: (id: string) =>
    api.get<CedanteSingleResponse>(`/master-data/cedantes/${id}`),

  /**
   * Create a new compagnie
   */
  create: (data: CreateCedanteDto) =>
    api.post<Cedante>('/master-data/cedantes', data),

  /**
   * Update a compagnie
   * Note: compteComptable is LOCKED and cannot be updated
   */
  update: (id: string, data: UpdateCedanteDto) =>
    api.put<Cedante>(`/master-data/cedantes/${id}`, data),

  /**
   * Soft-delete a compagnie (set inactive)
   */
  delete: (id: string) =>
    api.delete<void>(`/master-data/cedantes/${id}`),

  /**
   * ADMIN ONLY: Override auto-generated code
   * Requires SUPER_ADMIN role
   * Format: CAS-XXXX
   */
  overrideCode: (id: string, code: string) =>
    api.post<Cedante>(`/master-data/cedantes/${id}/override-code`, { code }),

  /**
   * Get contacts for a compagnie
   */
  getContacts: (id: string) =>
    api.get(`/master-data/cedantes/${id}/contacts`),

  /**
   * Add a contact to a compagnie
   */
  addContact: (id: string, data: any) =>
    api.post(`/master-data/cedantes/${id}/contacts`, data),

  /**
   * Update a contact
   */
  updateContact: (cedanteId: string, contactId: string, data: any) =>
    api.put(`/master-data/cedantes/${cedanteId}/contacts/${contactId}`, data),

  /**
   * Delete a contact
   */
  deleteContact: (cedanteId: string, contactId: string) =>
    api.delete(`/master-data/cedantes/${cedanteId}/contacts/${contactId}`),

  /**
   * Get bank accounts for a compagnie
   */
  getBankAccounts: (id: string) =>
    api.get(`/master-data/cedantes/${id}/bank-accounts`),

  /**
   * Add a bank account to a compagnie
   */
  addBankAccount: (id: string, data: any) =>
    api.post(`/master-data/cedantes/${id}/bank-accounts`, data),

  /**
   * Update a bank account
   */
  updateBankAccount: (cedanteId: string, bankId: string, data: any) =>
    api.put(`/master-data/cedantes/${cedanteId}/bank-accounts/${bankId}`, data),

  /**
   * Delete a bank account
   */
  deleteBankAccount: (cedanteId: string, bankId: string) =>
    api.delete(`/master-data/cedantes/${cedanteId}/bank-accounts/${bankId}`),
};

// ============================================================
// REASSUREURS
// ============================================================

export const reassureursApi = {
  /**
   * Get all réassureurs
   */
  getAll: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<ReassureursListResponse>('/master-data/reassureurs', { params }),

  /**
   * Get a single réassureur by ID
   */
  getOne: (id: string) =>
    api.get<ReassureurSingleResponse>(`/master-data/reassureurs/${id}`),

  /**
   * Create a new réassureur
   */
  create: (data: CreateReassureurDto) =>
    api.post<Reassureur>('/master-data/reassureurs', data),

  /**
   * Update a réassureur
   * Note: compteComptable is LOCKED and cannot be updated
   */
  update: (id: string, data: UpdateReassureurDto) =>
    api.put<Reassureur>(`/master-data/reassureurs/${id}`, data),

  /**
   * Soft-delete a réassureur (set inactive)
   */
  delete: (id: string) =>
    api.delete<void>(`/master-data/reassureurs/${id}`),

  /**
   * ADMIN ONLY: Override auto-generated code
   * Requires SUPER_ADMIN role
   * Format: REA-XXXX
   */
  overrideCode: (id: string, code: string) =>
    api.post<Reassureur>(`/master-data/reassureurs/${id}/override-code`, { code }),

  /**
   * Get contacts for a réassureur
   */
  getContacts: (id: string) =>
    api.get(`/master-data/reassureurs/${id}/contacts`),

  /**
   * Add a contact to a réassureur
   */
  addContact: (id: string, data: any) =>
    api.post(`/master-data/reassureurs/${id}/contacts`, data),

  /**
   * Update a contact
   */
  updateContact: (reassureurId: string, contactId: string, data: any) =>
    api.put(`/master-data/reassureurs/${reassureurId}/contacts/${contactId}`, data),

  /**
   * Delete a contact
   */
  deleteContact: (reassureurId: string, contactId: string) =>
    api.delete(`/master-data/reassureurs/${reassureurId}/contacts/${contactId}`),

  /**
   * Get bank accounts for a réassureur
   */
  getBankAccounts: (id: string) =>
    api.get(`/master-data/reassureurs/${id}/bank-accounts`),

  /**
   * Add a bank account to a réassureur
   */
  addBankAccount: (id: string, data: any) =>
    api.post(`/master-data/reassureurs/${id}/bank-accounts`, data),

  /**
   * Update a bank account
   */
  updateBankAccount: (reassureurId: string, bankId: string, data: any) =>
    api.put(`/master-data/reassureurs/${reassureurId}/bank-accounts/${bankId}`, data),

  /**
   * Delete a bank account
   */
  deleteBankAccount: (reassureurId: string, bankId: string) =>
    api.delete(`/master-data/reassureurs/${reassureurId}/bank-accounts/${bankId}`),

  /**
   * Get participations (deals) for a réassureur
   */
  getParticipations: (id: string) =>
    api.get(`/master-data/reassureurs/${id}/participations`),
};

// ============================================================
// CO-COURTIERS (Courtiers en réassurance)
// ============================================================

export const coCourtiersApi = {
  /**
   * Get all courtiers en réassurance (Co-courtiers)
   */
  getAll: (params?: { search?: string; page?: number; limit?: number }) =>
    api.get<CoCourtiersListResponse>('/master-data/co-courtiers', { params }),

  /**
   * Get a single courtier by ID
   */
  getOne: (id: string) =>
    api.get<CoCourtierSingleResponse>(`/master-data/co-courtiers/${id}`),

  /**
   * Create a new courtier
   */
  create: (data: CreateCoCourtierDto) =>
    api.post<CoCourtier>('/master-data/co-courtiers', data),

  /**
   * Update a courtier
   * Note: compteComptable is LOCKED and cannot be updated
   */
  update: (id: string, data: UpdateCoCourtierDto) =>
    api.put<CoCourtier>(`/master-data/co-courtiers/${id}`, data),

  /**
   * Soft-delete a courtier (set inactive)
   */
  delete: (id: string) =>
    api.delete<void>(`/master-data/co-courtiers/${id}`),

  /**
   * ADMIN ONLY: Override auto-generated code
   * Requires SUPER_ADMIN role
   * Format: CCO-XXXX
   */
  overrideCode: (id: string, code: string) =>
    api.post<CoCourtier>(`/master-data/co-courtiers/${id}/override-code`, { code }),

  /**
   * Get contacts for a courtier
   */
  getContacts: (id: string) =>
    api.get(`/master-data/co-courtiers/${id}/contacts`),

  /**
   * Add a contact to a courtier
   */
  addContact: (id: string, data: any) =>
    api.post(`/master-data/co-courtiers/${id}/contacts`, data),

  /**
   * Update a contact
   */
  updateContact: (coCourtId: string, contactId: string, data: any) =>
    api.put(`/master-data/co-courtiers/${coCourtId}/contacts/${contactId}`, data),

  /**
   * Delete a contact
   */
  deleteContact: (coCourtId: string, contactId: string) =>
    api.delete(`/master-data/co-courtiers/${coCourtId}/contacts/${contactId}`),

  /**
   * Get bank accounts for a courtier
   */
  getBankAccounts: (id: string) =>
    api.get(`/master-data/co-courtiers/${id}/bank-accounts`),

  /**
   * Add a bank account to a courtier
   */
  addBankAccount: (id: string, data: any) =>
    api.post(`/master-data/co-courtiers/${id}/bank-accounts`, data),

  /**
   * Update a bank account
   */
  updateBankAccount: (coCourtId: string, bankId: string, data: any) =>
    api.put(`/master-data/co-courtiers/${coCourtId}/bank-accounts/${bankId}`, data),

  /**
   * Delete a bank account
   */
  deleteBankAccount: (coCourtId: string, bankId: string) =>
    api.delete(`/master-data/co-courtiers/${coCourtId}/bank-accounts/${bankId}`),
};

// ============================================================
// EXPORT: All master data APIs together
// ============================================================

export const masterDataApi = {
  assures: assuresApi,
  cedantes: cedantesApi,
  reassureurs: reassureursApi,
  coCourtiers: coCourtiersApi,
};

export default masterDataApi;