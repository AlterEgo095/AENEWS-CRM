'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Send,
  Plus,
  Search,
  Trash2,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuthStore } from '@/store/auth-store';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ============================================================
// Types
// ============================================================

interface ThreadSummary {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

interface ChatMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  duration?: number;
  toolsCalled?: string[];
  toolResults?: ToolResult[];
}

interface ToolResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// ============================================================
// Helpers
// ============================================================

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

function formatTimestamp(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// Thread List Item
// ============================================================

function ThreadItem({
  thread,
  isActive,
  onClick,
  onDelete,
}: {
  thread: ThreadSummary;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${
        isActive
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800'
          : 'hover:bg-muted/50 border border-transparent'
      }`}
      onClick={onClick}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg mt-0.5 ${
          isActive
            ? 'bg-emerald-600 text-white'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        <MessageSquare className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium leading-tight truncate ${
            isActive ? 'text-emerald-900 dark:text-emerald-100' : ''
          }`}
        >
          {thread.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[11px] text-muted-foreground">
            {thread._count.messages} msg{thread._count.messages !== 1 ? 's' : ''}
          </span>
          <span className="text-[11px] text-muted-foreground/50">·</span>
          <span className="text-[11px] text-muted-foreground">
            {formatTimeAgo(thread.updatedAt)}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ============================================================
// Typing Indicator
// ============================================================

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-start gap-3 max-w-3xl"
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-emerald-600 text-white text-xs">
          <Bot className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" />
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================
// Tool Results Collapsible
// ============================================================

function ToolResultsSection({ results }: { results: ToolResult[] }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!results || results.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-1.5 mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Wrench className="h-3 w-3" />
          <span>{results.length} tool{results.length !== 1 ? 's' : ''} called</span>
          {isOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1.5">
        {results.map((result, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-[11px] ${
              result.success
                ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20'
                : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20'
            }`}
          >
            {result.success ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            )}
            <div className="min-w-0">
              <span className="font-medium">{result.toolName}</span>
              {result.error && (
                <p className="text-rose-600 dark:text-rose-400 mt-0.5 break-all">
                  {result.error}
                </p>
              )}
              {result.data && typeof result.data === 'object' && (
                <pre className="mt-1 text-[10px] text-muted-foreground overflow-x-auto max-w-full whitespace-pre-wrap break-all">
                  {JSON.stringify(result.data, null, 1)}
                </pre>
              )}
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================
// Message Bubble
// ============================================================

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''} max-w-3xl`}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 shrink-0">
        {isUser ? (
          <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
            U
          </AvatarFallback>
        ) : (
          <AvatarFallback className="bg-emerald-600 text-white text-xs">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        )}
      </Avatar>

      {/* Content */}
      <div
        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} min-w-0 max-w-[85%]`}
      >
        {/* Role badge + timestamp */}
        <div
          className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : ''}`}
        >
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-4 ${
              isUser
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {isUser ? 'You' : 'AI Assistant'}
          </Badge>
          {message.createdAt && (
            <span className="text-[11px] text-muted-foreground/70">
              {formatTimestamp(message.createdAt)}
            </span>
          )}
          {message.duration != null && (
            <span className="text-[11px] text-muted-foreground/50 flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {(message.duration / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words ${
            isUser
              ? 'bg-emerald-600 text-white rounded-tr-sm'
              : 'bg-muted rounded-tl-sm'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-pre:bg-background prose-pre:border prose-pre:rounded-md prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-blockquote:my-1 prose-a:text-emerald-600 dark:prose-a:text-emerald-400">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Tool results for assistant messages */}
        {!isUser && message.toolResults && message.toolResults.length > 0 && (
          <ToolResultsSection results={message.toolResults} />
        )}
      </div>
    </motion.div>
  );
}

// ============================================================
// Empty State
// ============================================================

function EmptyState({
  hasThreads,
  onCreateNew,
  onSelectThread,
  latestThread,
}: {
  hasThreads: boolean;
  onCreateNew: () => void;
  onSelectThread?: () => void;
  latestThread?: ThreadSummary | null;
}) {
  if (!hasThreads) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 mb-4">
          <Sparkles className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">AI Assistant</h2>
        <p className="text-sm text-muted-foreground max-w-md mb-6">
          Your intelligent business assistant is ready to help. Ask questions,
          analyze data, run tools, and get insights across all your connected
          plugins.
        </p>
        <Button onClick={onCreateNew} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          Start a Conversation
        </Button>
      </div>
    );
  }

  // Has threads but none selected — prompt to select
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Select a conversation</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-4">
        {latestThread
          ? `Your latest chat: "${latestThread.title}"`
          : 'Choose a thread from the sidebar to continue.'}
      </p>
      {latestThread && onSelectThread && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSelectThread}>
            Continue Latest
          </Button>
          <Button onClick={onCreateNew} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="h-4 w-4 mr-2" />
            New Chat
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Chat View
// ============================================================

export default function ChatView() {
  const { user } = useAuthStore();

  // Thread state
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Input
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Delete confirmation
  const [threadToDelete, setThreadToDelete] = useState<ThreadSummary | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userId = user?.id || '';
  const tenantId = user?.tenantId || '';

  // ── Fetch threads on mount ──
  useEffect(() => {
    if (!userId || !tenantId) return;
    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(
          `/api/chat?userId=${encodeURIComponent(userId)}&tenantId=${encodeURIComponent(tenantId)}`,
          { signal: controller.signal }
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setThreads(data.threads || []);
        }
      } catch {
        // ignore abort / network errors
      } finally {
        if (!cancelled) setThreadsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [userId, tenantId]);

  // ── Manual refetch (used after creating a new thread) ──
  const refetchThreads = useCallback(async () => {
    if (!userId || !tenantId) return;
    try {
      const res = await fetch(
        `/api/chat?userId=${encodeURIComponent(userId)}&tenantId=${encodeURIComponent(tenantId)}`
      );
      if (res.ok) {
        const data = await res.json();
        setThreads(data.threads || []);
      }
    } catch {
      // ignore
    }
  }, [userId, tenantId]);

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  // ── Filtered threads ──
  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeThread = threads.find((t) => t.id === activeThreadId) || null;
  const latestThread = threads.length > 0 ? threads[0] : null;

  // ── Select a thread (load messages) ──
  const selectThread = useCallback(
    async (threadId: string) => {
      setActiveThreadId(threadId);
      setMessages([]);
      setMessagesLoading(true);

      try {
        // We need to get messages for this thread. The API doesn't have a dedicated
        // messages endpoint, so we reconstruct from thread info.
        // The POST response returns messages, so we'll track them as we send.
        // For now, show the thread as empty — messages will populate via conversation.
        setMessagesLoading(false);
      } catch {
        setMessagesLoading(false);
      }
    },
    []
  );

  // ── Create new chat ──
  const handleNewChat = useCallback(() => {
    setActiveThreadId(null);
    setMessages([]);
    setInputValue('');
  }, []);

  // ── Delete thread ──
  const handleDeleteThread = useCallback(
    async (thread: ThreadSummary) => {
      try {
        const params = new URLSearchParams({
          threadId: thread.id,
          userId,
          tenantId,
        });
        const res = await fetch(`/api/chat?${params.toString()}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setThreads((prev) => prev.filter((t) => t.id !== thread.id));
          if (activeThreadId === thread.id) {
            setActiveThreadId(null);
            setMessages([]);
          }
          setThreadToDelete(null);
        }
      } catch {
        // ignore
      }
    },
    [userId, tenantId, activeThreadId]
  );

  // ── Send message ──
  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending || !userId || !tenantId) return;

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      threadId: activeThreadId || '',
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      const body: {
        tenantId: string;
        userId: string;
        message: string;
        threadId?: string;
      } = {
        tenantId,
        userId,
        message: trimmed,
      };

      if (activeThreadId) {
        body.threadId = activeThreadId;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();

        const assistantMessage: ChatMessage = {
          id: data.id,
          threadId: data.threadId,
          role: 'assistant',
          content: data.content,
          createdAt: data.createdAt,
          duration: data.duration,
          toolsCalled: data.toolsCalled,
          toolResults: data.toolResults,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // If this was a new thread, update the thread ID and list
        if (!activeThreadId && data.threadId) {
          setActiveThreadId(data.threadId);
          await refetchThreads();
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        const errorMsg =
          (errData as { error?: string }).error || 'Failed to send message';
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            threadId: activeThreadId || '',
            role: 'assistant',
            content: `⚠️ ${errorMsg}. Please try again.`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          threadId: activeThreadId || '',
          role: 'assistant',
          content:
            '⚠️ Network error. Please check your connection and try again.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, isSending, userId, tenantId, activeThreadId, refetchThreads]);

  // ── Handle keyboard submit ──
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="flex h-full">
      {/* ────────────────────────────────────────────────────
          LEFT PANEL — Thread List
      ──────────────────────────────────────────────────── */}
      <div className="w-72 border-r bg-card flex flex-col shrink-0 max-lg:hidden">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Conversations</h2>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleNewChat}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search threads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Thread list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {threadsLoading ? (
              <div className="space-y-3 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchQuery ? 'No matching threads.' : 'No conversations yet.'}
              </div>
            ) : (
              filteredThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === activeThreadId}
                  onClick={() => selectThread(thread.id)}
                  onDelete={() => setThreadToDelete(thread)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ────────────────────────────────────────────────────
          RIGHT PANEL — Chat Area
      ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-2 px-4 py-2 border-b">
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={handleNewChat}
          >
            <Plus className="h-4 w-4 mr-1" />
            New
          </Button>
          {activeThread && (
            <span className="text-sm font-medium truncate flex-1">
              {activeThread.title}
            </span>
          )}
          {activeThread && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setThreadToDelete(activeThread)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Messages area or empty state */}
        {activeThreadId || messages.length > 0 ? (
          <>
            {/* Thread title bar (desktop) */}
            {activeThread && (
              <div className="hidden lg:flex items-center gap-2 px-6 py-3 border-b">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <MessageSquare className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {activeThread.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {activeThread._count.messages} messages · Updated{' '}
                    {formatTimeAgo(activeThread.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setThreadToDelete(activeThread)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1">
              <div className="flex flex-col gap-4 p-4 md:p-6 pb-4">
                <AnimatePresence mode="popLayout">
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                </AnimatePresence>
                {isSending && <TypingIndicator />}
                {messagesLoading && (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 ${i % 2 === 1 ? 'flex-row-reverse' : ''}`}
                      >
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <Skeleton
                          className={`h-16 rounded-2xl ${i % 2 === 1 ? 'w-3/5' : 'w-4/5'}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className="border-t bg-card p-4">
              <div className="max-w-3xl mx-auto flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask me anything..."
                    disabled={isSending}
                    rows={1}
                    className="flex w-full rounded-xl border border-input bg-background px-4 py-3 pr-12 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 resize-none min-h-[44px] max-h-[200px] overflow-y-auto"
                    style={{
                      height: 'auto',
                    }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="absolute right-1.5 bottom-1.5 h-8 w-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:bg-emerald-600"
                    disabled={!inputValue.trim() || isSending}
                    onClick={handleSend}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-2 max-w-3xl mx-auto">
                AI Assistant can make mistakes. Verify important information.
              </p>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              hasThreads={threads.length > 0}
              onCreateNew={handleNewChat}
              onSelectThread={
                latestThread
                  ? () => selectThread(latestThread.id)
                  : undefined
              }
              latestThread={latestThread}
            />
          </div>
        )}
      </div>

      {/* ────────────────────────────────────────────────────
          Delete Thread Confirmation Dialog
      ──────────────────────────────────────────────────── */}
      <AlertDialog
        open={!!threadToDelete}
        onOpenChange={(open) => {
          if (!open) setThreadToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{threadToDelete?.title}
              &rdquo;? This will permanently remove the conversation and all its
              messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (threadToDelete) handleDeleteThread(threadToDelete);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
