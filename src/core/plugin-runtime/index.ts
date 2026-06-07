// ============================================================
// AENEWS Enterprise OS — Plugin Runtime
// Provides sandboxed execution context for each plugin with
// dependency injection, scoped state, namespaced logging,
// lifecycle management, hot-reload support, and health checks.
// ============================================================

import { db } from '@/lib/db';
import { EventBus as EventBusClass, eventBus, EVENT_TYPES, type EventHandler } from '@/lib/event-bus';
import type { PrismaClient } from '@prisma/client';
import { EventStore } from '../event-store';
import { ToolRegistry } from '../tool-registry';
import type { PluginManifest, PluginSetting } from '../plugin-sdk';

// ============================================================
// Types & Interfaces
// ============================================================

/** Status of a plugin within the runtime */
export type PluginStatus = 'starting' | 'running' | 'stopped' | 'error' | 'disposing';

/** Configuration for the PluginRuntime constructor */
export interface PluginRuntimeConfig {
  toolRegistry: ToolRegistry;
  eventBus: typeof eventBus;
  eventStore?: EventStore;
  capabilityRegistry?: CapabilityRegistry;
  uiRegistry?: UIRegistry;
  searchEngine?: SearchEngine;
  settingsEngine?: SettingsEngine;
  storageEngine?: StorageEngine;
  /** Default tenant ID to use when not specified (optional) */
  defaultTenantId?: string;
}

/**
 * CapabilityRegistry — optional service for registering plugin capabilities.
 * Injected into the container when available.
 */
export interface CapabilityRegistry {
  register(pluginId: string, capability: {
    type: string;
    name: string;
    description: string;
  }): void;
  unregister(pluginId: string, name: string): void;
  getByPlugin(pluginId: string): Array<{ type: string; name: string; description: string }>;
}

/**
 * UIRegistry — optional service for registering plugin UI extensions
 * (menu items, widgets, views, etc.).
 */
export interface UIRegistry {
  registerMenuItem(pluginId: string, item: {
    id: string;
    label: string;
    icon?: string;
    href?: string;
    section?: string;
    order?: number;
    parentId?: string;
    permission?: string;
  }): void;
  unregisterMenuItem(pluginId: string, itemId: string): void;
  getMenuItems(): Array<{ pluginId: string; id: string; label: string }>;
  registerView(pluginId: string, view: {
    id: string;
    path: string;
    component?: string;
    permission?: string;
  }): void;
  unregisterView(pluginId: string, viewId: string): void;
}

/**
 * SearchEngine — optional service for plugin-driven global search.
 */
export interface SearchEngine {
  registerEntity(pluginId: string, entity: {
    name: string;
    handler: (query: string, tenantId: string) => Promise<Array<{
      id: string;
      title: string;
      description: string;
      href: string;
      metadata?: Record<string, unknown>;
    }>>;
  }): void;
  unregisterEntity(pluginId: string, name: string): void;
}

/**
 * SettingsEngine — optional service for reading/writing tenant-scoped plugin settings.
 */
export interface SettingsEngine {
  getPluginSettings(tenantId: string, pluginId: string): Promise<Record<string, unknown>>;
  updatePluginSettings(
    tenantId: string,
    pluginId: string,
    settings: Record<string, unknown>,
  ): Promise<void>;
}

/**
 * StorageEngine — optional service for plugin-scoped file/blob storage.
 */
export interface StorageEngine {
  put(pluginId: string, key: string, data: Buffer | string, meta?: Record<string, unknown>): Promise<string>;
  get(pluginId: string, key: string): Promise<Buffer | string | null>;
  delete(pluginId: string, key: string): Promise<void>;
  list(pluginId: string, prefix?: string): Promise<Array<{ key: string; size: number; createdAt: Date }>>;
}

/** Scoped logger namespaced with the plugin's slug */
export interface PluginScopedLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  child(suffix: string): PluginScopedLogger;
}

