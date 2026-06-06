'use client';

import React, { useEffect, useCallback } from 'react';
import {
  Activity,
  Puzzle,
  Wrench,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';

import { useAppStore } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================
// Dashboard View
// ============================================================

export default function DashboardView() {
  const {
    systemStats,
    setSystemStats,
    systemLoading,
    setSystemLoading,
    recentEvents,
    setRecentEvents,
    eventsLoading,
    setEventsLoading,
    plugins,
    setPlugins,
    pluginsLoading,
    setPluginsLoading,
  } = useAppStore();
  const { user } = useAuthStore();
  const token = useAuthStore.getState().token;

  const fetchSystemStats = useCallback(async () => {
    setSystemLoading(true);
    try {
      const res = await fetch('/api/system');
      if (res.ok) {
        const data = await res.json();
        setSystemStats(data);
      }
    } catch {
      // ignore
    } finally {
      setSystemLoading(false);
    }
  }, [setSystemStats, setSystemLoading]);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await fetch(`/api/events?limit=10`);
      if (res.ok) {
        const data = await res.json();
        setRecentEvents(data.events);
      }
    } catch {
      // ignore
    } finally {
      setEventsLoading(false);
    }
  }, [setRecentEvents, setEventsLoading]);

  const fetchPlugins = useCallback(async () => {
    if (!user?.tenantId) return;
    setPluginsLoading(true);
    try {
      const res = await fetch(`/api/plugins?tenantId=${user.tenantId}`);
      if (res.ok) {
        const data = await res.json();
        setPlugins(data.plugins);
      }
    } catch {
      // ignore
    } finally {
      setPluginsLoading(false);
    }
  }, [user?.tenantId, setPlugins, setPluginsLoading]);

  useEffect(() => {
    fetchSystemStats();
    fetchEvents();
    fetchPlugins();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchSystemStats();
      fetchEvents();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchSystemStats, fetchEvents, fetchPlugins]);

  const activePlugins = plugins.filter((p) => p.status === 'ACTIVE');

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            System overview and monitoring for your AENEWS workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {systemStats && (
            <div className="flex items-center gap-1.5 text-sm">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {systemStats.status}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Plugins"
          icon={Puzzle}
          value={systemStats ? String(systemStats.stats.plugins.total) : undefined}
          description="Scanned from plugins directory"
          loading={systemLoading}
        />
        <StatCard
          title="Active Plugins"
          icon={Zap}
          value={systemStats ? String(systemStats.stats.plugins.active) : undefined}
          description="Currently running"
          loading={systemLoading}
          accent
        />
        <StatCard
          title="Registered Tools"
          icon={Wrench}
          value={systemStats ? String(systemStats.stats.tools.registered) : undefined}
          description="AI-callable tools"
          loading={systemLoading}
        />
        <StatCard
          title="Total Events"
          icon={Activity}
          value={systemStats ? String(systemStats.stats.events) : undefined}
          description="System event log"
          loading={systemLoading}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Plugins */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Active Plugins</CardTitle>
            <CardDescription>
              Currently active plugins in your workspace
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pluginsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activePlugins.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Puzzle className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No active plugins. Install and activate plugins from the App Store.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activePlugins.map((plugin) => (
                  <div
                    key={plugin.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                      <Puzzle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{plugin.name}</p>
                      <p className="text-xs text-muted-foreground">
                        v{plugin.version} · {plugin.author}
                      </p>
                    </div>
                    <Badge variant="default" className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">Recent Events</CardTitle>
            <CardDescription>
              Latest system events and activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No events recorded yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {formatEventType(event.eventType)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(event.createdAt)}
                        </span>
                      </div>
                    </div>
                    {event.sourcePlugin && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {event.sourcePlugin}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Info */}
      {systemStats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">AENEWS Version</p>
                <p className="font-medium">{systemStats.version}</p>
              </div>
              <div>
                <p className="text-muted-foreground">SDK Version</p>
                <p className="font-medium">{systemStats.sdkVersion}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tenants</p>
                <p className="font-medium">{systemStats.stats.tenants}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Users</p>
                <p className="font-medium">{systemStats.stats.users}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Helper Components
// ============================================================

function StatCard({
  title,
  icon: Icon,
  value,
  description,
  loading,
  accent,
}: {
  title: string;
  icon: React.ElementType;
  value?: string;
  description: string;
  loading?: boolean;
  accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold tracking-tight">{value ?? '—'}</p>
            )}
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              accent
                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                : 'bg-muted'
            }`}
          >
            <Icon
              className={`h-5 w-5 ${
                accent
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              }`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatEventType(type: string): string {
  return type
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Plugin/gi, '')
    .trim();
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
