// ============================================================
// AENEWS Enterprise OS — Digital Twin Engine (PHASE OMEGA)
// Simulates installations, uninstallations, evolutions, loads,
// failures, and conflicts BEFORE applying them to the live system.
// ============================================================

// ============================================================
// Types
// ============================================================

export type SimulationType =
  | 'install'
  | 'uninstall'
  | 'update'
  | 'conflict'
  | 'load'
  | 'failure';

export type SimulationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TwinSimulation {
  id: string;
  type: SimulationType;
  inputs: Record<string, unknown>;
  results: SimulationResult | null;
  timestamp: Date;
  status: SimulationStatus;
}

export interface SimulationResult {
  success: boolean;
  impact: {
    plugins: string[];
    registries: string[];
    breaking: boolean;
  };
  warnings: string[];
  durationMs: number;
}

export interface ConflictEntry {
  pluginA: string;
  pluginB: string;
  type: string;
  description: string;
}

export interface ConflictAnalysis {
  hasConflicts: boolean;
  conflicts: ConflictEntry[];
}

export interface TwinStats {
  totalSimulations: number;
  successRate: number;
  avgDurationMs: number;
  conflictsDetected: number;
}

// ============================================================
// Known conflict registry — tracks overlapping resource claims
// ============================================================

interface PluginResourceClaim {
  pluginId: string;
  menuIds: string[];
  capabilityIds: string[];
  toolIds: string[];
  eventSubscriptions: string[];
  settingsKeys: string[];
}

// ============================================================
// DigitalTwinEngine
// ============================================================

export class DigitalTwinEngine {
  private history: TwinSimulation[] = [];
  private resourceClaims: Map<string, PluginResourceClaim> = new Map();
  private nextId = 1;

  constructor() {
    console.info('[DigitalTwinEngine] Initialized — PHASE OMEGA Simulation');
  }

  // ============================================================
  // SIMULATE INSTALL — Dry-run a plugin install
  // ============================================================

  simulateInstall(pluginId: string, manifest?: Record<string, unknown>): SimulationResult {
    const start = performance.now();
    const warnings: string[] = [];
    const affectedPlugins: string[] = [];
    const affectedRegistries: string[] = [];

    // Check if already exists
    if (this.resourceClaims.has(pluginId)) {
      return this.buildResult(false, [], affectedRegistries, true, [`${pluginId} is already loaded`], start);
    }

    // Parse manifest resources
    const claim = this.parseManifest(pluginId, manifest);
    affectedRegistries.push(...this.identifyAffectedRegistries(claim));

    // Detect conflicts with existing plugins
    for (const [existingId, existingClaim] of this.resourceClaims.entries()) {
      const conflicts = this.findConflictsBetween(claim, existingClaim, pluginId, existingId);
      for (const conflict of conflicts) {
        warnings.push(`CONFLICT: ${conflict.description}`);
        affectedPlugins.push(existingId);
      }
    }

    const breaking = warnings.some(w => w.includes('CONFLICT'));

    if (warnings.length === 0) {
      warnings.push('Simulation passed — no conflicts detected');
    }

    const result = this.buildResult(!breaking, affectedPlugins, affectedRegistries, breaking, warnings, start);

    this.recordSimulation('install', { pluginId, manifest }, result);

    return result;
  }

  // ============================================================
  // SIMULATE UNINSTALL — Dry-run a plugin uninstall
  // ============================================================

  simulateUninstall(pluginId: string): SimulationResult {
    const start = performance.now();
    const warnings: string[] = [];
    const affectedPlugins: string[] = [];
    const affectedRegistries: string[] = [];

    const claim = this.resourceClaims.get(pluginId);

    if (!claim) {
      return this.buildResult(false, [], [], false, [`${pluginId} is not currently loaded`], start);
    }

    // Identify which registries would be affected
    affectedRegistries.push(...this.identifyAffectedRegistries(claim));

    // Check if other plugins depend on capabilities/tools from this one
    for (const [otherId, otherClaim] of this.resourceClaims.entries()) {
      if (otherId === pluginId) continue;
      const deps = this.findDependencies(otherClaim, claim);
      if (deps.length > 0) {
        affectedPlugins.push(otherId);
        warnings.push(`${otherId} depends on ${deps.length} resource(s) from ${pluginId}: ${deps.join(', ')}`);
      }
    }

    const breaking = affectedPlugins.length > 0;

    if (breaking) {
      warnings.push('UNINSTALL BLOCKED: Other plugins depend on this plugin\'s resources');
    } else {
      warnings.push('Simulation passed — safe to uninstall');
    }

    const result = this.buildResult(!breaking, affectedPlugins, affectedRegistries, breaking, warnings, start);

    this.recordSimulation('uninstall', { pluginId }, result);

    return result;
  }