/** Internal record for each plugin tracked by the runtime */
export interface PluginRuntimeEntry {
  pluginId: string;
  tenantId: string;
  status: PluginStatus;
  context: PluginRuntimeContext;
  container: PluginContainer;
  startedAt: Date;
  lastActiveAt: Date;
  executionCount: number;
  errorCount: number;
  lastError?: Error;
  unsubscribers: Array<() => void>;
  /** In-memory plugin-scoped state (not persisted) */
  state: Map<string, unknown>;
  /** Merged settings: manifest defaults + tenant overrides */
  settings: Record<string, unknown>;
}

// ============================================================
// PluginScopedLogger — Implementation
// ============================================================

class ScopedLogger implements PluginScopedLogger {
  constructor(
    private readonly namespace: string,
    private readonly prefix: string = '',
  ) {}

  private format(message: string): string {
    return `[${this.prefix}${this.namespace}] ${message}`;
  }

  info(message: string, ...args: unknown[]): void {
    console.info(this.format(message), ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.format(message), ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(this.format(message), ...args);
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG?.includes(this.namespace)) {
      console.debug(this.format(message), ...args);
    }
  }

  child(suffix: string): PluginScopedLogger {
    return new ScopedLogger(this.namespace, `${this.prefix}${suffix}:`);
  }
}

// ============================================================
// PluginRuntimeContext — Per-plugin isolated context
// ============================================================

export class PluginRuntimeContext {
  private readonly _state: Map<string, unknown>;

  constructor(
    public readonly pluginId: string,
    public readonly tenantId: string,
    public readonly manifest: PluginManifest,
    public readonly logger: PluginScopedLogger,
    public readonly db: PrismaClient,
    public readonly eventBus: EventBusClass,
    public readonly toolRegistry: ToolRegistry,
    private readonly _settings: Record<string, unknown>,
    public readonly container: PluginContainer,
    private readonly _entry: PluginRuntimeEntry,
    public readonly capabilityRegistry?: CapabilityRegistry,
    public readonly uiRegistry?: UIRegistry,
    public readonly eventStore?: EventStore,
    public readonly searchEngine?: SearchEngine,
    public readonly settingsEngine?: SettingsEngine,
    public readonly storageEngine?: StorageEngine,
  ) {
    this._state = _entry.state;
  }

  // ── State Management ──────────────────────────────────────

  /** Get a value from the plugin's scoped in-memory state. */
  getState<T = unknown>(key: string): T | undefined {
    return this._state.get(key) as T | undefined;
  }

  /** Set a value in the plugin's scoped in-memory state. */
  setState(key: string, value: unknown): void {
    if (value === undefined) {
      this._state.delete(key);
    } else {
      this._state.set(key, value);
    }
  }

  /** Get all plugin-scoped state as a shallow copy. */
  getAllState(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [k, v] of this._state) {
      result[k] = v;
    }
    return result;
  }

  // ── Settings ───────────────────────────────────────────────

  /** Get the fully-merged plugin settings (manifest defaults + tenant overrides). */
  getSettings(): Readonly<Record<string, unknown>> {
    return this._settings;
  }

  /** Convenience: get a single setting value. */
  getSetting<T = unknown>(key: string): T | undefined {
    return this._settings[key] as T | undefined;
  }

  /** Convenience: get a single setting value with a fallback. */
  getSettingOrDefault<T>(key: string, defaultValue: T): T {
    const val = this._settings[key];
    return val !== undefined ? (val as T) : defaultValue;
  }

  // ── Event Emission ─────────────────────────────────────────

  /**
   * Emit a namespaced event through the event bus.
   * Automatically prefixes the event type with `plugin.{slug}.` for isolation.
   */
  async emit(event: string, payload?: unknown): Promise<void> {
    const namespacedEvent = `plugin.${this.manifest.slug}.${event}`;
    await this.eventBus.emit(namespacedEvent, payload);

    // Persist to event store if available
    if (this.eventStore) {
      try {
        await this.eventStore.persist({
          tenantId: this.tenantId,
          eventType: namespacedEvent,
          payload,
          sourcePlugin: this.pluginId,
        });
      } catch (err) {
        this.logger.warn(`Failed to persist event "${namespacedEvent}":`, err);
      }
    }
  }

  /** Emit a system-level (non-namespaced) event. */
  async emitSystem(event: string, payload?: unknown): Promise<void> {
    await this.eventBus.emit(event, payload);

    if (this.eventStore) {
      try {
        await this.eventStore.persist({
          tenantId: this.tenantId,
          eventType: event,
          payload,
          sourcePlugin: this.pluginId,
        });
      } catch (err) {
        this.logger.warn(`Failed to persist system event "${event}":`, err);
      }
    }
  }

  // ── Utility ────────────────────────────────────────────────

  /** Get the unique slug from the manifest. */
  get slug(): string {
    return this.manifest.slug;
  }

  /** Get the current status of this plugin's runtime entry. */
  get status(): PluginStatus {
    return this._entry.status;
  }

  /** Record a timestamp for the last activity (called by runtime after each execution). */
  touch(): void {
    this._entry.lastActiveAt = new Date();
  }
}

