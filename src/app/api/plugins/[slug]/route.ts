import { NextRequest, Response } from 'next/server';
import {
  getPluginBySlug,
  activatePlugin,
  deactivatePlugin,
  uninstallPlugin,
} from '@/lib/plugin-registry';
import { eventBus, EVENT_TYPES } from '@/lib/event-bus';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/plugins/[slug]
 * Returns a single plugin detail with installation status.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    const plugin = await getPluginBySlug(slug, tenantId || undefined);
    if (!plugin) {
      return Response.json(
        { error: `Plugin "${slug}" not found` },
        { status: 404 }
      );
    }

    return Response.json(plugin);
  } catch (error) {
    console.error(`[GET /api/plugins/${(await context.params).slug}] Error:`, error);
    return Response.json(
      { error: 'Failed to fetch plugin' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/plugins/[slug]/activate
 * Activate an installed plugin.
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    const { tenantId, action } = body;

    if (!tenantId) {
      return Response.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    if (action === 'activate') {
      await activatePlugin(tenantId, slug);
      await eventBus.emit(EVENT_TYPES.PLUGIN_ACTIVATED, { tenantId, pluginSlug: slug });
      return Response.json({ message: `Plugin "${slug}" activated successfully` });
    }

    if (action === 'deactivate') {
      await deactivatePlugin(tenantId, slug);
      await eventBus.emit(EVENT_TYPES.PLUGIN_DEACTIVATED, { tenantId, pluginSlug: slug });
      return Response.json({ message: `Plugin "${slug}" deactivated successfully` });
    }

    return Response.json({ error: 'action must be "activate" or "deactivate"' }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update plugin';
    const status = message.includes('not found') || message.includes('not installed') ? 404 : 500;
    return Response.json({ error: message }, { status });
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

    await uninstallPlugin(tenantId, slug);

    await eventBus.emit(EVENT_TYPES.PLUGIN_UNINSTALLED, {
      tenantId,
      pluginSlug: slug,
    });

    return Response.json({ message: `Plugin "${slug}" uninstalled successfully` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to uninstall plugin';
    const status = message.includes('not found') || message.includes('not installed') ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