  // ============================================================
  // SIMULATE UPDATE — Dry-run a plugin update
  // ============================================================

  simulateUpdate(pluginId: string, newVersion: string): SimulationResult {
    const start = performance.now();
    const warnings: string[] = [];
    const affectedPlugins: string[] = [];
    const affectedRegistries: string[] = [];

    const existingClaim = this.resourceClaims.get(pluginId);

    if (!existingClaim) {
      return this.buildResult(false, [], [], false, [`${pluginId} is not currently loaded — install it first`], start);
    }

    affectedRegistries.push(...this.identifyAffectedRegistries(existingClaim));

    // An update is essentially an uninstall + install
    // Check if any other plugin depends on the current version's resources
    for (const [otherId, otherClaim] of this.resourceClaims.entries()) {
      if (otherId === pluginId) continue;
      const deps = this.findDependencies(otherClaim, existingClaim);
      if (deps.length > 0) {
        affectedPlugins.push(otherId);
        warnings.push(`${otherId} may be affected by updating ${pluginId} to v${newVersion}: depends on ${deps.join(', ')}`);
      }
    }

    warnings.push(`Update from current version to v${newVersion} would refresh all registry entries`);

    const breaking = warnings.some(w => w.includes('may be affected'));

    if (!breaking) {
      warnings.push('Simulation passed — update is safe');
    }

    const result = this.buildResult(!breaking, affectedPlugins, affectedRegistries, breaking, warnings, start);

    this.recordSimulation('update', { pluginId, newVersion }, result);

    return result;
  }

  // ============================================================
  // SIMULATE LOAD — Simulate N plugins loading simultaneously
  // ============================================================

  simulateLoad(pluginCount: number): SimulationResult {
    const start = performance.now();
    const warnings: string[] = [];
    const affectedPlugins: string[] = [];
    const affectedRegistries: string[] = ['ui-registry', 'tool-registry', 'capability-registry', 'event-bus'];

    // Estimate load based on current state
    const currentLoad = this.resourceClaims.size;
    const projectedLoad = currentLoad + pluginCount;

    // Registry stress estimation
    const registrySizes = [
      this.estimateRegistrySize('menuIds', pluginCount),
      this.estimateRegistrySize('capabilityIds', pluginCount),
      this.estimateRegistrySize('toolIds', pluginCount),
      this.estimateRegistrySize('eventSubscriptions', pluginCount),
    ];

    const totalRegistryEntries = registrySizes.reduce((a, b) => a + b, 0);

    warnings.push(`Current load: ${currentLoad} plugin(s)`);
    warnings.push(`Projected load after adding ${pluginCount}: ${projectedLoad} plugin(s)`);
    warnings.push(`Estimated registry entries: ${totalRegistryEntries}`);

    // Potential memory warnings
    if (projectedLoad > 50) {
      warnings.push('WARNING: High plugin count — registry lookup latency may increase');
    }
    if (totalRegistryEntries > 500) {
      warnings.push('WARNING: Large number of registry entries — consider lazy loading');
    }

    // Simulate loading time estimation
    const estimatedLoadTime = pluginCount * 12 + currentLoad * 0.5;

    warnings.push(`Estimated load time: ~${Math.round(estimatedLoadTime)}ms`);

    const breaking = projectedLoad > 200;

    if (breaking) {
      warnings.push('CRITICAL: Projected load exceeds safe operational limits');
    } else if (warnings.filter(w => w.includes('WARNING')).length === 0) {
      warnings.push('Simulation passed — load is within safe limits');
    }

    const result = this.buildResult(!breaking, affectedPlugins, affectedRegistries, breaking, warnings, start);

    this.recordSimulation('load', { pluginCount, currentLoad, projectedLoad }, result);

    return result;
  }

  // ============================================================
  // DETECT CONFLICTS — Find potential conflicts for a plugin
  // ============================================================

