'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Shield,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Trophy,
  Target,
  Clock,
  FileCheck2,
  Layers,
  DatabaseZap,
  Search,
  Bus,
  HardDrive,
  ShieldCheck,
  Blocks,
  Wrench,
  GitCompare,
  Gauge,
  FileCode2,
  ArrowRight,
  Sparkles,
  CircleDot,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

type TestStatus = 'pass' | 'fail' | 'partial';

interface TestResult {
  status: TestStatus;
  score: number;
  details: Record<string, unknown>;
}

interface ValidationReport {
  timestamp: string;
  coreHash: string;
  tests: Record<string, TestResult>;
  summary: {
    totalScore: number;
    passCount: number;
    failCount: number;
    partialCount: number;
    verdict: string;
    coreModified: boolean;
    pluginsScanned: number;
    pluginsValid: number;
    coreEngines: string[];
  };
}

interface TestCategoryConfig {
  id: string;
  number: number;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

// ============================================================
// Test Categories Configuration
// ============================================================

const TEST_CATEGORIES: TestCategoryConfig[] = [
  {
    id: '1_compliance',
    number: 1,
    name: 'Plugin Compliance',
    description: 'Verifies all 20 plugins have valid manifests with correct aenews version, semver, and required fields',
    icon: FileCheck2,
    color: 'emerald',
  },
  {
    id: '2_plugin_loader',
    number: 2,
    name: 'Plugin Loader (19-Step Pipeline)',
    description: 'Manifest validation, semver checks, dependency resolution, cycle detection, runtime load, container injection',
    icon: Layers,
    color: 'sky',
  },
  {
    id: '3_plugin_runtime',
    number: 3,
    name: 'Plugin Runtime Lifecycle',
    description: 'Start → Execute → Pause → Resume → Reload → Hot Reload → Stop → Dispose → Destroy lifecycle management',
    icon: Zap,
    color: 'violet',
  },
  {
    id: '4_dynamic_ui',
    number: 4,
    name: 'Dynamic UI Registration',
    description: 'UI Registry: sidebar menus, dashboard cards, widgets, commands, pages, actions from plugins',
    icon: DatabaseZap,
    color: 'rose',
  },
  {
    id: '5_ai_discovery',
    number: 5,
    name: 'IA/MCP Discovery',
    description: 'Capability Registry + Tool Registry: cross-plugin AI discovery via registered capabilities and tools',
    icon: Search,
    color: 'amber',
  },
  {
    id: '6_search_engine',
    number: 6,
    name: 'Search Engine',
    description: 'Full-text cross-plugin search with relevance scoring, deduplication, and faceted results',
    icon: Search,
    color: 'teal',
  },
  {
    id: '7_event_bus',
    number: 7,
    name: 'Event Bus',
    description: 'In-memory pub/sub: emit, subscribe, unsubscribe, listener count, predefined system events',
    icon: Bus,
    color: 'orange',
  },
  {
    id: '8_event_store',
    number: 8,
    name: 'Event Store',
    description: 'Persistent event storage: persist, query, replay, aggregate, cleanup with audit trails',
    icon: HardDrive,
    color: 'cyan',
  },
  {
    id: '9_rbac',
    number: 9,
    name: 'RBAC Engine',
    description: 'Auto-generated permissions from manifests with dot-notation patterns and wildcard support',
    icon: ShieldCheck,
    color: 'purple',
  },
  {
    id: '10_schema_registry',
    number: 10,
    name: 'Schema Registry',
    description: 'Dynamic object schemas with Prisma/API/JSON Schema/Form generation',
    icon: Blocks,
    color: 'indigo',
  },
  {
    id: '11_builder_engine',
    number: 11,
    name: 'Builder Engine',
    description: 'Auto-generate Form/Table/Dashboard/Widget/Page/Report/Workflow/Agent components',
    icon: Wrench,
    color: 'pink',
  },
  {
    id: '12_plugin_generator',
    number: 12,
    name: 'Plugin Generator CLI',
    description: 'create-aenews-plugin CLI tool for scaffolding new plugins with templates',
    icon: FileCode2,
    color: 'lime',
  },
  {
    id: '13_regression',
    number: 13,
    name: 'Regression Test',
    description: 'Full activate/deactivate cycle with DB state verification and round-trip integrity check',
    icon: GitCompare,
    color: 'rose',
  },
  {
    id: '14_benchmark',
    number: 14,
    name: 'Performance Benchmark',
    description: 'Scan time, DB query speed, registry stats, memory usage, and plugin throughput metrics',
    icon: Gauge,
    color: 'amber',
  },
  {
    id: '15_final_report',
    number: 15,
    name: 'Final Report',
    description: 'Aggregated score, quality tier, pass/fail counts, and architecture verdict',
    icon: Trophy,
    color: 'emerald',
  },
];

const STATUS_CONFIG = {
  pass: {
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    border: 'border-emerald-300 dark:border-emerald-700',
    label: 'PASS',
  },
  partial: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    border: 'border-amber-300 dark:border-amber-700',
    label: 'PARTIAL',
  },
  fail: {
    icon: XCircle,
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    border: 'border-rose-300 dark:border-rose-700',
    label: 'FAIL',
  },
};

