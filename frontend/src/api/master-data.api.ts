import api from '../lib/api';
import {
  Assure,
  CreateAssureDto,
  UpdateAssureDto,
  AssuresListResponse,
} from '../types/assure.types';
import {
  Cedante,
  CreateCedanteDto,
  UpdateCedanteDto,
  CedantesListResponse,
} from '../types/cedante.types';
import {
  Reassureur,
  CreateReassureurDto,
  UpdateReassureurDto,
  ReassureursListResponse,
} from '../types/reassureur.types';
import {
  CoCourtier,
  CreateCoCourtierDto,
  UpdateCoCourtierDto,
  CoCourtiersListResponse,
} from '../types/co-courtier.types';

// Shared list-query params — FIX (new): `statut` was previously unreachable from the
// API layer even though the backend controllers/services already support
// ?statut=ACTIVE|INACTIVE|ALL (added to satisfy the "visible in history, not
// selectable in new affaires" requirement, 5.6.7). Default stays 'ACTIVE' server-side
// if omitted, so existing callers are unaffected.
interface ListParams {
  search?: string;
  page?: number;
  limit?: number;
  statut?: 'ACTIVE' | 'INACTIVE' | 'ALL';
}

// Bulk import item — subset of CreateAssureDto fields sourced from a parsed
// Excel/CSV row. Only raisonSociale is required.
interface BulkImportAssureItem {
  raisonSociale: string;
  rne?: string;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
}

// Bulk edit — only the subset of fields it makes sense to apply across many
// clients at once.
interface BulkUpdateAssureData {
  pays?: string;
  formeJuridique?: string;
  isActive?: boolean;
}

// Bulk import item for cédantes — mirrors CreateCedanteDto's required fields
// (compteComptable, resident) minus contacts/bankAccounts, which aren't
// sourced from a flat spreadsheet row.
interface BulkImportCedanteItem {
  raisonSociale: string;
  compteComptable: string;
  identifiantUnique?: string;
  resident: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  rne?: string;
}

// Bulk edit for cédantes — deliberately excludes compteComptable (locked),
// identifiantUnique/resident/rne (per-row uniqueness + cross-field rules).
interface BulkUpdateCedanteData {
  pays?: string;
  formeJuridique?: string;
  isActive?: boolean;
}

// Bulk import item for réassureurs — mirrors CreateReassureurDto's required
// fields (compteComptable) minus contacts/bankAccounts, which aren't sourced
// from a flat spreadsheet row. Unlike Cedante, `resident` is optional here —
// ReassureursService.bulkImport() only requires it when identifiantUnique
// enforcement kicks in (resident === true), not unconditionally.
interface BulkImportReassureurItem {
  raisonSociale: string;
  compteComptable: string;
  identifiantUnique?: string;
  resident?: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  rne?: string;
}

// Bulk edit for réassureurs — same exclusions as Cedante (compteComptable
// locked; identifiantUnique/resident/rne excluded for per-row uniqueness +
// cross-field rule reasons).
interface BulkUpdateReassureurData {
  pays?: string;
  formeJuridique?: string;
  isActive?: boolean;
}

// Bulk import item for co-courtiers — identical shape to Réassureur's, per
// CDC §5.7 ("identique au Réassureur").
interface BulkImportCoCourtierItem {
  raisonSociale: string;
  compteComptable: string;
  identifiantUnique?: string;
  resident?: boolean;
  formeJuridique?: string;
  adresse?: string;
  pays?: string;
  capital?: number;
  rne?: string;
}

interface BulkUpdateCoCourtierData {
  pays?: string;
  formeJuridique?: string;
  isActive?: boolean;
}

// ============================================================
// ASSURES (Clients)
// ============================================================

