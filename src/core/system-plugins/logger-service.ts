/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * System Plugin: Logger Service
 *
 * In-memory structured logger available to all plugins via the ServiceContainer.
 * Provides per-plugin log scoping, level filtering, and log retrieval.
 */

// ─── Types ─────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  pluginId: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface LoggerService {
  info(pluginId: string, message: string, meta?: Record<string, unknown>): void;
  warn(pluginId: string, message: string, meta?: Record<string, unknown>): void;
  error(pluginId: string, message: string, meta?: Record<string, unknown>): void;
  debug(pluginId: string, message: string, meta?: Record<string, unknown>): void;
  getLogs(limit?: number): LogEntry[];
  getPluginLogs(pluginId: string, limit?: number): LogEntry[];
  clear(): void;
}

// ─── Implementation ────────────────────────────────────────────────

const DEFAULT_MAX_ENTRIES = 10000;

/**
 * Create a new LoggerService instance.
 * Thread-safe in-memory circular buffer of structured log entries.
 */
export function createLoggerService(maxEntries: number = DEFAULT_MAX_ENTRIES): LoggerService {
  const logs: LogEntry[] = [];
  const max = maxEntries;

  /** Append a log entry, trimming the buffer when it exceeds capacity */
  function append(level: LogEntry['level'], pluginId: string, message: string, meta?: Record<string, unknown>): void {
    logs.push({
      timestamp: Date.now(),
      level,
      pluginId,
      message,
      ...(meta ? { meta } : {}),
    });

    // Trim oldest entries when buffer exceeds max capacity
    while (logs.length > max) {
      logs.shift();
    }
  }

  return {
    info(pluginId: string, message: string, meta?: Record<string, unknown>): void {
      append('info', pluginId, message, meta);
    },

    warn(pluginId: string, message: string, meta?: Record<string, unknown>): void {
      append('warn', pluginId, message, meta);
    },

    error(pluginId: string, message: string, meta?: Record<string, unknown>): void {
      append('error', pluginId, message, meta);
    },

    debug(pluginId: string, message: string, meta?: Record<string, unknown>): void {
      append('debug', pluginId, message, meta);
    },

    /** Get the most recent log entries across all plugins */
    getLogs(limit?: number): LogEntry[] {
      const count = limit ?? logs.length;
      // Return newest first by slicing from end, then reverse
      return logs.slice(-count).reverse();
    },

    /** Get the most recent log entries for a specific plugin */
    getPluginLogs(pluginId: string, limit?: number): LogEntry[] {
      const count = limit ?? logs.length;
      const filtered = logs.filter(entry => entry.pluginId === pluginId);
      return filtered.slice(-count).reverse();
    },

    /** Clear all log entries */
    clear(): void {
      logs.length = 0;
    },
  };
}
