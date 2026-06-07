// ============================================================
// AENEWS Plugin SDK v1.0
// ============================================================
// The primary entry point for building AENEWS plugins.
//
// Usage:
//   import { definePlugin } from '@/core/plugin-sdk';
//
//   export default definePlugin({
//     manifest,
//     onInstall: async (ctx) => { ... },
//     tools: { ... },
//     events: { ... },
//   });
//
// This module is designed to be imported by external plugin
// developers as well as internal AENEWS core modules.
// ============================================================

// ─── Re-export all manifest types for convenience ───────────

export type {
  PluginManifest,
  PluginCapability,
  PluginDependency,
  PluginMigration,
  PluginPermission,
  PluginSetting,
  PluginMenu,
  PluginEventDef,
  PluginSearchConfig,
  PluginRoute,
  JSONSchema,
  ManifestValidationResult,
} from './manifest';

export {
  validateManifest,
  compareVersions,
  satisfiesVersionRange,
} from './manifest';

// ============================================================
// Plugin Server Module — shape of a loaded plugin's server entry
// ============================================================

/**
 * Interface for the module loaded from a plugin's server entry file.
 * Plugins export an object matching this shape via `definePlugin()` or
 * by exporting default with these properties directly.
 */
export interface PluginServerModule {
  onInstall?: (ctx: any) => Promise<void>;
  onActivate?: (ctx: any) => Promise<void>;
  onDeactivate?: (ctx: any) => Promise<void>;
  onUninstall?: (ctx: any) => Promise<void>;
  tools?: Array<{
    name: string;
    description: string;
    parameters: any;
    handler: any;
    permissions?: string[];
  }>;
  events?: Array<{
    event: string;
    handler: any;
  }>;
  routes?: any[];
  definition?: any;
}

// ============================================================
// Plugin Context — Injected into every lifecycle hook
// ============================================================

/**
 * The context object provided to plugin lifecycle hooks and tool handlers.
 * Contains all the services a plugin needs to interact with the platform.
 */
export interface PluginContext {
  pluginId: string;
  tenantId: string;
  db: any;
  eventBus: EventBus;
  toolRegistry: ToolRegistry;
  settings: Record<string, unknown>;
  logger: PluginLogger;
}

// ============================================================
// Plugin Definition — The shape developers provide
// ============================================================

/**
 * The complete plugin definition object.
 * Developers pass this to `definePlugin()` to create a validated plugin.
 */
export interface PluginDefinition {
  /** The plugin manifest (must validate against PluginManifest schema) */
  manifest: PluginManifest;

  // ── Lifecycle Hooks ──

  /** Called once when the plugin is first installed */
  onInstall?: (ctx: PluginContext) => Promise<void>;
  /** Called each time the plugin is activated */
  onActivate?: (ctx: PluginContext) => Promise<void>;
  /** Called when the plugin is deactivated */
  onDeactivate?: (ctx: PluginContext) => Promise<void>;
  /** Called when the plugin is fully removed */
  onUninstall?: (ctx: PluginContext) => Promise<void>;

  // ── Tool Handlers ──

  /** Map of tool name → handler for AI-callable tools */
  tools?: Record<string, ToolHandler>;

  // ── Event Handlers ──

  /** Map of event type → handler */
  events?: Record<string, EventHandler>;

  // ── API Route Handlers ──

  /** Array of custom API route handlers */
  routes?: PluginRouteHandler[];

  // ── Search Handler ──

  /** Search handler for global search integration */
  search?: SearchHandler;

  // ── Permission Checker ──

  /** Custom permission checker override */
  checkPermission?: (userId: string, permission: string) => Promise<boolean>;
}

// ============================================================
// Tool Handler — For AI-callable tool functions
// ============================================================

/**
 * A single tool handler that can be invoked by the AI assistant.
 */
export interface ToolHandler {
  /** Human-readable description */
  description: string;
  /** JSON Schema describing parameters */
  parameters: JSONSchema;
  /** Execution function */
  execute: (params: Record<string, unknown>, ctx: PluginContext) => Promise<unknown>;
}

// ============================================================
// Event Handler — For event bus subscriptions
// ============================================================

/**
 * Handler for an event that the plugin subscribes to.
 */
export interface EventHandler {
  handler: (payload: unknown, ctx: PluginContext) => Promise<void>;
}

// ============================================================
// Route Handler — For custom API endpoints
// ============================================================

/**
 * A custom API route handler exposed by the plugin.
 */
export interface PluginRouteHandler {
  /** HTTP method */
  method: string;
  /** URL path (relative to plugin base) */
  path: string;
  /** Handler function */
  handler: (req: PluginRequest, ctx: PluginContext) => Promise<PluginResponse>;
  /** Permissions required */
  permissions?: string[];
}

export interface PluginRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body?: unknown;
  headers: Record<string, string>;
  userId?: string;
}

export interface PluginResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

// ============================================================
// Search Handler — For global search integration
// ============================================================

export interface SearchHandler {
  search: (query: string, ctx: PluginContext) => Promise<SearchResult[]>;
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  description: string;
  href: string;
  metadata?: Record<string, unknown>;
}

// ============================================================
// Plugin Logger — Namespaced logging
// ============================================================

export interface PluginLogger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}

// ============================================================
// EventBus — Injected into plugin context
// ============================================================

export interface EventBus {
  on(event: string, handler: (payload: unknown) => void | Promise<void>): () => void;
  once(event: string, handler: (payload: unknown) => void | Promise<void>): () => void;
  off(event: string, handler: (payload: unknown) => void): void;
  emit(event: string, payload?: unknown): Promise<void>;
  clear(event?: string): void;
}

// ============================================================
// ToolRegistry — Injected into plugin context
// ============================================================

export interface ToolRegistry {
  register(pluginId: string, toolName: string, handler: ToolHandler): void;
  unregister(pluginId: string, toolName: string): void;
  get(pluginId: string, toolName: string): ToolHandler | undefined;
  getAll(): Map<string, ToolHandler>;
  getByPlugin(pluginId: string): Map<string, ToolHandler>;
}

// ============================================================
// definePlugin — Main SDK entry point
// ============================================================

/**
 * Creates a validated plugin definition.
 *
 * @param definition - The plugin definition object
 * @returns The validated plugin definition
 * @throws Error if the manifest is invalid
 */
export function definePlugin(definition: PluginDefinition): PluginDefinition {
  const result = validateManifest(definition.manifest);

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => `  - ${e}`).join('\n');
    throw new Error(
      `Invalid plugin manifest for "${definition.manifest.id || 'unknown'}":\n${errorMessages}`
    );
  }

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn(
      `[PluginSDK] Warnings for "${definition.manifest.id}": ${result.warnings.join(', ')}`
    );
  }

  return definition;
}

// ============================================================
// Plugin State — Runtime state enum
// ============================================================

export enum PluginState {
  AVAILABLE = 'available',
  INSTALLED = 'installed',
  ACTIVE = 'active',
  DISABLED = 'disabled',
  ERROR = 'error',
}

// ============================================================
// SDK Version
// ============================================================

export const SDK_VERSION = '1.0.0';
