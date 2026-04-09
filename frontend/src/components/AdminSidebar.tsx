import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  Package,
  Folder,
  BookOpen,
  Sparkles,
  Bell,
  Settings as SettingsIcon,
} from 'lucide-react';

interface NavLink {
  name: string;
  href: string;
  icon: LucideIcon;
}

interface NavSection {
  section: string;
  highlight?: boolean;
}

type NavItem = NavLink | NavSection;

const navigation: NavItem[] = [
  { name: 'Panel de Control', href: '/admin/dashboard', icon: LayoutDashboard },
  { section: 'Negocio', highlight: true },
  { name: 'Clientes', href: '/admin/clients', icon: Users },
  { name: 'Facturas', href: '/admin/invoices', icon: FileText },
  { section: 'Servicios y Programación', highlight: true },
  { name: 'Citas', href: '/admin/appointments', icon: Calendar },
  { name: 'Productos', href: '/admin/products', icon: Package },
  { name: 'Categorías', href: '/admin/categories', icon: Folder },
  { section: 'Aprendizaje y Recursos', highlight: true },
  { name: 'Base de Conocimientos', href: '/admin/knowledge-base', icon: BookOpen },
  { name: 'Galería', href: '/admin/gallery', icon: Sparkles },
  { section: 'Operaciones', highlight: true },
  { name: 'Notificaciones', href: '/admin/notifications', icon: Bell },
  { name: 'Configuraciones', href: '/admin/settings', icon: SettingsIcon },
];

const AdminSidebar: React.FC = () => {
  const location = useLocation();

  const groups = React.useMemo(() => {
    const result: Array<{ label?: string; highlight?: boolean; items: NavLink[] }> = [
      { items: [] },
    ];

    navigation.forEach((item) => {
      if ('section' in item) {
        result.push({ label: item.section, highlight: item.highlight, items: [] });
      } else {
        result[result.length - 1].items.push(item);
      }
    });

    return result.filter((group) => group.items.length > 0 || group.label);
  }, []);

  return (
    <Sidebar className="bg-white border-r border-gray-200" collapsible="icon">
      <div className="flex h-16 items-center gap-3 px-4 border-b border-gray-200">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-sm font-bold text-white">
          VB
        </div>
        <span className="text-base font-semibold text-black group-data-[collapsible=icon]:hidden">
          VortexNails
        </span>
      </div>

      <SidebarContent className="px-2 py-4">
        {groups.map((group, groupIndex) => (
          <SidebarGroup key={groupIndex}>
            {group.label && (
              <SidebarGroupLabel
                className={group.highlight ? 'text-blue-600 font-bold' : 'text-gray-500'}
              >
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.href}
                    >
                      <Link to={item.href} className="flex w-full items-center gap-2">
                        <item.icon className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};

export default AdminSidebar;