export const assuresApi = {
  getAll: (params?: ListParams) =>
    api.get<AssuresListResponse>('/master-data/assures', { params }),

  getOne: (id: string) =>
    api.get<Assure>(`/master-data/assures/${id}`),

  create: (data: CreateAssureDto) =>
    api.post<Assure>('/master-data/assures', data),

  update: (id: string, data: UpdateAssureDto) =>
    api.put<Assure>(`/master-data/assures/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/master-data/assures/${id}`),

  overrideCode: (id: string, code: string) =>
    api.post<Assure>(`/master-data/assures/${id}/override-code`, { code }),

  // Bulk Excel/CSV import — items are already parsed & validated client-side.
  // Returns a per-row success/failure report so a partially-bad file doesn't
  // block the good rows.
  bulkImport: (items: BulkImportAssureItem[]) =>
    api.post<{ total: number; created: number; failed: number; results: any[] }>(
      '/master-data/assures/bulk-import',
      { items },
    ),

  // Bulk edit — applies only the fields present in `data` to every id in `ids`.
  bulkUpdate: (ids: string[], data: BulkUpdateAssureData) =>
    api.put<{ updated: number }>('/master-data/assures/bulk-update', { ids, data }),

  // Bulk deactivate — mirrors the single delete()'s soft-delete + active-affaire
  // guard, per id, and reports which ones were skipped and why.
  bulkDelete: (ids: string[]) =>
    api.post<{ total: number; deactivated: number; failed: number; results: any[] }>(
      '/master-data/assures/bulk-delete',
      { ids },
    ),

  // NOTE: kept as requested. No matching NestJS route was present in the 4 Référentiel
  // controllers reviewed (only GET/, GET/:id, POST/, PUT/:id, DELETE/:id, POST/:id/
  // override-code exist there) — if these 404 in practice, either a contacts.controller
  // exists elsewhere in the codebase that wasn't part of this review, or these calls
  // need to be routed through assuresApi.update(id, { contacts: [...] }) instead
  // (the pattern the backend actually implements: full delete+recreate via nested
  // write). Left untouched per instruction — just flagging for whoever debugs a 404 here.
  getContacts: (id: string) =>
    api.get(`/master-data/assures/${id}/contacts`),

  addContact: (id: string, data: any) =>
    api.post(`/master-data/assures/${id}/contacts`, data),

  updateContact: (assureId: string, contactId: string, data: any) =>
    api.put(`/master-data/assures/${assureId}/contacts/${contactId}`, data),

  deleteContact: (assureId: string, contactId: string) =>
    api.delete(`/master-data/assures/${assureId}/contacts/${contactId}`),
};

// ============================================================
// CEDANTES (Compagnies d'assurances)
// ============================================================

