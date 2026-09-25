import React from 'react';
import toast from 'react-hot-toast';
import { CreditCard, CheckCircle2, AlertCircle, Clock, XCircle } from 'lucide-react';
import { useBillingStatus, useCreateBillingCheckout, getErrorMessage } from '../hooks/useBillingQueries';
import type { TenantSubscriptionStatus } from '../types/billing';

const STATUS_LABELS: Record<TenantSubscriptionStatus, string> = {
  TRIALING: 'En periodo de prueba',
  ACTIVE: 'Activa',
  PAST_DUE: 'Pago pendiente',
  CANCELED: 'Cancelada',
  EXPIRED: 'Expirada',
};

const STATUS_ICONS: Record<TenantSubscriptionStatus, React.ElementType> = {
  TRIALING: Clock,
  ACTIVE: CheckCircle2,
  PAST_DUE: AlertCircle,
  CANCELED: XCircle,
  EXPIRED: XCircle,
};

const STATUS_STYLES: Record<TenantSubscriptionStatus, string> = {
  TRIALING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900',
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900',
  PAST_DUE: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900',
  CANCELED: 'bg-muted text-muted-foreground border-border',
  EXPIRED: 'bg-muted text-muted-foreground border-border',
};

function formatCurrency(value: string | number, currency: string) {
  return new Intl.NumberFormat('es', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value));
}

const Billing: React.FC = () => {
  const { data, isLoading } = useBillingStatus();
  const checkout = useCreateBillingCheckout();

  const handleConnect = () => {
    checkout.mutate(undefined, {
      onSuccess: (result) => {
        window.location.href = result.redirectUrl;
      },
      onError: (error) => toast.error(getErrorMessage(error, 'No se pudo iniciar el pago')),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const { subscription, mercadoPagoConfigured } = data ?? { subscription: null, mercadoPagoConfigured: false };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Facturación</h2>
        <p className="mt-1 text-sm text-muted-foreground">Tu plan y método de pago con la plataforma</p>
      </div>

      {!subscription ? (
        <div className="bg-card rounded-lg shadow-sm border border-border p-8 text-center text-muted-foreground">
          Todavía no tenés un plan asignado. Contacta a soporte.
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm border border-border p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">{subscription.plan.name}</h3>
              <p className="text-2xl font-bold text-foreground mt-1">
                {formatCurrency(
                  subscription.billingCycle === 'YEARLY' ? subscription.plan.priceYearly : subscription.plan.priceMonthly,
                  subscription.plan.currency
                )}
                <span className="text-sm font-normal text-muted-foreground">
                  /{subscription.billingCycle === 'YEARLY' ? 'año' : 'mes'}
                </span>
              </p>
            </div>
            {(() => {
              const Icon = STATUS_ICONS[subscription.status];
              return (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${STATUS_STYLES[subscription.status]}`}>
                  <Icon className="h-4 w-4" />
                  {STATUS_LABELS[subscription.status]}
                </span>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-border pt-4">
            {subscription.status === 'TRIALING' && subscription.trialEndsAt && (
              <div>
                <span className="text-muted-foreground">La prueba termina el</span>
                <p className="text-foreground font-medium">{new Date(subscription.trialEndsAt).toLocaleDateString('es')}</p>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Próximo cobro</span>
              <p className="text-foreground font-medium">{new Date(subscription.currentPeriodEnd).toLocaleDateString('es')}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Método de pago</span>
              <p className="text-foreground font-medium">
                {subscription.gateway === 'mercadopago' ? 'Mercado Pago (tarjeta conectada)' : 'Gestionado manualmente por la plataforma'}
              </p>
            </div>
          </div>

          {subscription.gateway !== 'mercadopago' && (
            <div className="border-t border-border pt-4">
              {mercadoPagoConfigured ? (
                <button
                  onClick={handleConnect}
                  disabled={checkout.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  {checkout.isPending ? 'Redirigiendo...' : 'Conectar método de pago'}
                </button>
              ) : (
                <p className="text-sm text-muted-foreground">
                  El cobro automático todavía no está disponible. Tu plan lo administra la plataforma directamente.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Billing;
