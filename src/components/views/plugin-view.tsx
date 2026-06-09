'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Search,
  Plus,
  MoreHorizontal,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  RefreshCw,
  Box,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

import { useAppStore } from '@/store/app-store';

// ============================================================
// Types
// ============================================================

interface PluginEntity {
  id: string;
  type: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

interface PluginEntityType {
  name: string;
  icon: string;
}

interface PluginData {
  plugin: {
    id: string;
    name: string;
    slug: string;
    description: string;
    version: string;
    status: string;
    icon: string;
  };
  entities: PluginEntity[];
  entityType: string;
  entityTypes: PluginEntityType[]; // [name, icon] pairs as flat strings
  stats: {
    total: number;
    byStatus: Record<string, number>;
  };
}

// ============================================================
// Status badge styles
// ============================================================

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  closed_won: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  planned: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  in_progress: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  review: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  open: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  lead: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  prospect: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  customer: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  failed: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  critical: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  negotiation: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  proposal: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  discovery: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  qualification: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
};

// ============================================================
// Helper: Dynamic Lucide icon
// ============================================================

function DynamicIcon({
  name,
  className,
  fallback,
}: {
  name: string;
  className?: string;
  fallback?: LucideIcon;
}) {
  const Icon = (LucideIcons as Record<string, LucideIcon>)[name] || fallback || LucideIcons.Box;
  return <Icon className={className} />;
}

// ============================================================
// Helper: Resolve icon from plugin slug
// ============================================================

function getPluginIconName(slug: string): string {
  const iconMap: Record<string, string> = {
    'crm-contacts': 'Users',
    'crm-companies': 'Building2',
    'crm-deals': 'DollarSign',
    'crm-tasks': 'CheckSquare',
    'crm-activities': 'Activity',
    'crm-notes': 'StickyNote',
    'crm-calendar': 'Calendar',
    'crm-email': 'Mail',
    'crm-pipeline': 'GitBranch',
    'erp-finance': 'Landmark',
    'erp-accounting': 'Calculator',
    'erp-inventory': 'Package',
    'erp-tax': 'Receipt',
    'erp-procurement': 'Truck',
    'hr-employees': 'UserCog',
    'hr-payroll': 'Wallet',
    'hr-leave': 'CalendarOff',
    'hr-recruitment': 'UserPlus',
    'sup-tickets': 'Headphones',
    'sup-chat': 'MessageSquare',
    'sup-knowledge-base': 'BookOpen',
    'mkt-campaigns': 'Megaphone',
    'proj-kanban': 'Columns3',
    'proj-gantt': 'GanttChart',
    'proj-sprints': 'Zap',
    'eco-catalog': 'ShoppingBag',
    'eco-cart': 'ShoppingCart',
    'eco-payments': 'CreditCard',
    'garage': 'Car',
    'hotel': 'BedDouble',
    'bank': 'Landmark',
    'restaurant': 'UtensilsCrossed',
    'university': 'GraduationCap',
    'pharmacy': 'Pill',
    'clinic': 'Stethoscope',
    'immobilier': 'Building2',
    'ong': 'Heart',
    'police': 'Shield',
    'justice': 'Scale',
    'eglise': 'Church',
    'cooperative': 'UsersRound',
    'assurance': 'ShieldCheck',
    'transport': 'Bus',
  };
  return iconMap[slug] || 'Box';
}

function PluginIconComponent({ name, className }: { name: string; className?: string }) {
  const Icon = (LucideIcons as Record<string, LucideIcon>)[name] || LucideIcons.Box;
  return <Icon className={className} />;
}

// ============================================================
// Plugin View — Generic plugin dashboard
// ============================================================