// ============================================================
// Validation Suite View
// ============================================================

export default function ValidationSuiteView() {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [lastRunDuration, setLastRunDuration] = useState<number | null>(null);

  const runValidation = useCallback(async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    const startTime = Date.now();

    try {
      const res = await fetch('/api/architecture');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }
      const data = await res.json();
      setReport(data);
      setLastRunDuration(Date.now() - startTime);

      // Auto-expand failed tests
      const failedTests = new Set<string>();
      for (const [key, test] of Object.entries(data.tests || {})) {
        if (test.status === 'fail' || test.status === 'partial') {
          failedTests.add(key);
        }
      }
      setExpandedTests(failedTests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-run on mount
  useEffect(() => {
    runValidation();
  }, [runValidation]);

  const toggleTest = (testId: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev);
      if (next.has(testId)) next.delete(testId);
      else next.add(testId);
      return next;
    });
  };

  const expandAll = () => {
    if (!report) return;
    setExpandedTests(new Set(Object.keys(report.tests)));
  };

  const collapseAll = () => {
    setExpandedTests(new Set());
  };

  const totalScore = report?.summary.totalScore ?? 0;
  const maxScore = report ? Object.keys(report.tests).length * 100 : 0;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  // Extract core hash info from final report
  const finalDetails = report?.tests?.['15_final_report']?.details as Record<string, unknown> | undefined;
  const tier = (finalDetails?.tier as string) || '—';
  const coreHash = report?.coreHash || '—';
  const verdict = report?.summary?.verdict || '—';
  const isValidated = verdict === 'ARCHITECTURE VALIDATED';

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                Architecture Validation Suite
              </h1>
              <p className="text-sm text-muted-foreground">
                PHASE FINALE — 15 Test Categories · 20 Domain Plugins
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={runValidation}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Run Validation
              </>
            )}
          </Button>
          {lastRunDuration && (
            <span className="text-xs text-muted-foreground">
              Last run: {lastRunDuration}ms
            </span>
          )}
        </div>
      </div>

      {/* ─── Error State ─── */}
      {error && (
        <Card className="border-rose-300 bg-rose-50 dark:bg-rose-900/10">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-rose-600" shrink-0" />
            <div>
              <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
                Validation Error
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Loading State ─── */}
      {loading && !report && (
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <div>
              <p className="font-semibold text-lg">Running Validation...</p>
              <p className="text-sm text-muted-foreground">
                Scanning plugins, testing all 15 categories
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-72" />
                    </div>
                    <Skeleton className="h-7 w-16 rounded-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          RESULTS
          ═══════════════════════════════════════════════════════════ */}
      {report && (
        <>
          {/* ─── Verdict Banner ─── */}
          <div
            className={cn(
              'rounded-xl border-2 p-6 text-center transition-all',
              isValidated
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                : 'bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700',
            )}
          >
            <div className="flex items-center justify-center gap-3 mb-3">
              {isValidated ? (
                <Trophy className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Target className="h-10 w-10 text-rose-600 dark:text-rose-400" />
              )}
            </div>
            <h2
              className={cn(
                'text-2xl font-bold tracking-tight',
                isValidated
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300',
              )}
            >
              {verdict}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {percentage}% overall score · Quality Tier: <span className="font-semibold text-foreground">{tier}</span>
            </p>
          </div>

          {/* ─── Score Summary Bar ─── */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold">Overall Score</h3>
                  <p className="text-sm text-muted-foreground">
                    {report.summary.passCount} passed · {report.summary.failCount} failed · {report.summary.partialCount} partial
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={cn(
                      'text-3xl font-bold tabular-nums',
                      percentage >= 70 ? 'text-emerald-600' : percentage >= 50 ? 'text-amber-600' : 'text-rose-600',
                    )}
                  >
                    {percentage}%
                  </span>
                  <span className="text-sm text-muted-foreground ml-1">/ 100</span>
                </div>
              </div>

              <Progress
                value={percentage}
                className="h-3"
              />

              <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                <span>0</span>
                <div className="flex items-center gap-1">
                  <CircleDot className="h-1.5 w-1.5 text-muted-foreground/40" />
                  <span>Threshold: 70% for VALIDATED</span>
                </div>
                <span>100</span>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{report.summary.passCount}</p>
                  <p className="text-xs text-muted-foreground">Passed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-rose-600">{report.summary.failCount}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{report.summary.partialCount}</p>
                  <p className="text-xs text-muted-foreground">Partial</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{report.summary.pluginsScanned}</p>
                  <p className="text-xs text-muted-foreground">Plugins</p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Core Hash:</span>
                <code className="rounded bg-muted px-2 py-0.5 font-mono text-[10px]">
                  {coreHash.slice(0, 16)}...
                </code>
              </div>
            </CardContent>
          </Card>

          {/* ─── Controls ─── */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>
              <ChevronDown className="mr-1.5 h-3.5 w-3.5" />
              Expand All
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>
              <ChevronRight className="mr-1.5 h-3.5 w-3.5" />
              Collapse All
            </Button>
          </div>

          {/* ═══════════════════════════════════════════════════════════
              TEST CATEGORIES
              ═══════════════════════════════════════════════════════════ */}
          <div className="space-y-3">
            {TEST_CATEGORIES.map((category) => {
              const test = report.tests[category.id];
              if (!test) return null;

              const statusConfig = STATUS_CONFIG[test.status];
              const isExpanded = expandedTests.has(category.id);
              const Icon = category.icon;
              const StatusIcon = statusConfig.icon;

              // Extract interesting details
              const detailEntries = Object.entries(test.details || {}).filter(
                ([, v]) => v !== null && v !== undefined && typeof v !== 'object',
              );

              return (
                <Card
                  key={category.id}
                  className={cn(
                    'transition-all duration-200 hover:shadow-md',
                    test.status === 'pass' && 'border-l-4 border-l-emerald-500',
                    test.status === 'partial' && 'border-l-4 border-l-amber-500',
                    test.status === 'fail' && 'border-l-4 border-l-rose-500',
                  )}
                >
                  {/* Test Header */}
                  <button
                    onClick={() => toggleTest(category.id)}
                    className="w-full text-left"
                  >
                    <div className="p-4 flex items-center gap-4">
                      {/* Test Number */}
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm',
                          test.status === 'pass'
                            ? 'bg-emerald-600'
                            : test.status === 'partial'
                              ? 'bg-amber-500'
                              : 'bg-rose-500',
                        )}
                      >
                        {category.number}
                      </div>

                      {/* Category Icon */}
                      <div
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                          statusConfig.bg,
                        )}
                      >
                        <Icon className={cn('h-4.5 w-4.5', statusConfig.color)} />
                      </div>

                      {/* Title & Description */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold leading-tight truncate">
                          {category.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {category.description}
                        </p>
                      </div>

                      {/* Status Badge */}
                      <div
                        className={cn(
                          'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shrink-0',
                          statusConfig.bg,
                          statusConfig.color,
                        )}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        <span>{statusConfig.label}</span>
                      </div>

                      {/* Score */}
                      <div className="text-right shrink-0 w-16">
                        <span
                          className={cn(
                            'text-lg font-bold tabular-nums',
                            test.score >= 80 ? 'text-emerald-600' : test.score >= 50 ? 'text-amber-600' : 'text-rose-600',
                          )}
                        >
                          {test.score}
                        </span>
                        <p className="text-[10px] text-muted-foreground -mt-0.5">/ 100</p>
                      </div>

                      {/* Expand/Collapse */}
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t">
                      <div className="pt-4 space-y-4">
                        {/* Detail Items */}
                        {detailEntries.length > 0 && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Details
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {detailEntries.slice(0, 8).map(([key, value]) => (
                                <div
                                  key={key}
                                  className="rounded-lg bg-muted/50 px-3 py-2"
                                >
                                  <p className="text-[10px] text-muted-foreground truncate">{key}</p>
                                  <p className="text-xs font-medium truncate">
                                    {typeof value === 'number' ? value.toLocaleString() : String(value)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Score Bar */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span>Score</span>
                            <span>{test.score}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                test.score >= 80
                                  ? 'bg-emerald-500'
                                  : test.score >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-rose-500',
                              )}
                              style={{ width: `${Math.max(test.score, 2)}%` }}
                            />
                          </div>
                        </div>

                        {/* Nested Objects */}
                        {Object.entries(test.details || {}).some(([, v]) => typeof v === 'object' && v !== null) && (
                          <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Deep Details
                            </p>
                            <div className="max-h-60 overflow-y-auto rounded-lg border bg-muted/30 p-3 custom-scrollbar">
                              <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                                {JSON.stringify(test.details, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* ─── Core Engines List ─── */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-500" />
                <CardTitle className="text-base">Core Engines Verified</CardTitle>
              </div>
              <CardDescription>
                {report.summary.coreEngines.length} engine modules tested — zero Core modifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {report.summary.coreEngines.map((engine) => (
                  <Badge
                    key={engine}
                    variant="secondary"
                    className="text-[10px] font-normal"
                  >
                    {engine}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ─── Footer ─── */}
          <div className="text-center text-xs text-muted-foreground pt-2">
            <p>
              Validation Suite v1.0 — AENEWS Enterprise OS — Generated{' '}
              {new Date(report.timestamp).toLocaleString()}
            </p>
            <p className="mt-1">
              Core Hash: <code className="font-mono">{report.coreHash}</code>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
