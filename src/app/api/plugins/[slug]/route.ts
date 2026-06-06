import { NextRequest, Response } from 'next/server';
import { db } from '@/lib/db';
import { getPluginBySlug, getPluginCatalog } from '@/lib/plugin-registry';
import { eventBus, EVENT_TYPES } from '@/lib/event-bus';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/plugins/[slug]
 * Returns a single plugin detail with installation status.
 * Query params:
 *   - tenantId (optional): if provided, returns installation status
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    const plugin = getPluginBySlug(slug);
    if (!plugin) {
      return Response.json(
        { error: `Plugin "${slug}" not found` },
        { status: 404 }
      );
    }

    let installed = null;
    if (tenantId) {
      const dbPlugin = await db.plugin.findUnique({ where: { slug } });
      if (dbPlugin) {
        installed = await db.installedPlugin.findUnique({
          where: {
            tenantId_pluginId: { tenantId, pluginId: dbPlugin.id },
          },
        });
      }
    }

    return Response.json({
      ...plugin,
      installed: !!installed,
      installStatus: installed?.status ?? null,
      installedAt: installed?.installedAt ?? null,
      installSettings: installed ? JSON.parse(installed.settings) : null,
    });
  } catch (error) {
    console.error(`[GET /api/plugins/${slug}] Error:`, error);
    return Response.json(
      { error: 'Failed to fetch plugin' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/plugins/[slug]
 * Update plugin settings or status.
 * Body: { tenantId, status?, settings? }
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    const { tenantId, status, settings } = body;

    if (!tenantId) {
      return Response.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const plugin = getPluginBySlug(slug);
    if (!plugin) {
      return Response.json(
        { error: `Plugin "${slug}" not found` },
        { status: 404 }
      );
    }

    // Ensure plugin exists in DB
    const dbPlugin = await db.plugin.findUnique({ where: { slug } });
    if (!dbPlugin) {
      return Response.json(
        { error: `Plugin "${slug}" not found in database. Install it first.` },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (status) {
      updateData.status = status.toUpperCase();
    }
    if (settings) {
      updateData.settings = JSON.stringify(settings);
    }

    const installed = await db.installedPlugin.update({
      where: {
        tenantId_pluginId: { tenantId, pluginId: dbPlugin.id },
      },
      data: updateData,
    });

    // Emit appropriate events
    if (status?.toUpperCase() === 'ACTIVE') {
      await eventBus.emit(EVENT_TYPES.PLUGIN_ACTIVATED, {
        tenantId,
        pluginId: dbPlugin.id,
        pluginSlug: slug,
      });
    } else if (status?.toUpperCase() === 'DISABLED') {
      await eventBus.emit(EVENT_TYPES.PLUGIN_DEACTIVATED, {
        tenantId,
        pluginId: dbPlugin.id,
        pluginSlug: slug,
      });
    }

    return Response.json({
      message: `Plugin "${plugin.name}" updated successfully`,
      installed: {
        id: installed.id,
        status: installed.status,
        settings: JSON.parse(installed.settings),
        updatedAt: installed.updatedAt,
      },
    });
  } catch (error: unknown) {
    console.error(`[PATCH /api/plugins/${slug}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to update plugin';
    return Response.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/plugins/[slug]
 * Uninstall a plugin for a tenant.
 * Query params:
 *   - tenantId (required)
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return Response.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const plugin = getPluginBySlug(slug);
    if (!plugin) {
      return Response.json(
        { error: `Plugin "${slug}" not found` },
        { status: 404 }
      );
    }

    const dbPlugin = await db.plugin.findUnique({ where: { slug } });
    if (!dbPlugin) {
      return Response.json(
        { error: `Plugin "${slug}" not installed` },
        { status: 404 }
      );
    }

    await db.installedPlugin.delete({
      where: {
        tenantId_pluginId: { tenantId, pluginId: dbPlugin.id },
      },
    });

    // Emit event
    await eventBus.emit(EVENT_TYPES.PLUGIN_UNINSTALLED, {
      tenantId,
      pluginId: dbPlugin.id,
      pluginSlug: slug,
    });

    return Response.json({
      message: `Plugin "${plugin.name}" uninstalled successfully`,
    });
  } catch (error: unknown) {
    console.error(`[DELETE /api/plugins/${slug}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to uninstall plugin';
    return Response.json({ error: message }, { status: 500 });
  }
}
