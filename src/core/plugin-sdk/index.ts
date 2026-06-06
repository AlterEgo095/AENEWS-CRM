// ============================================================
// AENEWS Plugin SDK v1.0
// ============================================================
// The primary entry point for building AENEWS plugins.
//
// Usage:
//   import { definePlugin } from '@aenews/plugin-sdk';
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
  PluginSettingDefinition,
  PluginMenuItem,
  PluginEventDefinition,
  PluginSearchConfig,
  PluginRoute,
} from './manifest';

import type {
  PluginManifest,
} from './manifest';

// ============================================================
// Plugin Context — Injected into every lifecycle hook
// ============================================================

/**
 * The context object provided to plugin lifecycle hooks and tool handlers.
 * Contains all the services a plugin needs to interact with the platform.
 */
export interface PluginContext {
  /** The unique ID of the current plugin */
  pluginId: string;
  /** The current tenant ID (multi-tenant isolation) */
  tenantId: string;
  /** Prisma database client scoped to the current tenant */
  db: any;
  /** Event bus for cross-plugin communication */
  eventBus: EventBus;
  /** Tool registry for registering and discovering tools */
  toolRegistry: ToolRegistry;
  /** Resolved plugin settings for the current tenant */
  settings: Record<string, unknown>;
  /** Namespaced logger that prefixes with the plugin ID */
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
  /** Called each time the plugin is activated (e.g. after update or restart) */
  onActivate?: (ctx: PluginContext) => Promise<void>;
  /** Called when the plugin is deactivated (but not uninstalled) */
  onDeactivate?: (ctx: PluginContext) => Promise<void>;
  /** Called when the plugin is fully removed from the system */
  onUninstall?: (ctx: PluginContext) => Promise<void>;

  // ── Tool Handlers ──

  /** Map of tool name → handler for AI-callable tools */
  tools?: Record<string, ToolHandler>;

  // ── Event Handlers ──

