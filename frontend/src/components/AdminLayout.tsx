import React from 'react';
import { Link, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import GlobalSearch from './GlobalSearch';
import { User, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import { isImpersonating } from '../lib/session';
import OfflineBanner from './OfflineBanner';

const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen min-w-0 flex-1 bg-muted">
        <AdminSidebar />

        <div className="flex-1 flex flex-col min-h-screen min-w-0 overflow-x-clip">
          {isImpersonating() && (
            <div role="status" className="bg-amber-500 text-black text-center text-sm font-medium px-4 py-1.5">
              Estás viendo este salón como soporte de la plataforma. La sesión dura 1 hora y queda registrada.
            </div>
          )}
          <div className="sticky top-0 z-10">
          <OfflineBanner />
          <header className="flex h-16 items-center gap-4 border-b bg-background px-4 sm:px-6">
            <SidebarTrigger />

            <div className="flex flex-1 min-w-0">
              <GlobalSearch />
            </div>

            <div className="ml-4 flex shrink-0 items-center gap-4 md:ml-6">
              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex shrink-0 items-center gap-2 border-l border-border pl-4 text-sm">
                    {user?.imageUrl ? (
                      <img
                        src={user.imageUrl}
                        alt="Avatar"
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <User className="h-8 w-8" />
                    )}
                    <span className="hidden sm:inline-block max-w-24 truncate">{user?.name}</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/admin/profile">Mi Perfil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      handleLogout();
                    }}
                  >
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          </div>

          <main className="flex-1 overflow-x-clip p-4 sm:p-6 lg:p-8 bg-muted">
            <div className="mx-auto w-full max-w-7xl space-y-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
