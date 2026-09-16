import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Building2, CheckCircle2, PauseCircle, Hourglass, DollarSign, TrendingUp, UserPlus, Percent } from 'lucide-react';
import { useDashboardMetrics, useDashboardGrowth, useDashboardRevenueByPlan } from '../../hooks/usePlatformQueries';

// Colores tomados de la paleta validada del design system (referencia dataviz),
// pasos para superficie oscura: secuencial azul para series únicas, y los
// primeros 4 slots categóricos (orden fijo) para el desglose por plan.
const SEQUENTIAL_BLUE = '#3987e5';
const CATEGORICAL_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500'];
const GRID_COLOR = '#2c2c2a';
const AXIS_COLOR = '#898781';
const TOOLTIP_BG = '#1a1a19';
const TOOLTIP_BORDER = '#383835';

interface StatTileProps {
  label: string;
  value: string;
  icon: React.ElementType;
  accent?: string;
}

const StatTile: React.FC<StatTileProps> = ({ label, value, icon: Icon, accent = 'text-indigo-400' }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-start justify-between">
    <div>
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white [font-variant-numeric:tabular-nums]">{value}</p>
    </div>
    <div className={`h-10 w-10 rounded-lg bg-gray-800 flex items-center justify-center ${accent}`}>
      <Icon className="h-5 w-5" />
    </div>
  </div>
);

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatMonth(month: string) {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString('es', { month: 'short' });
}

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
    <h3 className="text-sm font-semibold text-gray-300 mb-4">{title}</h3>
    {children}
  </div>
);

const SuperAdminDashboard: React.FC = () => {
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: growth = [], isLoading: growthLoading } = useDashboardGrowth();
  const { data: revenueByPlan = [], isLoading: revenueLoading } = useDashboardRevenueByPlan();

  if (metricsLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Panel de Control</h2>
        <p className="mt-1 text-sm text-gray-400">Métricas globales de la plataforma</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="Salones totales" value={String(metrics?.totalTenants ?? 0)} icon={Building2} />
        <StatTile label="Activos" value={String(metrics?.activeTenants ?? 0)} icon={CheckCircle2} accent="text-emerald-400" />
        <StatTile label="Suspendidos" value={String(metrics?.suspendedTenants ?? 0)} icon={PauseCircle} accent="text-red-400" />
        <StatTile label="En prueba" value={String(metrics?.trialTenants ?? 0)} icon={Hourglass} accent="text-amber-400" />
        <StatTile label="MRR" value={formatCurrency(metrics?.mrr ?? 0)} icon={DollarSign} />
        <StatTile label="ARR" value={formatCurrency(metrics?.arr ?? 0)} icon={TrendingUp} />
        <StatTile label="Nuevos este mes" value={String(metrics?.newTenantsThisMonth ?? 0)} icon={UserPlus} />
        <StatTile label="Tasa de churn" value={`${((metrics?.churnRate ?? 0) * 100).toFixed(1)}%`} icon={Percent} accent="text-red-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Nuevos salones por mes (últimos 6 meses)">
          {growthLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-500 text-sm">Cargando…</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={growth} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8 }}
                  labelStyle={{ color: '#ffffff' }}
                  labelFormatter={(label) => formatMonth(String(label))}
                  formatter={(value) => [value, 'Nuevos salones']}
                />
                <Bar dataKey="count" fill={SEQUENTIAL_BLUE} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Ingresos mensuales por plan (MRR)">
          {revenueLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-500 text-sm">Cargando…</div>
          ) : revenueByPlan.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-500 text-sm">Sin suscripciones activas todavía</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={revenueByPlan} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID_COLOR} />
                <XAxis
                  dataKey="planName"
                  tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                  axisLine={{ stroke: GRID_COLOR }}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tick={{ fill: AXIS_COLOR, fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: TOOLTIP_BG, border: `1px solid ${TOOLTIP_BORDER}`, borderRadius: 8 }}
                  labelStyle={{ color: '#ffffff' }}
                  formatter={(value, _name, item) => [formatCurrency(Number(value)), `${item.payload.tenantCount} salón(es)`]}
                />
                <Bar dataKey="mrr" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {revenueByPlan.map((entry, index) => (
                    <Cell key={entry.planId} fill={CATEGORICAL_DARK[index % CATEGORICAL_DARK.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
