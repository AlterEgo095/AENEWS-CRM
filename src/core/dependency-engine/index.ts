// =============================================================================
// AENEWS Enterprise OS — PHASE OMEGA
// Dependency Resolution Engine
// Dedicated engine for dependency graph management, cycle detection, version
// conflict resolution, and topological ordering of plugins.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A semantic version string, e.g. "1.2.3" */
export type DepVersion = string;

/** Describes a single dependency requirement from one plugin to another. */
export interface Dependency {
  /** The identifier of the required plugin. */
  pluginId: string;
  /** Semver range (e.g. "^1.0.0"). When omitted any version satisfies. */
  versionRange?: DepVersion;
  /** Whether this dependency is optional. */
  optional?: boolean;
}

/** A node in the dependency graph. */
export interface DepGraphNode {
  pluginId: string;
  version: DepVersion;
  dependencies: Dependency[];
}

/** The full result of resolving a dependency graph. */
export interface DepGraphResult {
  nodes: DepGraphNode[];
  edges: Array<{ from: string; to: string; versionRange?: DepVersion; optional?: boolean }>;
  cycles: string[][];
  topologicalOrder: string[];
  orphans: string[];
  conflicts: VersionConflict[];
  resolvedDeps: Map<string, DepVersion>;
}

/** Describes a version conflict between two plugins. */
export interface VersionConflict {
  pluginA: string;
  pluginB: string;
  requiredVersion: DepVersion;
  description: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Very small semver parser — returns { major, minor, patch }.
 * Handles versions like "1.2.3" or "1.2.3-beta.1" (suffix is ignored).
 */
function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10), patch: parseInt(match[3], 10) };
}

/** Compare two parsed semvers: -1, 0, or 1. */
function compareSemver(a: { major: number; minor: number; patch: number }, b: { major: number; minor: number; patch: number }): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

/**
 * Rough semver range satisfaction.
 * Supports exact match, "^X.Y.Z", "~X.Y.Z", ">=X.Y.Z", and "*" wildcards.
 */
function satisfiesRange(version: DepVersion, range?: DepVersion): boolean {
  if (!range || range === '*' || range.trim() === '') return true;
  const parsed = parseSemver(version);
  if (!parsed) return false;

  const r = range.trim();

  // Exact match
  const exact = parseSemver(r);
  if (exact && compareSemver(parsed, exact) === 0) return true;

  // ^X.Y.Z  — compatible with major version
  if (r.startsWith('^')) {
    const base = parseSemver(r.slice(1));
    if (!base) return false;
    if (parsed.major !== base.major) return false;
    if (parsed.minor < base.minor) return false;
    if (parsed.minor === base.minor && parsed.patch < base.patch) return false;
    return true;
  }

  // ~X.Y.Z  — compatible with major.minor
  if (r.startsWith('~')) {
    const base = parseSemver(r.slice(1));
    if (!base) return false;
    if (parsed.major !== base.major || parsed.minor !== base.minor) return false;
    if (parsed.patch < base.patch) return false;
    return true;
  }

  // >=X.Y.Z
  if (r.startsWith('>=')) {
    const base = parseSemver(r.slice(2));
    if (!base) return false;
    return compareSemver(parsed, base) >= 0;
  }

  // >X.Y.Z
  if (r.startsWith('>')) {
    const base = parseSemver(r.slice(1));
    if (!base) return false;
    return compareSemver(parsed, base) > 0;
  }

  // <=X.Y.Z
  if (r.startsWith('<=')) {
    const base = parseSemver(r.slice(2));
    if (!base) return false;
    return compareSemver(parsed, base) <= 0;
  }

  // <X.Y.Z
  if (r.startsWith('<')) {
    const base = parseSemver(r.slice(1));
    if (!base) return false;
    return compareSemver(parsed, base) < 0;
  }

  return false;
}

// ---------------------------------------------------------------------------
// DepEngine
// ---------------------------------------------------------------------------

export class DepEngine {
  private stats = { nodes: 0, edges: 0, cycles: 0, orphans: 0 };

  constructor() {
    console.log('[DependencyEngine] Initialized — PHASE OMEGA Resolver');
  }

  // ---- Public API ----------------------------------------------------------

