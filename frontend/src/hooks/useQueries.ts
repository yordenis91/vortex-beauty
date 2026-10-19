import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../lib/api';
import type {
  Client,
  Service,
  Category,
  Appointment,
  GalleryItem,
  ClosedDate,
  ScheduleOverride,
  Professional,
  Notification,
  UpdateClientProfileRequest,
  CreateGalleryItemRequest,
  CreateClientRequest,
  CreateServiceRequest,
  CreateCategoryRequest,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  CreateProfessionalRequest,
  AvailableSlot,
  Resource,
  TimeOff,
  BookingSettings,
  TeamMember,
  CreateTeamMemberRequest,
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

// Services
export const useServices = () => {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await api.get<Service[]>('/services');
      return response.data;
    },
  });
};

// Categories
export const useCategories = () => {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get<Category[]>('/categories');
      return response.data;
    },
  });
};

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

export const useUpdateService = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, serviceData }: { id: string; serviceData: Partial<CreateServiceRequest> }) => {
      const response = await api.put(`/services/${id}`, serviceData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteService = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/services/${id}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useCreateService = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (serviceData: CreateServiceRequest) => {
      const response = await api.post('/services', serviceData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
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
// Sin rango, el servidor devuelve la ventana útil (30 días atrás, 180 adelante).
export const useAppointments = (range?: { from?: string; to?: string }) => {
  return useQuery({
    queryKey: ['appointments', range?.from ?? null, range?.to ?? null],
    queryFn: async () => {
      const response = await api.get<Appointment[]>('/appointments', { params: range });
      return response.data;
    },
    placeholderData: (previous) => previous,
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

// Huecos desde el panel (sin antelación mínima/máxima). excludeAppointmentId
// evita que la cita que se está editando bloquee su propio hueco.
export const useAdminSlots = (date: string, serviceId?: string, professionalId?: string, excludeAppointmentId?: string) => {
  return useQuery({
    queryKey: ['admin-slots', date, serviceId, professionalId, excludeAppointmentId],
    queryFn: async () => {
      const params = new URLSearchParams({ date, serviceId: serviceId! });
      if (professionalId && professionalId !== 'any') params.set('professionalId', professionalId);
      if (excludeAppointmentId) params.set('excludeAppointmentId', excludeAppointmentId);
      const response = await api.get<AvailableSlot[]>(`/appointments/available-slots?${params.toString()}`);
      return response.data;
    },
    enabled: !!date && !!serviceId,
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

// ==================== PROFESSIONAL HOOKS ====================

export const useProfessionals = (activeOnly?: boolean) => {
  return useQuery({
    queryKey: ['professionals', activeOnly],
    queryFn: async () => {
      const url = activeOnly ? '/professionals?active=true' : '/professionals';
      const response = await api.get<Professional[]>(url);
      return response.data;
    },
  });
};

export const useCreateProfessional = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (professionalData: CreateProfessionalRequest) => {
      const response = await api.post('/professionals', professionalData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateProfessional = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async ({ id, professionalData }: { id: string; professionalData: Partial<CreateProfessionalRequest> }) => {
      const response = await api.put(`/professionals/${id}`, professionalData);
      return response.data;
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useDeleteProfessional = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/professionals/${id}`);
    },
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};


// ==================== RESOURCES ====================

export const useResources = () => {
  return useQuery({
    queryKey: ['resources'],
    queryFn: async () => (await api.get<Resource[]>('/resources')).data,
  });
};

function useResourceMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  invalidate: string[][],
  options?: MutationOptions
) {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: fn,
    onError: (error: unknown) => {
      toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));
    },
    onSuccess: (data, variables, context) => {
      invalidate.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
}

export const useCreateResource = (options?: MutationOptions) =>
  useResourceMutation(async (data: { name: string; isActive?: boolean }) => (await api.post('/resources', data)).data, [['resources']], options);

export const useUpdateResource = (options?: MutationOptions) =>
  useResourceMutation(
    async ({ id, data }: { id: string; data: { name?: string; isActive?: boolean } }) => (await api.put(`/resources/${id}`, data)).data,
    [['resources']],
    options
  );

export const useDeleteResource = (options?: MutationOptions) =>
  useResourceMutation(async (id: string) => (await api.delete(`/resources/${id}`)).data, [['resources']], options);

// ==================== TIME OFF ====================

export const useTimeOff = (professionalId?: string) => {
  return useQuery({
    queryKey: ['time-off', professionalId],
    queryFn: async () => (await api.get<TimeOff[]>(`/professionals/${professionalId}/time-off`)).data,
    enabled: !!professionalId,
  });
};

export const useCreateTimeOff = (options?: MutationOptions) =>
  useResourceMutation(
    async ({ professionalId, ...data }: { professionalId: string; startsAt: string; endsAt: string; reason?: string; force?: boolean }) =>
      (await api.post(`/professionals/${professionalId}/time-off`, data)).data,
    [['time-off']],
    options
  );

export const useDeleteTimeOff = (options?: MutationOptions) =>
  useResourceMutation(async (id: string) => (await api.delete(`/professionals/time-off/${id}`)).data, [['time-off']], options);

// ==================== BOOKING SETTINGS ====================

export const useBookingSettings = () => {
  return useQuery({
    queryKey: ['booking-settings'],
    queryFn: async () => (await api.get<BookingSettings>('/settings/booking')).data,
    staleTime: 60_000,
  });
};

export const useUpdateBookingSettings = (options?: MutationOptions) =>
  useResourceMutation(
    async (data: Partial<Omit<BookingSettings, 'name' | 'slug' | 'currency' | 'logoUrl' | 'brandColor'>> & { telegramBotToken?: string; logoUrl?: string; brandColor?: string }) => (await api.put('/settings/booking', data)).data,
    [['booking-settings']],
    options
  );

// Avisos de Telegram del profesional que inició sesión
export interface MyTelegramLink {
  hasProfessional: boolean;
  botUsername: string | null;
  linked: boolean;
  code: string | null;
}

export const useMyTelegramLink = () =>
  useQuery({
    queryKey: ['my-telegram-link'],
    queryFn: async () => (await api.get<MyTelegramLink>('/professionals/me/telegram')).data,
    // Mientras espera el enlace, se vuelve a consultar para pasar a «vinculado» sin recargar
    refetchInterval: (query) => (query.state.data && query.state.data.code ? 5000 : false),
  });

export const useUnlinkMyTelegram = (options?: MutationOptions) =>
  useResourceMutation(async () => (await api.delete('/professionals/me/telegram')).data, [['my-telegram-link']], options);

// ---- Equipo: cuentas de acceso al panel ----

export const useTeam = () =>
  useQuery({
    queryKey: ['team'],
    queryFn: async () => (await api.get<TeamMember[]>('/team')).data,
  });

const teamError = (error: unknown) => toast.error(getErrorMessage(error, 'Ocurrió un error en la operación.'));

export const useCreateTeamMember = (options?: MutationOptions<{ user: TeamMember; tempPassword: string }, CreateTeamMemberRequest>) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (body: CreateTeamMemberRequest) => (await api.post<{ user: TeamMember; tempPassword: string }>('/team', body)).data,
    onError: teamError,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};

export const useUpdateTeamMember = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; email?: string; isActive?: boolean }) =>
      (await api.patch<TeamMember>(`/team/${id}`, body)).data,
    onError: teamError,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
    },
  });
};

export const useResetTeamPassword = (options?: MutationOptions<{ tempPassword: string }, string>) =>
  useMutation({
    ...options,
    mutationFn: async (id: string) => (await api.post<{ tempPassword: string }>(`/team/${id}/reset-password`)).data,
    onError: teamError,
  });

export const useDeleteTeamMember = (options?: MutationOptions) => {
  const queryClient = useQueryClient();
  const { onSuccess: customOnSuccess, ...otherOptions } = options || {};
  return useMutation({
    ...otherOptions,
    mutationFn: async (id: string) => {
      await api.delete(`/team/${id}`);
    },
    onError: teamError,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['professionals'] });
      if (customOnSuccess) customOnSuccess(data, variables, context);
    },
  });
};
