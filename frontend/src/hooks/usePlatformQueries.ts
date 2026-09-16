import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import platformApi from '../lib/platformApi';
import { getErrorMessage } from './useQueries';
import type {
  Plan,
  CreatePlanRequest,
  TenantListItem,
  TenantDetail,
  TenantUsage,
  TenantStatus,
  AuditLogEntry,
  DashboardMetrics,
  GrowthPoint,
  RevenueByPlan,
  PaginatedResponse,
  CreateTenantRequest,
  CreateTenantResponse,
} from '../types/superadmin';

type MutationOptions<TData = unknown, TVariables = unknown> = {
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => void;
};

export interface TenantFilters {
  status?: TenantStatus;
  planId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

// Dashboard
export const useDashboardMetrics = () =>
  useQuery({
    queryKey: ['platform', 'dashboard', 'metrics'],
    queryFn: async () => (await platformApi.get<DashboardMetrics>('/dashboard/metrics')).data,
  });

export const useDashboardGrowth = () =>
  useQuery({
    queryKey: ['platform', 'dashboard', 'growth'],
    queryFn: async () => (await platformApi.get<GrowthPoint[]>('/dashboard/growth')).data,
  });

export const useDashboardRevenueByPlan = () =>
  useQuery({
    queryKey: ['platform', 'dashboard', 'revenue-by-plan'],
    queryFn: async () => (await platformApi.get<RevenueByPlan[]>('/dashboard/revenue-by-plan')).data,
  });

// Tenants
export const useTenants = (filters: TenantFilters) =>
  useQuery({
    queryKey: ['platform', 'tenants', filters],
    queryFn: async () => (await platformApi.get<PaginatedResponse<TenantListItem>>('/tenants', { params: filters })).data,
  });

export const useCreateTenant = (options?: MutationOptions<CreateTenantResponse, CreateTenantRequest>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateTenantRequest) => (await platformApi.post<CreateTenantResponse>('/tenants', data)).data,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useTenantDetail = (id: string | undefined) =>
  useQuery({
    queryKey: ['platform', 'tenants', id],
    queryFn: async () => (await platformApi.get<{ tenant: TenantDetail; usage: TenantUsage }>(`/tenants/${id}`)).data,
    enabled: !!id,
  });

export const useTenantActivity = (id: string | undefined) =>
  useQuery({
    queryKey: ['platform', 'tenants', id, 'activity'],
    queryFn: async () => (await platformApi.get<AuditLogEntry[]>(`/tenants/${id}/activity`)).data,
    enabled: !!id,
  });

export const useUpdateTenantStatus = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TenantStatus }) =>
      (await platformApi.patch(`/tenants/${id}/status`, { status })).data,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useDeleteTenant = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, confirmSlug }: { id: string; confirmSlug: string }) =>
      (await platformApi.delete(`/tenants/${id}`, { data: { confirmSlug } })).data,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'tenants'] });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useImpersonateTenant = () =>
  useMutation({
    mutationFn: async (id: string) =>
      (await platformApi.post<{ token: string; expiresIn: string }>(`/tenants/${id}/impersonate`)).data,
  });

// Plans
export const usePlans = () =>
  useQuery({
    queryKey: ['platform', 'plans'],
    queryFn: async () => (await platformApi.get<Plan[]>('/plans')).data,
  });

export const useCreatePlan = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreatePlanRequest) => (await platformApi.post<Plan>('/plans', data)).data,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'plans'] });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useUpdatePlan = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreatePlanRequest> }) =>
      (await platformApi.put<Plan>(`/plans/${id}`, data)).data,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'plans'] });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useDeletePlan = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await platformApi.delete(`/plans/${id}`)).data,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['platform', 'plans'] });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export { getErrorMessage };
