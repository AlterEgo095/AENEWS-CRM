// ============================================================
// AENEWS Enterprise OS — Plugin Loader
// The heart of the plugin system: discovers, validates, resolves
// dependencies, loads, and manages the full plugin lifecycle.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

import { db } from '@/lib/db';
import { eventBus, EVENT_TYPES, type EventHandler } from '@/lib/event-bus';
import type { ToolRegistry } from '../tool-registry';
import type { EventStore } from '../event-store';
import type { PluginManifest, PluginDependency, PluginServerModule } from '../plugin-sdk';
import {
  type PluginDefinition,
  validateManifest,
  satisfiesVersionRange,
  type ToolHandler,
  type PluginRouteHandler,
  type PluginMigration,
} from '../plugin-sdk';

// ============================================================
// Types
// ============================================================

export interface PluginLoadResult {
  pluginId: string;
  success: boolean;
  error?: string;
  warnings?: string[];
}

export interface PluginDependencyGraph {
  nodes: Map<string, PluginManifest>;
  edges: Map<string, string[]>;   // pluginId -> [dependencyIds]
  resolvedOrder: string[];         // topologically sorted load order
  cycles: string[][];              // detected circular dependencies
  missing: string[];              // missing dependency plugin IDs
  versionConflicts: Array<{       // version incompatibilities
    plugin: string;
    dependency: string;
    required: string;
    available?: string;
  }>;
}

export interface PluginInstance {
  manifest: PluginManifest;
  definition: PluginDefinition;
  serverModule?: PluginServerModule;
  status: 'loaded' | 'active' | 'inactive' | 'error';
  tools: Map<string, ToolHandler>;
  events: Map<string, EventHandler>;
  routes: PluginRouteHandler[];
  /** Unsubscribe functions for event bus handlers */
  eventUnsubscribers: Map<string, () => void>;
  installedAt?: Date;
  activatedAt?: Date;
  error?: string;
  pluginDir: string;
}

export interface PluginLoaderConfig {
  /** Path to the plugins directory (default: './plugins') */
  pluginDir?: string;
  toolRegistry: ToolRegistry;
  eventStore?: EventStore;
}

// ============================================================
// Plugin Loader Class
// ============================================================

export class PluginLoader {
  private instances: Map<string, PluginInstance> = new Map();
  private pluginDir: string;
  private toolRegistry: ToolRegistry;
  private eventStore?: EventStore;

  constructor(config: PluginLoaderConfig) {
    this.pluginDir = path.resolve(config.pluginDir || './plugins');
    this.toolRegistry = config.toolRegistry;
    this.eventStore = config.eventStore;
  }

  // ============================================================
  // SCAN: Discover all plugins in the plugins directory
  // ============================================================

  /**
   * Scan the plugins directory for valid plugin manifests.
   * Looks for plugin.json in each subdirectory.
   */
  async scan(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    // Ensure plugin directory exists
    if (!fs.existsSync(this.pluginDir)) {
      console.warn(`[PluginLoader] Plugin directory does not exist: ${this.pluginDir}`);
      return manifests;
    }

    const entries = await fs.promises.readdir(this.pluginDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginPath = path.join(this.pluginDir, entry.name);
      const manifestPath = path.join(pluginPath, 'plugin.json');

      // Check if plugin.json exists
      if (!fs.existsSync(manifestPath)) {
        console.warn(`[PluginLoader] No plugin.json found in ${pluginPath}, skipping.`);
        continue;
      }

      try {
        const raw = await fs.promises.readFile(manifestPath, 'utf-8');
        const json = JSON.parse(raw) as unknown;
        const validation = validateManifest(json);

        if (!validation.valid) {
          console.warn(
            `[PluginLoader] Invalid manifest in ${pluginPath}: ${validation.errors.join(', ')}`,
          );
          continue;
        }

        if (validation.warnings.length > 0) {
          console.info(
            `[PluginLoader] Warnings for ${entry.name}: ${validation.warnings.join(', ')}`,
          );
        }

        manifests.push(json as PluginManifest);
      } catch (error) {
        console.error(`[PluginLoader] Error reading manifest in ${pluginPath}:`, error);
      }
    }

    console.info(`[PluginLoader] Scanned and found ${manifests.length} valid plugin(s).`);
    return manifests;
  }

  // ============================================================
  // RESOLVE: Build dependency graph and determine load order
  // ============================================================

