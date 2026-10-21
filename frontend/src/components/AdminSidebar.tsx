import React from 'react';
import { LogoMark } from '../brand/Logo';
import { brand } from '../brand/brand';
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
  UserCog,
  Calendar,
  Package,
  Folder,
  Sparkles,
  Bell,
  Settings as SettingsIcon,
  CreditCard,
  DoorOpen,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLabels } from '@/hooks/useLabels';
import { canManage } from '@/types';

interface NavLink {
  name: string;
  href: string;
  icon: LucideIcon;
  /** Quién la ve: todos los del panel, solo quienes administran, o solo el dueño. */
  access?: 'manager' | 'owner';
}

interface NavSection {
  section: string;
  highlight?: boolean;
}

type NavItem = NavLink | NavSection;

const buildNavigation = (label: (key: string, capitalize?: boolean) => string): NavItem[] => [
  { name: 'Panel de Control', href: '/admin/dashboard', icon: LayoutDashboard },
  { section: 'Negocio', highlight: true },
  { name: label('customers', true), href: '/admin/clients', icon: Users, access: 'manager' },
  { section: 'Agenda y catálogo', highlight: true },
  { name: label('appointments', true), href: '/admin/appointments', icon: Calendar },
  { name: label('professionals', true), href: '/admin/professionals', icon: UserCog, access: 'manager' },
  { name: label('services', true), href: '/admin/services', icon: Package, access: 'manager' },
  { name: 'Categorías', href: '/admin/categories', icon: Folder, access: 'manager' },
  { name: 'Recursos', href: '/admin/resources', icon: DoorOpen, access: 'manager' },
  { name: 'Galería', href: '/admin/gallery', icon: Sparkles, access: 'manager' },
  { section: 'Operaciones', highlight: true },
  { name: 'Notificaciones', href: '/admin/notifications', icon: Bell, access: 'manager' },
  { name: 'Equipo', href: '/admin/team', icon: ShieldCheck, access: 'owner' },
  { name: 'Facturación', href: '/admin/billing', icon: CreditCard, access: 'owner' },
  { name: 'Configuraciones', href: '/admin/settings', icon: SettingsIcon, access: 'manager' },
];

const AdminSidebar: React.FC = () => {
  const location = useLocation();
  const { role } = useAuth();
  const { label, salonName } = useLabels();

  const groups = React.useMemo(() => {
    const navigation = buildNavigation(label).filter(
      (item) =>
        'section' in item ||
        !item.access ||
        (item.access === 'manager' ? canManage(role) : role === 'OWNER')
    );
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

    return result.filter((group) => group.items.length > 0);
  }, [role, label]);

  return (
    <Sidebar className="bg-white border-r border-gray-200" collapsible="icon">
      <div className="flex h-16 items-center gap-3 px-4 border-b border-gray-200">
        <LogoMark size={40} />
        <span className="min-w-0 line-clamp-2 break-words text-sm font-semibold leading-tight text-black group-data-[collapsible=icon]:hidden">
          {salonName ?? brand.name}
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
