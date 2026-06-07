// ============================================================
// AENEWS Enterprise OS — Plugin Loader
// Discovers, validates, resolves dependencies, loads, and
// manages the full plugin lifecycle.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

import { db } from '@/lib/db';
import { eventBus, EVENT_TYPES } from '@/lib/event-bus';
import type { ToolRegistry } from '../tool-registry';
import type { EventStore } from '../event-store';
import type {
  PluginManifest,
  PluginDefinition,
  PluginServerModule,
  validateManifest,
  satisfiesVersionRange,
} from '../plugin-sdk';

import {
  validateManifest as doValidate,
  satisfiesVersionRange as doSatisfiesVersion,
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
  edges: Map<string, string[]>;
  resolvedOrder: string[];
  cycles: string[][];
  missing: string[];
  versionConflicts: Array<{
    plugin: string;
    dependency: string;
    required: string;
    available?: string;
  }>;
}

export interface PluginInstance {
  manifest: PluginManifest;
  serverModule?: PluginServerModule;
  status: 'loaded' | 'active' | 'inactive' | 'error';
  eventUnsubscribers: Map<string, () => void>;
  installedAt?: Date;
  activatedAt?: Date;
  error?: string;
  pluginDir: string;
}

export interface PluginLoaderConfig {
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

  async scan(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    if (!fs.existsSync(this.pluginDir)) {
      console.warn(`[PluginLoader] Plugin directory does not exist: ${this.pluginDir}`);
      return manifests;
    }

    const entries = await fs.promises.readdir(this.pluginDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginPath = path.join(this.pluginDir, entry.name);
      const manifestPath = path.join(pluginPath, 'plugin.json');

      if (!fs.existsSync(manifestPath)) {
        continue;
      }

      try {
        const raw = await fs.promises.readFile(manifestPath, 'utf-8');
        const json = JSON.parse(raw) as unknown;
        const validation = doValidate(json);

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

  async resolve(manifests: PluginManifest[]): Promise<PluginDependencyGraph> {
    const nodes = new Map<string, PluginManifest>();
    const edges = new Map<string, string[]>();
    const cycles: string[][] = [];
    const missing: string[] = [];
    const versionConflicts: PluginDependencyGraph['versionConflicts'] = [];

    for (const manifest of manifests) {
      nodes.set(manifest.id, manifest);
      edges.set(manifest.id, []);
    }

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

        if (dep.version) {
          if (!doSatisfiesVersion(depManifest.version, dep.version)) {
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

    const detectedCycles = this.detectCycles(edges);
    cycles.push(...detectedCycles);

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

  async load(manifest: PluginManifest): Promise<PluginLoadResult> {
    const warnings: string[] = [];
    const pluginId = manifest.id;

    if (this.instances.has(pluginId)) {
      return {
        pluginId,
        success: true,
        warnings: ['Plugin was already loaded - skipping re-load.'],
      };
    }

    try {
      const validation = doValidate(manifest);
      if (!validation.valid) {
        return {
          pluginId,
          success: false,
          error: `Manifest validation failed: ${validation.errors.join(', ')}`,
        };
      }
      warnings.push(...validation.warnings);

      // Create PluginInstance
      const instance: PluginInstance = {
        manifest,
        status: 'loaded',
        eventUnsubscribers: new Map(),
        pluginDir: path.join(this.pluginDir, manifest.slug),
      };

      // Attempt to load server entry
      const serverEntry = manifest.entry?.server;
      if (serverEntry) {
        const serverEntryPath = path.join(this.pluginDir, manifest.slug, serverEntry);

        try {
          const serverModule = (await import(serverEntryPath)) as PluginServerModule;
          instance.serverModule = serverModule;

          // Register tools
          if (serverModule.tools) {
            for (const tool of serverModule.tools) {
              this.toolRegistry.register(pluginId, tool.name, {
                description: tool.description,
                parameters: tool.parameters,
                execute: tool.handler,
              });
            }
          }

          // Register event handlers
          if (serverModule.events) {
            for (const evt of serverModule.events) {
              const unsub = eventBus.on(evt.event, evt.handler);
              instance.eventUnsubscribers.set(evt.event, unsub);
            }
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
        warnings.push('No server entry defined - plugin has no runtime behavior.');
      }

      this.instances.set(pluginId, instance);

      console.info(`[PluginLoader] Loaded plugin "${pluginId}"`);
      return { pluginId, success: true, warnings };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[PluginLoader] Error loading plugin "${pluginId}":`, error);

      return { pluginId, success: false, error: errorMsg };
    }
  }

  // ============================================================
  // LOAD ALL: Scan, resolve, and load all plugins
  // ============================================================

  async loadAll(): Promise<PluginLoadResult[]> {
    const manifests = await this.scan();
    if (manifests.length === 0) {
      console.info('[PluginLoader] No plugins found to load.');
      return [];
    }

    const graph = await this.resolve(manifests);

    if (graph.cycles.length > 0) {
      for (const cycle of graph.cycles) {
        console.warn(`[PluginLoader] Circular dependency detected: ${cycle.join(' -> ')}`);
      }
    }

    if (graph.missing.length > 0) {
      console.warn(`[PluginLoader] Missing dependencies: ${graph.missing.join(', ')}`);
    }

    const results: PluginLoadResult[] = [];
    for (const pluginId of graph.resolvedOrder) {
      const manifest = graph.nodes.get(pluginId);
      if (!manifest) continue;

      const result = await this.load(manifest);
      results.push(result);
    }

    return results;
  }

  // ============================================================
  // INSTALL: Install a plugin for a tenant
  // ============================================================

  async install(pluginId: string, tenantId: string): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" is not loaded - cannot install.`);
    }

    const existing = await db.installedPlugin.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });
    if (existing) {
      console.warn(`[PluginLoader] Plugin "${pluginId}" is already installed for tenant "${tenantId}".`);
      return;
    }

    // Ensure Plugin record exists in DB
    await db.plugin.upsert({
      where: { slug: instance.manifest.slug },
      update: {},
      create: {
        id: instance.manifest.id,
        name: instance.manifest.name,
        slug: instance.manifest.slug,
        description: instance.manifest.description,
        version: instance.manifest.version,
        author: instance.manifest.author,
        category: 'CUSTOM',
        status: 'AVAILABLE',
        capabilities: JSON.stringify(instance.manifest.capabilities),
        settings: '{}',
      },
    });

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

    await eventBus.emit(EVENT_TYPES.PLUGIN_INSTALLED, {
      pluginId,
      tenantId,
      version: instance.manifest.version,
    });

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

  async activate(pluginId: string, tenantId: string): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" is not loaded - cannot activate.`);
    }

    const installed = await db.installedPlugin.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });
    if (!installed) {
      throw new Error(`Plugin "${pluginId}" is not installed for tenant "${tenantId}".`);
    }

    if (installed.status === 'ACTIVE') {
      console.warn(`[PluginLoader] Plugin "${pluginId}" is already active.`);
      return;
    }

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

    await db.installedPlugin.update({
      where: { tenantId_pluginId: { tenantId, pluginId } },
      data: { status: 'ACTIVE' },
    });

    instance.status = 'active';
    instance.activatedAt = new Date();

    await eventBus.emit(EVENT_TYPES.PLUGIN_ACTIVATED, {
      pluginId,
      tenantId,
      version: instance.manifest.version,
    });

    console.info(`[PluginLoader] Activated plugin "${pluginId}" for tenant "${tenantId}".`);
  }

  // ============================================================
  // DEACTIVATE: Deactivate an active plugin
  // ============================================================

  async deactivate(pluginId: string, tenantId: string): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" is not loaded.`);
    }

    const installed = await db.installedPlugin.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });
    if (!installed || installed.status !== 'ACTIVE') {
      console.warn(`[PluginLoader] Plugin "${pluginId}" is not active.`);
      return;
    }

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
        console.error(`[PluginLoader] onDeactivate hook failed:`, error);
      }
    }

    await db.installedPlugin.update({
      where: { tenantId_pluginId: { tenantId, pluginId } },
      data: { status: 'DISABLED' },
    });

    instance.status = 'inactive';

    await eventBus.emit(EVENT_TYPES.PLUGIN_DEACTIVATED, {
      pluginId,
      tenantId,
    });

    console.info(`[PluginLoader] Deactivated plugin "${pluginId}".`);
  }

  // ============================================================
  // UNINSTALL: Remove a plugin completely
  // ============================================================

  async uninstall(pluginId: string, tenantId: string): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin "${pluginId}" is not loaded.`);
    }

    const installed = await db.installedPlugin.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });
    if (!installed) {
      console.warn(`[PluginLoader] Plugin "${pluginId}" is not installed.`);
      return;
    }

    // Deactivate if active
    if (installed.status === 'ACTIVE') {
      await this.deactivate(pluginId, tenantId);
    }

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
        console.error(`[PluginLoader] onUninstall hook failed:`, error);
      }
    }

    await db.installedPlugin.delete({
      where: { tenantId_pluginId: { tenantId, pluginId } },
    });

    instance.installedAt = undefined;
    instance.activatedAt = undefined;

    await eventBus.emit(EVENT_TYPES.PLUGIN_UNINSTALLED, {
      pluginId,
      tenantId,
    });

    console.info(`[PluginLoader] Uninstalled plugin "${pluginId}".`);
  }

  // ============================================================
  // UNLOAD: Unload a plugin from memory (internal)
  // ============================================================

  async unload(pluginId: string): Promise<void> {
    const instance = this.instances.get(pluginId);
    if (!instance) return;

    for (const [, unsub] of instance.eventUnsubscribers) {
      unsub();
    }

    this.toolRegistry.unregister(pluginId);

    this.instances.delete(pluginId);

    console.info(`[PluginLoader] Unloaded plugin "${pluginId}".`);
  }

  // ============================================================
  // GETTERS
  // ============================================================

  getInstance(pluginId: string): PluginInstance | undefined {
    return this.instances.get(pluginId);
  }

  getAllInstances(): Map<string, PluginInstance> {
    return new Map(this.instances);
  }

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

  getPluginDir(): string {
    return this.pluginDir;
  }

  // ============================================================
  // INTERNAL: Dependency resolution helpers
  // ============================================================

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
          const cycleStart = stack.indexOf(neighbor);
          const cycle = stack.slice(cycleStart);
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

  private topologicalSort(
    edges: Map<string, string[]>,
    nodes: Map<string, PluginManifest>,
  ): string[] {
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, Set<string>>();

    for (const node of nodes.keys()) {
      inDegree.set(node, 0);
      adjList.set(node, new Set());
    }

    for (const [node, deps] of edges) {
      for (const dep of deps) {
        if (!nodes.has(dep)) continue;
        inDegree.set(node, (inDegree.get(node) ?? 0) + 1);
        adjList.get(dep)!.add(node);
      }
    }

    const queue: string[] = [];
    for (const [node, degree] of inDegree) {
      if (degree === 0) {
        queue.push(node);
      }
    }

    queue.sort();

    const result: string[] = [];
    const tempQueue: string[] = [...queue];

    while (tempQueue.length > 0) {
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
}

// ============================================================
// Standalone resolve function
// ============================================================

export async function resolve(manifests: PluginManifest[]): Promise<PluginDependencyGraph> {
  const loader = new PluginLoader({
    toolRegistry: {
      register: () => {},
      unregister: () => {},
      get: () => undefined,
      getAll: () => new Map(),
      getByPlugin: () => new Map(),
    } as any,
  });

  return loader.resolve(manifests);
}
