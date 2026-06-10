// ============================================================================
// AENEWS Enterprise OS — PHASE OMEGA
// Self-Optimization Engine
// Measures usage patterns and automatically proposes optimizations:
// caching, indexing, lazy loading, compression, connection pooling, batching, etc.
// ============================================================================

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

export type MetricType =
  | 'usage'
  | 'latency'
  | 'cpu'
  | 'memory'
  | 'search'
  | 'workflow'
  | 'builder'
  | 'ai'
  | 'cache_hit'
  | 'error_rate';

export type OptimizationType =
  | 'cache'
  | 'index'
  | 'partition'
  | 'preload'
  | 'compress'
  | 'lazy_load'
  | 'connection_pool'
  | 'batch'
  | 'memory_limit'
  | 'rate_limit';

export type ImpactLevel = 'low' | 'medium' | 'high' | 'critical';
export type EffortLevel = 'low' | 'medium' | 'high';
export type OptimizationStatus = 'suggested' | 'applied' | 'rejected' | 'expired';

export interface Optimization {
  id: string;
  type: OptimizationType;
  pluginId: string;
  target: string;
  description: string;
  impact: ImpactLevel;
  effort: EffortLevel;
  status: OptimizationStatus;
  createdAt: number;
  appliedAt?: number;
}

export interface MetricSample {
  type: MetricType;
  pluginId: string;
  value: number;
  unit: string;
  timestamp: number;
}

export interface MetricSummary {
  type: MetricType;
  avg: number;
  max: number;
  min: number;
  p95: number;
  sampleCount: number;
}

export interface OptimizationReport {
  id: string;
  timestamp: number;
  totalOptimizations: number;
  applied: number;
  pending: number;
  projectedImpact: number;
  metrics: MetricSummary[];
}

export interface SelfOptimizationStats {
  totalSamples: number;
  totalOptimizations: number;
  appliedOptimizations: number;
  activeRules: number;
  monitoredPlugins: number;
}

// ---------------------------------------------------------------------------
// Analysis Rule
// ---------------------------------------------------------------------------

interface AnalysisRule {
  condition: (metrics: MetricSample[]) => boolean;
  suggestion: Partial<Optimization>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

interface SelfOptimizationConfig {
  maxSamplesPerKey: number;
  optimizationTtlMs: number;
}

// ---------------------------------------------------------------------------
// Circular Buffer (per metric-type + pluginId key)
// ---------------------------------------------------------------------------

class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private count = 0;
  private readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<undefined>(capacity);
  }

  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) {
      this.count++;
    }
  }

  getAll(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      const idx = (this.head - this.count + i + this.capacity) % this.capacity;
      const item = this.buffer[idx];
      if (item !== undefined) {
        result.push(item);
      }
    }
    return result;
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.buffer.fill(undefined);
    this.head = 0;
    this.count = 0;
  }
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(): string {
  idCounter++;
  return `opt-${Date.now()}-${idCounter.toString(36)}`;
}

