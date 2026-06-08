import { NextRequest, Response } from 'next/server';
import { db } from '@/lib/db';
import { eventBus, EVENT_TYPES } from '@/lib/event-bus';

/**
 * GET /api/notifications
 * Returns notifications for a tenant, optionally filtered by user and read status.
 * Query params:
 *   - tenantId (required)
 *   - userId (optional)
 *   - isRead (optional): "true" or "false"
 *   - limit (optional): default 50
 *   - offset (optional): default 0
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const userId = searchParams.get('userId');
    const isReadParam = searchParams.get('isRead');
    const countOnly = searchParams.get('countOnly') === 'true';
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const offset = Number(searchParams.get('offset')) || 0;

    if (!tenantId) {
      return Response.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { tenantId };
    if (userId) where.userId = userId;
    if (isReadParam !== null) where.isRead = isReadParam === 'true';

    // countOnly mode: lightweight endpoint for badge polling
    if (countOnly) {
      const unread = await db.notification.count({
        where: { ...where, isRead: false },
      });
      return Response.json({ unread });
    }

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { ...where, isRead: false },
      }),
    ]);

    return Response.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        tenantId: n.tenantId,
        userId: n.userId,
        type: n.type,
        title: n.title,
        message: n.message,
        data: JSON.parse(n.data),
        isRead: n.isRead,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      unreadCount,
    });
  } catch (error) {
    console.error('[GET /api/notifications] Error:', error);
    return Response.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Mark all notifications as read for a user/tenant.
 * Body: { tenantId, userId }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, userId } = body;

    if (!tenantId) {
      return Response.json(
        { error: 'tenantId is required' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { tenantId, isRead: false };
    if (userId) where.userId = userId;

    const result = await db.notification.updateMany({
      where,
      data: { isRead: true },
    });

    return Response.json({
      message: `${result.count} notification(s) marked as read`,
      count: result.count,
    });
  } catch (error) {
    console.error('[PATCH /api/notifications] Error:', error);
    return Response.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Create a new notification.
 * Body: { tenantId, userId, type, title, message?, data? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, userId, type, title, message, data = {} } = body;

    // Validation
    if (!tenantId || !userId || !type || !title) {
      return Response.json(
        { error: 'tenantId, userId, type, and title are required' },
        { status: 400 }
      );
    }

    const notification = await db.notification.create({
      data: {
        tenantId,
        userId,
        type,
        title,
        message: message ?? null,
        data: JSON.stringify(data),
        isRead: false,
      },
    });

    // Emit event
    await eventBus.emit(EVENT_TYPES.NOTIFICATION_CREATED, {
      notificationId: notification.id,
      tenantId,
      userId,
      type,
      title,
    });

    return Response.json(
      {
        message: 'Notification created successfully',
        notification: {
          id: notification.id,
          tenantId: notification.tenantId,
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: JSON.parse(notification.data),
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/notifications] Error:', error);
    return Response.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}
