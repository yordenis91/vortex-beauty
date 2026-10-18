import axios from 'axios';

// Cliente HTTP para las páginas públicas (reserva sin cuenta): no envía token ni
// reacciona a 401, porque no hay sesión.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://deploy-vortex-backend.wgteoi.easypanel.host/api';

export const publicApi = axios.create({
  baseURL: `${API_BASE_URL}/public/booking`,
  headers: { 'Content-Type': 'application/json' },
});

export function apiErrorMessage(error: unknown, fallback = 'Algo salió mal. Inténtalo de nuevo.'): string {
  const data = (error as { response?: { data?: { error?: string; details?: Array<{ message?: string }> } } })?.response?.data;
  return data?.details?.[0]?.message || data?.error || fallback;
}

export interface PublicCatalog {
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  bookingEnabled: boolean;
  labels: Record<string, string>;
  minNoticeHours: number;
  maxAdvanceDays: number;
  cancelWindowHrs: number;
  captchaSiteKey: string | null;
  services: Array<{
    id: string;
    name: string;
    description?: string | null;
    price: number | string;
    currency: string;
    durationMinutes: number;
    category?: { id: string; name: string } | null;
  }>;
  professionals: Array<{ id: string; name: string; color?: string | null; serviceIds: string[] }>;
}

export interface PublicSlot {
  startTime: string;
  professionalIds?: string[];
}

/** Enlace al bot del salón para recibir avisos; null si el salón no tiene bot. */
export interface TelegramOptIn {
  botUsername: string;
  linked: boolean;
  deepLink: string;
}

export interface PublicAppointment {
  id: string;
  status: 'PENDING' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  serviceName: string;
  professionalName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  startsAt: string;
  priceAmount: number | string;
  currency: string;
  manageUrl: string | null;
  telegram?: TelegramOptIn | null;
}

export interface ManageView {
  salonName: string;
  appointment: PublicAppointment & { serviceId: string; professionalId: string | null };
  telegram: TelegramOptIn | null;
  cancelWindowHrs: number;
  canCancel: boolean;
  canReschedule: boolean;
}
