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
import Invoices from './pages/Invoices';
import Products from './pages/Products';
import Categories from './pages/Categories';
import KnowledgeBase from './pages/KnowledgeBase';
import Appointments from './pages/Appointments';
import Notifications from './pages/Notifications';
import MyInvoices from './pages/MyInvoices';
import MySubscriptions from './pages/MySubscriptions';
import MyProfile from './pages/MyProfile';
import ClientDashboard from './pages/client/ClientDashboard';
import DesignSystem from './pages/DesignSystem';
import ClientGallery from './pages/client/ClientGallery';
import ClientAppointments from './pages/client/ClientAppointments';
import ClientProfile from './pages/client/ClientProfile';
import Settings from './pages/Settings';
import AdminGallery from './pages/AdminGallery';
import Staff from './pages/Staff';

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

  if (user.role !== 'ADMIN') {
    return <Navigate to="/portal/dashboard" replace />;
  }

  return <>{children}</>;
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

  // Si es ADMIN, redirige al panel de admin
  if (user.role === 'ADMIN') {
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
  return user.role === 'ADMIN' 
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
            <Route path="/register" element={<Register />} />
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
              <Route path="clients" element={<Clients />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="staff" element={<Staff />} />
              <Route path="products" element={<Products />} />
              <Route path="categories" element={<Categories />} />
              <Route path="knowledge-base" element={<KnowledgeBase />} />
              <Route path="gallery" element={<AdminGallery />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="profile" element={<MyProfile />} />
              <Route path="settings" element={<Settings />} />
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
              <Route path="my-invoices" element={<MyInvoices />} />
              <Route path="my-subscriptions" element={<MySubscriptions />} />
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
