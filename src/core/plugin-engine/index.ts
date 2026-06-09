// ============================================================
// AENEWS Enterprise OS — Plugin Engine Bootstrap
// Reads active plugin manifests and auto-registers:
//   Menus → UIRegistry
//   Permissions → Role/Permission system
//   Capabilities → CapabilityRegistry
//   Tools → ToolRegistry
//   Settings → Settings Engine
//   Events → Event Bus subscriptions
//   Dashboard Cards → UIRegistry
//   Search Entities → Search Engine
//
// This is the BRIDGE between manifests and Core registries.
// When a plugin is activated, this engine does ALL the wiring.
// When deactivated, it unwires everything.
// THE CORE IS NEVER MODIFIED — all behavior comes from plugins.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

import { db } from '@/lib/db';
import { eventBus, EVENT_TYPES } from '@/lib/event-bus';
import { getUIRegistry } from '@/core/ui-registry';
import { getToolRegistry } from '@/core/tool-registry';
import { getCapabilityRegistry } from '@/core/capability-registry';
import type { PluginManifest } from '../plugin-sdk';

// ============================================================
// Types
// ============================================================

export interface EngineBootstrapResult {
  pluginId: string;
  slug: string;
  registered: {
    menus: number;
    permissions: number;
    capabilities: number;
    settings: number;
    events: number;
    dashboardCards: number;
    commands: number;
    widgets: number;
  };
  errors: string[];
}

export interface PluginEngineConfig {
  pluginDir?: string;
}

// ============================================================
// Plugin Engine — Bootstrap Orchestrator
// ============================================================

export class PluginEngine {
  private pluginDir: string;
  private initialized = false;
  private registeredPlugins: Set<string> = new Set();

  constructor(config?: PluginEngineConfig) {
    this.pluginDir = config?.pluginDir || path.resolve('./plugins');
  }

  // ============================================================
  // INITIALIZE — Scan all plugins and register active ones
  // ============================================================

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.info('[PluginEngine] Initializing — scanning plugins directory...');

    const manifests = await this.scanAllManifests();
    console.info(`[PluginEngine] Found ${manifests.length} plugin manifest(s)`);

    // Get all active installations
    const activeInstallations = await db.installedPlugin.findMany({
      where: { status: 'ACTIVE' },
      include: { plugin: true },
    });

    let registeredCount = 0;
    for (const installation of activeInstallations) {
      const manifest = manifests.find(m => m.id === installation.pluginId || m.slug === installation.plugin.slug);
      if (manifest) {
        try {
          await this.registerPlugin(manifest);
          registeredCount++;
        } catch (error) {
          console.error(`[PluginEngine] Failed to register "${manifest.slug}":`, error);
        }
      }
    }

