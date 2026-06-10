'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Cpu, CpuIcon, CheckCircle2, XCircle, AlertTriangle, Activity,
  Layers, Shield, Zap, Database, GitBranch, Eye, HeartPulse,
  Bot, Search, Hammer, BookOpen, Copy, Store, Wand2, Brain,
  RotateCcw, Play, Square, ArrowUpCircle, ArrowDownCircle,
  Package, Server, MemoryStick, Clock, Gauge, RefreshCw,
  ChevronRight, ChevronDown, Terminal, Lock, ArrowDown,
  Network, Sparkles, Radio, Timer, BarChart3, AlertOctagon,
  CircuitBoard, Workflow, Megaphone,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────

interface PluginDetail {
  id: string;
  name: string;
  slug: string;
  version: string;
  category: string;
  state: string;
  capabilities: number;
}

interface KernelData {
  success: boolean;
  kernel: {
    phase: string;
    version: string;
    bootTime: number;
    discoveryTime: number;
    uptime: number;
    memoryMB: number;
  };
  plugins: {
    system: number;
    business: number;
    total: number;
    active: number;
    states: Record<string, string>;
    details: PluginDetail[];
  };
  registries: { type: string; count: number }[];
  totalRegistryEntries: number;
  services: { name: string; provider: string; version: string; state: string }[];
  serviceCount: number;
  events: { subscriptionCount: number; eventCount: number };
  security: { trustedPublishers: number; blockedPlugins: number; permissionPolicies: number };
  discovery: {
    success: boolean;
    duration: number;
    stats: { totalScanned: number; valid: number; invalid: number; systemPlugins: number; businessPlugins: number };
    errors: { pluginId: string; error: string }[];
    warnings: { pluginId: string; warning: string }[];
    layers: string[][];
  } | null;
  systemPluginDetails: {
    id: string;
    name: string;
    description: string;
    version: string;
    provides: string[];
    status: string;
  }[];
  architecture: {
    layers: number;
    names: string[];
    kernelComponents: string[];
  };
  timestamp: number;
}

interface EventBusEvent {
  id: string;
  type: string;
  source: string;
  payload: unknown;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface LifecycleTransition {
  pluginId: string;
  from: string;
  to: string;
  phase: string;
  timestamp: number;
  success: boolean;
  duration: number;
}

// ─── Phase Color Map ──────────────────────────────────────────────

const PHASE_COLORS: Record<string, { text: string; bg: string; dot: string }> = {
  'init':           { text: 'text-gray-500',        bg: 'bg-gray-500/10',       dot: 'bg-gray-500' },
  'booting':        { text: 'text-amber-500',       bg: 'bg-amber-500/10',      dot: 'bg-amber-500' },
  'discovering':    { text: 'text-sky-500',         bg: 'bg-sky-500/10',        dot: 'bg-sky-500' },
  'resolving':      { text: 'text-purple-500',      bg: 'bg-purple-500/10',     dot: 'bg-purple-500' },
  'loading':        { text: 'text-orange-500',      bg: 'bg-orange-500/10',     dot: 'bg-orange-500' },
  'ready':          { text: 'text-emerald-500',     bg: 'bg-emerald-500/10',    dot: 'bg-emerald-500' },
  'running':        { text: 'text-emerald-500',     bg: 'bg-emerald-500/10',    dot: 'bg-emerald-500' },
  'shutting-down':  { text: 'text-red-500',         bg: 'bg-red-500/10',        dot: 'bg-red-500' },
  'stopped':        { text: 'text-gray-500',        bg: 'bg-gray-500/10',       dot: 'bg-gray-500' },
};

// ─── System Plugin Icon Map ─────────────────────────────────────

const SYSTEM_PLUGIN_ICONS: Record<string, React.ReactNode> = {
  'system-ai-orchestrator': <Brain className="h-4 w-4" />,
  'system-search-engine': <Search className="h-4 w-4" />,
  'system-workflow-engine': <GitBranch className="h-4 w-4" />,
  'system-observability': <Eye className="h-4 w-4" />,
  'system-builder': <Hammer className="h-4 w-4" />,
  'system-self-healing': <HeartPulse className="h-4 w-4" />,
  'system-self-optimization': <Zap className="h-4 w-4" />,
  'system-knowledge': <BookOpen className="h-4 w-4" />,
  'system-agent-engine': <Bot className="h-4 w-4" />,
  'system-plugin-generator': <Wand2 className="h-4 w-4" />,
  'system-digital-twin': <Copy className="h-4 w-4" />,
  'system-marketplace': <Store className="h-4 w-4" />,
};

const SYSTEM_PLUGIN_COLORS: Record<string, string> = {
  'system-ai-orchestrator': 'text-violet-500',
  'system-search-engine': 'text-cyan-500',
  'system-workflow-engine': 'text-amber-500',
  'system-observability': 'text-emerald-500',
  'system-builder': 'text-pink-500',
  'system-self-healing': 'text-red-500',
  'system-self-optimization': 'text-orange-500',
  'system-knowledge': 'text-sky-500',
  'system-agent-engine': 'text-purple-500',
  'system-plugin-generator': 'text-fuchsia-500',
  'system-digital-twin': 'text-teal-500',
  'system-marketplace': 'text-indigo-500',
};

// ─── State Color Map ──────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  'ready':    'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'active':   'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'loaded':   'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'pending':  'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'error':    'bg-red-500/10 text-red-600 border-red-500/20',
  'disabled': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

// ─── Helpers ──────────────────────────────────────────────────────

function formatUptime(ms: number): string {
  if (ms <= 0) return 'just booted';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getPhaseStyle(phase: string) {
  return PHASE_COLORS[phase] || PHASE_COLORS['init'];
}

function getStateColor(state: string) {
  return STATE_COLORS[state] || 'bg-gray-500/10 text-gray-500 border-gray-500/20';
}

// ─── Skeleton Loader ─────────────────────────────────────────────

function SkeletonRow() {
  return <div className="h-4 bg-muted rounded animate-pulse" />;
}

// ─── Phase Sigma View ────────────────────────────────────────────

export default function PhaseSigmaView() {
  const [data, setData] = useState<KernelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set());
  const [recentEvents, setRecentEvents] = useState<EventBusEvent[]>([]);
  const [lifecycleLog, setLifecycleLog] = useState<LifecycleTransition[]>([]);
  const [eventFilter, setEventFilter] = useState<string>('all');
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());

