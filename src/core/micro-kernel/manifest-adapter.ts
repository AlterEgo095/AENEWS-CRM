/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * Manifest Adapter
 *
 * Translates SDK-format plugin manifests (used by real business plugins
 * in plugin.json files) into Kernel-format PluginManifest objects
 * consumed by the Micro-Kernel's discovery, registry, and lifecycle systems.
 *
 * SDK format (plugin-sdk/manifest.ts) → Kernel format (micro-kernel/types.ts)
 */

import type {
  PluginManifest,
  CapabilityDefinition,
  MenuDefinition,
  EventDefinition,
  SettingDefinition,
} from './types';

// ─── SDK-format types (mirrors plugin-sdk/manifest.ts) ───────────

/** SDK capability: { type, name, description } */
interface SDKCapability {
  type: string;
  name: string;
  description: string;
}

/** SDK permission: { id, name, description, category? } */
interface SDKPermission {
  id: string;
  name: string;
  description: string;
  category?: string;
}

/** SDK setting: { key, type, label, defaultValue, options? } */
interface SDKSetting {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'json';
  label: string;
  description?: string;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  scope?: string;
}

/** SDK menu: { id, label, icon?, href?, section?, order?, parentId?, permission? } */
interface SDKMenu {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  section?: string;
  order?: number;
  parentId?: string;
  permission?: string;
}

/** SDK event: { type, description, payloadSchema? } */
interface SDKEvent {
  type: string;
  description: string;
  payloadSchema?: Record<string, unknown>;
}

/** SDK search entity */
interface SDKSearchEntity {
  name: string;
  table: string;
  fields: string[];
  labelField: string;
}

/** SDK search config */
interface SDKSearchConfig {
  entities: SDKSearchEntity[];
}

/** SDK dependency */
interface SDKDependency {
  pluginId: string;
  version?: string;
  optional?: boolean;
}

/** Loose representation of an SDK-format manifest */
interface SDKManifest {
  aenews?: string;
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  author: string;
  license: string;
  coreVersion?: string;
  dependencies?: SDKDependency[];
  capabilities: SDKCapability[];
  entry?: { server?: string; client?: string };
  permissions?: SDKPermission[];
  settings?: SDKSetting[];
  menus?: SDKMenu[];
  events?: SDKEvent[];
  search?: SDKSearchConfig;
  // Additional fields that may exist in SDK manifests
  repository?: string;
  homepage?: string;
  migrations?: unknown[];
  consumes?: string[];
  routes?: unknown[];
  metadata?: Record<string, unknown>;
}

// ─── Detection ─────────────────────────────────────────────────────

/**
 * Determine whether a raw manifest object is already in Kernel format.
 * Kernel manifests have a `category` field; SDK manifests do not.
 */
export function isKernelManifest(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Record<string, unknown>;
  return (
    m.aenews === '1' &&
    typeof m.category === 'string' &&
    (m.category === 'system' || m.category === 'business')
  );
}

// ─── Adapter ──────────────────────────────────────────────────────

/**
 * Convert a `plugin:` protocol href to a filesystem-style path.
 * e.g. "plugin:garage:dashboard" → "/plugin/garage/dashboard"
 */
function adaptHrefToPath(href: string): string {
  if (href.startsWith('plugin:')) {
    // "plugin:slug:route" → "/plugin/slug/route"
    return '/' + href.replace(/:/g, '/');
  }
  // Already a path or other format — return as-is
  return href;
}

/**
 * Transform a single SDK-format manifest into Kernel-format PluginManifest.
 * If the manifest is already in Kernel format, it is passed through unchanged.
 *
 * @param raw - The raw manifest object (SDK or Kernel format)
 * @returns A valid Kernel-format PluginManifest
 */
