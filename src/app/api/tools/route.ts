import { NextRequest, NextResponse } from 'next/server';
import { getToolRegistry } from '@/core/tool-registry';

/**
 * GET /api/tools
 * Returns available tools for the current tenant.
 * Query params:
 *   - tenantId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    const registry = getToolRegistry();

    // Try to refresh tenant data first
    try {
      await registry.refreshTenant(tenantId);
    } catch {
      // DB might not be available
    }

    const allTools = registry.getAll();
    const tenantTools = registry.getForTenant(tenantId);

    return NextResponse.json({
      tools: allTools.map((t) => ({
        name: t.name,
        description: t.description,
        pluginId: t.pluginId,
        pluginName: t.pluginName,
        parameters: t.parameters,
        available: tenantTools.some((tt) => tt.name === t.name),
      })),
      total: allTools.length,
      availableForTenant: tenantTools.length,
    });
  } catch (error) {
    console.error('[GET /api/tools] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tools' },
      { status: 500 }
    );
  }
}
