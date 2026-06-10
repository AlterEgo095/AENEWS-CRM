/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * The Kernel — Minimal, Deterministic, Immutable
 *
 * RÈGLE ABSOLUE :
 * Le Kernel ne contient QUE :
 * - Boot
 * - Discovery
 * - Manifest Validation
 * - Dependency Graph
 * - Runtime Manager
 * - Event Bus
 * - Service Container
 * - Registry Manager
 * - Security
 * - Lifecycle
 *
 * RIEN D'AUTRE. Tout le reste est un System Plugin.
 */

import type {
  PluginManifest,
  MetadataGraph,
  KernelPhase,
  KernelMetrics,
  KernelState,
  HotSwapOperation,
  HotSwapResult,
  PluginState,
  ServiceName,
  RegistryType,
} from './types';

import { ServiceContainer, getServiceContainer, resetServiceContainer } from './service-container';
import { RegistryManager, getRegistryManager, resetRegistryManager } from './registry-manager';
import { EventBus, getEventBus, resetEventBus } from './event-bus';
import { DiscoveryEngineV2, getDiscoveryEngine, resetDiscoveryEngine, type DiscoveryResult } from './discovery-v2';
import { LifecycleManager, getLifecycleManager, resetLifecycleManager } from './lifecycle';
import { SecurityKernel, getSecurityKernel, resetSecurityKernel } from './security';

// ─── System Plugin Registry ───────────────────────────────────────

export interface SystemPluginDescriptor {
  id: string;
  name: string;
  description: string;
  version: string;
  provides: ServiceName[];
  registries?: RegistryType[];
  status: 'loaded' | 'active' | 'inactive' | 'error';
  loadTime: number;
}

// ─── The Kernel ────────────────────────────────────────────────────

export class MicroKernel {
  // Sub-systems (all singletons, injected for testability)
  readonly serviceContainer: ServiceContainer;
  readonly registryManager: RegistryManager;
  readonly eventBus: EventBus;
  readonly discovery: DiscoveryEngineV2;
  readonly lifecycle: LifecycleManager;
  readonly security: SecurityKernel;

  // State
  private _phase: KernelPhase = 'init';
  private _phaseHistory: Array<{ phase: KernelPhase; timestamp: number }> = [];
  private _startedAt = 0;
  private _bootTime = 0;
  private _discoveryTime = 0;
  private _systemPlugins: Map<string, SystemPluginDescriptor> = new Map();
  private _lastDiscovery: DiscoveryResult | null = null;

  constructor() {
    this.serviceContainer = getServiceContainer();
    this.registryManager = getRegistryManager();
    this.eventBus = getEventBus();
    this.discovery = getDiscoveryEngine({ pluginsDir: './plugins' });
    this.lifecycle = getLifecycleManager();
    this.security = getSecurityKernel();
  }

  // ─── Boot Sequence ─────────────────────────────────────────────

  /** Full boot: init → discover → resolve → ready */
  async boot(manifests: Array<{ id: string; manifest: PluginManifest }>): Promise<void> {
    const bootStart = Date.now();
    this._setPhase('booting');

    // 1. Initialize event bus
    this._setPhase('booting');
    await this.eventBus.publish({ type: 'kernel.booting', source: 'kernel', payload: {} });

    // 2. Discovery — produces Metadata Graph ONLY
    this._setPhase('discovering');
    const discoveryResult = await this.discovery.discover(manifests);
    this._discoveryTime = Date.now() - bootStart;
    this._lastDiscovery = discoveryResult;

    if (!discoveryResult.success && discoveryResult.errors.length > 0) {
      console.error('[Kernel] Discovery errors:', discoveryResult.errors);
      await this.eventBus.publish({
        type: 'kernel.discovery.errors',
        source: 'kernel',
        payload: { errors: discoveryResult.errors },
      });
    }

    // 3. Dependency resolution (topological layers)
    this._setPhase('resolving');
    await this._resolveDependencies(discoveryResult.graph);

    // 4. Populate registries from metadata graph
    this._setPhase('loading');
    this._populateRegistries(discoveryResult.graph);

    // 5. Classify and set states
    for (const [id, node] of discoveryResult.graph.nodes) {
      if (node.category === 'system') {
        this._systemPlugins.set(id, {
          id,
          name: node.manifest.name,
          description: node.manifest.description,
          version: node.manifest.version,
          provides: node.manifest.provides || [],
          registries: [],
          status: 'loaded',
          loadTime: 0,
        });
      }
      this.lifecycle.setState(id, 'ready');
    }

    // 6. Register kernel services in service container
    this._registerKernelServices();

    // 7. Ready
    this._bootTime = Date.now() - bootStart;
    this._setPhase('ready');
    this._startedAt = Date.now();

    await this.eventBus.publish({
      type: 'kernel.ready',
      source: 'kernel',
      payload: {
        bootTime: this._bootTime,
        discoveryTime: this._discoveryTime,
        pluginCount: discoveryResult.stats,
        systemPlugins: this._systemPlugins.size,
      },
    });
  }