export function adaptManifest(raw: unknown): PluginManifest {
  // Pass through if already in kernel format
  if (isKernelManifest(raw)) {
    return raw as PluginManifest;
  }

  const sdk = raw as SDKManifest;

  // ── Capabilities ──
  const capabilities: CapabilityDefinition[] = [];

  if (sdk.capabilities && Array.isArray(sdk.capabilities)) {
    // Build a lookup map from search entities (if present)
    const searchEntityMap = new Map<string, SDKSearchEntity>();
    if (sdk.search?.entities) {
      for (const entity of sdk.search.entities) {
        searchEntityMap.set(entity.name, entity);
      }
    }

    for (const cap of sdk.capabilities) {
      const kernelCap: CapabilityDefinition = {
        id: cap.name,
        type: cap.type as CapabilityDefinition['type'],
        description: cap.description,
      };

      // If capability type is 'search' and matching search entity exists, attach entity
      if (cap.type === 'search') {
        const entity = searchEntityMap.get(cap.name);
        if (entity) {
          kernelCap.entity = entity.name;
        }
      }

      capabilities.push(kernelCap);
    }

    // Generate additional search capability entries from search entities
    // that weren't already covered by capabilities
    if (sdk.search?.entities) {
      const coveredEntities = new Set(
        sdk.capabilities
          .filter(c => c.type === 'search')
          .map(c => c.name)
      );

      for (const entity of sdk.search.entities) {
        if (!coveredEntities.has(entity.name)) {
          capabilities.push({
            id: `search.${entity.name}`,
            type: 'search',
            description: `Search ${entity.name}`,
            entity: entity.name,
          });
        }
      }
    }
  }

  // ── Menus ──
  const menus: MenuDefinition[] = [];
  if (sdk.menus && Array.isArray(sdk.menus)) {
    for (const menu of sdk.menus) {
      menus.push({
        id: menu.id,
        label: menu.label,
        icon: menu.icon,
        // Convert "plugin:slug:route" href to "/plugin/slug/route" path
        path: menu.href ? adaptHrefToPath(menu.href) : `/plugin/${sdk.slug}/${menu.id}`,
        section: menu.section,
        order: menu.order,
        permission: menu.permission,
      });
    }
  }

  // ── Permissions (array of objects → array of strings) ──
  const permissions: string[] = [];
  if (sdk.permissions && Array.isArray(sdk.permissions)) {
    for (const perm of sdk.permissions) {
      if (perm.id) {
        permissions.push(perm.id);
      }
    }
  }

  // ── Settings ──
  const settings: SettingDefinition[] = [];
  if (sdk.settings && Array.isArray(sdk.settings)) {
    for (const setting of sdk.settings) {
      settings.push({
        id: setting.key,
        label: setting.label,
        type: setting.type,
        default: setting.defaultValue,
        options: setting.options,
        description: setting.description,
      });
    }
  }

  // ── Events ──
  const events: EventDefinition[] = [];
  if (sdk.events && Array.isArray(sdk.events)) {
    for (const evt of sdk.events) {
      events.push({
        id: evt.type,
        name: evt.type,
        description: evt.description,
        ...(evt.payloadSchema ? { payload: evt.payloadSchema } : {}),
      });
    }
  }

  // ── Assemble Kernel manifest ──
  const kernelManifest: PluginManifest = {
    aenews: '1',
    id: sdk.id,
    slug: sdk.slug,
    name: sdk.name,
    description: sdk.description,
    version: sdk.version,
    category: 'business',
    author: sdk.author,
    license: sdk.license,
    ...(sdk.coreVersion ? { kernelVersion: sdk.coreVersion } : {}),
    ...(sdk.dependencies ? {
      dependencies: sdk.dependencies.map(d => ({
        id: d.pluginId,
        version: d.version || '*',
        required: !d.optional,
      })),
    } : {}),
    ...(capabilities.length > 0 ? { capabilities } : {}),
    ...(menus.length > 0 ? { menus } : {}),
    ...(permissions.length > 0 ? { permissions } : {}),
    ...(settings.length > 0 ? { settings } : {}),
    ...(events.length > 0 ? { events } : {}),
    ...(sdk.entry?.server ? { entry: { server: sdk.entry.server } } : {}),
    ...(sdk.consumes ? { provides: sdk.consumes } : {}),
    ...(sdk.metadata?.icon ? { icon: sdk.metadata.icon as string } : {}),
    ...(sdk.metadata?.color ? { color: sdk.metadata.color as string } : {}),
  };

  return kernelManifest;
}

/**
 * Batch-process an array of raw manifests, adapting each to Kernel format.
 * Supports mixed input: some may already be Kernel format, others SDK format.
 *
 * @param manifests - Array of raw manifest objects (SDK or Kernel format)
 * @returns Array of Kernel-format PluginManifest objects
 */
export function adaptManifests(manifests: unknown[]): PluginManifest[] {
  if (!Array.isArray(manifests)) {
    throw new TypeError('[ManifestAdapter] adaptManifests expects an array');
  }

  return manifests.map((raw, idx) => {
    try {
      return adaptManifest(raw);
    } catch (err) {
      throw new Error(
        `[ManifestAdapter] Failed to adapt manifest at index ${idx}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  });
}
