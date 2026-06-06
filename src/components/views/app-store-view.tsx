'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Download,
  Check,
  Store,
  Users,
  Building2,
  DollarSign,
  GitBranch,
  Activity,
  StickyNote,
  CheckSquare,
  Calendar,
  Mail,
  Landmark,
  Calculator,
  Receipt,
  Package,
  Truck,
  UserCog,
  Wallet,
  CalendarOff,
  UserPlus,
  Heart,
  Stethoscope,
  ClipboardList,
  Pill,
  GraduationCap,
  FileQuestion,
  BarChart3,
  Home,
  FileSignature,
  Key,
  Cog,
  Factory,
  ShieldCheck,
  Megaphone,
  Headphones,
  MessageSquare,
  BookOpen,
  Columns3,
  GanttChart,
  Zap,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

import { pluginCatalog, pluginCategories, type PluginItem } from '@/lib/plugin-data';

const iconMap: Record<string, LucideIcon> = {
  Users, Building2, DollarSign, GitBranch, Activity, StickyNote, CheckSquare, Calendar, Mail,
  Landmark, Calculator, Receipt, Package, Truck,
  UserCog, Wallet, CalendarOff, UserPlus,
  Heart, Stethoscope, ClipboardList, Pill,
  GraduationCap, FileQuestion, BarChart3,
  Home, FileSignature, Key,
  Cog, Factory, ShieldCheck,
  Megaphone,
  Headphones, MessageSquare, BookOpen,
  Columns3, GanttChart, Zap,
  ShoppingBag, ShoppingCart, CreditCard,
};

export default function AppStoreView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [plugins, setPlugins] = useState<PluginItem[]>(pluginCatalog);

  const filteredPlugins = useMemo(() => {
    return plugins.filter((plugin) => {
      const matchesSearch =
        searchQuery === '' ||
        plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        plugin.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        activeCategory === 'All' || plugin.category === activeCategory;

      return matchesSearch && matchesCategory;
    });
  }, [plugins, searchQuery, activeCategory]);

  const installedCount = plugins.filter((p) => p.isInstalled).length;
  const activeCount = plugins.filter((p) => p.isActive).length;

  const handleInstall = (pluginId: string) => {
    setPlugins((prev) =>
      prev.map((p) => (p.id === pluginId ? { ...p, isInstalled: true } : p))
    );
    toast.success('Plugin installed successfully');
  };

  const handleActivate = (pluginId: string) => {
    setPlugins((prev) =>
      prev.map((p) =>
        p.id === pluginId ? { ...p, isActive: !p.isActive } : p
      )
    );
    const plugin = plugins.find((p) => p.id === pluginId);
    toast.success(
      plugin?.isActive
        ? `${plugin?.name} deactivated`
        : `${plugin?.name} activated`
    );
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Store className="h-6 w-6 text-emerald-600" />
            App Store
          </h1>
          <p className="text-muted-foreground">
            Browse and install plugins to extend your AENEWS platform.
            {installedCount} plugins installed, {activeCount} active.
          </p>
        </div>
      </motion.div>

      {/* Search + Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search plugins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </motion.div>

      {/* Category Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
      >
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <TabsList className="flex-wrap h-auto gap-1">
            {pluginCategories.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="text-xs">
                {cat}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </motion.div>

      {/* Plugin Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredPlugins.map((plugin, i) => {
            const IconComponent = iconMap[plugin.icon] || Store;

            return (
              <motion.div
                key={plugin.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03, duration: 0.3 }}
              >
                <Card className="h-full hover:shadow-lg transition-all duration-300 hover:border-emerald-200 dark:hover:border-emerald-800 group">
                  <CardContent className="p-5 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg p-2.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800 transition-colors">
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{plugin.name}</h3>
                          <p className="text-xs text-muted-foreground">
                            v{plugin.version} · {plugin.author}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {plugin.category}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground mb-4 flex-1">
                      {plugin.description}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {plugin.capabilities.map((cap) => (
                        <Badge
                          key={cap}
                          variant="outline"
                          className="text-[10px] font-normal"
                        >
                          {cap}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 mt-auto">
                      {plugin.isInstalled ? (
                        <>
                          <Button
                            variant={plugin.isActive ? 'default' : 'outline'}
                            size="sm"
                            className={
                              plugin.isActive
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'hover:border-emerald-300 hover:text-emerald-600'
                            }
                            onClick={() => handleActivate(plugin.id)}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            {plugin.isActive ? 'Active' : 'Activate'}
                          </Button>
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          >
                            Installed
                          </Badge>
                        </>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                          onClick={() => handleInstall(plugin.id)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Install
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredPlugins.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No plugins found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </div>
  );
}
