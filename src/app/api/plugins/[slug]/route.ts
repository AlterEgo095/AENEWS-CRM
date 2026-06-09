import { NextRequest, Response } from 'next/server';
import { getPluginEngine } from '@/core/plugin-engine';
import { eventBus, EVENT_TYPES } from '@/lib/event-bus';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

/**
 * GET /api/plugins/[slug]
 * Returns a single plugin detail with installation status + engine registration info.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const engine = getPluginEngine();
    const manifest = await engine.getPluginManifest(slug);

    if (!manifest) {
      return Response.json({ error: `Plugin "${slug}" not found` }, { status: 404 });
    }

    const stats = engine.getStats();

    return Response.json({
      manifest,
      engineStats: stats,
    });
  } catch (error) {
    console.error(`[GET /api/plugins/${(await context.params).slug}] Error:`, error);
    return Response.json({ error: 'Failed to fetch plugin' }, { status: 500 });
  }
}

/**
 * POST /api/plugins/[slug]
 * Activate, deactivate, or reload a plugin using the Plugin Engine.
 * The Engine handles:
 *   - Manifest validation
 *   - DB record creation/update
 *   - Registration into UI Registry (menus, dashboard cards, commands, widgets)
 *   - Registration into Tool Registry
 *   - Registration into Capability Registry
 *   - Permission role creation
 *   - Event emission
 * Body: { tenantId, action: "activate" | "deactivate" | "reload" }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    const { tenantId, action } = body;

    if (!tenantId) {
      return Response.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const engine = getPluginEngine();

    if (action === 'activate') {
      const result = await engine.activatePlugin(slug, tenantId);
      return Response.json({
        message: `Plugin "${slug}" activated successfully`,
        registered: result.registered,
        errors: result.errors,
      });
    }

    if (action === 'deactivate') {
      await engine.deactivatePlugin(slug, tenantId);
      return Response.json({ message: `Plugin "${slug}" deactivated successfully` });
    }

    if (action === 'reload') {
      const result = await engine.reloadPlugin(
        (await engine.getPluginManifest(slug))!
      );
      return Response.json({
        message: `Plugin "${slug}" reloaded successfully`,
        registered: result.registered,
        errors: result.errors,
      });
    }

    return Response.json({ error: 'action must be "activate", "deactivate", or "reload"' }, { status: 400 });
  } catch (error: unknown) {
    console.error(`[POST /api/plugins/${(await context.params).slug}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to update plugin';
    const status = message.includes('not found') || message.includes('not installed') ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/plugins/[slug]
 * Uninstall a plugin for a tenant.
 * Query params: tenantId (required)
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return Response.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const engine = getPluginEngine();
    await engine.uninstallPlugin(slug, tenantId);

    return Response.json({ message: `Plugin "${slug}" uninstalled successfully` });
  } catch (error: unknown) {
    console.error(`[DELETE /api/plugins/${(await context.params).slug}] Error:`, error);
    const message = error instanceof Error ? error.message : 'Failed to uninstall plugin';
    const status = message.includes('not found') || message.includes('not installed') ? 404 : 500;
    return Response.json({ error: message }, { status });
  }
}
