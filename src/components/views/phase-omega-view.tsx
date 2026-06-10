'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, Brain, Box, Cpu, Database, Eye,
  FileCode, GitBranch, HeartPulse, Layers, Lightbulb, Loader2,
  Package, RefreshCw, Search, Settings, Shield, ShoppingCart,
  Sparkles, Terminal, TrendingUp, Zap, ChevronDown, ChevronUp,
  CheckCircle2, XCircle, Info, Cog, Rocket
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ============================================================
// Types
// ============================================================

interface OmegaData {
  timestamp: string;
  phase: string;
  title: string;
  engines: Record<string, any>;
  registries: Record<string, any>;
  discovery: Record<string, any>;
  metaSnapshot: any;
  liveChanges: any[];
  summary: any;
}

interface ActionState {
  loading: boolean;
  result: any;
  error: string | null;
}

// ============================================================
// Engine Icon & Color Mapping
// ============================================================

const ENGINE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string; description: string }> = {
  metaRegistry: { icon: Database, label: 'Meta Registry', color: 'text-violet-500', description: 'Single source of truth — all 14 entity types' },
  discoveryEngine: { icon: Search, label: 'Discovery Engine V2', color: 'text-emerald-500', description: 'Multi-format manifest scanning (GraphQL, OpenAPI, Prisma, MCP...)' },
  dependencyEngine: { icon: GitBranch, label: 'Dependency Resolution', color: 'text-blue-500', description: 'Topological sort, cycle detection, version solver' },
  observability: { icon: Eye, label: 'Observability Engine', color: 'text-amber-500', description: 'Metrics, logs, tracing, health, profiling per plugin' },
  hotPluginManager: { icon: Zap, label: 'Hot Plugin Updates', color: 'text-orange-500', description: 'Install/update/patch/rollback/reload without restart' },
  liveRegistry: { icon: RefreshCw, label: 'Live Registry', color: 'text-teal-500', description: 'Filesystem watch → dynamic registry updates' },
  metaOrchestrator: { icon: Brain, label: 'AI Meta Orchestrator', color: 'text-pink-500', description: 'Capability-based plugin selection, zero business knowledge' },
  pluginGenerator: { icon: Sparkles, label: 'Plugin Generator', color: 'text-yellow-500', description: 'Description → AI → Schema → Plugin Package' },
  selfHealing: { icon: HeartPulse, label: 'Self-Healing Engine', color: 'text-red-500', description: 'Health check → diagnose → repair → restart → rollback' },
  selfOptimization: { icon: TrendingUp, label: 'Self-Optimization', color: 'text-cyan-500', description: 'Auto cache, index, partition, lazy-load, compress' },
  marketplace: { icon: ShoppingCart, label: 'Marketplace Engine', color: 'text-indigo-500', description: 'Publish, install, review, rate, signature, billing' },
  digitalTwin: { icon: Cog, label: 'Digital Twin', color: 'text-purple-500', description: 'Simulate installations, failures, conflicts before applying' },
  pluginPackageManager: { icon: Package, label: 'Plugin Package Manager', color: 'text-lime-500', description: '.aenews-plugin format with SHA256 signatures' },
};

// ============================================================
// PHASE OMEGA Dashboard View
// ============================================================