  // ─── Hot Swap Operations ──────────────────────────────────────

  /** Hot-swap operation without restart */
  async hotSwap(pluginId: string, operation: HotSwapOperation): Promise<HotSwapResult> {
    const result = await this.lifecycle.executeHotSwap(pluginId, operation);

    // Emit events
    await this.eventBus.publish({
      type: `plugin.${operation}`,
      source: 'kernel',
      payload: { pluginId, success: result.success, duration: result.duration },
    });

    return result;
  }

  /** Activate a plugin */
  async activatePlugin(pluginId: string): Promise<HotSwapResult> {
    return this.hotSwap(pluginId, 'activate');
  }

  /** Deactivate a plugin */
  async deactivatePlugin(pluginId: string): Promise<HotSwapResult> {
    return this.hotSwap(pluginId, 'deactivate');
  }

  /** Install a new plugin at runtime */
  async installPlugin(manifest: PluginManifest): Promise<HotSwapResult> {
    // Discover single plugin
    const result = await this.discovery.discover([{ id: manifest.id, manifest }]);
    if (!result.success) {
      return {
        operation: 'install',
        pluginId: manifest.id,
        success: false,
        duration: 0,
        affectedServices: [],
        affectedRegistries: [],
        warnings: result.warnings.map(w => w.warning),
        errors: result.errors.map(e => e.error),
      };
    }

    // Populate registries for new plugin
    this._populateRegistries(result.graph);
    this.lifecycle.setState(manifest.id, 'ready');

    // Then activate
    return this.activatePlugin(manifest.id);
  }

  /** Remove a plugin at runtime */
  async removePlugin(pluginId: string): Promise<HotSwapResult> {
    // Unregister all entries from all registries
    this.registryManager.unregisterPlugin(pluginId);

    // Then remove lifecycle
    const result = await this.hotSwap(pluginId, 'remove');
    this.lifecycle.setState(pluginId, 'discovered');

    return result;
  }

  // ─── State Accessors ──────────────────────────────────────────

  get phase(): KernelPhase { return this._phase; }
  get startedAt(): number { return this._startedAt; }
  get bootTime(): number { return this._bootTime; }
  get discoveryTime(): number { return this._discoveryTime; }
  get lastDiscovery(): DiscoveryResult | null { return this._lastDiscovery; }

  get systemPlugins(): SystemPluginDescriptor[] {
    return Array.from(this._systemPlugins.values());
  }

  /** Get complete kernel state */
  getState(): KernelState {
    return {
      phase: this._phase,
      phaseHistory: [...this._phaseHistory],
      metrics: this.getMetrics(),
      startedAt: this._startedAt,
      version: 'SIGMA-1.0.0',
    };
  }

  /** Get kernel metrics */
  getMetrics(): KernelMetrics {
    const lifecycleStats = this.lifecycle.getStats();
    const systemCount = this._systemPlugins.size;
    return {
      bootTime: this._bootTime,
      discoveryTime: this._discoveryTime,
      pluginCount: {
        system: systemCount,
        business: lifecycleStats.total - systemCount,
        total: lifecycleStats.total,
      },
      registryCount: this.registryManager.totalCount,
      serviceCount: this.serviceContainer.count,
      memoryUsage: typeof process !== 'undefined' ? Math.round((process.memoryUsage?.().heapUsed || 0) / 1024 / 1024) : 0,
      uptime: this._startedAt ? Date.now() - this._startedAt : 0,
    };
  }

  /** Get all plugin states */
  getPluginStates(): Map<string, PluginState> {
    return this.lifecycle.getAllStates();
  }

  // ─── Shutdown ──────────────────────────────────────────────────

  async shutdown(): Promise<void> {
    this._setPhase('shutting-down');
    await this.eventBus.publish({ type: 'kernel.shutting-down', source: 'kernel', payload: {} });

    this.serviceContainer.clear();
    this.registryManager.clear();
    this.eventBus.clear();
    this.lifecycle.clear();
    this.security.clear();

    this._setPhase('stopped');
  }

  // ─── Internal Methods ─────────────────────────────────────────

  private _setPhase(phase: KernelPhase): void {
    this._phase = phase;
    this._phaseHistory.push({ phase, timestamp: Date.now() });
  }

  private _resolveDependencies(graph: MetadataGraph): void {
    // Dependencies are already resolved by Discovery V2 (topological layers)
    // Here we set states based on layer position
    for (let layerIdx = 0; layerIdx < graph.layers.length; layerIdx++) {
      for (const pluginId of graph.layers[layerIdx]) {
        const node = graph.nodes.get(pluginId);
        if (node) {
          node.state = 'ready';
        }
      }
    }
  }