export default function PluginView({ pluginSlug }: { pluginSlug: string }) {
  const [pluginData, setPluginData] = useState<PluginData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeEntityType, setActiveEntityType] = useState<string>('default');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [creatingEntity, setCreatingEntity] = useState(false);

  const pluginIconName = getPluginIconName(pluginSlug);

  // Fetch plugin entity data
  const fetchPluginData = useCallback(
    async (entityType?: string) => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        params.set('type', entityType || activeEntityType);
        params.set('limit', '50');

        const res = await fetch(`/api/plugins/${pluginSlug}/entities?${params.toString()}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(err.error || 'Failed to fetch plugin data');
        }

        const data = await res.json();
        setPluginData(data);

        // Auto-select the first entity type if not already set
        if (data.entityTypes?.length > 0 && entityType === undefined) {
          const firstType = Array.isArray(data.entityTypes[0])
            ? data.entityTypes[0][0]
            : data.entityTypes[0];
          setActiveEntityType(firstType);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plugin');
      } finally {
        setLoading(false);
      }
    },
    [pluginSlug, activeEntityType]
  );

  // Initial load + refetch when entity type changes
  useEffect(() => {
    fetchPluginData();
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [fetchPluginData]);

  // Parse entity types
  const entityTypes: PluginEntityType[] = useMemo(() => {
    if (!pluginData?.entityTypes) return [];
    return pluginData.entityTypes.map((et) => {
      if (Array.isArray(et)) {
        return { name: et[0] as string, icon: et[1] as string };
      }
      return { name: et as string, icon: 'Box' };
    });
  }, [pluginData?.entityTypes]);

  // Filtered & sorted entities
  const displayEntities = useMemo(() => {
    if (!pluginData?.entities) return [];

    let entities = [...pluginData.entities];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      entities = entities.filter(
        (e) =>
          e.name?.toLowerCase().includes(q) ||
          e.status?.toLowerCase().includes(q) ||
          Object.values(e).some(
            (v) => typeof v === 'string' && v.toLowerCase().includes(q)
          )
      );
    }

    // Sort
    entities.sort((a, b) => {
      const aVal = String(a[sortField] || '');
      const bVal = String(b[sortField] || '');
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return entities;
  }, [pluginData, searchQuery, sortField, sortDir]);

  // Stats
  const statsCards = useMemo(() => {
    if (!pluginData?.stats) return [];
    const { byStatus, total } = pluginData.stats;

    const cards: { label: string; value: number; color: string }[] = [
      { label: 'Total', value: total, color: 'text-foreground' },
    ];

    for (const [status, count] of Object.entries(byStatus)) {
      const color =
        status === 'active' || status === 'completed' || status === 'resolved' || status === 'approved'
          ? 'text-emerald-600 dark:text-emerald-400'
          : status === 'pending' || status === 'planned' || status === 'lead'
            ? 'text-amber-600 dark:text-amber-400'
            : status === 'in_progress' || status === 'open' || status === 'review'
              ? 'text-sky-600 dark:text-sky-400'
              : status === 'inactive' || status === 'failed' || status === 'critical'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground';
      cards.push({
        label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
        value: count,
        color,
      });
    }

    return cards.slice(0, 4); // Max 4 stat cards
  }, [pluginData]);

  // Get table columns from entity data (dynamic)
  const tableColumns = useMemo(() => {
    if (!displayEntities || displayEntities.length === 0) return [];
    const entity = displayEntities[0];
    const excludeCols = new Set(['id', 'type', 'createdAt', 'updatedAt', '__typename']);
    return Object.keys(entity).filter((k) => !excludeCols.has(k) && entity[k] !== undefined);
  }, [displayEntities]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const handleCreateEntity = async () => {
    setCreatingEntity(true);
    try {
      const res = await fetch(`/api/plugins/${pluginSlug}/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeEntityType,
          name: `New ${activeEntityType.replace(/s$/, '') || 'Item'}`,
          status: 'active',
        }),
      });
      if (res.ok) {
        toast.success('Entity created successfully');
        fetchPluginData(activeEntityType);
      }
    } catch {
      toast.error('Failed to create entity');
    } finally {
      setCreatingEntity(false);
    }
  };

  // ─── Loading state ───
  if (loading && !pluginData) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header skeleton */}
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Error state ───
  if (error && !pluginData) {
    return (
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-16"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-900/30 mb-4">
            <Box className="h-8 w-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Plugin Not Available</h2>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            {error}
          </p>
          <Button variant="outline" onClick={() => fetchPluginData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${pluginSlug}-${activeEntityType}`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto"
      >
        {/* ─── Plugin Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
              <PluginIconComponent name={pluginIconName} className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {pluginData?.plugin.name || pluginSlug}
                </h1>
                <Badge
                  variant="outline"
                  className={
                    pluginData?.plugin.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 text-[10px]'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]'
                  }
                >
                  {pluginData?.plugin.status === 'ACTIVE' ? (
                    <CheckCircle2 className="h-3 w-3 mr-0.5" />
                  ) : (
                    <Clock className="h-3 w-3 mr-0.5" />
                  )}
                  {pluginData?.plugin.status || 'Active'}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-0.5">
                {pluginData?.plugin.description || 'Plugin data management'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchPluginData(activeEntityType)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1.5" />
              )}
              Refresh
            </Button>
            <Button
              onClick={handleCreateEntity}
              disabled={creatingEntity}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              size="sm"
            >
              {creatingEntity ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1.5" />
              )}
              Create
            </Button>
          </div>
        </div>

        {/* ─── Stats Cards ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statsCards.map((stat) => (
            <Card key={stat.label} className="py-3 px-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <span className={`text-lg font-bold ${stat.color}`}>{stat.value}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* ─── Entity Type Tabs + Search ─── */}
        {entityTypes.length > 1 && (
          <Tabs value={activeEntityType} onValueChange={setActiveEntityType}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <TabsList>
                {entityTypes.map((et) => (
                  <TabsTrigger key={et.name} value={et.name} className="gap-1.5">
                    <DynamicIcon name={et.icon} className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline capitalize">{et.name}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="flex-1" />

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${activeEntityType}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px] lg:w-[260px]"
                />
              </div>
            </div>

            {entityTypes.map((et) => (
              <TabsContent key={et.name} value={et.name} className="mt-4">
                {renderEntityTable(
                  activeEntityType === et.name ? displayEntities : [],
                  tableColumns,
                  sortField,
                  sortDir,
                  toggleSort
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}

        {/* ─── Single Entity Type (no tabs) ─── */}
        {entityTypes.length <= 1 && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>
                  {displayEntities.length} {activeEntityType}
                  {displayEntities.length !== 1 ? 's' : ''}
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

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px] lg:w-[260px]"
                />
              </div>
            </div>

            {renderEntityTable(displayEntities, tableColumns, sortField, sortDir, toggleSort)}
          </>
        )}

        {/* ─── Loading overlay for refetch ─── */}
        {loading && pluginData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm pointer-events-none">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================
// Render Entity Table
// ============================================================

function renderEntityTable(
  entities: PluginEntity[],
  columns: string[],
  sortField: string,
  sortDir: string,
  toggleSort: (field: string) => void
) {
  if (entities.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Box className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="font-semibold mb-1">No data found</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            No entities match your current filter. Try adjusting your search or create a new entry.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Which columns to show in table (first 6 max for responsive)
  const visibleColumns = columns.slice(0, 6);
  const hiddenColumns = columns.slice(6);

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((col) => (
                <TableHead
                  key={col}
                  className={`cursor-pointer select-none ${
                    col === visibleColumns[visibleColumns.length - 1]
                      ? 'hidden xl:table-cell'
                      : col === visibleColumns[2]
                        ? 'hidden lg:table-cell'
                        : ''
                  }`}
                  onClick={() => toggleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    <span className="capitalize">{col.replace(/_/g, ' ')}</span>
                    {sortField === col && (
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {entities.map((entity) => (
              <TableRow key={entity.id} className="group hover:bg-muted/50">
                {visibleColumns.map((col, colIdx) => {
                  const value = entity[col];
                  const isName = col === 'name';
                  const isStatus = col === 'status';
                  const isHidden =
                    colIdx === visibleColumns.length - 1
                      ? 'xl:table-cell'
                      : colIdx === 2
                        ? 'lg:table-cell'
                        : '';

                  return (
                    <TableCell key={col} className={isHidden}>
                      {isName ? (
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                              {String(value).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="font-medium text-sm truncate">
                            {String(value)}
                          </span>
                        </div>
                      ) : isStatus ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_STYLES[String(value)] || ''}`}
                        >
                          {String(value).replace(/_/g, ' ')}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground truncate">
                          {String(value)}
                        </span>
                      )}
                    </TableCell>
                  );
                })}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          toast.info(entity.name, {
                            description: `ID: ${entity.id} · Type: ${entity.type}`,
                          })
                        }
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast.info('Edit modal would open')}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => toast.success(`"${entity.name}" deleted`)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
