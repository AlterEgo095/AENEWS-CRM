import { NextRequest, NextResponse } from 'next/server';
import { getCapabilityRegistry } from '@/core/capability-registry';

/**
 * GET /api/capabilities
 * Returns all registered capabilities from the Capability Registry.
 * Query params:
 *   - type (optional) — Filter by capability type (e.g. "search", "create", "analyze")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const registry = getCapabilityRegistry();

    let capabilities;
    if (type) {
      capabilities = registry.getByType(type as any);
    } else {
      capabilities = registry.getAll();
    }

    const stats = registry.getStats();

    return NextResponse.json({
      capabilities: capabilities.map((cap) => ({
        id: cap.id,
        pluginId: cap.pluginId,
        type: cap.type,
        name: cap.name,
        description: cap.description,
        version: cap.version,
      })),
      total: capabilities.length,
      stats,
    });
  } catch (error) {
    console.error('[GET /api/capabilities] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch capabilities' },
      { status: 500 }
    );
  }
}