  /** Map of event type → handler for events this plugin listens to */
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
 * Tools are the bridge between AI chat and plugin functionality.
 */
export interface ToolHandler {
  /** Human-readable description shown to the AI model */
  description: string;
  /** JSON Schema describing the parameters this tool accepts */
  parameters: JSONSchema;
  /**
   * The execution function.
   * Receives validated parameters and the plugin context.
   * Return value is sent back to the AI and/or the user.
   */
  execute: (params: Record<string, unknown>, ctx: PluginContext) => Promise<unknown>;
}

// ============================================================
// Event Handler — For event bus subscriptions
// ============================================================

/**
 * Handler for an event that the plugin subscribes to.
 */
export interface EventHandler {
  /** The handler function called when the event fires */
  handler: (payload: unknown, ctx: PluginContext) => Promise<void>;
}

// ============================================================
// Route Handler — For custom API endpoints
// ============================================================

/**
 * A custom API route handler exposed by the plugin.
 * Routes are mounted under `/api/plugins/{slug}{path}`.
 */
export interface PluginRouteHandler {
  /** HTTP method */
  method: string;
  /** URL path (relative to plugin base) */
  path: string;
  /** Handler function */
  handler: (req: PluginRequest, ctx: PluginContext) => Promise<PluginResponse>;
  /** Permissions required to access this route */
  permissions?: string[];
}

/**
 * Simplified request object passed to route handlers.
 */
export interface PluginRequest {
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Query parameters */
  query: Record<string, string>;
  /** Parsed request body (for POST/PUT/PATCH) */
  body?: unknown;
  /** Request headers */
  headers: Record<string, string>;
  /** Authenticated user ID (if authenticated) */
  userId?: string;
}

/**
 * Simplified response object returned by route handlers.
 */
export interface PluginResponse {
  /** HTTP status code */
  status: number;
  /** Response body */
  body?: unknown;
  /** Response headers */
  headers?: Record<string, string>;
}

// ============================================================
// Search Handler — For global search integration
// ============================================================

/**
 * Handler for search queries from the global search bar / command palette.
 */
export interface SearchHandler {
  /** Search function called when a user queries the global search */
  search: (query: string, ctx: PluginContext) => Promise<SearchResult[]>;
}

/**
 * A single search result returned to the global search UI.
 */
export interface SearchResult {
  /** Entity type identifier, e.g. "contact", "invoice" */
  type: string;
  /** Unique entity ID */
  id: string;
  /** Title displayed in search results */
  title: string;
  /** Description / subtitle shown below the title */
  description: string;
  /** Navigation href when the result is clicked */
  href: string;
  /** Additional metadata for rendering */
  metadata?: Record<string, unknown>;
}

// ============================================================
// JSON Schema — Simplified subset for tool parameters
// ============================================================

/**
 * A simplified JSON Schema type used for describing tool parameters.
 * Supports the most common types for AI tool calling.
 */
export interface JSONSchema {
  /** Schema type */
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  /** Property definitions for object types */
  properties?: Record<string, JSONSchema>;
  /** Required property keys for object types */
  required?: string[];
  /** Item schema for array types */
  items?: JSONSchema;
  /** Human-readable description */
  description?: string;
  /** Default value */
  default?: unknown;
  /** Allowed values for enum-like constraints */
  enum?: string[];
  /** Minimum value for numbers */
  minimum?: number;
  /** Maximum value for numbers */
  maximum?: number;
  /** Minimum string length */
  minLength?: number;
  /** Maximum string length */
  maxLength?: number;
}

// ============================================================
// Plugin Logger — Namespaced logging
// ============================================================

/**
 * A logger instance scoped to a specific plugin.
 * All messages are automatically prefixed with `[plugin:{id}]`.
 */
export interface PluginLogger {
  /** Log an informational message */
  info: (message: string, ...args: unknown[]) => void;
  /** Log a warning message */
  warn: (message: string, ...args: unknown[]) => void;
  /** Log an error message */
  error: (message: string, ...args: unknown[]) => void;
  /** Log a debug message (only in development) */
  debug: (message: string, ...args: unknown[]) => void;
}

// ============================================================
// EventBus — Injected into plugin context
// ============================================================

/**
 * The event bus interface available to plugins.
 * Plugins use this to emit events and subscribe to events
 * from other plugins or the core system.
 */
export interface EventBus {
  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event: string, handler: (payload: unknown) => void | Promise<void>): () => void;
  /** Subscribe to an event once. Auto-unsubscribes after first emission. */
  once(event: string, handler: (payload: unknown) => void | Promise<void>): () => void;
  /** Remove a specific handler from an event. */
  off(event: string, handler: (payload: unknown) => void): void;
  /** Emit an event to all subscribers. */
  emit(event: string, payload?: unknown): Promise<void>;
  /** Clear all handlers for an event, or all events if no event specified. */
  clear(event?: string): void;
}

// ============================================================
// ToolRegistry — Injected into plugin context
// ============================================================

/**
 * The tool registry interface available to plugins.
 * Plugins use this to register tools that the AI assistant can call,
 * and to discover tools from other plugins.
 */
export interface ToolRegistry {
  /** Register a tool for this plugin */
  register(pluginId: string, toolName: string, handler: ToolHandler): void;
  /** Unregister a tool */
  unregister(pluginId: string, toolName: string): void;
  /** Get a specific tool by plugin ID and name */
  get(pluginId: string, toolName: string): ToolHandler | undefined;
  /** Get all registered tools across all plugins */
  getAll(): Map<string, ToolHandler>;
  /** Get all tools registered by a specific plugin */
  getByPlugin(pluginId: string): Map<string, ToolHandler>;
}

// ============================================================
// definePlugin — Main SDK entry point
// ============================================================

