import api from '../lib/api';
import {
  TreatyParameterVersion, CreateTreatyParameterVersionInput,
  UpdateTreatyParameterVersionInput, RenewTreatyParameterVersionInput,
} from '../types/treaty-parameters.types';

export const treatyParametersApi = {
  getActive: (affaireId: string) => api.get<TreatyParameterVersion>(`/traites/${affaireId}/parameters/active`),
  getHistory: (affaireId: string) => api.get<TreatyParameterVersion[]>(`/traites/${affaireId}/parameters/history`),
  createInitial: (affaireId: string, data: CreateTreatyParameterVersionInput) =>
    api.post<TreatyParameterVersion>(`/traites/${affaireId}/parameters`, data),
  supersede: (affaireId: string, data: UpdateTreatyParameterVersionInput) =>
    api.put<TreatyParameterVersion>(`/traites/${affaireId}/parameters/active`, data),
  renew: (affaireId: string, data: RenewTreatyParameterVersionInput) =>
    api.post<TreatyParameterVersion>(`/traites/${affaireId}/parameters/renew`, data),
};

export default treatyParametersApi;