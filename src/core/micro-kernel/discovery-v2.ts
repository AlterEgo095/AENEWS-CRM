/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * Discovery Engine V2 — Metadata-Only Static Analysis
 *
 * RÈGLE ABSOLUE : Discovery ne remplit jamais les registres directement.
 * Il produit uniquement un MetadataGraph.
 * Le Registry Manager consomme le MetadataGraph pour peupler les registres.
 *
 * Supports: plugin.json manifests (phase 1)
 */

import type { PluginManifest, MetadataGraph, MetadataNode, MetadataEdge, PluginState, PluginCategory } from './types';
import crypto from 'crypto';

export interface DiscoveryResult {
  success: boolean;
  graph: MetadataGraph;
  errors: { pluginId: string; error: string }[];
  warnings: { pluginId: string; warning: string }[];
  duration: number;
  stats: {
    totalScanned: number;
    valid: number;
    invalid: number;
    systemPlugins: number;
    businessPlugins: number;
  };
}

export interface DiscoveryConfig {
  pluginsDir: string;
  includeTestPlugins?: boolean;
}

// Minimal manifest validation (kernel-level only)
function validateKernelManifest(manifest: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const m = manifest as Record<string, unknown>;

  if (!m || typeof m !== 'object') {
    return { valid: false, errors: ['Manifest is not an object'] };
  }

  // Required fields
  const required = ['aenews', 'id', 'slug', 'name', 'version', 'category'];
  for (const field of required) {
    if (!m[field]) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  if (m.aenews !== '1') {
    errors.push(`Invalid aenews version: expected "1", got "${m.aenews}"`);
  }

  // ID format
  if (m.id && typeof m.id !== 'string') {
    errors.push('Plugin id must be a string');
  } else if (m.id && !/^[a-z][a-z0-9-]*$/.test(m.id as string)) {
    errors.push(`Invalid plugin id format: "${m.id}" (must be lowercase, start with letter)`);
  }

  // Slug format
  if (m.slug && typeof m.slug !== 'string') {
    errors.push('Slug must be a string');
  }

  // Version format (basic semver check)
  if (m.version && typeof m.version === 'string') {
    if (!/^\d+\.\d+\.\d+/.test(m.version as string)) {
      errors.push(`Invalid version format: "${m.version}" (expected semver)`);
    }
  }

  // Category
  if (m.category && !['system', 'business'].includes(m.category as string)) {
    errors.push(`Invalid category: "${m.category}" (expected "system" or "business")`);
  }

  return { valid: errors.length === 0, errors };
}

function computeManifestChecksum(manifest: PluginManifest): string {
  return crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex').substring(0, 16);
}

export class DiscoveryEngineV2 {
  private config: DiscoveryConfig;

  constructor(config: DiscoveryConfig) {
    this.config = config;
  }

  /** Run full discovery — returns MetadataGraph only */
  async discover(pluginDirs?: Array<{ id: string; manifest: PluginManifest }>): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const errors: DiscoveryResult['errors'] = [];
    const warnings: DiscoveryResult['warnings'] = [];
    const graph: MetadataGraph = {
      nodes: new Map(),
      edges: [],
      root: [],
      layers: [],
      timestamp: startTime,
    };

    const manifests: Array<{ id: string; manifest: PluginManifest }> = pluginDirs || [];

    // Phase 1: Validate all manifests
    for (const { id, manifest } of manifests) {
      const validation = validateKernelManifest(manifest);
      if (!validation.valid) {
        errors.push({ pluginId: id, error: `Manifest validation failed: ${validation.errors.join('; ')}` });
        continue;
      }

      const node: MetadataNode = {
        pluginId: manifest.id,
        pluginVersion: manifest.version,
        category: manifest.category as PluginCategory,
        state: 'validated' as PluginState,
        manifest,
        validatedAt: startTime,
        checksum: computeManifestChecksum(manifest),
      };

      graph.nodes.set(manifest.id, node);
    }

    // Phase 2: Build dependency edges
    for (const [id, node] of graph.nodes) {
      const deps = node.manifest.dependencies || [];
      for (const dep of deps) {
        if (!graph.nodes.has(dep.id)) {
          if (dep.required !== false) {
            errors.push({ pluginId: id, error: `Missing required dependency: "${dep.id}@${dep.version}"` });
          } else {
            warnings.push({ pluginId: id, warning: `Optional dependency not found: "${dep.id}"` });
          }
        }

        const edge: MetadataEdge = {
          from: id,
          to: dep.id,
          versionConstraint: dep.version,
          resolved: graph.nodes.has(dep.id),
        };
        graph.edges.push(edge);
      }
    }

    // Phase 3: Topological sort into layers
    const layers = this._topologicalLayers(graph);
    graph.layers = layers;

    // Identify root nodes (no dependencies)
    for (const [id, node] of graph.nodes) {
      const hasDeps = graph.edges.some(e => e.from === id);
      if (!hasDeps) {
        graph.root.push(id);
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: errors.length === 0,
      graph,
      errors,
      warnings,
      duration,
      stats: {
        totalScanned: manifests.length,
        valid: graph.nodes.size,
        invalid: errors.length,
        systemPlugins: Array.from(graph.nodes.values()).filter(n => n.category === 'system').length,
        businessPlugins: Array.from(graph.nodes.values()).filter(n => n.category === 'business').length,
      },
    };
  }

  /** Topological sort with cycle detection */
  private _topologicalLayers(graph: MetadataGraph): string[][] {
    const layers: string[][] = [];
    const remaining = new Set(graph.nodes.keys());
    const inDegree: Map<string, number> = new Map();

    // Calculate in-degrees
    for (const id of remaining) {
      inDegree.set(id, 0);
    }
    for (const edge of graph.edges) {
      if (remaining.has(edge.from) && remaining.has(edge.to)) {
        inDegree.set(edge.from, (inDegree.get(edge.from) || 0) + 1);
      }
    }

    while (remaining.size > 0) {
      // Find nodes with no incoming edges
      const layer: string[] = [];
      for (const id of remaining) {
        if ((inDegree.get(id) || 0) === 0) {
          layer.push(id);
        }
      }

      if (layer.length === 0) {
        // Cycle detected — break the cycle by removing one node
        const cycleNode = remaining.values().next().value;
        if (cycleNode) {
          layer.push(cycleNode);
          console.warn(`[DiscoveryV2] Cycle detected involving "${cycleNode}", breaking cycle`);
        }
      }

      layers.push(layer);

      // Remove this layer and update degrees
      for (const id of layer) {
        remaining.delete(id);
        for (const edge of graph.edges) {
          if (edge.to === id && remaining.has(edge.from)) {
            inDegree.set(edge.from, (inDegree.get(edge.from) || 0) - 1);
          }
        }
      }
    }

    return layers;
  }
}

// Singleton
let _discovery: DiscoveryEngineV2 | null = null;

export function getDiscoveryEngine(config?: DiscoveryConfig): DiscoveryEngineV2 {
  if (!_discovery && config) {
    _discovery = new DiscoveryEngineV2(config);
  }
  if (!_discovery) {
    _discovery = new DiscoveryEngineV2({ pluginsDir: './plugins' });
  }
  return _discovery;
}

export function resetDiscoveryEngine(config?: DiscoveryConfig): void {
  _discovery = config ? new DiscoveryEngineV2(config) : null;
}
