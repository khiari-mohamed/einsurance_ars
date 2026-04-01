import api from '../lib/api';
import { CreateAffaireData, AffaireStatus } from '../types/affaire.types';

export const affairesApi = {
  getAll: (filters?: any) => api.get('/affaires', { params: filters }),
  getOne: (id: string) => api.get(`/affaires/${id}`),
  getStatistics: (filters?: any) => api.get('/affaires/statistics/summary', { params: filters }),
  create: (data: CreateAffaireData) => api.post('/affaires', data),
  update: (id: string, data: any) => api.put(`/affaires/${id}`, data),
  updateStatus: (id: string, status: AffaireStatus) => api.put(`/affaires/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/affaires/${id}`),
  sendToCotation: (id: string) => api.post(`/affaires/${id}/send-cotation`),
  receiveSlip: (id: string, data: { slipReference: string; signedReinsurers: string[] }) => 
    api.post(`/affaires/${id}/receive-slip`, data),
  generateBordereauCedante: (id: string) => api.get(`/affaires/${id}/bordereau/cedante`),
  generateBordereauReassureur: (id: string, reassureurId: string) =>
    api.get(`/affaires/${id}/bordereau/reassureur/${reassureurId}`),
  generateAccountingEntries: (id: string) => api.get(`/affaires/${id}/accounting-entries`),
};
