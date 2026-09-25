import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../lib/api';
import { getErrorMessage } from './useQueries';
import type { BillingStatusResponse } from '../types/billing';

export const useBillingStatus = () =>
  useQuery({
    queryKey: ['billing', 'status'],
    queryFn: async () => (await api.get<BillingStatusResponse>('/billing/status')).data,
  });

export const useCreateBillingCheckout = () =>
  useMutation({
    mutationFn: async () => (await api.post<{ redirectUrl: string }>('/billing/checkout')).data,
  });

export { getErrorMessage };