// ============================================================
// PluginContainer — Dependency injection container
// ============================================================

/** Factory function type for DI resolution */
export type ServiceFactory<T = unknown> = (
  container: PluginContainer,
) => T | Promise<T>;

export class PluginContainer {
  private readonly factories: Map<string, ServiceFactory> = new Map();
  private readonly instances: Map<string, unknown> = new Map();
  private readonly singletons: Set<string> = new Set();
  private _disposed = false;

  /**
   * Register a service factory in this container.
   *
   * @param key      - Service identifier (e.g. 'db', 'eventBus')
   * @param factory  - Factory function that produces the service instance
   * @param singleton - If true, the factory is invoked once and cached
   */
  register<T = unknown>(
    key: string,
    factory: ServiceFactory<T>,
    singleton: boolean = true,
  ): void {
    if (this._disposed) {
      throw new Error(`[PluginContainer] Cannot register "${key}" — container is disposed.`);
    }

    if (this.factories.has(key)) {
      console.warn(`[PluginContainer] Service "${key}" is being overwritten.`);
    }

    this.factories.set(key, factory as ServiceFactory);
    if (singleton) {
      this.singletons.add(key);
    }
  }

  /**
   * Register a pre-constructed instance directly.
   */
  registerInstance(key: string, instance: unknown): void {
    if (this._disposed) {
      throw new Error(`[PluginContainer] Cannot register "${key}" — container is disposed.`);
    }

    this.instances.set(key, instance);
    this.singletons.add(key);
    // Remove any existing factory so it won't be called
    this.factories.delete(key);
  }

  /**
   * Resolve a service instance by key.
   * For singletons, the cached instance is returned after first resolution.
   */
  async resolve<T = unknown>(key: string): Promise<T> {
    if (this._disposed) {
      throw new Error(`[PluginContainer] Cannot resolve "${key}" — container is disposed.`);
    }

    // Check for existing singleton
    if (this.singletons.has(key) && this.instances.has(key)) {
      return this.instances.get(key) as T;
    }

    // Find factory
    const factory = this.factories.get(key);
    if (!factory) {
      throw new Error(
        `[PluginContainer] Service "${key}" is not registered. ` +
        `Available: ${Array.from(this.factories.keys()).join(', ')}`,
      );
    }

    // Invoke factory
    const instance = await factory(this);
    if (this.singletons.has(key)) {
      this.instances.set(key, instance);
    }
    return instance as T;
  }

  /**
   * Check if a service is registered (either as a factory or an instance).
   */
  has(key: string): boolean {
    return this.factories.has(key) || this.instances.has(key);
  }

