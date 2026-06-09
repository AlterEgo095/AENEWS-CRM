'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  FileText,
  CreditCard,
  UserPlus,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  ShoppingCart,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

const notifications = [
  {
    id: 1,
    title: 'New deal created',
    description: 'Sarah Chen created "Enterprise License Agreement" — $120,000',
    time: '5 min ago',
    icon: FileText,
    iconColor: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50',
    read: false,
    category: 'CRM',
  },
  {
    id: 2,
    title: 'Payment received',
    description: 'Payment of $24,500 received from Acme Corp for Invoice #INV-2024-0892',
    time: '18 min ago',
    icon: CreditCard,
    iconColor: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50',
    read: false,
    category: 'Finance',
  },
  {
    id: 3,
    title: 'High priority ticket',
    description: 'New support ticket "Integration Issue" assigned to John Davis',
    time: '32 min ago',
    icon: AlertTriangle,
    iconColor: 'text-amber-500 bg-amber-100 dark:bg-amber-900/50',
    read: false,
    category: 'Support',
  },
  {
    id: 4,
    title: 'Team member joined',
    description: 'Emily Rodriguez joined as Marketing Manager',
    time: '1 hour ago',
    icon: UserPlus,
    iconColor: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50',
    read: true,
    category: 'HR',
  },
  {
    id: 5,
    title: 'Campaign started',
    description: 'Marketing campaign "Summer Launch" is now active — targeting 15,000 contacts',
    time: '2 hours ago',
    icon: MessageSquare,
    iconColor: 'text-purple-500 bg-purple-100 dark:bg-purple-900/50',
    read: true,
    category: 'Marketing',
  },
  {
    id: 6,
    title: 'Low stock alert',
    description: 'Product SKU-4521 (Wireless Mouse) is below reorder point — 12 units remaining',
    time: '3 hours ago',
    icon: ShoppingCart,
    iconColor: 'text-red-500 bg-red-100 dark:bg-red-900/50',
    read: true,
    category: 'Inventory',
  },
  {
    id: 7,
    title: 'Task completed',
    description: 'Mike Torres completed "Q4 Financial Report Preparation"',
    time: '4 hours ago',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50',
    read: true,
    category: 'Tasks',
  },
  {
    id: 8,
    title: 'Weekly report ready',
    description: 'Your weekly performance summary for Nov 25 - Dec 1 is ready to view',
    time: '6 hours ago',
    icon: FileText,
    iconColor: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50',
    read: true,
    category: 'System',
  },
];

export default function NotificationsView() {
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    toast.success('All notifications marked as read');
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-emerald-600" />
            Notifications
          </h1>
          <p className="text-muted-foreground mt-1">
            {unreadCount > 0
              ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
              : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="hover:border-emerald-300 hover:text-emerald-600"
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Mark all as read
          </Button>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y">
                {notifications.map((notification, i) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                    className={`flex items-start gap-4 px-6 py-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                      !notification.read ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''
                    }`}
                  >
                    <div className={`mt-0.5 rounded-full p-2 shrink-0 ${notification.iconColor}`}>
                      <notification.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {notification.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {notification.category}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {notification.time}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
