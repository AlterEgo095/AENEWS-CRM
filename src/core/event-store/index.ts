// ============================================================
// AENEWS Enterprise OS — Event Store (Persistent)
// Wraps the Prisma EventLog model for event persistence,
// replay, auditing, and aggregation.
// ============================================================

import { db } from '@/lib/db';

// ============================================================
// Stored Event — represents a persisted event from the DB
// ============================================================

export interface StoredEvent {
  id: string;
  tenantId: string;
  eventType: string;
  /** Parsed payload from the JSON string in the DB */
  payload: unknown;
  /** Plugin that emitted the event (if applicable) */
  sourcePlugin?: string;
  createdAt: Date;
}

// ============================================================
// Query Filter — flexible filtering for event queries
// ============================================================

export interface EventQueryFilter {
  tenantId?: string;
  eventType?: string;
  sourcePlugin?: string;
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

// ============================================================
// Event Aggregate — result of aggregation queries
// ============================================================

export interface EventAggregateResult {
  eventType: string;
  count: number;
  lastOccurredAt: Date | null;
}

// ============================================================
// Event Store
// ============================================================

export class EventStore {
  /**
   * PERSIST: Store an event in the database.
   * Serializes the payload to JSON for storage.
   */
  async persist(event: {
    tenantId: string;
    eventType: string;
    payload: unknown;
    sourcePlugin?: string;
  }): Promise<StoredEvent> {
    const record = await db.eventLog.create({
      data: {
        tenantId: event.tenantId,
        eventType: event.eventType,
        payload: JSON.stringify(event.payload),
        sourcePlugin: event.sourcePlugin,
      },
    });

    return this.toStoredEvent(record);
  }

  /**
   * PERSIST BATCH: Store multiple events in a single transaction.
   * Useful for bulk imports or replay scenarios.
   */
  async persistBatch(events: Array<{
    tenantId: string;
    eventType: string;
    payload: unknown;
    sourcePlugin?: string;
  }>): Promise<StoredEvent[]> {
    const records = await db.eventLog.createMany({
      data: events.map((e) => ({
        tenantId: e.tenantId,
        eventType: e.eventType,
        payload: JSON.stringify(e.payload),
        sourcePlugin: e.sourcePlugin,
      })),
    });

    // createMany doesn't return the created records, so we fetch them back
    // For a more efficient approach, we could use a transaction with individual creates
    const createdEvents = await db.eventLog.findMany({
      where: {
        id: { in: (records as unknown as { lastInsertRowid: number }).lastInsertRowid ? undefined : [] },
      },
      orderBy: { createdAt: 'desc' },
      take: events.length,
    });

    return createdEvents.map((r) => this.toStoredEvent(r));
  }

  /**
   * GET: Retrieve a single event by ID.
   */
  async get(eventId: string): Promise<StoredEvent | null> {
    const record = await db.eventLog.findUnique({
      where: { id: eventId },
    });

    return record ? this.toStoredEvent(record) : null;
  }

