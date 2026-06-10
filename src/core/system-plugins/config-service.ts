/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * System Plugin: Config Service
 *
 * Simple in-memory key-value configuration store available to all plugins
 * via the ServiceContainer. Supports typed retrieval with defaults.
 */

// ─── Types ─────────────────────────────────────────────────────────

export interface ConfigService {
  get<T = unknown>(key: string, defaultValue?: T): T;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  all(): Record<string, unknown>;
}

// ─── Implementation ────────────────────────────────────────────────

/**
 * Create a new ConfigService instance.
 * Optionally pre-seeded with initial values.
 *
 * @param initialValues - Optional initial key-value pairs
 */
export function createConfigService(initialValues?: Record<string, unknown>): ConfigService {
  const store: Record<string, unknown> = { ...initialValues };

  return {
    /**
     * Retrieve a configuration value by key.
     * If the key does not exist, returns the provided defaultValue (or undefined).
     *
     * @param key - Configuration key
     * @param defaultValue - Fallback value when key is absent
     */
    get<T = unknown>(key: string, defaultValue?: T): T {
      if (key in store) {
        return store[key] as T;
      }
      return defaultValue as T;
    },

    /**
     * Set a configuration value. Creates or overwrites the key.
     *
     * @param key - Configuration key
     * @param value - Value to store
     */
    set(key: string, value: unknown): void {
      store[key] = value;
    },

    /**
     * Check whether a configuration key exists.
     *
     * @param key - Configuration key
     */
    has(key: string): boolean {
      return key in store;
    },

    /**
     * Delete a configuration key. Returns true if the key existed.
     *
     * @param key - Configuration key to delete
     */
    delete(key: string): boolean {
      if (key in store) {
        delete store[key];
        return true;
      }
      return false;
    },

    /**
     * Get a shallow copy of all configuration entries.
     */
    all(): Record<string, unknown> {
      return { ...store };
    },
  };
}
