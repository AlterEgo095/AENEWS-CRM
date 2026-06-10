// ============================================================
// AENEWS Enterprise OS — PHASE OMEGA API
// Unified API endpoint for the Meta-Kernel & Cognitive Platform.
// Returns data from all 15 PHASE OMEGA engines.
// ============================================================

import { NextResponse } from 'next/server';
import { getMetaRegistry } from '@/core/meta-registry';
import { getDiscoveryEngine } from '@/core/discovery-engine';
import { getDependencyEngine } from '@/core/dependency-engine';
import { getObservabilityEngine } from '@/core/observability';
import { getHotPluginManager } from '@/core/hot-plugin';
import { getLiveRegistry } from '@/core/live-registry';
import { getMetaOrchestrator } from '@/core/meta-orchestrator';
import { getPluginGenerator } from '@/core/plugin-generator';
import { getSelfHealingEngine } from '@/core/self-healing';
import { getSelfOptimizationEngine } from '@/core/self-optimization';
import { getMarketplaceEngine } from '@/core/marketplace';
import { getDigitalTwinEngine } from '@/core/digital-twin';
import { getPluginPackageManager } from '@/core/plugin-package';
import { getToolRegistry } from '@/core/tool-registry';
import { getCapabilityRegistry } from '@/core/capability-registry';
import { getUIRegistry } from '@/core/ui-registry';
import { getSchemaRegistry } from '@/core/schema-registry';
import { getAgentRegistry } from '@/core/agent-registry';
import { getKnowledgeRegistry } from '@/core/knowledge-registry';
import { getSearchEngine } from '@/core/search-engine';
import { getWorkflowEngine } from '@/core/workflow-engine';
import { isBootstrapped, bootstrapPlatform } from '@/lib/bootstrap';

