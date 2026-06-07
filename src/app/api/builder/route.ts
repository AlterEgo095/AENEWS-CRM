import { NextRequest, NextResponse } from 'next/server';
import { getBuilderEngine } from '@/core/builder-engine';

/**
 * GET /api/builder
 * List builder components for a tenant.
 * Query params:
 *   - tenantId (required)
 *   - type (optional) — Filter by component type (form, page, widget, etc.)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const type = searchParams.get('type');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    const engine = getBuilderEngine();

    const components = await engine.listComponents(
      tenantId,
      type ? (type as any) : undefined
    );
    const stats = await engine.getStats();

    return NextResponse.json({
      components,
      total: components.length,
      stats,
    });
  } catch (error) {
    console.error('[GET /api/builder] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch builder components' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/builder
 * Create a new builder component.
 * Body: { tenantId, type, name, description?, config?, pluginId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, type, name, description, config, pluginId } = body;

    if (!tenantId || !type || !name) {
      return NextResponse.json(
        { error: 'tenantId, type, and name are required' },
        { status: 400 }
      );
    }

    const engine = getBuilderEngine();

    const component = await engine.createComponent(
      type,
      name,
      tenantId,
      config,
      pluginId
    );

    return NextResponse.json(
      {
        message: `Component "${name}" created successfully`,
        component,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('[POST /api/builder] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create component';

    let status = 500;
    if (message.includes('Invalid component type') || message.includes('required')) {
      status = 422;
    }

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
