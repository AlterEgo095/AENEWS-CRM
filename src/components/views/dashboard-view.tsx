'use client';

import React, { useEffect, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2,
  Clock,
  Activity,
  Zap,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers3,
  Workflow,
  HeartPulse,
  ScanSearch,
  Layers,
  LayoutGrid,
  GitBranch,
  Boxes,
  Package,
  ArrowUpRight,
  Shield,
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

interface EngineData {
  id: string;
  name: string;
  version: string;
  status: string;
  description: string;
  category: string;
  icon: string;
  stats?: Record<string, any>;
}

interface PluginData {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  status: string;
  tools: number;
  capabilities: number;
  agents: number;
  knowledge: number;
  schemas: number;
  uiExtensions: number;
}

interface DashboardCardData {
  id: string;
  pluginId: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  value?: string | number | null;
  trend?: string | null;
  href?: string | null;
  color?: string | null;
  order?: number;
}

interface ArchitectureData {
  platform: {
    name: string;
    version: string;
    tagline: string;
    bootstrapped: boolean;
  };
  engines: EngineData[];
  plugins: PluginData[];
  totalEngines: number;
  dashboardCards?: DashboardCardData[];
  uiStats?: Record<string, number>;
}

interface SystemEvent {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  source: string;
  timestamp: string;
}

// ============================================================
// Category configuration — derived from API at runtime
// ============================================================

const CORE_CATEGORIES = ['core', 'ai', 'infrastructure', 'security', 'dev-tools'];
const MARKETPLACE_CATEGORIES = ['builder', 'data', 'automation', 'ui'];

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core Plugin System',
  ai: 'AI & Intelligence',
  infrastructure: 'Infrastructure',
  security: 'Security & Identity',
  'dev-tools': 'Developer Tools',
  builder: 'Builder & UI',
  data: 'Data & Schema',
  automation: 'Automation',
  ui: 'UI Extensions',
};

// Category color map for architecture blocks
const CATEGORY_COLORS: Record<string, string> = {
  core: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  ai: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  infrastructure: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  security: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  'dev-tools': 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  builder: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800',
  data: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  automation: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  ui: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
};

