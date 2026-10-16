import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlatformAuthProvider, usePlatformAuth } from './contexts/PlatformAuthContext';
import { queryClient } from './lib/queryClient';
import AdminLayout from './components/AdminLayout';
import ClientLayout from './components/ClientLayout';
import SuperAdminLayout from './components/superadmin/SuperAdminLayout';
import SuperAdminLogin from './pages/superadmin/Login';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import SuperAdminTenants from './pages/superadmin/Tenants';
import SuperAdminTenantDetail from './pages/superadmin/TenantDetail';
import SuperAdminPlans from './pages/superadmin/Plans';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Services from './pages/Services';
import Categories from './pages/Categories';
import Appointments from './pages/Appointments';
import Notifications from './pages/Notifications';
import MyProfile from './pages/MyProfile';
import ClientDashboard from './pages/client/ClientDashboard';
import DesignSystem from './pages/DesignSystem';
import ClientGallery from './pages/client/ClientGallery';
import ClientAppointments from './pages/client/ClientAppointments';
import ClientProfile from './pages/client/ClientProfile';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import AdminGallery from './pages/AdminGallery';
import Professional from './pages/Professionals';
import Resources from './pages/Resources';
import Booking from './pages/public/Booking';
import ManageBooking from './pages/public/ManageBooking';
import { isPanelRole, canManage } from './types';

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
    return <Navigate to="/portal/dashboard" replace />;
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
 * Protected route component para usuarios CLIENT
 */
const ClientRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  // Quien usa el panel del salón no entra al portal de clientes
  if (isPanelRole(user.role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
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
    : <Navigate to="/portal/dashboard" replace />;
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PlatformAuthProvider>
          <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/:tenantSlug/login" element={<Login />} />
            {/* Reserva pública, sin cuenta */}
            <Route path="/:tenantSlug/reservar" element={<Booking />} />
            <Route path="/:tenantSlug/mi-cita/:token" element={<ManageBooking />} />
            <Route path="/:tenantSlug/register" element={<Register />} />
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
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<MyProfile />} />
              <Route path="billing" element={<ManagerRoute ownerOnly><Billing /></ManagerRoute>} />
              <Route path="settings" element={<ManagerRoute><Settings /></ManagerRoute>} />
            </Route>

            {/* Client/Portal routes */}
            <Route
              path="/portal"
              element={
                <ClientRoute>
                  <ClientLayout />
                </ClientRoute>
              }
            >
              <Route index element={<Navigate to="/portal/dashboard" replace />} />
              <Route path="dashboard" element={<ClientDashboard />} />
              <Route path="appointments" element={<ClientAppointments />} />
              <Route path="gallery" element={<ClientGallery />} />
              <Route path="my-profile" element={<ClientProfile />} />
            </Route>

            {/* Catch all - redirect to root */}
            <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
          <Toaster position="top-right" />
          <ReactQueryDevtools initialIsOpen={false} />
        </PlatformAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