  /**
   * Get a previously resolved instance synchronously (throws if not resolved yet).
   * Useful for built-in services that are pre-registered as instances.
   */
  getSync<T = unknown>(key: string): T {
    if (this.instances.has(key)) {
      return this.instances.get(key) as T;
    }
    throw new Error(
      `[PluginContainer] Instance "${key}" has not been resolved yet. Use resolve() instead.`,
    );
  }

  /** List all registered service keys. */
  getRegisteredKeys(): string[] {
    const keys = new Set([...this.factories.keys(), ...this.instances.keys()]);
    return Array.from(keys);
  }

  /**
   * Dispose all resolved instances that implement Disposable
   * and clean up the container state.
   */
  async dispose(): Promise<void> {
    if (this._disposed) return;
    this._disposed = true;

    // Dispose any instances that have a dispose method
    for (const [key, instance] of this.instances) {
      try {
        if (instance && typeof instance === 'object' && 'dispose' in instance) {
          await (instance as { dispose(): Promise<void> }).dispose();
        }
      } catch (err) {
        console.warn(`[PluginContainer] Error disposing service "${key}":`, err);
      }
    }

    this.instances.clear();
    this.factories.clear();
    this.singletons.clear();
  }

  /** Whether the container has been disposed. */
  get disposed(): boolean {
    return this._disposed;
  }
}

// ============================================================
// PluginRuntime — Main orchestrator
// ============================================================

export class PluginRuntime {
  private readonly config: PluginRuntimeConfig;
  private readonly entries: Map<string, PluginRuntimeEntry> = new Map();
  private readonly startedAt: Date;
  private _globalDisposed = false;

  // Built-in service keys
  static readonly BUILTIN_SERVICES = [
    'db',
    'eventBus',
    'eventStore',
    'toolRegistry',
    'capabilityRegistry',
    'uiRegistry',
    'searchEngine',
    'settingsEngine',
    'storageEngine',
    'container',
    'context',
  ] as const;

  constructor(config: PluginRuntimeConfig) {
    this.config = config;
    this.startedAt = new Date();
    console.info('[PluginRuntime] Initialized with tool registry, event bus, and optional services.');
  }

  // ============================================================
  // START — Create and initialize a plugin's runtime context
  // ============================================================

  /**
   * Start a plugin's runtime context.
   * Creates an isolated container, merges settings, sets up the context,
   * and marks the plugin as running.
   */
  async start(
    pluginId: string,
    options?: {
      tenantId?: string;
      manifest?: PluginManifest;
    },
  ): Promise<PluginRuntimeContext> {
    if (this._globalDisposed) {
      throw new Error('[PluginRuntime] Cannot start plugin — runtime is disposed.');
    }

    // If already running, return existing context
    const existing = this.entries.get(pluginId);
    if (existing && existing.status === 'running') {
      return existing.context;
    }

    // If in error/stopped state, clean up first
    if (existing && (existing.status === 'error' || existing.status === 'stopped')) {
      await this.internalCleanup(pluginId);
    }

    const tenantId = options?.tenantId ?? this.config.defaultTenantId ?? 'default';

    // Fetch manifest if not provided
    const manifest = options?.manifest ?? (await this.loadManifest(pluginId));
    if (!manifest) {
      throw new Error(`[PluginRuntime] Cannot find manifest for plugin "${pluginId}".`);
    }

    // Create scoped logger
    const logger = new ScopedLogger(`plugin:${manifest.slug}`);

    logger.info(`Starting plugin "${pluginId}" (v${manifest.version})...`);

    // Create entry placeholder
    const entry: PluginRuntimeEntry = {
      pluginId,
      tenantId,
      status: 'starting',
      context: null as unknown as PluginRuntimeContext,
      container: null as unknown as PluginContainer,
      startedAt: new Date(),
      lastActiveAt: new Date(),
      executionCount: 0,
      errorCount: 0,
      unsubscribers: [],
      state: new Map(),
      settings: {},
    };

    this.entries.set(pluginId, entry);

    try {
      // Merge settings: manifest defaults + tenant overrides from DB
      const settings = await this.mergeSettings(tenantId, manifest);

      // Create DI container with built-in services
      const container = this.createContainer(entry, manifest, logger, settings);

      // Create context
      const context = new PluginRuntimeContext(
        pluginId,
        tenantId,
        manifest,
        logger,
        db,
        this.config.eventBus,
        this.config.toolRegistry,
        settings,
        container,
        entry,
        this.config.capabilityRegistry,
        this.config.uiRegistry,
        this.config.eventStore,
        this.config.searchEngine,
        this.config.settingsEngine,
        this.config.storageEngine,
      );

      // Wire up the context reference in the container (circular for 'context' resolution)
      container.registerInstance('context', context);

      // Update entry
      entry.context = context;
      entry.container = container;
      entry.settings = settings;
      entry.status = 'running';
      entry.lastActiveAt = new Date();

      // Emit system event
      await this.config.eventBus.emit(EVENT_TYPES.PLUGIN_ACTIVATED, {
        pluginId,
        tenantId,
        version: manifest.version,
      });

      logger.info(`Plugin "${pluginId}" is now running.`);

      return context;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      entry.status = 'error';
      entry.errorCount++;
      entry.lastError = error instanceof Error ? error : new Error(errorMsg);

      const logger = new ScopedLogger(`plugin:${manifest.slug}`);
      logger.error(`Failed to start plugin "${pluginId}": ${errorMsg}`, error);

      // Clean up partial state
      await this.internalCleanup(pluginId);

      throw new Error(`[PluginRuntime] Failed to start plugin "${pluginId}": ${errorMsg}`);
    }
  }

