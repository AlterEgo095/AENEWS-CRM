// =============================================================================
// AENEWS Enterprise OS — PHASE OMEGA
// Live Registry
// Watches the filesystem for plugin changes and dynamically updates the
// plugin registry. Uses a polling mechanism (every 2 s) to check for
// added / modified / removed plugin.json files.
// =============================================================================

import { readdir, readFile, stat } from 'fs/promises';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LiveChangeType = 'added' | 'modified' | 'removed';

/** A single filesystem change event. */
export interface LiveChangeEvent {
  type: LiveChangeType;
  pluginId: string;
  path: string;
  timestamp: string;
}

/** Configuration for the LiveRegistry. */
export interface LiveRegistryConfig {
  /** Directory to watch for plugins. */
  watchDir: string;
  /** Debounce interval in milliseconds. */
  debounceMs: number;
  /** Whether to auto-discover new plugins on start. */
  autoDiscover: boolean;
}

/** Statistics about the live registry. */
export interface LiveRegistryStats {
  totalChanges: number;
  watchedPlugins: number;
  lastChangeAt: string | null;
  uptime: number;
}

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

interface PluginSnapshot {
  path: string;
  hash: string;
  lastSeen: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_POLL_INTERVAL_MS = 2000;
const CHANGE_BUFFER_SIZE = 100;

function nowISO(): string {
  return new Date().toISOString();
}

/** Very fast content hash — just length + first/last 64 chars. */
function quickHash(content: string): string {
  if (content.length <= 128) return content;
  return content.slice(0, 64) + '...' + content.slice(-64);
}

// ---------------------------------------------------------------------------
// LiveRegistry
// ---------------------------------------------------------------------------

export class LiveRegistry {
  /** Registered change handlers. */
  private changeHandlers: Array<(event: LiveChangeEvent) => void> = [];

  /** Circular buffer of recent change events. */
  private changes: LiveChangeEvent[] = [];

  /** Whether the registry is actively watching. */
  private running = false;

  /** The polling timer reference. */
  private timer: ReturnType<typeof setInterval> | null = null;

  /** Configuration. */
  private config: LiveRegistryConfig = {
    watchDir: './plugins',
    debounceMs: 500,
    autoDiscover: true,
  };

  /** Snapshot of known plugins: pluginId → { path, hash, lastSeen }. */
  private snapshots: Map<string, PluginSnapshot> = new Map();

  /** Counters for stats. */
  private _totalChanges = 0;
  private _startTime = 0;

  /** Debounce state. */
  private _debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private _pendingEvents: LiveChangeEvent[] = [];

  constructor() {
    console.log('[LiveRegistry] Initialized — PHASE OMEGA Live Updates');
  }

  // ---- Public API ----------------------------------------------------------

  /**
   * Starts the filesystem watcher. Optionally accepts a partial config
   * that is merged with defaults.
   */
  start(config?: Partial<LiveRegistryConfig>): void {
    if (this.running) {
      console.warn('[LiveRegistry] Already running — ignoring start() call');
      return;
    }

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this._startTime = Date.now();
    this.running = true;

    console.log(`[LiveRegistry] Watching directory: ${this.config.watchDir} (poll every ${DEFAULT_POLL_INTERVAL_MS}ms)`);

    // Run initial discovery if enabled
    if (this.config.autoDiscover) {
      this.forceRediscover();
    }

    // Start polling
    this.timer = setInterval(() => {
      if (this.running) {
        void this._poll();
      }
    }, DEFAULT_POLL_INTERVAL_MS);
  }

  /** Stops the filesystem watcher. */
  stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }

