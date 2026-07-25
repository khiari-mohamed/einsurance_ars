import api from '../lib/api';
import {
  WorkflowTasksListResponse, WorkflowTaskFilters, WorkflowTask, CreateWorkflowTaskInput,
  AuditHistoryResponse, AuditHistoryFilters,
} from '../types/workflow.types';

export const workflowApi = {
  getTasks: (filters?: WorkflowTaskFilters) =>
    api.get<WorkflowTasksListResponse>('/workflow/tasks', { params: filters }),

  createTask: (data: CreateWorkflowTaskInput) =>
    api.post<WorkflowTask>('/workflow/tasks', data),

  claimTask: (id: string) =>
    api.patch<WorkflowTask>(`/workflow/tasks/${id}/claim`),

  completeTask: (id: string, note?: string) =>
    api.patch<WorkflowTask>(`/workflow/tasks/${id}/complete`, { note }),

  cancelTask: (id: string) =>
    api.patch<WorkflowTask>(`/workflow/tasks/${id}/cancel`),

  getAuditHistory: (filters?: AuditHistoryFilters) =>
    api.get<AuditHistoryResponse>('/workflow/audit-history', { params: filters }),
};

export default workflowApi;