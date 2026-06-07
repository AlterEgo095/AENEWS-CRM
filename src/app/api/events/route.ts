import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/events
 * Query events from the event store.
 * Query params:
 *   - tenantId (optional)
 *   - eventType (optional)
 *   - limit (optional, default 50, max 200)
 *   - offset (optional, default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const eventType = searchParams.get('eventType');
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const offset = Number(searchParams.get('offset')) || 0;

    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    if (eventType) where.eventType = eventType;

    const [events, total] = await Promise.all([
      db.eventLog.findMany({
        where: Object.keys(where).length > 0 ? where : undefined,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          tenantId: true,
          eventType: true,
          payload: true,
          sourcePlugin: true,
          createdAt: true,
        },
      }),
      db.eventLog.count({
        where: Object.keys(where).length > 0 ? where : undefined,
      }),
    ]);

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        tenantId: e.tenantId,
        eventType: e.eventType,
        payload: (() => {
          try { return JSON.parse(e.payload); }
          catch { return e.payload; }
        })(),
        sourcePlugin: e.sourcePlugin,
        createdAt: e.createdAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[GET /api/events] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
