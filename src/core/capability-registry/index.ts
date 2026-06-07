// ============================================================
// AENEWS Enterprise OS — Capability Registry
// ============================================================
// The bridge between plugins and the AI system.
//
// Plugins register capabilities (search, create, delete, sync, …).
// The AI queries the registry to discover what actions are available,
// then selects and executes the right capability.
//
// Architecture:
//   Plugin → registers capabilities → Capability Registry
//   AI → queries registry → selects capability → executes
//
// This is a singleton-scoped module. Import getCapabilityRegistry()
// from anywhere in the codebase to interact with the registry.
// ============================================================

import type { JSONSchema } from '../plugin-sdk';

// ============================================================
// Capability Type — The taxonomy of actions
// ============================================================

/** All recognized capability types in the AENEWS platform. */
export type CapabilityType =
  | 'search'
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'sync'
  | 'notify'
  | 'analyze'
  | 'export'
  | 'import'
  | 'custom';

/** Valid capability type strings for validation. */
const VALID_CAPABILITY_TYPES: ReadonlySet<CapabilityType> = new Set([
  'search', 'create', 'read', 'update', 'delete',
  'sync', 'notify', 'analyze', 'export', 'import', 'custom',
]);

// ============================================================
// Capability Definition — The core registration unit
// ============================================================

/**
 * A complete capability definition registered by a plugin.
 * Each capability is a single, self-contained action the AI can
 * discover, select, and execute.
 */
export interface CapabilityDefinition {
  /** Unique identifier, e.g. "crm.contacts.search" */
  id: string;

  /** The plugin that owns this capability */
  pluginId: string;

  /** Type of capability from the standard taxonomy */
  type: CapabilityType;

  /** Human-readable name */
  name: string;

  /** Description of what this capability does (used for AI discovery) */
  description: string;

  /** JSON Schema describing the input parameters */
  inputSchema: JSONSchema;

  /** JSON Schema describing the expected output (optional) */
  outputSchema?: JSONSchema;

  /** The handler function that executes the capability */
  handler: (input: any, ctx: any) => Promise<any>;

  /** Required permissions to invoke this capability */
  permissions?: string[];

  /** Rate limiting configuration */
  rateLimit?: {
    /** Maximum number of requests allowed */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
  };

  /** Caching configuration */
  cache?: {
    /** Time-to-live in milliseconds */
    ttl: number;
    /** Cache key template (may reference input fields via {{field}}) */
    key: string;
  };

  /** Capability version (semver) */
  version: string;

  /** Tags for discovery and categorisation */
  tags?: string[];

  /** Example invocations for documentation and AI prompting */
  examples?: Array<{
    input: any;
    output: any;
    description: string;
  }>;
}

// ============================================================
// Execution Result
// ============================================================

/** Result of executing a capability. */
export interface CapabilityExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  durationMs: number;
}

// ============================================================
// Registry Statistics
// ============================================================

/** Aggregate statistics about the registry. */
export interface CapabilityRegistryStats {
  total: number;
  byType: Record<string, number>;
  byPlugin: Record<string, number>;
}

// ============================================================
// Cache Entry (internal)
// ============================================================

interface CacheEntry {
  value: any;
  expiresAt: number;
}

// ============================================================
// Rate Limit Counter (internal)
// ============================================================

interface RateLimitCounter {
  count: number;
  windowStart: number;
}

// ============================================================
// Capability Registry — The central class
// ============================================================

export class CapabilityRegistry {
  // ── Primary store: capabilityId → definition ──
  private capabilities: Map<string, CapabilityDefinition> = new Map();

  // ── Index: pluginId → Set<capabilityId> ──
  private pluginIndex: Map<string, Set<string>> = new Map();

  // ── Index: type → Set<capabilityId> ──
  private typeIndex: Map<CapabilityType, Set<string>> = new Map();

  // ── Cache store ──
  private cacheStore: Map<string, CacheEntry> = new Map();
  private cacheSweepInterval: ReturnType<typeof setInterval> | null = null;

