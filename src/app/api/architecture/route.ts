import { NextResponse } from 'next/server';

/**
 * GET /api/architecture
 * Returns the complete Core Engine status with all 20+ engines.
 * Each engine entry contains its name, status, description, and module path.
 */
export async function GET() {
  try {
    const engines = [
      { name: 'Plugin Loader', status: 'active', description: 'Scans, validates, and loads plugin packages from the configured plugins directory', module: '@/core/plugin-loader' },
      { name: 'Plugin Runtime', status: 'active', description: 'Isolated sandbox for executing plugin code with controlled API surface', module: '@/core/plugin-runtime' },
      { name: 'Plugin SDK', status: 'active', description: 'Development toolkit and templates for creating AENEWS plugins', module: '@/core/plugin-sdk' },
      { name: 'Tool Registry', status: 'active', description: 'Central registry where plugins register AI-callable tools with rate limiting, caching, and audit logging', module: '@/core/tool-registry' },
      { name: 'Capability Registry', status: 'active', description: 'Bridge between plugins and the AI system — registers and discovers executable capabilities', module: '@/core/capability-registry' },
      { name: 'UI Registry', status: 'active', description: 'Central registry for dynamic UI extensions: sidebar, topbar, pages, widgets, dashboard cards, actions, commands', module: '@/core/ui-registry' },
      { name: 'Event Store', status: 'active', description: 'Event sourcing backbone — persists all domain events for audit trails, replay, and workflow triggers', module: '@/core/event-store' },
      { name: 'Search Engine', status: 'active', description: 'Full-text cross-plugin search with relevance scoring, deduplication, and faceted results', module: '@/core/search-engine' },
      { name: 'Workflow Engine', status: 'active', description: 'Automation engine with Triggers → Conditions → Actions pipeline and execution tracking', module: '@/core/workflow-engine' },
      { name: 'AI Gateway', status: 'active', description: 'Multi-provider AI integration layer with adapter pattern — supports z-ai, OpenAI, Anthropic, Gemini, and more', module: '@/core/ai-gateway' },
      { name: 'Settings Engine', status: 'active', description: 'Plugin-scoped settings with tenant-level overrides, type validation, and default merging', module: '@/core/settings-engine' },
      { name: 'Builder Engine', status: 'active', description: 'Drag-and-drop component builder for forms, pages, widgets, dashboards, reports, tables, agents, and automations', module: '@/core/builder-engine' },
      { name: 'Storage Engine', status: 'active', description: 'File and blob storage abstraction with tenant isolation and pluggable backends', module: '@/core/storage-engine' },
      { name: 'Permission Engine', status: 'active', description: 'Fine-grained RBAC permission system with role hierarchy and tenant-level scoping', module: '@/core/permission' },
      { name: 'Auth Engine', status: 'active', description: 'Authentication and session management — credential verification, token issuance, and multi-tenant isolation', module: '@/core/auth' },
      { name: 'Tenant Engine', status: 'active', description: 'Multi-tenant management — provisioning, isolation, lifecycle, and resource quotas', module: '@/core/tenant' },
      { name: 'MCP Gateway', status: 'active', description: 'Model Context Protocol integration — connects AI models to external tools and data sources', module: '@/core/mcp' },
      { name: 'CLI', status: 'active', description: 'Command-line interface for plugin development, scaffolding, and system administration', module: '@/core/cli' },
      { name: 'Event Bus', status: 'active', description: 'In-process pub/sub event bus for real-time inter-engine and inter-plugin communication', module: '@/lib/event-bus' },
      { name: 'Plugin Registry', status: 'active', description: 'Plugin marketplace registry — scanning, metadata extraction, installation tracking', module: '@/lib/plugin-registry' },
    ];

    return NextResponse.json({
      engines,
      totalEngines: engines.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[GET /api/architecture] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch architecture status' },
      { status: 500 }
    );
  }
}
