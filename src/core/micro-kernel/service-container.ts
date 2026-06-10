/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * Service Container
 *
 * Tous les plugins utilisent exclusivement ces services.
 * Jamais d'import direct entre plugins.
 *
 * Services: logger, config, storage, cache, search, eventBus,
 *           ai, notification, workflow, tenant, security,
 *           billing, settings, metrics
 */

import type { ServiceName, ServiceDescriptor } from './types';

type WatcherCallback = (instance: unknown) => void;

interface ServiceWatcher {
  callback: WatcherCallback;
  disposed: boolean;
}

export class ServiceContainer {
  private services: Map<ServiceName, ServiceDescriptor> = new Map();
  private watchers: Map<ServiceName, ServiceWatcher[]> = new Map();

  /** Register a service instance — only ONE provider per service */
  register(name: ServiceName, instance: unknown, provider: string, version = '1.0.0'): void {
    const existing = this.services.get(name);
    if (existing) {
      console.warn(`[ServiceContainer] Service "${name}" overridden by "${provider}" (was "${existing.provider}")`);
    }

    const descriptor: ServiceDescriptor = {
      name,
      version,
      instance,
      provider,
      state: 'ready',
    };

    this.services.set(name, descriptor);

    // Notify watchers
    const w = this.watchers.get(name);
    if (w) {
      for (const watcher of w) {
        if (!watcher.disposed) {
          try {
            watcher.callback(instance);
          } catch (err) {
            console.error(`[ServiceContainer] Watcher error for "${name}":`, err);
          }
        }
      }
    }
  }

  /** Unregister a service */
  unregister(name: ServiceName): void {
    const desc = this.services.get(name);
    if (desc) {
      desc.state = 'stopping';
      this.services.delete(name);
      // Clean watchers
      this.watchers.delete(name);
    }
  }

  /** Resolve a service by name — throws if not available */
  resolve<T = unknown>(name: ServiceName): T {
    const desc = this.services.get(name);
    if (!desc) {
      throw new Error(`[ServiceContainer] Service "${name}" is not registered. Available: ${this.listNames().join(', ')}`);
    }
    if (desc.state !== 'ready') {
      throw new Error(`[ServiceContainer] Service "${name}" is in state "${desc.state}", not ready`);
    }
    return desc.instance as T;
  }

  /** Check if a service is available */
  has(name: ServiceName): boolean {
    const desc = this.services.get(name);
    return !!desc && desc.state === 'ready';
  }

  /** Query services with a predicate */
  query(predicate: (desc: ServiceDescriptor) => boolean): ServiceDescriptor[] {
    return Array.from(this.services.values()).filter(predicate);
  }

  /** Watch a service for changes */
  watch(name: ServiceName, callback: WatcherCallback): () => void {
    const watcher: ServiceWatcher = { callback, disposed: false };
    if (!this.watchers.has(name)) {
      this.watchers.set(name, []);
    }
    this.watchers.get(name)!.push(watcher);

    // Return unsubscribe function
    return () => {
      watcher.disposed = true;
    };
  }

  /** List all registered services */
  list(): ServiceDescriptor[] {
    return Array.from(this.services.values());
  }

  /** List all service names */
  listNames(): ServiceName[] {
    return Array.from(this.services.keys());
  }

  /** Get count of registered services */
  get count(): number {
    return this.services.size;
  }

  /** Get service info without the instance */
  getDescriptor(name: ServiceName): ServiceDescriptor | undefined {
    return this.services.get(name);
  }

  /** Clear all services (for shutdown) */
  clear(): void {
    for (const desc of this.services.values()) {
      desc.state = 'stopping';
    }
    this.services.clear();
    this.watchers.clear();
  }
}

// Singleton
let _container: ServiceContainer | null = null;

export function getServiceContainer(): ServiceContainer {
  if (!_container) {
    _container = new ServiceContainer();
  }
  return _container;
}

export function resetServiceContainer(): void {
  _container = new ServiceContainer();
}
