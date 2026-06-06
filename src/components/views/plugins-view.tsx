'use client';

import React, { useEffect, useCallback, useState } from 'react';
import {
  Puzzle,
  Download,
  Power,
  PowerOff,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

import { useAppStore, type PluginInfo } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

// ============================================================
// Plugins View
// ============================================================

export default function PluginsView() {
  const { plugins, setPlugins, pluginsLoading, setPluginsLoading } = useAppStore();
  const { user } = useAuthStore();

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
    fetchPlugins();
  }, [fetchPlugins]);

  const handleInstall = async (plugin: PluginInfo) => {
    if (!user?.tenantId) return;
    try {
      const res = await fetch('/api/plugins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: user.tenantId, pluginSlug: plugin.slug }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Installed "${plugin.name}"`);
        fetchPlugins();
      } else {
        toast.error(data.error || 'Install failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleActivate = async (plugin: PluginInfo) => {
    if (!user?.tenantId) return;
    try {
      const res = await fetch(`/api/plugins/${plugin.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: user.tenantId, action: 'activate' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Activated "${plugin.name}"`);
        fetchPlugins();
      } else {
        toast.error(data.error || 'Activate failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleDeactivate = async (plugin: PluginInfo) => {
    if (!user?.tenantId) return;
    try {
      const res = await fetch(`/api/plugins/${plugin.slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: user.tenantId, action: 'deactivate' }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Deactivated "${plugin.name}"`);
        fetchPlugins();
      } else {
        toast.error(data.error || 'Deactivate failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const [uninstallTarget, setUninstallTarget] = useState<PluginInfo | null>(null);

  const handleUninstall = async () => {
    if (!user?.tenantId || !uninstallTarget) return;
    try {
      const res = await fetch(
        `/api/plugins/${uninstallTarget.slug}?tenantId=${user.tenantId}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success(`Uninstalled "${uninstallTarget.name}"`);
        setUninstallTarget(null);
        fetchPlugins();
      } else {
        toast.error(data.error || 'Uninstall failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plugin Manager</h1>
          <p className="text-muted-foreground">
            Manage installed plugins and their lifecycle.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPlugins}>
          <Download className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Lifecycle Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Available</Badge>
          <span>→</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Installed</Badge>
          <span>→</span>
          <Badge className="bg-emerald-600 text-white text-[10px] px-1.5 py-0">Active</Badge>
          <span>→</span>
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Disabled</Badge>
        </span>
      </div>

      {/* Plugin Cards */}
      {pluginsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : plugins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Puzzle className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold mb-1">No plugins found</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              No plugins were discovered in the plugins directory. Add plugin folders
              with a plugin.json manifest file to enable them here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              onInstall={() => handleInstall(plugin)}
              onActivate={() => handleActivate(plugin)}
              onDeactivate={() => handleDeactivate(plugin)}
              onUninstall={() => setUninstallTarget(plugin)}
            />
          ))}
        </div>
      )}

      {/* Uninstall Confirmation Dialog */}
      <Dialog open={!!uninstallTarget} onOpenChange={(open) => !open && setUninstallTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uninstall Plugin</DialogTitle>
            <DialogDescription>
              Are you sure you want to uninstall &ldquo;{uninstallTarget?.name}&rdquo;?
              This will remove all plugin data and settings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUninstallTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleUninstall}>
              <Trash2 className="mr-2 h-4 w-4" />
              Uninstall
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// Plugin Card
// ============================================================

function PluginCard({
  plugin,
  onInstall,
  onActivate,
  onDeactivate,
  onUninstall,
}: {
  plugin: PluginInfo;
  onInstall: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onUninstall: () => void;
}) {
  const statusConfig = getStatusConfig(plugin);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${statusConfig.iconBg}`}
            >
              <Puzzle className={`h-5 w-5 ${statusConfig.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">{plugin.name}</CardTitle>
              <CardDescription className="text-xs">
                v{plugin.version}
                {plugin.author && ` · ${plugin.author}`}
              </CardDescription>
            </div>
          </div>
          <Badge variant={statusConfig.badgeVariant} className="text-[10px] px-1.5 py-0 shrink-0">
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0 pb-4 space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {plugin.description}
        </p>

        {plugin.capabilities && plugin.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {plugin.capabilities.slice(0, 3).map((cap: any, i: number) => (
              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                {cap.name || cap}
              </Badge>
            ))}
            {plugin.capabilities.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                +{plugin.capabilities.length - 3}
              </Badge>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t">
          {!plugin.installed ? (
            <Button size="sm" className="flex-1 h-8 text-xs" onClick={onInstall}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Install
            </Button>
          ) : plugin.status === 'INSTALLED' ? (
            <>
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={onActivate}
              >
                <Power className="mr-1.5 h-3.5 w-3.5" />
                Activate
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onUninstall}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </>
          ) : plugin.status === 'ACTIVE' ? (
            <>
              <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={onDeactivate}>
                <PowerOff className="mr-1.5 h-3.5 w-3.5" />
                Deactivate
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onUninstall}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </>
          ) : plugin.status === 'DISABLED' ? (
            <>
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={onActivate}
              >
                <Power className="mr-1.5 h-3.5 w-3.5" />
                Reactivate
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onUninstall}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Status Helpers
// ============================================================

function getStatusConfig(plugin: PluginInfo) {
  switch (plugin.status) {
    case 'ACTIVE':
      return {
        label: 'Active',
        badgeVariant: 'default' as const,
        iconBg: 'bg-emerald-100 dark:bg-emerald-900/30',
        iconColor: 'text-emerald-600 dark:text-emerald-400',
      };
    case 'INSTALLED':
      return {
        label: 'Installed',
        badgeVariant: 'secondary' as const,
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        iconColor: 'text-blue-600 dark:text-blue-400',
      };
    case 'DISABLED':
      return {
        label: 'Disabled',
        badgeVariant: 'destructive' as const,
        iconBg: 'bg-red-100 dark:bg-red-900/30',
        iconColor: 'text-red-600 dark:text-red-400',
      };
    default:
      return {
        label: 'Available',
        badgeVariant: 'outline' as const,
        iconBg: 'bg-muted',
        iconColor: 'text-muted-foreground',
      };
  }
}
