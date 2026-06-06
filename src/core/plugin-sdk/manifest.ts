// ============================================================
// AENEWS Enterprise OS — Plugin SDK: Manifest Types & Validation
// The canonical type definitions for plugin.json manifests
// ============================================================

/** JSON Schema representation (subset used for tool parameters) */
export type JSONSchema =
  | { type: 'string'; description?: string; enum?: string[]; default?: string }
  | { type: 'number'; description?: string; minimum?: number; maximum?: number; default?: number }
  | { type: 'boolean'; description?: string; default?: boolean }
  | { type: 'array'; description?: string; items?: JSONSchema; default?: unknown[] }
  | { type: 'object'; description?: string; properties?: Record<string, JSONSchema>; required?: string[] }
  | { type: 'null'; description?: string };

/** A single dependency declared in a plugin manifest */
export interface PluginDependency {
  /** The plugin ID being depended on */
  pluginId: string;
  /** Semantic version range (e.g. "^1.0.0", ">=2.0.0 <3.0.0") */
  version?: string;
  /** Whether this dependency is optional (won't block install if missing) */
  optional?: boolean;
}

/** Lifecycle hook names */
export type PluginLifecycleHook = 'onInstall' | 'onActivate' | 'onDeactivate' | 'onUninstall';

/** Tool handler function signature */
export type ToolHandler = (params: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;

export interface ToolContext {
  tenantId: string;
  userId?: string;
  requestId?: string;
  pluginId: string;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  meta?: Record<string, unknown>;
}

/** Event handler function signature */
export type EventHandler = (payload: unknown) => void | Promise<void>;

/** Plugin route handler definition */
export interface PluginRouteHandler {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  handler: (request: PluginRouteRequest) => Promise<PluginRouteResponse>;
  permissions?: string[];
}

export interface PluginRouteRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body?: unknown;
  headers: Record<string, string>;
  tenantId: string;
  userId?: string;
}

export interface PluginRouteResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

/** Menu item contributed by a plugin */
export interface PluginMenuItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
  order?: number;
  parentId?: string;
  permissions?: string[];
}

/** Permission definition contributed by a plugin */
export interface PluginPermission {
  id: string;
  name: string;
  description: string;
  category?: string;
}

/** Migration definition */
export interface PluginMigration {
  /** Version this migration upgrades to */
  version: string;
  /** SQL statements to run */
  up: string[];
  /** SQL statements to reverse (optional) */
  down?: string[];
}

/** The canonical plugin.json manifest */
export interface PluginManifest {
  /** Unique plugin identifier (e.g. "crm.contacts") */
  id: string;
  /** Human-readable name */
  name: string;
  /** URL-safe slug */
  slug: string;
  /** Human-readable description */
  description: string;
  /** Semantic version */
  version: string;
  /** Plugin author / organization */
  author: string;
  /** Lucide icon name for UI rendering */
  icon?: string;
  /** Plugin category */
  category: string;
  /** Minimum AENEOS version required (semver) */
  aeneosVersion?: string;
  /** List of plugin dependencies */
  dependencies?: PluginDependency[];
  /** Path to server entry point (relative to plugin dir) */
  serverEntry?: string;
  /** Path to client entry point (relative to plugin dir) */
  clientEntry?: string;
  /** List of capabilities this plugin provides */
  capabilities: string[];
  /** Permissions this plugin defines */
  permissions?: PluginPermission[];
  /** Menu items this plugin contributes */
  menuItems?: PluginMenuItem[];
  /** Migrations array */
  migrations?: PluginMigration[];
  /** Plugin settings schema (JSON Schema) */
  settingsSchema?: JSONSchema;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of validating a plugin manifest
 */
export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a plugin manifest against the schema rules.
 * Returns detailed validation result with errors and warnings.
 */
export function validateManifest(manifest: unknown): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null object'], warnings: [] };
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (typeof m.id !== 'string' || m.id.trim().length === 0) {
    errors.push('Plugin manifest must have a non-empty "id" field (string)');
  } else if (!/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(m.id as string)) {
    errors.push(`Plugin id "${m.id}" must be lowercase alphanumeric with dots, hyphens, or underscores`);
  }

  if (typeof m.name !== 'string' || m.name.trim().length === 0) {
    errors.push('Plugin manifest must have a non-empty "name" field (string)');
  }

