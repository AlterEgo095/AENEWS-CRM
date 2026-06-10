'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Bell,
  Bot,
  Shield,
  Rocket,
  Cpu,
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
import ChatView from '@/components/views/chat-view';
import PluginView from '@/components/views/plugin-view';
import PluginEntityView from '@/components/views/plugin-entity-view';
import ValidationSuiteView from '@/components/views/validation-suite-view';
import PhaseOmegaView from '@/components/views/phase-omega-view';
import PhaseSigmaView from '@/components/views/phase-sigma-view';

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
      { id: 'chat', label: 'AI Assistant', icon: Bot },
      { id: 'plugins', label: 'Plugins', icon: Puzzle },
      { id: 'app-store', label: 'App Store', icon: Store },
      { id: 'phase-omega', label: 'Phase Omega', icon: Rocket },
      { id: 'phase-sigma', label: 'Phase Σ Micro-Kernel', icon: Cpu },
      { id: 'validation-suite', label: 'Validation Suite', icon: Shield },
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

  // Check if there are dynamic sections to show
  const hasDynamicSections = dynamicSections.length > 0;

  // Properly merge core sections with dynamic plugin sections
  const allNavSections = useMemo(() => {
    const sections = [...coreNavSections];
    if (hasDynamicSections) {
      sections.push(...dynamicSections);
    }
    return sections;
  }, [coreNavSections, dynamicSections, hasDynamicSections]);

  // All nav items for breadcrumb computation
  const allNavItems = useMemo(() => {
    const items: NavItem[] = [];
    for (const s of allNavSections) {
      for (const i of s.items) items.push(i);
    }
    return items;
  }, [allNavSections]);

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

  // Notification state
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll unread notification count every 30 seconds
  useEffect(() => {
    if (!user?.id || !user?.tenantId) return;

    const poll = () => {
      fetch(
        `/api/notifications?userId=${user.id}&tenantId=${user.tenantId}&countOnly=true`
      )
        .then((res) => {
          if (res.ok) return res.json();
        })
        .then((data) => {
          if (data) setUnreadCount(data.unread ?? 0);
        })
        .catch(() => {
          // Silently ignore polling errors
        });
    };

    // Fire immediately via setTimeout (avoids synchronous setState in effect)
    const timeoutId = setTimeout(poll, 0);
    const intervalId = setInterval(poll, 30_000);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [user?.id, user?.tenantId]);

  const initials = user
    ? `${(user.firstName?.[0] || '').toUpperCase()}${(user.lastName?.[0] || '').toUpperCase()}`
    : 'AU';
  const displayName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    : 'Admin User';

  // Dynamic sidebar sections for breadcrumb resolution
  const [dynamicSections, setDynamicSections] = useState<NavSection[]>([]);

  // Fetch dynamic sections for breadcrumb resolution
  useEffect(() => {
    const fetchUI = async () => {
      try {
        const res = await fetch('/api/ui-extensions');
        if (res.ok) {
          const data = await res.json();
          const sidebarItems: UISidebarItemData[] = data.sidebar || [];
          const sectionMap = new Map<string, NavItem[]>();
          for (const item of sidebarItems) {
            const section = item.section || 'Plugins';
            if (!sectionMap.has(section)) sectionMap.set(section, []);
            sectionMap.get(section)!.push({
              id: item.id,
              label: item.label,
              icon: item.icon ? getIconByName(item.icon) : LucideIcons.Box,
            });
          }
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
      } catch { /* ignore */ }
    };
    fetchUI();
  }, []);

  const breadcrumbSegments = useMemo(() => {
    // Build a flat list of all sections + items (including dynamic plugin sections)
    const allItems: { section: NavSection; item: NavItem }[] = [];
    for (const s of coreNavSections) {
      for (const i of s.items) {
        allItems.push({ section: s, item: i });
      }
    }
    // Also include dynamic sections for breadcrumb resolution
    for (const s of dynamicSections) {
      for (const i of s.items) {
        allItems.push({ section: s, item: i });
      }
    }

    const current = allItems.find((x) => x.item.id === currentView);
    if (current) {
      return [
        { label: current.section.label, id: current.section.id },
        { label: current.item.label, id: current.item.id },
      ];
    }

    // For unknown views (plugin views with colon notation like "garage:cars")
    if (currentView.includes(':')) {
      const parts = currentView.split(':');
      return [
        { label: 'Plugins', id: 'plugins' },
        { label: parts[0].charAt(0).toUpperCase() + parts[0].slice(1), id: parts[0] },
        { label: parts[1].charAt(0).toUpperCase() + parts[1].slice(1), id: currentView },
      ];
    }

    // Try to capitalize the view ID as a fallback
    return [{
      label: currentView
        ? currentView.charAt(0).toUpperCase() + currentView.slice(1).replace(/-/g, ' ')
        : 'Dashboard',
      id: currentView || 'dashboard',
    }];
  }, [currentView, dynamicSections]);

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

      {/* Notification Bell */}
      <Button
        variant="ghost"
        size="icon"
        className="relative h-9 w-9"
        onClick={() => setCurrentView('settings')}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] font-bold leading-none flex items-center justify-center rounded-full"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </Button>

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
// Core view IDs that use dedicated components
// ============================================================

const CORE_VIEW_IDS = new Set([
  'dashboard',
  'chat',
  'plugins',
  'app-store',
  'settings',
  'phase-omega',
  'phase-sigma',
  'validation-suite',
]);

// Plugin view IDs that have dedicated components
// (these are handled specially, but could also fall through to PluginView)
const CRM_VIEW_IDS = new Set([
  'crm-contacts',
  'crm-companies',
  'crm-deals',
  'crm-tasks',
]);

// ============================================================
// View Switcher — fully dynamic
// ============================================================

function ViewSwitcher() {
  const { currentView } = useAppStore();

  return (
    <div className="flex-1">
      <ViewRouter currentView={currentView} />
    </div>
  );
}

/**
 * ViewRouter renders the appropriate view for the currentView.
 *
 * 1. Core views (dashboard, chat, plugins, app-store, settings) → dedicated components
 * 2. Known CRM views (crm-contacts, etc.) → dedicated CRM components
 * 3. Plugin colon-notation views (e.g., "garage:cars") → PluginEntityView
 * 4. Any other view ID → generic PluginView (treats the full ID as a plugin slug)
 */
function ViewRouter({ currentView }: { currentView: string }) {
  // 1. Core views
  if (CORE_VIEW_IDS.has(currentView)) {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'chat':
        return <ChatView />;
      case 'plugins':
        return <PluginsView />;
      case 'app-store':
        return <AppStoreView />;
      case 'settings':
        return <SettingsView />;
      case 'phase-omega':
        return <PhaseOmegaView />;
      case 'phase-sigma':
        return <PhaseSigmaView />;
      case 'validation-suite':
        return <ValidationSuiteView />;
    }
  }

  // 2. Known CRM views — use dedicated CRM component
  if (CRM_VIEW_IDS.has(currentView)) {
    return <CrmContactsView />;
  }

  // 3. Plugin colon-notation views (e.g., "garage:cars", "hotel:rooms")
  if (currentView.includes(':')) {
    const [pluginSlug, entityName] = currentView.split(':', 2);
    if (pluginSlug && entityName) {
      return <PluginEntityView pluginSlug={pluginSlug} entityName={entityName} />;
    }
  }

  // 4. Any other view ID → treat as plugin slug and use generic PluginView
  return <PluginView pluginSlug={currentView} />;
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
