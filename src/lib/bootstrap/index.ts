// ============================================================
// AENEWS Enterprise OS — Platform Bootstrap (Discovery-First)
// ============================================================
// Initializes all core registries by delegating to the
// Discovery Engine, which scans the filesystem for plugin
// manifests and populates ALL registries from metadata.
//
// No hardcoded plugin registration code — the Discovery Engine
// reads plugin.json manifests and auto-populates:
//   Capability, Tool, UI, Search, Schema, Workflow,
//   Agent, Knowledge, and all other registries.
//
// Strict separation:
//   Discovery ≠ Activation
//   Bootstrap runs Discovery only (metadata).
//   Runtime activation is a separate concern.
// ============================================================

import { getDiscoveryEngine } from '@/core/discovery-engine';
import type { DiscoveryStats } from '@/core/discovery-engine';
import { eventBus } from '@/lib/event-bus';

// ============================================================
// Bootstrap State
// ============================================================

let _bootstrapped = false;

export function isBootstrapped(): boolean {
  return _bootstrapped;
}

// ============================================================
// Main Bootstrap Function
// ============================================================

export async function bootstrapPlatform(): Promise<void> {
  if (_bootstrapped) return;

  console.log('[Bootstrap] Initializing AENEWS Enterprise OS (Discovery-First)...');

  // ── Run Discovery Pipeline ──
  const engine = getDiscoveryEngine();
  const result = await engine.discover();

  // ── Log Discovery Stats ──
  const stats: DiscoveryStats = engine.getStats();
  console.log('[Bootstrap] Discovery complete — stats:');
  console.log(`[Bootstrap]   Plugins discovered:  ${stats.totalPlugins}`);
  console.log(`[Bootstrap]   Capabilities:        ${stats.totalCapabilities}`);
  console.log(`[Bootstrap]   Tools:                ${stats.totalTools}`);
  console.log(`[Bootstrap]   Sidebar items:       ${stats.totalSidebarItems}`);
  console.log(`[Bootstrap]   Dashboard cards:      ${stats.totalDashboardCards}`);
  console.log(`[Bootstrap]   Widgets:              ${stats.totalWidgets}`);
  console.log(`[Bootstrap]   Search entities:      ${stats.totalSearchEntities}`);
  console.log(`[Bootstrap]   Schema objects:       ${stats.totalSchemaObjects}`);
  console.log(`[Bootstrap]   Permissions:          ${stats.totalPermissions}`);
  console.log(`[Bootstrap]   Events:               ${stats.totalEvents}`);
  console.log(`[Bootstrap]   Agents:               ${stats.totalAgents}`);
  console.log(`[Bootstrap]   Knowledge entries:    ${stats.totalKnowledgeEntries}`);
  console.log(`[Bootstrap]   Menus:                ${stats.totalMenus}`);
  console.log(`[Bootstrap]   Discovery duration:   ${stats.discoveryDurationMs}ms`);
  console.log(`[Bootstrap]   Dependency cycles:    ${stats.dependencyGraph.cycles.length}`);

  if (result.errors.length > 0) {
    console.warn(`[Bootstrap] ${result.errors.length} discovery error(s):`);
    for (const err of result.errors.slice(0, 10)) {
      console.warn(`[Bootstrap]   - ${err}`);
    }
  }

  // ── Emit bootstrap complete event ────────────────────────

  await eventBus.emit('platform.bootstrapped', {
    engines: {
      discoveryEngine: true,
      capabilityRegistry: true,
      toolRegistry: true,
      uiRegistry: true,
      searchEngine: true,
      schemaRegistry: true,
      workflowEngine: true,
      agentRegistry: true,
      knowledgeRegistry: true,
      eventBus: true,
      eventStore: true,
      pluginEngine: true,
      pluginRuntime: true,
      builderEngine: true,
      aiGateway: true,
      settingsEngine: true,
      permissionEngine: true,
    },
    discovery: {
      pluginsScanned: result.pluginsScanned,
      pluginsValid: result.pluginsValid,
      pluginsInvalid: result.pluginsInvalid,
      durationMs: result.durationMs,
      status: result.status,
    },
    stats: {
      totalPlugins: stats.totalPlugins,
      totalCapabilities: stats.totalCapabilities,
      totalTools: stats.totalTools,
      totalAgents: stats.totalAgents,
      totalKnowledgeEntries: stats.totalKnowledgeEntries,
    },
  });

  _bootstrapped = true;
  console.log('[Bootstrap] Platform initialized successfully via Discovery Engine.');
}
