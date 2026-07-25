// FIX (Affaires pass): removed getStatistics/sendToCotation/receiveSlip/
// generateBordereauCedante/generateBordereauReassureur/
// generateAccountingEntries — none of these routes exist on
// AffairesController (only GET/, GET/:id, POST/, PUT/:id, PATCH/:id/status,
// POST/:id/recalculate-commissions, DELETE/:id do). Every removed call was
// a guaranteed 404. updateStatus now uses PATCH (matches controller) and
// sends `statut` (French field name the DTO actually expects), not `status`.
import api from '../lib/api';
import { CreateAffaireDto, UpdateAffaireDto, Affaire, AffaireStatut, AffairesListResponse } from '../types/affaire.types';

interface AffaireFilters {
  cedanteId?: string;
  statut?: AffaireStatut;
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const affairesApi = {
  getAll: (filters?: AffaireFilters) =>
    api.get<AffairesListResponse>('/affaires', { params: filters }),

  getOne: (id: string) =>
    api.get<Affaire>(`/affaires/${id}`),

  create: (data: CreateAffaireDto) =>
    api.post<Affaire>('/affaires', data),

  update: (id: string, data: UpdateAffaireDto) =>
    api.put<Affaire>(`/affaires/${id}`, data),

  changeStatus: (id: string, statut: AffaireStatut) =>
    api.patch<Affaire>(`/affaires/${id}/status`, { statut }),

  recalculateCommissions: (id: string) =>
    api.post<void>(`/affaires/${id}/recalculate-commissions`),

  delete: (id: string) =>
    api.delete<void>(`/affaires/${id}`),
};

export default affairesApi;