import { NextRequest, Response } from 'next/server';
import { getPluginsForTenant, installPlugin } from '@/lib/plugin-registry';
import { eventBus, EVENT_TYPES } from '@/lib/event-bus';

/**
 * GET /api/plugins
 * Returns all scanned plugins enriched with installation status.
 * Query params:
 *   - tenantId (required)
 *   - category (optional)
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

    const result = await getPluginsForTenant(tenantId, {
      category: category || undefined,
    });

    return Response.json(result);
  } catch (error) {
    console.error('[GET /api/plugins] Error:', error);
    return Response.json(
      { error: 'Failed to fetch plugins' },
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
    const { tenantId, pluginSlug, settings } = body;

    if (!tenantId || !pluginSlug) {
      return Response.json(
        { error: 'tenantId and pluginSlug are required' },
        { status: 400 }
      );
    }

    const installed = await installPlugin(tenantId, pluginSlug, settings);

    await eventBus.emit(EVENT_TYPES.PLUGIN_INSTALLED, {
      tenantId,
      pluginId: installed.pluginId,
      pluginSlug,
    });

    return Response.json({
      message: `Plugin "${pluginSlug}" installed successfully`,
      installed,
    }, { status: 201 });
  } catch (error: unknown) {
    console.error('[POST /api/plugins] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to install plugin';
    const status = message.includes('not found') ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
