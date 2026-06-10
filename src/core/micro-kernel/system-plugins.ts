/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * System Plugin Definitions
 *
 * Every engine that was previously in /src/core/ is now a System Plugin.
 * These descriptors are used by the Kernel to register system plugins
 * without loading any code — pure metadata.
 */

import type { PluginManifest } from './types';

// ─── System Plugin: AI Meta Orchestrator ───────────────────────────
export const AI_ORCHESTRATOR_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-ai-orchestrator',
  slug: 'ai-orchestrator',
  name: 'AI Meta Orchestrator',
  description: 'Cognitive router for intent→capability mapping. Plans plugin/tool/agent selection using Jaccard relevance scoring.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  provides: ['ai'],
  capabilities: [
    { id: 'ai.chat', type: 'custom', description: 'Natural language conversation' },
    { id: 'ai.analyze', type: 'analyze', description: 'AI-powered data analysis' },
    { id: 'ai.generate', type: 'create', description: 'AI content generation' },
  ],
  tools: [
    { id: 'ai.chat', name: 'AI Chat', description: 'Conversational AI interface', rateLimit: 60 },
    { id: 'ai.analyze', name: 'AI Analyze', description: 'Analyze data with AI', rateLimit: 30 },
  ],
  agents: [
    { id: 'ai.assistant', name: 'AI Assistant', description: 'General-purpose AI assistant', capabilities: ['ai.chat', 'ai.analyze'] },
  ],
  permissions: ['ai.*'],
  settings: [
    { id: 'default_provider', label: 'Default Provider', type: 'select', default: 'z-ai', options: [{ label: 'Z.AI', value: 'z-ai' }, { label: 'OpenAI', value: 'openai' }] },
    { id: 'max_tokens', label: 'Max Tokens', type: 'number', default: 4096 },
  ],
  menus: [
    { id: 'ai-chat', label: 'AI Assistant', icon: 'Brain', path: '/ai', section: 'core', order: 2 },
  ],
  icon: 'Brain',
  color: '#8b5cf6',
};

// ─── System Plugin: Search Engine ──────────────────────────────────
export const SEARCH_ENGINE_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-search-engine',
  slug: 'search-engine',
  name: 'Search Engine',
  description: 'Cross-plugin full-text search with relevance scoring, parallel entity dispatch, and faceted results.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  provides: ['search'],
  capabilities: [
    { id: 'search.global', type: 'search', description: 'Global cross-plugin search' },
  ],
  tools: [
    { id: 'search.query', name: 'Search', description: 'Full-text search across all plugins', rateLimit: 100, cacheTTL: 30 },
  ],
  permissions: ['search.*'],
  icon: 'Search',
  color: '#06b6d4',
};

// ─── System Plugin: Workflow Engine ──────────────────────────────
export const WORKFLOW_ENGINE_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-workflow-engine',
  slug: 'workflow-engine',
  name: 'Workflow Engine',
  description: 'Trigger-condition-action pipeline with event/schedule/webhook/manual/data_change triggers and sequential action execution.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  provides: ['workflow'],
  capabilities: [
    { id: 'workflow.create', type: 'create', description: 'Create workflows' },
    { id: 'workflow.execute', type: 'custom', description: 'Execute workflow actions' },
  ],
  tools: [
    { id: 'workflow.execute', name: 'Execute Workflow', description: 'Trigger a workflow manually', rateLimit: 30 },
  ],
  permissions: ['workflow.*'],
  menus: [
    { id: 'workflows', label: 'Workflows', icon: 'GitBranch', path: '/workflows', section: 'automation', order: 1 },
  ],
  icon: 'GitBranch',
  color: '#f59e0b',
};

// ─── System Plugin: Observability Engine ──────────────────────────
export const OBSERVABILITY_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-observability',
  slug: 'observability',
  name: 'Observability Engine',
  description: 'Per-plugin metrics, circular-buffer logs, distributed tracing, health checks, profiling, and alerts.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  provides: ['metrics'],
  capabilities: [
    { id: 'observability.metrics', type: 'read', description: 'Plugin metrics' },
    { id: 'observability.health', type: 'read', description: 'Health checks' },
    { id: 'observability.tracing', type: 'read', description: 'Distributed tracing' },
  ],
  permissions: ['observability.*'],
  icon: 'Activity',
  color: '#10b981',
};

// ─── System Plugin: Builder Engine ───────────────────────────────
export const BUILDER_ENGINE_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-builder',
  slug: 'builder',
  name: 'Builder Engine',
  description: 'Low-code/no-code form and page builder with drag-and-drop component composition.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  provides: [],
  capabilities: [
    { id: 'builder.create', type: 'create', description: 'Create builder components' },
    { id: 'builder.manage', type: 'update', description: 'Manage builder layouts' },
  ],
  permissions: ['builder.*'],
  menus: [
    { id: 'builder', label: 'Builder', icon: 'Hammer', path: '/builder', section: 'tools', order: 3 },
  ],
  icon: 'Hammer',
  color: '#ec4899',
};

// ─── System Plugin: Self-Healing Engine ───────────────────────────
export const SELF_HEALING_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-self-healing',
  slug: 'self-healing',
  name: 'Self-Healing Engine',
  description: 'Health Check → Detect → Diagnose → Repair → Restart → Rollback → Notify. Zero human intervention.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  capabilities: [
    { id: 'healing.check', type: 'read', description: 'Health check' },
    { id: 'healing.repair', type: 'update', description: 'Auto-repair' },
  ],
  permissions: ['healing.*'],
  icon: 'HeartPulse',
  color: '#ef4444',
};

