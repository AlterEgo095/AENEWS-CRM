// ============================================================
// AENEWS Enterprise OS — Plugin SDK: Manifest Types & Validation
// The canonical type definitions for plugin.json manifests
// ============================================================

/** JSON Schema representation (for tool parameters, settings, etc.) */
export interface JSONSchema {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  description?: string;
  default?: unknown;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/** A single dependency declared in a plugin manifest */
export interface PluginDependency {
  pluginId: string;
  version?: string;
  optional?: boolean;
}

/** A capability provided by the plugin */
export interface PluginCapability {
  type: string;
  name: string;
  description: string;
}

/** Permission definition contributed by a plugin */
export interface PluginPermission {
  id: string;
  name: string;
  description: string;
  category?: string;
}

/** Plugin setting definition */
export interface PluginSetting {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'json';
  label: string;
  description?: string;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  scope?: string;
}

/** Menu item contributed by a plugin */
export interface PluginMenu {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  section?: string;
  order?: number;
  parentId?: string;
  permission?: string;
}

/** Event definition contributed by a plugin */
export interface PluginEventDef {
  type: string;
  payloadSchema?: Record<string, unknown>;
  description: string;
}

/** Search entity configuration */
export interface PluginSearchConfig {
  entities: Array<{
    name: string;
    table: string;
    fields: string[];
    labelField: string;
  }>;
}

/** Plugin route definition (in manifest, points to a handler string) */
export interface PluginRoute {
  method: string;
  path: string;
  handler: string;
  permissions?: string[];
}

/** Plugin migration definition */
export interface PluginMigration {
  version: string;
  name?: string;
  up: string | string[];
  down?: string | string[];
}

/** The canonical plugin.json manifest */
export interface PluginManifest {
  aenews: '1';
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  author: string;
  license: string;
  repository?: string;
  homepage?: string;
  coreVersion: string;
  dependencies?: PluginDependency[];
  capabilities: PluginCapability[];
  entry: {
    server: string;
    client?: string;
  };
  migrations?: PluginMigration[];
  permissions?: PluginPermission[];
  settings?: PluginSetting[];
  menus?: PluginMenu[];
  events?: PluginEventDef[];
  consumes?: string[];
  search?: PluginSearchConfig;
  routes?: PluginRoute[];
  metadata?: Record<string, unknown>;
}

// ============================================================
// Validation
// ============================================================

export interface ManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a plugin manifest against the canonical schema rules.
 * Returns detailed validation result with errors and warnings.
 */
export function validateManifest(manifest: unknown): ManifestValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest must be a non-null object'], warnings: [] };
  }

  const m = manifest as Record<string, unknown>;

  // ── aenews version ──
  if (m.aenews !== '1') {
    errors.push('Manifest must declare "aenews": "1"');
  }

  // ── Required string fields ──
  const requiredStringFields = ['id', 'name', 'slug', 'version', 'description', 'author', 'license', 'coreVersion'];
  for (const field of requiredStringFields) {
    if (typeof m[field] !== 'string' || (m[field] as string).trim().length === 0) {
      errors.push(`Missing or empty required field: "${field}"`);
    }
  }

  // ── ID format ──
  if (typeof m.id === 'string' && !/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(m.id)) {
    errors.push(`Plugin id "${m.id}" must be lowercase alphanumeric with dots, hyphens, or underscores`);
  }

  // ── Slug format ──
  if (typeof m.slug === 'string' && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(m.slug)) {
    errors.push(`Plugin slug "${m.slug}" must be lowercase alphanumeric with hyphens only`);
  }

  // ── Version format (semver) ──
  if (typeof m.version === 'string' && !/^\d+\.\d+\.\d+/.test(m.version)) {
    errors.push(`Plugin version "${m.version}" is not valid semver (e.g. "1.2.3")`);
  }

  // ── CoreVersion format (semver) ──
  if (typeof m.coreVersion === 'string' && !/^\d+\.\d+\.\d+/.test(m.coreVersion)) {
    errors.push(`coreVersion "${m.coreVersion}" is not valid semver`);
  }

  // ── Entry.server required ──
  if (!m.entry || typeof m.entry !== 'object' || !(m.entry as Record<string, unknown>).server) {
    errors.push('Manifest must have "entry.server" pointing to the server entry file');
  }

  // ── Capabilities ──
  if (!Array.isArray(m.capabilities)) {
    errors.push('Manifest must have a "capabilities" array');
  } else if ((m.capabilities as unknown[]).length === 0) {
    warnings.push('Plugin has no capabilities defined');
  } else {
    for (const cap of m.capabilities as Record<string, unknown>[]) {
      if (!cap.type || !cap.name || !cap.description) {
        errors.push('Each capability must have type, name, and description');
      }
    }
  }

  // ── Dependencies ──
  if (m.dependencies !== undefined) {
    if (!Array.isArray(m.dependencies)) {
      errors.push('"dependencies" must be an array if provided');
    } else {
      for (const dep of m.dependencies as Record<string, unknown>[]) {
        if (typeof dep.pluginId !== 'string' || dep.pluginId.trim().length === 0) {
          errors.push('Each dependency must have a non-empty "pluginId"');
        }
      }
    }
  }

  // ── Permissions ──
  if (m.permissions !== undefined && Array.isArray(m.permissions)) {
    for (const perm of m.permissions as Record<string, unknown>[]) {
      if (!perm.id || !perm.name) {
        errors.push(`Permission must have id and name`);
      }
    }
  }

  // ── Settings ──
  if (m.settings !== undefined && Array.isArray(m.settings)) {
    for (const setting of m.settings as Record<string, unknown>[]) {
      if (!setting.key || !setting.type || !setting.label) {
        errors.push(`Setting must have key, type, and label`);
      }
      if (setting.type === 'select' && (!setting.options || !Array.isArray(setting.options) || setting.options.length === 0)) {
        errors.push(`Select setting "${setting.key}" must have options`);
      }
    }
  }

  // ── Menus ──
  if (m.menus !== undefined && Array.isArray(m.menus)) {
    for (const menu of m.menus as Record<string, unknown>[]) {
      if (!menu.id || !menu.label) {
        errors.push(`Menu item must have id and label`);
      }
    }
  }

  // ── Events ──
  if (m.events !== undefined && Array.isArray(m.events)) {
    for (const event of m.events as Record<string, unknown>[]) {
      if (!event.type || !event.description) {
        errors.push(`Event must have type and description`);
      }
    }
  }

  // ── Search ──
  if (m.search !== undefined) {
    const search = m.search as Record<string, unknown>;
    if (!search.entities || !Array.isArray(search.entities)) {
      errors.push('Search config must have an "entities" array');
    } else {
      for (const entity of search.entities as Record<string, unknown>[]) {
        if (!entity.name || !entity.table || !entity.labelField) {
          errors.push(`Search entity must have name, table, and labelField`);
        }
      }
    }
  }

  // ── Routes ──
  if (m.routes !== undefined && Array.isArray(m.routes)) {
    const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
    for (const route of m.routes as Record<string, unknown>[]) {
      if (!validMethods.includes(route.method as string)) {
        errors.push(`Invalid route method: "${route.method}"`);
      }
      if (!route.path || !(route.path as string).startsWith('/')) {
        errors.push(`Route path must start with "/"`);
      }
      if (!route.handler) {
        errors.push(`Route must reference a handler`);
      }
    }
  }

  // ── Migrations ──
  if (m.migrations !== undefined && Array.isArray(m.migrations)) {
    for (const migration of m.migrations as Record<string, unknown>[]) {
      if (!migration.version) {
        errors.push('Each migration must have a "version"');
      }
      if (!migration.up) {
        errors.push(`Migration "${migration.version}" must have an "up" field`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
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
 */
export function satisfiesVersionRange(version: string, range: string): boolean {
  const v = version.split(/[-+]/)[0];

  if (v === range) return true;

  if (range.startsWith('^')) {
    const base = range.slice(1);
    const parts = base.split('.').map(Number);
    const nextMajor = parts[0] + 1;
    return compareVersions(v, base) >= 0 && compareVersions(v, `${nextMajor}.0.0`) < 0;
  }

  if (range.startsWith('~')) {
    const base = range.slice(1);
    const parts = base.split('.').map(Number);
    const nextMinor = `${parts[0]}.${parts[1] + 1}.0`;
    return compareVersions(v, base) >= 0 && compareVersions(v, nextMinor) < 0;
  }

  if (range.startsWith('>=')) return compareVersions(v, range.slice(2)) >= 0;
  if (range.startsWith('<=')) return compareVersions(v, range.slice(2)) <= 0;
  if (range.startsWith('>'))  return compareVersions(v, range.slice(1)) > 0;
  if (range.startsWith('<'))  return compareVersions(v, range.slice(1)) < 0;

  return false;
}