  detectConflicts(pluginId: string, allPlugins?: string[]): ConflictAnalysis {
    const claim = this.resourceClaims.get(pluginId);
    const conflicts: ConflictEntry[] = [];

    // If the plugin isn't loaded yet, check against all existing
    if (!claim) {
      // No claims to check against — create a synthetic check
      const pluginIds = allPlugins ?? Array.from(this.resourceClaims.keys());
      if (pluginIds.length === 0) {
        return { hasConflicts: false, conflicts: [] };
      }

      // Check if any existing plugin already occupies common resource names
      for (const otherId of pluginIds) {
        const otherClaim = this.resourceClaims.get(otherId);
        if (otherClaim) {
          conflicts.push({
            pluginA: pluginId,
            pluginB: otherId,
            type: 'unknown-resource-overlap',
            description: `${pluginId} has not been analyzed yet — cannot determine conflicts with ${otherId}. Run simulateInstall first.`,
          });
        }
      }

      return { hasConflicts: conflicts.length > 0, conflicts };
    }

    // Check against all other loaded plugins
    const targets = allPlugins ?? Array.from(this.resourceClaims.keys());

    for (const otherId of targets) {
      if (otherId === pluginId) continue;

      const otherClaim = this.resourceClaims.get(otherId);
      if (!otherClaim) continue;

      const pairConflicts = this.findConflictsBetween(claim, otherClaim, pluginId, otherId);
      conflicts.push(...pairConflicts);
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
    };
  }

  // ============================================================
  // SIMULATE FAILURE — Simulate a plugin failure scenario
  // ============================================================

  simulateFailure(pluginId: string, failureType: string): SimulationResult {
    const start = performance.now();
    const warnings: string[] = [];
    const affectedPlugins: string[] = [];
    const affectedRegistries: string[] = [];

    const claim = this.resourceClaims.get(pluginId);

    if (!claim) {
      return this.buildResult(false, [], [], false, [`${pluginId} is not currently loaded`], start);
    }

    affectedRegistries.push(...this.identifyAffectedRegistries(claim));

    // Analyze cascade impact based on failure type
    switch (failureType) {
      case 'crash':
        warnings.push(`CRASH: ${pluginId} would become unresponsive`);
        warnings.push(`All ${claim.menuIds.length} menu entries would become orphaned`);
        warnings.push(`All ${claim.capabilityIds.length} capabilities would return errors`);
        warnings.push(`All ${claim.toolIds.length} tools would fail to execute`);
        break;

      case 'memory-leak':
        warnings.push(`MEMORY LEAK: ${pluginId} would gradually consume more memory`);
        warnings.push(`Registry entries would remain allocated but non-functional`);
        if (claim.eventSubscriptions.length > 0) {
          warnings.push(`Event subscriptions (${claim.eventSubscriptions.length}) would queue undelivered messages`);
        }
        break;

      case 'infinite-loop':
        warnings.push(`INFINITE LOOP: ${pluginId} capabilities would hang indefinitely`);
        warnings.push(`Dependent plugins waiting on responses would time out`);
        break;

      case 'data-corruption':
        warnings.push(`DATA CORRUPTION: ${pluginId} may write invalid data to shared registries`);
        warnings.push(`Downstream consumers may receive malformed responses`);
        break;

      case 'dependency-missing':
        warnings.push(`DEPENDENCY MISSING: ${pluginId} cannot resolve required dependencies`);
        warnings.push(`All capabilities would fail with initialization errors`);
        break;

      default:
        warnings.push(`UNKNOWN FAILURE TYPE "${failureType}": Cannot fully assess impact`);
        warnings.push(`${pluginId} would be flagged as unhealthy`);
        break;
    }

    // Check cascade to dependent plugins
    for (const [otherId, otherClaim] of this.resourceClaims.entries()) {
      if (otherId === pluginId) continue;
      const deps = this.findDependencies(otherClaim, claim);
      if (deps.length > 0) {
        affectedPlugins.push(otherId);
        warnings.push(`CASCADE: ${otherId} would be affected by ${pluginId} failure (${deps.length} dependency(s))`);
      }
    }

    const breaking = affectedPlugins.length > 0 || failureType === 'data-corruption';

    const result = this.buildResult(
      false, // Failures are never "successful"
      affectedPlugins,
      affectedRegistries,
      breaking,
      warnings,
      start,
    );

    this.recordSimulation('failure', { pluginId, failureType }, result);

    return result;
  }