const BUSINESS_MODULES = [
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

  // Architecture data from API
  const [archData, setArchData] = useState<ArchitectureData | null>(null);
  const [archLoading, setArchLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // UI Extensions data
  const [uiExtensions, setUiExtensions] = useState<any>(null);

  // Live dashboard card data from /api/dashboard
  const [liveCardData, setLiveCardData] = useState<Record<string, { value: string; trend: string }>>({});
  const [liveCardLoading, setLiveCardLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Fetch architecture data
    void (async () => {
      try {
        const res = await fetch('/api/architecture');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setArchData(data);
          const cats = new Set<string>();
          data.engines.forEach((e: EngineData) => cats.add(e.category));
          setExpandedCategories(cats);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setArchLoading(false);
      }
    })();

    // Fetch UI extensions for dashboard cards and stats
    void (async () => {
      try {
        const res = await fetch('/api/ui-extensions');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setUiExtensions(data);
        }
      } catch {
        // ignore
      }
    })();

    // Fetch live dashboard card data from /api/dashboard
    void (async () => {
      try {
        const res = await fetch('/api/dashboard');
        if (res.ok && !cancelled) {
          const data = await res.json();
          const map: Record<string, { value: string; trend: string }> = {};
          for (const card of data.cards || []) {
            map[card.id] = { value: card.value, trend: card.trend };
          }
          setLiveCardData(map);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLiveCardLoading(false);
      }
    })();

    // Fetch system stats (legacy, for events loading state)
    const loadSystemStats = async () => {
      try {
        const res = await fetch('/api/system');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setSystemStats(data);
        }
      } catch {
        // ignore
      }
    };
    void loadSystemStats();

    // Fetch events
    const loadEvents = async () => {
      try {
        const res = await fetch('/api/events?limit=15');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRecentEvents(data.events);
        }
      } catch {
        // ignore
      }
    };
    void loadEvents();

    const interval = setInterval(() => {
      void loadSystemStats();
      void loadEvents();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setSystemStats, setRecentEvents]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Group engines by category
  const enginesByCategory = React.useMemo(() => {
    if (!archData) return {};
    const groups: Record<string, EngineData[]> = {};
    archData.engines.forEach((e) => {
      if (!groups[e.category]) groups[e.category] = [];
      groups[e.category].push(e);
    });
    return groups;
  }, [archData]);

  // Category order from data
  const categoryOrder = React.useMemo(() => {
    return Object.keys(enginesByCategory);
  }, [enginesByCategory]);

  // Plugin stats totals
  const pluginTotals = React.useMemo(() => {
    if (!archData) return { tools: 0, capabilities: 0, agents: 0, knowledge: 0, schemas: 0, uiExtensions: 0 };
    return archData.plugins.reduce(
      (acc, p) => ({
        tools: acc.tools + p.tools,
        capabilities: acc.capabilities + p.capabilities,
        agents: acc.agents + p.agents,
        knowledge: acc.knowledge + p.knowledge,
        schemas: acc.schemas + p.schemas,
        uiExtensions: acc.uiExtensions + p.uiExtensions,
      }),
      { tools: 0, capabilities: 0, agents: 0, knowledge: 0, schemas: 0, uiExtensions: 0 }
    );
  }, [archData]);

  // Dashboard cards from UI extensions — enriched with live data
  const dashboardCards = React.useMemo(() => {
    const baseCards: DashboardCardData[] = uiExtensions?.dashboardCards
      || archData?.dashboardCards
      || [];

    // Merge live data into the cards
    return baseCards.map((card) => {
      const live = liveCardData[card.id];
      if (live) {
        return { ...card, value: live.value, trend: live.trend };
      }
      return card;
    });
  }, [uiExtensions, archData, liveCardData]);

  const activeEngines = archData
    ? archData.engines.filter((e) => e.status === 'active').length
    : 0;
  const readyEngines = archData
    ? archData.engines.filter((e) => e.status === 'ready').length
    : 0;

  // UI Stats from extensions or architecture
  const uiStats = uiExtensions?.stats || {};

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {archData?.platform.name || 'Core Architecture'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {archData?.platform.tagline || 'AENEWS Enterprise OS'} — Kernel module overview and system health.
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
          SECTION 1 — Plugin Dashboard Cards
          ═══════════════════════════════════════════════════════════ */}
      {(dashboardCards.length > 0 || liveCardLoading) && (
        <section aria-label="Dashboard Cards">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveCardLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={`skeleton-${i}`} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-start gap-4">
                    <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-7 w-16" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              dashboardCards.slice(0, 3).map((card) => (
                <DashboardCardWidget key={card.id} card={card} />
              ))
            )}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2 — Core Engine Modules (from API)
          ═══════════════════════════════════════════════════════════ */}
      <section aria-label="Core Engine Modules">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold">Engine Modules</h2>
          <Badge variant="outline" className="ml-1">{archData?.totalEngines || '—'} engines</Badge>
        </div>

        {archLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {categoryOrder.map((cat) => {
              const engines = enginesByCategory[cat] || [];
              const isExpanded = expandedCategories.has(cat);
              return (
                <div key={cat}>
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
                      {CATEGORY_LABELS[cat] || cat}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {engines.length}
                    </Badge>
                  </button>

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
        )}
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3 — Architecture Flow Diagram (3-Layer)
          ═══════════════════════════════════════════════════════════ */}
      <section aria-label="Architecture Diagram">
        <div className="flex items-center gap-2 mb-4">
          <Workflow className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-semibold">Architecture Flow</h2>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-6">
            <ArchitectureDiagram
              engines={archData?.engines || []}
              plugins={archData?.plugins || []}
            />
          </CardContent>
        </Card>
      </section>

      {/* ─── Lower Grid: Stats + Events + Actions ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ═══════════════════════════════════════════════════════════
            SECTION 4 — Plugin Ecosystem Stats (real data)
            ═══════════════════════════════════════════════════════════ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-lg">Plugin Ecosystem</CardTitle>
            </div>
            <CardDescription>Real-time metrics from all engine registries</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatRow
              icon={Package}
              label="Plugins Registered"
              value={String(archData?.plugins.length ?? '—')}
              loading={archLoading}
            />
            <StatRow
              icon={Zap}
              label="Active Plugins"
              value={String(archData?.plugins.filter((p) => p.status === 'active').length ?? '—')}
              loading={archLoading}
              accent="emerald"
            />
            <Separator />
            <StatRow
              icon={Layers}
              label="Total Capabilities"
              value={String(pluginTotals.capabilities)}
              loading={archLoading}
            />
            <StatRow
              icon={LucideIcons.Wrench as unknown as LucideIcon}
              label="Total Tools Registered"
              value={String(pluginTotals.tools)}
              loading={archLoading}
            />
            <StatRow
              icon={LucideIcons.Bot as unknown as LucideIcon}
              label="AI Agents"
              value={String(pluginTotals.agents)}
              loading={archLoading}
            />
            <StatRow
              icon={LucideIcons.BookOpen as unknown as LucideIcon}
              label="Knowledge Entries"
              value={String(pluginTotals.knowledge)}
              loading={archLoading}
            />
            <StatRow
              icon={LucideIcons.FileCode as unknown as LucideIcon}
              label="Schemas"
              value={String(pluginTotals.schemas)}
              loading={archLoading}
            />
            <Separator />
            <StatRow
              icon={LayoutGrid}
              label="UI Extensions"
              value={String(uiStats.dashboardCards ? uiStats.sidebarItems + uiStats.pages + uiStats.dashboardCards + uiStats.actions + uiStats.commands : pluginTotals.uiExtensions)}
              detail={`Sidebar: ${uiStats.sidebarItems ?? '—'} · Pages: ${uiStats.pages ?? '—'} · Cards: ${uiStats.dashboardCards ?? '—'}`}
              loading={!uiExtensions}
            />
            <StatRow
              icon={Activity}
              label="Event Bus Throughput"
              value="12.8K/min"
              accent="amber"
            />
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 5 — Recent System Events (from API)
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
            ) : recentEvents.length > 0 ? (
              <div className="space-y-1 max-h-[420px] overflow-y-auto custom-scrollbar">
                {recentEvents.slice(0, 12).map((e) => (
                  <EventRow
                    key={e.id}
                    event={{
                      id: e.id,
                      type: 'info' as const,
                      message: formatEventType(e.eventType),
                      source: e.sourcePlugin || 'System',
                      timestamp: formatTimeAgo(e.createdAt),
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No events recorded yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══════════════════════════════════════════════════════════
            SECTION 6 — Quick Actions
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
              <ActionButton
                icon={Shield}
                label="Architecture Validation Suite"
                description="PHASE FINALE — 15 test categories across 20 plugins"
                variant="default"
                onClick={() => useAppStore.getState().setCurrentView('validation-suite')}
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

// ─── Dynamic Lucide icon component (avoids static-component lint issue) ───

function DynamicIcon({ name, className, fallback }: { name: string; className?: string; fallback?: LucideIcon }) {
  const Icon = (LucideIcons as Record<string, LucideIcon>)[name] || fallback || LucideIcons.Box;
  return <Icon className={className} />;
}

function EngineCard({ engine }: { engine: EngineData }) {

  // Build stats text from engine stats
  const statsText = engine.stats
    ? Object.entries(engine.stats)
        .filter(([, v]) => typeof v === 'number' && v > 0)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ')
    : null;

  return (
    <div className="group relative rounded-xl border bg-card p-4 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <DynamicIcon name={engine.icon} className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight truncate">{engine.name}</h3>
            <p className="text-[10px] text-muted-foreground">v{engine.version}</p>
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
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {engine.description}
      </p>
      {statsText && (
        <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-muted-foreground">
          <Activity className="h-3 w-3" />
          <span className="truncate">{statsText}</span>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Card Widget (from UI Registry) ───

function DashboardCardWidget({ card }: { card: DashboardCardData }) {

  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    blue: 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
    violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    teal: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  };

  const iconBg = colorClasses[card.color || 'emerald'] || colorClasses.emerald;
  const trendIsPositive = card.trend?.startsWith('+');

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <DynamicIcon name={card.icon || ''} fallback={Package} className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground truncate">{card.title}</p>
            {card.trend && (
              <span className={`text-xs font-medium flex items-center gap-0.5 ${trendIsPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {card.trend}
              </span>
            )}
          </div>
          <p className="text-2xl font-bold mt-0.5">{card.value ?? '—'}</p>
          {card.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
          )}
        </div>
        {card.href && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Architecture Flow Diagram (3-Layer) ───

function ArchitectureDiagram({
  engines,
  plugins,
}: {
  engines: EngineData[];
  plugins: PluginData[];
}) {
  const coreEngines = engines.filter((e) => CORE_CATEGORIES.includes(e.category));
  const marketplaceEngines = engines.filter((e) => !CORE_CATEGORIES.includes(e.category));

  return (
    <div className="flex flex-col items-center gap-0">
      {/* Top: AENEWS OS */}
      <div className="w-full max-w-3xl rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3 text-center shadow-sm">
        <span className="text-white font-bold text-base tracking-wide">AENEWS OS</span>
      </div>

      {/* Connector */}
      <div className="w-px h-6 bg-emerald-400 dark:bg-emerald-600" />

      {/* CORE ENGINE Layer */}
      <div className="w-full max-w-3xl rounded-lg bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 px-6 py-3 text-center">
        <span className="font-bold text-sm text-slate-700 dark:text-slate-300 tracking-wide">CORE ENGINE</span>
        <span className="text-xs text-muted-foreground ml-2">{coreEngines.length} modules</span>
      </div>

      {/* Connector */}
      <div className="w-px h-6 bg-slate-400 dark:bg-slate-600" />

      {/* Core engine blocks */}
      <div className="w-full max-w-3xl rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {coreEngines.map((e) => (
            <div
              key={e.id}
              className={`rounded-md border px-3 py-2 text-center text-[11px] font-medium ${
                CATEGORY_COLORS[e.category] || CATEGORY_COLORS.core
              }`}
            >
              {e.name}
            </div>
          ))}
        </div>
      </div>

      {/* Connector */}
      <div className="w-px h-6 bg-slate-400 dark:bg-slate-600" />

      {/* MARKETPLACE Layer */}
      <div className="w-full max-w-3xl rounded-lg bg-amber-100 dark:bg-amber-900/30 border-2 border-dashed border-amber-300 dark:border-amber-700 px-6 py-3 text-center">
        <span className="font-bold text-sm text-amber-700 dark:text-amber-300 tracking-wide">MARKETPLACE</span>
        <span className="text-xs text-muted-foreground ml-2">
          {plugins.map((p) => `${p.tools} tools · ${p.capabilities} caps`).join(' | ')}
        </span>
      </div>

      {/* Connector */}
      <div className="w-px h-6 bg-amber-400 dark:bg-amber-600" />

      {/* Marketplace content: plugin engines + business modules */}
      <div className="w-full max-w-3xl rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4">
        {/* Plugin engine blocks */}
        {marketplaceEngines.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {marketplaceEngines.map((e) => (
              <div
                key={e.id}
                className={`rounded-md border px-3 py-2 text-center text-[11px] font-medium ${
                  CATEGORY_COLORS[e.category] || CATEGORY_COLORS.core
                }`}
              >
                {e.name}
              </div>
            ))}
          </div>
        )}

        {/* Plugin capabilities */}
        {plugins.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 mb-1.5 uppercase tracking-wider">Plugin Capabilities</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {plugins.map((p) => (
                <div key={p.id} className="rounded-md border border-amber-200 dark:border-amber-700 bg-amber-100/50 dark:bg-amber-900/20 px-3 py-2 text-center">
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {p.tools}t · {p.capabilities}c · {p.agents}a
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Business Modules */}
        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Business Modules</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BUSINESS_MODULES.map((app) => (
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