    console.log(`[LiveRegistry] Stopped. Total changes recorded: ${this._totalChanges}`);
  }

  /**
   * Registers a callback to be invoked whenever a change event is detected.
   * Events are debounced according to the configured debounceMs.
   */
  onChange(callback: (event: LiveChangeEvent) => void): void {
    this.changeHandlers.push(callback);
  }

  /**
   * Returns the most recent change events, up to `limit` entries.
   * Default limit is 20. Returns newest first.
   */
  getChanges(limit: number = 20): LiveChangeEvent[] {
    return this.changes.slice(-limit).reverse();
  }

  /**
   * Forces a manual re-discovery scan of the watch directory.
   * Immediately detects any changes since the last poll.
   */
  forceRediscover(): void {
    console.log('[LiveRegistry] Forcing re-discovery...');
    void this._poll();
  }

  /** Returns the IDs of all currently watched plugins. */
  getWatchedPlugins(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /** Whether the registry is actively watching. */
  isWatching(): boolean {
    return this.running;
  }

  /** Returns statistics about the live registry. */
  getStats(): LiveRegistryStats {
    return {
      totalChanges: this._totalChanges,
      watchedPlugins: this.snapshots.size,
      lastChangeAt: this.changes.length > 0 ? this.changes[this.changes.length - 1]!.timestamp : null,
      uptime: this._startTime > 0 ? Date.now() - this._startTime : 0,
    };
  }

  // ---- Private methods -----------------------------------------------------

  /**
   * Main polling loop — scans the watch directory for plugin.json files,
   * compares against known snapshots, and emits change events.
   */
  private async _poll(): Promise<void> {
    const dir = this.config.watchDir;

    // Read directory entries
    let entries: Array<{ name: string; isDirectory: () => boolean }>;
    try {
      entries = await readdir(dir, { withFileTypes: true }) as unknown as Array<{ name: string; isDirectory: () => boolean }>;
    } catch {
      // Directory doesn't exist yet — treat all known plugins as removed
      if (this.snapshots.size > 0) {
        for (const [pluginId] of this.snapshots) {
          this._emitEvent({
            type: 'removed',
            pluginId,
            path: '',
            timestamp: nowISO(),
          });
        }
      }
      return;
    }

    const currentPlugins = new Set<string>();

    // Scan each subdirectory for plugin.json
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginDir = join(dir, entry.name);
      const manifestPath = join(pluginDir, 'plugin.json');

      let pluginId: string;
      let content: string;

      try {
        content = await readFile(manifestPath, 'utf-8');
        const parsed = JSON.parse(content);
        pluginId = parsed.id ?? parsed.name ?? entry.name;
      } catch {
        // No valid plugin.json — skip
        continue;
      }

      currentPlugins.add(pluginId);
      const hash = quickHash(content);
      const known = this.snapshots.get(pluginId);

      if (!known) {
        // New plugin discovered
        this.snapshots.set(pluginId, { path: pluginDir, hash, lastSeen: Date.now() });
        this._emitEvent({
          type: 'added',
          pluginId,
          path: pluginDir,
          timestamp: nowISO(),
        });
      } else if (known.hash !== hash) {
        // Plugin modified
        known.hash = hash;
        known.lastSeen = Date.now();
        known.path = pluginDir;
        this._emitEvent({
          type: 'modified',
          pluginId,
          path: pluginDir,
          timestamp: nowISO(),
        });
      } else {
        // Unchanged — just update lastSeen
        known.lastSeen = Date.now();
      }
    }

    // Check for removed plugins
    for (const [pluginId] of this.snapshots) {
      if (!currentPlugins.has(pluginId)) {
        const info = this.snapshots.get(pluginId)!;
        this._emitEvent({
          type: 'removed',
          pluginId,
          path: info.path,
          timestamp: nowISO(),
        });
        this.snapshots.delete(pluginId);
      }
    }
  }

  /**
   * Emits a change event — buffers it, then debounces before dispatching
   * to registered handlers.
   */
  private _emitEvent(event: LiveChangeEvent): void {
    this._totalChanges++;

    // Add to circular buffer
    if (this.changes.length >= CHANGE_BUFFER_SIZE) {
      this.changes.shift();
    }
    this.changes.push(event);

    // Buffer for debounce
    this._pendingEvents.push(event);

    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      const events = [...this._pendingEvents];
      this._pendingEvents = [];
      this._debounceTimer = null;

      for (const evt of events) {
        for (const handler of this.changeHandlers) {
          try {
            handler(evt);
          } catch (error) {
            console.error(`[LiveRegistry] Change handler error: ${error}`);
          }
        }
      }
    }, this.config.debounceMs);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: LiveRegistry | null = null;

/** Returns the singleton LiveRegistry instance. */
export function getLiveRegistry(): LiveRegistry {
  if (!_instance) {
    _instance = new LiveRegistry();
  }
  return _instance;
}

/** Resets the singleton — useful for testing. */
export function resetLiveRegistry(): void {
  if (_instance) {
    _instance.stop();
  }
  _instance = null;
  console.log('[LiveRegistry] Singleton reset');
}