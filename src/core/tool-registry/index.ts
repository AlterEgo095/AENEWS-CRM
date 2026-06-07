// ============================================================
// AENEWS Enterprise OS — Tool Registry
// Central registry where plugins register AI-callable tools.
// Enhanced with rate limiting, caching, audit logging, and
// tenant-scope awareness.
// ============================================================

import type { JSONSchema } from '../plugin-sdk';

// ============================================================
// Rate Limit Configuration
// ============================================================

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Sliding window duration in milliseconds */
  windowMs: number;
}

// ============================================================
// Audit Configuration
// ============================================================

export interface AuditConfig {
  /** Whether audit logging is enabled for this tool */
  enabled: boolean;
  /** Whether to log request parameters */
  logRequest?: boolean;
  /** Whether to log response data */
  logResponse?: boolean;
}

// ============================================================
// Cache Configuration
// ============================================================

export interface CacheConfig {
  /** Whether response caching is enabled */
  enabled: boolean;
  /** Time-to-live for cached responses in milliseconds */
  ttl: number;
  /** Optional custom cache key template (e.g. "tool:{tenantId}:{param1}") */
  key?: string;
}

// ============================================================
// Registered Tool
// ============================================================

export interface RegisteredTool {
  pluginId: string;
  pluginSlug: string;
  pluginName: string;
  name: string;
  description: string;
  /** JSON Schema describing tool parameters */
  parameters: JSONSchema;
  /** The actual execution handler */
  handler: (params: Record<string, unknown>, ctx: any) => Promise<unknown>;
  /** Permission identifiers required to invoke this tool */
  permissions?: string[];
  /** Rate limit configuration (sliding window) */
  rateLimit?: RateLimitConfig;
  /** Whether this tool is tenant-scoped (visibility depends on tenant activation) */
  tenantScope?: boolean;
  /** Audit logging configuration */
  audit?: AuditConfig;
  /** Response caching configuration */
  cache?: CacheConfig;
  /** Semantic version string for this tool (e.g. "1.2.0") */
  version?: string;
}

// ============================================================
// Execution Context
// ============================================================

export interface ToolExecutionContext {
  /** The tenant ID making the request, if applicable */
  tenantId?: string;
  /** Permission identifiers granted to the caller */
  permissions?: string[];
  /** Unique identifier for the caller / session */
  callerId?: string;
  /** Optional arbitrary metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================
// Tool Invocation Result
// ============================================================

export interface ToolInvocationResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
  /** True if the result was served from cache */
  cached?: boolean;
}

// ============================================================
// Audit Log Entry
// ============================================================

export interface AuditLogEntry {
  toolName: string;
  timestamp: Date;
  callerId?: string;
  tenantId?: string;
  success: boolean;
  durationMs: number;
  request?: Record<string, unknown>;
  response?: unknown;
  error?: string;
  cached?: boolean;
}

// ============================================================
// Rate Limit Tracker (sliding window)
// ============================================================

interface RateLimitTracker {
  config: RateLimitConfig;
  timestamps: number[];
}

// ============================================================
// Cache Entry
// ============================================================

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