export const cedantesApi = {
  getAll: (params?: ListParams) =>
    api.get<CedantesListResponse>('/master-data/cedantes', { params }),

  getOne: (id: string) =>
    api.get<Cedante>(`/master-data/cedantes/${id}`),

  create: (data: CreateCedanteDto) =>
    api.post<Cedante>('/master-data/cedantes', data),

  update: (id: string, data: UpdateCedanteDto) =>
    api.put<Cedante>(`/master-data/cedantes/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/master-data/cedantes/${id}`),

  overrideCode: (id: string, code: string) =>
    api.post<Cedante>(`/master-data/cedantes/${id}/override-code`, { code }),

  // Bulk Excel/CSV import — items are already parsed & validated client-side
  // against the same compteComptable/identifiantUnique rules the manual-entry
  // form uses. Returns a per-row success/failure report.
  bulkImport: (items: BulkImportCedanteItem[]) =>
    api.post<{ total: number; created: number; failed: number; results: any[] }>(
      '/master-data/cedantes/bulk-import',
      { items },
    ),

  // Bulk edit — applies only the fields present in `data` to every id in `ids`.
  bulkUpdate: (ids: string[], data: BulkUpdateCedanteData) =>
    api.put<{ updated: number }>('/master-data/cedantes/bulk-update', { ids, data }),

  // Bulk deactivate — mirrors the single delete()'s soft-delete + active-affaire
  // guard, per id, and reports which ones were skipped and why.
  bulkDelete: (ids: string[]) =>
    api.post<{ total: number; deactivated: number; failed: number; results: any[] }>(
      '/master-data/cedantes/bulk-delete',
      { ids },
    ),

  // NOTE: see assuresApi note above — kept as-is, route existence unverified.
  getContacts: (id: string) =>
    api.get(`/master-data/cedantes/${id}/contacts`),

  addContact: (id: string, data: any) =>
    api.post(`/master-data/cedantes/${id}/contacts`, data),

  updateContact: (cedanteId: string, contactId: string, data: any) =>
    api.put(`/master-data/cedantes/${cedanteId}/contacts/${contactId}`, data),

  deleteContact: (cedanteId: string, contactId: string) =>
    api.delete(`/master-data/cedantes/${cedanteId}/contacts/${contactId}`),

  getBankAccounts: (id: string) =>
    api.get(`/master-data/cedantes/${id}/bank-accounts`),

  addBankAccount: (id: string, data: any) =>
    api.post(`/master-data/cedantes/${id}/bank-accounts`, data),

  updateBankAccount: (cedanteId: string, bankId: string, data: any) =>
    api.put(`/master-data/cedantes/${cedanteId}/bank-accounts/${bankId}`, data),

  deleteBankAccount: (cedanteId: string, bankId: string) =>
    api.delete(`/master-data/cedantes/${cedanteId}/bank-accounts/${bankId}`),
};

// ============================================================
// REASSUREURS
// ============================================================

export const reassureursApi = {
  getAll: (params?: ListParams) =>
    api.get<ReassureursListResponse>('/master-data/reassureurs', { params }),

  getOne: (id: string) =>
    api.get<Reassureur>(`/master-data/reassureurs/${id}`),

  create: (data: CreateReassureurDto) =>
    api.post<Reassureur>('/master-data/reassureurs', data),

  update: (id: string, data: UpdateReassureurDto) =>
    api.put<Reassureur>(`/master-data/reassureurs/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/master-data/reassureurs/${id}`),

  overrideCode: (id: string, code: string) =>
    api.post<Reassureur>(`/master-data/reassureurs/${id}/override-code`, { code }),

  // Bulk Excel/CSV import — mirrors cedantesApi.bulkImport() exactly.
  bulkImport: (items: BulkImportReassureurItem[]) =>
    api.post<{ total: number; created: number; failed: number; results: any[] }>(
      '/master-data/reassureurs/bulk-import',
      { items },
    ),

  // Bulk edit — applies only the fields present in `data` to every id in `ids`.
  bulkUpdate: (ids: string[], data: BulkUpdateReassureurData) =>
    api.put<{ updated: number }>('/master-data/reassureurs/bulk-update', { ids, data }),

  // Bulk deactivate — mirrors the single delete()'s soft-delete + active-participation
  // guard, per id, and reports which ones were skipped and why.
  bulkDelete: (ids: string[]) =>
    api.post<{ total: number; deactivated: number; failed: number; results: any[] }>(
      '/master-data/reassureurs/bulk-delete',
      { ids },
    ),

  // NOTE: see assuresApi note above — kept as-is, route existence unverified.
  getContacts: (id: string) =>
    api.get(`/master-data/reassureurs/${id}/contacts`),

  addContact: (id: string, data: any) =>
    api.post(`/master-data/reassureurs/${id}/contacts`, data),

  updateContact: (reassureurId: string, contactId: string, data: any) =>
    api.put(`/master-data/reassureurs/${reassureurId}/contacts/${contactId}`, data),

  deleteContact: (reassureurId: string, contactId: string) =>
    api.delete(`/master-data/reassureurs/${reassureurId}/contacts/${contactId}`),

  getBankAccounts: (id: string) =>
    api.get(`/master-data/reassureurs/${id}/bank-accounts`),

  addBankAccount: (id: string, data: any) =>
    api.post(`/master-data/reassureurs/${id}/bank-accounts`, data),

  updateBankAccount: (reassureurId: string, bankId: string, data: any) =>
    api.put(`/master-data/reassureurs/${reassureurId}/bank-accounts/${bankId}`, data),

  deleteBankAccount: (reassureurId: string, bankId: string) =>
    api.delete(`/master-data/reassureurs/${reassureurId}/bank-accounts/${bankId}`),

  // NOTE: no matching controller route seen either — findOne() already includes
  // `participations` in its response, so this may simply be redundant rather than
  // broken. Kept as-is.
  getParticipations: (id: string) =>
    api.get(`/master-data/reassureurs/${id}/participations`),
};