  /**
   * REPLAY: Replay events of a specific type for a tenant since a given date.
   * Returns events in chronological order.
   */
  async replay(
    tenantId: string,
    eventType: string,
    since?: Date,
  ): Promise<StoredEvent[]> {
    const records = await db.eventLog.findMany({
      where: {
        tenantId,
        eventType,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((r) => this.toStoredEvent(r));
  }

  /**
   * REPLAY ALL: Replay all events for a tenant (optionally since a given date).
   * Returns events in chronological order.
   */
  async replayAll(
    tenantId: string,
    since?: Date,
  ): Promise<StoredEvent[]> {
    const records = await db.eventLog.findMany({
      where: {
        tenantId,
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((r) => this.toStoredEvent(r));
  }

  /**
   * QUERY: Search events with flexible filters.
   * Returns paginated results with a total count.
   */
  async query(
    filter: EventQueryFilter,
  ): Promise<{ events: StoredEvent[]; total: number }> {
    const where: Record<string, unknown> = {};

    if (filter.tenantId) where.tenantId = filter.tenantId;
    if (filter.eventType) where.eventType = filter.eventType;
    if (filter.sourcePlugin) where.sourcePlugin = filter.sourcePlugin;

    if (filter.since || filter.until) {
      const createdAt: Record<string, unknown> = {};
      if (filter.since) createdAt.gte = filter.since;
      if (filter.until) createdAt.lte = filter.until;
      where.createdAt = createdAt;
    }

    const [events, total] = await Promise.all([
      db.eventLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: filter.offset ?? 0,
        take: filter.limit ?? 50,
      }),
      db.eventLog.count({ where }),
    ]);

    return {
      events: events.map((r) => this.toStoredEvent(r)),
      total,
    };
  }

  /**
   * AGGREGATE: Get event counts grouped by eventType for a tenant.
   * Returns a record mapping eventType -> count.
   */
  async aggregate(
    tenantId: string,
    since?: Date,
  ): Promise<Record<string, number>> {
    const where: Record<string, unknown> = { tenantId };
    if (since) {
      where.createdAt = { gte: since };
    }

    const records = await db.eventLog.findMany({
      where,
      select: {
        eventType: true,
        id: true,
      },
    });

    const counts: Record<string, number> = {};
    for (const record of records) {
      counts[record.eventType] = (counts[record.eventType] ?? 0) + 1;
    }

    return counts;
  }

  /**
   * AGGREGATE DETAILED: Get event counts with last-occurred timestamps.
   * Useful for dashboards and monitoring.
   */
  async aggregateDetailed(
    tenantId: string,
    since?: Date,
  ): Promise<EventAggregateResult[]> {
    const where: Record<string, unknown> = { tenantId };
    if (since) {
      where.createdAt = { gte: since };
    }

    const records = await db.eventLog.findMany({
      where,
      select: {
        eventType: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const map = new Map<string, { count: number; lastAt: Date }>();
    for (const record of records) {
      const existing = map.get(record.eventType);
      if (existing) {
        existing.count++;
        existing.lastAt = record.createdAt;
      } else {
        map.set(record.eventType, {
          count: 1,
          lastAt: record.createdAt,
        });
      }
    }

    return Array.from(map.entries()).map(([eventType, data]) => ({
      eventType,
      count: data.count,
      lastOccurredAt: data.lastAt,
    }));
  }

  /**
   * COUNT: Get total event count for a tenant or with a filter.
   */
  async count(filter?: EventQueryFilter): Promise<number> {
    const where: Record<string, unknown> = {};
    if (filter?.tenantId) where.tenantId = filter.tenantId;
    if (filter?.eventType) where.eventType = filter.eventType;
    if (filter?.sourcePlugin) where.sourcePlugin = filter.sourcePlugin;
    if (filter?.since || filter?.until) {
      const createdAt: Record<string, unknown> = {};
      if (filter?.since) createdAt.gte = filter.since;
      if (filter?.until) createdAt.lte = filter.until;
      where.createdAt = createdAt;
    }

    return db.eventLog.count({ where });
  }

  /**
   * CLEANUP: Delete events older than a given date.
   * Returns the number of deleted events.
   */
  async cleanup(olderThan: Date): Promise<number> {
    const result = await db.eventLog.deleteMany({
      where: {
        createdAt: { lt: olderThan },
      },
    });
    return result.count;
  }

  /**
   * DELETE FOR PLUGIN: Remove all events emitted by a specific plugin.
   * Used during plugin uninstall.
   */
  async deleteForPlugin(sourcePlugin: string): Promise<number> {
    const result = await db.eventLog.deleteMany({
      where: { sourcePlugin },
    });
    return result.count;
  }

  /**
   * DELETE FOR TENANT: Remove all events for a specific tenant.
   * Used during tenant deletion.
   */
  async deleteForTenant(tenantId: string): Promise<number> {
    const result = await db.eventLog.deleteMany({
      where: { tenantId },
    });
    return result.count;
  }

  /**
   * Convert a raw Prisma EventLog record to a StoredEvent.
   * Safely parses the JSON payload.
   */
  private toStoredEvent(record: {
    id: string;
    tenantId: string;
    eventType: string;
    payload: string;
    sourcePlugin: string | null;
    createdAt: Date;
  }): StoredEvent {
    let payload: unknown = {};
    try {
      payload = JSON.parse(record.payload);
    } catch {
      // If payload is not valid JSON, keep it as-is
      payload = record.payload;
    }

    return {
      id: record.id,
      tenantId: record.tenantId,
      eventType: record.eventType,
      payload,
      sourcePlugin: record.sourcePlugin ?? undefined,
      createdAt: record.createdAt,
    };
  }
}

// Singleton instance for convenience
export const eventStore = new EventStore();