  // ============================================================
  // EXECUTE — Run plugin code inside the sandboxed context
  // ============================================================

  /**
   * Execute a function within a plugin's isolated runtime context.
   * Ensures the plugin is running, wraps the call in error handling,
   * and tracks execution metrics.
   */
  async execute<T>(
    pluginId: string,
    fn: (ctx: PluginRuntimeContext) => Promise<T>,
  ): Promise<T> {
    const entry = this.entries.get(pluginId);

    if (!entry) {
      throw new Error(
        `[PluginRuntime] Plugin "${pluginId}" is not registered. Call start() first.`,
      );
    }

    if (entry.status === 'disposing' || entry.status === 'stopped') {
      throw new Error(
        `[PluginRuntime] Plugin "${pluginId}" is ${entry.status} and cannot execute.`,
      );
    }

    if (entry.status === 'error') {
      throw new Error(
        `[PluginRuntime] Plugin "${pluginId}" is in error state. Call reload() or start() first.`,
      );
    }

    if (entry.status === 'starting') {
      // Allow execution during start phase (for onActivate hooks etc.)
      entry.context.logger.debug(`Executing during start phase for "${pluginId}".`);
    }

    entry.executionCount++;
    entry.lastActiveAt = new Date();

    const startTime = Date.now();

    try {
      const result = await fn(entry.context);

      const durationMs = Date.now() - startTime;
      entry.context.logger.debug(
        `Execution completed in ${durationMs}ms (count: ${entry.executionCount})`,
      );

      return result;
    } catch (error) {
      entry.errorCount++;
      entry.lastError = error instanceof Error ? error : new Error(String(error));

      const errorMsg = error instanceof Error ? error.message : String(error);
      entry.context.logger.error(`Execution failed: ${errorMsg}`, error);

      throw error;
    }
  }

  // ============================================================
  // DISPOSE — Clean up a single plugin's resources
  // ============================================================