export default function PhaseOmegaView() {
  const [data, setData] = useState<OmegaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>({ loading: false, result: null, error: null });
  const [generatorInput, setGeneratorInput] = useState('');
  const [orchestratorInput, setOrchestratorInput] = useState('');
  const [expandedEngine, setExpandedEngine] = useState<string | null>(null);

  const fetchOmegaData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/omega');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PHASE OMEGA data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchOmegaData();
  }, [fetchOmegaData]);

  const executeAction = async (action: string, params: Record<string, any> = {}) => {
    setActionState({ loading: true, result: null, error: null });
    try {
      const res = await fetch('/api/omega', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setActionState({ loading: false, result: json.data, error: null });
    } catch (err) {
      setActionState({ loading: false, result: null, error: err instanceof Error ? err.message : 'Action failed' });
    }
  };

  // ── Loading State ──
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Initializing PHASE OMEGA — Meta-Kernel & Cognitive Platform...</p>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error && !data) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>PHASE OMEGA Initialization Failed</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
        <Button variant="outline" size="sm" className="mt-2" onClick={fetchOmegaData}>Retry</Button>
      </Alert>
    );
  }

  if (!data) return null;

  const s = data.summary;
  const d = data.discovery;

  return (
    <div className="space-y-6 p-6">
      {/* ── Phase Banner ── */}
      <Alert className="border-emerald-500/50 bg-emerald-500/5">
        <Rocket className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-emerald-700 dark:text-emerald-400 font-bold text-lg">
          PHASE OMEGA — Meta-Kernel &amp; Cognitive Platform
        </AlertTitle>
        <AlertDescription className="text-emerald-600/80 dark:text-emerald-500/80">
          Core contains <span className="font-bold">ZERO business logic</span>. The Core is a pure <span className="font-bold">Cognitive Kernel</span>.
          All behavior is discovered, generated, and orchestrated from plugins.
          Last sync: {new Date(data.timestamp).toLocaleTimeString()}
        </AlertDescription>
      </Alert>

      {/* ── Top Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Plugins', value: s.totalPlugins, icon: Box, color: 'text-emerald-600' },
          { label: 'Meta Entities', value: s.totalMetaEntities, icon: Database, color: 'text-violet-600' },
          { label: 'Capabilities', value: s.totalCapabilities, icon: Zap, color: 'text-amber-600' },
          { label: 'Tools', value: s.totalTools, icon: Terminal, color: 'text-blue-600' },
          { label: 'Schemas', value: s.totalSchemas, icon: FileCode, color: 'text-teal-600' },
          { label: 'Agents', value: s.totalAgents, icon: Brain, color: 'text-pink-600' },
          { label: 'Engines', value: s.activeEngines, icon: Activity, color: 'text-orange-600' },
        ].map((stat) => (
          <Card key={stat.label} className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <div className="text-2xl font-bold">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</div>
          </Card>
        ))}
      </div>

      {/* ── Refresh ── */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={fetchOmegaData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <Button variant="outline" size="sm" onClick={() => executeAction('rediscover')} disabled={actionState.loading}>
          <Search className="h-3.5 w-3.5 mr-1" />
          Re-Discover Plugins
        </Button>
      </div>

      {/* ── Main Tabs ── */}
      <Tabs defaultValue="engines" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-6">
          <TabsTrigger value="engines">Engines</TabsTrigger>
          <TabsTrigger value="discovery">Discovery</TabsTrigger>
          <TabsTrigger value="registries">Registries</TabsTrigger>
          <TabsTrigger value="orchestrator">Orchestrator</TabsTrigger>
          <TabsTrigger value="generator">Generator</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        {/* ──────────────────────────────────────────── */}
        {/* TAB: ENGINES                                  */}
        {/* ──────────────────────────────────────────── */}
        <TabsContent value="engines">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(ENGINE_CONFIG).map(([key, config]) => {
              const engine = data.engines[key];
              const isExpanded = expandedEngine === key;
              const IconComp = config.icon;

              return (
                <Card key={key} className="overflow-hidden">
                  <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedEngine(isExpanded ? null : key)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComp className={`h-5 w-5 ${config.color}`} />
                        <CardTitle className="text-sm">{config.label}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={engine?.status === 'active' || engine?.status === 'watching' ? 'default' : 'secondary'} className="text-[10px]">
                          {engine?.status || 'unknown'}
                        </Badge>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                    <CardDescription className="text-xs">{config.description}</CardDescription>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <Separator className="mb-3" />
                      <ScrollArea className="max-h-48 overflow-y-auto">
                        <pre className="text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
                          {JSON.stringify(engine, null, 2)}
                        </pre>
                      </ScrollArea>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ──────────────────────────────────────────── */}
        {/* TAB: DISCOVERY                               */}
        {/* ──────────────────────────────────────────── */}
        <TabsContent value="discovery">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4 text-emerald-500" />
                  Discovery Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Status</div>
                    <Badge variant={d.status === 'complete' ? 'default' : 'secondary'}>{d.status}</Badge>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Plugins Scanned</div>
                    <div className="font-bold">{d.pluginsScanned}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Valid</div>
                    <div className="font-bold text-emerald-600">{d.pluginsValid}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Capabilities</div>
                    <div className="font-bold">{d.capabilities}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Tools', value: d.tools },
                    { label: 'Sidebar Items', value: d.sidebarItems },
                    { label: 'Widgets', value: d.widgets },
                    { label: 'Search Entities', value: d.searchEntities },
                    { label: 'Schema Objects', value: d.schemaObjects },
                    { label: 'Agents', value: d.agents },
                    { label: 'Knowledge Entries', value: d.knowledgeEntries },
                    { label: 'Menus', value: d.menus },
                    { label: 'Permissions', value: d.permissions },
                    { label: 'Events', value: d.events },
                    { label: 'Settings', value: d.settings },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{(item.value as number).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-blue-500" />
                  Dependency Graph
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Nodes</div>
                    <div className="font-bold">{d.dependencyGraph.nodes}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Edges</div>
                    <div className="font-bold">{d.dependencyGraph.edges}</div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Cycles</div>
                    <div className={`font-bold ${d.dependencyGraph.cycles > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {d.dependencyGraph.cycles}
                    </div>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <div className="text-muted-foreground text-xs">Orphans</div>
                    <div className={`font-bold ${d.dependencyGraph.orphans > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {d.dependencyGraph.orphans}
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="text-sm">
                  <div className="text-muted-foreground text-xs mb-1">Architecture Layers</div>
                  <div className="space-y-1.5">
                    {['DISCOVERY', 'METADATA', 'REGISTRIES', 'RUNTIME', 'EXECUTION', 'OBSERVABILITY', 'EVOLUTION'].map((layer, i) => (
                      <div key={layer} className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <span className="text-[9px] font-bold text-emerald-700">{i + 1}</span>
                        </div>
                        <span className="text-xs font-medium">{layer}</span>
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-auto" />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Live Changes */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-teal-500" />
                  Live Registry Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.liveChanges.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent changes. The Live Registry monitors for filesystem updates.</p>
                ) : (
                  <ScrollArea className="max-h-48">
                    <div className="space-y-1">
                      {data.liveChanges.map((change: any, i: number) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Badge variant={change.type === 'added' ? 'default' : change.type === 'modified' ? 'secondary' : 'destructive'} className="text-[9px]">
                            {change.type}
                          </Badge>
                          <span className="font-medium">{change.pluginId}</span>
                          <span className="text-muted-foreground ml-auto">{new Date(change.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ──────────────────────────────────────────── */}
        {/* TAB: REGISTRIES                              */}
        {/* ──────────────────────────────────────────── */}
        <TabsContent value="registries">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.registries).map(([key, reg]) => (
              <Card key={key}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm capitalize">{key}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-40">
                    <pre className="text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
                      {JSON.stringify(reg, null, 2)}
                    </pre>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ──────────────────────────────────────────── */}
        {/* TAB: ORCHESTRATOR                            */}
        {/* ──────────────────────────────────────────── */}
        <TabsContent value="orchestrator">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4 text-pink-500" />
                  AI Meta Orchestrator
                </CardTitle>
                <CardDescription>Describe what you need — the orchestrator selects the right plugins, tools, and agents automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. I need to manage vehicle repairs and track invoices..."
                    value={orchestratorInput}
                    onChange={(e) => setOrchestratorInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && orchestratorInput && executeAction('orchestrate', { intent: orchestratorInput })}
                  />
                  <Button
                    onClick={() => orchestratorInput && executeAction('orchestrate', { intent: orchestratorInput })}
                    disabled={actionState.loading || !orchestratorInput}
                  >
                    {actionState.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
                  </Button>
                </div>

                {actionState.result && actionState.result.steps && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Orchestration Plan (confidence: {Math.round((actionState.result.confidence || 0) * 100)}%)</div>
                    <ScrollArea className="max-h-60">
                      <div className="space-y-1">
                        {(actionState.result.steps || []).map((step: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs bg-muted/50 rounded p-2">
                            <Badge variant="outline" className="text-[9px] shrink-0">{step.type}</Badge>
                            <span>{step.description}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <Separator />
                <div className="text-xs text-muted-foreground">
                  The orchestrator knows ONLY capabilities, tools, knowledge, agents, schemas, and policies.
                  It contains ZERO business knowledge. Plugin selection is fully automatic.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-500" />
                  Capabilities Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-64">
                  <pre className="text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
                    {JSON.stringify(data.engines.metaOrchestrator?.overview, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ──────────────────────────────────────────── */}
        {/* TAB: PLUGIN GENERATOR                       */}
        {/* ──────────────────────────────────────────── */}
        <TabsContent value="generator">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-yellow-500" />
                  Plugin Generator
                </CardTitle>
                <CardDescription>Describe a business domain — the generator creates a complete plugin specification automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. A complete platform for managing a seaport with cargo tracking, dock scheduling, and customs..."
                    value={generatorInput}
                    onChange={(e) => setGeneratorInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && generatorInput && executeAction('generate', { description: generatorInput })}
                  />
                  <Button
                    onClick={() => generatorInput && executeAction('generate', { description: generatorInput })}
                    disabled={actionState.loading || !generatorInput}
                  >
                    {actionState.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </Button>
                </div>

                {actionState.result?.manifest && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Generated Plugin (completeness: {Math.round((actionState.result.completeness || 0) * 100)}%)
                    </div>
                    <ScrollArea className="max-h-64">
                      <pre className="text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
                        {JSON.stringify(actionState.result, null, 2)}
                      </pre>
                    </ScrollArea>
                  </div>
                )}

                {actionState.error && (
                  <Alert variant="destructive" className="text-xs">
                    <XCircle className="h-3 w-3" />
                    <AlertDescription>{actionState.error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4 text-lime-500" />
                  Generation Pipeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {[
                    'Description → AI Analysis',
                    'AI → Domain Detection',
                    'Domain → Entity Extraction',
                    'Entities → Schema Generation',
                    'Schema → Fields & Relations',
                    'Relations → Permissions',
                    'Permissions → Menus & Pages',
                    'Pages → Forms & Lists',
                    'Forms → Dashboard Widgets',
                    'Widgets → Workflow Triggers',
                    'Workflows → Reports',
                    'Reports → Knowledge Base',
                    'Knowledge → Agent System Prompt',
                    'Agent → Manifest Compilation',
                    'Manifest → Plugin Package (.aenews-plugin)',
                    'Package → SHA256 Signature',
                    'Signed Package → Marketplace',
                    'Marketplace → Install → Activate',
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-yellow-700">{i + 1}</span>
                      </div>
                      <span className="text-xs">{step}</span>
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-auto shrink-0" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ──────────────────────────────────────────── */}
        {/* TAB: ACTIONS                                 */}
        {/* ──────────────────────────────────────────── */}
        <TabsContent value="actions">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              { action: 'rediscover', label: 'Re-Discover Plugins', icon: Search, desc: 'Re-scan filesystem and re-populate all registries', variant: 'default' },
              { action: 'full-scan', label: 'Full Health Scan', icon: HeartPulse, desc: 'Run health checks on all installed plugins', variant: 'outline' },
              { action: 'optimize', label: 'Analyze Optimizations', icon: TrendingUp, desc: 'Analyze all plugins for optimization opportunities', variant: 'outline' },
              { action: 'simulate', label: 'Dry-Run Install', icon: Shield, desc: 'Simulate a plugin install before applying', variant: 'outline' },
            ].map((btn) => (
              <Card key={btn.action} className="p-4">
                <div className="flex items-start gap-3">
                  <btn.icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{btn.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{btn.desc}</div>
                    <Button
                      size="sm"
                      variant={btn.variant as 'default' | 'outline'}
                      className="mt-2"
                      onClick={() => executeAction(btn.action, btn.action === 'simulate' ? { pluginId: 'aenews.plugin.garage' } : {})}
                      disabled={actionState.loading}
                    >
                      {actionState.loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Execute
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Action Result */}
          {actionState.result && !actionState.result.steps && !actionState.result.manifest && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Action Result</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-64">
                  <pre className="text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
                    {JSON.stringify(actionState.result, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {actionState.error && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Action Failed</AlertTitle>
              <AlertDescription>{actionState.error}</AlertDescription>
            </Alert>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Architecture Principle Footer ── */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center justify-center gap-6 flex-wrap text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Info className="h-3 w-3" /> Core = 0 Business Logic</span>
            <span>•</span>
            <span>Core = Pure Cognitive Kernel</span>
            <span>•</span>
            <span>All behavior from plugins</span>
            <span>•</span>
            <span>Zero Core modification needed</span>
            <span>•</span>
            <span className="font-medium text-emerald-600">AENEWS Enterprise OS</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
