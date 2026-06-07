// ============================================================
// API: Architecture Overview — Returns status of all engines
// ============================================================

import { NextResponse } from 'next/server';
import { bootstrapPlatform } from '@/lib/bootstrap';
import { getToolRegistry } from '@/core/tool-registry';
import { getCapabilityRegistry } from '@/core/capability-registry';
import { getUIRegistry } from '@/core/ui-registry';
import { getAgentRegistry } from '@/core/agent-registry';
import { getKnowledgeRegistry } from '@/core/knowledge-registry';
import { getSchemaRegistry } from '@/core/schema-registry';
import { getWorkflowEngine } from '@/core/workflow-engine';
import { getBuilderEngine } from '@/core/builder-engine';

export async function GET() {
  await bootstrapPlatform();

  const toolStats = getToolRegistry().getStats();
  const capStats = getCapabilityRegistry().getStats();
  const uiStats = getUIRegistry().getStats();
  const agentStats = getAgentRegistry().getStats();
  const knowledgeStats = getKnowledgeRegistry().getStats();
  const schemaStats = getSchemaRegistry().getStats();

  const workflowEngine = getWorkflowEngine();
  const workflowStats = await workflowEngine.getStats();
  const builderEngine = getBuilderEngine();
  const builderStats = await builderEngine.getStats();

  const engines = [
    { id: 'plugin-sdk', name: 'Plugin SDK', version: '1.0.0', status: 'active', description: 'Manifest types, validation, definePlugin()', category: 'core', icon: 'Package' },
    { id: 'plugin-loader', name: 'Plugin Loader', version: '1.0.0', status: 'active', description: 'Scan, validate, resolve, load, install, activate pipeline', category: 'core', icon: 'Download' },
    { id: 'plugin-runtime', name: 'Plugin Runtime', version: '1.0.0', status: 'active', description: 'Start, Context, Container, Execute, Dispose, Reload', category: 'core', icon: 'Play' },
    { id: 'plugin-registry', name: 'Plugin Registry', version: '1.0.0', status: 'active', description: 'Central registry for all installed plugins', category: 'core', icon: 'Database' },
    { id: 'tool-registry', name: 'Tool Registry', version: '1.0.0', status: 'active', description: `AI-callable tools with rate limiting, caching, audit (${toolStats.size} tools)`, category: 'ai', icon: 'Wrench', stats: toolStats },
    { id: 'capability-registry', name: 'Capability Registry', version: '1.0.0', status: 'active', description: `Plugin capabilities for AI discovery (${capStats.total} capabilities)`, category: 'ai', icon: 'Zap', stats: capStats },
    { id: 'ai-gateway', name: 'AI Gateway', version: '1.0.0', status: 'active', description: 'Multi-provider AI (z-ai, OpenAI, Claude, Gemini, DeepSeek, Qwen, Mistral, Ollama, Azure, Bedrock)', category: 'ai', icon: 'Brain' },
    { id: 'agent-registry', name: 'Agent Registry', version: '1.0.0', status: 'active', description: `AI agents registered by plugins (${agentStats.total} agents, ${agentStats.active} active)`, category: 'ai', icon: 'Bot', stats: agentStats },
    { id: 'knowledge-registry', name: 'Knowledge Registry', version: '1.0.0', status: 'active', description: `Plugin knowledge bases for AI reasoning (${knowledgeStats.total} entries)`, category: 'ai', icon: 'BookOpen', stats: knowledgeStats },
    { id: 'mcp-gateway', name: 'MCP Gateway', version: '1.0.0', status: 'active', description: 'Model Context Protocol gateway for external tool integration', category: 'ai', icon: 'Network' },
    { id: 'ui-registry', name: 'UI Registry', version: '1.0.0', status: 'active', description: `Dynamic UI extensions (${uiStats.sidebarItems} sidebar, ${uiStats.pages} pages, ${uiStats.dashboardCards} cards)`, category: 'ui', icon: 'Layout', stats: uiStats },
    { id: 'builder-engine', name: 'Builder Engine', version: '1.0.0', status: 'active', description: `Drag-and-drop component builder (${builderStats.totalComponents} components)`, category: 'builder', icon: 'Hammer', stats: builderStats },
    { id: 'schema-registry', name: 'Schema Registry', version: '1.0.0', status: 'active', description: `Dynamic schema → DB/API/UI generation (${schemaStats.totalObjects} objects, ${schemaStats.totalFields} fields)`, category: 'data', icon: 'FileCode', stats: schemaStats },
    { id: 'event-bus', name: 'Event Bus', version: '1.0.0', status: 'active', description: 'In-memory pub/sub for cross-plugin communication (transport only)', category: 'infrastructure', icon: 'Radio' },
    { id: 'event-store', name: 'Event Store', version: '1.0.0', status: 'active', description: 'Persistent event storage for replay and audit (separate from bus)', category: 'infrastructure', icon: 'HardDrive' },
    { id: 'workflow-engine', name: 'Workflow Engine', version: '1.0.0', status: 'active', description: `Automation via Triggers → Conditions → Actions (${workflowStats.totalWorkflows} workflows)`, category: 'automation', icon: 'Workflow', stats: workflowStats },
    { id: 'search-engine', name: 'Search Engine', version: '1.0.0', status: 'active', description: 'Plugin-driven global search', category: 'data', icon: 'Search' },
    { id: 'settings-engine', name: 'Settings Engine', version: '1.0.0', status: 'active', description: 'Tenant-scoped plugin settings management', category: 'data', icon: 'Settings' },
    { id: 'storage-engine', name: 'Storage Engine', version: '1.0.0', status: 'active', description: 'Plugin-scoped file/blob storage', category: 'data', icon: 'FolderArchive' },
    { id: 'auth', name: 'Auth', version: '1.0.0', status: 'active', description: 'Authentication and session management', category: 'security', icon: 'Shield' },
    { id: 'tenant', name: 'Tenant', version: '1.0.0', status: 'active', description: 'Multi-tenant workspace management', category: 'security', icon: 'Building' },
    { id: 'rbac', name: 'RBAC', version: '1.0.0', status: 'active', description: 'Role-based access control with granular permissions', category: 'security', icon: 'Lock' },
    { id: 'cli', name: 'Plugin CLI', version: '1.0.0', status: 'active', description: 'npx create-aenews-plugin scaffolding tool', category: 'dev-tools', icon: 'Terminal' },
  ];

  // Add plugin-specific data
  const plugins = [
    {
      id: 'aenews-crm-contacts',
      name: 'CRM Contacts',
      slug: 'crm-contacts',
      version: '1.0.0',
      description: 'Full-featured contact management — the proof-of-concept plugin',
      status: 'active',
      tools: 3,
      capabilities: 6,
      agents: 1,
      knowledge: 3,
      schemas: 1,
      uiExtensions: 11,
    },
  ];

  return NextResponse.json({
    platform: {
      name: 'AENEWS Enterprise OS',
      version: '0.1.0',
      tagline: 'Plugin-First Business Operating System',
      bootstrapped: true,
    },
    engines,
    plugins,
    totalEngines: engines.length,
  });
}
