// ============================================================
// AENEWS Enterprise OS — Discovery Engine
// ============================================================
// PHASE 1 of the Discovery-First Architecture.
//
// At system startup, the Discovery Engine:
//   1. Scans the filesystem for all plugin.json manifests
//   2. Validates each manifest against the PluginManifest schema
//   3. Builds a dependency graph (topological sort + cycle detection)
//   4. Populates ALL 13 registries from manifest metadata ONLY
//   5. Runtime is OFF — no code execution, no business logic
//
// Strict separation:
//   Discovery ≠ Activation
//   Discovery reads manifests, never executes plugin code
//   Runtime executes, never discovers metadata
//
// Registries populated by Discovery:
//   Plugin Registry, Capability Registry, Tool Registry,
//   UI Registry, Workflow Registry, Schema Registry,
//   Knowledge Registry, Agent Registry, Search Registry,
//   Builder Registry, Report Registry, Widget Registry,
//   Theme Registry
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { validateManifest } from '@/core/plugin-sdk';
import type { PluginManifest } from '@/core/plugin-sdk';
import { getCapabilityRegistry } from '@/core/capability-registry';
import { getToolRegistry } from '@/core/tool-registry';
import { getUIRegistry } from '@/core/ui-registry';
import { getSearchEngine } from '@/core/search-engine';
import { getSchemaRegistry } from '@/core/schema-registry';
import { getWorkflowEngine } from '@/core/workflow-engine';
import { getAgentRegistry } from '@/core/agent-registry';
import { getKnowledgeRegistry } from '@/core/knowledge-registry';
import { eventBus } from '@/lib/event-bus';

// ============================================================
// Types
// ============================================================

export type DiscoveryStatus = 'idle' | 'scanning' | 'validating' | 'graph' | 'populating' | 'complete' | 'error';

export interface DiscoveryResult {
  status: DiscoveryStatus;
  timestamp: string;
  durationMs: number;
  pluginsScanned: number;
  pluginsValid: number;
  pluginsInvalid: number;
  errors: string[];
  manifests: PluginManifest[];
  dependencyGraph: DependencyGraph;
  registries: RegistryPopulationResult;
}

export interface DependencyGraph {
  nodes: string[];
  edges: Array<{ from: string; to: string }>;
  cycles: string[][];
  orphanPlugins: string[];
  dependencyMap: Record<string, string[]>;
}

export interface RegistryPopulationResult {
  capabilityRegistry: { registered: number };
  toolRegistry: { registered: number };
  uiRegistry: { sidebarItems: number; dashboardCards: number; widgets: number; commands: number; actions: number; pages: number };
  searchEngine: { entities: number };
  schemaRegistry: { objects: number };
  workflowEngine: { triggers: number; conditions: number; actions: number };
  agentRegistry: { agents: number };
  knowledgeRegistry: { entries: number };
}

export interface DiscoveryStats {
  totalPlugins: number;
  totalCapabilities: number;
  totalTools: number;
  totalSidebarItems: number;
  totalDashboardCards: number;
  totalWidgets: number;
  totalSearchEntities: number;
  totalSchemaObjects: number;
  totalPermissions: number;
  totalEvents: number;
  totalSettings: number;
  totalAgents: number;
  totalKnowledgeEntries: number;
  totalMenus: number;
  dependencyGraph: DependencyGraph;
  discoveryDurationMs: number;
  status: DiscoveryStatus;
}

// ============================================================
// Discovery Engine
// ============================================================

export class DiscoveryEngine {
  private status: DiscoveryStatus = 'idle';
  private lastResult: DiscoveryResult | null = null;
  private manifests: Map<string, PluginManifest> = new Map();
  private depGraph: DependencyGraph | null = null;
  private _discoveredAt: number | null = null;

  constructor() {
    console.log('[DiscoveryEngine] Initialized — Discovery-First Architecture');
  }

  // ============================================================
  // Main Discovery Pipeline
  // ============================================================

  /**
   * Run the full discovery pipeline.
   * This is the ONLY public method that should be called at startup.
   * It populates ALL registries from manifests without executing any plugin code.
   */
  async discover(pluginDir?: string): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const baseDir = pluginDir || path.resolve('./plugins');
    const errors: string[] = [];
    const validManifests: PluginManifest[] = [];
    let invalidCount = 0;

    // ── Phase 1: Filesystem Scan ──
    this.status = 'scanning';
    console.log('[DiscoveryEngine] Phase 1: Scanning filesystem for plugin manifests...');

