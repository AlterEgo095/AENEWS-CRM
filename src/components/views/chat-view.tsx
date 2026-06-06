'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Sparkles,
  Plus,
  ChevronDown,
  Bot,
  User,
  Database,
  BarChart3,
  Users,
  Package,
} from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tools?: string[];
}

interface ChatThread {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
  messages: Message[];
}

const demoThreads: ChatThread[] = [
  {
    id: 'thread-1',
    title: 'Sales Analysis',
    lastMessage: 'Based on the CRM data, here\'s a summary...',
    timestamp: '2 min ago',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Can you analyze our sales performance for this quarter?',
        timestamp: '10:30 AM',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content:
          'I\'ve analyzed your sales data from the **CRM** module. Here\'s a summary:\n\n**Q4 2024 Sales Performance:**\n\n- **Total Revenue**: $482,900 (+18.5% vs Q3)\n- **New Deals Closed**: 47 (up from 38)\n- **Average Deal Size**: $10,277 (+12%)\n- **Win Rate**: 34% (industry avg: 28%)\n\n### Key Insights\n\n1. Enterprise segment grew **23%** — driven by 3 major wins in tech sector\n2. Mid-market conversion rate improved to **41%** after implementing the new follow-up workflow\n3. Pipeline value is at **$1.2M** for next quarter\n\nWould you like me to drill down into any specific segment?',
        timestamp: '10:31 AM',
        tools: ['CRM', 'Analytics'],
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'Show me the top performing sales reps',
        timestamp: '10:33 AM',
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content:
          'Here are your **top 5 sales reps** for Q4:\n\n| Rep | Deals | Revenue | Avg Deal | Win Rate |\n|-----|-------|---------|----------|----------|\n| Sarah Chen | 12 | $156K | $13K | 45% |\n| Mike Torres | 9 | $128K | $14.2K | 42% |\n| Lisa Park | 8 | $94K | $11.8K | 38% |\n| James Wu | 7 | $68K | $9.7K | 35% |\n| Amy Liu | 6 | $52K | $8.7K | 40% |\n\nSarah Chen is leading with a **45% win rate** and highest total revenue. She\'s particularly strong in the enterprise segment.',
        timestamp: '10:34 AM',
        tools: ['CRM', 'HR'],
      },
    ],
  },
  {
    id: 'thread-2',
    title: 'Inventory Check',
    lastMessage: 'I found 8 items that are below their reorder point...',
    timestamp: '1 hour ago',
    messages: [
      {
        id: 'msg-5',
        role: 'user',
        content: 'Check our current inventory levels and flag any items that need reordering',
        timestamp: '9:15 AM',
      },
      {
        id: 'msg-6',
        role: 'assistant',
        content:
          'I\'ve checked the **Inventory** module. Here\'s the current status:\n\n### Stock Summary\n- **Total SKUs**: 1,247\n- **In Stock**: 1,189 (95.3%)\n- **Low Stock**: 42 items\n- **Out of Stock**: 8 items\n- **Total Value**: $2.4M\n\n### ⚠️ Items Below Reorder Point (8 Critical)\n\n1. **SKU-4521** — Wireless Mouse — **12 units** (reorder at: 50)\n2. **SKU-3302** — USB-C Hub — **8 units** (reorder at: 30)\n3. **SKU-7811** — Laptop Stand — **3 units** (reorder at: 25)\n4. **SKU-5567** — Monitor Arm — **5 units** (reorder at: 20)\n5. **SKU-2290** — Keyboard — **15 units** (reorder at: 40)\n6. **SKU-8834** — Webcam HD — **0 units** (reorder at: 15) — **OUT OF STOCK**\n7. **SKU-4401** — Desk Pad — **10 units** (reorder at: 30)\n8. **SKU-6673** — Cable Kit — **2 units** (reorder at: 25)\n\nWould you like me to create purchase orders for these items?',
        timestamp: '9:16 AM',
        tools: ['Inventory', 'Procurement'],
      },
    ],
  },
];

