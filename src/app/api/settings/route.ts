import { NextRequest, NextResponse } from 'next/server';
import { getSettingsEngine } from '@/core/settings-engine';

/**
 * GET /api/settings?pluginId=x&tenantId=y
 * Get resolved settings for a plugin (with tenant overrides applied).
 * Query params:
 *   - pluginId (required)
 *   - tenantId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');
    const tenantId = searchParams.get('tenantId');

    if (!pluginId) {
      return NextResponse.json(
        { error: 'pluginId query parameter is required' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    const engine = getSettingsEngine();

    const settings = await engine.getSettings(pluginId, tenantId);
    const stats = engine.getStats();

    return NextResponse.json({
      pluginId,
      tenantId,
      settings,
      stats,
    });
  } catch (error: unknown) {
    console.error('[GET /api/settings] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch settings';
    const status = message.includes('not registered') ? 404 : 500;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

/**
 * PUT /api/settings
 * Update (override) settings for a plugin at the tenant level.
 * Body: { pluginId, tenantId, settings: Record<string, any> }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { pluginId, tenantId, settings } = body;

    if (!pluginId || !tenantId || !settings) {
      return NextResponse.json(
        { error: 'pluginId, tenantId, and settings are required' },
        { status: 400 }
      );
    }

    if (typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json(
        { error: 'settings must be a key-value object' },
        { status: 400 }
      );
    }

    const engine = getSettingsEngine();

    await engine.setSettings(pluginId, settings, tenantId);

    // Return the updated resolved settings
    const resolved = await engine.getSettings(pluginId, tenantId);

    return NextResponse.json({
      message: `Settings updated for plugin "${pluginId}"`,
      pluginId,
      tenantId,
      settings: resolved,
    });
  } catch (error: unknown) {
    console.error('[PUT /api/settings] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update settings';

    let status = 500;
    if (message.includes('not registered') || message.includes('not found')) {
      status = 404;
    } else if (message.includes('must be') || message.includes('required')) {
      status = 422;
    }

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