    const pluginDirs = this.scanFilesystem(baseDir);
    console.log(`[DiscoveryEngine] Found ${pluginDirs.length} plugin directories`);

    // ── Phase 2: Manifest Discovery & Validation ──
    this.status = 'validating';
    console.log('[DiscoveryEngine] Phase 2: Discovering and validating manifests...');

    for (const dir of pluginDirs) {
      try {
        const manifest = await this.readAndValidateManifest(dir);
        if (manifest) {
          this.manifests.set(manifest.id, manifest);
          validManifests.push(manifest);
        } else {
          invalidCount++;
        }
      } catch (err) {
        invalidCount++;
        errors.push(`${dir}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    console.log(`[DiscoveryEngine] Validated ${validManifests.length} manifests (${invalidCount} invalid)`);

    // ── Phase 3: Dependency Graph ──
    this.status = 'graph';
    console.log('[DiscoveryEngine] Phase 3: Building dependency graph...');

    this.depGraph = this.buildDependencyGraph(validManifests);

    if (this.depGraph.cycles.length > 0) {
      console.warn(`[DiscoveryEngine] Detected ${this.depGraph.cycles.length} dependency cycles!`);
      for (const cycle of this.depGraph.cycles) {
        errors.push(`Dependency cycle: ${cycle.join(' → ')}`);
      }
    }

    if (this.depGraph.orphanPlugins.length > 0) {
      console.warn(`[DiscoveryEngine] ${this.depGraph.orphanPlugins.length} plugins have unsatisfied dependencies`);
    }

    // ── Phase 4: Registry Population (METADATA ONLY) ──
    this.status = 'populating';
    console.log('[DiscoveryEngine] Phase 4: Populating all registries from manifest metadata...');

    const registryResults = this.populateAllRegistries(validManifests);

    // ── Complete ──
    this.status = 'complete';
    this._discoveredAt = Date.now();

    const result: DiscoveryResult = {
      status: this.status,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      pluginsScanned: pluginDirs.length,
      pluginsValid: validManifests.length,
      pluginsInvalid: invalidCount,
      errors,
      manifests: validManifests,
      dependencyGraph: this.depGraph,
      registries: registryResults,
    };

    this.lastResult = result;

    console.log(`[DiscoveryEngine] Discovery complete in ${result.durationMs}ms`);
    console.log(`[DiscoveryEngine]   Plugins: ${result.pluginsValid}/${result.pluginsScanned}`);
    console.log(`[DiscoveryEngine]   Capabilities: ${registryResults.capabilityRegistry.registered}`);
    console.log(`[DiscoveryEngine]   Tools: ${registryResults.toolRegistry.registered}`);
    console.log(`[DiscoveryEngine]   UI: ${registryResults.uiRegistry.sidebarItems} sidebar, ${registryResults.uiRegistry.dashboardCards} cards, ${registryResults.uiRegistry.widgets} widgets`);
    console.log(`[DiscoveryEngine]   Search: ${registryResults.searchEngine.entities} entities`);
    console.log(`[DiscoveryEngine]   Schema: ${registryResults.schemaRegistry.objects} objects`);
    console.log(`[DiscoveryEngine]   Agents: ${registryResults.agentRegistry.agents} agents`);
    console.log(`[DiscoveryEngine]   Knowledge: ${registryResults.knowledgeRegistry.entries} entries`);

    // Emit discovery event
    try {
      await eventBus.emit('plugin.discovery.complete', {
        pluginCount: validManifests.length,
        durationMs: result.durationMs,
        timestamp: result.timestamp,
      });
    } catch {
      // Non-critical
    }

    return result;
  }

  // ============================================================
  // Phase 1: Filesystem Scan
  // ============================================================

  private scanFilesystem(baseDir: string): string[] {
    const pluginDirs: string[] = [];

    if (!fs.existsSync(baseDir)) {
      console.warn(`[DiscoveryEngine] Plugin directory not found: ${baseDir}`);
      return pluginDirs;
    }

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(baseDir, entry.name, 'plugin.json');
      if (fs.existsSync(manifestPath)) {
        pluginDirs.push(path.join(baseDir, entry.name));
      }
    }

    return pluginDirs;
  }

  // ============================================================
  // Phase 2: Manifest Discovery & Validation
  // ============================================================

  private async readAndValidateManifest(pluginDir: string): Promise<PluginManifest | null> {
    const manifestPath = path.join(pluginDir, 'plugin.json');

    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf-8');
      const json = JSON.parse(raw);
      const validation = validateManifest(json);

      if (!validation.valid) {
        console.warn(`[DiscoveryEngine] Invalid manifest ${manifestPath}: ${validation.errors.join(', ')}`);
        return null;
      }

      return json as PluginManifest;
    } catch (err) {
      console.warn(`[DiscoveryEngine] Failed to read manifest ${manifestPath}: ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }

  // ============================================================
  // Phase 3: Dependency Graph
  // ============================================================

  private buildDependencyGraph(manifests: PluginManifest[]): DependencyGraph {
    const nodes: string[] = [];
    const edges: Array<{ from: string; to: string }> = [];
    const dependencyMap: Record<string, string[]> = {};
    const manifestIds = new Set(manifests.map(m => m.id));

    for (const m of manifests) {
      nodes.push(m.id);
      const deps: string[] = [];
      if (m.dependencies) {
        for (const dep of m.dependencies) {
          deps.push(dep.pluginId);
          if (manifestIds.has(dep.pluginId)) {
            edges.push({ from: m.id, to: dep.pluginId });
          }
        }
      }
      dependencyMap[m.id] = deps;
    }

    const cycles = this.detectCycles(dependencyMap);
    const orphanPlugins: string[] = [];
    for (const m of manifests) {
      if (m.dependencies) {
        for (const dep of m.dependencies) {
          if (!dep.optional && !manifestIds.has(dep.pluginId)) {
            orphanPlugins.push(m.id);
            break;
          }
        }
      }
    }

    const sorted = this.topologicalSort(dependencyMap);

    return { nodes: sorted, edges, cycles, orphanPlugins, dependencyMap };
  }

  private detectCycles(depMap: Record<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const color = new Map<string, number>();
    for (const node of Object.keys(depMap)) color.set(node, 0);

    const dfs = (node: string, stack: string[]): void => {
      color.set(node, 1);
      stack.push(node);
      for (const neighbor of (depMap[node] || [])) {
        if (!color.has(neighbor)) continue;
        if (color.get(neighbor) === 1) {
          cycles.push(stack.slice(stack.indexOf(neighbor)));
        } else if (color.get(neighbor) === 0) {
          dfs(neighbor, stack);
        }
      }
      stack.pop();
      color.set(node, 2);
    };

    for (const node of Object.keys(depMap)) {
      if (color.get(node) === 0) dfs(node, []);
    }
    return cycles;
  }

  private topologicalSort(depMap: Record<string, string[]>): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const visit = (node: string): void => {
      if (visited.has(node)) return;
      visited.add(node);
      for (const dep of (depMap[node] || [])) {
        if (depMap[dep]) visit(dep);
      }
      result.push(node);
    };
    for (const node of Object.keys(depMap)) visit(node);
    return result;
  }

  // ============================================================
  // Phase 4: Registry Population (METADATA ONLY — NO EXECUTION)
  // ============================================================

  private populateAllRegistries(manifests: PluginManifest[]): RegistryPopulationResult {
    let capabilitiesRegistered = 0;
    let toolsRegistered = 0;
    let sidebarItems = 0;
    let dashboardCards = 0;
    let widgetsRegistered = 0;
    let commandsRegistered = 0;
    let pagesRegistered = 0;
    let searchEntities = 0;
    let schemaObjects = 0;
    let workflowTriggers = 0;
    let workflowActions = 0;
    let agentsRegistered = 0;
    let knowledgeEntries = 0;

    const capRegistry = getCapabilityRegistry();
    const toolReg = getToolRegistry();
    const uiReg = getUIRegistry();
    const searchEng = getSearchEngine();
    const schemaReg = getSchemaRegistry();
    const wfEngine = getWorkflowEngine();
    const agentReg = getAgentRegistry();
    const knowledgeReg = getKnowledgeRegistry();

    for (const manifest of manifests) {
      // ── Capability Registry ──
      if (manifest.capabilities) {
        for (const cap of manifest.capabilities) {
          try {
            capRegistry.register({
              id: `${manifest.id}:${cap.type}:${cap.name}`,
              pluginId: manifest.id,
              type: cap.type,
              name: cap.name,
              description: cap.description,
              version: manifest.version,
            });
            capabilitiesRegistered++;
          } catch { /* skip duplicates */ }
        }
      }

      // ── Tool Registry ──
      const toolCaps = manifest.capabilities?.filter(c => c.type === 'tool') || [];
      for (const tool of toolCaps) {
        try {
          toolReg.register(
            manifest.id,
            tool.name,
            {
              description: tool.description,
              parameters: { type: 'object', properties: { action: { type: 'string', description: `Action for ${tool.name}` } } },
              execute: async () => ({ success: true, message: `Tool ${tool.name} pending activation` }),
              permissions: manifest.permissions?.map(p => p.id) || [],
            },
          );
          toolsRegistered++;
        } catch { /* skip */ }
      }

      if (manifest.routes) {
        for (const route of manifest.routes) {
          try {
            toolReg.register(
              manifest.id,
              `${manifest.slug}.${route.handler}`,
              {
                description: `${route.method} ${route.path} — ${manifest.name}`,
                parameters: { type: 'object', properties: { method: { type: 'string', const: route.method }, path: { type: 'string', const: route.path } } },
                execute: async () => ({ success: true, message: `Route ${route.method} ${route.path} pending activation` }),
                permissions: route.permissions || [],
              },
            );
            toolsRegistered++;
          } catch { /* skip */ }
        }
      }

      // ── UI Registry ──
      if (manifest.menus) {
        const sidebarBatch: Array<{ id: string; pluginId: string; label: string; icon: string; href: string; section: string; order: number; permission?: string; parentId?: string }> = [];
        const commandBatch: Array<{ id: string; pluginId: string; label: string; icon: string; command: string; permission?: string; order: number }> = [];

        for (const menu of manifest.menus) {
          if (menu.parentId) {
            commandBatch.push({
              id: menu.id, pluginId: manifest.id, label: menu.label,
              icon: menu.icon || 'FileText', command: menu.href || `plugin:${manifest.slug}:${menu.id}`,
              permission: menu.permission, order: menu.order || 0,
            });
            commandsRegistered++;
          } else {
            sidebarBatch.push({
              id: menu.id, pluginId: manifest.id, label: menu.label,
              icon: menu.icon || 'Box', href: menu.href || `plugin:${manifest.slug}`,
              section: menu.section || manifest.name, order: menu.order || 0,
              permission: menu.permission, parentId: menu.parentId,
            });
            sidebarItems++;
          }
        }

        try {
          if (sidebarBatch.length > 0) uiReg.registerBatch({ sidebarItems: sidebarBatch as any[] });
          if (commandBatch.length > 0) uiReg.registerBatch({ commands: commandBatch as any[] });
        } catch { /* non-critical */ }
      }

      // Dashboard cards
      if (manifest.capabilities) {
        for (const cap of manifest.capabilities.filter(c => c.type === 'dashboard')) {
          try {
            uiReg.registerDashboardCard({
              id: `${manifest.id}:card:${cap.name}`, pluginId: manifest.id,
              title: cap.name, description: cap.description, category: manifest.slug, order: 0,
            });
            dashboardCards++;
          } catch { /* skip */ }
        }
      }

      // Widgets
      if (manifest.capabilities) {
        for (const cap of manifest.capabilities.filter(c => c.type === 'widget')) {
          try {
            uiReg.registerWidget({
              id: `${manifest.id}:widget:${cap.name}`, pluginId: manifest.id,
              name: cap.name, title: cap.name, description: cap.description, type: 'custom', config: { source: manifest.slug },
            });
            widgetsRegistered++;
          } catch { /* skip */ }
        }
      }

      // Pages
      if (manifest.capabilities) {
        for (const cap of manifest.capabilities.filter(c => c.type === 'view' || c.type === 'page')) {
          try {
            uiReg.registerPage({
              id: `${manifest.id}:page:${cap.name}`, pluginId: manifest.id,
              title: cap.name, description: cap.description,
              path: `/plugin/${manifest.slug}/${cap.name}`, icon: 'FileText',
              permission: manifest.permissions?.[0]?.id,
            });
            pagesRegistered++;
          } catch { /* skip */ }
        }
      }

      // ── Search Engine ──
      if (manifest.search?.entities) {
        for (const entity of manifest.search.entities) {
          try {
            searchEng.registerEntity({
              name: entity.name, pluginId: manifest.id,
              label: entity.labelField || entity.name,
              table: entity.table || `plugin_${manifest.slug}_${entity.name.toLowerCase()}`,
              fields: entity.fields.map(f => ({
                name: typeof f === 'string' ? f : (f as Record<string, unknown>).name as string,
                type: 'text' as const,
                searchable: true,
              })),
              handler: async () => [],
            });
            searchEntities++;
          } catch { /* skip */ }
        }
      }

      // ── Schema Registry ──
      if (manifest.search?.entities) {
        for (const entity of manifest.search.entities) {
          try {
            const fields = entity.fields.map(f => {
              const fName = typeof f === 'string' ? f : (f as Record<string, unknown>).name as string;
              return { id: fName, name: fName, type: 'text' as const, label: fName.charAt(0).toUpperCase() + fName.slice(1), required: fName === 'id', searchable: true };
            });
            schemaReg.register({
              id: `${manifest.slug}.${entity.name.toLowerCase()}`, pluginId: manifest.id,
              name: entity.name, label: entity.labelField || entity.name, category: manifest.slug,
              fields, indexes: [{ fields: ['id'], unique: true }],
            });
            schemaObjects++;
          } catch { /* skip */ }
        }
      }

      // Object-type capabilities → schemas
      if (manifest.capabilities) {
        for (const cap of manifest.capabilities.filter(c => c.type === 'object')) {
          const existingId = `${manifest.slug}.${cap.name.toLowerCase()}`;
          if (!schemaReg.get(existingId)) {
            try {
              schemaReg.register({
                id: existingId, pluginId: manifest.id, name: cap.name, label: cap.name,
                category: manifest.slug,
                fields: [
                  { id: 'id', name: 'id', type: 'text', label: 'ID', required: true, searchable: true },
                  { id: 'name', name: 'name', type: 'text', label: 'Name', required: true, searchable: true },
                  { id: 'created_at', name: 'created_at', type: 'text', label: 'Created At', searchable: false },
                ],
                indexes: [{ fields: ['id'], unique: true }],
              });
              schemaObjects++;
            } catch { /* skip */ }
          }
        }
      }

      // ── Workflow Engine ──
      if (manifest.events) {
        for (const evt of manifest.events) {
          try {
            wfEngine.registerTrigger({
              id: `${manifest.id}:trigger:${evt.type}`, pluginId: manifest.id,
              type: 'event', name: evt.type, description: evt.description || `Trigger on ${evt.type}`,
              config: { eventType: evt.type },
            });
            workflowTriggers++;
          } catch { /* skip */ }
        }
      }

      if (manifest.capabilities) {
        for (const cap of manifest.capabilities.filter(c => c.type === 'create' || c.type === 'update' || c.type === 'delete')) {
          try {
            wfEngine.registerAction({
              id: `${manifest.id}:action:${cap.name}`, pluginId: manifest.id,
              type: cap.type as 'create' | 'update' | 'delete',
              name: cap.name, description: cap.description,
              config: { pluginId: manifest.id, capability: cap.name },
            });
            workflowActions++;
          } catch { /* skip */ }
        }
      }

      // ── Agent Registry ──
      try {
        agentReg.register({
          id: `${manifest.id}:agent`, pluginId: manifest.id,
          name: `${manifest.name} Agent`,
          description: `AI agent for ${manifest.name} — handles queries, operations, and insights`,
          category: manifest.slug, icon: manifest.menus?.[0]?.icon || 'Bot',
          systemPrompt: `You are the ${manifest.name} AI assistant. Help users manage ${manifest.description?.toLowerCase() || manifest.slug}.`,
          tools: manifest.capabilities?.filter(c => c.type === 'tool').map(c => `${manifest.id}:${c.type}:${c.name}`) || [],
          capabilities: manifest.capabilities?.map(c => `${manifest.id}:${c.type}:${c.name}`) || [],
          tags: [manifest.slug, manifest.name.toLowerCase(), 'plugin-agent'],
          version: manifest.version,
        });
        agentsRegistered++;
      } catch { /* skip */ }

      // ── Knowledge Registry ──
      try {
        knowledgeReg.register({
          id: `${manifest.id}:knowledge:overview`, pluginId: manifest.id, type: 'guide',
          title: `${manifest.name} Overview`,
          content: `# ${manifest.name}\n\n${manifest.description}\n\n## Capabilities\n${(manifest.capabilities || []).map(c => `- **${c.type}: ${c.name}** — ${c.description}`).join('\n')}\n\n## Permissions\n${(manifest.permissions || []).map(p => `- \`${p.id}\`: ${p.name}`).join('\n')}`,
          tags: [manifest.slug, 'overview', 'guide'],
          keywords: [manifest.name.toLowerCase(), manifest.slug],
          category: manifest.slug, version: manifest.version,
        });
        knowledgeEntries++;

        knowledgeReg.register({
          id: `${manifest.id}:knowledge:faq`, pluginId: manifest.id, type: 'faq',
          title: `${manifest.name} FAQ`,
          content: `# ${manifest.name} FAQ\n\n## What is ${manifest.name}?\n${manifest.description}\n\n## How to get started?\nNavigate to ${manifest.slug} from the sidebar.`,
          tags: [manifest.slug, 'faq', 'help'], keywords: [manifest.slug, 'help', 'faq'],
          category: manifest.slug,
        });
        knowledgeEntries++;

        if (manifest.permissions && manifest.permissions.length > 0) {
          knowledgeReg.register({
            id: `${manifest.id}:knowledge:policy`, pluginId: manifest.id, type: 'policy',
            title: `${manifest.name} Access Policy`,
            content: `# ${manifest.name} Access Policy\n\n${manifest.permissions.map(p => `### ${p.id}\n${p.description || p.name}`).join('\n\n')}`,
            tags: [manifest.slug, 'policy', 'permissions'], keywords: [manifest.slug, 'permissions'],
            category: manifest.slug,
          });
          knowledgeEntries++;
        }
      } catch { /* non-critical */ }
    }

