'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Cpu, CpuIcon, CheckCircle2, XCircle, AlertTriangle, Activity,
  Layers, Shield, Zap, Database, GitBranch, Eye, HeartPulse,
  Bot, Search, Hammer, BookOpen, Copy, Store, Wand2, Brain,
  RotateCcw, Play, Square, ArrowUpCircle, ArrowDownCircle,
  Package, Server, MemoryStick, Clock, Gauge, RefreshCw,
  ChevronRight, ChevronDown, Terminal, Lock,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────

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
  systemPluginDetails: { id: string; name: string; description: string; version: string; provides: string[]; status: string }[];
  architecture: {
    layers: number;
    names: string[];
    kernelComponents: string[];
  };
  timestamp: number;
}

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

// ─── Phase Sigma View ────────────────────────────────────────────

export default function PhaseSigmaView() {
  const [data, setData] = useState<KernelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set());

  const fetchKernel = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sigma');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        throw new Error(json.error || 'Kernel returned failure');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKernel();
  }, [fetchKernel]);

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
        await fetchKernel();
      }
    } catch (err) {
      setError(String(err));
    }
  };

  // ─── Loading State ───────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">PHASE SIGMA</h1>
            <p className="text-sm text-muted-foreground">Micro-Kernel IA-Native</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-2/3 mb-3" />
                <div className="h-8 bg-muted rounded w-1/2" />
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
      <div className="p-6 space-y-4">
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

  const phaseColor = data.kernel.phase === 'ready' || data.kernel.phase === 'running'
    ? 'text-emerald-500' : 'text-amber-500';

  return (
    <div className="p-6 space-y-6">
      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center text-white shadow-lg">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              PHASE <span className="text-2xl">Σ</span> SIGMA
              <Badge variant="outline" className="text-xs font-mono ml-2">
                v{data.kernel.version}
              </Badge>
            </h1>
            <p className="text-sm text-muted-foreground">
              Micro-Kernel IA-Native — Minimal, Deterministic, Immutable
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn('text-xs', phaseColor)} variant="outline">
            <span className={cn('h-2 w-2 rounded-full mr-1.5', phaseColor.replace('text-', 'bg-'))} />
            {data.kernel.phase.toUpperCase()}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleReboot}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reboot
          </Button>
          <Button variant="outline" size="sm" onClick={fetchKernel}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ─── Architecture Diagram ────────────────────────────── */}
      <Card className="border-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5 text-emerald-500" />
            3-Layer Architecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-stretch gap-3">
            {/* Kernel Layer */}
            <div className="flex-1 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CpuIcon className="h-5 w-5 text-emerald-600" />
                <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">MICRO KERNEL</span>
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  IMMUTABLE
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {data.architecture.kernelComponents.map((comp) => (
                  <div key={comp} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3 text-emerald-500" />
                    {comp}
                  </div>
                ))}
              </div>
            </div>

            {/* System Plugins Layer */}
            <div className="flex-1 rounded-xl border-2 border-violet-500/30 bg-violet-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-5 w-5 text-violet-600" />
                <span className="font-bold text-violet-700 dark:text-violet-400 text-sm">SYSTEM PLUGINS</span>
                <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-500/20">
                  {data.systemPluginDetails.length}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {data.systemPluginDetails.map((sp) => (
                  <div key={sp.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {SYSTEM_PLUGIN_ICONS[sp.id] || <Package className="h-3 w-3" />}
                    <span className="truncate">{sp.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Business Plugins Layer */}
            <div className="flex-1 rounded-xl border-2 border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Server className="h-5 w-5 text-amber-600" />
                <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">BUSINESS PLUGINS</span>
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/20">
                  {data.plugins.business}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(data.plugins.states)
                  .filter(([id]) => !id.startsWith('system-'))
                  .slice(0, 12)
                  .map(([id]) => (
                    <div key={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Server className="h-3 w-3 text-amber-500" />
                      <span className="truncate">{id.replace(/^(test-)?/, '').replace(/-/g, ' ')}</span>
                    </div>
                  ))}
                {data.plugins.business > 12 && (
                  <div className="text-xs text-muted-foreground">+{data.plugins.business - 12} more</div>
                )}
              </div>
            </div>
          </div>

          {/* Arrows */}
          <div className="flex items-center justify-center mt-3 gap-2 text-muted-foreground">
            <ChevronRight className="h-4 w-4 hidden md:block" />
            <ChevronDown className="h-4 w-4 md:hidden" />
            <span className="text-xs">Dependencies flow down — Services flow up</span>
            <ChevronRight className="h-4 w-4 hidden md:block" />
            <ChevronDown className="h-4 w-4 md:hidden" />
          </div>
        </CardContent>
      </Card>

      {/* ─── Metrics Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Boot Time</span>
            </div>
            <div className="text-2xl font-bold">{data.kernel.bootTime}<span className="text-sm text-muted-foreground ml-1">ms</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Activity className="h-4 w-4" />
              <span className="text-xs">Discovery</span>
            </div>
            <div className="text-2xl font-bold">{data.kernel.discoveryTime}<span className="text-sm text-muted-foreground ml-1">ms</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Package className="h-4 w-4" />
              <span className="text-xs">Total Plugins</span>
            </div>
            <div className="text-2xl font-bold">{data.plugins.total}</div>
            <div className="text-xs text-muted-foreground">{data.plugins.system} system + {data.plugins.business} business</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <MemoryStick className="h-4 w-4" />
              <span className="text-xs">Memory</span>
            </div>
            <div className="text-2xl font-bold">{data.kernel.memoryMB}<span className="text-sm text-muted-foreground ml-1">MB</span></div>
            <div className="text-xs text-muted-foreground">{data.kernel.uptime > 0 ? `${Math.floor(data.kernel.uptime / 1000)}s uptime` : 'just booted'}</div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Main Tabs ───────────────────────────────────────── */}
      <Tabs defaultValue="system-plugins" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 md:w-auto md:inline-grid">
          <TabsTrigger value="system-plugins" className="text-xs md:text-sm">
            <Package className="h-4 w-4 mr-1.5 hidden sm:inline" />System Plugins
          </TabsTrigger>
          <TabsTrigger value="registries" className="text-xs md:text-sm">
            <Database className="h-4 w-4 mr-1.5 hidden sm:inline" />Registries
          </TabsTrigger>
          <TabsTrigger value="services" className="text-xs md:text-sm">
            <Gauge className="h-4 w-4 mr-1.5 hidden sm:inline" />Services
          </TabsTrigger>
          <TabsTrigger value="discovery" className="text-xs md:text-sm">
            <Terminal className="h-4 w-4 mr-1.5 hidden sm:inline" />Discovery
          </TabsTrigger>
        </TabsList>

        {/* ── System Plugins Tab ─────────────────────────────── */}
        <TabsContent value="system-plugins">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Plugins</CardTitle>
              <CardDescription>
                12 engines extracted from the Kernel — each is a replaceable, hot-swappable plugin.
                Adding, removing, or replacing any of these NEVER requires a Kernel modification.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.systemPluginDetails.map((sp) => {
                  const isExpanded = expandedPlugins.has(sp.id);
                  const icon = SYSTEM_PLUGIN_ICONS[sp.id] || <Package className="h-4 w-4" />;
                  const colorClass = SYSTEM_PLUGIN_COLORS[sp.id] || 'text-gray-500';

                  return (
                    <div key={sp.id} className="rounded-lg border hover:border-primary/30 transition-colors">
                      <button
                        className="w-full flex items-center gap-3 p-3 text-left"
                        onClick={() => togglePlugin(sp.id)}
                      >
                        <div className={cn('flex-shrink-0', colorClass)}>{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{sp.name}</span>
                            <Badge variant="outline" className="text-[10px]">{sp.version}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{sp.description}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {sp.provides.length > 0 && (
                            <div className="hidden sm:flex gap-1">
                              {sp.provides.map(s => (
                                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                              ))}
                            </div>
                          )}
                          <Badge
                            variant={sp.status === 'loaded' ? 'default' : 'secondary'}
                            className={cn(
                              'text-[10px]',
                              sp.status === 'loaded' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''
                            )}
                          >
                            {sp.status}
                          </Badge>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0 border-t bg-muted/20">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3">
                            <div>
                              <span className="text-xs text-muted-foreground">Plugin ID</span>
                              <p className="text-xs font-mono">{sp.id}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Version</span>
                              <p className="text-xs font-mono">{sp.version}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Status</span>
                              <p className="text-xs">{sp.status}</p>
                            </div>
                            <div>
                              <span className="text-xs text-muted-foreground">Provides</span>
                              <p className="text-xs">{sp.provides.join(', ') || 'none'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Registries Tab ─────────────────────────────────── */}
        <TabsContent value="registries">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Registry Manager</CardTitle>
                <CardDescription>
                  The Kernel knows only: register(), unregister(), resolve(), query(), watch().
                  All 10 registries are services managed by the Registry Manager.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.registries.map((reg) => (
                    <div key={reg.type} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-cyan-500" />
                        <span className="text-sm font-medium">{reg.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{reg.count}</span>
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

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Event Bus</CardTitle>
                <CardDescription>
                  All inter-plugin communication flows through the Event Bus.
                  Wildcard pattern matching with priority-based handlers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-amber-500" />
                      <span className="font-medium">Subscriptions</span>
                    </div>
                    <span className="text-2xl font-bold">{data.events.subscriptionCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-violet-500" />
                      <span className="font-medium">Events Processed</span>
                    </div>
                    <span className="text-2xl font-bold">{data.events.eventCount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Services Tab ───────────────────────────────────── */}
        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Service Container</CardTitle>
              <CardDescription>
                All plugins use these shared services exclusively. Never direct imports between plugins.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.services.length > 0 ? data.services.map((svc) => (
                  <div key={svc.name} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Gauge className="h-4 w-4 text-emerald-500" />
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
                        variant={svc.state === 'ready' ? 'default' : 'secondary'}
                        className={cn(
                          'text-[10px]',
                          svc.state === 'ready' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''
                        )}
                      >
                        {svc.state}
                      </Badge>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No services registered yet. Services are provided by System Plugins.</p>
                  </div>
                )}
              </div>
              <Separator className="my-4" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Registered Services</span>
                <span className="text-xl font-bold text-emerald-600">{data.serviceCount}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Discovery Tab ─────────────────────────────────── */}
        <TabsContent value="discovery">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      {data.discovery.success ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                      )}
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
                        <span className="text-xs text-muted-foreground">Valid Plugins</span>
                        <p className="text-lg font-bold text-emerald-600">{data.discovery.stats.valid}</p>
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

                    {data.discovery.errors.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-red-500">Errors ({data.discovery.errors.length})</span>
                        <div className="mt-1 max-h-32 overflow-y-auto space-y-1">
                          {data.discovery.errors.map((e, i) => (
                            <div key={i} className="text-xs text-red-500 bg-red-500/10 rounded p-1.5">
                              <span className="font-mono">{e.pluginId}</span>: {e.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {data.discovery.warnings.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-amber-500">Warnings ({data.discovery.warnings.length})</span>
                        <div className="mt-1 max-h-32 overflow-y-auto space-y-1">
                          {data.discovery.warnings.map((w, i) => (
                            <div key={i} className="text-xs text-amber-600 bg-amber-500/10 rounded p-1.5">
                              <span className="font-mono">{w.pluginId}</span>: {w.warning}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No discovery data available.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Security Kernel</CardTitle>
                <CardDescription>
                  Manifest signature verification, permission framework, and security context.
                  Lives in the Kernel — security is non-negotiable.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-emerald-500" />
                      <span className="font-medium">Trusted Publishers</span>
                    </div>
                    <span className="text-2xl font-bold">{data.security.trustedPublishers}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-amber-500" />
                      <span className="font-medium">Blocked Plugins</span>
                    </div>
                    <span className="text-2xl font-bold">{data.security.blockedPlugins}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-cyan-500" />
                      <span className="font-medium">Permission Policies</span>
                    </div>
                    <span className="text-2xl font-bold">{data.security.permissionPolicies}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Kernel Principles ───────────────────────────────── */}
      <Card className="bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-cyan-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CpuIcon className="h-5 w-5 text-emerald-500" />
            SIGMA Principles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg">
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
    </div>
  );
}
