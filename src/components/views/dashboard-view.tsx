'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  UserPlus,
  PlusCircle,
  Send,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  CalendarDays,
  FileText,
  MessageSquare,
  CreditCard,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAppStore } from '@/store/app-store';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.4, ease: 'easeOut' },
  }),
};

const statsCards = [
  {
    title: 'Active Users',
    value: '2,847',
    change: '+12.5%',
    trend: 'up' as const,
    period: 'from last month',
    icon: Users,
    color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300',
    sparkline: [20, 35, 28, 45, 42, 55, 60, 58, 72, 68, 80, 85],
  },
  {
    title: 'Revenue',
    value: '$48,290',
    change: '+8.2%',
    trend: 'up' as const,
    period: 'from last month',
    icon: DollarSign,
    color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300',
    sparkline: [30, 32, 28, 38, 42, 40, 48, 52, 50, 55, 58, 62],
  },
  {
    title: 'Active Deals',
    value: '156',
    change: '+23',
    trend: 'up' as const,
    period: 'new this week',
    icon: TrendingUp,
    color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300',
    sparkline: [12, 15, 18, 14, 22, 25, 20, 28, 30, 26, 32, 35],
  },
  {
    title: 'Tasks Completed',
    value: '89/112',
    change: '79%',
    trend: 'up' as const,
    period: 'completion rate',
    icon: CheckCircle2,
    color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900 dark:text-emerald-300',
    sparkline: [40, 48, 55, 52, 60, 65, 68, 72, 75, 78, 82, 89],
  },
];

const recentActivity = [
  {
    id: 1,
    title: 'New deal created: "Enterprise License Agreement"',
    description: 'by Sarah Chen — Value: $120,000',
    time: '5 min ago',
    icon: FileText,
    iconColor: 'text-emerald-600',
  },
  {
    id: 2,
    title: 'Payment received from Acme Corp',
    description: 'Invoice #INV-2024-0892 — $24,500',
    time: '18 min ago',
    icon: CreditCard,
    iconColor: 'text-emerald-600',
  },
  {
    id: 3,
    title: 'New support ticket: "Integration Issue"',
    description: 'Assigned to John Davis — Priority: High',
    time: '32 min ago',
    icon: MessageSquare,
    iconColor: 'text-amber-500',
  },
  {
    id: 4,
    title: 'Marketing campaign "Summer Launch" started',
    description: 'Target audience: 15,000 contacts',
    time: '1 hour ago',
    icon: Sparkles,
    iconColor: 'text-purple-500',
  },
  {
    id: 5,
    title: 'New team member joined: Emily Rodriguez',
    description: 'Role: Marketing Manager',
    time: '2 hours ago',
    icon: UserPlus,
    iconColor: 'text-emerald-600',
  },
  {
    id: 6,
    title: 'Inventory alert: Low stock on Product SKU-4521',
    description: 'Current stock: 12 units — Reorder point: 50',
    time: '3 hours ago',
    icon: TrendingUp,
    iconColor: 'text-red-500',
  },
];

const quickActions = [
  { label: 'New Contact', icon: UserPlus, view: 'crm' },
  { label: 'New Deal', icon: PlusCircle, view: 'crm' },
  { label: 'Create Task', icon: CheckCircle2, view: 'dashboard' },
  { label: 'Send Email', icon: Send, view: 'crm' },
  { label: 'View Reports', icon: BarChart3, view: 'dashboard' },
  { label: 'AI Chat', icon: Sparkles, view: 'ai-chat' },
];

const activePlugins = [
  { name: 'CRM Contacts', icon: '👤', status: 'Active' },
  { name: 'Finance', icon: '💰', status: 'Active' },
  { name: 'Inventory', icon: '📦', status: 'Active' },
  { name: 'Kanban', icon: '📋', status: 'Active' },
  { name: 'Live Chat', icon: '💬', status: 'Active' },
  { name: 'Campaigns', icon: '📣', status: 'Active' },
  { name: 'Calendar', icon: '📅', status: 'Active' },
  { name: 'Tasks', icon: '✅', status: 'Active' },
];

function MiniSparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 32;
  const width = 80;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-emerald-500"
      />
    </svg>
  );
}

export default function DashboardView() {
  const { setCurrentView } = useAppStore();
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="border-emerald-200 dark:border-emerald-900 bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card">
          <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Welcome back, Admin
              </h1>
              <p className="text-muted-foreground mt-1">{today}</p>
            </div>
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              <CalendarDays className="mr-1 h-3 w-3" />
              All systems operational
            </Badge>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <div className="flex items-center gap-1 text-xs">
                      {stat.trend === 'up' ? (
                        <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-red-500" />
                      )}
                      <span
                        className={
                          stat.trend === 'up'
                            ? 'text-emerald-600 font-medium'
                            : 'text-red-500 font-medium'
                        }
                      >
                        {stat.change}
                      </span>
                      <span className="text-muted-foreground">
                        {stat.period}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`rounded-lg p-2 ${stat.color}`}>
                      <stat.icon className="h-4 w-4" />
                    </div>
                    <MiniSparkline data={stat.sparkline} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>Latest updates across your platform</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {recentActivity.map((activity, i) => (
                  <motion.div
                    key={activity.id}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    className="flex items-start gap-4 px-6 py-4 hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={`mt-0.5 rounded-full p-2 bg-muted ${activity.iconColor}`}
                    >
                      <activity.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {activity.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {activity.time}
                    </span>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
              <CardDescription>Common actions at your fingertips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="h-auto py-3 px-3 flex flex-col items-center gap-2 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                    onClick={() => setCurrentView(action.view)}
                  >
                    <action.icon className="h-5 w-5 text-emerald-600" />
                    <span className="text-xs font-medium">{action.label}</span>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Active Plugins */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Active Plugins</CardTitle>
                <CardDescription>
                  Currently running modules in your workspace
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentView('app-store')}
              >
                Browse All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="flex gap-4 px-6 pb-6 pt-2">
                {activePlugins.map((plugin) => (
                  <Card
                    key={plugin.name}
                    className="min-w-[140px] flex-shrink-0 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setCurrentView('app-store')}
                  >
                    <CardContent className="p-4 flex flex-col items-center gap-2">
                      <span className="text-2xl">{plugin.icon}</span>
                      <span className="text-sm font-medium text-center">
                        {plugin.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px]"
                      >
                        {plugin.status}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
