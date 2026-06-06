'use client';

import React, { useMemo } from 'react';
import {
  LayoutDashboard,
  Search,
  Users,
  DollarSign,
  UserCog,
  Package,
  Megaphone,
  Headphones,
  FolderKanban,
  ShoppingCart,
  Sparkles,
  Store,
  Workflow,
  Bell,
  Settings,
  Building2,
  UsersRound,
  CreditCard,
  ChevronDown,
  Moon,
  Sun,
  LogOut,
  User,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { useAppStore } from '@/store/app-store';
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import DashboardView from '@/components/views/dashboard-view';
import AppStoreView from '@/components/views/app-store-view';
import ChatView from '@/components/views/chat-view';
import SettingsView from '@/components/views/settings-view';
import CrmView from '@/components/views/crm-view';
import FinanceView from '@/components/views/finance-view';
import HrView from '@/components/views/hr-view';
import StockView from '@/components/views/stock-view';
import MarketingView from '@/components/views/marketing-view';
import SupportView from '@/components/views/support-view';
import ProjectsView from '@/components/views/projects-view';
import EcommerceView from '@/components/views/ecommerce-view';
import WorkflowsView from '@/components/views/workflows-view';
import NotificationsView from '@/components/views/notifications-view';

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  section?: string;
}

interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
  collapsible?: boolean;
}

const navSections: NavSection[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'command-palette', label: 'Command Palette', icon: Search },
    ],
  },
  {
    id: 'apps',
    label: 'Apps',
    collapsible: true,
    items: [
      { id: 'crm', label: 'CRM', icon: Users },
      { id: 'finance', label: 'Finance', icon: DollarSign },
      { id: 'hr', label: 'HR', icon: UserCog },
      { id: 'stock', label: 'Stock', icon: Package },
      { id: 'marketing', label: 'Marketing', icon: Megaphone },
      { id: 'support', label: 'Support', icon: Headphones },
      { id: 'projects', label: 'Projects', icon: FolderKanban },
      { id: 'ecommerce', label: 'eCommerce', icon: ShoppingCart },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    items: [
      { id: 'ai-chat', label: 'AI Chat', icon: Sparkles },
      { id: 'app-store', label: 'App Store', icon: Store },
      { id: 'workflows', label: 'Workflows', icon: Workflow },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'organization', label: 'Organization', icon: Building2 },
      { id: 'members', label: 'Members', icon: UsersRound },
      { id: 'billing', label: 'Billing', icon: CreditCard },
    ],
  },
];

function AppSidebar() {
  const { currentView, setCurrentView } = useAppStore();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
            A
          </div>
          <span className="text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            AENEWS
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navSections.map((section) => (
          <React.Fragment key={section.id}>
            {section.collapsible ? (
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarGroup>
                  <SidebarGroupLabel asChild>
                    <CollapsibleTrigger className="flex w-full items-center">
                      {section.label}
                      <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
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
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            ) : (
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
            )}
            <SidebarSeparator />
          </React.Fragment>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src="/logo.svg" alt="Admin" />
                <AvatarFallback className="rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                  AD
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-semibold">Admin User</span>
                <span className="truncate text-xs text-muted-foreground">
                  Organization Admin
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

function Header() {
  const { currentView, setCurrentView } = useAppStore();
  const { setTheme, theme } = useTheme();

  const breadcrumbSegments = useMemo(() => {
    const allItems = navSections.flatMap((s) => s.items);
    const current = allItems.find((i) => i.id === currentView);
    const section = navSections.find((s) =>
      s.items.some((i) => i.id === currentView)
    );

    if (!current) return [];

    const segments = [];
    if (section) {
      segments.push({ label: section.label, id: section.id });
    }
    segments.push({ label: current.label, id: current.id });
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setCurrentView('ai-chat')}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>AI Chat</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 relative"
              onClick={() => setCurrentView('notifications')}
            >
              <Bell className="h-4 w-4" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                3
              </Badge>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              {theme === 'dark' ? (
                <Moon className="h-4 w-4" />
              ) : theme === 'light' ? (
                <Sun className="h-4 w-4" />
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
              <LayoutDashboard className="mr-2 h-4 w-4" />
              System
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
                  AD
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCurrentView('settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

function ViewSwitcher() {
  const { currentView } = useAppStore();

  const viewMap: Record<string, React.ReactNode> = {
    dashboard: <DashboardView />,
    'app-store': <AppStoreView />,
    'ai-chat': <ChatView />,
    settings: <SettingsView />,
    organization: <SettingsView />,
    members: <SettingsView />,
    billing: <SettingsView />,
    crm: <CrmView />,
    finance: <FinanceView />,
    hr: <HrView />,
    stock: <StockView />,
    marketing: <MarketingView />,
    support: <SupportView />,
    projects: <ProjectsView />,
    ecommerce: <EcommerceView />,
    workflows: <WorkflowsView />,
    notifications: <NotificationsView />,
  };

  return (
    <div className="flex-1">
      {viewMap[currentView] || <DashboardView />}
    </div>
  );
}

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