// ============================================================
// CO-COURTIERS (Courtiers en réassurance)
// ============================================================

export const coCourtiersApi = {
  getAll: (params?: ListParams) =>
    api.get<CoCourtiersListResponse>('/master-data/co-courtiers', { params }),

  getOne: (id: string) =>
    api.get<CoCourtier>(`/master-data/co-courtiers/${id}`),

  create: (data: CreateCoCourtierDto) =>
    api.post<CoCourtier>('/master-data/co-courtiers', data),

  update: (id: string, data: UpdateCoCourtierDto) =>
    api.put<CoCourtier>(`/master-data/co-courtiers/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/master-data/co-courtiers/${id}`),

  overrideCode: (id: string, code: string) =>
    api.post<CoCourtier>(`/master-data/co-courtiers/${id}/override-code`, { code }),

  // Bulk Excel/CSV import — mirrors cedantesApi.bulkImport() exactly.
  bulkImport: (items: BulkImportCoCourtierItem[]) =>
    api.post<{ total: number; created: number; failed: number; results: any[] }>(
      '/master-data/co-courtiers/bulk-import',
      { items },
    ),

  // Bulk edit — applies only the fields present in `data` to every id in `ids`.
  bulkUpdate: (ids: string[], data: BulkUpdateCoCourtierData) =>
    api.put<{ updated: number }>('/master-data/co-courtiers/bulk-update', { ids, data }),

  // Bulk deactivate — NOTE: unlike Assure/Cedante/Reassureur, CoCourtierService.remove()
  // has no active-participation guard yet (no AffaireCoCourtier relation exists — see
  // the TODO in co-courtiers.service.ts). bulkDelete() inherits that same gap; it will
  // deactivate every valid id unconditionally rather than skipping ones in active deals.
  bulkDelete: (ids: string[]) =>
    api.post<{ total: number; deactivated: number; failed: number; results: any[] }>(
      '/master-data/co-courtiers/bulk-delete',
      { ids },
    ),

  // NOTE: see assuresApi note above — kept as-is, route existence unverified.
  getContacts: (id: string) =>
    api.get(`/master-data/co-courtiers/${id}/contacts`),

  addContact: (id: string, data: any) =>
    api.post(`/master-data/co-courtiers/${id}/contacts`, data),

  updateContact: (coCourtId: string, contactId: string, data: any) =>
    api.put(`/master-data/co-courtiers/${coCourtId}/contacts/${contactId}`, data),

  deleteContact: (coCourtId: string, contactId: string) =>
    api.delete(`/master-data/co-courtiers/${coCourtId}/contacts/${contactId}`),

  getBankAccounts: (id: string) =>
    api.get(`/master-data/co-courtiers/${id}/bank-accounts`),

  addBankAccount: (id: string, data: any) =>
    api.post(`/master-data/co-courtiers/${id}/bank-accounts`, data),

  updateBankAccount: (coCourtId: string, bankId: string, data: any) =>
    api.put(`/master-data/co-courtiers/${coCourtId}/bank-accounts/${bankId}`, data),

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