// ============================================================
// Tool Registry
// ============================================================

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private tenantActivePlugins: Map<string, Set<string>> = new Map();
  private rateLimiters: Map<string, RateLimitTracker> = new Map();
  private cacheStore: Map<string, CacheEntry> = new Map();
  private auditLogs: Map<string, AuditLogEntry[]> = new Map();
  private _initialized = false;

  /**
   * Initialize the registry (e.g., refresh tenant data from DB).
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    // Refresh all known tenants from DB
    try {
      const { db } = await import('@/lib/db');
      const tenants = await db.tenant.findMany({ where: { status: 'active' } });
      for (const tenant of tenants) {
        const activePlugins = await db.installedPlugin.findMany({
          where: { tenantId: tenant.id, status: 'ACTIVE' },
          include: { plugin: { select: { slug: true, name: true } } },
        });
        const set = new Set<string>();
        for (const ip of activePlugins) {
          if (ip.plugin) set.add(ip.plugin.id);
        }
        this.tenantActivePlugins.set(tenant.id, set);
      }
    } catch (error) {
      console.warn('[ToolRegistry] Failed to initialize from DB:', error);
    }
    this._initialized = true;
    console.log(`[ToolRegistry] Initialized with ${this.tools.size} tools`);
  }

  /**
   * Refresh tenant active plugins from DB.
   */
  async refreshTenant(tenantId: string): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const activePlugins = await db.installedPlugin.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { plugin: { select: { slug: true, name: true } } },
      });
      const set = new Set<string>();
      for (const ip of activePlugins) {
        if (ip.plugin) set.add(ip.plugin.id);
      }
      this.tenantActivePlugins.set(tenantId, set);
    } catch (error) {
      console.warn(`[ToolRegistry] Failed to refresh tenant ${tenantId}:`, error);
    }
  }

  // ────────────────────────────────────────────────────────
  // Registration
  // ────────────────────────────────────────────────────────

  /**
   * Register a tool for a plugin with full configuration options.
   */
  register(
    pluginId: string,
    name: string,
    tool: {
      description: string;
      parameters: JSONSchema;
      execute: (params: Record<string, unknown>, ctx: any) => Promise<unknown>;
      permissions?: string[];
      rateLimit?: RateLimitConfig;
      tenantScope?: boolean;
      audit?: AuditConfig;
      cache?: CacheConfig;
      version?: string;
    },
  ): void {
    const qualifiedName = this.qualifyName(pluginId, name);

    if (this.tools.has(qualifiedName)) {
      console.warn(`[ToolRegistry] Tool "${qualifiedName}" is being overwritten.`);
    }

    // Get plugin metadata for pluginSlug/pluginName
    const pluginSlug = pluginId.includes('.') ? pluginId.split('.').pop() || pluginId : pluginId;
    const pluginName = pluginId.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    this.tools.set(qualifiedName, {
      pluginId,
      pluginSlug,
      pluginName,
      name: qualifiedName,
      description: tool.description,
      parameters: tool.parameters,
      handler: tool.execute,
      permissions: tool.permissions,
      rateLimit: tool.rateLimit,
      tenantScope: tool.tenantScope ?? false,
      audit: tool.audit,
      cache: tool.cache,
      version: tool.version,
    });

    // Initialize rate limiter if rate limiting is configured
    if (tool.rateLimit) {
      this.rateLimiters.set(qualifiedName, {
        config: tool.rateLimit,
        timestamps: [],
      });
    }
  }

  /**
   * Unregister a specific tool by name, or all tools for a plugin.
   */
  unregister(pluginId: string, name?: string): void {
    if (name) {
      const qualifiedName = this.qualifyName(pluginId, name);
      this.tools.delete(qualifiedName);
      this.rateLimiters.delete(qualifiedName);
      this._clearToolCache(qualifiedName);
      this.auditLogs.delete(qualifiedName);
    } else {
      for (const [key, tool] of this.tools) {
        if (tool.pluginId === pluginId) {
          this.tools.delete(key);
          this.rateLimiters.delete(key);
          this._clearToolCache(key);
          this.auditLogs.delete(key);
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // Lookups
  // ────────────────────────────────────────────────────────

  /**
   * Get a registered tool by its fully qualified name.
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools.
   */
  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools available for a specific tenant.
   *
   * Only tenant-scoped tools require the plugin to be activated for
   * the tenant.  Non-tenant-scoped (global) tools are always returned.
   */
  getForTenant(tenantId: string): RegisteredTool[] {
    const activePlugins = this.tenantActivePlugins.get(tenantId);

    const result: RegisteredTool[] = [];
    for (const tool of this.tools.values()) {
      if (tool.tenantScope) {
        // Tenant-scoped: only visible if the plugin is active for this tenant
        if (activePlugins && activePlugins.has(tool.pluginId)) {
          result.push(tool);
        }
      } else {
        // Global tool: always visible
        result.push(tool);
      }
    }
    return result;
  }

  /**
   * Check if a tool exists.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get the total number of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Get the total number of tenant-plugin mappings.
   */
  get tenantCount(): number {
    return this.tenantActivePlugins.size;
  }

  /**
   * Get registry statistics.
   */
  getStats(): { size: number; tenants: number } {
    return { size: this.tools.size, tenants: this.tenantActivePlugins.size };
  }

  // ────────────────────────────────────────────────────────
  // Tenant Management
  // ────────────────────────────────────────────────────────

  /**
   * Mark a plugin as active for a tenant.
   */
  activatePluginForTenant(pluginId: string, tenantId: string): void {
    if (!this.tenantActivePlugins.has(tenantId)) {
      this.tenantActivePlugins.set(tenantId, new Set());
    }
    this.tenantActivePlugins.get(tenantId)!.add(pluginId);
  }

  /**
   * Mark a plugin as inactive for a tenant.
   */
  deactivatePluginForTenant(pluginId: string, tenantId: string): void {
    const activePlugins = this.tenantActivePlugins.get(tenantId);
    if (activePlugins) {
      activePlugins.delete(pluginId);
      if (activePlugins.size === 0) {
        this.tenantActivePlugins.delete(tenantId);
      }
    }
  }

  /**
   * Remove all tenant mappings for a plugin.
   */
  removePluginFromAllTenants(pluginId: string): void {
    for (const [tenantId, plugins] of this.tenantActivePlugins) {
      plugins.delete(pluginId);
      if (plugins.size === 0) {
        this.tenantActivePlugins.delete(tenantId);
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // Execution with Middleware
  // ────────────────────────────────────────────────────────

  /**
   * Execute a tool with full middleware pipeline:
   *   1. Rate limit check (sliding window)
   *   2. Permission check
   *   3. Cache read (if enabled and cache hit)
   *   4. Execute handler
   *   5. Cache write (if enabled and cache miss)
   *   6. Audit log (if enabled)
   */
  async executeWithMiddleware(
    toolName: string,
    args: Record<string, unknown>,
    context?: ToolExecutionContext,
  ): Promise<ToolInvocationResult> {
    const start = Date.now();

    // ── Lookup ──
    const tool = this.tools.get(toolName);
    if (!tool) {
      return {
        toolName,
        success: false,
        error: `Tool "${toolName}" is not registered.`,
        durationMs: Date.now() - start,
        cached: false,
      };
    }

    // ── 1. Rate Limit Check ──
    if (tool.rateLimit) {
      const rateError = this._checkRateLimit(toolName, tool.rateLimit);
      if (rateError) {
        return {
          toolName,
          success: false,
          error: rateError,
          durationMs: Date.now() - start,
          cached: false,
        };
      }
    }

    // ── 2. Permission Check ──
    if (tool.permissions && tool.permissions.length > 0) {
      const callerPerms = new Set(context?.permissions ?? []);
      const missing = tool.permissions.filter(p => !callerPerms.has(p));
      if (missing.length > 0) {
        const result: ToolInvocationResult = {
          toolName,
          success: false,
          error: `Permission denied. Missing: ${missing.join(', ')}`,
          durationMs: Date.now() - start,
          cached: false,
        };
        this._recordAudit(tool, result, args, context);
        return result;
      }
    }

    // ── 3. Cache Read ──
    if (tool.cache?.enabled) {
      const cacheKey = this._buildCacheKey(tool, args, context);
      const cached = this.cacheStore.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        const result: ToolInvocationResult = {
          toolName,
          success: true,
          data: cached.data,
          durationMs: Date.now() - start,
          cached: true,
        };
        this._recordAudit(tool, result, args, context);
        return result;
      }
      // Expired entry – clean it up
      if (cached) {
        this.cacheStore.delete(cacheKey);
      }
    }

    // ── 4. Execute Handler ──
    try {
      const data = await tool.handler(args, context);

      const result: ToolInvocationResult = {
        toolName,
        success: true,
        data,
        durationMs: Date.now() - start,
        cached: false,
      };

      // ── 5. Cache Write ──
      if (tool.cache?.enabled) {
        const cacheKey = this._buildCacheKey(tool, args, context);
        this.cacheStore.set(cacheKey, {
          data,
          expiresAt: Date.now() + tool.cache.ttl,
        });
      }

      // ── 6. Audit Log ──
      this._recordAudit(tool, result, args, context);

      return result;
    } catch (err: any) {
      const result: ToolInvocationResult = {
        toolName,
        success: false,
        error: err?.message ?? String(err),
        durationMs: Date.now() - start,
        cached: false,
      };

      this._recordAudit(tool, result, args, context);

      return result;
    }
  }

  // ────────────────────────────────────────────────────────
  // Cache Management
  // ────────────────────────────────────────────────────────

  /**
   * Clear cache entries.
   * If `toolName` is provided, only clears entries for that tool.
   * Otherwise clears the entire cache.
   */
  clearCache(toolName?: string): number {
    if (toolName) {
      return this._clearToolCache(toolName);
    }

    const count = this.cacheStore.size;
    this.cacheStore.clear();
    return count;
  }

  /**
   * Get the number of cached entries (optionally for a specific tool).
   */
  getCacheSize(toolName?: string): number {
    if (!toolName) return this.cacheStore.size;
    let count = 0;
    for (const key of this.cacheStore.keys()) {
      if (key.startsWith(toolName + ':')) count++;
    }
    return count;
  }

  // ────────────────────────────────────────────────────────
  // Rate Limit Management
  // ────────────────────────────────────────────────────────

  /**
   * Reset rate limit counters.
   * If `toolName` is provided, only resets that tool's limiter.
   * Otherwise resets all limiters.
   */
  resetRateLimits(toolName?: string): void {
    if (toolName) {
      const limiter = this.rateLimiters.get(toolName);
      if (limiter) {
        limiter.timestamps = [];
      }
    } else {
      for (const limiter of this.rateLimiters.values()) {
        limiter.timestamps = [];
      }
    }
  }

  // ────────────────────────────────────────────────────────
  // Audit Log
  // ────────────────────────────────────────────────────────

  /**
   * Retrieve audit log entries for a tool.
   * Returns the most recent `limit` entries (default 50).
   */
  getAuditLog(toolName: string, limit: number = 50): AuditLogEntry[] {
    const logs = this.auditLogs.get(toolName);
    if (!logs) return [];
    // Return most recent first
    return logs.slice().reverse().slice(0, limit);
  }

  /**
   * Retrieve all audit log entries across all tools.
   */
  getAllAuditLogs(limit: number = 100): AuditLogEntry[] {
    const all: AuditLogEntry[] = [];
    for (const logs of this.auditLogs.values()) {
      all.push(...logs);
    }
    return all.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
  }

  // ────────────────────────────────────────────────────────
  // Maintenance
  // ────────────────────────────────────────────────────────

  /**
   * Clear all registered tools and tenant mappings.
   */
  clear(): void {
    this.tools.clear();
    this.tenantActivePlugins.clear();
    this.rateLimiters.clear();
    this.cacheStore.clear();
    this.auditLogs.clear();
  }

  // ────────────────────────────────────────────────────────
  // Private Helpers
  // ────────────────────────────────────────────────────────

  /**
   * Construct a fully qualified tool name.
   */
  private qualifyName(pluginId: string, name: string): string {
    if (name.includes(':')) {
      return name;
    }
    return `${pluginId}:${name}`;
  }

  /**
   * Check the sliding-window rate limit for a tool.
   * Returns an error string if the limit is exceeded, or null if allowed.
   */
  private _checkRateLimit(toolName: string, config: RateLimitConfig): string | null {
    let tracker = this.rateLimiters.get(toolName);
    if (!tracker) {
      tracker = { config, timestamps: [] };
      this.rateLimiters.set(toolName, tracker);
    }

    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Prune timestamps outside the sliding window
    tracker.timestamps = tracker.timestamps.filter(ts => ts > windowStart);

    if (tracker.timestamps.length >= config.maxRequests) {
      return `Rate limit exceeded for "${toolName}". Maximum ${config.maxRequests} requests per ${config.windowMs}ms.`;
    }

    // Record this request
    tracker.timestamps.push(now);
    return null;
  }

  /**
   * Build a cache key for a tool invocation.
   * Uses the tool's custom key template if provided, otherwise
   * derives a deterministic key from the tool name + args.
   */
  private _buildCacheKey(
    tool: RegisteredTool,
    args: Record<string, unknown>,
    context?: ToolExecutionContext,
  ): string {
    if (tool.cache?.key) {
      return tool.cache.key
        .replace(/\{toolName\}/g, tool.name)
        .replace(/\{tenantId\}/g, context?.tenantId ?? 'global')
        .replace(/\{callerId\}/g, context?.callerId ?? 'anonymous')
        .replace(/\{(\w+)\}/g, (_, param) => String(args[param] ?? 'undefined'));
    }

    // Deterministic default key
    const argsHash = this._hashArgs(args);
    const tenantSuffix = context?.tenantId ? `:${context.tenantId}` : '';
    return `${tool.name}:${argsHash}${tenantSuffix}`;
  }

  /**
   * Simple deterministic hash of args for cache key generation.
   */
  private _hashArgs(args: Record<string, unknown>): string {
    try {
      // Sort keys for deterministic ordering
      const sorted = JSON.stringify(args, Object.keys(args).sort());
      // Simple hash – not crypto, just for cache key uniqueness
      let hash = 0;
      for (let i = 0; i < sorted.length; i++) {
        const char = sorted.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32-bit int
      }
      return Math.abs(hash).toString(36);
    } catch {
      return '__unhashable__';
    }
  }

  /**
   * Clear cache entries for a specific tool. Returns number of entries removed.
   */
  private _clearToolCache(toolName: string): number {
    let count = 0;
    const prefix = toolName + ':';
    for (const key of this.cacheStore.keys()) {
      if (key.startsWith(prefix)) {
        this.cacheStore.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Record an audit log entry if the tool has auditing enabled.
   */
  private _recordAudit(
    tool: RegisteredTool,
    result: ToolInvocationResult,
    args: Record<string, unknown>,
    context?: ToolExecutionContext,
  ): void {
    if (!tool.audit?.enabled) return;

    const entry: AuditLogEntry = {
      toolName: tool.name,
      timestamp: new Date(),
      callerId: context?.callerId,
      tenantId: context?.tenantId,
      success: result.success,
      durationMs: result.durationMs,
      error: result.error,
      cached: result.cached,
    };

    if (tool.audit.logRequest) {
      entry.request = args;
    }

    if (tool.audit.logResponse && result.success) {
      entry.response = result.data;
    }

    let logs = this.auditLogs.get(tool.name);
    if (!logs) {
      logs = [];
      this.auditLogs.set(tool.name, logs);
    }

    logs.push(entry);

    // Keep audit log bounded to prevent unbounded memory growth
    const MAX_AUDIT_ENTRIES = 10_000;
    if (logs.length > MAX_AUDIT_ENTRIES) {
      this.auditLogs.set(tool.name, logs.slice(-MAX_AUDIT_ENTRIES));
    }
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: ToolRegistry | undefined;

export function getToolRegistry(): ToolRegistry {
  if (!_instance) {
    _instance = new ToolRegistry();
  }
  return _instance;
}