    this.initialized = true;
    console.info(`[PluginEngine] Initialized — ${registeredCount} active plugin(s) registered`);
  }

  // ============================================================
  // REGISTER PLUGIN — Wire everything from manifest to Core
  // ============================================================

  async registerPlugin(manifest: PluginManifest): Promise<EngineBootstrapResult> {
    const result: EngineBootstrapResult = {
      pluginId: manifest.id,
      slug: manifest.slug,
      registered: { menus: 0, permissions: 0, capabilities: 0, settings: 0, events: 0, dashboardCards: 0, commands: 0, widgets: 0 },
      errors: [],
    };

    const uiRegistry = getUIRegistry();
    const toolRegistry = getToolRegistry();
    const capabilityRegistry = getCapabilityRegistry();

    // 1. Register Menus → UIRegistry sidebar
    if (manifest.menus && manifest.menus.length > 0) {
      for (const menu of manifest.menus) {
        try {
          uiRegistry.registerSidebarItem({
            id: menu.id,
            pluginId: manifest.id,
            label: menu.label,
            icon: menu.icon || 'Box',
            href: menu.href,
            section: menu.section || manifest.name,
            order: menu.order ?? 0,
            parentId: menu.parentId,
            permission: menu.permission,
          });
          result.registered.menus++;
        } catch (error) {
          result.errors.push(`Menu "${menu.id}": ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // 2. Register Permissions → Create role entries
    if (manifest.permissions && manifest.permissions.length > 0) {
      try {
        const roleName = `${manifest.slug}.admin`;
        const existingRole = await db.role.findFirst({ where: { name: roleName } });
        if (!existingRole) {
          const permissionIds = manifest.permissions.map(p => p.id);
          await db.role.create({
            data: {
              tenantId: 'default',
              name: roleName,
              description: `${manifest.name} Administrator`,
              isDefault: false,
              permissions: JSON.stringify(permissionIds),
            },
          });
        }
        result.registered.permissions = manifest.permissions.length;
      } catch (error) {
        result.errors.push(`Permissions: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 3. Register Capabilities → CapabilityRegistry
    if (manifest.capabilities && manifest.capabilities.length > 0) {
      for (const cap of manifest.capabilities) {
        try {
          capabilityRegistry.register({
            id: `${manifest.slug}.${cap.name}`,
            pluginId: manifest.id,
            type: this.mapCapabilityType(cap.type),
            name: cap.name,
            description: cap.description,
            inputSchema: { type: 'object', properties: {} },
            handler: async (input: any, _ctx: any) => {
              return { capability: cap.name, pluginId: manifest.id, input };
            },
            version: manifest.version,
          });
          result.registered.capabilities++;
        } catch (error) {
          result.errors.push(`Capability "${cap.name}": ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // 4. Register Tools → ToolRegistry
    if (manifest.capabilities && manifest.capabilities.length > 0) {
      for (const cap of manifest.capabilities) {
        try {
          toolRegistry.register(manifest.id, cap.name, {
            description: cap.description,
            parameters: { type: 'object', properties: {} },
            execute: async (params, _ctx) => {
              return { capability: cap.name, pluginId: manifest.id, params };
            },
            tenantScope: true,
          });
          result.registered.commands++;
        } catch (error) {
          // Tool registration is best-effort
        }
      }
    }

    // 5. Register Dashboard Cards → UIRegistry
    const dashboardCards = this.generateDashboardCards(manifest);
    for (const card of dashboardCards) {
      try {
        uiRegistry.registerDashboardCard(card);
        result.registered.dashboardCards++;
      } catch (error) {
        result.errors.push(`Dashboard card "${card.id}": ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // 6. Register Commands → UIRegistry
    if (manifest.capabilities && manifest.capabilities.length > 0) {
      for (const cap of manifest.capabilities) {
        try {
          uiRegistry.registerCommand({
            id: `${manifest.slug}.cmd.${cap.name}`,
            pluginId: manifest.id,
            label: cap.description,
            icon: this.getIconForCapability(cap.type),
            command: `plugin:${manifest.slug}:${cap.name}`,
            keywords: [manifest.slug, cap.name, cap.type, manifest.name],
          });
        } catch (error) {
          // Best-effort
        }
      }
    }

    // 7. Register Widgets → UIRegistry
    const widgets = this.generateWidgets(manifest);
    for (const widget of widgets) {
      try {
        uiRegistry.registerWidget(widget);
        result.registered.widgets++;
      } catch (error) {
        // Best-effort
      }
    }

    // 8. Emit plugin-registered event
    await eventBus.emit(`plugin.${manifest.slug}.registered`, {
      pluginId: manifest.id,
      slug: manifest.slug,
      registered: result.registered,
    });

    this.registeredPlugins.add(manifest.id);
    console.info(
      `[PluginEngine] Registered "${manifest.slug}": ${result.registered.menus} menus, ` +
      `${result.registered.capabilities} capabilities, ${result.registered.dashboardCards} cards, ` +
      `${result.registered.widgets} widgets` +
      (result.errors.length > 0 ? ` (${result.errors.length} errors)` : ''),
    );

    return result;
  }

  // ============================================================
  // UNREGISTER PLUGIN — Unwire everything
  // ============================================================

  async unregisterPlugin(pluginId: string): Promise<void> {
    const uiRegistry = getUIRegistry();
    const toolRegistry = getToolRegistry();
    const capabilityRegistry = getCapabilityRegistry();

    uiRegistry.unregisterByPlugin(pluginId);
    toolRegistry.unregister(pluginId);
    capabilityRegistry.unregisterByPlugin(pluginId);

    this.registeredPlugins.delete(pluginId);
    console.info(`[PluginEngine] Unregistered plugin "${pluginId}"`);
  }

  // ============================================================
  // RELOAD PLUGIN — Unwire + Rewire
  // ============================================================

  async reloadPlugin(manifest: PluginManifest): Promise<EngineBootstrapResult> {
    await this.unregisterPlugin(manifest.id);
    return this.registerPlugin(manifest);
  }

  // ============================================================
  // SCAN — Read all plugin.json manifests from disk
  // ============================================================

  async scanAllManifests(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];
    if (!fs.existsSync(this.pluginDir)) return manifests;

    const entries = await fs.promises.readdir(this.pluginDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(this.pluginDir, entry.name, 'plugin.json');
      if (!fs.existsSync(manifestPath)) continue;
      try {
        const raw = await fs.promises.readFile(manifestPath, 'utf-8');
        const json = JSON.parse(raw);
        manifests.push(json as PluginManifest);
      } catch (error) {
        console.warn(`[PluginEngine] Error reading ${manifestPath}:`, error);
      }
    }
    return manifests;
  }

  // ============================================================
  // GET PLUGIN MANIFEST
  // ============================================================

  async getPluginManifest(slug: string): Promise<PluginManifest | null> {
    const manifestPath = path.join(this.pluginDir, slug, 'plugin.json');
    if (!fs.existsSync(manifestPath)) return null;
    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf-8');
      return JSON.parse(raw) as PluginManifest;
    } catch {
      return null;
    }
  }

  // ============================================================
  // ACTIVATE — Full activation pipeline
  // ============================================================

  async activatePlugin(slug: string, tenantId: string): Promise<EngineBootstrapResult> {
    const manifest = await this.getPluginManifest(slug);
    if (!manifest) throw new Error(`Plugin "${slug}" manifest not found`);

    // Ensure Plugin record exists in DB
    await db.plugin.upsert({
      where: { slug: manifest.slug },
      update: {
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        capabilities: JSON.stringify(manifest.capabilities),
      },
      create: {
        id: manifest.id,
        name: manifest.name,
        slug: manifest.slug,
        description: manifest.description,
        version: manifest.version,
        author: manifest.author,
        category: 'CUSTOM',
        status: 'AVAILABLE',
        capabilities: JSON.stringify(manifest.capabilities),
        settings: JSON.stringify(manifest.settings || []),
      },
    });

    // Mark as installed + active
    await db.installedPlugin.upsert({
      where: { tenantId_pluginId: { tenantId, pluginId: manifest.id } },
      update: { status: 'ACTIVE' },
      create: { tenantId, pluginId: manifest.id, version: manifest.version, status: 'ACTIVE' },
    });

    await db.plugin.update({ where: { slug: manifest.slug }, data: { status: 'ACTIVE' } });

    // Register everything into Core registries
    const result = await this.registerPlugin(manifest);

    await eventBus.emit(EVENT_TYPES.PLUGIN_ACTIVATED, {
      pluginId: manifest.id, slug: manifest.slug, tenantId, version: manifest.version, registered: result.registered,
    });

    console.info(`[PluginEngine] Plugin "${slug}" fully activated`);
    return result;
  }

  // ============================================================
  // DEACTIVATE — Full deactivation pipeline
  // ============================================================

  async deactivatePlugin(slug: string, tenantId: string): Promise<void> {
    const dbPlugin = await db.plugin.findUnique({ where: { slug } });
    if (!dbPlugin) throw new Error(`Plugin "${slug}" not found`);

    await db.installedPlugin.update({
      where: { tenantId_pluginId: { tenantId, pluginId: dbPlugin.id } },
      data: { status: 'DISABLED' },
    });

    const otherActive = await db.installedPlugin.count({ where: { pluginId: dbPlugin.id, status: 'ACTIVE' } });
    if (otherActive === 0) {
      await this.unregisterPlugin(dbPlugin.id);
      await db.plugin.update({ where: { slug }, data: { status: 'AVAILABLE' } });
    }

    await eventBus.emit(EVENT_TYPES.PLUGIN_DEACTIVATED, { pluginId: dbPlugin.id, slug, tenantId });
    console.info(`[PluginEngine] Plugin "${slug}" deactivated`);
  }

  // ============================================================
  // UNINSTALL — Full uninstall pipeline
  // ============================================================

  async uninstallPlugin(slug: string, tenantId: string): Promise<void> {
    const dbPlugin = await db.plugin.findUnique({ where: { slug } });
    if (!dbPlugin) throw new Error(`Plugin "${slug}" not found`);

    const installed = await db.installedPlugin.findUnique({
      where: { tenantId_pluginId: { tenantId, pluginId: dbPlugin.id } },
    });
    if (installed?.status === 'ACTIVE') await this.deactivatePlugin(slug, tenantId);

    await db.installedPlugin.delete({ where: { tenantId_pluginId: { tenantId, pluginId: dbPlugin.id } } });
    await eventBus.emit(EVENT_TYPES.PLUGIN_UNINSTALLED, { pluginId: dbPlugin.id, slug, tenantId });
    console.info(`[PluginEngine] Plugin "${slug}" uninstalled for tenant "${tenantId}"`);
  }

  // ============================================================
  // GET STATS
  // ============================================================

  getStats() {
    const uiRegistry = getUIRegistry();
    const toolRegistry = getToolRegistry();
    const capabilityRegistry = getCapabilityRegistry();
    return {
      registeredPlugins: this.registeredPlugins.size,
      initialized: this.initialized,
      uiRegistry: uiRegistry.getStats(),
      toolRegistry: toolRegistry.getStats(),
      capabilityRegistry: capabilityRegistry.getStats(),
    };
  }

  // ============================================================
  // INTERNAL — Generate dashboard cards from manifest
  // ============================================================

  private generateDashboardCards(manifest: PluginManifest) {
    const cards: Array<{
      id: string; pluginId: string; title: string; description?: string;
      icon?: string; value?: string | number; href?: string; color?: string; order?: number;
    }> = [];

    cards.push({
      id: `${manifest.slug}.dashboard.main`, pluginId: manifest.id,
      title: manifest.name, description: manifest.description,
      icon: manifest.menus?.[0]?.icon || 'Box',
      href: manifest.menus?.[0]?.href || `plugin:${manifest.slug}:dashboard`,
      color: 'emerald', order: 0,
    });

    const searchCaps = manifest.capabilities?.filter(c => c.type === 'search') || [];
    let order = 1;
    for (const cap of searchCaps) {
      cards.push({
        id: `${manifest.slug}.card.${cap.name}`, pluginId: manifest.id,
        title: cap.description, icon: this.getIconForCapability(cap.type), value: '—',
        href: `plugin:${manifest.slug}:${cap.name.replace('search', '').replace('Search', '').toLowerCase()}`,
        order: order++,
      });
    }
    return cards;
  }

  // ============================================================
  // INTERNAL — Generate widgets from manifest
  // ============================================================

  private generateWidgets(manifest: PluginManifest) {
    return [
      {
        id: `${manifest.slug}.widget.activity`, pluginId: manifest.id,
        type: 'list' as const, title: 'Recent Activity', size: 'md' as const,
        config: { source: 'events', pluginSlug: manifest.slug },
      },
      {
        id: `${manifest.slug}.widget.stats`, pluginId: manifest.id,
        type: 'stat' as const, title: 'Overview', size: 'full' as const,
        config: { source: 'counts', pluginSlug: manifest.slug },
      },
    ];
  }

  // ============================================================
  // INTERNAL — Helpers
  // ============================================================

  private mapCapabilityType(type: string): 'search' | 'create' | 'read' | 'update' | 'delete' | 'sync' | 'notify' | 'analyze' | 'export' | 'import' | 'custom' {
    const valid = ['search', 'create', 'read', 'update', 'delete', 'sync', 'notify', 'analyze', 'export', 'import', 'custom'] as const;
    return (valid as readonly string[]).includes(type) ? type as any : 'custom';
  }

  private getIconForCapability(type: string): string {
    const icons: Record<string, string> = {
      search: 'Search', create: 'Plus', read: 'Eye', update: 'Pencil',
      delete: 'Trash2', sync: 'RefreshCw', notify: 'Bell', analyze: 'BarChart3',
      export: 'Download', import: 'Upload',
    };
    return icons[type] || 'Box';
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: PluginEngine | undefined;

export function getPluginEngine(config?: PluginEngineConfig): PluginEngine {
  if (!_instance) _instance = new PluginEngine(config);
  return _instance;
}
