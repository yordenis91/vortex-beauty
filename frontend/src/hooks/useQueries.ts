import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';
import type {
  Client,
  Product,
  Category,
  Appointment,
  GalleryItem,
  ClosedDate,
  ScheduleOverride,
  Staff,
  Notification,
  ClientProfileResponse,
  UpdateClientProfileRequest,
  CreateGalleryItemRequest,
  CreateClientRequest,
  CreateProductRequest,
  CreateCategoryRequest,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  CreateStaffRequest,
} from '../types';

// Extrae un mensaje legible de un error de axios (o de cualquier otro tipo)
// sin depender de `any` para acceder a sus campos.
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const err = error as { response?: { data?: { error?: string } }; message?: string };
    return err.response?.data?.error || err.message || fallback;
  }
  return fallback;
}

// Opciones extra que aceptan los hooks de mutación de este archivo, además
// de las que ya define useMutation. En la práctica solo se usa onSuccess.
type MutationOptions<TData = unknown, TVariables = unknown> = {
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => void;
};

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
// Invoices
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
// Mutations
export const useUpdateClient = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, clientData }: { id: string; clientData: Partial<CreateClientRequest> }) => {
      const response = await api.put(`/clients/${id}`, clientData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteClient = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/clients/${id}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCreateClient = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (clientData: CreateClientRequest) => {
      const response = await api.post('/clients', clientData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateProduct = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, productData }: { id: string; productData: Partial<CreateProductRequest> }) => {
      const response = await api.put(`/products/${id}`, productData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteProduct = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCreateProduct = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (productData: CreateProductRequest) => {
      const response = await api.post('/products', productData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCreateCategory = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (categoryData: CreateCategoryRequest) => {
      const response = await api.post('/categories', categoryData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateCategory = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, categoryData }: { id: string; categoryData: Partial<CreateCategoryRequest> }) => {
      const response = await api.put(`/categories/${id}`, categoryData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteCategory = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/categories/${id}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// Portal hooks - Client-specific data
export const useMyProfile = () => {
  return useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const response = await api.get<ClientProfileResponse>('/portal/my-profile');
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useClientProfile = () => {
  return useQuery({
    queryKey: ['client-profile'],
    queryFn: async () => {
      const response = await api.get<ClientProfileResponse>('/portal/my-profile');
      return response.data;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useUpdateClientProfile = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (profileData: UpdateClientProfileRequest) => {
      const response = await api.put('/portal/my-profile', profileData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['client-profile'] });
      toast.success('Perfil guardado correctamente');
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// Knowledge Base
// Ticket Messages
// Ticket Updates
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

export const useCreateAppointment = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (appointmentData: CreateAppointmentRequest) => {
      const response = await api.post('/appointments', appointmentData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['fully-booked-dates'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// Available Slots
// productId es opcional: si se manda, el backend filtra los huecos usando la
// duración real de ese servicio en vez de solo el instante de inicio.
export const useAvailableSlots = (date: string, productId?: string) => {
  return useQuery({
    queryKey: ['available-slots', date, productId],
    queryFn: async () => {
      const params = new URLSearchParams({ date });
      if (productId) params.set('productId', productId);
      const response = await api.get<string[]>(`/portal/available-slots?${params.toString()}`);
      return response.data;
    },
    enabled: !!date,
  });
};

export const useUpdateAppointment = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, appointmentData }: { id: string; appointmentData: UpdateAppointmentRequest }) => {
      const response = await api.put(`/appointments/${id}`, appointmentData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['fully-booked-dates'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteAppointment = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/appointments/${id}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['fully-booked-dates'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// ==================== CLOSED DATES HOOKS ====================

/**
 * Hook para obtener todos los días cerrados (vacaciones, feriados, etc.)
 * Usa endpoint /api/closed-dates
 */
export const useClosedDates = () => {
  return useQuery({
    queryKey: ['closed-dates'],
    queryFn: async () => {
      const response = await api.get<ClosedDate[]>('/closed-dates');
      return response.data;
    },
  });
};

/**
 * Hook para crear un nuevo día cerrado
 * Usa endpoint POST /api/closed-dates
 */
export const useCreateClosedDate = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (closedDateData: { date: string; reason?: string }) => {
      const response = await api.post('/closed-dates', closedDateData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['closed-dates'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

/**
 * Hook para eliminar un día cerrado
 * Usa endpoint DELETE /api/closed-dates/:id
 */
export const useDeleteClosedDate = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/closed-dates/${id}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['closed-dates'] });
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
 * Hook para cancelar una cita del cliente autenticado
 * Usa endpoint PATCH /api/portal/appointments/:id/cancel
 */
export const useCancelAppointment = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};

  return useMutation({
    ...otherOptions,
    mutationFn: async (appointmentId: string) => {
      const response = await api.patch(`/portal/appointments/${appointmentId}/cancel`);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'No se pudo cancelar la cita. Intenta nuevamente.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['client-appointments'] });
      toast.success('Cita cancelada exitosamente');
      if (customOnSuccess) customOnSuccess(data, variables, context);
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

export const useCreateGalleryItem = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};

  return useMutation({
    ...otherOptions,
    mutationFn: async (payload: CreateGalleryItemRequest) => {
      const response = await api.post('/gallery', payload);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Error creando elemento de galería.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery-items'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateGalleryItem = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};

  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<CreateGalleryItemRequest> }) => {
      const response = await api.put(`/gallery/${id}`, payload);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Error actualizando elemento de galería.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery-items'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteGalleryItem = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};

  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/gallery/${id}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Error eliminando elemento de galería.'));
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
export const useCreateClientAppointment = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (appointmentData: CreateAppointmentRequest) => {
      const response = await api.post('/portal/appointments', appointmentData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error al crear la cita.'));
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
      const response = await api.get<Notification[]>('/notifications');
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
      const response = await api.get<Notification[]>('/notifications/client');
      return response.data;
    },
    refetchInterval: 30000, // Polling cada 30 segundos
  });
};

/**
 * Hook para marcar una notificación como leída
 * Usa endpoint PUT /api/notifications/:id/read
 */
export const useMarkNotificationAsRead = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (notificationId: string) => {
      const response = await api.put(`/notifications/${notificationId}/read`);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error al actualizar la notificación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['client-notifications'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// ==================== SCHEDULE OVERRIDE HOOKS ====================

/**
 * Hook para obtener todas las excepciones de horario
 * Usa endpoint /api/overrides
 */
export const useScheduleOverrides = () => {
  return useQuery({
    queryKey: ['schedule-overrides'],
    queryFn: async () => {
      const response = await api.get<ScheduleOverride[]>('/overrides');
      return response.data;
    },
  });
};

/**
 * Hook para obtener una excepción de horario específica por fecha
 * Usa endpoint /api/overrides/:date
 */
export const useScheduleOverride = (date: string) => {
  return useQuery({
    queryKey: ['schedule-override', date],
    queryFn: async () => {
      const response = await api.get<ScheduleOverride>(`/overrides/${date}`);
      return response.data;
    },
    enabled: !!date,
  });
};

/**
 * Hook para crear o actualizar una excepción de horario
 * Usa endpoint PUT /api/overrides/:date
 */
export const useUpsertScheduleOverride = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ date, timeSlots }: { date: string; timeSlots: string[] }) => {
      const response = await api.put(`/overrides/${date}`, { date, timeSlots });
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error al guardar la excepción de horario.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-override', variables.date] });
      queryClient.invalidateQueries({ queryKey: ['fully-booked-dates'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

/**
 * Hook para eliminar una excepción de horario
 * Usa endpoint DELETE /api/overrides/:date
 */
export const useDeleteScheduleOverride = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (date: string) => {
      await api.delete(`/overrides/${date}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error al eliminar la excepción de horario.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-override', variables] });
      queryClient.invalidateQueries({ queryKey: ['fully-booked-dates'] });
      queryClient.invalidateQueries({ queryKey: ['available-slots'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

// ==================== FULLY BOOKED DATES HOOKS ====================

/**
 * Hook para obtener las fechas que están 100% reservadas
 * Usa endpoint /api/appointments/fully-booked-dates
 * Devuelve array de strings en formato YYYY-MM-DD
 */
export const useFullyBookedDates = () => {
  return useQuery({
    queryKey: ['fully-booked-dates'],
    queryFn: async () => {
      const response = await api.get<string[]>('/appointments/fully-booked-dates');
      return response.data;
    },
  });
};

// ==================== STAFF HOOKS ====================

export const useStaff = (activeOnly?: boolean) => {
  return useQuery({
    queryKey: ['staff', activeOnly],
    queryFn: async () => {
      const url = activeOnly ? '/staff?active=true' : '/staff';
      const response = await api.get<Staff[]>(url);
      return response.data;
    },
  });
};

export const useCreateStaff = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (staffData: CreateStaffRequest) => {
      const response = await api.post('/staff', staffData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateStaff = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, staffData }: { id: string; staffData: Partial<CreateStaffRequest> }) => {
      const response = await api.put(`/staff/${id}`, staffData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteStaff = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/staff/${id}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};
