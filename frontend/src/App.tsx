import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlatformAuthProvider, usePlatformAuth } from './contexts/PlatformAuthContext';
import { queryClient } from './lib/queryClient';
import { CACHE_BUSTER, MAX_AGE, persister, shouldPersist } from './lib/persistCache';
import Booking from './pages/public/Booking';
import ManageBooking from './pages/public/ManageBooking';
import { getSavedTenantSlug } from './lib/tenantSlug';
import { isPanelRole, canManage } from './types';

// Las cuentas de clienta ya no tienen portal: van a la reserva pública de su salón.
const clientHome = () => {
  const slug = getSavedTenantSlug();
  return slug ? `/${slug}/reservar` : '/login';
};

// Cada pantalla se descarga al visitarla: la reserva pública (la que abren los clientes desde el móvil)
// no arrastra el panel, la agenda ni los gráficos.
const AdminLayout = lazy(() => import('./components/AdminLayout'));
const SuperAdminLayout = lazy(() => import('./components/superadmin/SuperAdminLayout'));
const SuperAdminLogin = lazy(() => import('./pages/superadmin/Login'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/Dashboard'));
const SuperAdminTenants = lazy(() => import('./pages/superadmin/Tenants'));
const SuperAdminTenantDetail = lazy(() => import('./pages/superadmin/TenantDetail'));
const SuperAdminPlans = lazy(() => import('./pages/superadmin/Plans'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Clients = lazy(() => import('./pages/Clients'));
const Services = lazy(() => import('./pages/Services'));
const Categories = lazy(() => import('./pages/Categories'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Notifications = lazy(() => import('./pages/Notifications'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const Team = lazy(() => import('./pages/Team'));
const DesignSystem = lazy(() => import('./pages/DesignSystem'));
const Settings = lazy(() => import('./pages/Settings'));
const Billing = lazy(() => import('./pages/Billing'));
const AdminGallery = lazy(() => import('./pages/AdminGallery'));
const Professional = lazy(() => import('./pages/Professionals'));
const Resources = lazy(() => import('./pages/Resources'));

/**
 * Protected route component para usuarios ADMIN
 */
const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isPanelRole(user.role)) {
    return <Navigate to={clientHome()} replace />;
  }

  return <>{children}</>;
};

/**
 * Páginas que solo ven quienes administran el salón (OWNER/ADMIN). Un
 * profesional (STAFF) vuelve al panel de control.
 */
const ManagerRoute: React.FC<{ children: React.ReactNode; ownerOnly?: boolean }> = ({ children, ownerOnly }) => {
  const { user } = useAuth();
  const allowed = ownerOnly ? user?.role === 'OWNER' : canManage(user?.role);
  return allowed ? <>{children}</> : <Navigate to="/admin/dashboard" replace />;
};

/**
 * Protected route component para el portal de Super Admin (plataforma).
 * Usa su propio contexto de auth, completamente separado del de tenant.
 */
const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { admin, isLoading } = usePlatformAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/superadmin/login" replace />;
  }

  return <>{children}</>;
};

/**
 * Root redirect component que redirige a los usuarios según su rol
 */
// Enlace corto para compartir y para el QR: /r/<slug> → /<slug>/reservar
const ShortBookingLink: React.FC = () => {
  const { tenantSlug } = useParams();
  return <Navigate to={`/${tenantSlug}/reservar`} replace />;
};

const RootRedirect: React.FC = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirige según el rol
  return isPanelRole(user.role)
    ? <Navigate to="/admin/dashboard" replace /> 
    : <Navigate to={clientHome()} replace />;
};

const PageSpinner: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
  </div>
);

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: MAX_AGE, buster: CACHE_BUSTER, dehydrateOptions: { shouldDehydrateQuery: shouldPersist } }}
    >
      <AuthProvider>
        <PlatformAuthProvider>
          <Router>
          <Suspense fallback={<PageSpinner />}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/:tenantSlug/login" element={<Login />} />
            {/* Reserva pública, sin cuenta */}
            <Route path="/:tenantSlug/reservar" element={<Booking />} />
            <Route path="/r/:tenantSlug" element={<ShortBookingLink />} />
            <Route path="/:tenantSlug/mi-cita/:token" element={<ManageBooking />} />
            <Route path="/design-system" element={<DesignSystem />} />

            {/* Super Admin (plataforma) routes — sistema de auth separado */}
            <Route path="/superadmin/login" element={<SuperAdminLogin />} />
            <Route
              path="/superadmin"
              element={
                <SuperAdminRoute>
                  <SuperAdminLayout />
                </SuperAdminRoute>
              }
            >
              <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
              <Route path="dashboard" element={<SuperAdminDashboard />} />
              <Route path="tenants" element={<SuperAdminTenants />} />
              <Route path="tenants/:id" element={<SuperAdminTenantDetail />} />
              <Route path="plans" element={<SuperAdminPlans />} />
            </Route>

            {/* Root redirect */}
            <Route path="/" element={<RootRedirect />} />

            {/* Admin routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="clients" element={<ManagerRoute><Clients /></ManagerRoute>} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="professionals" element={<ManagerRoute><Professional /></ManagerRoute>} />
              <Route path="resources" element={<ManagerRoute><Resources /></ManagerRoute>} />
              <Route path="services" element={<ManagerRoute><Services /></ManagerRoute>} />
              <Route path="categories" element={<ManagerRoute><Categories /></ManagerRoute>} />
              <Route path="gallery" element={<ManagerRoute><AdminGallery /></ManagerRoute>} />
              <Route path="notifications" element={<ManagerRoute><Notifications /></ManagerRoute>} />
              <Route path="profile" element={<MyProfile />} />
              <Route path="team" element={<ManagerRoute ownerOnly><Team /></ManagerRoute>} />
              <Route path="billing" element={<ManagerRoute ownerOnly><Billing /></ManagerRoute>} />
              <Route path="settings" element={<ManagerRoute><Settings /></ManagerRoute>} />
            </Route>

            {/* Catch all - redirect to root */}
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </Router>
          <Toaster position="top-right" />
          <ReactQueryDevtools initialIsOpen={false} />
        </PlatformAuthProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}

export default App;