  /**
   * Build dependency graph from manifests, detect cycles, and
   * produce a topologically sorted load order.
   */
  async resolve(manifests: PluginManifest[]): Promise<PluginDependencyGraph> {
    const nodes = new Map<string, PluginManifest>();
    const edges = new Map<string, string[]>();
    const cycles: string[][] = [];
    const missing: string[] = [];
    const versionConflicts: PluginDependencyGraph['versionConflicts'] = [];

    // Build nodes and edges
    for (const manifest of manifests) {
      nodes.set(manifest.id, manifest);
      edges.set(manifest.id, []);
    }

    // Build adjacency list from dependencies
    for (const manifest of manifests) {
      if (!manifest.dependencies || manifest.dependencies.length === 0) continue;

      for (const dep of manifest.dependencies) {
        const depManifest = nodes.get(dep.pluginId);

        if (!depManifest) {
          if (!dep.optional) {
            missing.push(dep.pluginId);
          }
          continue;
        }

        // Check version compatibility
        if (dep.version) {
          if (!satisfiesVersionRange(depManifest.version, dep.version)) {
            versionConflicts.push({
              plugin: manifest.id,
              dependency: dep.pluginId,
              required: dep.version,
              available: depManifest.version,
            });
          }
        }

        edges.get(manifest.id)!.push(dep.pluginId);
      }
    }

    // Detect circular dependencies using DFS
    const detectedCycles = this.detectCycles(edges);
    cycles.push(...detectedCycles);

    // Topological sort (Kahn's algorithm)
    const resolvedOrder = this.topologicalSort(edges, nodes);

    return {
      nodes,
      edges,
      resolvedOrder,
      cycles,
      missing,
      versionConflicts,
    };
  }

  // ============================================================
  // LOAD: Load a single plugin into memory
  // ============================================================

