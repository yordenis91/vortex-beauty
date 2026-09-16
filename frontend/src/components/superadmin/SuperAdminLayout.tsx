import React from 'react';
import { useNavigate, Outlet } from 'react-router-dom';
import { usePlatformAuth } from '../../contexts/PlatformAuthContext';
import { LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import SuperAdminSidebar from './SuperAdminSidebar';

const SuperAdminLayout: React.FC = () => {
  const { admin, logout } = usePlatformAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/superadmin/login');
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gray-950 text-gray-100">
        <SuperAdminSidebar />

        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-gray-800 bg-gray-900 px-4 sm:px-6">
            <SidebarTrigger />

            <div className="flex items-center gap-2 text-sm text-gray-400">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
              Portal de Plataforma
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-4">
              <span className="hidden sm:inline-block text-sm text-gray-300 max-w-40 truncate">{admin?.name}</span>
              <Button variant="ghost" size="sm" className="text-gray-300 hover:text-white hover:bg-gray-800" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar sesión
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 bg-gray-950">
            <div className="mx-auto w-full max-w-7xl space-y-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default SuperAdminLayout;
