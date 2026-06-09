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
  Loader2,
  LayoutGrid,
  List,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

interface PluginEntityViewProps {
  pluginSlug: string;
  entityName: string;
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
  negotiation: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  income: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  expense: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border-rose-200 dark:border-rose-800',
};

// ============================================================
// Plugin Entity View
// ============================================================

export default function PluginEntityView({
  pluginSlug,
  entityName,
}: PluginEntityViewProps) {
  const [entities, setEntities] = useState<PluginEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortField, setSortField] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [stats, setStats] = useState<{ total: number; byStatus: Record<string, number> }>({
    total: 0,
    byStatus: {},
  });

  // Fetch entity data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('type', entityName);
      params.set('limit', '100');

      const res = await fetch(`/api/plugins/${pluginSlug}/entities?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch entity data');
      }

      const data = await res.json();
      setEntities(data.entities || []);
      setStats(data.stats || { total: 0, byStatus: {} });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [pluginSlug, entityName]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      // Client-side filtering is instant; no need for refetch
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtered entities
  const filteredEntities = useMemo(() => {
    let result = [...entities];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.name?.toLowerCase().includes(q) ||
          e.status?.toLowerCase().includes(q) ||
          Object.values(e).some(
            (v) => typeof v === 'string' && v.toLowerCase().includes(q)
          )
      );
    }

    result.sort((a, b) => {
      const aVal = String(a[sortField] || '');
      const bVal = String(b[sortField] || '');
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [entities, searchQuery, sortField, sortDir]);

  // Stats cards
  const statsCards = useMemo(() => {
    const cards: { label: string; value: number; color: string }[] = [
      { label: 'Total', value: stats.total, color: 'text-foreground' },
    ];

    for (const [status, count] of Object.entries(stats.byStatus)) {
      const color =
        status === 'active' || status === 'completed' || status === 'resolved' || status === 'approved' || status === 'income'
          ? 'text-emerald-600 dark:text-emerald-400'
          : status === 'pending' || status === 'planned' || status === 'lead' || status === 'medium'
            ? 'text-amber-600 dark:text-amber-400'
            : status === 'in_progress' || status === 'open' || status === 'review'
              ? 'text-sky-600 dark:text-sky-400'
              : status === 'inactive' || status === 'failed' || status === 'critical' || status === 'expense' || status === 'high'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground';
      cards.push({
        label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
        value: count,
        color,
      });
    }

    return cards.slice(0, 4);
  }, [stats]);

  // Table columns
  const tableColumns = useMemo(() => {
    if (filteredEntities.length === 0) return [];
    const entity = filteredEntities[0];
    const excludeCols = new Set(['id', 'type', 'createdAt', 'updatedAt', '__typename']);
    return Object.keys(entity).filter((k) => !excludeCols.has(k) && entity[k] !== undefined);
  }, [filteredEntities]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // ─── Loading state ───
  if (loading) {
    return (
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        {/* Table */}
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Error state ───
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Box className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <h3 className="font-semibold mb-1">Failed to load data</h3>
        <p className="text-sm text-muted-foreground mb-3">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={entityName}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        className="space-y-4"
      >
        {/* ─── Stats Row ─── */}
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

        {/* ─── Toolbar ─── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={async () => {
              try {
                const res = await fetch(`/api/plugins/${pluginSlug}/entities`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ type: entityName, name: `New ${entityName.replace(/s$/, '')}` }),
                });
                if (res.ok) {
                  toast.success('Entity created');
                  fetchData();
                }
              } catch {
                toast.error('Failed to create');
              }
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Create
          </Button>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${entityName}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px] lg:w-[260px]"
              />
            </div>

            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* ─── Results count ─── */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredEntities.length} {entityName}
            {filteredEntities.length !== 1 ? 's' : ''}
          </span>
          {searchQuery && (
            <button className="text-xs hover:underline" onClick={() => setSearchQuery('')}>
              Clear search
            </button>
          )}
        </div>

        {/* ─── Content ─── */}
        {filteredEntities.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Box className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <h3 className="font-semibold mb-1">No data found</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                No {entityName} match your current filter. Try adjusting your search or create a new entry.
              </p>
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredEntities.map((entity) => (
              <EntityCard key={entity.id} entity={entity} columns={tableColumns} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableColumns.slice(0, 6).map((col, colIdx) => (
                      <TableHead
                        key={col}
                        className={`cursor-pointer select-none ${
                          colIdx === tableColumns.slice(0, 6).length - 1
                            ? 'hidden xl:table-cell'
                            : colIdx === 2
                              ? 'hidden lg:table-cell'
                              : ''
                        }`}
                        onClick={() => toggleSort(col)}
                      >
                        <div className="flex items-center gap-1">
                          <span className="capitalize">{col.replace(/_/g, ' ')}</span>
                          {sortField === col && <ArrowUpDown className="h-3.5 w-3.5" />}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntities.map((entity) => (
                    <TableRow key={entity.id} className="group hover:bg-muted/50">
                      {tableColumns.slice(0, 6).map((col, colIdx) => {
                        const value = entity[col];
                        const isName = col === 'name';
                        const isStatus = col === 'status';
                        const isHidden =
                          colIdx === tableColumns.slice(0, 6).length - 1
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
                                <span className="font-medium text-sm truncate">{String(value)}</span>
                              </div>
                            ) : isStatus ? (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${STATUS_STYLES[String(value)] || ''}`}
                              >
                                {String(value).replace(/_/g, ' ')}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground truncate">{String(value)}</span>
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
                            <DropdownMenuItem onClick={() => toast.info(entity.name, { description: `ID: ${entity.id}` })}>
                              <Eye className="h-4 w-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toast.info('Edit dialog would open')}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                setEntities((prev) => prev.filter((e) => e.id !== entity.id));
                                toast.success(`"${entity.name}" deleted`);
                              }}
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
        )}

        {/* Loading overlay */}
        {loading && entities.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-sm pointer-events-none">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ============================================================
// Entity Card (grid view)
// ============================================================

function EntityCard({
  entity,
  columns,
}: {
  entity: PluginEntity;
  columns: string[];
}) {
  // Show first 4 fields (excluding id, type)
  const visibleFields = columns
    .filter((c) => !['id', 'type', 'createdAt', 'updatedAt'].includes(c))
    .slice(0, 4);

  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {(entity.name || '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{entity.name}</h3>
              {entity.status && (
                <Badge
                  variant="outline"
                  className={`text-[9px] mt-0.5 ${STATUS_STYLES[entity.status] || ''}`}
                >
                  {entity.status.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Fields */}
        <div className="space-y-1 text-sm">
          {visibleFields
            .filter((f) => f !== 'name' && f !== 'status')
            .map((field) => (
              <div key={field} className="flex items-center justify-between text-muted-foreground">
                <span className="capitalize text-xs">{field.replace(/_/g, ' ')}:</span>
                <span className="text-xs truncate max-w-[60%] text-right">
                  {String(entity[field] ?? '—')}
                </span>
              </div>
            ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => toast.info(entity.name, { description: `ID: ${entity.id}` })}
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => toast.info('Edit dialog would open')}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => toast.success(`"${entity.name}" deleted`)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