  /**
   * Resolves the full dependency graph for the given plugins.
   * Returns nodes, edges, cycles, topological order, orphans, conflicts, and
   * a map of resolved dependency → chosen version.
   */
  resolveGraph(plugins: Array<{ id: string; version: string; dependencies?: Dependency[] }>): DepGraphResult {
    const nodes: DepGraphNode[] = plugins.map((p) => ({
      pluginId: p.id,
      version: p.version,
      dependencies: p.dependencies ?? [],
    }));

    const edges: DepGraphResult['edges'] = [];
    for (const node of nodes) {
      for (const dep of node.dependencies) {
        edges.push({
          from: node.pluginId,
          to: dep.pluginId,
          versionRange: dep.versionRange,
          optional: dep.optional,
        });
      }
    }

    const cycles = this.detectCycles(nodes);
    const topologicalOrder = this.topologicalSort(nodes);
    const allIds = new Set(plugins.map((p) => p.id));
    const orphans = this.detectOrphans(nodes, allIds);
    const conflicts = this.detectConflicts(nodes);

    // Resolved deps: for each required dependency, pick the best available version
    const resolvedDeps = new Map<string, DepVersion>();
    for (const node of nodes) {
      resolvedDeps.set(node.pluginId, node.version);
      for (const dep of node.dependencies) {
        const target = nodes.find((n) => n.pluginId === dep.pluginId);
        if (target && !resolvedDeps.has(dep.pluginId)) {
          resolvedDeps.set(dep.pluginId, target.version);
        }
      }
    }

    // Update internal stats
    this.stats = {
      nodes: nodes.length,
      edges: edges.length,
      cycles: cycles.length,
      orphans: orphans.length,
    };

    return { nodes, edges, cycles, topologicalOrder, orphans, conflicts, resolvedDeps };
  }

  /**
   * Returns a topological ordering of plugin IDs using Kahn's algorithm.
   * Cyclic nodes are appended at the end in arbitrary order.
   */
  topologicalSort(graph: DepGraphNode[]): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();
    const allIds = new Set<string>();

    for (const node of graph) {
      allIds.add(node.pluginId);
      inDegree.set(node.pluginId, 0);
      adjacency.set(node.pluginId, []);
    }

    for (const node of graph) {
      for (const dep of node.dependencies) {
        // edge: dep.pluginId → node.pluginId (dep must load before node)
        if (allIds.has(dep.pluginId)) {
          adjacency.get(dep.pluginId)!.push(node.pluginId);
          inDegree.set(node.pluginId, (inDegree.get(node.pluginId) ?? 0) + 1);
        }
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      for (const neighbor of adjacency.get(current) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) queue.push(neighbor);
      }
    }

    // Anything remaining is part of a cycle — append in original order
    for (const node of graph) {
      if (!sorted.includes(node.pluginId)) {
        sorted.push(node.pluginId);
      }
    }

