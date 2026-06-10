// =============================================================================
// AENEWS Enterprise OS — PHASE OMEGA
// Hot Plugin Update System
// Install / update / patch / rollback / reload plugins without requiring a
// full application restart. Maintains version history and success statistics.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HotUpdateAction = 'install' | 'update' | 'patch' | 'rollback' | 'reload';

/** Result of a hot update operation. */
export interface HotUpdateResult {
  success: boolean;
  action: HotUpdateAction;
  pluginId: string;
  version: string;
  durationMs: number;
  errors?: string[];
}

/** A snapshot of a specific plugin version at a point in time. */
export interface PluginVersion {
  version: string;
  installedAt: string;
  checksum: string;
  manifestSnapshot: Record<string, unknown>;
}

/** Aggregated statistics for the hot update system. */
export interface HotPluginStats {
  totalUpdates: number;
  totalRollbacks: number;
  totalReloads: number;
  successRate: number;
  avgDurationMs: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowISO(): string {
  return new Date().toISOString();
}

/** Simple hash for checksums. */
function simpleChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const chr = data.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32-bit int
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// HotPluginManager
// ---------------------------------------------------------------------------

export class HotPluginManager {
  /** Version history per plugin: pluginId → array of PluginVersion (newest last). */
  private versionHistory: Map<string, PluginVersion[]> = new Map();

  /** Pending updates waiting to be applied: pluginId → manifest data. */
  private pendingUpdates: Map<string, Record<string, unknown>> = new Map();

  /** Currently active plugins: pluginId → current PluginVersion. */
  private activePlugins: Map<string, PluginVersion> = new Map();

  /** Running counters. */
  private _totalUpdates = 0;
  private _totalRollbacks = 0;
  private _totalReloads = 0;
  private _totalSuccesses = 0;
  private _totalAttempts = 0;
  private _totalDurationMs = 0;

  constructor() {
    console.log('[HotPluginManager] Initialized — PHASE OMEGA Hot Updates');
  }

  // ---- Public API ----------------------------------------------------------

  /**
   * Installs a brand new plugin. The manifest must contain at least
   * `id`, `version`, and other standard plugin fields.
   */
  install(pluginId: string, manifest: Record<string, unknown>): HotUpdateResult {
    const start = performance.now();

    // Prevent installing over an existing plugin — use update() instead
    if (this.activePlugins.has(pluginId)) {
      const dur = performance.now() - start;
      this._totalAttempts++;
      console.warn(`[HotPluginManager] Install failed: "${pluginId}" already exists — use update()`);
      return {
        success: false,
        action: 'install',
        pluginId,
        version: String(manifest.version ?? '0.0.0'),
        durationMs: Math.round(dur),
        errors: [`Plugin "${pluginId}" is already installed — use update() to change version`],
      };
    }

    const version = String(manifest.version ?? '0.0.0');
    const checksum = simpleChecksum(JSON.stringify(manifest));
    const installedAt = nowISO();

    const pv: PluginVersion = {
      version,
      installedAt,
      checksum,
      manifestSnapshot: { ...manifest },
    };

    // Record history
    const history = [pv];
    this.versionHistory.set(pluginId, history);
    this.activePlugins.set(pluginId, pv);

    // Remove from pending if it was there
    this.pendingUpdates.delete(pluginId);

    const dur = performance.now() - start;
    this._totalAttempts++;
    this._totalSuccesses++;
    this._totalUpdates++;

    console.log(`[HotPluginManager] Installed "${pluginId}"@${version} in ${Math.round(dur)}ms`);

    return {
      success: true,
      action: 'install',
      pluginId,
      version,
      durationMs: Math.round(dur),
    };
  }

  /**
   * Updates an existing plugin to a new version. The current version is
   * preserved in the version history for potential rollback.
   */
  update(pluginId: string, newManifest: Record<string, unknown>): HotUpdateResult {
    const start = performance.now();

    if (!this.activePlugins.has(pluginId)) {
      const dur = performance.now() - start;
      this._totalAttempts++;
      console.warn(`[HotPluginManager] Update failed: "${pluginId}" is not installed`);
      return {
        success: false,
        action: 'update',
        pluginId,
        version: String(newManifest.version ?? '0.0.0'),
        durationMs: Math.round(dur),
        errors: [`Plugin "${pluginId}" is not installed — use install() first`],
      };
    }

    const version = String(newManifest.version ?? '0.0.0');
    const checksum = simpleChecksum(JSON.stringify(newManifest));
    const installedAt = nowISO();

    const pv: PluginVersion = {
      version,
      installedAt,
      checksum,
      manifestSnapshot: { ...newManifest },
    };

    // Append to history
    const history = this.versionHistory.get(pluginId) ?? [];
    history.push(pv);
    this.versionHistory.set(pluginId, history);
    this.activePlugins.set(pluginId, pv);

    const dur = performance.now() - start;
    this._totalAttempts++;
    this._totalSuccesses++;
    this._totalUpdates++;

    console.log(`[HotPluginManager] Updated "${pluginId}" to ${version} in ${Math.round(dur)}ms`);

    return {
      success: true,
      action: 'update',
      pluginId,
      version,
      durationMs: Math.round(dur),
    };
  }