  private _populateRegistries(graph: MetadataGraph): void {
    for (const [pluginId, node] of graph.nodes) {
      const manifest = node.manifest;

      // Capabilities → capability registry
      if (manifest.capabilities) {
        for (const cap of manifest.capabilities) {
          this.registryManager.register('capability', {
            id: `${pluginId}:${cap.id}`,
            type: cap.type,
            pluginId,
            data: cap,
            version: manifest.version,
          });
        }
      }

      // Tools → tool registry
      if (manifest.tools) {
        for (const tool of manifest.tools) {
          this.registryManager.register('tool', {
            id: `${pluginId}:${tool.id}`,
            type: 'tool',
            pluginId,
            data: tool,
            version: manifest.version,
          });
        }
      }

      // Schemas → schema registry
      if (manifest.schemas) {
        for (const schema of manifest.schemas) {
          this.registryManager.register('schema', {
            id: `${pluginId}:${schema.id}`,
            type: 'schema',
            pluginId,
            data: schema,
            version: manifest.version,
          });
        }
      }

      // Menus → UI registry
      if (manifest.menus) {
        for (const menu of manifest.menus) {
          this.registryManager.register('ui', {
            id: `${pluginId}:menu:${menu.id}`,
            type: 'sidebar',
            pluginId,
            data: menu,
            version: manifest.version,
          });
        }
      }

      // Widgets → UI registry
      if (manifest.widgets) {
        for (const widget of manifest.widgets) {
          this.registryManager.register('ui', {
            id: `${pluginId}:widget:${widget.id}`,
            type: 'widget',
            pluginId,
            data: widget,
            version: manifest.version,
          });
        }
      }

      // Dashboard cards → UI registry
      if (manifest.dashboard) {
        for (const card of manifest.dashboard) {
          this.registryManager.register('ui', {
            id: `${pluginId}:dashboard:${card.id}`,
            type: 'dashboard-card',
            pluginId,
            data: card,
            version: manifest.version,
          });
        }
      }

      // Events → event registry
      if (manifest.events) {
        for (const evt of manifest.events) {
          this.registryManager.register('event', {
            id: `${pluginId}:${evt.id}`,
            type: 'event',
            pluginId,
            data: evt,
            version: manifest.version,
          });
        }
      }

      // Workflows → workflow registry
      if (manifest.workflows) {
        for (const wf of manifest.workflows) {
          this.registryManager.register('workflow', {
            id: `${pluginId}:${wf.id}`,
            type: 'workflow',
            pluginId,
            data: wf,
            version: manifest.version,
          });
        }
      }

      // Knowledge → knowledge registry
      if (manifest.knowledge) {
        for (const kb of manifest.knowledge) {
          this.registryManager.register('knowledge', {
            id: `${pluginId}:${kb.id}`,
            type: kb.type,
            pluginId,
            data: kb,
            version: manifest.version,
          });
        }
      }

      // Agents → agent registry
      if (manifest.agents) {
        for (const agent of manifest.agents) {
          this.registryManager.register('agent', {
            id: `${pluginId}:${agent.id}`,
            type: 'agent',
            pluginId,
            data: agent,
            version: manifest.version,
          });
        }
      }

      // Search entries → search registry
      if (manifest.capabilities) {
        for (const cap of manifest.capabilities) {
          if (cap.type === 'search' && cap.entity) {
            this.registryManager.register('search', {
              id: `${pluginId}:search:${cap.entity}`,
              type: 'search',
              pluginId,
              data: { entity: cap.entity, description: cap.description, schema: cap.schema },
              version: manifest.version,
            });
          }
        }
      }

      // Permissions → security
      if (manifest.permissions) {
        this.security.registerPermissions(pluginId, manifest.permissions);
      }
    }
  }

  private _registerKernelServices(): void {
    // Register kernel subsystems as services
    this.serviceContainer.register('eventBus', this.eventBus, 'kernel', 'SIGMA-1.0.0');
    this.serviceContainer.register('security', this.security, 'kernel', 'SIGMA-1.0.0');
  }
}

// ─── Singleton ─────────────────────────────────────────────────────

let _kernel: MicroKernel | null = null;

export function getMicroKernel(): MicroKernel {
  if (!_kernel) {
    _kernel = new MicroKernel();
  }
  return _kernel;
}

/** Reset the entire kernel (for testing/reboot) */
export function resetMicroKernel(): MicroKernel {
  resetServiceContainer();
  resetRegistryManager();
  resetEventBus();
  resetDiscoveryEngine();
  resetLifecycleManager();
  resetSecurityKernel();
  _kernel = new MicroKernel();
  return _kernel;
}

// ─── Re-exports for convenience ───────────────────────────────────

export { ServiceContainer, getServiceContainer };
export { RegistryManager, getRegistryManager };
export { EventBus, getEventBus };
export { DiscoveryEngineV2, getDiscoveryEngine };
export { LifecycleManager, getLifecycleManager };
export { SecurityKernel, getSecurityKernel };
export type { DiscoveryResult, DiscoveryConfig } from './discovery-v2';
