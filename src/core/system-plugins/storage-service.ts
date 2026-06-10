/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * System Plugin: Storage Service
 *
 * Wraps the Prisma ORM client to provide a generic storage interface
 * to all plugins via the ServiceContainer. Plugins interact with models
 * by name without importing Prisma directly.
 */

import { db } from '@/lib/db';

// ─── Types ─────────────────────────────────────────────────────────

export interface StorageService {
  /** Get the raw Prisma delegate for a model (for advanced usage) */
  getModel(modelName: string): any;
  /** Perform a generic findMany/findFirst query on a model */
  query(modelName: string, args?: any): Promise<any>;
  /** Create a single record in a model */
  create(modelName: string, data: any): Promise<any>;
  /** Update records matching a where clause */
  update(modelName: string, where: any, data: any): Promise<any>;
  /** Delete records matching a where clause */
  delete(modelName: string, where: any): Promise<any>;
  /** Count records matching an optional where clause */
  count(modelName: string, where?: any): Promise<number>;
}

// ─── Implementation ────────────────────────────────────────────────

/**
 * Create a new StorageService backed by the Prisma client singleton.
 * All database operations are routed through Prisma's type-safe API.
 */
export function createStorageService(): StorageService {
  /**
   * Resolve the Prisma model delegate by capitalizing the model name.
   * Prisma exposes model delegates as PascalCase properties on the client
   * (e.g., db.car, db.user, db.garageCar).
   */
  function resolveDelegate(modelName: string): any {
    // Convert snake_case or kebab-case to PascalCase
    const pascalName = modelName
      .split(/[_\-\s]+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('');

    // Try the converted name first, then the original as-is
    const client = db as any;
    const delegate = client[pascalName] || client[modelName];

    if (!delegate) {
      throw new Error(
        `[StorageService] Model "${modelName}" not found in Prisma client. ` +
        `Attempted: "${pascalName}", "${modelName}". ` +
        `Available models: ${Object.keys(client).filter(k => typeof client[k] === 'object' && client[k]?.findMany).join(', ')}`
      );
    }

    return delegate;
  }

  return {
    /**
     * Get the raw Prisma delegate for a model.
     * Useful for advanced queries that the generic interface doesn't cover.
     */
    getModel(modelName: string): any {
      return resolveDelegate(modelName);
    },

    /**
     * Perform a generic query (findMany by default, findFirst with take: 1).
     * Accepts any Prisma-style args object.
     */
    async query(modelName: string, args?: any): Promise<any> {
      const delegate = resolveDelegate(modelName);

      // Default to findMany for broad queries
      if (args?.take === 1 || args?.unique) {
        return delegate.findFirst(args);
      }

      return delegate.findMany(args);
    },

    /**
     * Create a single record.
     */
    async create(modelName: string, data: any): Promise<any> {
      const delegate = resolveDelegate(modelName);
      return delegate.create({ data });
    },

    /**
     * Update the first record matching the where clause.
     */
    async update(modelName: string, where: any, data: any): Promise<any> {
      const delegate = resolveDelegate(modelName);
      return delegate.update({
        where,
        data,
      });
    },

    /**
     * Delete the first record matching the where clause.
     */
    async delete(modelName: string, where: any): Promise<any> {
      const delegate = resolveDelegate(modelName);
      return delegate.delete({
        where,
      });
    },

    /**
     * Count records matching an optional where clause.
     */
    async count(modelName: string, where?: any): Promise<number> {
      const delegate = resolveDelegate(modelName);
      return delegate.count({ where });
    },
  };
}
