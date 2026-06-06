'use client';

import React, { useEffect, useCallback, useState } from 'react';
import {
  Search,
  Puzzle,
  Download,
  Check,
  Loader2,
  PackageOpen,
} from 'lucide-react';

import { useAppStore, type PluginInfo } from '@/store/app-store';
import { useAuthStore } from '@/store/auth-store';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

// ============================================================
// App Store View
// ============================================================

export default function AppStoreView() {
  const { plugins, setPlugins, pluginsLoading, setPluginsLoading } = useAppStore();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

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

  // Get unique categories from capabilities
  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    plugins.forEach((p) => {
      p.capabilities.forEach((cap: any) => {
        if (cap.type) cats.add(cap.type);
      });
    });
    return Array.from(cats).sort();
  }, [plugins]);

  // Filter plugins
  const filteredPlugins = React.useMemo(() => {
    let result = plugins;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.author?.toLowerCase().includes(q) ||
          p.capabilities.some((cap: any) =>
            (cap.name || cap).toLowerCase().includes(q)
          )
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter((p) =>
        p.capabilities.some((cap: any) => cap.type === selectedCategory)
      );
    }

    return result;
  }, [plugins, searchQuery, selectedCategory]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">App Store</h1>
        <p className="text-muted-foreground">
          Browse and install plugins to extend your AENEWS workspace.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            size="sm"
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            className="h-8 text-xs shrink-0"
            onClick={() => setSelectedCategory('all')}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={selectedCategory === cat ? 'default' : 'outline'}
              className="h-8 text-xs shrink-0 capitalize"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {filteredPlugins.length} plugin{filteredPlugins.length !== 1 ? 's' : ''} found
        </span>
        {searchQuery && (
          <button
            className="text-xs hover:underline"
            onClick={() => setSearchQuery('')}
          >
            Clear search
          </button>
        )}
      </div>

      {/* Plugin Grid */}
      {pluginsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-lg" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-5 w-36" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="flex gap-1">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPlugins.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <PackageOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <h3 className="font-semibold mb-1">
              {searchQuery ? 'No plugins match your search' : 'No plugins available'}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              {searchQuery
                ? 'Try adjusting your search terms or clearing the filter.'
                : 'Add plugin folders with a plugin.json manifest to the plugins directory.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlugins.map((plugin) => (
            <Card key={plugin.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-700 dark:to-emerald-800">
                    <Puzzle className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight truncate">
                      {plugin.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      v{plugin.version}
                      {plugin.author && ` · by ${plugin.author}`}
                    </p>
                  </div>
                  {plugin.installed && (
                    <Badge
                      variant={
                        plugin.status === 'ACTIVE'
                          ? 'default'
                          : plugin.status === 'DISABLED'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="text-[10px] px-1.5 py-0 shrink-0"
                    >
                      {plugin.installed ? (
                        <>
                          <Check className="mr-0.5 h-2.5 w-2.5" />
                          {plugin.status === 'ACTIVE'
                            ? 'Active'
                            : plugin.status === 'DISABLED'
                            ? 'Disabled'
                            : 'Installed'}
                        </>
                      ) : (
                        'Install'
                      )}
                    </Badge>
                  )}
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {plugin.description}
                </p>

                {/* Capabilities */}
                {plugin.capabilities && plugin.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {plugin.capabilities.slice(0, 4).map((cap: any, i: number) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-normal"
                      >
                        {cap.name || cap}
                      </Badge>
                    ))}
                    {plugin.capabilities.length > 4 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 font-normal"
                      >
                        +{plugin.capabilities.length - 4}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Install Button */}
                <Button
                  size="sm"
                  variant={plugin.installed ? 'outline' : 'default'}
                  className="w-full h-8 text-xs"
                  disabled={plugin.status === 'ACTIVE'}
                  onClick={() => handleInstall(plugin)}
                >
                  {plugin.installed ? (
                    plugin.status === 'ACTIVE' ? (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Currently Active
                      </>
                    ) : (
                      <>
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Installed
                      </>
                    )
                  ) : (
                    <>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Install
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
