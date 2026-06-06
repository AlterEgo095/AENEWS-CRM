'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Mail, BarChart3, Target, FileText, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const modules = [
  { name: 'Campaigns', icon: Megaphone, description: 'Multi-channel campaign management with analytics and attribution.' },
  { name: 'Email Marketing', icon: Mail, description: 'Email automation with drag-and-drop builder and A/B testing.' },
  { name: 'Analytics', icon: BarChart3, description: 'Marketing performance dashboards and ROI tracking.' },
  { name: 'Audience', icon: Users, description: 'Segment and target your audience with precision.' },
  { name: 'Content', icon: FileText, description: 'Content creation, scheduling, and publishing tools.' },
  { name: 'Goals', icon: Target, description: 'Set marketing goals and track progress towards targets.' },
];

export default function MarketingView() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-emerald-600" />
          Marketing
        </h1>
        <p className="text-muted-foreground mt-1">Manage campaigns, email marketing, and audience targeting.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module, i) => (
            <motion.div
              key={module.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
            >
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full p-4 bg-emerald-100 dark:bg-emerald-900/50 mb-4">
                    <module.icon className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold">{module.name}</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xs">{module.description}</p>
                  <Badge variant="secondary" className="mt-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    Coming Soon
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