  // ─── Fetchers ───────────────────────────────────────────────

  const fetchKernel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sigma');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
        setLastRefresh(Date.now());
      } else {
        throw new Error(json.error || 'Kernel returned failure');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/sigma?section=events');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.recentEvents) {
          setRecentEvents(json.data.recentEvents);
        }
      }
    } catch {
      // silently ignore
    }
  }, []);

  const fetchLifecycle = useCallback(async () => {
    try {
      const res = await fetch('/api/sigma?section=lifecycle');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.transitions) {
          setLifecycleLog(json.data.transitions);
        }
      }
    } catch {
      // silently ignore
    }
  }, []);

  // ─── Auto-refresh every 30s ──────────────────────────────────

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchKernel();
    fetchEvents();
    fetchLifecycle();

    const interval = setInterval(() => {
      fetchKernel();
      fetchEvents();
      fetchLifecycle();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchKernel, fetchEvents, fetchLifecycle]);

  // ─── Actions ────────────────────────────────────────────────

  const togglePlugin = (id: string) => {
    setExpandedPlugins(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReboot = async () => {
    try {
      const res = await fetch('/api/sigma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reboot' }),
      });
      const json = await res.json();
      if (json.success) {
        await Promise.all([fetchKernel(), fetchEvents(), fetchLifecycle()]);
      }
    } catch (err) {
      setError(String(err));
    }
  };

  // ─── Extracted data ──────────────────────────────────────────

  const businessPlugins = data?.plugins.details.filter(p => p.category === 'business') || [];
  const uniqueEventTypes = Array.from(new Set(recentEvents.map(e => e.type)));

  // ─── Loading State ───────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">PHASE SIGMA</h1>
            <p className="text-sm text-muted-foreground">Micro-Kernel IA-Native</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────

  if (error && !data) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">PHASE SIGMA</h1>
            <p className="text-sm text-red-500">Kernel Error</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={fetchKernel} className="mt-4" variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const phaseStyle = getPhaseStyle(data.kernel.phase);

  // ─── Main Render ────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── HEADER ─────────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-lg">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap">
              PHASE <span className="text-2xl">Σ</span> SIGMA
              <Badge variant="outline" className="text-xs font-mono ml-1">
                {data.kernel.version}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Micro-Kernel IA-Native — Minimal, Deterministic, Immutable
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Phase Indicator */}
          <Badge
            variant="outline"
            className={cn('text-xs font-semibold', phaseStyle.text, phaseStyle.bg)}
          >
            <span className={cn('h-2 w-2 rounded-full mr-1.5 animate-pulse', phaseStyle.dot)} />
            {data.kernel.phase.toUpperCase()}
          </Badge>

          {/* Kernel Uptime */}
          <Badge variant="outline" className="text-xs">
            <Timer className="h-3 w-3 mr-1" />
            {formatUptime(data.kernel.uptime)}
          </Badge>

          {/* Actions */}
          <Button variant="outline" size="sm" onClick={handleReboot}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reboot
          </Button>
          <Button variant="outline" size="sm" onClick={() => Promise.all([fetchKernel(), fetchEvents(), fetchLifecycle()])}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── 4-LAYER ARCHITECTURE DIAGRAM ───────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-500" />
            4-Layer Architecture
          </CardTitle>
          <CardDescription className="text-xs">
            Kernel → System Plugins → Business Plugins → AI Layer — each layer depends only on the one below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Layer 1: Micro Kernel */}
          <div className="rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CpuIcon className="h-5 w-5 text-emerald-600" />
              <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">MICRO KERNEL</span>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                {data.architecture.kernelComponents.length} primitives
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 ml-auto">
                IMMUTABLE
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.architecture.kernelComponents.map((comp) => (
                <div key={comp} className="flex items-center gap-1 text-xs text-muted-foreground bg-emerald-500/5 rounded-md px-2 py-1">
                  <Lock className="h-3 w-3 text-emerald-500" />
                  {comp}
                </div>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <ArrowDown className="h-4 w-4 text-emerald-500/50" />
          </div>

          {/* Layer 2: System Plugins */}
          <div className="rounded-xl border-2 border-violet-500/30 bg-violet-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-5 w-5 text-violet-600" />
              <span className="font-bold text-violet-700 dark:text-violet-400 text-sm">SYSTEM PLUGINS</span>
              <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-500/20">
                {data.systemPluginDetails.length} plugins
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-500/20 ml-auto">
                HOT-SWAPPABLE
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.systemPluginDetails.map((sp) => (
                <div key={sp.id} className={cn(
                  'flex items-center gap-1 text-xs rounded-md px-2 py-1 bg-violet-500/5',
                  SYSTEM_PLUGIN_COLORS[sp.id] || 'text-gray-500'
                )}>
                  {SYSTEM_PLUGIN_ICONS[sp.id] || <Package className="h-3 w-3" />}
                  <span className="truncate max-w-[120px]">{sp.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <ArrowDown className="h-4 w-4 text-violet-500/50" />
          </div>

          {/* Layer 3: Business Plugins */}
          <div className="rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Server className="h-5 w-5 text-amber-600" />
              <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">BUSINESS PLUGINS</span>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                {data.plugins.business} plugins
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20 ml-auto">
                DISCOVERED
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {businessPlugins.slice(0, 16).map((bp) => (
                <div key={bp.id} className="flex items-center gap-1 text-xs text-amber-600 bg-amber-500/5 rounded-md px-2 py-1">
                  <Server className="h-3 w-3 text-amber-500" />
                  <span className="truncate max-w-[120px]">{bp.name}</span>
                </div>
              ))}
              {businessPlugins.length > 16 && (
                <div className="text-xs text-amber-500 bg-amber-500/10 rounded-md px-2 py-1">
                  +{businessPlugins.length - 16} more
                </div>
              )}
            </div>
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center">
            <ArrowDown className="h-4 w-4 text-amber-500/50" />
          </div>

          {/* Layer 4: AI Layer */}
          <div className="rounded-xl border-2 border-teal-500/30 bg-teal-500/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-teal-600" />
              <span className="font-bold text-teal-700 dark:text-teal-400 text-sm">AI LAYER</span>
              <Badge variant="outline" className="text-[10px] bg-teal-500/10 text-teal-600 border-teal-500/20 ml-auto">
                INTELLIGENT
              </Badge>
            </div>
            <div className="flex items-center flex-wrap gap-1.5">
              {[
                { icon: <Network className="h-3 w-3" />, label: 'Gateway' },
                { icon: <Brain className="h-3 w-3" />, label: 'Reasoning' },
                { icon: <Workflow className="h-3 w-3" />, label: 'Orchestrator' },
                { icon: <CircuitBoard className="h-3 w-3" />, label: 'Resolver' },
                { icon: <Play className="h-3 w-3" />, label: 'Executor' },
              ].map((ai) => (
                <div key={ai.label} className="flex items-center gap-1 text-xs text-teal-600 bg-teal-500/5 rounded-md px-2 py-1">
                  {ai.icon}
                  {ai.label}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── METRICS ROW ────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Boot Time */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium">Boot Time</span>
            </div>
            <div className="text-2xl font-bold">
              {data.kernel.bootTime}
              <span className="text-sm text-muted-foreground ml-1">ms</span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (data.kernel.bootTime / 200) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Discovery Time */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4 text-teal-500" />
              <span className="text-xs font-medium">Discovery</span>
            </div>
            <div className="text-2xl font-bold">
              {data.kernel.discoveryTime}
              <span className="text-sm text-muted-foreground ml-1">ms</span>
            </div>
            <div className="mt-1 h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (data.kernel.discoveryTime / 100) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Total Plugins */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Package className="h-4 w-4 text-cyan-500" />
              <span className="text-xs font-medium">Total Plugins</span>
            </div>
            <div className="text-2xl font-bold">{data.plugins.total}</div>
            <div className="text-xs text-muted-foreground">
              <span className="text-violet-500">{data.plugins.system} system</span>
              {' + '}
              <span className="text-amber-500">{data.plugins.business} business</span>
              {' · '}
              <span className="text-emerald-500">{data.plugins.active} active</span>
            </div>
          </CardContent>
        </Card>

        {/* Memory + Uptime */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MemoryStick className="h-4 w-4 text-rose-500" />
              <span className="text-xs font-medium">Memory</span>
            </div>
            <div className="text-2xl font-bold">
              {data.kernel.memoryMB}
              <span className="text-sm text-muted-foreground ml-1">MB</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              {formatUptime(data.kernel.uptime)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── 6-TAB PANEL ────────────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Tabs defaultValue="system-plugins" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6">
          <TabsTrigger value="system-plugins" className="text-xs">
            <Package className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            System
          </TabsTrigger>
          <TabsTrigger value="business-plugins" className="text-xs">
            <Server className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Business
          </TabsTrigger>
          <TabsTrigger value="registries" className="text-xs">
            <Database className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Registries
          </TabsTrigger>
          <TabsTrigger value="services" className="text-xs">
            <Gauge className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Services
          </TabsTrigger>
          <TabsTrigger value="discovery" className="text-xs">
            <Terminal className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Discovery
          </TabsTrigger>
          <TabsTrigger value="event-bus" className="text-xs">
            <Radio className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
            Events
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── TAB 1: SYSTEM PLUGINS ─────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        <TabsContent value="system-plugins">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Plugins</CardTitle>
              <CardDescription>
                {data.systemPluginDetails.length} engines extracted from the Kernel — each is a replaceable, hot-swappable plugin.
                Adding, removing, or replacing any of these NEVER requires a Kernel modification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {data.systemPluginDetails.map((sp) => {
                  const isExpanded = expandedPlugins.has(sp.id);
                  const icon = SYSTEM_PLUGIN_ICONS[sp.id] || <Package className="h-4 w-4" />;
                  const colorClass = SYSTEM_PLUGIN_COLORS[sp.id] || 'text-gray-500';
                  const stateFromStates = data.plugins.states[sp.id];

                  return (
                    <div
                      key={sp.id}
                      className="rounded-lg border hover:border-primary/30 transition-colors"
                    >
                      <button
                        className="w-full flex items-center gap-3 p-3 text-left"
                        onClick={() => togglePlugin(sp.id)}
                      >
                        <div className={cn('flex-shrink-0', colorClass)}>{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{sp.name}</span>
                            <Badge variant="outline" className="text-[10px] font-mono">{sp.version}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{sp.description}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {sp.provides.length > 0 && (
                            <div className="hidden md:flex gap-1">
                              {sp.provides.slice(0, 3).map(s => (
                                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                              ))}
                              {sp.provides.length > 3 && (
                                <Badge variant="secondary" className="text-[10px]">+{sp.provides.length - 3}</Badge>
                              )}
                            </div>
                          )}
                          <Badge
                            variant="outline"
                            className={cn('text-[10px]', getStateColor(stateFromStates || sp.status))}
                          >
                            {stateFromStates || sp.status}
                          </Badge>
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          }
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-2 border-t bg-muted/20">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <span className="text-xs text-muted-foreground">Plugin ID</span>
                              <p className="text-xs font-mono mt-0.5 break-all">{sp.id}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Version</span>
                              <p className="text-xs font-mono mt-0.5">{sp.version}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Status</span>
                              <p className="text-xs mt-0.5">{stateFromStates || sp.status}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Provides</span>
                              <p className="text-xs mt-0.5">{sp.provides.join(', ') || 'none'}</p>
                            </div>
                          </div>
                          {/* Capabilities & Tools from details */}
                          {data.plugins.details.find(d => d.id === sp.id) && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2 pt-2 border-t">
                              <div className="flex items-center gap-2">
                                <Zap className="h-3 w-3 text-amber-500" />
                                <span className="text-xs text-muted-foreground">
                                  {data.plugins.details.find(d => d.id === sp.id)?.capabilities || 0} capabilities
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Shield className="h-3 w-3 text-emerald-500" />
                                <span className="text-xs text-muted-foreground">
                                  {sp.provides.length} services provided
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className={cn('h-3 w-3', (stateFromStates || sp.status) === 'ready' ? 'text-emerald-500' : 'text-amber-500')} />
                                <span className="text-xs text-muted-foreground">
                                  {(stateFromStates || sp.status) === 'ready' ? 'Operational' : 'Standby'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── TAB 2: BUSINESS PLUGINS ───────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        <TabsContent value="business-plugins">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Business Plugins</CardTitle>
              <CardDescription>
                {businessPlugins.length} plugins discovered from the plugins directory.
                Each plugin provides business-specific capabilities on top of the system layer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {businessPlugins.length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                  {businessPlugins.map((bp) => (
                    <div key={bp.id} className="flex items-center gap-3 rounded-lg border p-3 hover:border-amber-500/30 transition-colors">
                      <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Server className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">{bp.name}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">{bp.version}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">{bp.slug}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {bp.capabilities > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            <Zap className="h-3 w-3 mr-0.5" />
                            {bp.capabilities} caps
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn('text-[10px]', getStateColor(bp.state))}
                        >
                          {bp.state}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Server className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No business plugins discovered yet.</p>
                  <p className="text-xs mt-1">Place plugin directories in the <code className="font-mono bg-muted px-1 rounded">plugins/</code> folder.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── TAB 3: REGISTRIES ─────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        <TabsContent value="registries">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Registry Manager</CardTitle>
                <CardDescription>
                  The Kernel knows only: <code className="font-mono text-xs bg-muted px-1 rounded">register()</code>,{' '}
                  <code className="font-mono text-xs bg-muted px-1 rounded">unregister()</code>,{' '}
                  <code className="font-mono text-xs bg-muted px-1 rounded">resolve()</code>,{' '}
                  <code className="font-mono text-xs bg-muted px-1 rounded">query()</code>,{' '}
                  <code className="font-mono text-xs bg-muted px-1 rounded">watch()</code>
                  {' '}— All 10 registries are services managed by the Registry Manager.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {data.registries.map((reg) => (
                    <div key={reg.type} className="flex items-center justify-between rounded-lg border p-3 hover:border-cyan-500/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-cyan-500" />
                        <span className="text-sm font-medium">{reg.type}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${Math.min(100, (reg.count / Math.max(1, ...data.registries.map(r => r.count))) * 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold tabular-nums">{reg.count}</span>
                        <span className="text-xs text-muted-foreground">entries</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Registry Entries</span>
                  <span className="text-xl font-bold text-emerald-600">{data.totalRegistryEntries}</span>
                </div>
              </CardContent>
            </Card>

            {/* Registry API Card */}
            <Card className="bg-gradient-to-br from-cyan-500/5 to-teal-500/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-cyan-500" />
                  Registry API
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { fn: 'register()', desc: 'Add entry to registry', color: 'text-emerald-500' },
                    { fn: 'unregister()', desc: 'Remove entry', color: 'text-red-500' },
                    { fn: 'resolve()', desc: 'Find by key', color: 'text-cyan-500' },
                    { fn: 'query()', desc: 'Pattern search', color: 'text-teal-500' },
                    { fn: 'watch()', desc: 'Observe changes', color: 'text-amber-500' },
                  ].map((api) => (
                    <div key={api.fn} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                      <code className={cn('text-xs font-mono font-semibold', api.color)}>{api.fn}</code>
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">{api.desc}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    {data.registries.length} registry types · {data.totalRegistryEntries} total entries
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── TAB 4: SERVICES ──────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        <TabsContent value="services">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Service Container</CardTitle>
                <CardDescription>
                  All plugins use these shared services exclusively. Never direct imports between plugins.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {data.services.length > 0 ? data.services.map((svc) => (
                    <div key={svc.name} className="flex items-center justify-between rounded-lg border p-3 hover:border-emerald-500/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center',
                          svc.provider === 'kernel' ? 'bg-emerald-500/10' : 'bg-violet-500/10'
                        )}>
                          {svc.provider === 'kernel'
                            ? <Gauge className="h-4 w-4 text-emerald-500" />
                            : <Package className="h-4 w-4 text-violet-500" />
                          }
                        </div>
                        <div>
                          <span className="text-sm font-medium">{svc.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            by {svc.provider}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">{svc.version}</Badge>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px]', getStateColor(svc.state))}
                        >
                          {svc.state}
                        </Badge>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Gauge className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No services registered yet.</p>
                    </div>
                  )}
                </div>

                {/* Empty Slots */}
                {data.services.length < 8 && (
                  <>
                    <Separator className="my-3" />
                    <p className="text-xs text-muted-foreground mb-2">Available Slots (not yet registered)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {['cache', 'queue', 'scheduler', 'notifications', 'analytics', 'session', 'i18n', 'files'].map(slot => {
                        const isRegistered = data.services.some(s => s.name === slot);
                        return (
                          <div
                            key={slot}
                            className={cn(
                              'flex items-center gap-2 rounded-md border p-2 text-xs',
                              isRegistered ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-muted/30 border-dashed opacity-50'
                            )}
                          >
                            {isRegistered
                              ? <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              : <Square className="h-3 w-3 text-muted-foreground" />
                            }
                            {slot}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Service Container API */}
            <Card className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CircuitBoard className="h-5 w-5 text-emerald-500" />
                  Service API
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { fn: 'register()', desc: 'Provide a service', color: 'text-emerald-500' },
                    { fn: 'resolve()', desc: 'Consume a service', color: 'text-cyan-500' },
                    { fn: 'list()', desc: 'All services', color: 'text-teal-500' },
                    { fn: 'count', desc: 'Service count', color: 'text-amber-500' },
                  ].map((api) => (
                    <div key={api.fn} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                      <code className={cn('text-xs font-mono font-semibold', api.color)}>{api.fn}</code>
                      <span className="text-[10px] text-muted-foreground hidden sm:inline">{api.desc}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-3" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    {data.serviceCount} registered · Isolation enforced
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── TAB 5: DISCOVERY LOG ────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        <TabsContent value="discovery">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Discovery Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Discovery Engine V2</CardTitle>
                <CardDescription>
                  Produces a Metadata Graph ONLY. Never fills registries directly.
                  Registry Manager consumes the graph.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {data.discovery ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      {data.discovery.success
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        : <AlertTriangle className="h-5 w-5 text-amber-500" />
                      }
                      <span className="text-sm font-medium">
                        {data.discovery.success ? 'Discovery Successful' : 'Discovery Completed with Issues'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">Duration</span>
                        <p className="text-lg font-bold">{data.discovery.duration}ms</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">Total Scanned</span>
                        <p className="text-lg font-bold">{data.discovery.stats.totalScanned}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">Valid Plugins</span>
                        <p className="text-lg font-bold text-emerald-600">{data.discovery.stats.valid}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">Invalid Plugins</span>
                        <p className="text-lg font-bold text-red-600">{data.discovery.stats.invalid}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">System Plugins</span>
                        <p className="text-lg font-bold text-violet-600">{data.discovery.stats.systemPlugins}</p>
                      </div>
                      <div className="rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">Business Plugins</span>
                        <p className="text-lg font-bold text-amber-600">{data.discovery.stats.businessPlugins}</p>
                      </div>
                    </div>

                    {/* Errors */}
                    {data.discovery.errors.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertOctagon className="h-4 w-4 text-red-500" />
                          <span className="text-xs font-medium text-red-500">Errors ({data.discovery.errors.length})</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {data.discovery.errors.map((e, i) => (
                            <div key={i} className="text-xs text-red-500 bg-red-500/10 rounded p-1.5 font-mono">
                              <span className="font-bold">{e.pluginId}</span>: {e.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {data.discovery.warnings.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          <span className="text-xs font-medium text-amber-500">Warnings ({data.discovery.warnings.length})</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {data.discovery.warnings.map((w, i) => (
                            <div key={i} className="text-xs text-amber-600 bg-amber-500/10 rounded p-1.5 font-mono">
                              <span className="font-bold">{w.pluginId}</span>: {w.warning}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No discovery data available yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dependency Layers + Phase History */}
            <div className="space-y-4">
              {/* Dependency Layers */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GitBranch className="h-5 w-5 text-teal-500" />
                    Dependency Layers
                  </CardTitle>
                  <CardDescription>
                    Plugin dependency resolution layers (bottom-up)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data.discovery?.layers && data.discovery.layers.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {data.discovery.layers.map((layer, idx) => (
                        <div key={idx} className="rounded-lg border p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px]">
                              Layer {idx + 1}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {layer.length} plugin{layer.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {layer.map((plugin) => (
                              <span
                                key={plugin}
                                className="text-[10px] font-mono bg-muted rounded px-1.5 py-0.5"
                              >
                                {plugin.replace(/^(test-)?/, '').replace(/-/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No dependency layers resolved.</p>
                  )}
                </CardContent>
              </Card>

              {/* Phase History Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-emerald-500" />
                    Phase History
                  </CardTitle>
                  <CardDescription>
                    Recent lifecycle transitions across all plugins
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {lifecycleLog.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5">
                      {lifecycleLog.slice().reverse().map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs rounded-md border p-2">
                          <div className={cn(
                            'h-2 w-2 rounded-full flex-shrink-0',
                            t.success ? 'bg-emerald-500' : 'bg-red-500'
                          )} />
                          <span className="font-mono text-muted-foreground flex-shrink-0">
                            {formatTimestamp(t.timestamp)}
                          </span>
                          <span className="font-mono truncate flex-1">{t.pluginId.replace(/-/g, ' ')}</span>
                          <Badge variant="outline" className="text-[9px]">
                            {t.from} → {t.to}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{t.duration}ms</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <BarChart3 className="h-6 w-6 mx-auto mb-1 opacity-30" />
                      <p className="text-xs">No transitions recorded yet.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════ */}
        {/* ── TAB 6: EVENT BUS ────────────────────────────── */}
        {/* ═══════════════════════════════════════════════════ */}
        <TabsContent value="event-bus">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Radio className="h-5 w-5 text-emerald-500" />
                  Event Bus Stats
                </CardTitle>
                <CardDescription>
                  All inter-plugin communication flows through the Event Bus.
                  Wildcard pattern matching with priority-based handlers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-amber-500" />
                      <span className="font-medium text-sm">Subscriptions</span>
                    </div>
                    <span className="text-2xl font-bold">{data.events.subscriptionCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-teal-500" />
                      <span className="font-medium text-sm">Events Processed</span>
                    </div>
                    <span className="text-2xl font-bold">{data.events.eventCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-cyan-500" />
                      <span className="font-medium text-sm">Event Types</span>
                    </div>
                    <span className="text-2xl font-bold">{uniqueEventTypes.length}</span>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Event Type Filter */}
                {uniqueEventTypes.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Filter by Type</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setEventFilter('all')}
                        className={cn(
                          'text-[10px] px-2 py-1 rounded-md border transition-colors',
                          eventFilter === 'all'
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                            : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                        )}
                      >
                        All ({recentEvents.length})
                      </button>
                      {uniqueEventTypes.map(type => (
                        <button
                          key={type}
                          onClick={() => setEventFilter(type)}
                          className={cn(
                            'text-[10px] px-2 py-1 rounded-md border transition-colors font-mono truncate max-w-[140px]',
                            eventFilter === type
                              ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30'
                              : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Events */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Recent Events</CardTitle>
                <CardDescription>
                  {eventFilter === 'all'
                    ? `Showing all ${recentEvents.length} events`
                    : `Filtered by "${eventFilter}" — ${recentEvents.filter(e => e.type === eventFilter).length} events`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentEvents.length > 0 ? (
                  <div className="max-h-96 overflow-y-auto pr-1">
                    <div className="space-y-1.5">
                      {(eventFilter === 'all'
                        ? recentEvents.slice().reverse()
                        : recentEvents.filter(e => e.type === eventFilter).slice().reverse()
                      ).map((evt, i) => (
                        <div key={evt.id || i} className="flex items-start gap-2 rounded-lg border p-2.5 hover:border-cyan-500/20 transition-colors">
                          <div className={cn(
                            'flex-shrink-0 h-6 w-6 rounded-md flex items-center justify-center mt-0.5',
                            evt.type.includes('kernel') ? 'bg-emerald-500/10'
                              : evt.type.includes('plugin') ? 'bg-violet-500/10'
                              : evt.type.includes('lifecycle') ? 'bg-amber-500/10'
                              : 'bg-cyan-500/10'
                          )}>
                            <Sparkles className={cn(
                              'h-3 w-3',
                              evt.type.includes('kernel') ? 'text-emerald-500'
                                : evt.type.includes('plugin') ? 'text-violet-500'
                                : evt.type.includes('lifecycle') ? 'text-amber-500'
                                : 'text-cyan-500'
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {evt.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground font-mono">
                                from {evt.source}
                              </span>
                            </div>
                            {evt.payload && typeof evt.payload === 'object' && (
                              <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                                {JSON.stringify(evt.payload)}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">
                            {formatTimestamp(evt.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Radio className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No events recorded yet.</p>
                    <p className="text-xs mt-1">Events will appear as plugins communicate.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* ─── KERNEL PRINCIPLES ───────────────────────────────── */}
      {/* ═══════════════════════════════════════════════════════ */}
      <Card className="bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CpuIcon className="h-5 w-5 text-emerald-500" />
            SIGMA Principles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: <Lock className="h-4 w-4 text-emerald-500" />,
                title: 'Kernel is Immutable',
                desc: 'The Kernel code never changes. All evolution happens through plugins.',
              },
              {
                icon: <Package className="h-4 w-4 text-violet-500" />,
                title: 'Everything is a Plugin',
                desc: 'AI, Marketplace, Search, Workflow, Self-Healing — all are plugins, not kernel features.',
              },
              {
                icon: <Gauge className="h-4 w-4 text-cyan-500" />,
                title: 'Service Container Only',
                desc: 'Plugins communicate through shared services. Never direct imports.',
              },
              {
                icon: <RotateCcw className="h-4 w-4 text-amber-500" />,
                title: 'Hot Swap Everything',
                desc: 'Install, activate, deactivate, update, rollback, remove — zero restart.',
              },
              {
                icon: <Database className="h-4 w-4 text-pink-500" />,
                title: 'Generic Registry Manager',
                desc: 'register/unregister/resolve/query/watch — the only 5 operations the kernel knows.',
              },
              {
                icon: <Terminal className="h-4 w-4 text-teal-500" />,
                title: 'Discovery Produces Graph',
                desc: 'Discovery never touches registries. It produces Metadata Graph only.',
              },
            ].map((p, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg hover:bg-background/50 transition-colors">
                <div className="flex-shrink-0 mt-0.5">{p.icon}</div>
                <div>
                  <h4 className="text-sm font-medium">{p.title}</h4>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Footer Timestamp ───────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pb-2">
        <span>Last refreshed: {formatTimestamp(lastRefresh)}</span>
        <span>·</span>
        <span>Auto-refresh every 30s</span>
        {loading && (
          <span className="flex items-center gap-1">
            <RefreshCw className="h-3 w-3 animate-spin" />
            refreshing…
          </span>
        )}
      </div>
    </div>
  );
}
