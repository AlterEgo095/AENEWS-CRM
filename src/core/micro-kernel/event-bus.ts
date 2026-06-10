/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * Event Bus — Core Communication Backbone
 *
 * Publish/Subscribe pattern with wildcard matching.
 * All inter-plugin communication flows through the Event Bus.
 */

import type { EventBusEvent, EventBusSubscription } from './types';

let eventCounter = 0;

export class EventBus {
  private subscriptions: Map<string, EventBusSubscription[]> = new Map();
  private eventLog: EventBusEvent[] = [];
  private maxLogSize = 10000;
  private enabled = true;

  /** Subscribe to events matching a pattern (supports * wildcard) */
  subscribe(pattern: string, handler: (event: EventBusEvent) => void | Promise<void>, options?: { once?: boolean; priority?: number }): () => void {
    const sub: EventBusSubscription = {
      id: `sub_${++eventCounter}`,
      pattern,
      handler,
      once: options?.once,
      priority: options?.priority ?? 0,
    };

    if (!this.subscriptions.has(pattern)) {
      this.subscriptions.set(pattern, []);
    }
    this.subscriptions.get(pattern)!.push(sub);

    // Sort by priority (higher first)
    this.subscriptions.get(pattern)!.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Return unsubscribe function
    return () => {
      const subs = this.subscriptions.get(pattern);
      if (subs) {
        const idx = subs.findIndex(s => s.id === sub.id);
        if (idx !== -1) subs.splice(idx, 1);
      }
    };
  }

  /** Publish an event to all matching subscribers */
  async publish(event: Omit<EventBusEvent, 'id' | 'timestamp'>): Promise<void> {
    if (!this.enabled) return;

    const fullEvent: EventBusEvent = {
      ...event,
      id: `evt_${++eventCounter}`,
      timestamp: Date.now(),
    };

    // Log the event
    this.eventLog.push(fullEvent);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    // Find matching subscriptions
    const matched = this._matchSubscriptions(event.type);

    // Execute handlers in priority order
    for (const sub of matched) {
      try {
        await sub.handler(fullEvent);
        if (sub.once) {
          this._removeSubscription(sub);
        }
      } catch (err) {
        console.error(`[EventBus] Handler error for "${event.type}" (${sub.id}):`, err);
      }
    }
  }

  /** Match subscriptions against an event type */
  private _matchSubscriptions(eventType: string): EventBusSubscription[] {
    const all: EventBusSubscription[] = [];
    for (const [pattern, subs] of this.subscriptions) {
      if (this._matches(pattern, eventType)) {
        all.push(...subs);
      }
    }
    return all.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  /** Wildcard pattern matching (e.g. "plugin.*" matches "plugin.activated") */
  private _matches(pattern: string, eventType: string): boolean {
    if (pattern === '*') return true;
    if (pattern === eventType) return true;

    const patternParts = pattern.split('.');
    const eventParts = eventType.split('.');

    if (patternParts.length !== eventParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '*' && patternParts[i] !== eventParts[i]) {
        return false;
      }
    }
    return true;
  }

  /** Remove a specific subscription */
  private _removeSubscription(sub: EventBusSubscription): void {
    for (const [pattern, subs] of this.subscriptions) {
      const idx = subs.findIndex(s => s.id === sub.id);
      if (idx !== -1) {
        subs.splice(idx, 1);
        return;
      }
    }
  }

  /** Get recent event log */
  getLog(filter?: { type?: string; source?: string; limit?: number }): EventBusEvent[] {
    let events = [...this.eventLog];
    if (filter?.type) {
      events = events.filter(e => e.type === filter.type);
    }
    if (filter?.source) {
      events = events.filter(e => e.source === filter.source);
    }
    const limit = filter?.limit || 100;
    return events.slice(-limit);
  }

  /** Get subscription count */
  get subscriptionCount(): number {
    let total = 0;
    for (const subs of this.subscriptions.values()) {
      total += subs.length;
    }
    return total;
  }

  /** Get event count */
  get eventCount(): number {
    return this.eventLog.length;
  }

  /** Enable/disable event bus */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Clear all subscriptions and log */
  clear(): void {
    this.subscriptions.clear();
    this.eventLog = [];
  }
}

// Singleton
let _eventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!_eventBus) {
    _eventBus = new EventBus();
  }
  return _eventBus;
}

export function resetEventBus(): void {
  _eventBus = new EventBus();
}
