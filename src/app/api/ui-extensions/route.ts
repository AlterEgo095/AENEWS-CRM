import { NextResponse } from 'next/server';
import { getPluginEngine } from '@/core/plugin-engine';
import { getUIRegistry } from '@/core/ui-registry';

/**
 * GET /api/ui-extensions
 * Returns all UI extensions registered by active plugins.
 * The response contains all 7 extension categories: sidebar, topbar,
 * pages, widgets, dashboardCards, actions, and commands.
 */
export async function GET() {
  try {
    // Initialize the engine on first request to ensure plugins are registered
    const engine = getPluginEngine();
    if (!engine.getStats().initialized) {
      await engine.initialize();
    }

    const registry = getUIRegistry();
    const extensions = registry.exportAll();
    const stats = registry.getStats();
    const engineStats = engine.getStats();

    return NextResponse.json({
      ...extensions,
      stats,
      engine: engineStats,
    });
  } catch (error) {
    console.error('[GET /api/ui-extensions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch UI extensions' },
      { status: 500 }
    );
  }
}