  if (typeof m.slug !== 'string' || m.slug.trim().length === 0) {
    errors.push('Plugin manifest must have a non-empty "slug" field (string)');
  } else if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(m.slug as string)) {
    errors.push(`Plugin slug "${m.slug}" must be lowercase alphanumeric with hyphens`);
  }

  if (typeof m.version !== 'string' || m.version.trim().length === 0) {
    errors.push('Plugin manifest must have a non-empty "version" field (string)');
  } else if (!isValidSemver(m.version as string)) {
    errors.push(`Plugin version "${m.version}" is not a valid semver (e.g. "1.2.3")`);
  }

  if (typeof m.author !== 'string' || m.author.trim().length === 0) {
    errors.push('Plugin manifest must have a non-empty "author" field (string)');
  }

  if (typeof m.description !== 'string' || m.description.trim().length === 0) {
    errors.push('Plugin manifest must have a non-empty "description" field (string)');
  }

  if (typeof m.category !== 'string' || m.category.trim().length === 0) {
    errors.push('Plugin manifest must have a non-empty "category" field (string)');
  }

  // Capabilities
  if (!Array.isArray(m.capabilities)) {
    errors.push('Plugin manifest must have a "capabilities" array');
  } else if ((m.capabilities as unknown[]).length === 0) {
    warnings.push('Plugin has no capabilities defined — it may not provide any functionality');
  }

  // Dependencies validation
  if (m.dependencies !== undefined && !Array.isArray(m.dependencies)) {
    errors.push('"dependencies" must be an array if provided');
  } else if (Array.isArray(m.dependencies)) {
    for (const dep of m.dependencies as Record<string, unknown>[]) {
      if (typeof dep.pluginId !== 'string' || dep.pluginId.trim().length === 0) {
        errors.push('Each dependency must have a non-empty "pluginId"');
      }
      if (dep.version !== undefined && typeof dep.version !== 'string') {
        errors.push(`Dependency "${dep.pluginId}" has invalid "version" — must be a string`);
      }
    }
  }

  // Migrations validation
  if (m.migrations !== undefined && !Array.isArray(m.migrations)) {
    errors.push('"migrations" must be an array if provided');
  } else if (Array.isArray(m.migrations)) {
    for (const mig of m.migrations as Record<string, unknown>[]) {
      if (typeof mig.version !== 'string') {
        errors.push('Each migration must have a "version" string');
      }
      if (!Array.isArray(mig.up)) {
        errors.push(`Migration "${mig.version}" must have an "up" array of SQL strings`);
      }
    }
  }

  // Optional field warnings
  if (!m.serverEntry && !m.clientEntry) {
    warnings.push('Plugin has no serverEntry or clientEntry — it will have no runtime behavior');
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Simple semver validation — supports major.minor.patch format
 */
function isValidSemver(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?(\+[a-zA-Z0-9.]+)?$/.test(version);
}

/**
 * Compare two semver versions. Returns -1, 0, or 1.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[-+]/)[0].split('.').map(Number);
  const pb = b.split(/[-+]/)[0].split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va < vb) return -1;
    if (va > vb) return 1;
  }

  return 0;
}

/**
 * Check if a version satisfies a semver range.
 * Supports: exact, caret (^), tilde (~), and comparison operators (>=, <=, >, <).
 */
export function satisfiesVersionRange(version: string, range: string): boolean {
  const v = version.split(/[-+]/)[0]; // strip prerelease/build

  // Exact match
  if (v === range) return true;

  // Caret: ^1.2.3 → >=1.2.3 <2.0.0
  if (range.startsWith('^')) {
    const base = range.slice(1);
    const parts = base.split('.').map(Number);
    const nextMajor = parts[0] + 1;
    return compareVersions(v, base) >= 0 && compareVersions(v, `${nextMajor}.0.0`) < 0;
  }

  // Tilde: ~1.2.3 → >=1.2.3 <1.3.0
  if (range.startsWith('~')) {
    const base = range.slice(1);
    const parts = base.split('.').map(Number);
    const nextMinor = `${parts[0]}.${parts[1] + 1}.0`;
    return compareVersions(v, base) >= 0 && compareVersions(v, nextMinor) < 0;
  }

  // Comparison operators
  if (range.startsWith('>=')) return compareVersions(v, range.slice(2)) >= 0;
  if (range.startsWith('<=')) return compareVersions(v, range.slice(2)) <= 0;
  if (range.startsWith('>'))  return compareVersions(v, range.slice(1)) > 0;
  if (range.startsWith('<'))  return compareVersions(v, range.slice(1)) < 0;

  return false;
}
