// =============================================================================
// AENEWS Enterprise OS — PHASE OMEGA
// Observability Engine
// Centralized per-plugin metrics, logs, tracing, health checks, and profiling.
// =============================================================================

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface PluginMetric {
  pluginId: string;
  name: string;
  value: number;
  unit: string;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface PluginLog {
  id: string;
  pluginId: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  stack?: string;
  source?: string;
}

export interface TraceSpan {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  durationMs: number;
}

export interface PluginTrace {
  id: string;
  pluginId: string;
  operation: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  status: string;
  spans?: TraceSpan[];
}

export interface PluginHealth {
  pluginId: string;
  status: HealthStatus;
  lastCheckAt: number;
  responseTimeMs: number;
  errorCount: number;
  memoryUsage: number;
  cpuUsage?: number;
  details?: string;
}

export interface PluginProfile {
  pluginId: string;
  memorySnapshot: number;
  cpuSnapshot: number;
  activeConnections: number;
  requestCount: number;
  errorRate: number;
  avgLatencyMs: number;
}

export interface ObservabilityStats {
  totalMetrics: number;
  totalLogs: number;
  totalTraces: number;
  pluginsMonitored: number;
  alertsTriggered: number;
}

interface AlertEntry {
  id: string;
  pluginId: string;
  message: string;
  severity: LogLevel;
  timestamp: number;
}

type TimeRange = { start: number; end: number } | undefined;

// ---------------------------------------------------------------------------
// Circular Buffer for per-plugin logs (capacity 1000)
// ---------------------------------------------------------------------------

class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private size = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T | undefined>(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  getAll(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.size; i++) {
      const index = (this.head - this.size + i + this.capacity) % this.capacity;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  getLatest(limit: number): T[] {
    const all = this.getAll();
    return all.slice(-limit);
  }

  clear(): void {
    this.buffer = new Array<T | undefined>(this.capacity);
    this.head = 0;
    this.size = 0;
  }

  get length(): number {
    return this.size;
  }
}

// ---------------------------------------------------------------------------
// ObservabilityEngine
// ---------------------------------------------------------------------------

let idCounter = 0;

function uid(): string {
  return `obs_${Date.now()}_${++idCounter}`;
}

export class ObservabilityEngine {
  // -- Private Stores --------------------------------------------------------

  private metrics = new Map<string, PluginMetric[]>();
  private logs = new Map<string, CircularBuffer<PluginLog>>();
  private traces = new Map<string, PluginTrace[]>();
  private healthChecks = new Map<string, PluginHealth>();
  private profiles = new Map<string, PluginProfile>();
  private alerts: AlertEntry[] = [];

  private readonly LOG_BUFFER_CAPACITY = 1000;

  // -- Constructor -----------------------------------------------------------

  constructor() {
    console.log('[ObservabilityEngine] Initialized — PHASE OMEGA Monitoring');
  }

  // =========================================================================
  // Metrics
  // =========================================================================

  recordMetric(metric: PluginMetric): void {
    const key = metric.pluginId;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    this.metrics.get(key)!.push(metric);
  }

  getMetrics(
    pluginId?: string,
    name?: string,
    timeRange?: TimeRange,
  ): PluginMetric[] {
    let results: PluginMetric[] = [];

    if (pluginId) {
      const store = this.metrics.get(pluginId);
      if (store) results = [...store];
    } else {
      for (const store of this.metrics.values()) {
        results.push(...store);
      }
    }

    if (name) {
      results = results.filter((m) => m.name === name);
    }

    if (timeRange) {
      results = results.filter(
        (m) => m.timestamp >= timeRange.start && m.timestamp <= timeRange.end,
      );
    }

    return results;
  }

  // =========================================================================
  // Logs
  // =========================================================================

  private getOrCreateLogBuffer(pluginId: string): CircularBuffer<PluginLog> {
    if (!this.logs.has(pluginId)) {
      this.logs.set(pluginId, new CircularBuffer<PluginLog>(this.LOG_BUFFER_CAPACITY));
    }
    return this.logs.get(pluginId)!;
  }

  log(entry: PluginLog): void {
    this.getOrCreateLogBuffer(entry.pluginId).push(entry);
  }

  getLogs(
    pluginId?: string,
    level?: LogLevel,
    limit: number = 100,
  ): PluginLog[] {
    let results: PluginLog[] = [];

    if (pluginId) {
      const buf = this.logs.get(pluginId);
      if (buf) results = buf.getAll();
    } else {
      for (const buf of this.logs.values()) {
        results.push(...buf.getAll());
      }
    }

    if (level) {
      results = results.filter((l) => l.level === level);
    }

    // Sort newest first, then apply limit
    results.sort((a, b) => b.timestamp - a.timestamp);
    return results.slice(0, limit);
  }

  clearLogs(pluginId?: string): void {
    if (pluginId) {
      this.logs.delete(pluginId);
    } else {
      this.logs.clear();
    }
  }

  // =========================================================================
  // Tracing
  // =========================================================================

  private activeTraces = new Map<
    string,
    { pluginId: string; operation: string; startTime: number; spans: TraceSpan[] }
  >();

  startTrace(pluginId: string, operation: string): string {
    const traceId = uid();
    this.activeTraces.set(traceId, {
      pluginId,
      operation,
      startTime: Date.now(),
      spans: [],
    });
    return traceId;
  }

  endTrace(traceId: string, status: string = 'completed'): void {
    const active = this.activeTraces.get(traceId);
    if (!active) return;

    const endTime = Date.now();
    const trace: PluginTrace = {
      id: traceId,
      pluginId: active.pluginId,
      operation: active.operation,
      startTime: active.startTime,
      endTime,
      durationMs: endTime - active.startTime,
      status,
      spans: active.spans.length > 0 ? active.spans : undefined,
    };

    if (!this.traces.has(active.pluginId)) {
      this.traces.set(active.pluginId, []);
    }
    this.traces.get(active.pluginId)!.push(trace);
    this.activeTraces.delete(traceId);
  }

  /** Add a child span to an active trace. */
  addSpan(traceId: string, name: string, durationMs: number): void {
    const active = this.activeTraces.get(traceId);
    if (!active) return;
    const now = Date.now();
    active.spans.push({
      id: uid(),
      name,
      startTime: now - durationMs,
      endTime: now,
      durationMs,
    });
  }

  getTraces(pluginId?: string, limit: number = 100): PluginTrace[] {
    let results: PluginTrace[] = [];

    if (pluginId) {
      const store = this.traces.get(pluginId);
      if (store) results = [...store];
    } else {
      for (const store of this.traces.values()) {
        results.push(...store);
      }
    }

    results.sort((a, b) => b.startTime - a.startTime);
    return results.slice(0, limit);
  }

  // =========================================================================
  // Health Checks
  // =========================================================================

  healthCheck(pluginId: string): PluginHealth {
    const existing = this.healthChecks.get(pluginId);
    if (existing) {
      return { ...existing, lastCheckAt: Date.now() };
    }
    const defaultHealth: PluginHealth = {
      pluginId,
      status: 'unknown',
      lastCheckAt: Date.now(),
      responseTimeMs: 0,
      errorCount: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      details: 'No health data recorded yet',
    };
    return defaultHealth;
  }

  setHealth(pluginId: string, health: PluginHealth): void {
    this.healthChecks.set(pluginId, { ...health, lastCheckAt: Date.now() });
  }

  // =========================================================================
  // Profiling
  // =========================================================================

  profile(pluginId: string): PluginProfile | null {
    return this.profiles.get(pluginId) ?? null;
  }

  recordProfile(profile: PluginProfile): void {
    this.profiles.set(profile.pluginId, profile);
  }

  // =========================================================================
  // Alerts
  // =========================================================================

  alert(pluginId: string, message: string, severity: LogLevel): void {
    this.alerts.push({
      id: uid(),
      pluginId,
      message,
      severity,
      timestamp: Date.now(),
    });
  }

  getAlerts(pluginId?: string, severity?: LogLevel): AlertEntry[] {
    let results = [...this.alerts];

    if (pluginId) {
      results = results.filter((a) => a.pluginId === pluginId);
    }

    if (severity) {
      results = results.filter((a) => a.severity === severity);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);
    return results;
  }

  // =========================================================================
  // Aggregate Stats
  // =========================================================================

  getStats(): ObservabilityStats {
    let totalMetrics = 0;
    for (const store of this.metrics.values()) {
      totalMetrics += store.length;
    }

    let totalLogs = 0;
    for (const buf of this.logs.values()) {
      totalLogs += buf.length;
    }

    let totalTraces = 0;
    for (const store of this.traces.values()) {
      totalTraces += store.length;
    }

    const pluginIds = new Set<string>();
    for (const id of this.metrics.keys()) pluginIds.add(id);
    for (const id of this.logs.keys()) pluginIds.add(id);
    for (const id of this.traces.keys()) pluginIds.add(id);
    for (const id of this.healthChecks.keys()) pluginIds.add(id);
    for (const id of this.profiles.keys()) pluginIds.add(id);

    return {
      totalMetrics,
      totalLogs,
      totalTraces,
      pluginsMonitored: pluginIds.size,
      alertsTriggered: this.alerts.length,
    };
  }

  // =========================================================================
  // Plugin Dashboard (aggregated view)
  // =========================================================================

  getPluginDashboard(pluginId: string): {
    metrics: PluginMetric[];
    health: PluginHealth | null;
    recentLogs: PluginLog[];
    recentTraces: PluginTrace[];
    profile: PluginProfile | null;
    alerts: AlertEntry[];
  } {
    return {
      metrics: this.getMetrics(pluginId),
      health: this.healthChecks.get(pluginId) ?? null,
      recentLogs: this.getLogs(pluginId, undefined, 50),
      recentTraces: this.getTraces(pluginId, 50),
      profile: this.profiles.get(pluginId) ?? null,
      alerts: this.getAlerts(pluginId),
    };
  }

  // =========================================================================
  // Clear
  // =========================================================================

  clear(pluginId?: string): void {
    if (pluginId) {
      this.metrics.delete(pluginId);
      this.logs.delete(pluginId);
      this.traces.delete(pluginId);
      this.healthChecks.delete(pluginId);
      this.profiles.delete(pluginId);
      this.alerts = this.alerts.filter((a) => a.pluginId !== pluginId);
    } else {
      this.metrics.clear();
      this.logs.clear();
      this.traces.clear();
      this.healthChecks.clear();
      this.profiles.clear();
      this.alerts = [];
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let engineInstance: ObservabilityEngine | null = null;

export function getObservabilityEngine(): ObservabilityEngine {
  if (!engineInstance) {
    engineInstance = new ObservabilityEngine();
  }
  return engineInstance;
}

export function resetObservabilityEngine(): void {
  if (engineInstance) {
    engineInstance.clear();
  }
  engineInstance = null;
}