  // ── Rate limit counters ──
  private rateLimitCounters: Map<string, RateLimitCounter> = new Map();
  private rateLimitSweepInterval: ReturnType<typeof setInterval> | null = null;

  // ── Logger ──
  private readonly logPrefix = '[CapabilityRegistry]';

  constructor() {
    this.startBackgroundSweep();
    console.log(`${this.logPrefix} Initialized`);
  }

  // ============================================================
  // REGISTER — Add a new capability
  // ============================================================

  /**
   * Register a new capability definition.
   *
   * @throws {Error} If the capability definition is invalid.
   */
  register(capability: CapabilityDefinition): void {
    this.validateCapability(capability);

    const { id, pluginId, type } = capability;

    // Warn on overwrite
    if (this.capabilities.has(id)) {
      console.warn(
        `${this.logPrefix} Capability "${id}" is being overwritten (was from plugin ` +
        `"${this.capabilities.get(id)!.pluginId}").`
      );
    }

    // Store the capability
    this.capabilities.set(id, capability);

    // Update plugin index
    if (!this.pluginIndex.has(pluginId)) {
      this.pluginIndex.set(pluginId, new Set());
    }
    this.pluginIndex.get(pluginId)!.add(id);

    // Update type index
    if (!this.typeIndex.has(type)) {
      this.typeIndex.set(type, new Set());
    }
    this.typeIndex.get(type)!.add(id);

    console.log(
      `${this.logPrefix} Registered capability "${id}" (plugin: ${pluginId}, type: ${type})`
    );
  }

  // ============================================================
  // UNREGISTER — Remove a single capability by ID
  // ============================================================

  /**
   * Unregister a capability by its unique ID.
   */
  unregister(capabilityId: string): void {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      console.warn(`${this.logPrefix} Cannot unregister "${capabilityId}": not found`);
      return;
    }

    this.removeFromIndices(capability);
    this.capabilities.delete(capabilityId);

    // Clean up associated cache and rate limit state
    this.invalidateCacheForCapability(capabilityId);
    this.rateLimitCounters.delete(capabilityId);

