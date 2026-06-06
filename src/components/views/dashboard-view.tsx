'use client';

import React, { useEffect, useCallback, useState } from 'react';
import {
  Shield,
  Building2,
  Lock,
  Code2,
  Download,
  Play,
  ListOrdered,
  Layers,
  Wrench,
  LayoutGrid,
  ArrowRightLeft,
  Database,
  Globe,
  Brain,
  GitBranch,
  Settings,
  Search,
  HardDrive,
  Hammer,
  CreditCard,
  FileSearch,
  Bell,
  Activity,
  Puzzle,
  Zap,
  CheckCircle2,
  Clock,
  ScanSearch,
  Layers3,
  Workflow,
  HeartPulse,
  ChevronDown,
  ChevronRight,
  Package,
  Boxes,
  Layout,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

// ============================================================
// Types
// ============================================================

interface EngineModule {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  status: 'active' | 'ready';
  category: 'foundation' | 'plugin-system' | 'registry' | 'gateway' | 'core-service';
  uptime: string;
}

interface SystemEvent {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  source: string;
  timestamp: string;
}

// ============================================================
// Static Data — Core Engine Modules
// ============================================================

const coreEngines: EngineModule[] = [
  // Foundation
  { id: 'auth', name: 'Auth Engine', description: 'JWT + session-based authentication with multi-factor support', icon: Shield, status: 'active', category: 'foundation', uptime: '99.99%' },
  { id: 'tenant', name: 'Tenant Engine', description: 'Multi-tenant isolation with configurable data boundaries', icon: Building2, status: 'active', category: 'foundation', uptime: '99.98%' },
  { id: 'rbac', name: 'RBAC Engine', description: 'Role-based access control with granular permission policies', icon: Lock, status: 'active', category: 'foundation', uptime: '99.97%' },

  // Plugin System
  { id: 'plugin-sdk', name: 'Plugin SDK', description: 'Development toolkit for building and packaging plugins', icon: Code2, status: 'active', category: 'plugin-system', uptime: '100%' },
  { id: 'plugin-loader', name: 'Plugin Loader', description: 'Dynamic plugin discovery, install, and lifecycle management', icon: Download, status: 'active', category: 'plugin-system', uptime: '99.95%' },
  { id: 'plugin-runtime', name: 'Plugin Runtime', description: 'Sandboxed execution environment with resource isolation', icon: Play, status: 'active', category: 'plugin-system', uptime: '99.93%' },
  { id: 'plugin-registry', name: 'Plugin Registry', description: 'Central repository for plugin metadata and versions', icon: ListOrdered, status: 'active', category: 'plugin-system', uptime: '99.99%' },

  // Registries
  { id: 'capability-registry', name: 'Capability Registry', description: 'Registers and resolves plugin capabilities and features', icon: Layers, status: 'active', category: 'registry', uptime: '99.98%' },
  { id: 'tool-registry', name: 'Tool Registry', description: 'AI-callable tool registration with schema validation', icon: Wrench, status: 'active', category: 'registry', uptime: '99.97%' },
  { id: 'ui-registry', name: 'UI Registry', description: 'Dynamic sidebar, page, and widget registration system', icon: LayoutGrid, status: 'active', category: 'registry', uptime: '99.96%' },

  // Gateways
  { id: 'event-bus', name: 'Event Bus', description: 'High-throughput publish/subscribe event messaging system', icon: ArrowRightLeft, status: 'active', category: 'gateway', uptime: '99.99%' },
  { id: 'event-store', name: 'Event Store', description: 'Persistent event log with replay and audit capabilities', icon: Database, status: 'active', category: 'gateway', uptime: '99.98%' },
  { id: 'mcp-gateway', name: 'MCP Gateway', description: 'Model Context Protocol integration for AI agent communication', icon: Globe, status: 'active', category: 'gateway', uptime: '99.94%' },
  { id: 'ai-gateway', name: 'AI Gateway', description: 'Unified AI model routing with fallback and load balancing', icon: Brain, status: 'active', category: 'gateway', uptime: '99.91%' },

  // Core Services
  { id: 'workflow', name: 'Workflow Engine', description: 'Visual workflow orchestration with conditional branching', icon: GitBranch, status: 'active', category: 'core-service', uptime: '99.96%' },
  { id: 'settings', name: 'Settings Engine', description: 'Hierarchical configuration management with inheritance', icon: Settings, status: 'active', category: 'core-service', uptime: '99.99%' },
  { id: 'search', name: 'Search Engine', description: 'Full-text search with faceted filtering and ranking', icon: Search, status: 'active', category: 'core-service', uptime: '99.95%' },
  { id: 'storage', name: 'Storage Engine', description: 'Multi-backend storage abstraction with file management', icon: HardDrive, status: 'active', category: 'core-service', uptime: '99.98%' },
  { id: 'builder', name: 'Builder Engine', description: 'Plugin packaging, build pipeline, and asset optimization', icon: Hammer, status: 'active', category: 'core-service', uptime: '99.92%' },
  { id: 'billing', name: 'Billing Engine', description: 'Usage metering, invoicing, and subscription management', icon: CreditCard, status: 'ready', category: 'core-service', uptime: '99.97%' },
  { id: 'audit', name: 'Audit Engine', description: 'Comprehensive audit trail with tamper-proof logging', icon: FileSearch, status: 'active', category: 'core-service', uptime: '99.99%' },
  { id: 'notification', name: 'Notification Engine', description: 'Multi-channel notifications (email, push, in-app, webhook)', icon: Bell, status: 'active', category: 'core-service', uptime: '99.96%' },
];

const categoryLabels: Record<EngineModule['category'], string> = {
  foundation: 'Foundation',
  'plugin-system': 'Plugin System',
  registry: 'Registries',
  gateway: 'Gateways & Messaging',
  'core-service': 'Core Services',
};

const categoryOrder: EngineModule['category'][] = ['foundation', 'plugin-system', 'registry', 'gateway', 'core-service'];

// ============================================================
// Static Data — Mock System Events
// ============================================================

const mockEvents: SystemEvent[] = [
  { id: '1', type: 'success', message: 'Plugin "CRM Pro" activated successfully', source: 'Plugin Runtime', timestamp: '2m ago' },
  { id: '2', type: 'info', message: 'AI Gateway routed request to GPT-4o model', source: 'AI Gateway', timestamp: '5m ago' },
  { id: '3', type: 'success', message: 'Workflow "Customer Onboarding" completed', source: 'Workflow Engine', timestamp: '8m ago' },
  { id: '4', type: 'info', message: 'Event Bus throughput: 12,847 events/min', source: 'Event Bus', timestamp: '12m ago' },
  { id: '5', type: 'warning', message: 'Storage Engine nearing 75% capacity threshold', source: 'Storage Engine', timestamp: '18m ago' },
  { id: '6', type: 'success', message: 'New capability registered: "invoice.generate"', source: 'Capability Registry', timestamp: '25m ago' },
  { id: '7', type: 'info', message: 'MCP Gateway connected 3 new AI agent sessions', source: 'MCP Gateway', timestamp: '31m ago' },
  { id: '8', type: 'success', message: 'Audit log checkpoint saved (snapshot #4,291)', source: 'Audit Engine', timestamp: '45m ago' },
  { id: '9', type: 'info', message: 'Search index rebuilt for 1,247 documents', source: 'Search Engine', timestamp: '1h ago' },
  { id: '10', type: 'success', message: 'Billing Engine generated monthly invoice batch', source: 'Billing Engine', timestamp: '1h ago' },
  { id: '11', type: 'info', message: 'Plugin SDK v2.4.1 compatibility check passed', source: 'Plugin SDK', timestamp: '2h ago' },
  { id: '12', type: 'warning', message: 'Tenant "Acme Corp" approaching API rate limit', source: 'Tenant Engine', timestamp: '2h ago' },
];

// ============================================================
// Static Data — Marketplace Apps (for architecture diagram)
// ============================================================

const marketplaceApps = [
  { name: 'CRM', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { name: 'ERP', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { name: 'Finance', color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
  { name: 'HR', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
  { name: 'Analytics', color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800' },
  { name: 'Support', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800' },
  { name: 'Inventory', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800' },
  { name: 'Projects', color: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800' },
];

// ============================================================
// Dashboard View
// ============================================================

export default function DashboardView() {
  const {
    systemStats,
    setSystemStats,
    systemLoading,
    setSystemLoading,
    recentEvents,
    setRecentEvents,
    eventsLoading,
    setEventsLoading,
  } = useAppStore();
  const { user } = useAuthStore();

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categoryOrder)
  );

  const fetchSystemStats = useCallback(async () => {
    setSystemLoading(true);
    try {
      const res = await fetch('/api/system');
      if (res.ok) {
        const data = await res.json();
        setSystemStats(data);
      }
    } catch {
      // ignore
    } finally {
      setSystemLoading(false);
    }
  }, [setSystemStats, setSystemLoading]);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch('/api/events?limit=10');
      if (res.ok) {
        const data = await res.json();
        setRecentEvents(data.events);
      }
    } catch {
      // ignore
    } finally {
      setEventsLoading(false);
    }
  }, [setRecentEvents, setEventsLoading]);

  useEffect(() => {
    fetchSystemStats();
    fetchEvents();

    const interval = setInterval(() => {
      fetchSystemStats();
      fetchEvents();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchSystemStats, fetchEvents]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const activeEngines = coreEngines.filter((e) => e.status === 'active').length;
  const readyEngines = coreEngines.filter((e) => e.status === 'ready').length;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Core Architecture
          </h1>
          <p className="text-muted-foreground mt-1">
            AENEWS Enterprise OS — Kernel module overview and system health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 bg-card">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              All Systems Operational
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 bg-card text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{activeEngines}</span> active
            <span className="mx-0.5">·</span>
            <span className="font-medium text-foreground">{readyEngines}</span> ready
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1 — Core Engine Status Grid
          ═══════════════════════════════════════════════════════════ */}
      <section aria-label="Core Engine Modules">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold">Core Engine Modules</h2>
          <Badge variant="outline" className="ml-1">{coreEngines.length} engines</Badge>
        </div>

        <div className="space-y-4">
          {categoryOrder.map((cat) => {
            const engines = coreEngines.filter((e) => e.category === cat);
            const isExpanded = expandedCategories.has(cat);
            return (
              <div key={cat}>
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="flex items-center gap-2 mb-3 hover:text-foreground text-muted-foreground transition-colors group"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {categoryLabels[cat]}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {engines.length}
                  </Badge>
                </button>

                {/* Engine cards grid */}
                {isExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-2">
                    {engines.map((engine) => (
                      <EngineCard key={engine.id} engine={engine} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2 — Architecture Flow Diagram
          ═══════════════════════════════════════════════════════════ */}
      <section aria-label="Architecture Diagram">
        <div className="flex items-center gap-2 mb-4">
          <Workflow className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Architecture Flow</h2>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <ArchitectureDiagram />
          </CardContent>
        </Card>
      </section>

      {/* ─── Lower Grid: Stats + Events + Actions ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ═══════════════════════════════════════════════════════════
            SECTION 3 — Plugin System Stats
            ═══════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-lg">Plugin Ecosystem</CardTitle>
            </div>
            <CardDescription>System-wide plugin and capability metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatRow
              icon={Package}
              label="Total Plugins Registered"
              value={systemStats ? String(systemStats.stats.plugins.total) : '24'}
              loading={systemLoading}
            />
            <StatRow
              icon={Zap}
              label="Active Plugins"
              value={systemStats ? String(systemStats.stats.plugins.active) : '18'}
              loading={systemLoading}
              accent="emerald"
            />
            <StatRow
              icon={Layers}
              label="Total Capabilities"
              value="147"
            />
            <StatRow
              icon={Wrench}
              label="Total Tools Registered"
              value={systemStats ? String(systemStats.stats.tools.registered) : '89'}
              loading={systemLoading}
            />
            <StatRow
              icon={LayoutGrid}
              label="UI Extensions"
              value="34"
              detail="Sidebar · Pages · Widgets"
            />
            <StatRow
              icon={GitBranch}
              label="Total Workflows"
              value="12"
            />
            <Separator />
            <StatRow
              icon={Activity}
              label="Event Bus Throughput"
              value="12.8K/min"
              accent="amber"
            />
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 4 — Recent System Events
            ═══════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-rose-500" />
              <CardTitle className="text-lg">Recent System Events</CardTitle>
            </div>
            <CardDescription>Latest activity across all engine modules</CardDescription>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full max-w-[220px]" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1 max-h-[420px] overflow-y-auto custom-scrollbar">
                {(recentEvents.length > 0
                  ? recentEvents.map((e) => ({
                      id: e.id,
                      type: 'info' as const,
                      message: formatEventType(e.eventType),
                      source: e.sourcePlugin || 'System',
                      timestamp: formatTimeAgo(e.createdAt),
                    }))
                  : mockEvents
                ).map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 5 — Quick Actions
            ═══════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </div>
            <CardDescription>Common administrative operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ActionButton
                icon={ScanSearch}
                label="Scan Plugins"
                description="Re-scan plugin directories for changes"
                variant="default"
              />
              <ActionButton
                icon={Layers}
                label="View All Capabilities"
                description="Browse registered plugin capabilities"
                variant="outline"
              />
              <ActionButton
                icon={LayoutGrid}
                label="View All UI Extensions"
                description="Manage sidebar items, pages, and widgets"
                variant="outline"
              />
              <ActionButton
                icon={GitBranch}
                label="View All Workflows"
                description="Open workflow orchestration manager"
                variant="outline"
              />
              <ActionButton
                icon={HeartPulse}
                label="System Health Check"
                description="Run diagnostics on all engine modules"
                variant="outline"
              />
              <ActionButton
                icon={Boxes}
                label="View All Tools"
                description="Browse AI-callable tools registry"
                variant="outline"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// Sub-components
// ============================================================

function EngineCard({ engine }: { engine: EngineModule }) {
  const Icon = engine.icon;

  return (
    <div className="group relative rounded-xl border bg-card p-4 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200">
      {/* Top row: Icon + Name + Badge */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Icon className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight truncate">{engine.name}</h3>
          </div>
        </div>
        <Badge
          className={
            engine.status === 'active'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px]'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]'
          }
          variant="outline"
        >
          {engine.status === 'active' ? (
            <CheckCircle2 className="h-3 w-3 mr-0.5" />
          ) : (
            <Clock className="h-3 w-3 mr-0.5" />
          )}
          {engine.status}
        </Badge>
      </div>
      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {engine.description}
      </p>
      {/* Uptime footer */}
      <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-muted-foreground">
        <Activity className="h-3 w-3" />
        <span>Uptime: {engine.uptime}</span>
      </div>
    </div>
  );
}

// ─── Architecture Flow Diagram ───

function ArchitectureDiagram() {
  return (
    <div className="flex flex-col items-center gap-0">
      {/* Top: AENEWS OS */}
      <div className="w-full max-w-3xl rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3 text-center shadow-sm">
        <span className="text-white font-bold text-base tracking-wide">AENEWS OS</span>
      </div>

      {/* Connector */}
      <div className="w-px h-6 bg-emerald-400 dark:bg-emerald-600" />

      {/* Core Engine label */}
      <div className="w-full max-w-3xl rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 px-6 py-3 text-center">
        <span className="font-bold text-sm text-slate-700 dark:text-slate-300 tracking-wide">CORE ENGINE</span>
      </div>

      {/* Connector */}
      <div className="w-px h-6 bg-slate-400 dark:bg-slate-600" />

      {/* Engine modules grid inside a bordered container */}
      <div className="w-full max-w-3xl rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {/* Foundation */}
          <ArchBlock name="Auth" color="emerald" />
          <ArchBlock name="Tenant" color="emerald" />
          <ArchBlock name="RBAC" color="emerald" />

          {/* Plugin System */}
          <ArchBlock name="Plugin SDK" color="teal" />
          <ArchBlock name="Plugin Loader" color="teal" />
          <ArchBlock name="Plugin Runtime" color="teal" />
          <ArchBlock name="Plugin Registry" color="teal" />

          {/* Registries */}
          <ArchBlock name="Capability Reg" color="amber" />
          <ArchBlock name="Tool Registry" color="amber" />
          <ArchBlock name="UI Registry" color="amber" />

          {/* Gateways */}
          <ArchBlock name="AI Gateway" color="rose" />
          <ArchBlock name="MCP Gateway" color="rose" />
          <ArchBlock name="Event Bus" color="rose" />
          <ArchBlock name="Event Store" color="rose" />

          {/* Core Services */}
          <ArchBlock name="Workflow" color="slate" />
          <ArchBlock name="Settings" color="slate" />
          <ArchBlock name="Storage" color="slate" />
          <ArchBlock name="Search" color="slate" />
          <ArchBlock name="Builder" color="slate" />
          <ArchBlock name="Billing" color="slate" />
          <ArchBlock name="Audit" color="slate" />
          <ArchBlock name="Notifications" color="slate" />
        </div>
      </div>

      {/* Connector */}
      <div className="w-px h-6 bg-slate-400 dark:bg-slate-600" />

      {/* Marketplace label */}
      <div className="w-full max-w-3xl rounded-lg bg-amber-100 dark:bg-amber-900/30 border-2 border-dashed border-amber-300 dark:border-amber-700 px-6 py-3 text-center">
        <span className="font-bold text-sm text-amber-700 dark:text-amber-300 tracking-wide">MARKETPLACE</span>
      </div>

      {/* Connector */}
      <div className="w-px h-6 bg-amber-400 dark:bg-amber-600" />

      {/* Marketplace apps */}
      <div className="w-full max-w-3xl rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {marketplaceApps.map((app) => (
            <div
              key={app.name}
              className={`rounded-lg border px-3 py-2.5 text-center text-xs font-medium ${app.color}`}
            >
              {app.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ArchBlock({ name, color }: { name: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };

  return (
    <div className={`rounded-md border px-3 py-2 text-center text-[11px] font-medium ${colorMap[color] || colorMap.slate}`}>
      {name}
    </div>
  );
}

// ─── Stat Row ───

function StatRow({
  icon: Icon,
  label,
  value,
  detail,
  loading,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  loading?: boolean;
  accent?: 'emerald' | 'amber';
}) {
  const accentClasses = accent === 'emerald'
    ? 'text-emerald-600 dark:text-emerald-400'
    : accent === 'amber'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-foreground';

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted-foreground truncate">{label}</span>
          {loading ? (
            <Skeleton className="h-5 w-12 rounded" />
          ) : (
            <span className={`text-sm font-semibold tabular-nums ${accentClasses}`}>
              {value}
            </span>
          )}
        </div>
        {detail && (
          <p className="text-[11px] text-muted-foreground mt-0.5">{detail}</p>
        )}
      </div>
    </div>
  );
}

// ─── Event Row ───

function EventRow({ event }: { event: SystemEvent }) {
  const colorMap: Record<string, string> = {
    success: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    info: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    error: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  };

  const iconMap: Record<string, LucideIcon> = {
    success: CheckCircle2,
    info: Activity,
    warning: Clock,
    error: Clock,
  };

  const Icon = iconMap[event.type] || Activity;

  return (
    <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full mt-0.5 ${colorMap[event.type]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug truncate">{event.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground">{event.source}</span>
          <span className="text-[11px] text-muted-foreground/50">·</span>
          <span className="text-[11px] text-muted-foreground">{event.timestamp}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Action Button ───

function ActionButton({
  icon: Icon,
  label,
  description,
  variant,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  variant: 'default' | 'outline';
}) {
  return (
    <Button
      variant={variant}
      className="w-full justify-start h-auto py-3 px-4 flex items-center gap-3 text-left"
    >
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
        variant === 'default'
          ? 'bg-primary-foreground/20'
          : 'bg-muted'
      }`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{description}</p>
      </div>
    </Button>
  );
}

// ─── Utilities ───

function formatEventType(type: string): string {
  return type
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Plugin/gi, '')
    .trim();
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
