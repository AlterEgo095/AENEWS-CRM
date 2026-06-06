import { NextRequest, Response } from 'next/server';
import { db } from '@/lib/db';
import { getPluginCatalog, registryCategoryToPrisma } from '@/lib/plugin-registry';
import { eventBus, EVENT_TYPES } from '@/lib/event-bus';

/**
 * GET /api/plugins
 * Returns the full plugin catalog enriched with installation status for the current tenant.
 * Query params:
 *   - tenantId (required): the tenant to check installation status for
 *   - category (optional): filter by category
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const category = searchParams.get('category');

    if (!tenantId) {
      return Response.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    // Get all installed plugins for this tenant
    const installedPlugins = await db.installedPlugin.findMany({
      where: { tenantId },
      include: { plugin: true },
    });

    // Build a map for quick lookup
    const installedMap = new Map<string, (typeof installedPlugins)[number]>();
    for (const ip of installedPlugins) {
      installedMap.set(ip.pluginId, ip);
    }

    // Get catalog and enrich with installation status
    let catalog = getPluginCatalog();

    // Ensure all catalog plugins exist in the Plugin DB table
    for (const plugin of catalog) {
      const existing = await db.plugin.findUnique({ where: { slug: plugin.slug } });
      if (!existing) {
        await db.plugin.create({
          data: {
            id: plugin.id,
            name: plugin.name,
            slug: plugin.slug,
            description: plugin.description,
            version: plugin.version,
            iconUrl: null,
            author: plugin.author,
            category: registryCategoryToPrisma(plugin.category) as any,
            status: 'AVAILABLE',
            capabilities: JSON.stringify(plugin.capabilities),
            settings: '{}',
          },
        });
      }
    }

    // Filter by category if requested
    if (category) {
      catalog = catalog.filter((p) => p.category === category);
    }

    // Enrich with installation status
    const enriched = catalog.map((plugin) => {
      const installed = installedMap.get(plugin.id);
      return {
        ...plugin,
        installed: !!installed,
        installStatus: installed?.status ?? null,
        installedAt: installed?.installedAt ?? null,
        installSettings: installed ? JSON.parse(installed.settings) : null,
      };
    });

    return Response.json({
      plugins: enriched,
      total: enriched.length,
      installed: installedPlugins.length,
    });
  } catch (error) {
    console.error('[GET /api/plugins] Error:', error);
    return Response.json(
      { error: 'Failed to fetch plugin catalog' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plugins
 * Install a plugin for a tenant.
 * Body: { tenantId, pluginSlug, settings? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, pluginSlug, settings = {} } = body;

    if (!tenantId || !pluginSlug) {
      return Response.json(
        { error: 'tenantId and pluginSlug are required' },
        { status: 400 }
      );
    }

    // Find the plugin in the catalog
    const catalogPlugin = getPluginCatalog().find((p) => p.slug === pluginSlug);
    if (!catalogPlugin) {
      return Response.json(
        { error: `Plugin "${pluginSlug}" not found in catalog` },
        { status: 404 }
      );
    }

    // Ensure plugin record exists in DB
    const plugin = await db.plugin.upsert({
      where: { slug: pluginSlug },
      update: {},
      create: {
        id: catalogPlugin.id,
        name: catalogPlugin.name,
        slug: catalogPlugin.slug,
        description: catalogPlugin.description,
        version: catalogPlugin.version,
        author: catalogPlugin.author,
        category: registryCategoryToPrisma(catalogPlugin.category) as any,
        status: 'INSTALLED',
        capabilities: JSON.stringify(catalogPlugin.capabilities),
        settings: '{}',
      },
    });

    // Create InstalledPlugin record (unique constraint on tenantId + pluginId)
    const installed = await db.installedPlugin.upsert({
      where: {
        tenantId_pluginId: { tenantId, pluginId: plugin.id },
      },
      update: {
        status: 'INSTALLED',
        settings: JSON.stringify(settings),
      },
      create: {
        tenantId,
        pluginId: plugin.id,
        version: catalogPlugin.version,
        status: 'INSTALLED',
        settings: JSON.stringify(settings),
      },
    });

    // Emit event
    await eventBus.emit(EVENT_TYPES.PLUGIN_INSTALLED, {
      tenantId,
      pluginId: plugin.id,
      pluginSlug,
      installedAt: installed.installedAt,
    });

    return Response.json({
      message: `Plugin "${catalogPlugin.name}" installed successfully`,
      installed: {
        id: installed.id,
        pluginId: plugin.id,
        pluginSlug: plugin.slug,
        status: installed.status,
        installedAt: installed.installedAt,
      },
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/plugins] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to install plugin';
    return Response.json({ error: message }, { status: 500 });
  }
}
