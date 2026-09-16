export type PlatformRole = 'SUPER_ADMIN' | 'SUPPORT' | 'BILLING_ADMIN';

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  isActive?: boolean;
  lastLoginAt?: string | null;
}

export type TenantStatus = 'ACTIVE' | 'TRIAL' | 'SUSPENDED';
export type TenantSubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
export type BillingCycle = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  priceMonthly: string | number;
  priceYearly: string | number;
  currency: string;
  trialDays: number;
  maxStaff?: number | null;
  maxAppointmentsPerMonth?: number | null;
  maxLocations?: number | null;
  features: string[];
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
  _count?: { tenantSubscriptions: number };
}

export interface CreatePlanRequest {
  name: string;
  slug: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  currency?: string;
  trialDays?: number;
  maxStaff?: number | null;
  maxAppointmentsPerMonth?: number | null;
  maxLocations?: number | null;
  features?: string[];
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  plan: Plan;
  status: TenantSubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt?: string | null;
}

export interface CreateTenantRequest {
  name: string;
  slug?: string;
  planId: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  adminName: string;
  adminEmail: string;
}

export interface CreateTenantResponse {
  tenant: { id: string; name: string; slug: string };
  admin: { id: string; email: string; name: string };
  tempPassword: string;
  registerUrl: string;
}

export interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  status: TenantStatus;
  createdAt: string;
  platformSubscription: TenantSubscription | null;
  users: { id: string; email: string; name: string }[];
  _count: { clients: number; staff: number };
}

export interface TenantDetail extends Omit<TenantListItem, 'users'> {
  users: { id: string; email: string; name: string; createdAt: string }[];
}

export interface TenantUsage {
  staffCount: number;
  clientCount: number;
  userCount: number;
  appointmentsThisMonth: number;
  lastActivityAt: string | null;
}

export interface AuditLogEntry {
  id: string;
  actorType: 'PLATFORM_ADMIN' | 'TENANT_USER';
  actorId: string;
  actorEmail?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  tenantId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardMetrics {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  trialTenants: number;
  newTenantsThisMonth: number;
  mrr: number;
  arr: number;
  churnRate: number;
  activeSubscriptionsCount: number;
}

export interface GrowthPoint {
  month: string;
  count: number;
}

export interface RevenueByPlan {
  planId: string;
  planName: string;
  mrr: number;
  tenantCount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
