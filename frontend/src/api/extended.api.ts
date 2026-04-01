import api from '../lib/api';

export interface FourStepPaymentData {
  affaireId: string;
  step1: {
    montant: number;
    dateEncaissement: Date;
    referencePaiement: string;
    modePaiement: string;
  };
  step2: {
    montant: number;
    dateDecaissement: Date;
    referencePaiement: string;
    modePaiement: string;
  };
  step3: {
    montant: number;
    dateEncaissement: Date;
    referencePaiement: string;
    modePaiement: string;
  };
  step4: {
    payments: Array<{
      reassureurId: string;
      montant: number;
      dateDecaissement: Date;
      referencePaiement: string;
      modePaiement: string;
    }>;
  };
}

export const fourStepPaymentApi = {
  executeStep1: async (data: { affaireId: string; montant: number; dateEncaissement: Date; referencePaiement: string; modePaiement: string }) => {
    const response = await api.post('/finances/four-step-payment/step1', data);
    return response.data;
  },

  executeStep2: async (data: { affaireId: string; montant: number; dateDecaissement: Date; referencePaiement: string; modePaiement: string }) => {
    const response = await api.post('/finances/four-step-payment/step2', data);
    return response.data;
  },

  executeStep3: async (data: { affaireId: string; montant: number; dateEncaissement: Date; referencePaiement: string; modePaiement: string }) => {
    const response = await api.post('/finances/four-step-payment/step3', data);
    return response.data;
  },

  executeStep4: async (data: { affaireId: string; payments: any[] }) => {
    const response = await api.post('/finances/four-step-payment/step4', data);
    return response.data;
  },

  executeComplete: async (data: FourStepPaymentData) => {
    const response = await api.post('/finances/four-step-payment/complete', data);
    return response.data;
  },
};

export const swiftApi = {
  uploadConfirmation: async (decaissementId: string, swiftDocumentUrl: string) => {
    const response = await api.post(`/finances/decaissements/${decaissementId}/swift-upload`, {
      swiftDocumentUrl,
    });
    return response.data;
  },
};

export const pmdApi = {
  createSchedule: async (affaireId: string, pmdTotal: number, instalments: Array<{ percentage: number; daysFromStart: number }>) => {
    const response = await api.post('/pmd-instalments/schedule', {
      affaireId,
      pmdTotal,
      instalments,
    });
    return response.data;
  },

  getByAffaire: async (affaireId: string) => {
    const response = await api.get(`/pmd-instalments/affaire/${affaireId}`);
    return response.data;
  },

  markAsPaid: async (id: string, montantPaye: number, referencePaiement: string, datePaiement: Date) => {
    const response = await api.post(`/pmd-instalments/${id}/pay`, {
      montantPaye,
      referencePaiement,
      datePaiement,
    });
    return response.data;
  },

  sendReminder: async (id: string) => {
    const response = await api.post(`/pmd-instalments/${id}/reminder`);
    return response.data;
  },
};

export const treatyParametersApi = {
  create: async (data: any) => {
    const response = await api.post('/treaty-parameters', data);
    return response.data;
  },

  getByAffaire: async (affaireId: string, activeOnly = true) => {
    const response = await api.get(`/treaty-parameters/affaire/${affaireId}`, {
      params: { activeOnly },
    });
    return response.data;
  },

  getActive: async (affaireId: string) => {
    const response = await api.get(`/treaty-parameters/affaire/${affaireId}/active`);
    return response.data;
  },

  update: async (id: string, data: any, motif?: string) => {
    const response = await api.patch(`/treaty-parameters/${id}`, { ...data, motif });
    return response.data;
  },

  renew: async (affaireId: string, modifications?: any) => {
    const response = await api.post(`/treaty-parameters/affaire/${affaireId}/renew`, modifications || {});
    return response.data;
  },

  getHistory: async (affaireId: string) => {
    const response = await api.get(`/treaty-parameters/affaire/${affaireId}/history`);
    return response.data;
  },
};

export const guaranteeLinesApi = {
  create: async (data: any) => {
    const response = await api.post('/guarantee-lines', data);
    return response.data;
  },

  getByAffaire: async (affaireId: string) => {
    const response = await api.get(`/guarantee-lines/affaire/${affaireId}`);
    return response.data;
  },

  getTotals: async (affaireId: string) => {
    const response = await api.get(`/guarantee-lines/affaire/${affaireId}/totals`);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/guarantee-lines/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/guarantee-lines/${id}`);
    return response.data;
  },

  reorder: async (affaireId: string, lineIds: string[]) => {
    const response = await api.post(`/guarantee-lines/affaire/${affaireId}/reorder`, { lineIds });
    return response.data;
  },
};

export const documentChecklistApi = {
  getChecklist: async (affaireId: string) => {
    const response = await api.get(`/document-checklist/affaire/${affaireId}`);
    return response.data;
  },

  updateChecklist: async (affaireId: string, updates: Record<string, boolean>) => {
    const response = await api.patch(`/document-checklist/affaire/${affaireId}`, updates);
    return response.data;
  },

  validateForStatusChange: async (affaireId: string, newStatus: string) => {
    const response = await api.post(`/document-checklist/affaire/${affaireId}/validate`, { newStatus });
    return response.data;
  },

  initialize: async (affaireId: string) => {
    const response = await api.post(`/document-checklist/affaire/${affaireId}/initialize`);
    return response.data;
  },

  getSummary: async (affaireIds: string[]) => {
    const response = await api.post('/document-checklist/summary', { affaireIds });
    return response.data;
  },
};

export const cashCallApi = {
  create: async (data: any) => {
    const response = await api.post('/cash-calls', data);
    return response.data;
  },

  getAll: async (filters?: any) => {
    const response = await api.get('/cash-calls', { params: filters });
    return response.data;
  },

  getOne: async (id: string) => {
    const response = await api.get(`/cash-calls/${id}`);
    return response.data;
  },

  update: async (id: string, data: any) => {
    const response = await api.patch(`/cash-calls/${id}`, data);
    return response.data;
  },

  addCommunication: async (id: string, data: any) => {
    const response = await api.post(`/cash-calls/${id}/communications`, data);
    return response.data;
  },

  addSuivi: async (id: string, data: any) => {
    const response = await api.post(`/cash-calls/${id}/suivis`, data);
    return response.data;
  },

  sendReminder: async (id: string) => {
    const response = await api.post(`/cash-calls/${id}/reminder`);
    return response.data;
  },

  markAsPaid: async (id: string, montantRecu: number, referencePaiement: string) => {
    const response = await api.post(`/cash-calls/${id}/mark-paid`, {
      montantRecu,
      referencePaiement,
    });
    return response.data;
  },
};
