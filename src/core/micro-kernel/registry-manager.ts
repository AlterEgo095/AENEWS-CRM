/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * Registry Manager
 *
 * Le Kernel ne possède plus de registres spécifiques.
 * Tous les registres (capability, tool, ui, schema, workflow,
 * knowledge, agent, search, builder, event) sont des SERVICES
 * fournis par le Registry Manager.
 *
 * API générique : register / unregister / resolve / query / watch
 */

import type { RegistryType, RegistryEntry } from './types';

type WatcherCallback = (entries: RegistryEntry[]) => void;

interface RegistryWatcher {
  id: string;
  callback: WatcherCallback;
  disposed: boolean;
}

class RegistryStore {
  private entries: Map<string, RegistryEntry> = new Map();
  private byPlugin: Map<string, Set<string>> = new Map();
  private watchers: RegistryWatcher[] = [];
  private watcherCounter = 0;
  private _type: RegistryType;

  constructor(type: RegistryType) {
    this._type = type;
  }

  get type(): RegistryType {
    return this._type;
  }

  register(entry: Omit<RegistryEntry, 'registeredAt'>): void {
    const fullEntry: RegistryEntry = {
      ...entry,
      registeredAt: Date.now(),
    };

    this.entries.set(entry.id, fullEntry);

    // Index by plugin
    if (!this.byPlugin.has(entry.pluginId)) {
      this.byPlugin.set(entry.pluginId, new Set());
    }
    this.byPlugin.get(entry.pluginId)!.add(entry.id);

    this._notifyWatchers();
  }

  unregister(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) return false;

    this.entries.delete(id);

    // Remove from plugin index
    const pluginIds = this.byPlugin.get(entry.pluginId);
    if (pluginIds) {
      pluginIds.delete(id);
      if (pluginIds.size === 0) {
        this.byPlugin.delete(entry.pluginId);
      }
    }

    this._notifyWatchers();
    return true;
  }

  /** Unregister ALL entries for a specific plugin */
  unregisterByPlugin(pluginId: string): number {
    const ids = this.byPlugin.get(pluginId);
    if (!ids) return 0;

    let count = 0;
    for (const id of ids) {
      this.entries.delete(id);
      count++;
    }
    this.byPlugin.delete(pluginId);
    this._notifyWatchers();
    return count;
  }

  resolve(id: string): RegistryEntry | undefined {
    return this.entries.get(id);
  }

  query(filter?: Partial<Pick<RegistryEntry, 'pluginId' | 'type'>>): RegistryEntry[] {
    let results = Array.from(this.entries.values());
    if (filter?.pluginId) {
      results = results.filter(e => e.pluginId === filter.pluginId);
    }
    if (filter?.type) {
      results = results.filter(e => e.type === filter.type);
    }
    return results;
  }

  watch(callback: WatcherCallback): () => void {
    const watcher: RegistryWatcher = {
      id: `w_${this._type}_${++this.watcherCounter}`,
      callback,
      disposed: false,
    };
    this.watchers.push(watcher);

    return () => {
      watcher.disposed = true;
      this.watchers = this.watchers.filter(w => !w.disposed);
    };
  }

  get count(): number {
    return this.entries.size;
  }

  get all(): RegistryEntry[] {
    return Array.from(this.entries.values());
  }

  clear(): void {
    this.entries.clear();
    this.byPlugin.clear();
    this.watchers = [];
  }

  private _notifyWatchers(): void {
    const snapshot = this.all;
    for (const w of this.watchers) {
      if (!w.disposed) {
        try {
          w.callback(snapshot);
        } catch (err) {
          console.error(`[Registry:${this._type}] Watcher error:`, err);
        }
      }
    }
  }
}

export class RegistryManager {
  private stores: Map<RegistryType, RegistryStore> = new Map();

  constructor() {
    // Initialize all 10 registry types
    const types: RegistryType[] = [
      'capability', 'tool', 'ui', 'schema', 'workflow',
      'knowledge', 'agent', 'search', 'builder', 'event',
    ];
    for (const type of types) {
      this.stores.set(type, new RegistryStore(type));
    }
  }

  /** Register an entry in a specific registry */
  register(type: RegistryType, entry: Omit<RegistryEntry, 'registeredAt'>): void {
    const store = this.stores.get(type);
    if (!store) {
      throw new Error(`[RegistryManager] Unknown registry type: "${type}"`);
    }
    store.register(entry);
  }

  /** Unregister an entry from a specific registry */
  unregister(type: RegistryType, id: string): boolean {
    const store = this.stores.get(type);
    if (!store) return false;
    return store.unregister(id);
  }

  /** Resolve an entry by ID */
  resolve<T = unknown>(type: RegistryType, id: string): T | undefined {
    const store = this.stores.get(type);
    if (!store) return undefined;
    const entry = store.resolve(id);
    return entry?.data as T | undefined;
  }

  /** Query entries with optional filters */
  query(type: RegistryType, filter?: Partial<Pick<RegistryEntry, 'pluginId' | 'type'>>): RegistryEntry[] {
    const store = this.stores.get(type);
    if (!store) return [];
    return store.query(filter);
  }

  /** Watch a registry for changes */
  watch(type: RegistryType, callback: (entries: RegistryEntry[]) => void): () => void {
    const store = this.stores.get(type);
    if (!store) return () => {};
    return store.watch(callback);
  }

  /** Unregister ALL entries for a plugin across ALL registries */
  unregisterPlugin(pluginId: string): { type: RegistryType; count: number }[] {
    const results: { type: RegistryType; count: number }[] = [];
    for (const [type, store] of this.stores) {
      const count = store.unregisterByPlugin(pluginId);
      if (count > 0) {
        results.push({ type, count });
      }
    }
    return results;
  }

  /** Get stats for all registries */
  getStats(): { type: RegistryType; count: number }[] {
    const stats: { type: RegistryType; count: number }[] = [];
    for (const [type, store] of this.stores) {
      stats.push({ type, count: store.count });
    }
    return stats;
  }

  /** Get total entries across all registries */
  get totalCount(): number {
    let total = 0;
    for (const store of this.stores.values()) {
      total += store.count;
    }
    return total;
  }

  /** Get a snapshot of all registries */
  getSnapshot(): Record<RegistryType, RegistryEntry[]> {
    const snapshot = {} as Record<RegistryType, RegistryEntry[]>;
    for (const [type, store] of this.stores) {
      snapshot[type] = store.all;
    }
    return snapshot;
  }

  /** Clear all registries */
  clear(): void {
    for (const store of this.stores.values()) {
      store.clear();
    }
  }
}

// Singleton
let _registry: RegistryManager | null = null;

export function getRegistryManager(): RegistryManager {
  if (!_registry) {
    _registry = new RegistryManager();
  }
  return _registry;
}

export function resetRegistryManager(): void {
  _registry = new RegistryManager();
}