/**
 * Creates a validated plugin definition.
 *
 * This is the primary function that plugin developers call.
 * It validates the manifest and returns the plugin definition
 * ready for registration with the AENEWS Core.
 *
 * @param definition - The plugin definition object
 * @returns The validated plugin definition
 * @throws Error if the manifest is invalid
 *
 * @example
 * ```typescript
 * import { definePlugin } from '@aenews/plugin-sdk';
 * import manifest from './plugin.json';
 *
 * export default definePlugin({
 *   manifest,
 *   onInstall: async (ctx) => {
 *     ctx.logger.info('Installing...');
 *   },
 *   tools: {
 *     my_tool: {
 *       description: 'Does something useful',
 *       parameters: {
 *         type: 'object',
 *         properties: {
 *           input: { type: 'string' },
 *         },
 *         required: ['input'],
 *       },
 *       execute: async (params, ctx) => {
 *         return { result: params.input };
 *       },
 *     },
 *   },
 * });
 * ```
 */
export function definePlugin(definition: PluginDefinition): PluginDefinition {
  const result = validateManifest(definition.manifest);

  if (!result.valid) {
    const errorMessages = result.errors.map((e) => `  - ${e}`).join('\n');
    throw new Error(
      `Invalid plugin manifest for "${definition.manifest.id || 'unknown'}":\n${errorMessages}`
    );
  }

  return definition;
}

// ============================================================
// Manifest Validation
// ============================================================

/**
 * Validates a plugin manifest against the specification.
 * Returns an object with `valid` (boolean) and `errors` (string[]).
 *
 * This function can also be used standalone to check manifests
 * without calling definePlugin().
 */
