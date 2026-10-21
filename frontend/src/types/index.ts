// User types
export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF' | 'CLIENT';

/** Roles que usan el panel del salón (todos menos el cliente final). */
export const isPanelRole = (role: UserRole | null | undefined) => role === 'OWNER' || role === 'ADMIN' || role === 'STAFF';
/** Roles que administran el salón (catálogo, ajustes, clientes). */
export const canManage = (role: UserRole | null | undefined) => role === 'OWNER' || role === 'ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// Client types
export interface Client {
  id: string;
  name: string;
  email?: string | null; // opcional: quien reserva solo con teléfono no tiene correo
  phone?: string | null;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  userId: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClientRequest {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  imageUrl?: string;
}

// Auth types
export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

// ClosedDate types
export interface ClosedDate {
  id: string;
  date: string; // YYYY-MM-DD
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

// ScheduleOverride types
export interface ScheduleOverride {
  id: string;
  date: string; // YYYY-MM-DD
  timeSlots: string[];
  createdAt: string;
  updatedAt: string;
}

// API types
export interface ApiError {
  error: string | string[];
}

// Category types
export interface Category {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  _count?: { services: number };
}

// Service types
export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number | string;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  isPublic: boolean;
  onlineBookable: boolean;
  durationMinutes: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  categoryId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  professionalIds?: string[];
  resourceIds?: string[];
  _count?: { appointments: number };
}

// Professional types
export interface ScheduleBlock {
  dayOfWeek: number; // 0 = domingo ... 6 = sábado
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface QuotaSlot {
  dayOfWeek: number; // 0 = domingo ... 6 = sábado
  time: string; // HH:mm
}

export interface Professional {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  color?: string | null;
  isActive: boolean;
  acceptsOnlineBookings: boolean;
  bookingMode: 'TIMED' | 'QUOTA';
  quotaSlots?: QuotaSlot[];
  userId?: string | null;
  user?: { id: string; email: string } | null;
  schedules?: Array<ScheduleBlock & { id: string }>;
  serviceIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
  isActive: boolean;
  createdAt: string;
  professional: { id: string; name: string } | null;
}

export interface CreateTeamMemberRequest {
  name: string;
  email: string;
  role: 'ADMIN' | 'STAFF';
  professionalId?: string;
}

export interface CreateProfessionalRequest {
  name: string;
  email?: string;
  phone?: string;
  color?: string;
  isActive?: boolean;
  acceptsOnlineBookings?: boolean;
  schedule?: ScheduleBlock[];
  serviceIds?: string[];
  account?: { email: string; password: string };
}

export interface TimeOff {
  id: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
}

// Resource types
export interface Resource {
  id: string;
  name: string;
  isActive: boolean;
  serviceIds?: string[];
}

export interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  isActive: boolean;
  serviceId: string;
  service: Service;
  createdAt: string;
  updatedAt: string;
}

// Request/Response types
export interface CreateServiceRequest {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  categoryId: string;
  status?: Service['status'];
  isPublic?: boolean;
  onlineBookable?: boolean;
  durationMinutes?: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
  professionalIds?: string[];
  resourceIds?: string[];
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  order?: number;
}

// Appointment types
export type AppointmentStatus = 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface Appointment {
  id: string;
  // Hora local del salón (el backend las calcula desde startsAt/endsAt).
  date: string;
  startTime: string;
  endTime: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  notes?: string;
  // Datos del servicio congelados al reservar
  serviceName: string;
  priceAmount: number | string;
  currency: string;
  durationMin: number;
  clientId: string;
  serviceId: string;
  professionalId?: string | null;
  resourceId?: string | null;
  cancelledBy?: 'CUSTOMER' | 'STAFF' | 'SYSTEM' | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  service?: Service;
  professional?: Professional | null;
  resource?: Resource | null;
}

export interface CreateAppointmentRequest {
  date: string;
  startTime: string;
  clientId?: string; // obligatorio en el panel; el portal usa el cliente de la sesión
  serviceId: string;
  // Un profesional concreto, 'any' (cualquiera libre) o ausente
  professionalId?: string | 'any' | null;
  status?: AppointmentStatus;
  notes?: string;
}

export interface UpdateAppointmentRequest {
  date?: string;
  startTime?: string;
  clientId?: string;
  serviceId?: string;
  professionalId?: string | 'any' | null;
  status?: AppointmentStatus;
  notes?: string;
}

export interface AvailableSlot {
  startTime: string;
  professionalIds: string[];
}

// Booking settings
export interface BookingSettings {
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  vertical: 'GENERIC' | 'NAILS' | 'BARBER' | 'SPA' | 'TATTOO' | 'HAIR' | 'FITNESS';
  slotIntervalMin: number;
  minNoticeHours: number;
  maxAdvanceDays: number;
  cancelWindowHrs: number;
  bookingEnabled: boolean;
  maxActivePerCustomer: number;
  reminderHours: number[];
  ownerAlerts: boolean;
  telegramConfigured: boolean;
  telegramChatId: string;
  telegramBotUsername: string | null;
  telegramOwnerCode: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  labels: Record<string, string>;
}

// Notification types
export type NotificationChannel = 'WHATSAPP' | 'EMAIL' | 'TELEGRAM' | 'SYSTEM';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface Notification {
  id: string;
  type: NotificationChannel;
  recipient: string;
  content: string;
  status: NotificationStatus;
  isRead: boolean;
  errorLog?: string | null;
  clientId?: string | null;
  client?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// Client portal profile types
export interface ClientProfileResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  imageUrl?: string | null;
  clientId?: string | null;
  client?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    address?: string;
    imageUrl?: string | null;
  } | null;
}

export interface UpdateClientProfileRequest {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  imageUrl?: string | null;
}

// Gallery request types
export interface CreateGalleryItemRequest {
  title: string;
  imageUrl: string;
  serviceId: string;
  isActive?: boolean;
}