export default function ChatView() {
  const [threads, setThreads] = useState<ChatThread[]>(demoThreads);
  const [activeThreadId, setActiveThreadId] = useState(demoThreads[0].id);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeThread = threads.find((t) => t.id === activeThreadId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread?.messages, isTyping]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    };

    setThreads((prev) =>
      prev.map((t) =>
        t.id === activeThreadId
          ? {
              ...t,
              messages: [...t.messages, userMessage],
              lastMessage: inputValue.trim(),
              timestamp: 'Just now',
            }
          : t
      )
    );
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content:
          'I\'ve processed your request. Let me gather the relevant data from your connected modules and provide you with a comprehensive analysis.\n\nBased on the current data, here are the key findings:\n\n- **Metric A**: Showing positive trend with 15% improvement\n- **Metric B**: Stable performance, within expected range\n- **Metric C**: Needs attention — down 8% from previous period\n\nWould you like me to elaborate on any of these points or run a deeper analysis?',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        }),
        tools: ['CRM', 'Analytics'],
      };

      setThreads((prev) =>
        prev.map((t) =>
          t.id === activeThreadId
            ? {
                ...t,
                messages: [...t.messages, aiMessage],
                lastMessage: 'Based on the current data, here are the key findings...',
              }
            : t
        )
      );
      setIsTyping(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewThread = () => {
    const newThread: ChatThread = {
      id: `thread-${Date.now()}`,
      title: 'New Chat',
      lastMessage: 'Start a conversation...',
      timestamp: 'Just now',
      messages: [],
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
  };

  const toolIconMap: Record<string, React.ElementType> = {
    CRM: Users,
    Analytics: BarChart3,
    Inventory: Package,
    HR: Users,
    Procurement: Database,
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Thread Sidebar */}
      <div className="hidden md:flex w-64 lg:w-72 flex-col border-r bg-muted/30">
        <div className="p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={handleNewThread}
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </div>
        <Separator />
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {threads.map((thread) => (
              <button
                key={thread.id}
                onClick={() => setActiveThreadId(thread.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-sm ${
                  activeThreadId === thread.id
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100'
                    : 'hover:bg-muted'
                }`}
              >
                <div className="font-medium truncate">{thread.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-between">
                  <span className="truncate">{thread.lastMessage}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {thread.timestamp}
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" />
            <h2 className="font-semibold text-sm">
              {activeThread?.title || 'AI Chat'}
            </h2>
            <Badge
              variant="secondary"
              className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
            >
              AI Assistant
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4">GPT-4</SelectItem>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {activeThread?.messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="rounded-full p-4 bg-emerald-100 dark:bg-emerald-900/50 mb-4">
                <Sparkles className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold">Start a conversation</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Ask me anything about your business data. I can query your CRM, finance, inventory, and other modules to provide insights.
              </p>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {[
                  'Show sales summary',
                  'Check inventory levels',
                  'Analyze team performance',
                  'Generate report',
                ].map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setInputValue(suggestion);
                      textareaRef.current?.focus();
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4 max-w-3xl mx-auto">
            <AnimatePresence>
              {activeThread?.messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'flex-row-reverse' : ''
                  }`}
                >
                  <div
                    className={`flex-shrink-0 rounded-full p-2 ${
                      message.role === 'user'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User className="h-4 w-4" />
                    ) : (
                      <Bot className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`flex flex-col max-w-[80%] ${
                      message.role === 'user' ? 'items-end' : ''
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        message.role === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-md'
                          : 'bg-muted rounded-bl-md'
                      }`}
                    >
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none [&_strong]:font-semibold [&_table]:w-full [&_th]:p-2 [&_td]:p-2 [&_th]:border [&_td]:border [&_th]:text-left [&_thead]:bg-muted/50 [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:rounded [&_h3]:text-base [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:mt-1 [&_ol]:mt-1 [&_li]:mt-0.5"
                        dangerouslySetInnerHTML={{
                          __html: message.content
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                            .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
                            .replace(/^- (.*$)/gm, '<li>$1</li>')
                            .replace(/\n\n/g, '<br/><br/>')
                            .replace(/\n/g, '<br/>'),
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {message.timestamp}
                      </span>
                      {message.tools && message.tools.length > 0 && (
                        <div className="flex gap-1">
                          {message.tools.map((tool) => {
                            const ToolIcon = toolIconMap[tool] || Database;
                            return (
                              <Tooltip key={tool}>
                                <TooltipTrigger>
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] py-0 gap-1"
                                  >
                                    <ToolIcon className="h-2.5 w-2.5" />
                                    {tool}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Consulted {tool} module
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isTyping && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="flex-shrink-0 rounded-full p-2 bg-muted text-muted-foreground">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <Skeleton className="h-2 w-2 rounded-full animate-pulse" />
                      <Skeleton className="h-2 w-2 rounded-full animate-pulse [animation-delay:150ms]" />
                      <Skeleton className="h-2 w-2 rounded-full animate-pulse [animation-delay:300ms]" />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      AI is thinking...
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your business data..."
                className="min-h-[44px] max-h-[200px] resize-none"
                rows={1}
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleSend}
                disabled={!inputValue.trim() || isTyping}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              AI may produce inaccurate information. Always verify critical data.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
