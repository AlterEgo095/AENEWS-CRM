import { NextRequest, NextResponse } from 'next/server';
import { getSearchEngine } from '@/core/search-engine';

/**
 * GET /api/search?q=query
 * Global search across all plugins.
 * Query params:
 *   - q (required) — Search query string
 *   - tenantId (required) — Tenant scope
 *   - limit (optional) — Max results (default 20)
 *   - offset (optional) — Pagination offset (default 0)
 *   - entityType (optional) — Restrict to a single entity type
 *   - pluginId (optional) — Restrict to a single plugin
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const tenantId = searchParams.get('tenantId');
    const limit = Number(searchParams.get('limit')) || 20;
    const offset = Number(searchParams.get('offset')) || 0;
    const entityType = searchParams.get('entityType') || undefined;
    const pluginId = searchParams.get('pluginId') || undefined;

    if (!query) {
      return NextResponse.json(
        { error: 'q (query) parameter is required' },
        { status: 400 }
      );
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId parameter is required' },
        { status: 400 }
      );
    }

    const engine = getSearchEngine();

    const response = await engine.search(query, tenantId, {
      limit,
      offset,
      entityType,
      pluginId,
    });

    return NextResponse.json({
      results: response.results,
      total: response.total,
      facets: response.facets,
    });
  } catch (error) {
    console.error('[GET /api/search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to perform search' },
      { status: 500 }
    );
  }
}
