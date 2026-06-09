'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Headphones, Ticket, MessageSquare, BookOpen, Clock, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const modules = [
  { name: 'Tickets', icon: Ticket, description: 'Support ticket management with SLA tracking and escalation rules.' },
  { name: 'Live Chat', icon: MessageSquare, description: 'Real-time live chat with chatbots and canned responses.' },
  { name: 'Knowledge Base', icon: BookOpen, description: 'Self-service knowledge base with articles and search.' },
  { name: 'SLA Management', icon: Clock, description: 'Define SLA policies, track compliance, and manage escalation.' },
  { name: 'Satisfaction', icon: Star, description: 'Collect and analyze customer satisfaction feedback.' },
];

export default function SupportView() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Headphones className="h-6 w-6 text-emerald-600" />
          Support
        </h1>
        <p className="text-muted-foreground mt-1">Manage customer support tickets, live chat, and knowledge base.</p>
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