    console.log(`${this.logPrefix} Unregistered capability "${capabilityId}"`);
  }

  // ============================================================
  // UNREGISTER BY PLUGIN — Remove all capabilities for a plugin
  // ============================================================

  /**
   * Remove every capability that belongs to the given plugin.
   * Typically called during plugin unload/uninstall.
   */
  unregisterByPlugin(pluginId: string): void {
    const capabilityIds = this.pluginIndex.get(pluginId);
    if (!capabilityIds || capabilityIds.size === 0) {
      console.debug(`${this.logPrefix} No capabilities registered for plugin "${pluginId}"`);
      return;
    }

    for (const capabilityId of capabilityIds) {
      const capability = this.capabilities.get(capabilityId);
      if (capability) {
        this.removeFromIndices(capability);
        this.capabilities.delete(capabilityId);
        this.invalidateCacheForCapability(capabilityId);
        this.rateLimitCounters.delete(capabilityId);
      }
    }

    this.pluginIndex.delete(pluginId);

    console.log(
      `${this.logPrefix} Unregistered all capabilities for plugin "${pluginId}" ` +
      `(${capabilityIds.size} capabilities removed)`
    );
  }

  // ============================================================
  // GET — Retrieve a single capability
  // ============================================================

  /**
   * Get a capability by its unique ID.
   * Returns `undefined` if not found.
   */
  get(capabilityId: string): CapabilityDefinition | undefined {
    return this.capabilities.get(capabilityId);
  }

  // ============================================================
  // GET ALL — List every registered capability
  // ============================================================

  /**
   * Returns a shallow copy of all registered capabilities.
   */
  getAll(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  // ============================================================
  // GET BY PLUGIN — List capabilities owned by a plugin
  // ============================================================

  /**
   * Get all capabilities registered by a specific plugin.
   */
  getByPlugin(pluginId: string): CapabilityDefinition[] {
    const ids = this.pluginIndex.get(pluginId);
    if (!ids || ids.size === 0) return [];

    const results: CapabilityDefinition[] = [];
    for (const id of ids) {
      const cap = this.capabilities.get(id);
      if (cap) results.push(cap);
    }
    return results;
  }

  // ============================================================
  // GET BY TYPE — List capabilities of a given type
  // ============================================================

  /**
   * Get all capabilities of a specific type (e.g. 'search', 'create').
   */
  getByType(type: CapabilityType): CapabilityDefinition[] {
    const ids = this.typeIndex.get(type);
    if (!ids || ids.size === 0) return [];

    const results: CapabilityDefinition[] = [];
    for (const id of ids) {
      const cap = this.capabilities.get(id);
      if (cap) results.push(cap);
    }
    return results;
  }

  // ============================================================
  // SEARCH — Discover capabilities by text query
  // ============================================================

  /**
   * Search capabilities by matching a text query against name,
   * description, tags, and capability ID.
   *
   * Matching is case-insensitive and scores results by relevance:
   *   - Exact ID match → highest score
   *   - Name starts with query → high score
   *   - Description/tag contains query → lower score
   *
   * Results are sorted by relevance (best match first).
   */
  search(query: string): CapabilityDefinition[] {
    if (!query || query.trim().length === 0) {
      return this.getAll();
    }

    const normalized = query.toLowerCase().trim();
    const words = normalized.split(/\s+/);

    interface Scored {
      capability: CapabilityDefinition;
      score: number;
    }

    const scored: Scored[] = [];

    for (const capability of this.capabilities.values()) {
      let score = 0;

      // Exact ID match — highest relevance
      if (capability.id.toLowerCase() === normalized) {
        score += 1000;
      } else if (capability.id.toLowerCase().includes(normalized)) {
        score += 500;
      }

      // Name matching
      const nameLower = capability.name.toLowerCase();
      if (nameLower === normalized) {
        score += 200;
      } else if (nameLower.startsWith(normalized)) {
        score += 100;
      } else if (nameLower.includes(normalized)) {
        score += 50;
      }

      // Word-level matching in name
      for (const word of words) {
        if (nameLower.includes(word)) {
          score += 20;
        }
      }

      // Description matching
      const descLower = capability.description.toLowerCase();
      for (const word of words) {
        if (descLower.includes(word)) {
          score += 10;
        }
      }

      // Tag matching
      if (capability.tags) {
        for (const tag of capability.tags) {
          if (tag.toLowerCase().includes(normalized)) {
            score += 30;
          }
          for (const word of words) {
            if (tag.toLowerCase().includes(word)) {
              score += 15;
            }
          }
        }
      }

      // Type matching
      if (capability.type.toLowerCase() === normalized) {
        score += 40;
      }

      if (score > 0) {
        scored.push({ capability, score });
      }
    }

    // Sort by score descending, break ties by ID alphabetically
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.capability.id.localeCompare(b.capability.id);
    });

    return scored.map((s) => s.capability);
  }

  // ============================================================
  // GET FOR TENANT — Filter capabilities by active plugins
  // ============================================================

  /**
   * Returns capabilities available for a specific tenant.
   * Only capabilities whose owning plugin is active for the tenant
   * are returned. This requires a DB query to determine active
   * plugins for the tenant.
   */
  async getForTenant(tenantId: string): Promise<CapabilityDefinition[]> {
    try {
      const { db } = await import('@/lib/db');
      const activePlugins = await db.installedPlugin.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { pluginId: true },
      });

      const activePluginIds = new Set(
        activePlugins.map((p: { pluginId: string }) => p.pluginId)
      );

      const results: CapabilityDefinition[] = [];
      for (const capability of this.capabilities.values()) {
        if (activePluginIds.has(capability.pluginId)) {
          results.push(capability);
        }
      }

      return results;
    } catch (error) {
      console.error(
        `${this.logPrefix} Failed to resolve capabilities for tenant "${tenantId}":`,
        error
      );
      return [];
    }
  }

  // ============================================================
  // EXECUTE — Run a capability with full middleware pipeline
  // ============================================================

  /**
   * Execute a capability by ID with the given input and context.
   *
   * The execution pipeline:
   *   1. Look up the capability
   *   2. Check rate limits (if configured)
   *   3. Check cache (if configured)
   *   4. Invoke the handler
   *   5. Store in cache (if configured)
   *   6. Return timed result
   */
  async execute(
    capabilityId: string,
    input: any,
    ctx: any,
  ): Promise<CapabilityExecutionResult> {
    const startTime = Date.now();

    // 1. Look up the capability
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        error: `Capability "${capabilityId}" not found`,
        durationMs,
      };
    }

    // 2. Check rate limits
    if (capability.rateLimit) {
      const rateLimitError = this.checkRateLimit(capabilityId, capability.rateLimit);
      if (rateLimitError) {
        const durationMs = Date.now() - startTime;
        console.warn(
          `${this.logPrefix} Rate limited capability "${capabilityId}": ${rateLimitError}`
        );
        return {
          success: false,
          error: rateLimitError,
          durationMs,
        };
      }
    }

    // 3. Check cache
    if (capability.cache) {
      const cacheKey = this.resolveCacheKey(capability.cache.key, input);
      const cached = this.cacheStore.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        const durationMs = Date.now() - startTime;
        return {
          success: true,
          data: cached.value,
          durationMs,
        };
      }
    }

    // 4. Execute the handler
    try {
      const data = await capability.handler(input, ctx);
      const durationMs = Date.now() - startTime;

      // 5. Store in cache
      if (capability.cache) {
        const cacheKey = this.resolveCacheKey(capability.cache.key, input);
        this.cacheStore.set(cacheKey, {
          value: data,
          expiresAt: Date.now() + capability.cache.ttl,
        });
      }

      return { success: true, data, durationMs };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      console.error(
        `${this.logPrefix} Execution failed for "${capabilityId}": ${errorMessage}`
      );

      return {
        success: false,
        error: errorMessage,
        durationMs,
      };
    }
  }

  // ============================================================
  // GET STATS — Aggregate statistics
  // ============================================================

  /**
   * Returns aggregate statistics about the registry.
   */
  getStats(): CapabilityRegistryStats {
    const byType: Record<string, number> = {};
    const byPlugin: Record<string, number> = {};

    for (const capability of this.capabilities.values()) {
      byType[capability.type] = (byType[capability.type] ?? 0) + 1;
      byPlugin[capability.pluginId] = (byPlugin[capability.pluginId] ?? 0) + 1;
    }

    return {
      total: this.capabilities.size,
      byType,
      byPlugin,
    };
  }

  // ============================================================
  // HAS — Check if a capability exists
  // ============================================================

  has(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId);
  }

  // ============================================================
  // SIZE — Total number of registered capabilities
  // ============================================================

  get size(): number {
    return this.capabilities.size;
  }

  // ============================================================
  // CLEAR — Remove everything
  // ============================================================

  /**
   * Clear all capabilities, indices, cache, and rate limit state.
   * Use with extreme caution — typically only during testing.
   */
  clear(): void {
    this.capabilities.clear();
    this.pluginIndex.clear();
    this.typeIndex.clear();
    this.cacheStore.clear();
    this.rateLimitCounters.clear();
    console.log(`${this.logPrefix} Cleared all state`);
  }

  // ============================================================
  // DESTROY — Clean up resources
  // ============================================================

  /**
   * Stop background sweep timers and clear all state.
   * Call this when shutting down the application.
   */
  destroy(): void {
    if (this.cacheSweepInterval) {
      clearInterval(this.cacheSweepInterval);
      this.cacheSweepInterval = null;
    }
    if (this.rateLimitSweepInterval) {
      clearInterval(this.rateLimitSweepInterval);
      this.rateLimitSweepInterval = null;
    }
    this.clear();
    console.log(`${this.logPrefix} Destroyed`);
  }

  // ============================================================
  // INTERNAL: Validation
  // ============================================================

  /**
   * Validate a capability definition before registration.
   *
   * @throws {Error} If required fields are missing or invalid.
   */
  private validateCapability(capability: CapabilityDefinition): void {
    if (!capability || typeof capability !== 'object') {
      throw new Error('Capability definition must be a non-null object');
    }

    // Required string fields
    const requiredStringFields: Array<keyof CapabilityDefinition> = [
      'id', 'pluginId', 'type', 'name', 'description', 'version',
    ];

    for (const field of requiredStringFields) {
      if (!capability[field] || typeof capability[field] !== 'string') {
        throw new Error(
          `Capability definition missing or invalid required field: "${field}"`
        );
      }
    }

    // inputSchema is required but must be an object (JSON Schema)
    if (!capability.inputSchema || typeof capability.inputSchema !== 'object') {
      throw new Error(
        `Capability definition missing or invalid required field: "inputSchema"`
      );
    }

    // ID format: should be dot-separated, e.g. "crm.contacts.search"
    if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(capability.id)) {
      throw new Error(
        `Capability ID "${capability.id}" must be lowercase alphanumeric ` +
        `with dots, hyphens, or underscores`
      );
    }

    // Valid capability type
    if (!VALID_CAPABILITY_TYPES.has(capability.type)) {
      throw new Error(
        `Invalid capability type "${capability.type}". ` +
        `Must be one of: ${Array.from(VALID_CAPABILITY_TYPES).join(', ')}`
      );
    }

    // Version format (basic semver check)
    if (!/^\d+\.\d+\.\d+/.test(capability.version)) {
      throw new Error(
        `Capability version "${capability.version}" must be valid semver (e.g. "1.0.0")`
      );
    }

    // Handler must be a function
    if (typeof capability.handler !== 'function') {
      throw new Error('Capability handler must be a function');
    }

    // Rate limit validation
    if (capability.rateLimit) {
      const { maxRequests, windowMs } = capability.rateLimit;
      if (
        typeof maxRequests !== 'number' || maxRequests < 1 ||
        typeof windowMs !== 'number' || windowMs < 1
      ) {
        throw new Error(
          'Rate limit must have maxRequests >= 1 and windowMs >= 1'
        );
      }
    }

    // Cache validation
    if (capability.cache) {
      const { ttl, key } = capability.cache;
      if (typeof ttl !== 'number' || ttl < 1) {
        throw new Error('Cache TTL must be a positive number');
      }
      if (typeof key !== 'string' || key.trim().length === 0) {
        throw new Error('Cache key must be a non-empty string');
      }
    }

    // Tags validation
    if (capability.tags) {
      if (!Array.isArray(capability.tags)) {
        throw new Error('Tags must be an array of strings');
      }
      for (const tag of capability.tags) {
        if (typeof tag !== 'string') {
          throw new Error(`Invalid tag: expected string, got ${typeof tag}`);
        }
      }
    }

    // Examples validation
    if (capability.examples) {
      if (!Array.isArray(capability.examples)) {
        throw new Error('Examples must be an array');
      }
      for (const example of capability.examples) {
        if (!example || typeof example !== 'object') {
          throw new Error('Each example must be a non-null object');
        }
        if (!example.description || typeof example.description !== 'string') {
          throw new Error('Each example must have a description string');
        }
      }
    }
  }

  // ============================================================
  // INTERNAL: Index management
  // ============================================================

  /**
   * Remove a capability from the plugin and type indices.
   */
  private removeFromIndices(capability: CapabilityDefinition): void {
    // Plugin index
    const pluginIds = this.pluginIndex.get(capability.pluginId);
    if (pluginIds) {
      pluginIds.delete(capability.id);
      if (pluginIds.size === 0) {
        this.pluginIndex.delete(capability.pluginId);
      }
    }

    // Type index
    const typeIds = this.typeIndex.get(capability.type);
    if (typeIds) {
      typeIds.delete(capability.id);
      if (typeIds.size === 0) {
        this.typeIndex.delete(capability.type);
      }
    }
  }

  // ============================================================
  // INTERNAL: Cache management
  // ============================================================

  /**
   * Build a cache key from the template and input data.
   * Replaces {{field}} placeholders with values from the input.
   */
  private resolveCacheKey(template: string, input: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, field: string) => {
      const value = input?.[field];
      if (value === undefined || value === null) {
        return 'nil';
      }
      return String(value);
    });
  }

  /**
   * Remove all cache entries for a given capability ID prefix.
   */
  private invalidateCacheForCapability(capabilityId: string): void {
    const prefix = `cap:${capabilityId}:`;
    for (const key of this.cacheStore.keys()) {
      if (key.startsWith(prefix)) {
        this.cacheStore.delete(key);
      }
    }
  }

  // ============================================================
  // INTERNAL: Rate limiting
  // ============================================================

  /**
   * Check and update the rate limit counter for a capability.
   * Returns an error message if the rate limit has been exceeded,
   * or null if the request is allowed.
   */
  private checkRateLimit(
    capabilityId: string,
    config: { maxRequests: number; windowMs: number },
  ): string | null {
    const now = Date.now();
    let counter = this.rateLimitCounters.get(capabilityId);

    if (!counter || now - counter.windowStart >= config.windowMs) {
      // Start a new window
      counter = { count: 1, windowStart: now };
      this.rateLimitCounters.set(capabilityId, counter);
      return null;
    }

    counter.count++;

    if (counter.count > config.maxRequests) {
      const retryAfter = Math.ceil(
        (config.windowMs - (now - counter.windowStart)) / 1000
      );
      return `Rate limit exceeded for "${capabilityId}". ` +
        `Max ${config.maxRequests} requests per ${config.windowMs}ms. ` +
        `Retry after ${retryAfter}s.`;
    }

    return null;
  }

  // ============================================================
  // INTERNAL: Background sweep for expired cache and rate limits
  // ============================================================

  /**
   * Start periodic background sweep to clean up expired cache
   * entries and stale rate limit counters.
   */
  private startBackgroundSweep(): void {
    // Sweep every 60 seconds
    const sweepIntervalMs = 60_000;

    this.cacheSweepInterval = setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;

      for (const [key, entry] of this.cacheStore) {
        if (entry.expiresAt <= now) {
          this.cacheStore.delete(key);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        console.debug(
          `${this.logPrefix} Cache sweep: removed ${expiredCount} expired entries ` +
          `(${this.cacheStore.size} remaining)`
        );
      }
    }, sweepIntervalMs);

    this.rateLimitSweepInterval = setInterval(() => {
      const now = Date.now();
      let staleCount = 0;

      // We don't know the windowMs for each counter without looking up
      // the capability, so we sweep counters older than 5 minutes as a
      // conservative heuristic.
      const staleThresholdMs = 5 * 60_000;

      for (const [key, counter] of this.rateLimitCounters) {
        if (now - counter.windowStart >= staleThresholdMs) {
          this.rateLimitCounters.delete(key);
          staleCount++;
        }
      }

      if (staleCount > 0) {
        console.debug(
          `${this.logPrefix} Rate limit sweep: removed ${staleCount} stale counters ` +
          `(${this.rateLimitCounters.size} remaining)`
        );
      }
    }, sweepIntervalMs);

    // Don't prevent process exit
    if (this.cacheSweepInterval.unref) {
      this.cacheSweepInterval.unref();
    }
    if (this.rateLimitSweepInterval.unref) {
      this.rateLimitSweepInterval.unref();
    }
  }
}

// ============================================================
// Singleton — getCapabilityRegistry()
// ============================================================

let _instance: CapabilityRegistry | undefined;

/**
 * Get the singleton CapabilityRegistry instance.
 * Creates the registry on first access.
 */
export function getCapabilityRegistry(): CapabilityRegistry {
  if (!_instance) {
    _instance = new CapabilityRegistry();
  }
  return _instance;
}

/**
 * Reset the singleton instance. Primarily used in testing.
 * Destroys the current instance if one exists.
 */
export function resetCapabilityRegistry(): void {
  if (_instance) {
    _instance.destroy();
    _instance = undefined;
  }
}