    return sorted;
  }

  /**
   * Detects all cycles in the dependency graph using DFS.
   * Returns an array of cycles, where each cycle is an array of plugin IDs.
   */
  detectCycles(graph: DepGraphNode[]): string[][] {
    const adjacency = new Map<string, string[]>();
    const allIds = new Set<string>();

    for (const node of graph) {
      allIds.add(node.pluginId);
      adjacency.set(node.pluginId, []);
    }

    for (const node of graph) {
      for (const dep of node.dependencies) {
        if (allIds.has(dep.pluginId)) {
          adjacency.get(node.pluginId)!.push(dep.pluginId);
        }
      }
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): void => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      for (const neighbor of adjacency.get(node) ?? []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          // Found a cycle — extract it from the path
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            const cycle = [...path.slice(cycleStart), neighbor];
            // Normalize: start with the smallest ID
            const minIdx = cycle.slice(0, -1).reduce((mi, id, i, arr) => (id < arr[mi] ? i : mi), 0);
            const normalized = [...cycle.slice(minIdx), ...cycle.slice(1, minIdx)];
            const key = normalized.join('→');
            if (!cycles.some((c) => c.join('→') === key)) {
              cycles.push(normalized);
            }
          }
        }
      }

      path.pop();
      recStack.delete(node);
    };

    for (const node of graph) {
      if (!visited.has(node.pluginId)) {
        dfs(node.pluginId);
      }
    }

    return cycles;
  }

  /**
   * Detects orphan plugins — those with no dependents and no dependencies.
   */
  detectOrphans(graph: DepGraphNode[], allPlugins: Set<string>): string[] {
    const hasDependency = new Set<string>();
    const isDependedUpon = new Set<string>();

    for (const node of graph) {
      for (const dep of node.dependencies) {
        hasDependency.add(node.pluginId);
        isDependedUpon.add(dep.pluginId);
      }
    }

    const orphans: string[] = [];
    for (const id of allPlugins) {
      if (!hasDependency.has(id) && !isDependedUpon.has(id)) {
        orphans.push(id);
      }
    }

    return orphans;
  }

  /**
   * Detects version conflicts where multiple plugins require different,
   * incompatible versions of the same dependency.
   */
  detectConflicts(graph: DepGraphNode[]): VersionConflict[] {
    const requirements = new Map<string, Array<{ source: string; range?: DepVersion }>>();

    for (const node of graph) {
      for (const dep of node.dependencies) {
        if (!dep.optional) {
          const existing = requirements.get(dep.pluginId) ?? [];
          existing.push({ source: node.pluginId, range: dep.versionRange });
          requirements.set(dep.pluginId, existing);
        }
      }
    }

    const conflicts: VersionConflict[] = [];

    for (const [depId, reqs] of requirements) {
      if (reqs.length < 2) continue;

      // Check if all ranges can be satisfied by a single available version
      const ranges = reqs.map((r) => r.range).filter(Boolean) as DepVersion[];
      if (ranges.length < 2) continue;

      // Check pairwise for incompatibility
      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          if (ranges[i] === ranges[j]) continue;
          // Check if they have different major version requirements
          const pA = parseSemver(ranges[i]!.replace(/^[\^~>=<]*/, ''));
          const pB = parseSemver(ranges[j]!.replace(/^[\^~>=<]*/, ''));
          if (pA && pB && pA.major !== pB.major) {
            conflicts.push({
              pluginA: reqs[i]!.source,
              pluginB: reqs[j]!.source,
              requiredVersion: depId,
              description: `${reqs[i]!.source} requires ${depId}@${ranges[i]} but ${reqs[j]!.source} requires ${depId}@${ranges[j]} — incompatible major versions`,
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Given a map of pluginId → available version strings, picks the best
   * (highest) version for each plugin.
   */
  solveVersions(plugins: Map<string, string[]>): Map<string, string> {
    const result = new Map<string, string>();

    for (const [pluginId, versions] of plugins) {
      if (versions.length === 0) continue;

      let best = versions[0]!;
      let bestParsed = parseSemver(best);

      for (let i = 1; i < versions.length; i++) {
        const v = versions[i]!;
        const vp = parseSemver(v);
        if (vp && bestParsed && compareSemver(vp, bestParsed) > 0) {
          best = v;
          bestParsed = vp;
        }
      }

      result.set(pluginId, best);
    }

    return result;
  }

  /**
   * Checks whether a plugin can be installed into the current graph
   * without causing version conflicts.
   */
  canInstall(
    pluginId: string,
    version: DepVersion,
    currentGraph: DepGraphNode[]
  ): { compatible: boolean; conflicts: string[] } {
    const conflicts: string[] = [];
    const existing = currentGraph.find((n) => n.pluginId === pluginId);

    if (existing) {
      conflicts.push(`Plugin "${pluginId}" is already installed at version ${existing.version}`);
    }

    // Check if any existing plugin depends on this one with a version range
    for (const node of currentGraph) {
      for (const dep of node.dependencies) {
        if (dep.pluginId === pluginId && dep.versionRange) {
          if (!satisfiesRange(version, dep.versionRange)) {
            conflicts.push(
              `${node.pluginId} requires ${pluginId}@${dep.versionRange}, but installing ${pluginId}@${version}`
            );
          }
        }
      }
    }

    return { compatible: conflicts.length === 0, conflicts };
  }

  /**
   * Returns the activation/load order for the given plugins based on their
   * dependency relationships.
   */
  getLoadOrder(plugins: Array<{ id: string; version: string; dependencies?: Dependency[] }>): string[] {
    const graph = plugins.map((p) => ({
      pluginId: p.id,
      version: p.version,
      dependencies: p.dependencies ?? [],
    }));
    return this.topologicalSort(graph);
  }

  /** Returns internal engine statistics. */
  getStats(): { nodes: number; edges: number; cycles: number; orphans: number } {
    return { ...this.stats };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: DepEngine | null = null;

/** Returns the singleton DepEngine instance. */
export function getDependencyEngine(): DepEngine {
  if (!_instance) {
    _instance = new DepEngine();
  }
  return _instance;
}

/** Resets the singleton — useful for testing. */
export function resetDependencyEngine(): void {
  _instance = null;
  console.log('[DependencyEngine] Singleton reset');
}