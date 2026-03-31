import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';
import type { Client, Project, Invoice, Product, Category, Ticket, Subscription, Appointment, GalleryItem } from '../types';

// Clients
export const useClients = () => {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await api.get<Client[]>('/clients');
      return response.data;
    },
  });
};

// Projects
export const useProjects = () => {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get<Project[]>('/projects');
      return response.data;
    },
  });
};

// Invoices
export const useInvoices = () => {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const response = await api.get<Invoice[]>('/invoices');
      return response.data;
    },
  });
};

// Products
export const useProducts = () => {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await api.get<Product[]>('/products');
      return response.data;
    },
  });
};

// Categories
export const useCategories = (type?: string) => {
  return useQuery({
    queryKey: ['categories', type],
    queryFn: async () => {
      const url = type ? `/categories?type=${type}` : '/categories';
      const response = await api.get<Category[]>(url);
      return response.data;
    },
  });
};

// Tickets
export const useTickets = () => {
  return useQuery({
    queryKey: ['tickets'],
    queryFn: async () => {
      const response = await api.get<Ticket[]>('/tickets');
      return response.data;
    },
  });
};

// Mutations
export const useUpdateClient = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, clientData }: { id: string; clientData: any }) => {
      const response = await api.put(`/clients/${id}`, clientData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteClient = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/clients/${id}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCreateClient = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (clientData: any) => {
      const response = await api.post('/clients', clientData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateProject = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, projectData }: { id: string; projectData: any }) => {
      const response = await api.put(`/projects/${id}`, projectData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteProject = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/projects/${id}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCreateProject = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (projectData: any) => {
      const response = await api.post('/projects', projectData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCreateInvoice = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (invoiceData: any) => {
      const response = await api.post('/invoices', invoiceData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateInvoice = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, invoiceData }: { id: string; invoiceData: any }) => {
      const response = await api.put(`/invoices/${id}`, invoiceData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteInvoice = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/invoices/${id}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateProduct = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, productData }: { id: string; productData: any }) => {
      const response = await api.put(`/products/${id}`, productData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteProduct = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCreateProduct = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (productData: any) => {
      const response = await api.post('/products', productData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCreateCategory = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (categoryData: any) => {
      const response = await api.post('/categories', categoryData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateCategory = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, categoryData }: { id: string; categoryData: any }) => {
      const response = await api.put(`/categories/${id}`, categoryData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteCategory = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCreateTicket = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (ticketData: any) => {
      const response = await api.post('/tickets', ticketData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useSubscriptions = () => {
  return useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const response = await api.get<Subscription[]>('/subscriptions');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateSubscription = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (subscriptionData: any) => {
      const response = await api.post('/subscriptions', subscriptionData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCancelSubscription = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      const response = await api.put(`/subscriptions/${id}/cancel`, {});
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteSubscription = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/subscriptions/${id}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useRenewSubscription = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      const response = await api.post(`/subscriptions/${id}/renew`, {});
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// Portal hooks - Client-specific data
export const useMyInvoices = () => {
  return useQuery({
    queryKey: ['my-invoices'],
    queryFn: async () => {
      const response = await api.get<Invoice[]>('/portal/my-invoices');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useMySubscriptions = () => {
  return useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: async () => {
      const response = await api.get<Subscription[]>('/portal/my-subscriptions');
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useMyProfile = () => {
  return useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const response = await api.get<any>('/portal/my-profile');
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useClientProfile = () => {
  return useQuery({
    queryKey: ['client-profile'],
    queryFn: async () => {
      const response = await api.get<any>('/portal/my-profile');
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useUpdateClientProfile = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (profileData: any) => {
      const response = await api.put('/portal/my-profile', profileData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['client-profile'] });
      toast.success('Perfil guardado correctamente');
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// Knowledge Base
export const useKnowledgeBase = () => {
  return useQuery({
    queryKey: ['knowledge-base'],
    queryFn: async () => {
      const response = await api.get<any[]>('/knowledge-base');
      return response.data;
    },
  });
};

export const useCreateKnowledgeBase = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (articleData: any) => {
      const response = await api.post('/knowledge-base', articleData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateKnowledgeBase = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, articleData }: { id: string; articleData: any }) => {
      const response = await api.put(`/knowledge-base/${id}`, articleData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteKnowledgeBase = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/knowledge-base/${id}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge-base'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// Ticket Messages
export const useTicketMessages = (ticketId: string) => {
  return useQuery({
    queryKey: ['ticket-messages', ticketId],
    queryFn: async () => {
      const response = await api.get<any[]>(`/tickets/${ticketId}/messages`);
      return response.data;
    },
    enabled: !!ticketId,
  });
};

export const useCreateTicketMessage = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ ticketId, messageData }: { ticketId: string; messageData: any }) => {
      const response = await api.post(`/tickets/${ticketId}/messages`, messageData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      const { ticketId } = variables;
      queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// Ticket Updates
export const useUpdateTicket = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, ticketData }: { id: string; ticketData: any }) => {
      const response = await api.patch(`/tickets/${id}`, ticketData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// Appointments
export const useAppointments = () => {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const response = await api.get<Appointment[]>('/appointments');
      return response.data;
    },
  });
};

export const useCreateAppointment = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (appointmentData: any) => {
      const response = await api.post('/appointments', appointmentData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// Available Slots
export const useAvailableSlots = (date: string) => {
  return useQuery({
    queryKey: ['available-slots', date],
    queryFn: async () => {
      const response = await api.get<string[]>(`/portal/available-slots?date=${date}`);
      return response.data;
    },
    enabled: !!date,
  });
};

export const useUpdateAppointment = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, appointmentData }: { id: string; appointmentData: any }) => {
      const response = await api.put(`/appointments/${id}`, appointmentData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteAppointment = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/appointments/${id}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error en la operación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// ==================== CLIENT PORTAL HOOKS ====================

/**
 * Hook para obtener las citas del cliente autenticado
 * Usa endpoint /api/portal/my-appointments
 */
export const useClientAppointments = () => {
  return useQuery({
    queryKey: ['client-appointments'],
    queryFn: async () => {
      const response = await api.get<Appointment[]>('/portal/my-appointments');
      return response.data;
    },
  });
};

/**
 * Hook para obtener los productos/servicios disponibles para clientes
 * Usa endpoint /api/portal/products
 */
export const useClientProducts = () => {
  return useQuery({
    queryKey: ['client-products'],
    queryFn: async () => {
      const response = await api.get<Product[]>('/portal/products');
      return response.data;
    },
  });
};

// Gallery (inspiration)
export const useGalleryItems = () => {
  return useQuery({
    queryKey: ['gallery-items'],
    queryFn: async () => {
      const response = await api.get<GalleryItem[]>('/gallery');
      return response.data;
    },
  });
};

export const useAdminGalleryItems = () => {
  return useQuery({
    queryKey: ['admin-gallery-items'],
    queryFn: async () => {
      const response = await api.get<GalleryItem[]>('/gallery/admin');
      return response.data;
    },
  });
};

export const useCreateGalleryItem = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};

  return useMutation({
    ...otherOptions,
    mutationFn: async (payload: any) => {
      const response = await api.post('/gallery', payload);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Error creando elemento de galería.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery-items'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateGalleryItem = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};

  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const response = await api.put(`/gallery/${id}`, payload);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Error actualizando elemento de galería.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery-items'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteGalleryItem = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};

  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/gallery/${id}`);
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Error eliminando elemento de galería.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery-items'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

/**
 * Hook para crear una nueva cita como cliente
 * Usa endpoint /api/portal/appointments
 */
export const useCreateClientAppointment = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (appointmentData: any) => {
      const response = await api.post('/portal/appointments', appointmentData);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error al crear la cita.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// ==================== NOTIFICATION HOOKS ====================

/**
 * Hook para obtener todas las notificaciones (Admin)
 * Usa endpoint /api/notifications
 */
export const useNotifications = () => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications');
      return response.data;
    },
  });
};

/**
 * Hook para obtener las notificaciones del cliente autenticado
 * Usa endpoint /api/notifications/client
 * Incluye polling suave cada 30 segundos
 */
export const useClientNotifications = () => {
  return useQuery({
    queryKey: ['client-notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications/client');
      return response.data;
    },
    refetchInterval: 30000, // Polling cada 30 segundos
  });
};

/**
 * Hook para marcar una notificación como leída
 * Usa endpoint PUT /api/notifications/:id/read
 */
export const useMarkNotificationAsRead = (options?: any) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (notificationId: string) => {
      const response = await api.put(`/notifications/${notificationId}/read`);
      return response.data;
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'Ocurrió un error al actualizar la notificación.';
      toast.error(errorMessage);
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['client-notifications'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};