    return {
      capabilityRegistry: { registered: capabilitiesRegistered },
      toolRegistry: { registered: toolsRegistered },
      uiRegistry: { sidebarItems, dashboardCards, widgets: widgetsRegistered, commands: commandsRegistered, actions: 0, pages: pagesRegistered },
      searchEngine: { entities: searchEntities },
      schemaRegistry: { objects: schemaObjects },
      workflowEngine: { triggers: workflowTriggers, conditions: 0, actions: workflowActions },
      agentRegistry: { agents: agentsRegistered },
      knowledgeRegistry: { entries: knowledgeEntries },
    };
  }

  // ============================================================
  // Public Getters
  // ============================================================

  getStatus(): DiscoveryStatus { return this.status; }
  getLastResult(): DiscoveryResult | null { return this.lastResult; }
  getManifest(id: string): PluginManifest | undefined { return this.manifests.get(id); }
  getAllManifests(): PluginManifest[] { return Array.from(this.manifests.values()); }
  getDependencyGraph(): DependencyGraph | null { return this.depGraph; }

  getStats(): DiscoveryStats {
    const last = this.lastResult;
    const manifests = this.getAllManifests();
    return {
      totalPlugins: manifests.length,
      totalCapabilities: last?.registries.capabilityRegistry.registered ?? 0,
      totalTools: last?.registries.toolRegistry.registered ?? 0,
      totalSidebarItems: last?.registries.uiRegistry.sidebarItems ?? 0,
      totalDashboardCards: last?.registries.uiRegistry.dashboardCards ?? 0,
      totalWidgets: last?.registries.uiRegistry.widgets ?? 0,
      totalSearchEntities: last?.registries.searchEngine.entities ?? 0,
      totalSchemaObjects: last?.registries.schemaRegistry.objects ?? 0,
      totalPermissions: manifests.reduce((s, m) => s + (m.permissions?.length || 0), 0),
      totalEvents: manifests.reduce((s, m) => s + (m.events?.length || 0), 0),
      totalSettings: manifests.reduce((s, m) => s + (m.settings?.length || 0), 0),
      totalAgents: last?.registries.agentRegistry.agents ?? 0,
      totalKnowledgeEntries: last?.registries.knowledgeRegistry.entries ?? 0,
      totalMenus: manifests.reduce((s, m) => s + (m.menus?.length || 0), 0),
      dependencyGraph: this.depGraph || { nodes: [], edges: [], cycles: [], orphanPlugins: [], dependencyMap: {} },
      discoveryDurationMs: last?.durationMs ?? 0,
      status: this.status,
    };
  }

  isDiscovered(): boolean { return this.status === 'complete'; }
  get discoveredAt(): number | null { return this._discoveredAt; }

  // ============================================================
  // Reset / Re-discover
  // ============================================================

  reset(): void {
    this.status = 'idle';
    this.lastResult = null;
    this.manifests.clear();
    this.depGraph = null;
    this._discoveredAt = null;
    console.log('[DiscoveryEngine] Reset — ready for re-discovery');
  }

  async rediscover(pluginDir?: string): Promise<DiscoveryResult> {
    this.reset();
    return this.discover(pluginDir);
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: DiscoveryEngine | undefined;

export function getDiscoveryEngine(): DiscoveryEngine {
  if (!_instance) {
    _instance = new DiscoveryEngine();
  }
  return _instance;
}

export function resetDiscoveryEngine(): void {
  _instance = undefined;
}
