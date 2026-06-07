import { NextResponse } from 'next/server';
import { getUIRegistry } from '@/core/ui-registry';

/**
 * GET /api/ui-extensions
 * Returns all UI extensions registered by plugins.
 * The response contains all 7 extension categories: sidebar, topbar,
 * pages, widgets, dashboardCards, actions, and commands.
 */
export async function GET() {
  try {
    const registry = getUIRegistry();
    const extensions = registry.exportAll();
    const stats = registry.getStats();

    return NextResponse.json({
      ...extensions,
      stats,
    });
  } catch (error) {
    console.error('[GET /api/ui-extensions] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch UI extensions' },
      { status: 500 }
    );
  }
}