  /**
   * Dispose of a single plugin's runtime context, container,
   * event subscriptions, and in-memory state.
   */
  async dispose(pluginId: string): Promise<void> {
    const entry = this.entries.get(pluginId);
    if (!entry) {
      return; // Already disposed or never started
    }

    entry.status = 'disposing';
    const logger = entry.context?.logger ?? new ScopedLogger(`plugin:${pluginId}`);

    logger.info(`Disposing plugin "${pluginId}"...`);

    try {
      await this.internalCleanup(pluginId);

      // Emit system event
      await this.config.eventBus.emit(EVENT_TYPES.PLUGIN_DEACTIVATED, {
        pluginId: entry.pluginId,
        tenantId: entry.tenantId,
      });

      // Mark as stopped (remove entry so it can be re-started fresh)
      this.entries.delete(pluginId);

      logger.info(`Plugin "${pluginId}" disposed successfully.`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Error disposing plugin "${pluginId}": ${errorMsg}`, error);
      // Force-remove even on error to avoid stuck state
      this.entries.delete(pluginId);
    }
  }

  // ============================================================
  // DISPOSE ALL — Clean up every plugin
  // ============================================================

  /**
   * Dispose all active plugin contexts in parallel.
   * Used during graceful shutdown.
   */
  async disposeAll(): Promise<void> {
    if (this._globalDisposed) return;
    this._globalDisposed = true;

    const pluginIds = Array.from(this.entries.keys());
    if (pluginIds.length === 0) {
      console.info('[PluginRuntime] No plugins to dispose.');
      return;
    }

    console.info(`[PluginRuntime] Disposing ${pluginIds.length} plugin(s)...`);

    // Dispose all in parallel for speed
    const results = await Promise.allSettled(
      pluginIds.map((id) => this.dispose(id)),
    );

    // Log any failures
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'rejected') {
        console.warn(
          `[PluginRuntime] Error disposing plugin "${pluginIds[i]}":`,
          (results[i] as PromiseRejectedResult).reason,
        );
      }
    }

    console.info('[PluginRuntime] All plugins disposed.');
  }

  // ============================================================
  // RELOAD — Hot-reload a plugin
  // ============================================================

  /**
   * Reload a plugin: dispose its current context, then re-start it.
   * Useful for hot-reload during development or after config changes.
   */
  async reload(pluginId: string): Promise<PluginRuntimeContext> {
    const entry = this.entries.get(pluginId);
    const logger = entry?.context?.logger ?? new ScopedLogger(`plugin:${pluginId}`);

    logger.info(`Reloading plugin "${pluginId}"...`);

    // Save current state for restoration
    const savedState = entry?.state ? new Map(entry.state) : new Map<string, unknown>();

    // Dispose existing context
    await this.dispose(pluginId);

    // Re-start
    const newContext = await this.start(pluginId, {
      tenantId: entry?.tenantId,
    });

    // Restore state
    if (savedState.size > 0) {
      for (const [key, value] of savedState) {
        newContext.setState(key, value);
      }
      logger.debug(`Restored ${savedState.size} state entries after reload.`);
    }

    logger.info(`Plugin "${pluginId}" reloaded successfully.`);
    return newContext;
  }

  // ============================================================
  // GETTERS
  // ============================================================

  /** Get the runtime context for a plugin, or undefined if not running. */
  getContext(pluginId: string): PluginRuntimeContext | undefined {
    const entry = this.entries.get(pluginId);
    if (!entry || entry.status !== 'running') {
      return undefined;
    }
    return entry.context;
  }

  /** Get all active plugin runtime contexts. */
  getAllContexts(): Map<string, PluginRuntimeContext> {
    const result = new Map<string, PluginRuntimeContext>();
    for (const [pluginId, entry] of this.entries) {
      if (entry.status === 'running' || entry.status === 'starting') {
        result.set(pluginId, entry.context);
      }
    }
    return result;
  }

  /**
   * Get runtime statistics.
   */
  getStats(): {
    activePlugins: number;
    totalMemory: number;
    uptime: number;
    totalExecutions: number;
    totalErrors: number;
  } {
    let totalExecutions = 0;
    let totalErrors = 0;

    for (const entry of this.entries.values()) {
      totalExecutions += entry.executionCount;
      totalErrors += entry.errorCount;
    }

    return {
      activePlugins: this.entries.size,
      // Estimate memory usage from state entries + container instances
      totalMemory: this.estimateMemoryUsage(),
      uptime: Date.now() - this.startedAt.getTime(),
      totalExecutions,
      totalErrors,
    };
  }

  /**
   * Health check for the runtime and all plugins.
   */
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    plugins: Record<string, 'running' | 'starting' | 'stopped' | 'error'>;
    uptime: number;
    activePlugins: number;
  } {
    const plugins: Record<string, 'running' | 'starting' | 'stopped' | 'error'> = {};
    let hasErrors = false;

    for (const [pluginId, entry] of this.entries) {
      plugins[pluginId] = entry.status === 'disposing' ? 'stopped' : entry.status;
      if (entry.status === 'error') {
        hasErrors = true;
      }
    }

    const activeCount = Object.values(plugins).filter((s) => s === 'running' || s === 'starting').length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (this._globalDisposed) {
      status = 'unhealthy';
    } else if (hasErrors) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      status,
      plugins,
      uptime: Date.now() - this.startedAt.getTime(),
      activePlugins: activeCount,
    };
  }

  /** Whether the runtime itself has been disposed. */
  get disposed(): boolean {
    return this._globalDisposed;
  }

  // ============================================================
  // INTERNAL — Helpers
  // ============================================================

  /**
   * Load a plugin manifest from the database by plugin ID.
   * Falls back to the plugin table which stores manifest-level data.
   */
  private async loadManifest(pluginId: string): Promise<PluginManifest | null> {
    try {
      const plugin = await db.plugin.findUnique({
        where: { id: pluginId },
      });

      if (!plugin) {
        // Try by slug
        const bySlug = await db.plugin.findUnique({
          where: { slug: pluginId },
        });
        if (!bySlug) return null;

        return this.dbRecordToManifest(bySlug);
      }

      return this.dbRecordToManifest(plugin);
    } catch (error) {
      console.warn(`[PluginRuntime] Error loading manifest for "${pluginId}":`, error);
      return null;
    }
  }

  /**
   * Convert a Plugin DB record into a PluginManifest shape.
   * The DB stores capabilities and settings as JSON strings.
   */
  private dbRecordToManifest(record: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    version: string;
    author: string | null;
    capabilities: string;
    settings: string;
    category: string;
  }): PluginManifest {
    let capabilities: PluginManifest['capabilities'] = [];
    try {
      capabilities = JSON.parse(record.capabilities || '[]');
    } catch {
      // ignore parse errors
    }

    let settings: PluginSetting[] = [];
    try {
      const parsed = JSON.parse(record.settings || '{}');
      if (Array.isArray(parsed)) {
        settings = parsed;
      }
    } catch {
      // ignore parse errors
    }

    return {
      aenews: '1',
      id: record.id,
      name: record.name,
      slug: record.slug,
      version: record.version,
      description: record.description || '',
      author: record.author || '',
      license: '',
      coreVersion: '1.0.0',
      capabilities,
      entry: { server: '' },
      settings: settings.length > 0 ? settings : undefined,
    };
  }

  /**
   * Merge manifest default settings with tenant-level overrides from DB.
   * Tenant overrides take precedence over manifest defaults.
   */
  private async mergeSettings(
    tenantId: string,
    manifest: PluginManifest,
  ): Promise<Record<string, unknown>> {
    // Start with manifest defaults
    const merged: Record<string, unknown> = {};
    if (manifest.settings) {
      for (const setting of manifest.settings) {
        merged[setting.key] = setting.defaultValue;
      }
    }

    // Apply tenant overrides from InstalledPlugin record
    try {
      const installed = await db.installedPlugin.findUnique({
        where: { tenantId_pluginId: { tenantId, pluginId: manifest.id } },
      });

      if (installed?.settings) {
        const overrides: Record<string, unknown> = JSON.parse(installed.settings);
        for (const [key, value] of Object.entries(overrides)) {
          if (value !== undefined && value !== null) {
            merged[key] = value;
          }
        }
      }
    } catch (error) {
      console.warn(
        `[PluginRuntime] Failed to load tenant overrides for "${manifest.id}":`,
        error,
      );
    }

    return merged;
  }

  /**
   * Create a DI container pre-loaded with all built-in services.
   */
  private createContainer(
    entry: PluginRuntimeEntry,
    manifest: PluginManifest,
    logger: PluginScopedLogger,
    settings: Record<string, unknown>,
  ): PluginContainer {
    const container = new PluginContainer();

    // Register all built-in services as pre-constructed instances
    container.registerInstance('db', db);
    container.registerInstance('eventBus', this.config.eventBus);
    container.registerInstance('toolRegistry', this.config.toolRegistry);
    container.registerInstance('manifest', manifest);
    container.registerInstance('settings', settings);
    container.registerInstance('logger', logger);
    container.registerInstance('state', entry.state);

    // Register optional services (only if available)
    if (this.config.eventStore) {
      container.registerInstance('eventStore', this.config.eventStore);
    }
    if (this.config.capabilityRegistry) {
      container.registerInstance('capabilityRegistry', this.config.capabilityRegistry);
    }
    if (this.config.uiRegistry) {
      container.registerInstance('uiRegistry', this.config.uiRegistry);
    }
    if (this.config.searchEngine) {
      container.registerInstance('searchEngine', this.config.searchEngine);
    }
    if (this.config.settingsEngine) {
      container.registerInstance('settingsEngine', this.config.settingsEngine);
    }
    if (this.config.storageEngine) {
      container.registerInstance('storageEngine', this.config.storageEngine);
    }

    // Register lazy factories for commonly-requested derived services
    container.register('pluginTools', async () => {
      return this.config.toolRegistry.getAll().filter(
        (t) => t.pluginId === manifest.id,
      );
    });

    // Placeholder for 'context' — will be set after context creation
    container.registerInstance('context', null);

    return container;
  }

  /**
   * Internal cleanup: dispose container, unsubscribe events, clear state.
   */
  private async internalCleanup(pluginId: string): Promise<void> {
    const entry = this.entries.get(pluginId);
    if (!entry) return;

    // Unsubscribe all event handlers registered by this plugin
    for (const unsub of entry.unsubscribers) {
      try {
        unsub();
      } catch (err) {
        // Ignore unsubscribe errors
      }
    }
    entry.unsubscribers = [];

    // Dispose the DI container
    if (entry.container && !entry.container.disposed) {
      try {
        await entry.container.dispose();
      } catch (err) {
        console.warn(
          `[PluginRuntime] Error disposing container for "${pluginId}":`,
          err,
        );
      }
    }

    // Clear in-memory state
    entry.state.clear();
  }

  /**
   * Rough memory usage estimate from in-memory state and container instances.
   */
  private estimateMemoryUsage(): number {
    let bytes = 0;

    for (const entry of this.entries.values()) {
      // Estimate state size
      for (const [, value] of entry.state) {
        bytes += this.estimateObjectSize(value);
      }
    }

    return bytes;
  }

  /**
   * Rough JSON-based size estimation for an object.
   */
  private estimateObjectSize(obj: unknown): number {
    try {
      return JSON.stringify(obj).length * 2; // UTF-16 = 2 bytes per char
    } catch {
      return 0;
    }
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: PluginRuntime | undefined;

/**
 * Get the global PluginRuntime singleton.
 * Creates one with the given config if it doesn't exist yet.
 */
export function getPluginRuntime(config: PluginRuntimeConfig): PluginRuntime {
  if (!_instance) {
    _instance = new PluginRuntime(config);
  }
  return _instance;
}

/**
 * Check if the global PluginRuntime singleton has been created.
 */
export function hasPluginRuntime(): boolean {
  return _instance !== undefined;
}

/**
 * Reset the global PluginRuntime singleton.
 * Intended for testing purposes only.
 */
export function resetPluginRuntime(): void {
  if (_instance) {
    console.warn('[PluginRuntime] Resetting global singleton.');
    _instance = undefined;
  }
}