  /**
   * Applies a small patch to an existing plugin. The patch data is merged
   * into the current manifest and a new version entry is created.
   */
  patch(pluginId: string, patchData: Record<string, unknown>): HotUpdateResult {
    const start = performance.now();

    if (!this.activePlugins.has(pluginId)) {
      const dur = performance.now() - start;
      this._totalAttempts++;
      console.warn(`[HotPluginManager] Patch failed: "${pluginId}" is not installed`);
      return {
        success: false,
        action: 'patch',
        pluginId,
        version: 'unknown',
        durationMs: Math.round(dur),
        errors: [`Plugin "${pluginId}" is not installed`],
      };
    }

    const current = this.activePlugins.get(pluginId)!;

    // Deep-merge patch into current manifest
    const merged: Record<string, unknown> = {
      ...current.manifestSnapshot,
      ...patchData,
      patchedAt: nowISO(),
    };

    // Bump patch version
    const parts = String(merged.version ?? '0.0.0').split('.');
    parts[2] = String(parseInt(parts[2] ?? '0', 10) + 1);
    merged.version = parts.join('.');

    const version = String(merged.version);
    const checksum = simpleChecksum(JSON.stringify(merged));
    const installedAt = nowISO();

    const pv: PluginVersion = {
      version,
      installedAt,
      checksum,
      manifestSnapshot: merged,
    };

    const history = this.versionHistory.get(pluginId) ?? [];
    history.push(pv);
    this.versionHistory.set(pluginId, history);
    this.activePlugins.set(pluginId, pv);

    const dur = performance.now() - start;
    this._totalAttempts++;
    this._totalSuccesses++;
    this._totalUpdates++;

    console.log(`[HotPluginManager] Patched "${pluginId}" to ${version} in ${Math.round(dur)}ms`);

    return {
      success: true,
      action: 'patch',
      pluginId,
      version,
      durationMs: Math.round(dur),
    };
  }

  /**
   * Rolls back a plugin to its previous version from the version history.
   * Requires at least 2 versions in the history.
   */
  rollback(pluginId: string): HotUpdateResult {
    const start = performance.now();

    const history = this.versionHistory.get(pluginId);

    if (!history || history.length < 2) {
      const dur = performance.now() - start;
      this._totalAttempts++;
      console.warn(`[HotPluginManager] Rollback failed: "${pluginId}" has insufficient version history`);
      return {
        success: false,
        action: 'rollback',
        pluginId,
        version: this.activePlugins.get(pluginId)?.version ?? 'unknown',
        durationMs: Math.round(dur),
        errors: [`Plugin "${pluginId}" has no previous version to roll back to`],
      };
    }

    // Remove the current (last) version and activate the previous one
    history.pop();
    const previous = history[history.length - 1]!;

    this.activePlugins.set(pluginId, previous);

    const dur = performance.now() - start;
    this._totalAttempts++;
    this._totalSuccesses++;
    this._totalRollbacks++;

    console.log(
      `[HotPluginManager] Rolled back "${pluginId}" to ${previous.version} in ${Math.round(dur)}ms`
    );

    return {
      success: true,
      action: 'rollback',
      pluginId,
      version: previous.version,
      durationMs: Math.round(dur),
    };
  }

  /**
   * Reloads a plugin without changing its version. Useful for applying
   * configuration changes or resetting internal state.
   */
  reload(pluginId: string): HotUpdateResult {
    const start = performance.now();

    if (!this.activePlugins.has(pluginId)) {
      const dur = performance.now() - start;
      this._totalAttempts++;
      console.warn(`[HotPluginManager] Reload failed: "${pluginId}" is not installed`);
      return {
        success: false,
        action: 'reload',
        pluginId,
        version: 'unknown',
        durationMs: Math.round(dur),
        errors: [`Plugin "${pluginId}" is not installed`],
      };
    }

    const current = this.activePlugins.get(pluginId)!;

    // Create a new version entry with same version but new timestamp
    const pv: PluginVersion = {
      version: current.version,
      installedAt: nowISO(),
      checksum: current.checksum,
      manifestSnapshot: {
        ...current.manifestSnapshot,
        reloadedAt: nowISO(),
      },
    };

    const history = this.versionHistory.get(pluginId) ?? [];
    history.push(pv);
    this.versionHistory.set(pluginId, history);
    this.activePlugins.set(pluginId, pv);

    const dur = performance.now() - start;
    this._totalAttempts++;
    this._totalSuccesses++;
    this._totalReloads++;

    console.log(`[HotPluginManager] Reloaded "${pluginId}"@${current.version} in ${Math.round(dur)}ms`);

    return {
      success: true,
      action: 'reload',
      pluginId,
      version: current.version,
      durationMs: Math.round(dur),
    };
  }

  /** Returns the full version history for a plugin (oldest first). */
  getVersionHistory(pluginId: string): PluginVersion[] {
    return [...(this.versionHistory.get(pluginId) ?? [])];
  }

  /** Returns the currently active version of a plugin, or null. */
  getCurrentVersion(pluginId: string): PluginVersion | null {
    return this.activePlugins.get(pluginId) ?? null;
  }

  /** Returns aggregated statistics about hot update operations. */
  getStats(): HotPluginStats {
    const successRate = this._totalAttempts > 0 ? this._totalSuccesses / this._totalAttempts : 1;
    const avgDurationMs = this._totalAttempts > 0 ? this._totalDurationMs / this._totalAttempts : 0;

    return {
      totalUpdates: this._totalUpdates,
      totalRollbacks: this._totalRollbacks,
      totalReloads: this._totalReloads,
      successRate: Math.round(successRate * 1000) / 1000,
      avgDurationMs: Math.round(avgDurationMs * 100) / 100,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: HotPluginManager | null = null;

/** Returns the singleton HotPluginManager instance. */
export function getHotPluginManager(): HotPluginManager {
  if (!_instance) {
    _instance = new HotPluginManager();
  }
  return _instance;
}

/** Resets the singleton — useful for testing. */
export function resetHotPluginManager(): void {
  _instance = null;
  console.log('[HotPluginManager] Singleton reset');
}