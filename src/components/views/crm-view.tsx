'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Users, Building2, DollarSign, GitBranch, Activity, CheckSquare, Calendar, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const crmTabs = [
  { id: 'contacts', label: 'Contacts', icon: Users, description: 'Manage your contact database with profiles, notes, and interaction history.' },
  { id: 'companies', label: 'Companies', icon: Building2, description: 'Track organizations with hierarchy and relationship mapping.' },
  { id: 'deals', label: 'Deals', icon: DollarSign, description: 'Manage your sales pipeline with stages, values, and forecasting.' },
  { id: 'pipeline', label: 'Pipeline', icon: GitBranch, description: 'Visual kanban pipeline with drag-and-drop deal management.' },
  { id: 'activities', label: 'Activities', icon: Activity, description: 'Log calls, meetings, emails, and other interactions.' },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare, description: 'Create and assign tasks with due dates and priorities.' },
  { id: 'calendar', label: 'Calendar', icon: Calendar, description: 'Shared calendar with scheduling and availability.' },
  { id: 'email', label: 'Email', icon: Mail, description: 'Integrated email client with templates and tracking.' },
];

export default function CrmView() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-emerald-600" />
          CRM
        </h1>
        <p className="text-muted-foreground mt-1">Manage your customer relationships, deals, and pipeline.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <Tabs defaultValue="contacts">
          <TabsList className="flex-wrap h-auto">
            {crmTabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="gap-2">
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {crmTabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id} className="mt-6">
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="rounded-full p-4 bg-emerald-100 dark:bg-emerald-900/50 mb-4">
                    <tab.icon className="h-8 w-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-semibold">{tab.label}</h3>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md">{tab.description}</p>
                  <Badge variant="secondary" className="mt-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    Coming Soon
                  </Badge>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </motion.div>
    </div>
  );
}
