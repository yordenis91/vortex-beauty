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
  Building2,
  Layers,
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
  { name: 'Panel de Control', href: '/superadmin/dashboard', icon: LayoutDashboard },
  { section: 'Plataforma', highlight: true },
  { name: 'Salones (Tenants)', href: '/superadmin/tenants', icon: Building2 },
  { name: 'Planes', href: '/superadmin/plans', icon: Layers },
];

const SuperAdminSidebar: React.FC = () => {
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

  // El portal de plataforma es un tema oscuro fijo, independiente del modo
  // claro/oscuro del salón. Los componentes base de Sidebar (hover, estado
  // activo, bordes) se pintan a partir de las variables --sidebar-* del tema
  // global, que están pensadas para el sidebar CLARO por defecto; sin fijarlas
  // aquí, esos estados heredan texto oscuro sobre nuestro fondo oscuro y
  // pierden contraste. Se fijan explícitamente para este sidebar en vez de
  // pelear con el orden de cascada de las utilidades de Tailwind.
  const sidebarThemeVars = {
    '--sidebar': '#111827', // gray-900
    '--sidebar-foreground': '#f3f4f6', // gray-100
    '--sidebar-accent': '#1f2937', // gray-800 (fondo de hover)
    '--sidebar-accent-foreground': '#ffffff',
    '--sidebar-border': '#1f2937', // gray-800
    '--sidebar-ring': '#6366f1', // indigo-500
  } as React.CSSProperties;

  return (
    <Sidebar style={sidebarThemeVars} className="border-r border-gray-800" collapsible="icon">
      <div className="flex h-16 items-center gap-3 px-4 border-b border-gray-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-bold text-white">
          SA
        </div>
        <span className="text-base font-semibold text-white group-data-[collapsible=icon]:hidden">
          Super Admin
        </span>
      </div>

      <SidebarContent className="px-2 py-4">
        {groups.map((group, groupIndex) => (
          <SidebarGroup key={groupIndex}>
            {group.label && (
              <SidebarGroupLabel
                className={group.highlight ? 'text-indigo-400 font-bold' : 'text-gray-400'}
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
                      className="text-gray-200 data-[active=true]:bg-indigo-600 data-[active=true]:text-white data-[active=true]:hover:bg-indigo-600 data-[active=true]:hover:text-white"
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

export default SuperAdminSidebar;