export async function GET() {
  try {
    // Ensure bootstrap
    if (!isBootstrapped()) {
      await bootstrapPlatform();
    }

    // 1. Meta Registry
    const metaReg = getMetaRegistry();
    const metaStats = metaReg.getStats();
    const metaSnapshot = metaReg.snapshot();

    // 2. Discovery Engine
    const discoveryEngine = getDiscoveryEngine();
    const discoveryStats = discoveryEngine.getStats();
    const discoveryResult = discoveryEngine.getLastResult();

    // 3. Dependency Engine
    const depEngine = getDependencyEngine();
    const depStats = depEngine.getStats();

    // 4. Observability Engine
    const obsEngine = getObservabilityEngine();
    const obsStats = obsEngine.getStats();
    const obsAlerts = obsEngine.getAlerts(undefined, undefined, 10);

    // 5. Hot Plugin Manager
    const hotManager = getHotPluginManager();
    const hotStats = hotManager.getStats();

    // 6. Live Registry
    const liveReg = getLiveRegistry();
    const liveStats = liveReg.getStats();
    const liveChanges = liveReg.getChanges(20);

    // 7. Meta Orchestrator
    const orchestrator = getMetaOrchestrator();
    const orchOverview = orchestrator.getCapabilitiesOverview();
    const orchStats = orchestrator.getStats();

    // 8. Plugin Generator
    const generator = getPluginGenerator();
    const genStats = generator.getStats();

    // 9. Self-Healing Engine
    const healing = getSelfHealingEngine();
    const healingStats = healing.getStats();
    const healingIssues = healing.getActiveIssues();

    // 10. Self-Optimization Engine
    const optimizer = getSelfOptimizationEngine();
    const optStats = optimizer.getStats();
    const optReport = optimizer.getReport();

    // 11. Marketplace Engine
    const market = getMarketplaceEngine();
    const marketStats = market.getStats();

    // 12. Digital Twin Engine
    const twin = getDigitalTwinEngine();
    const twinStats = twin.getStats();
    const twinHistory = twin.getHistory(10);

    // 13. Plugin Package Manager
    const pkgManager = getPluginPackageManager();

    // 14. Core Registries (derived from Discovery)
    const toolReg = getToolRegistry();
    const capReg = getCapabilityRegistry();
    const uiReg = getUIRegistry();
    const schemaReg = getSchemaRegistry();
    const agentReg = getAgentRegistry();
    const knowReg = getKnowledgeRegistry();
    const searchEng = getSearchEngine();
    const wfEngine = getWorkflowEngine();

    // Build full response
    const response = {
      timestamp: new Date().toISOString(),
      phase: 'OMEGA',
      title: 'PHASE OMEGA — Meta-Kernel & Cognitive Platform',

      // ── Core Engine Status ──
      engines: {
        metaRegistry: { status: 'active', stats: metaStats, totalEntities: metaStats.totalEntities },
        discoveryEngine: { status: discoveryStats.status, durationMs: discoveryStats.discoveryDurationMs, plugins: discoveryStats.totalPlugins },
        dependencyEngine: { status: 'active', stats: depStats },
        observability: { status: 'active', stats: obsStats, recentAlerts: obsAlerts },
        hotPluginManager: { status: 'active', stats: hotStats },
        liveRegistry: { status: liveReg.isWatching() ? 'watching' : 'idle', stats: liveStats },
        metaOrchestrator: { status: 'active', stats: orchStats, overview: orchOverview },
        pluginGenerator: { status: 'active', stats: genStats },
        selfHealing: { status: 'active', stats: healingStats, activeIssues: Object.fromEntries(healingIssues) },
        selfOptimization: { status: 'active', stats: optStats, report: optReport },
        marketplace: { status: 'active', stats: marketStats },
        digitalTwin: { status: 'active', stats: twinStats, recentSimulations: twinHistory },
        pluginPackageManager: { status: 'active' },
      },

      // ── Registry Derivations ──
      registries: {
        tools: { total: toolReg.size, stats: toolReg.getStats() },
        capabilities: { total: capReg.size, stats: capReg.getStats() },
        ui: uiReg.getStats(),
        schemas: { total: schemaReg.size, stats: schemaReg.getStats() },
        agents: { total: agentReg.size, stats: agentReg.getStats() },
        knowledge: { total: knowReg.size, stats: knowReg.getStats() },
        search: searchEng.getStats(),
        workflows: { total: discoveryResult?.registries.workflowEngine.triggers || 0 },
      },

      // ── Discovery Data ──
      discovery: {
        status: discoveryStats.status,
        pluginsScanned: discoveryResult?.pluginsScanned || 0,
        pluginsValid: discoveryResult?.pluginsValid || 0,
        capabilities: discoveryStats.totalCapabilities,
        tools: discoveryStats.totalTools,
        sidebarItems: discoveryStats.totalSidebarItems,
        widgets: discoveryStats.totalWidgets,
        searchEntities: discoveryStats.totalSearchEntities,
        schemaObjects: discoveryStats.totalSchemaObjects,
        agents: discoveryStats.totalAgents,
        knowledgeEntries: discoveryStats.totalKnowledgeEntries,
        menus: discoveryStats.totalMenus,
        permissions: discoveryStats.totalPermissions,
        events: discoveryStats.totalEvents,
        settings: discoveryStats.totalSettings,
        dependencyGraph: {
          nodes: discoveryStats.dependencyGraph.nodes.length,
          edges: discoveryStats.dependencyGraph.edges.length,
          cycles: discoveryStats.dependencyGraph.cycles.length,
          orphans: discoveryStats.dependencyGraph.orphanPlugins.length,
        },
      },

      // ── Meta Registry Snapshot ──
      metaSnapshot,

      // ── Live Changes ──
      liveChanges,

      // ── Phase OMEGA Summary ──
      summary: {
        totalEngines: 15,
        activeEngines: 15,
        totalMetaEntities: metaStats.totalEntities,
        totalPlugins: discoveryStats.totalPlugins,
        totalCapabilities: discoveryStats.totalCapabilities,
        totalTools: discoveryStats.totalTools,
        totalSchemas: discoveryStats.totalSchemaObjects,
        totalAgents: discoveryStats.totalAgents,
        architecture: 'META-KERNEL COGNITIVE PLATFORM',
        coreContainsBusinessLogic: false,
        pluginGeneratedCount: genStats.totalGenerated,
        healingIssuesCount: healingStats.activeIssues,
        optimizationsApplied: optStats.appliedOptimizations,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[OMEGA] API error:', error);
    return NextResponse.json({ error: 'PHASE OMEGA API failed', message, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

// POST: Generate a plugin from description
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (!isBootstrapped()) {
      await bootstrapPlatform();
    }

    switch (action) {
      case 'generate': {
        const generator = getPluginGenerator();
        const result = generator.generate(params);
        return NextResponse.json({ success: true, action: 'generate', data: result });
      }

      case 'orchestrate': {
        const orchestrator = getMetaOrchestrator();
        const plan = orchestrator.plan(params);
        return NextResponse.json({ success: true, action: 'orchestrate', data: plan });
      }

      case 'health-check': {
        const healing = getSelfHealingEngine();
        const result = await healing.checkPlugin(params.pluginId);
        return NextResponse.json({ success: true, action: 'health-check', data: result });
      }

      case 'full-scan': {
        const healing = getSelfHealingEngine();
        const results = healing.runFullScan();
        return NextResponse.json({ success: true, action: 'full-scan', data: results });
      }

      case 'simulate': {
        const twin = getDigitalTwinEngine();
        const result = twin.simulateInstall(params.pluginId, params.manifest);
        return NextResponse.json({ success: true, action: 'simulate', data: result });
      }

      case 'optimize': {
        const optimizer = getSelfOptimizationEngine();
        const results = optimizer.analyzeAll();
        return NextResponse.json({ success: true, action: 'optimize', data: results });
      }

      case 'rediscover': {
        const discoveryEngine = getDiscoveryEngine();
        const result = await discoveryEngine.rediscover();
        return NextResponse.json({ success: true, action: 'rediscover', data: result });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
