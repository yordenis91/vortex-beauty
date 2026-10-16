// User types
export type UserRole = 'ADMIN' | 'CLIENT';

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
  email: string;
  phone?: string;
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
  email: string;
  phone?: string;
  address?: string;
  imageUrl?: string;
  username?: string;
  password?: string;
  sendWelcomeEmail?: boolean;
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
  type: 'PRODUCT' | 'TICKET' | 'KNOWLEDGE_BASE';
  color?: string;
  icon?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    products: number;
    tickets: number;
    articles: number;
  };
}

// Product types
export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';
  isPublic: boolean;
  durationMinutes: number;
  categoryId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  category?: Category;
  _count?: { appointments: number };
}

// Staff types
export interface Staff {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStaffRequest {
  name: string;
  email?: string;
  phone?: string;
  color?: string;
  isActive?: boolean;
}

export interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  isActive: boolean;
  productId: string;
  product: Product;
  createdAt: string;
  updatedAt: string;
}

// Request/Response types for new APIs
export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  currency?: string;
  categoryId: string;
  isPublic?: boolean;
  durationMinutes?: number;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  type: Category['type'];
  color?: string;
  icon?: string;
  order?: number;
}

// Appointment types
export interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  clientId: string;
  productId: string;
  staffId?: string | null;
  createdAt: string;
  updatedAt: string;
  client?: Client;
  product?: Product;
  staff?: Staff | null;
}

export interface CreateAppointmentRequest {
  date: string;
  startTime: string;
  // endTime ya no lo decide el cliente: el backend lo calcula desde la
  // duración del servicio. Se puede omitir; si se manda, se ignora.
  endTime?: string;
  // Requerido en /api/appointments (admin, identifica al cliente de la cita).
  // En /api/portal/appointments el backend ignora este campo y usa el
  // clientId del token de sesión, así que ahí es opcional.
  clientId?: string;
  productId: string;
  staffId?: string | null;
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
}

export interface UpdateAppointmentRequest {
  date?: string;
  startTime?: string;
  endTime?: string;
  clientId?: string;
  productId?: string;
  staffId?: string | null;
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
}

// Notification types
export type NotificationChannel = 'WHATSAPP' | 'EMAIL' | 'SYSTEM';
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
  productId: string;
  isActive?: boolean;
}