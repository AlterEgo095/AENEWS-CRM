// ============================================================
// AENEWS Enterprise OS — Plugin Registry System
// Provides interfaces and query functions for the plugin system.
// All data is sourced from the database + plugin directory scans.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

import { db } from '@/lib/db';

export interface PluginInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author?: string;
  license?: string;
  capabilities: any[];
  entry?: { server: string; client?: string };
  status: 'AVAILABLE' | 'INSTALLED' | 'ACTIVE' | 'DISABLED';
  installed: boolean;
  installedAt?: Date;
  installStatus?: string;
  installSettings?: Record<string, unknown> | null;
}

/**
 * Scan the plugins directory for plugin manifests.
 * Returns parsed PluginInfo objects for all valid plugins found.
 */
export async function scanPluginsDirectory(): Promise<PluginInfo[]> {
  const pluginDir = path.resolve('./plugins');
  const plugins: PluginInfo[] = [];

  if (!fs.existsSync(pluginDir)) {
    return plugins;
  }

  const entries = await fs.promises.readdir(pluginDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(pluginDir, entry.name, 'plugin.json');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf-8');
      const json = JSON.parse(raw);

      plugins.push({
        id: json.id,
        name: json.name,
        slug: json.slug,
        description: json.description,
        version: json.version,
        author: json.author,
        license: json.license,
        capabilities: json.capabilities || [],
        entry: json.entry,
        status: 'AVAILABLE',
        installed: false,
      });
    } catch (error) {
      console.error(`[PluginRegistry] Error reading ${manifestPath}:`, error);
    }
  }

  return plugins;
}

/**
 * Get all plugins, enriched with installation status for a tenant.
 */
export async function getPluginsForTenant(
  tenantId: string,
  options?: { category?: string }
): Promise<{ plugins: PluginInfo[]; total: number; installed: number }> {
  // Scan the filesystem for available plugins
  const scannedPlugins = await scanPluginsDirectory();

  // Get installed plugins for this tenant
  const installedPlugins = await db.installedPlugin.findMany({
    where: { tenantId },
    include: { plugin: true },
  });

  const installedMap = new Map<string, (typeof installedPlugins)[number]>();
  for (const ip of installedPlugins) {
    installedMap.set(ip.pluginId, ip);
  }

  // Ensure all scanned plugins exist in the Plugin DB table
  for (const plugin of scannedPlugins) {
    try {
      await db.plugin.upsert({
        where: { slug: plugin.slug },
        update: {
          name: plugin.name,
          description: plugin.description,
          version: plugin.version,
          capabilities: JSON.stringify(plugin.capabilities),
        },
        create: {
          id: plugin.id,
          name: plugin.name,
          slug: plugin.slug,
          description: plugin.description,
          version: plugin.version,
          author: plugin.author,
          category: 'CUSTOM',
          status: 'AVAILABLE',
          capabilities: JSON.stringify(plugin.capabilities),
          settings: '{}',
        },
      });
    } catch (error) {
      console.warn(`[PluginRegistry] Error upserting plugin "${plugin.slug}":`, error);
    }
  }

  // Enrich scanned plugins with installation status
  const enriched: PluginInfo[] = scannedPlugins.map((plugin) => {
    const installed = installedMap.get(plugin.id);
    return {
      ...plugin,
      installed: !!installed,
      installStatus: installed?.status ?? null,
      installedAt: installed?.installedAt ?? null,
      installSettings: installed ? JSON.parse(installed.settings || '{}') : null,
      status: installed?.status === 'ACTIVE' ? 'ACTIVE'
        : installed?.status === 'DISABLED' ? 'DISABLED'
        : installed ? 'INSTALLED'
        : 'AVAILABLE',
    };
  });

  return {
    plugins: enriched,
    total: enriched.length,
    installed: installedPlugins.length,
  };
}

/**
 * Get a single plugin by slug, enriched with installation status.
 */
export async function getPluginBySlug(
  slug: string,
  tenantId?: string
): Promise<PluginInfo | null> {
  // Try to find in DB first
  const dbPlugin = await db.plugin.findUnique({
    where: { slug },
  });

  if (!dbPlugin) {
    // Try scanning filesystem
    const scanned = await scanPluginsDirectory();
    return scanned.find(p => p.slug === slug) || null;
  }

  let installed = null;
  if (tenantId) {
    installed = await db.installedPlugin.findUnique({
      where: {
        tenantId_pluginId: { tenantId, pluginId: dbPlugin.id },
      },
    });
  }

  return {
    id: dbPlugin.id,
    name: dbPlugin.name,
    slug: dbPlugin.slug,
    description: dbPlugin.description || '',
    version: dbPlugin.version,
    author: dbPlugin.author || undefined,
    capabilities: JSON.parse(dbPlugin.capabilities || '[]'),
    status: installed?.status === 'ACTIVE' ? 'ACTIVE'
      : installed?.status === 'DISABLED' ? 'DISABLED'
      : installed ? 'INSTALLED'
      : 'AVAILABLE',
    installed: !!installed,
    installedAt: installed?.installedAt ?? null,
    installStatus: installed?.status ?? null,
    installSettings: installed ? JSON.parse(installed.settings || '{}') : null,
  };
}

/**
 * Install a plugin for a tenant.
 */
export async function installPlugin(
  tenantId: string,
  pluginSlug: string,
  settings?: Record<string, unknown>
): Promise<{ id: string; pluginId: string; slug: string; status: string }> {
  const dbPlugin = await db.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!dbPlugin) {
    throw new Error(`Plugin "${pluginSlug}" not found in database`);
  }

  const installed = await db.installedPlugin.upsert({
    where: {
      tenantId_pluginId: { tenantId, pluginId: dbPlugin.id },
    },
    update: {
      status: 'INSTALLED',
      settings: JSON.stringify(settings || {}),
    },
    create: {
      tenantId,
      pluginId: dbPlugin.id,
      version: dbPlugin.version,
      status: 'INSTALLED',
      settings: JSON.stringify(settings || {}),
    },
  });

  return {
    id: installed.id,
    pluginId: dbPlugin.id,
    slug: dbPlugin.slug,
    status: installed.status,
  };
}

/**
 * Activate a plugin for a tenant.
 */
export async function activatePlugin(tenantId: string, pluginSlug: string): Promise<void> {
  const dbPlugin = await db.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!dbPlugin) {
    throw new Error(`Plugin "${pluginSlug}" not found`);
  }

  await db.installedPlugin.update({
    where: {
      tenantId_pluginId: { tenantId, pluginId: dbPlugin.id },
    },
    data: { status: 'ACTIVE' },
  });
}

/**
 * Deactivate a plugin for a tenant.
 */
export async function deactivatePlugin(tenantId: string, pluginSlug: string): Promise<void> {
  const dbPlugin = await db.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!dbPlugin) {
    throw new Error(`Plugin "${pluginSlug}" not found`);
  }

  await db.installedPlugin.update({
    where: {
      tenantId_pluginId: { tenantId, pluginId: dbPlugin.id },
    },
    data: { status: 'DISABLED' },
  });
}

/**
 * Uninstall a plugin for a tenant.
 */
export async function uninstallPlugin(tenantId: string, pluginSlug: string): Promise<void> {
  const dbPlugin = await db.plugin.findUnique({ where: { slug: pluginSlug } });
  if (!dbPlugin) {
    throw new Error(`Plugin "${pluginSlug}" not installed`);
  }

  await db.installedPlugin.delete({
    where: {
      tenantId_pluginId: { tenantId, pluginId: dbPlugin.id },
    },
  });
}