  // ============================================================
  // GET HISTORY — Retrieve past simulations
  // ============================================================

  getHistory(limit?: number): TwinSimulation[] {
    if (limit === undefined) return this.history.slice().reverse();
    return this.history.slice(-limit).reverse();
  }

  // ============================================================
  // GET STATS — Aggregate simulation statistics
  // ============================================================

  getStats(): TwinStats {
    const total = this.history.length;
    if (total === 0) {
      return { totalSimulations: 0, successRate: 0, avgDurationMs: 0, conflictsDetected: 0 };
    }

    const successful = this.history.filter(s => s.results?.success ?? false).length;
    const totalDuration = this.history.reduce((sum, s) => sum + (s.results?.durationMs ?? 0), 0);
    const conflicts = this.history.filter(s => {
      if (s.type === 'conflict') return true;
      return (s.results?.warnings ?? []).some(w => w.includes('CONFLICT'));
    }).length;

    return {
      totalSimulations: total,
      successRate: Math.round((successful / total) * 10000) / 100,
      avgDurationMs: Math.round(totalDuration / total * 100) / 100,
      conflictsDetected: conflicts,
    };
  }

  // ============================================================
  // CLEAR — Reset all simulation history and claims
  // ============================================================

  clear(): void {
    this.history = [];
    this.resourceClaims.clear();
    this.nextId = 1;
    console.info('[DigitalTwinEngine] Cleared — all simulations and resource claims reset');
  }

  // ============================================================
  // INTERNAL — Record a simulation to history
  // ============================================================

  private recordSimulation(type: SimulationType, inputs: Record<string, unknown>, results: SimulationResult): void {
    const simulation: TwinSimulation = {
      id: `sim_${this.nextId++}_${Date.now()}`,
      type,
      inputs,
      results,
      timestamp: new Date(),
      status: results.success ? 'completed' : 'failed',
    };
    this.history.push(simulation);
  }

  // ============================================================
  // INTERNAL — Build a standardized SimulationResult
  // ============================================================

  private buildResult(
    success: boolean,
    plugins: string[],
    registries: string[],
    breaking: boolean,
    warnings: string[],
    startTime: number,
  ): SimulationResult {
    return {
      success,
      impact: {
        plugins: [...new Set(plugins)],
        registries: [...new Set(registries)],
        breaking,
      },
      warnings,
      durationMs: Math.round((performance.now() - startTime) * 100) / 100,
    };
  }

  // ============================================================
  // INTERNAL — Parse a manifest into resource claims
  // ============================================================

  private parseManifest(pluginId: string, manifest?: Record<string, unknown>): PluginResourceClaim {
    const claim: PluginResourceClaim = {
      pluginId,
      menuIds: [],
      capabilityIds: [],
      toolIds: [],
      eventSubscriptions: [],
      settingsKeys: [],
    };

    if (!manifest) return claim;

    // Extract menus
    const menus = manifest.menus as Array<{ id?: string }> | undefined;
    if (Array.isArray(menus)) {
      for (const m of menus) {
        if (m.id) claim.menuIds.push(m.id);
      }
    }

    // Extract capabilities
    const capabilities = manifest.capabilities as Array<{ name?: string }> | undefined;
    if (Array.isArray(capabilities)) {
      for (const c of capabilities) {
        if (c.name) {
          claim.capabilityIds.push(`${pluginId}.${c.name}`);
          claim.toolIds.push(`${pluginId}:${c.name}`);
        }
      }
    }

    // Extract event subscriptions
    const events = manifest.events as Array<{ eventType?: string }> | undefined;
    if (Array.isArray(events)) {
      for (const e of events) {
        if (e.eventType) claim.eventSubscriptions.push(e.eventType);
      }
    }

    // Extract settings
    const settings = manifest.settings as Array<{ key?: string }> | undefined;
    if (Array.isArray(settings)) {
      for (const s of settings) {
        if (s.key) claim.settingsKeys.push(s.key);
      }
    }

    return claim;
  }

  // ============================================================
  // INTERNAL — Identify which registries are affected by a claim
  // ============================================================

