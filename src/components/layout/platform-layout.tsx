'use client';

import React, { useEffect, useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Puzzle,
  Store,
  Settings,
  Moon,
  Sun,
  LogOut,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/lib/utils';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarInset,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import DashboardView from '@/components/views/dashboard-view';
import PluginsView from '@/components/views/plugins-view';
import AppStoreView from '@/components/views/app-store-view';
import SettingsView from '@/components/views/settings-view';
import CrmContactsView from '@/components/views/crm-contacts-view';

// ============================================================
// Types
// ============================================================

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

interface UISidebarItemData {
  id: string;
  pluginId: string;
  label: string;
  icon?: string | null;
  section?: string | null;
  order?: number;
  href?: string | null;
  badge?: string | number | null;
  permission?: string | null;
}

// ============================================================
// Helper: resolve icon name string to Lucide component
// ============================================================

function getIconByName(name: string): LucideIcon {
  const Icon = (LucideIcons as Record<string, LucideIcon>)[name];
  return Icon || LucideIcons.Box;
}

// ============================================================
// Core Nav (hardcoded base items)
// ============================================================

const coreNavSections: NavSection[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'plugins', label: 'Plugins', icon: Puzzle },
      { id: 'app-store', label: 'App Store', icon: Store },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

// ============================================================
// Sidebar
// ============================================================

function AppSidebar() {
  const { currentView, setCurrentView } = useAppStore();
  const { user } = useAuthStore();

  // Dynamic sidebar items from UI Registry
  const [dynamicSections, setDynamicSections] = useState<NavSection[]>([]);
  const [uiLoading, setUiLoading] = useState(false);

  const initials = user
    ? `${(user.firstName?.[0] || '').toUpperCase()}${(user.lastName?.[0] || '').toUpperCase()}`
    : 'AU';
  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    : 'Admin User';
  const roleLabel = user?.roles?.[0] || 'Admin';

  // Fetch UI extensions on mount
  useEffect(() => {
    const fetchUIExtensions = async () => {
      setUiLoading(true);
      try {
        const res = await fetch('/api/ui-extensions');
        if (res.ok) {
          const data = await res.json();
          const sidebarItems: UISidebarItemData[] = data.sidebar || [];

          // Group sidebar items by section
          const sectionMap = new Map<string, NavItem[]>();
          for (const item of sidebarItems) {
            const section = item.section || 'Plugins';
            if (!sectionMap.has(section)) {
              sectionMap.set(section, []);
            }
            sectionMap.get(section)!.push({
              id: item.id,
              label: item.label,
              icon: item.icon ? getIconByName(item.icon) : LucideIcons.Box,
            });
          }

          // Convert to NavSection array
          const sections: NavSection[] = [];
          for (const [sectionId, items] of sectionMap) {
            sections.push({
              id: sectionId.toLowerCase().replace(/\s+/g, '-'),
              label: sectionId,
              items: items.sort((a, b) => a.label.localeCompare(b.label)),
            });
          }

          setDynamicSections(sections);
        }
      } catch {
        // ignore
      } finally {
        setUiLoading(false);
      }
    };

    fetchUIExtensions();
  }, []);

  // Merge core sections with dynamic sections
  const allSections = useMemo(() => {
    if (dynamicSections.length === 0) return coreNavSections;
    return coreNavSections;
  }, [dynamicSections]);

  // Check if there are dynamic CRM sections to show
  const hasDynamicSections = dynamicSections.length > 0;

  // All nav items for breadcrumb computation
  const allNavItems = useMemo(() => {
    const items: NavItem[] = [];
    for (const s of allSections) {
      for (const i of s.items) items.push(i);
    }
    for (const s of dynamicSections) {
      for (const i of s.items) items.push(i);
    }
    return items;
  }, [allSections, dynamicSections]);

  const allNavSections = useMemo(() => {
    if (!hasDynamicSections) return allSections;
    return [...allSections, ...dynamicSections];
  }, [allSections, dynamicSections, hasDynamicSections]);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
            A
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold tracking-tight leading-tight">
              AENEWS
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              Enterprise OS
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {allNavSections.map((section) => (
          <React.Fragment key={section.id}>
            <SidebarGroup>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        isActive={currentView === item.id}
                        tooltip={item.label}
                        onClick={() => setCurrentView(item.id)}
                      >
                        <item.icon className="size-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
          </React.Fragment>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user?.avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">{displayName}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {roleLabel}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

// ============================================================
// Header
// ============================================================

function Header() {
  const { currentView, setCurrentView } = useAppStore();
  const { setTheme, theme } = useTheme();
  const { user, logout } = useAuthStore();

  const initials = user
    ? `${(user.firstName?.[0] || '').toUpperCase()}${(user.lastName?.[0] || '').toUpperCase()}`
    : 'AU';
  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    : 'Admin User';

  const breadcrumbSegments = useMemo(() => {
    // Build a flat list of all sections + items
    const allItems: { section: NavSection; item: NavItem }[] = [];
    for (const s of coreNavSections) {
      for (const i of s.items) {
        allItems.push({ section: s, item: i });
      }
    }

    const current = allItems.find((x) => x.item.id === currentView);
    if (!current) {
      // Check dynamic sidebar items (stored in DOM or state)
      // Fallback: just show the current view ID
      return [{ label: currentView || 'Dashboard', id: currentView || 'dashboard' }];
    }

    const segments = [];
    segments.push({ label: current.section.label, id: current.section.id });
    segments.push({ label: current.item.label, id: current.item.id });
    return segments;
  }, [currentView]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 md:px-6">
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="mr-2 h-4" />

      <Breadcrumb className="flex-1">
        <BreadcrumbList>
          {breadcrumbSegments.map((segment, idx) => (
            <React.Fragment key={segment.id}>
              {idx > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {idx < breadcrumbSegments.length - 1 ? (
                  <BreadcrumbLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                    }}
                    className="text-muted-foreground"
                  >
                    {segment.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="font-medium">
                    {segment.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme('light')}>
              <Sun className="mr-2 h-4 w-4" />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('dark')}>
              <Moon className="mr-2 h-4 w-4" />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme('system')}>
              <Sun className="mr-2 h-4 w-4" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <div className="flex items-center gap-2 p-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-0.5">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs text-muted-foreground leading-none">{user?.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setCurrentView('settings')}>
              <User className="mr-2 h-4 w-4" />
              Profile & Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => logout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// ============================================================
// View Switcher
// ============================================================

function ViewSwitcher() {
  const { currentView } = useAppStore();

  const viewMap: Record<string, React.ReactNode> = {
    dashboard: <DashboardView />,
    plugins: <PluginsView />,
    'app-store': <AppStoreView />,
    settings: <SettingsView />,
    'crm-contacts': <CrmContactsView />,
    'crm-companies': <CrmContactsView />,
    'crm-deals': <CrmContactsView />,
    'crm-tasks': <CrmContactsView />,
  };

  return (
    <div className="flex-1">
      {viewMap[currentView] || <DashboardView />}
    </div>
  );
}

// ============================================================
// Platform Layout (default export)
// ============================================================

export default function PlatformLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex flex-col w-full">
        <div className="flex flex-1">
          <AppSidebar />
          <SidebarInset className="flex flex-col">
            <Header />
            <div className="flex-1 overflow-auto">
              <ViewSwitcher />
            </div>
          </SidebarInset>
        </div>
      </div>
    </SidebarProvider>
  );
}
