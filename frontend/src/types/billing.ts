export type TenantSubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';
export type BillingCycle = 'ONE_TIME' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY';

export interface BillingPlan {
  id: string;
  name: string;
  priceMonthly: string | number;
  priceYearly: string | number;
  currency: string;
  maxStaff?: number | null;
  maxAppointmentsPerMonth?: number | null;
  maxLocations?: number | null;
  features: string[];
}

export interface BillingSubscription {
  id: string;
  status: TenantSubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodEnd: string;
  trialEndsAt?: string | null;
  gateway?: string | null;
  plan: BillingPlan;
}

export interface BillingStatusResponse {
  subscription: BillingSubscription | null;
  mercadoPagoConfigured: boolean;
}