  private identifyAffectedRegistries(claim: PluginResourceClaim): string[] {
    const registries: string[] = [];
    if (claim.menuIds.length > 0) registries.push('ui-registry');
    if (claim.capabilityIds.length > 0) registries.push('capability-registry');
    if (claim.toolIds.length > 0) registries.push('tool-registry');
    if (claim.eventSubscriptions.length > 0) registries.push('event-bus');
    if (claim.settingsKeys.length > 0) registries.push('settings-engine');
    return registries;
  }

  // ============================================================
  // INTERNAL — Find conflicts between two plugin claims
  // ============================================================

  private findConflictsBetween(
    claimA: PluginResourceClaim,
    claimB: PluginResourceClaim,
    idA: string,
    idB: string,
  ): ConflictEntry[] {
    const conflicts: ConflictEntry[] = [];

    // Menu ID conflicts
    const menuOverlap = claimA.menuIds.filter(id => claimB.menuIds.includes(id));
    for (const menuId of menuOverlap) {
      conflicts.push({
        pluginA: idA,
        pluginB: idB,
        type: 'menu-id-collision',
        description: `Both plugins register menu "${menuId}"`,
      });
    }

    // Capability ID conflicts
    const capOverlap = claimA.capabilityIds.filter(id => claimB.capabilityIds.includes(id));
    for (const capId of capOverlap) {
      conflicts.push({
        pluginA: idA,
        pluginB: idB,
        type: 'capability-id-collision',
        description: `Both plugins register capability "${capId}"`,
      });
    }

    // Tool ID conflicts
    const toolOverlap = claimA.toolIds.filter(id => claimB.toolIds.includes(id));
    for (const toolId of toolOverlap) {
      conflicts.push({
        pluginA: idA,
        pluginB: idB,
        type: 'tool-id-collision',
        description: `Both plugins register tool "${toolId}"`,
      });
    }

    // Settings key conflicts
    const settingsOverlap = claimA.settingsKeys.filter(key => claimB.settingsKeys.includes(key));
    for (const key of settingsOverlap) {
      conflicts.push({
        pluginA: idA,
        pluginB: idB,
        type: 'settings-key-collision',
        description: `Both plugins define setting "${key}"`,
      });
    }

    // Event subscription conflicts (competing handlers)
    const eventOverlap = claimA.eventSubscriptions.filter(e => claimB.eventSubscriptions.includes(e));
    for (const event of eventOverlap) {
      conflicts.push({
        pluginA: idA,
        pluginB: idB,
        type: 'event-handler-overlap',
        description: `Both plugins subscribe to event "${event}"`,
      });
    }

    return conflicts;
  }

  // ============================================================
  // INTERNAL — Find dependencies of claimA on claimB's resources
  // ============================================================

  private findDependencies(
    dependentClaim: PluginResourceClaim,
    providerClaim: PluginResourceClaim,
  ): string[] {
    const deps: string[] = [];

    // A plugin depends on another if it references the same event types
    // or uses capabilities that the other provides
    const eventOverlap = dependentClaim.eventSubscriptions.filter(e =>
      providerClaim.eventSubscriptions.includes(e),
    );
    for (const event of eventOverlap) {
      deps.push(`event:${event}`);
    }

    // Capabilities that the dependent might consume from provider
    // (heuristic: if dependent has tool IDs that reference provider's capability IDs)
    const toolRefs = dependentClaim.toolIds.filter(t =>
      providerClaim.capabilityIds.some(c => t.includes(c.split('.')[1] ?? '')),
    );
    for (const ref of toolRefs) {
      deps.push(`capability:${ref}`);
    }

    return deps;
  }

  // ============================================================
  // INTERNAL — Estimate registry size increase for N plugins
  // ============================================================

  private estimateRegistrySize(type: keyof PluginResourceClaim, pluginCount: number): number {
    const currentTotal = Array.from(this.resourceClaims.values()).reduce(
      (sum, claim) => sum + claim[type].length,
      0,
    );
    // Average 3 entries per plugin per resource type
    const estimated = currentTotal + pluginCount * 3;
    return estimated;
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: DigitalTwinEngine | undefined;

export function getDigitalTwinEngine(): DigitalTwinEngine {
  if (!_instance) _instance = new DigitalTwinEngine();
  return _instance;
}

export function resetDigitalTwinEngine(): void {
  _instance = undefined;
}