// ─── System Plugin: Self-Optimization ─────────────────────────────
export const SELF_OPTIMIZATION_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-self-optimization',
  slug: 'self-optimization',
  name: 'Self-Optimization',
  description: 'Monitor usage/latency/CPU/RAM → auto cache/partition/index/optimization/preload/compression/lazy loading.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  capabilities: [
    { id: 'optimization.monitor', type: 'read', description: 'Performance monitoring' },
    { id: 'optimization.optimize', type: 'update', description: 'Auto-optimization' },
  ],
  permissions: ['optimization.*'],
  icon: 'Zap',
  color: '#f97316',
};

// ─── System Plugin: Knowledge Engine ──────────────────────────────
export const KNOWLEDGE_ENGINE_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-knowledge',
  slug: 'knowledge-engine',
  name: 'Knowledge Engine',
  description: 'Document management, FAQs, policies, procedures, and training knowledge bases per plugin.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  capabilities: [
    { id: 'knowledge.read', type: 'read', description: 'Read knowledge bases' },
    { id: 'knowledge.manage', type: 'update', description: 'Manage knowledge' },
  ],
  knowledge: [
    { id: 'system-kb', name: 'System Knowledge', description: 'Core system documentation', type: 'documents' },
  ],
  permissions: ['knowledge.*'],
  icon: 'BookOpen',
  color: '#0ea5e9',
};

// ─── System Plugin: Agent Engine ──────────────────────────────────
export const AGENT_ENGINE_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-agent-engine',
  slug: 'agent-engine',
  name: 'Agent Engine',
  description: 'Plugin-scoped AI agents with capabilities, tools, and knowledge binding.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  capabilities: [
    { id: 'agent.create', type: 'create', description: 'Create agents' },
    { id: 'agent.execute', type: 'custom', description: 'Execute agent tasks' },
  ],
  agents: [
    { id: 'agent.default', name: 'Default Agent', description: 'General-purpose autonomous agent' },
  ],
  permissions: ['agent.*'],
  icon: 'Bot',
  color: '#8b5cf6',
};

// ─── System Plugin: Plugin Generator ──────────────────────────────
export const PLUGIN_GENERATOR_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-plugin-generator',
  slug: 'plugin-generator',
  name: 'Plugin Generator',
  description: 'AI-driven full plugin generation from natural language → complete plugin package with schema, objects, fields, relations, permissions, menus, pages, forms, dashboard, workflow, reports, knowledge, agent, manifest.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  capabilities: [
    { id: 'generator.generate', type: 'create', description: 'Generate plugins from description' },
  ],
  tools: [
    { id: 'generator.from-description', name: 'Generate Plugin', description: 'Generate a complete plugin from natural language', rateLimit: 5 },
  ],
  permissions: ['generator.*'],
  icon: 'Wand2',
  color: '#a855f7',
};

// ─── System Plugin: Digital Twin ──────────────────────────────────
export const DIGITAL_TWIN_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-digital-twin',
  slug: 'digital-twin',
  name: 'Digital Twin',
  description: 'Simulates install/uninstall/upgrade/load/failure/conflict scenarios before applying to live system.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  capabilities: [
    { id: 'twin.simulate', type: 'analyze', description: 'Simulate operations' },
    { id: 'twin.predict', type: 'analyze', description: 'Predict impact' },
  ],
  tools: [
    { id: 'twin.simulate', name: 'Simulate', description: 'Simulate a plugin operation', rateLimit: 10 },
  ],
  permissions: ['twin.*'],
  icon: 'Copy',
  color: '#14b8a6',
};

// ─── System Plugin: Marketplace ───────────────────────────────────
export const MARKETPLACE_MANIFEST: PluginManifest = {
  aenews: '1',
  id: 'system-marketplace',
  slug: 'marketplace',
  name: 'Marketplace',
  description: 'Plugin marketplace with publish/install/update/review/rating/signature/license/revenue share/billing/telemetry/auto-update.',
  version: '1.0.0',
  category: 'system',
  author: 'AENEWS Core',
  license: 'enterprise',
  provides: ['billing'],
  capabilities: [
    { id: 'marketplace.browse', type: 'read', description: 'Browse plugins' },
    { id: 'marketplace.install', type: 'create', description: 'Install plugins' },
  ],
  menus: [
    { id: 'marketplace', label: 'App Store', icon: 'Store', path: '/app-store', section: 'core', order: 4 },
  ],
  permissions: ['marketplace.*'],
  icon: 'Store',
  color: '#6366f1',
};

// ─── All System Plugins ──────────────────────────────────────────

export const ALL_SYSTEM_PLUGINS: PluginManifest[] = [
  AI_ORCHESTRATOR_MANIFEST,
  SEARCH_ENGINE_MANIFEST,
  WORKFLOW_ENGINE_MANIFEST,
  OBSERVABILITY_MANIFEST,
  BUILDER_ENGINE_MANIFEST,
  SELF_HEALING_MANIFEST,
  SELF_OPTIMIZATION_MANIFEST,
  KNOWLEDGE_ENGINE_MANIFEST,
  AGENT_ENGINE_MANIFEST,
  PLUGIN_GENERATOR_MANIFEST,
  DIGITAL_TWIN_MANIFEST,
  MARKETPLACE_MANIFEST,
];

export const SYSTEM_PLUGIN_COUNT = ALL_SYSTEM_PLUGINS.length;