  /**
   * Load a single plugin: validate, dynamically import its server entry,
   * register tools and event handlers.
   */
  async load(manifest: PluginManifest): Promise<PluginLoadResult> {
    const warnings: string[] = [];
    const pluginId = manifest.id;

    // Check if already loaded
    if (this.instances.has(pluginId)) {
      return {
        pluginId,
        success: true,
        warnings: ['Plugin was already loaded - skipping re-load.'],
      };
    }

    try {
      // Validate manifest
      const validation = validateManifest(manifest);
      if (!validation.valid) {
        return {
          pluginId,
          success: false,
          error: `Manifest validation failed: ${validation.errors.join(', ')}`,
        };
      }
      warnings.push(...validation.warnings);

      // Build the PluginDefinition from manifest
      const definition = this.manifestToDefinition(manifest);

      // Create PluginInstance
      const instance: PluginInstance = {
        manifest,
        definition,
        status: 'loaded',
        tools: new Map(),
        events: new Map(),
        routes: [],
        eventUnsubscribers: new Map(),
        pluginDir: path.join(this.pluginDir, manifest.slug),
      };

      // Attempt to load server entry
      if (manifest.serverEntry) {
        const serverEntryPath = path.join(this.pluginDir, manifest.slug, manifest.serverEntry);

        try {
          // Dynamic import of the server entry
          const serverModule = (await import(serverEntryPath)) as PluginServerModule;
          instance.serverModule = serverModule;

          // Register tools
          if (serverModule.tools) {
            for (const tool of serverModule.tools) {
              this.toolRegistry.register(pluginId, tool.name, {
                description: tool.description,
                parameters: tool.parameters,
                handler: tool.handler,
                permissions: tool.permissions,
              });
              instance.tools.set(tool.name, tool.handler);
            }
          }

          // Register event handlers
          if (serverModule.events) {
            for (const evt of serverModule.events) {
              const unsub = eventBus.on(evt.event, evt.handler);
              instance.events.set(evt.event, evt.handler);
              instance.eventUnsubscribers.set(evt.event, unsub);
            }
          }

          // Register routes
          if (serverModule.routes) {
            instance.routes.push(...serverModule.routes);
          }

          // Merge lifecycle hooks from definition override
          if (serverModule.definition) {
            Object.assign(instance.definition, serverModule.definition);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.warn(
            `[PluginLoader] Failed to load server entry for "${pluginId}": ${errorMsg}`,
          );
          warnings.push(`Server entry failed to load: ${errorMsg}`);
          instance.status = 'error';
          instance.error = errorMsg;
        }
      } else {
        warnings.push('No serverEntry defined - plugin has no runtime behavior.');
      }

      // Store instance
      this.instances.set(pluginId, instance);

      console.info(
        `[PluginLoader] Loaded plugin "${pluginId}" (${instance.tools.size} tools, ${instance.events.size} events, ${instance.routes.length} routes)`,
      );

      return { pluginId, success: true, warnings };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[PluginLoader] Error loading plugin "${pluginId}":`, error);

      return {
        pluginId,
        success: false,
        error: errorMsg,
      };
    }
  }

  // ============================================================
  // LOAD ALL: Scan, resolve, and load all plugins in dependency order
  // ============================================================

  /**
   * Scan the plugin directory, resolve dependencies, and load
   * all plugins in topological order.
   */
  async loadAll(): Promise<PluginLoadResult[]> {
    // 1. Scan for manifests
    const manifests = await this.scan();
    if (manifests.length === 0) {
      console.info('[PluginLoader] No plugins found to load.');
      return [];
    }

    // 2. Resolve dependencies
    const graph = await this.resolve(manifests);

    // Log dependency issues
    if (graph.cycles.length > 0) {
      for (const cycle of graph.cycles) {
        console.warn(`[PluginLoader] Circular dependency detected: ${cycle.join(' -> ')}`);
      }
    }

    if (graph.missing.length > 0) {
      console.warn(`[PluginLoader] Missing dependencies: ${graph.missing.join(', ')}`);
    }

    if (graph.versionConflicts.length > 0) {
      for (const conflict of graph.versionConflicts) {
        console.warn(
          `[PluginLoader] Version conflict: "${conflict.plugin}" requires "${conflict.dependency}" ${conflict.required} but found ${conflict.available ?? 'N/A'}`,
        );
      }
    }

    // 3. Load in topological order
    const results: PluginLoadResult[] = [];
    for (const pluginId of graph.resolvedOrder) {
      const manifest = graph.nodes.get(pluginId);
      if (!manifest) continue;

      // Skip plugins with unresolved dependencies
      if (graph.missing.length > 0) {
        const deps = manifest.dependencies?.filter((d) => !d.optional) ?? [];
        const hasMissing = deps.some((d) => graph.missing.includes(d.pluginId));
        if (hasMissing) {
          results.push({
            pluginId,
            success: false,
            error: `Missing required dependencies: ${deps.filter((d) => graph.missing.includes(d.pluginId)).map((d) => d.pluginId).join(', ')}`,
          });
          continue;
        }
      }

      const result = await this.load(manifest);
      results.push(result);
    }

    // Also try to load plugins not in the resolved order (standalone ones)
    for (const manifest of manifests) {
      if (!graph.resolvedOrder.includes(manifest.id)) {
        // Plugin was not in the resolved order (might be in a cycle)
        if (graph.cycles.some((cycle) => cycle.includes(manifest.id))) {
          results.push({
            pluginId: manifest.id,
            success: false,
            error: `Plugin is part of a circular dependency chain: ${graph.cycles.find((c) => c.includes(manifest.id))?.join(' -> ')}`,
          });
        } else if (!results.some((r) => r.pluginId === manifest.id)) {
          // Load as standalone (no dependencies)
          const result = await this.load(manifest);
          results.push(result);
        }
      }
    }

    return results;
  }

  // ============================================================
  // INSTALL: Install a plugin for a tenant
  // ============================================================

  /**
   * Install a plugin for a specific tenant.
   * Runs migrations, creates DB records, and emits lifecycle events.
   */
  async install(pluginId: string, tenantId: string): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" is not loaded - cannot install.`);
    }

    // Check if already installed
    const existing = await db.installedPlugin.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });
    if (existing) {
      console.warn(`[PluginLoader] Plugin "${pluginId}" is already installed for tenant "${tenantId}".`);
      return;
    }

    // Check dependencies are installed
    if (instance.manifest.dependencies) {
      for (const dep of instance.manifest.dependencies) {
        if (dep.optional) continue;

        const depInstalled = await db.installedPlugin.findFirst({
          where: { tenantId, pluginId: dep.pluginId },
        });
        if (!depInstalled) {
          throw new Error(
            `Cannot install "${pluginId}": required dependency "${dep.pluginId}" is not installed.`,
          );
        }
      }
    }

    // Run onInstall lifecycle hook
    if (instance.serverModule?.onInstall) {
      try {
        await instance.serverModule.onInstall({
          pluginId,
          tenantId,
          db,
          eventBus,
          toolRegistry: this.toolRegistry,
        });
      } catch (error) {
        console.error(`[PluginLoader] onInstall hook failed for "${pluginId}":`, error);
        throw new Error(`Plugin install hook failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Run migrations
    if (instance.manifest.migrations && instance.manifest.migrations.length > 0) {
      await this.runMigrations(instance.manifest.migrations, instance.pluginDir);
    }

    // Create InstalledPlugin record
    await db.installedPlugin.create({
      data: {
        tenantId,
        pluginId,
        version: instance.manifest.version,
        status: 'INSTALLED',
      },
    });

    instance.installedAt = new Date();

    // Emit plugin.installed event
    await eventBus.emit(EVENT_TYPES.PLUGIN_INSTALLED, {
      pluginId,
      tenantId,
      version: instance.manifest.version,
    });

    // Persist the event to the event store
    if (this.eventStore) {
      await this.eventStore.persist({
        tenantId,
        eventType: EVENT_TYPES.PLUGIN_INSTALLED,
        payload: { pluginId, version: instance.manifest.version },
        sourcePlugin: pluginId,
      });
    }

    console.info(`[PluginLoader] Installed plugin "${pluginId}" for tenant "${tenantId}".`);
  }

  // ============================================================
  // ACTIVATE: Activate an installed plugin
  // ============================================================

  /**
   * Activate an installed plugin for a tenant.
   * Runs the onActivate hook, registers tools for the tenant, and
   * updates the InstalledPlugin status.
   */
  async activate(pluginId: string, tenantId: string): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" is not loaded - cannot activate.`);
    }

    // Check if installed
    const installed = await db.installedPlugin.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });
    if (!installed) {
      throw new Error(`Plugin "${pluginId}" is not installed for tenant "${tenantId}".`);
    }

    if (installed.status === 'ACTIVE') {
      console.warn(`[PluginLoader] Plugin "${pluginId}" is already active for tenant "${tenantId}".`);
      return;
    }

    // Run onActivate lifecycle hook
    if (instance.serverModule?.onActivate) {
      try {
        await instance.serverModule.onActivate({
          pluginId,
          tenantId,
          db,
          eventBus,
          toolRegistry: this.toolRegistry,
        });
      } catch (error) {
        console.error(`[PluginLoader] onActivate hook failed for "${pluginId}":`, error);
        throw new Error(`Plugin activate hook failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Register tools for this tenant in the tool registry
    this.toolRegistry.activatePluginForTenant(pluginId, tenantId);

    // Update InstalledPlugin status
    await db.installedPlugin.update({
      where: { tenantId_pluginId: { tenantId, pluginId } },
      data: { status: 'ACTIVE' },
    });

    instance.status = 'active';
    instance.activatedAt = new Date();

    // Emit plugin.activated event
    await eventBus.emit(EVENT_TYPES.PLUGIN_ACTIVATED, {
      pluginId,
      tenantId,
      version: instance.manifest.version,
    });

    // Persist the event
    if (this.eventStore) {
      await this.eventStore.persist({
        tenantId,
        eventType: EVENT_TYPES.PLUGIN_ACTIVATED,
        payload: { pluginId, version: instance.manifest.version },
        sourcePlugin: pluginId,
      });
    }

    console.info(`[PluginLoader] Activated plugin "${pluginId}" for tenant "${tenantId}".`);
  }

  // ============================================================
  // DEACTIVATE: Deactivate an active plugin
  // ============================================================

  /**
   * Deactivate a plugin for a tenant.
   * Runs the onDeactivate hook, unregisters tools and events.
   */
  async deactivate(pluginId: string, tenantId: string): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" is not loaded.`);
    }

    // Check if active
    const installed = await db.installedPlugin.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });
    if (!installed || installed.status !== 'ACTIVE') {
      console.warn(`[PluginLoader] Plugin "${pluginId}" is not active for tenant "${tenantId}".`);
      return;
    }

    // Run onDeactivate lifecycle hook
    if (instance.serverModule?.onDeactivate) {
      try {
        await instance.serverModule.onDeactivate({
          pluginId,
          tenantId,
          db,
          eventBus,
          toolRegistry: this.toolRegistry,
        });
      } catch (error) {
        console.error(`[PluginLoader] onDeactivate hook failed for "${pluginId}":`, error);
      }
    }

    // Unregister tools for this tenant
    this.toolRegistry.deactivatePluginForTenant(pluginId, tenantId);

    // Update status
    await db.installedPlugin.update({
      where: { tenantId_pluginId: { tenantId, pluginId } },
      data: { status: 'DISABLED' },
    });

    instance.status = 'inactive';

    // Emit plugin.deactivated event
    await eventBus.emit(EVENT_TYPES.PLUGIN_DEACTIVATED, {
      pluginId,
      tenantId,
    });

    if (this.eventStore) {
      await this.eventStore.persist({
        tenantId,
        eventType: EVENT_TYPES.PLUGIN_DEACTIVATED,
        payload: { pluginId },
        sourcePlugin: pluginId,
      });
    }

    console.info(`[PluginLoader] Deactivated plugin "${pluginId}" for tenant "${tenantId}".`);
  }

  // ============================================================
  // UNINSTALL: Remove a plugin completely
  // ============================================================

  /**
   * Uninstall a plugin for a tenant.
   * Checks for dependents, deactivates if active, runs cleanup.
   */
  async uninstall(pluginId: string, tenantId: string): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" is not loaded.`);
    }

    // Check if installed
    const installed = await db.installedPlugin.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });
    if (!installed) {
      console.warn(`[PluginLoader] Plugin "${pluginId}" is not installed for tenant "${tenantId}".`);
      return;
    }

    // Check if other installed plugins depend on this one
    const allInstalled = await db.installedPlugin.findMany({
      where: { tenantId, status: { in: ['INSTALLED', 'ACTIVE'] } },
    });

    for (const ip of allInstalled) {
      if (ip.pluginId === pluginId) continue;

      const depInstance = this.instances.get(ip.pluginId);
      if (depInstance?.manifest.dependencies) {
        const dependsOnUs = depInstance.manifest.dependencies.some(
          (d) => d.pluginId === pluginId && !d.optional,
        );
        if (dependsOnUs) {
          throw new Error(
            `Cannot uninstall "${pluginId}": plugin "${ip.pluginId}" depends on it.`,
          );
        }
      }
    }

    // Deactivate if currently active
    if (installed.status === 'ACTIVE') {
      await this.deactivate(pluginId, tenantId);
    }

    // Run onUninstall lifecycle hook
    if (instance.serverModule?.onUninstall) {
      try {
        await instance.serverModule.onUninstall({
          pluginId,
          tenantId,
          db,
          eventBus,
          toolRegistry: this.toolRegistry,
        });
      } catch (error) {
        console.error(`[PluginLoader] onUninstall hook failed for "${pluginId}":`, error);
      }
    }

    // Run down migrations (reverse)
    if (instance.manifest.migrations) {
      await this.runDownMigrations(instance.manifest.migrations, instance.pluginDir);
    }

    // Delete InstalledPlugin record
    await db.installedPlugin.delete({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });

    instance.installedAt = undefined;
    instance.activatedAt = undefined;

    // Emit plugin.uninstalled event
    await eventBus.emit(EVENT_TYPES.PLUGIN_UNINSTALLED, {
      pluginId,
      tenantId,
    });

    if (this.eventStore) {
      await this.eventStore.persist({
        tenantId,
        eventType: EVENT_TYPES.PLUGIN_UNINSTALLED,
        payload: { pluginId },
        sourcePlugin: pluginId,
      });
    }

    console.info(`[PluginLoader] Uninstalled plugin "${pluginId}" for tenant "${tenantId}".`);
  }

  // ============================================================
  // RELOAD: Hot reload a plugin (dev mode)
  // ============================================================

  /**
   * Hot reload a plugin - unload, re-scan, re-validate, re-load.
   * Re-activates for all tenants that had it active.
   */
  async reload(pluginId: string): Promise<PluginLoadResult> {
    const oldInstance = this.instances.get(pluginId);
    if (!oldInstance) {
      return {
        pluginId,
        success: false,
        error: `Plugin "${pluginId}" is not currently loaded.`,
      };
    }

    // Remember which tenants had this plugin active
    const activeTenants: string[] = [];
    try {
      const activeInstallations = await db.installedPlugin.findMany({
        where: { pluginId, status: 'ACTIVE' },
      });
      activeTenants.push(...activeInstallations.map((i) => i.tenantId));
    } catch {
      // DB might not be available in dev mode
    }

    // Unload current instance
    await this.unload(pluginId);

    // Re-scan the specific plugin
    const manifestPath = path.join(this.pluginDir, oldInstance.manifest.slug, 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      return {
        pluginId,
        success: false,
        error: `Plugin manifest not found at ${manifestPath}`,
      };
    }

    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf-8');
      const json = JSON.parse(raw) as unknown;
      const validation = validateManifest(json);

      if (!validation.valid) {
        return {
          pluginId,
          success: false,
          error: `Manifest validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Re-load
      const result = await this.load(json as PluginManifest);

      // Re-activate for tenants
      if (result.success) {
        for (const tenantId of activeTenants) {
          try {
            this.toolRegistry.activatePluginForTenant(pluginId, tenantId);
          } catch (error) {
            console.warn(
              `[PluginLoader] Failed to re-activate "${pluginId}" for tenant "${tenantId}":`,
              error,
            );
          }
        }
      }

      console.info(`[PluginLoader] Reloaded plugin "${pluginId}" (re-activated for ${activeTenants.length} tenant(s)).`);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        pluginId,
        success: false,
        error: `Failed to reload: ${errorMsg}`,
      };
    }
  }

  // ============================================================
  // UNLOAD: Unload a plugin from memory (internal)
  // ============================================================

  /**
   * Unload a plugin from memory: unregister event handlers,
   * unregister tools, and remove the instance.
   */
  async unload(pluginId: string): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) return;

    // Unsubscribe all event handlers
    for (const [, unsub] of instance.eventUnsubscribers) {
      unsub();
    }

    // Unregister all tools from the tool registry
    this.toolRegistry.unregister(pluginId);

    // Remove from all tenant activations
    this.toolRegistry.removePluginFromAllTenants(pluginId);

    // Remove instance
    this.instances.delete(pluginId);

    console.info(`[PluginLoader] Unloaded plugin "${pluginId}" from memory.`);
  }

  // ============================================================
  // GETTERS
  // ============================================================

  /** Get a single plugin instance by ID */
  getInstance(pluginId: string): PluginInstance | undefined {
    return this.instances.get(pluginId);
  }

  /** Get all loaded plugin instances */
  getAllInstances(): Map<string, PluginInstance> {
    return new Map(this.instances);
  }

  /** Get all active plugins for a specific tenant */
  async getActivePlugins(tenantId: string): Promise<PluginInstance[]> {
    const activeInstallations = await db.installedPlugin.findMany({
      where: { tenantId, status: 'ACTIVE' },
    });

    const result: PluginInstance[] = [];
    for (const installation of activeInstallations) {
      const instance = this.instances.get(installation.pluginId);
      if (instance && instance.status === 'active') {
        result.push(instance);
      }
    }

    return result;
  }

  /** Get the plugin directory path */
  getPluginDir(): string {
    return this.pluginDir;
  }

  // ============================================================
  // INTERNAL: Dependency resolution helpers
  // ============================================================

  /**
   * Detect circular dependencies using DFS with coloring.
   * 0 = unvisited, 1 = in progress, 2 = done
   */
  private detectCycles(edges: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const color = new Map<string, number>();

    for (const node of edges.keys()) {
      color.set(node, 0);
    }

    const dfs = (node: string, stack: string[]): void => {
      color.set(node, 1);
      stack.push(node);

      const neighbors = edges.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (!color.has(neighbor)) continue;

        if (color.get(neighbor) === 1) {
          // Found a cycle - extract it from the stack
          const cycleStart = stack.indexOf(neighbor);
          const cycle = stack.slice(cycleStart);
          // Rotate so the cycle starts with the alphabetically smallest node
          const minIdx = cycle.indexOf(cycle.reduce((a, b) => (a < b ? a : b)));
          const rotated = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
          cycles.push(rotated);
        } else if (color.get(neighbor) === 0) {
          dfs(neighbor, stack);
        }
      }

      stack.pop();
      color.set(node, 2);
    };

    for (const node of edges.keys()) {
      if (color.get(node) === 0) {
        dfs(node, []);
      }
    }

    // Deduplicate cycles (same cycle may be found from different starting nodes)
    const uniqueCycles: string[][] = [];
    const seen = new Set<string>();
    for (const cycle of cycles) {
      const key = cycle.join('->');
      if (!seen.has(key)) {
        seen.add(key);
        uniqueCycles.push(cycle);
      }
    }

    return uniqueCycles;
  }

  /**
   * Topological sort using Kahn's algorithm.
   * Only includes nodes that have no cycles or missing deps.
   */
  private topologicalSort(
    edges: Map<string, string[]>,
    nodes: Map<string, PluginManifest>,
  ): string[] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, Set<string>>(); // reverse: dependency -> dependents

    // Initialize
    for (const node of nodes.keys()) {
      inDegree.set(node, 0);
      adjList.set(node, new Set());
    }

    // Build in-degree counts and adjacency
    for (const [node, deps] of edges) {
      for (const dep of deps) {
        if (!nodes.has(dep)) continue; // Skip missing deps
        inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
        adjList.get(dep)!.add(node);
      }
    }

    // Start with nodes that have no dependencies
    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    // Sort the initial queue for deterministic ordering
    queue.sort();

    const result: string[] = [];
    const tempQueue: string[] = [...queue];

    while (tempQueue.length > 0) {
      // Sort for deterministic ordering
      tempQueue.sort();
      const node = tempQueue.shift()!;
      result.push(node);

      for (const dependent of adjList.get(node) ?? []) {
        const newDegree = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) {
          tempQueue.push(dependent);
        }
      }
    }

    return result;
  }

  // ============================================================
  // INTERNAL: Migration runner
  // ============================================================

  /**
   * Run migrations in version order.
   * Uses the Prisma client to execute raw SQL.
   */
  private async runMigrations(
    migrations: PluginMigration[],
    pluginDir: string,
  ): Promise<void> {
    // Sort migrations by version
    const sorted = [...migrations].sort((a, b) =>
      a.version.localeCompare(b.version, undefined, { numeric: true }),
    );

    for (const migration of sorted) {
      console.info(`[PluginLoader] Running migration ${migration.version} (${migration.up.length} statement(s))`);

      for (const sql of migration.up) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`[PluginLoader] Migration ${migration.version} failed: ${msg}`);
          throw new Error(`Migration ${migration.version} failed: ${msg}`);
        }
      }
    }
  }

  /**
   * Run down migrations in reverse version order.
   */
  private async runDownMigrations(
    migrations: PluginMigration[],
    _pluginDir: string,
  ): Promise<void> {
    // Sort migrations by version in reverse
    const sorted = [...migrations]
      .filter((m) => m.down && m.down.length > 0)
      .sort((a, b) =>
        b.version.localeCompare(a.version, undefined, { numeric: true }),
      );

    for (const migration of sorted) {
      console.info(`[PluginLoader] Running down migration ${migration.version}`);

      for (const sql of migration.down ?? []) {
        try {
          await db.$executeRawUnsafe(sql);
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          console.error(`[PluginLoader] Down migration ${migration.version} failed: ${msg}`);
          // Do not throw - best-effort rollback
        }
      }
    }
  }

  // ============================================================
  // INTERNAL: Manifest to Definition conversion
  // ============================================================

  /**
   * Convert a PluginManifest to a PluginDefinition.
   */
  private manifestToDefinition(manifest: PluginManifest): PluginDefinition {
    return {
      id: manifest.id,
      name: manifest.name,
      slug: manifest.slug,
      description: manifest.description,
      version: manifest.version,
      icon: manifest.icon ?? 'Puzzle',
      author: manifest.author,
      category: manifest.category,
      status: 'available',
      capabilities: manifest.capabilities,
    };
  }
}

// ============================================================
// Standalone resolve function (for use without instantiating PluginLoader)
// ============================================================

export async function resolve(manifests: PluginManifest[]): Promise<PluginDependencyGraph> {
  const loader = new PluginLoader({
    toolRegistry: {
      // Minimal stub for the resolve function
      register: () => {},
      unregister: () => {},
      get: () => undefined,
      getByPlugin: () => [],
      getAll: () => [],
      getForTenant: () => [],
      activatePluginForTenant: () => {},
      deactivatePluginForTenant: () => {},
      removePluginFromAllTenants: () => {},
      toMCPTools: () => [],
      toMCPTenantTools: () => [],
      invoke: async () => ({ toolName: '', success: false, error: 'stub', durationMs: 0 }),
      has: () => false,
      clear: () => {},
      get size() { return 0; },
      get tenantCount() { return 0; },
    },
  });

  return loader.resolve(manifests);
}
