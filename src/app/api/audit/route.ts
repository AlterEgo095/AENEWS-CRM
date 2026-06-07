import { NextRequest, Response } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/audit
 * Returns audit log entries for a tenant.
 * Query params:
 *   - tenantId (required)
 *   - userId (optional)
 *   - action (optional)
 *   - entityType (optional)
 *   - limit (optional): default 50
 *   - offset (optional): default 0
 *   - startDate (optional): ISO date string
 *   - endDate (optional): ISO date string
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');
    const entityType = searchParams.get('entityType');
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const offset = Number(searchParams.get('offset')) || 0;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!tenantId) {
      return Response.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = { tenantId };

    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    // Date range filter
    if (startDate || endDate) {
      const createdAt: Record<string, unknown> = {};
      if (startDate) createdAt.gte = new Date(startDate);
      if (endDate) createdAt.lte = new Date(endDate);
      where.createdAt = createdAt;
    }

    const [auditLogs, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      db.auditLog.count({ where }),
    ]);

    return Response.json({
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        tenantId: log.tenantId,
        userId: log.userId,
        user: log.user
          ? {
              id: log.user.id,
              email: log.user.email,
              name: `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim(),
            }
          : null,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        metadata: JSON.parse(log.metadata),
        ipAddress: log.ipAddress,
        createdAt: log.createdAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[GET /api/audit] Error:', error);
    return Response.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
