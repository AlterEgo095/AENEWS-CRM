// ============================================================
// AENEWS Enterprise OS — Event Bus System
// In-memory pub/sub event bus for cross-plugin communication
// ============================================================

export type EventHandler = (payload: unknown) => void | Promise<void>;

// Default event types used throughout the system
export const EVENT_TYPES = {
  PLUGIN_INSTALLED: 'plugin.installed',
  PLUGIN_UNINSTALLED: 'plugin.uninstalled',
  PLUGIN_ACTIVATED: 'plugin.activated',
  PLUGIN_DEACTIVATED: 'plugin.deactivated',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_READ: 'notification.read',
  WORKFLOW_TRIGGERED: 'workflow.triggered',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',
  CHAT_MESSAGE: 'chat.message',
  AUDIT_LOG: 'audit.log',
} as const;

type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES] | string;

export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on(event: EventType, handler: EventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Remove a specific handler from an event.
   */
  off(event: EventType, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
      // Clean up empty sets to prevent memory leaks
      if (eventHandlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  /**
   * Emit an event to all subscribers. Handlers run concurrently.
   */
  async emit(event: EventType, payload?: unknown): Promise<void> {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers || eventHandlers.size === 0) return;

    const promises = Array.from(eventHandlers).map(async (handler) => {
      try {
        await handler(payload);
      } catch (error) {
        console.error(`[EventBus] Error in handler for "${event}":`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Subscribe to an event only once. Automatically unsubscribes after the first emission.
   * Returns an unsubscribe function (for manual cleanup before the event fires).
   */
  once(event: EventType, handler: EventHandler): () => void {
    const onceWrapper: EventHandler = async (payload: unknown) => {
      this.off(event, onceWrapper);
      await handler(payload);
    };

    return this.on(event, onceWrapper);
  }

  /**
   * Remove all handlers for a specific event, or all events if no event specified.
   */
  clear(event?: EventType): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get the number of handlers subscribed to an event.
   */
  listenerCount(event: EventType): number {
    return this.handlers.get(event)?.size ?? 0;
  }
}

// Singleton instance
export const eventBus = new EventBus();