function sampleKey(type: MetricType, pluginId: string): string {
  return `${type}::${pluginId}`;
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (p / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

// ---------------------------------------------------------------------------
// SelfOptimizationEngine
// ---------------------------------------------------------------------------

export class SelfOptimizationEngine {
  /** Circular buffer of MetricSample[], keyed by "type::pluginId" */
  private samples = new Map<string, CircularBuffer<MetricSample>>();

  /** All proposed / applied / rejected optimizations */
  private optimizations = new Map<string, Optimization>();

  /** Registered analysis rules */
  private rules: AnalysisRule[] = [];

  /** Engine configuration */
  private config: SelfOptimizationConfig;

  constructor(config?: Partial<SelfOptimizationConfig>) {
    this.config = {
      maxSamplesPerKey: config?.maxSamplesPerKey ?? 1000,
      optimizationTtlMs: config?.optimizationTtlMs ?? 86_400_000, // 24 h
    };

    console.log(
      '[SelfOptimizationEngine] Initialized — PHASE OMEGA Auto-Optimization'
    );

    this.registerBuiltinRules();
  }

  // -----------------------------------------------------------------------
  // Metric Recording
  // -----------------------------------------------------------------------

  /** Record a single metric sample with an auto-generated timestamp. */
  recordMetric(sample: MetricSample): void {
    const key = sampleKey(sample.type, sample.pluginId);
    let buffer = this.samples.get(key);
    if (!buffer) {
      buffer = new CircularBuffer<MetricSample>(this.config.maxSamplesPerKey);
      this.samples.set(key, buffer);
    }
    buffer.push({ ...sample, timestamp: sample.timestamp ?? Date.now() });
  }

  // -----------------------------------------------------------------------
  // Metric Retrieval
  // -----------------------------------------------------------------------

  /** Retrieve metric samples, optionally filtered by type, pluginId, and time range. */
  getMetrics(
    type?: MetricType,
    pluginId?: string,
    timeRange?: { start: number; end: number }
  ): MetricSample[] {
    let results: MetricSample[] = [];

    const keys =
      type && pluginId
        ? [sampleKey(type, pluginId)]
        : Array.from(this.samples.keys());

    for (const key of keys) {
      if (type && !key.startsWith(`${type}::`)) continue;
      if (pluginId && !key.endsWith(`::${pluginId}`)) continue;

      const buffer = this.samples.get(key);
      if (!buffer) continue;

      let samples = buffer.getAll();

      if (timeRange) {
        samples = samples.filter(
          (s) => s.timestamp >= timeRange.start && s.timestamp <= timeRange.end
        );
      }

      results.push(...samples);
    }

    // Return in chronological order
    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  // -----------------------------------------------------------------------
  // Analysis
  // -----------------------------------------------------------------------

  /** Analyze a single plugin's metrics and return suggested optimizations. */
  analyzePlugin(pluginId: string): Optimization[] {
    const allSamples = this.getMetrics(undefined, pluginId);
    if (allSamples.length === 0) return [];

    const suggestions: Optimization[] = [];

    for (const rule of this.rules) {
      try {
        if (rule.condition(allSamples)) {
          const partial = rule.suggestion;
          const optimization: Optimization = {
            id: generateId(),
            type: partial.type ?? 'cache',
            pluginId: pluginId,
            target: partial.target ?? 'unknown',
            description: partial.description ?? 'Auto-suggested optimization',
            impact: partial.impact ?? 'medium',
            effort: partial.effort ?? 'medium',
            status: 'suggested',
            createdAt: Date.now(),
          };
          this.optimizations.set(optimization.id, optimization);
          suggestions.push(optimization);
        }
      } catch {
        // Faulty rule — skip silently
      }
    }

    return suggestions;
  }

  /** Analyze all monitored plugins and return all new suggestions. */
  analyzeAll(): Optimization[] {
    const plugins = this.getMonitoredPlugins();
    const allSuggestions: Optimization[] = [];

    for (const pluginId of plugins) {
      const suggestions = this.analyzePlugin(pluginId);
      allSuggestions.push(...suggestions);
    }

    return allSuggestions;
  }

  // -----------------------------------------------------------------------
  // Optimization Management
  // -----------------------------------------------------------------------

  /** Mark an optimization as applied. */
  applyOptimization(id: string): Optimization {
    const opt = this.optimizations.get(id);
    if (!opt) {
      throw new Error(`[SelfOptimizationEngine] Optimization "${id}" not found`);
    }
    opt.status = 'applied';
    opt.appliedAt = Date.now();
    return { ...opt };
  }

  /** Mark an optimization as rejected. */
  rejectOptimization(id: string): Optimization {
    const opt = this.optimizations.get(id);
    if (!opt) {
      throw new Error(`[SelfOptimizationEngine] Optimization "${id}" not found`);
    }
    opt.status = 'rejected';
    return { ...opt };
  }

  /** Retrieve optimizations, optionally filtered by pluginId and status. */
  getOptimizations(
    pluginId?: string,
    status?: OptimizationStatus
  ): Optimization[] {
    let results = Array.from(this.optimizations.values());

    if (pluginId !== undefined) {
      results = results.filter((o) => o.pluginId === pluginId);
    }

    if (status !== undefined) {
      results = results.filter((o) => o.status === status);
    }

    // Expire stale suggestions
    const now = Date.now();
    for (const opt of results) {
      if (
        opt.status === 'suggested' &&
        now - opt.createdAt > this.config.optimizationTtlMs
      ) {
        opt.status = 'expired';
      }
    }

    return results.sort((a, b) => b.createdAt - a.createdAt);
  }

  // -----------------------------------------------------------------------
  // Rule Management
  // -----------------------------------------------------------------------

  /** Register a custom analysis rule. */
  addRule(rule: {
    condition: (metrics: MetricSample[]) => boolean;
    suggestion: Partial<Optimization>;
  }): void {
    this.rules.push(rule);
  }

  // -----------------------------------------------------------------------
  // Reporting
  // -----------------------------------------------------------------------

  /** Generate a comprehensive optimization report for a plugin or the entire system. */
  getReport(pluginId?: string): OptimizationReport {
    const allSamples = this.getMetrics(undefined, pluginId);
    const allOpts = this.getOptimizations(pluginId);

    const metrics = this.summarizeMetrics(allSamples);

    const applied = allOpts.filter((o) => o.status === 'applied').length;
    const pending = allOpts.filter((o) => o.status === 'suggested').length;
    const projectedImpact = this.estimateProjectedImpact(allOpts);

    return {
      id: `report-${Date.now()}`,
      timestamp: Date.now(),
      totalOptimizations: allOpts.length,
      applied,
      pending,
      projectedImpact,
      metrics,
    };
  }

  /** Get aggregate statistics about the engine. */
  getStats(): SelfOptimizationStats {
    const allSamples = this.getMetrics();
    const allOpts = Array.from(this.optimizations.values());

    return {
      totalSamples: allSamples.length,
      totalOptimizations: allOpts.length,
      appliedOptimizations: allOpts.filter((o) => o.status === 'applied').length,
      activeRules: this.rules.length,
      monitoredPlugins: this.getMonitoredPlugins().length,
    };
  }

  /** Clear all collected data and optimizations. */
  clear(): void {
    this.samples.clear();
    this.optimizations.clear();
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /** Return the set of unique plugin IDs that have at least one sample. */
  private getMonitoredPlugins(): string[] {
    const pluginSet = new Set<string>();
    for (const key of this.samples.keys()) {
      const separatorIndex = key.indexOf('::');
      if (separatorIndex !== -1) {
        pluginSet.add(key.substring(separatorIndex + 2));
      }
    }
    return Array.from(pluginSet);
  }

  /** Build MetricSummary[] from raw samples. */
  private summarizeMetrics(samples: MetricSample[]): MetricSummary[] {
    const grouped = new Map<MetricType, number[]>();

    for (const sample of samples) {
      let arr = grouped.get(sample.type);
      if (!arr) {
        arr = [];
        grouped.set(sample.type, arr);
      }
      arr.push(sample.value);
    }

    const summaries: MetricSummary[] = [];

    for (const [type, values] of grouped) {
      const sorted = [...values].sort((a, b) => a - b);
      const sum = values.reduce((a, b) => a + b, 0);

      summaries.push({
        type,
        avg: sum / values.length,
        max: sorted[sorted.length - 1],
        min: sorted[0],
        p95: percentile(sorted, 95),
        sampleCount: values.length,
      });
    }

    return summaries;
  }

  /** Rough projected-impact score (0–100) based on applied and pending optimizations. */
  private estimateProjectedImpact(optimizations: Optimization[]): number {
    if (optimizations.length === 0) return 0;

    const impactWeight: Record<ImpactLevel, number> = {
      low: 5,
      medium: 15,
      high: 30,
      critical: 50,
    };

    let score = 0;
    for (const opt of optimizations) {
      if (opt.status === 'applied' || opt.status === 'suggested') {
        score += impactWeight[opt.impact];
      }
    }

    return Math.min(100, score);
  }

  // -----------------------------------------------------------------------
  // Built-in Rules
  // -----------------------------------------------------------------------

  private registerBuiltinRules(): void {
    // --- Rule 1: High latency → suggest caching ----------------------------
    this.rules.push({
      condition: (metrics: MetricSample[]) => {
        const latencySamples = metrics.filter((m) => m.type === 'latency');
        if (latencySamples.length < 5) return false;
        const avg =
          latencySamples.reduce((s, m) => s + m.value, 0) /
          latencySamples.length;
        return avg > 500; // avg > 500 ms
      },
      suggestion: {
        type: 'cache',
        target: 'response_data',
        description:
          'High average latency detected (>500 ms). Add response caching to reduce repeated computation and I/O overhead.',
        impact: 'high',
        effort: 'low',
      },
    });

    // --- Rule 2: High error rate → suggest rollback -----------------------
    this.rules.push({
      condition: (metrics: MetricSample[]) => {
        const errorSamples = metrics.filter((m) => m.type === 'error_rate');
        if (errorSamples.length < 3) return false;
        const recent = errorSamples.slice(-5);
        const avg =
          recent.reduce((s, m) => s + m.value, 0) / recent.length;
        return avg > 10; // > 10 % error rate
      },
      suggestion: {
        type: 'rate_limit',
        target: 'error_handling',
        description:
          'Elevated error rate detected (>10 %). Consider rolling back recent changes and adding circuit-breaker / rate-limit protections.',
        impact: 'critical',
        effort: 'medium',
      },
    });

    // --- Rule 3: High memory usage → lazy load ----------------------------
    this.rules.push({
      condition: (metrics: MetricSample[]) => {
        const memSamples = metrics.filter((m) => m.type === 'memory');
        if (memSamples.length < 3) return false;
        const recent = memSamples.slice(-5);
        const avg =
          recent.reduce((s, m) => s + m.value, 0) / recent.length;
        return avg > 80; // > 80 % memory usage
      },
      suggestion: {
        type: 'lazy_load',
        target: 'module_loader',
        description:
          'High memory usage detected (>80 %). Enable lazy loading for non-critical modules to reduce resident memory footprint.',
        impact: 'high',
        effort: 'medium',
      },
    });

    // --- Rule 4: Low cache hit rate → preload frequent queries -------------
    this.rules.push({
      condition: (metrics: MetricSample[]) => {
        const cacheSamples = metrics.filter((m) => m.type === 'cache_hit');
        if (cacheSamples.length < 5) return false;
        const avg =
          cacheSamples.reduce((s, m) => s + m.value, 0) /
          cacheSamples.length;
        return avg < 50; // < 50 % hit rate
      },
      suggestion: {
        type: 'preload',
        target: 'query_cache',
        description:
          'Low cache hit rate detected (<50 %). Preload frequently accessed query results into the cache to improve throughput.',
        impact: 'medium',
        effort: 'low',
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: SelfOptimizationEngine | null = null;

/** Get the global SelfOptimizationEngine singleton. */
export function getSelfOptimizationEngine(): SelfOptimizationEngine {
  if (!instance) {
    instance = new SelfOptimizationEngine();
  }
  return instance;
}

/** Reset (destroy and recreate) the global singleton. */
export function resetSelfOptimizationEngine(): void {
  if (instance) {
    instance.clear();
  }
  instance = null;
}