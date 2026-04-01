import api from '../lib/api';

export const slipsApi = {
  getAll: (filters?: any) => api.get('/slips', { params: filters }),
  getOne: (id: string) => api.get(`/slips/${id}`),
  createCotation: (affaireId: string, reassureurIds: string[]) => 
    api.post('/slips/cotation', { affaireId, reassureurIds }),
  receiveCotation: (slipId: string, data: any) => 
    api.post(`/slips/${slipId}/receive`, data),
  acceptCotation: (slipId: string) => 
    api.post(`/slips/${slipId}/accept`),
  generateCouverture: (affaireId: string, leadReassureurId: string) => 
    api.post('/slips/couverture', { affaireId, leadReassureurId }),
  signCouverture: (slipId: string, data: any) => 
    api.post(`/slips/${slipId}/sign`, data),
};

export const exchangeRateApi = {
  getLatest: (devise: string) => api.get(`/exchange-rates/latest/${devise}`),
  convert: (montant: number, from: string, to: string) => 
    api.post('/exchange-rates/convert', { montant, deviseSource: from, deviseCible: to }),
  fetchFromBCT: () => api.post('/exchange-rates/fetch-bct'),
  getHistorical: (devise: string, startDate: string, endDate: string) => 
    api.get(`/exchange-rates/historical/${devise}`, { params: { startDate, endDate } }),
};

export const importExportApi = {
  exportAffaires: (filters?: any) => 
    api.get('/import-export/affaires/export', { params: filters, responseType: 'blob' }),
  exportSinistres: (filters?: any) => 
    api.get('/import-export/sinistres/export', { params: filters, responseType: 'blob' }),
  exportFinances: (startDate: string, endDate: string) => 
    api.get('/import-export/finances/export', { params: { startDate, endDate }, responseType: 'blob' }),
  importAffaires: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/import-export/affaires/import', formData);
  },
  downloadTemplate: (entityType: string) => 
    api.get(`/import-export/template/${entityType}`, { responseType: 'blob' }),
};

export const backupApi = {
  create: () => api.post('/backup/create'),
  list: () => api.get('/backup/list'),
  restore: (filename: string) => api.post('/backup/restore', { filename }),
  download: (filename: string) => 
    api.get(`/backup/download/${filename}`, { responseType: 'blob' }),
};

export const prospectionApi = {
  getProspects: (filters?: any) => api.get('/prospection/prospects', { params: filters }),
  createProspect: (data: any) => api.post('/prospection/prospects', data),
  updateProspectStatus: (id: string, status: string) => 
    api.patch(`/prospection/prospects/${id}/status`, { status }),
  convertToCedante: (id: string) => api.post(`/prospection/prospects/${id}/convert`),
  getRenewals: (filters?: any) => api.get('/prospection/renewals', { params: filters }),
  getRenewalsDue: (days?: number) => api.get('/prospection/renewals/due', { params: { days } }),
  getStats: () => api.get('/prospection/stats'),
};

export const treatyApi = {
  calculatePMD: (primePrevisionnelle: number, treatyType: string, tauxPMD?: number) => 
    api.post('/treaties/calculate-pmd', { primePrevisionnelle, treatyType, tauxPMD }),
  calculateQP: (capitalAssure: number, tauxCession: number, pleinConservation: number) => 
    api.post('/treaties/calculate-qp', { capitalAssure, tauxCession, pleinConservation }),
  calculateXOL: (portee: number, franchise: number, tauxPrime: number, nombreReinstatements?: number) => 
    api.post('/treaties/calculate-xol', { portee, franchise, tauxPrime, nombreReinstatements }),
  calculateSurplus: (pleinConservation: number, nombrePleins: number, capitalAssure: number) => 
    api.post('/treaties/calculate-surplus', { pleinConservation, nombrePleins, capitalAssure }),
  validateStructure: (treatyType: string, data: any) => 
    api.post('/treaties/validate', { treatyType, data }),
};