export function validateManifest(
  manifest: PluginManifest
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // ── Required fields ──
  const requiredFields: (keyof PluginManifest)[] = [
    'aenews',
    'id',
    'name',
    'slug',
    'version',
    'description',
    'author',
    'license',
    'coreVersion',
    'capabilities',
    'entry',
    'permissions',
    'settings',
  ];

  for (const field of requiredFields) {
    if (manifest[field] === undefined || manifest[field] === null || manifest[field] === '') {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // ── aenews version ──
  if (manifest.aenews !== undefined && manifest.aenews !== '1') {
    errors.push(
      `Invalid manifest version: "${manifest.aenews}". Only "1" is supported.`
    );
  }

  // ── Version format (semver: MAJOR.MINOR.PATCH) ──
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push(
      `Invalid version format: "${manifest.version}". Expected semver (e.g. "1.0.0").`
    );
  }

  // ── coreVersion format (semver) ──
  if (manifest.coreVersion && !/^\d+\.\d+\.\d+/.test(manifest.coreVersion)) {
    errors.push(
      `Invalid coreVersion format: "${manifest.coreVersion}". Expected semver (e.g. "0.1.0").`
    );
  }

  // ── Slug format ──
  if (manifest.slug && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(manifest.slug)) {
    errors.push(
      `Invalid slug format: "${manifest.slug}". Use lowercase letters, numbers, and hyphens only. Must start and end with a letter or number.`
    );
  }

  // ── Plugin ID format ──
  if (manifest.id && !/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(manifest.id)) {
    errors.push(
      `Invalid id format: "${manifest.id}". Use lowercase letters, numbers, hyphens, dots, and underscores.`
    );
  }

  // ── Entry.server required ──
  if (manifest.entry && !manifest.entry.server) {
    errors.push('Missing entry.server field — every plugin must declare a server entry point.');
  }

  // ── Capabilities must have at least one ──
  if (manifest.capabilities && manifest.capabilities.length === 0) {
    errors.push('Plugin must declare at least one capability.');
  }

  // ── Validate each capability ──
  if (manifest.capabilities) {
    const validCapabilityTypes = [
      'object', 'view', 'tool', 'workflow', 'dashboard', 'page',
      'api', 'search', 'notification', 'command', 'integration',
    ];
    for (const cap of manifest.capabilities) {
      if (!validCapabilityTypes.includes(cap.type)) {
        errors.push(
          `Invalid capability type: "${cap.type}". Must be one of: ${validCapabilityTypes.join(', ')}.`
        );
      }
      if (!cap.name) {
        errors.push('Each capability must have a name.');
      }
      if (!cap.description) {
        errors.push(`Capability "${cap.name || '(unnamed)'}" is missing a description.`);
      }
    }
  }

  // ── Validate dependencies ──
  if (manifest.dependencies) {
    for (const dep of manifest.dependencies) {
      if (!dep.pluginId) {
        errors.push('Each dependency must have a pluginId.');
      }
      if (!dep.version) {
        errors.push(`Dependency "${dep.pluginId || '(missing)'}" is missing a version.`);
      }
      if (dep.optional === undefined) {
        errors.push(`Dependency "${dep.pluginId}" must specify optional (true/false).`);
      }
    }
  }

  // ── Validate permissions ──
  if (manifest.permissions) {
    for (const perm of manifest.permissions) {
      if (!perm.id || !perm.name || !perm.category) {
        errors.push(`Permission "${perm.id || '(unnamed)'}" must have id, name, and category.`);
      }
      // Validate permission ID follows dot-notation
      if (perm.id && !/^[a-z]+(?:\.[a-z]+)+$/.test(perm.id)) {
        errors.push(
          `Invalid permission ID format: "${perm.id}". Expected dot-notation (e.g. "crm.contacts.read").`
        );
      }
    }
  }

  // ── Validate settings ──
  if (manifest.settings) {
    for (const setting of manifest.settings) {
      if (!setting.key || !setting.type || !setting.label) {
        errors.push(`Setting "${setting.key || '(unnamed)'}" must have key, type, and label.`);
      }
      if (setting.type === 'select' && (!setting.options || setting.options.length === 0)) {
        errors.push(`Select setting "${setting.key}" must have at least one option.`);
      }
    }
  }

  // ── Validate menu items ──
  if (manifest.menus) {
    for (const menu of manifest.menus) {
      if (!menu.id || !menu.label) {
        errors.push(`Menu item "${menu.id || '(unnamed)'}" must have id and label.`);
      }
    }
  }

  // ── Validate events ──
  if (manifest.events) {
    for (const event of manifest.events) {
      if (!event.type || !event.description) {
        errors.push(`Event "${event.type || '(unnamed)'}" must have type and description.`);
      }
    }
  }

  // ── Validate search config ──
  if (manifest.search) {
    for (const entity of manifest.search.entities) {
      if (!entity.name || !entity.table || !entity.labelField) {
        errors.push(
          `Search entity "${entity.name || '(unnamed)'}" must have name, table, and labelField.`
        );
      }
      if (!entity.fields || entity.fields.length === 0) {
        errors.push(`Search entity "${entity.name}" must have at least one searchable field.`);
      }
    }
  }

  // ── Validate routes ──
  if (manifest.routes) {
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    for (const route of manifest.routes) {
      if (!validMethods.includes(route.method)) {
        errors.push(
          `Invalid route method: "${route.method}". Must be one of: ${validMethods.join(', ')}.`
        );
      }
      if (!route.path || !route.path.startsWith('/')) {
        errors.push(`Route path "${route.path}" must start with "/".`);
      }
      if (!route.handler) {
        errors.push(`Route "${route.path}" must reference a handler.`);
      }
    }
  }

  // ── Validate migrations ──
  if (manifest.migrations) {
    for (const migration of manifest.migrations) {
      if (!migration.version || !migration.name || !migration.up) {
        errors.push(
          `Migration "${migration.name || '(unnamed)'}" must have version, name, and up.`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================
// Plugin State — Runtime state enum
// ============================================================

/**
 * Runtime state of a plugin instance.
 */
export enum PluginState {
  /** Plugin is discovered but not installed */
  AVAILABLE = 'available',
  /** Plugin is installed but not active */
  INSTALLED = 'installed',
  /** Plugin is installed and currently running */
  ACTIVE = 'active',
  /** Plugin is installed but explicitly disabled */
  DISABLED = 'disabled',
  /** Plugin has an error preventing activation */
  ERROR = 'error',
}

// ============================================================
// SDK Version
// ============================================================

/** Current version of the AENEWS Plugin SDK */
export const SDK_VERSION = '1.0.0';
