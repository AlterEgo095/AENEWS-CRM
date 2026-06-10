/**
 * AENEWS Enterprise OS — PHASE OMEGA Meta Kernel
 * Central Meta Registry: Unified type-safe registry for all entity types
 * across the entire platform architecture.
 *
 * Provides registration, querying, dependency graph resolution,
 * checksum verification, and snapshot serialization for every
 * discoverable entity in the system.
 */

import { createHash } from 'node:crypto';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §1  Type Definitions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Every distinct entity type the Meta Registry can track. */
export type MetaEntityType =
  | 'plugin'
  | 'capability'
  | 'tool'
  | 'ui'
  | 'workflow'
  | 'schema'
  | 'knowledge'
  | 'agent'
  | 'search'
  | 'builder'
  | 'report'
  | 'widget'
  | 'theme'
  | 'permission';

/** Exhaustive constant array — useful for iteration and validation. */
export const META_ENTITY_TYPES: readonly MetaEntityType[] = [
  'plugin',
  'capability',
  'tool',
  'ui',
  'workflow',
  'schema',
  'knowledge',
  'agent',
  'search',
  'builder',
  'report',
  'widget',
  'theme',
  'permission',
] as const;

/** Semantic relationship between two registered entities. */
export interface MetaRelation {
  type:
    | 'depends_on'
    | 'provides'
    | 'extends'
    | 'implements'
    | 'contains'
    | 'uses';
  targetId: string;
}

/** Lifecycle status of a registered entity. */
export type MetaEntityStatus = 'active' | 'deprecated' | 'disabled';

/** The core entity record stored in the Meta Registry. */
export interface MetaEntity {
  /** Unique identifier — typically generated via `metaId(type, name)`. */
  id: string;
  /** The entity type from the `MetaEntityType` union. */
  type: MetaEntityType;
  /** Owning plugin identifier (empty string for built-in entities). */
  pluginId: string;
  /** Machine-readable slug name. */
  name: string;
  /** Human-readable display label. */
  label: string;
  /** Optional longer description. */
  description?: string;
  /** Arbitrary key-value metadata payload. */
  metadata: Record<string, unknown>;
  /** Categorisation / search tags. */
  tags: string[];
  /** Semantic version string. */
  version: string;
  /** SHA-256 checksum of the entity content for integrity checks. */
  checksum: string;
  /** ISO-8601 timestamp of first registration. */
  registeredAt: string;
  /** ISO-8601 timestamp of last mutation. */
  updatedAt: string;
  /** Current lifecycle status. */
  status: MetaEntityStatus;
  /** Relationships to other registered entities. */
  relations: MetaRelation[];
}

/** Aggregate statistics about the registry contents. */
export interface MetaRegistryStats {
  totalEntities: number;
  activeEntities: number;
  deprecatedEntities: number;
  disabledEntities: number;
  totalPlugins: number;
  typesBreakdown: Record<MetaEntityType, number>;
  totalRelations: number;
  oldestEntity: string | null;
  newestEntity: string | null;
}

/** Flexible query interface for filtering entities from the registry. */
export interface MetaQuery {
  /** Match one or more entity types. */
  types?: MetaEntityType[];
  /** Match entities belonging to a specific plugin. */
  pluginId?: string;
  /** Match entities whose tags include ALL of the provided values. */
  tags?: string[];
  /** Match entities whose status equals this value. */
  status?: MetaEntityStatus;
  /** Sub-string match on name (case-insensitive). */
  nameContains?: string;
  /** Sub-string match on label (case-insensitive). */
  labelContains?: string;
  /** Maximum number of results to return. */
  limit?: number;
  /** Number of results to skip (for pagination). */
  offset?: number;
}

/** Result of a `project()` call — entities of a specific type. */
export interface MetaProjectionResult {
  entities: MetaEntity[];
  count: number;
  plugins: string[];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §2  Helper Functions
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Generate a deterministic meta-entity identifier from type and name.
 * Format: `<type>:<name>` (lowercased, colon-separated).
 */
export function metaId(type: MetaEntityType, name: string): string {
  return `${type}:${name.toLowerCase().replace(/\s+/g, '-')}`;
}

/**
 * Generate a SHA-256 checksum hex digest for arbitrary string content.
 * Used for entity integrity verification.
 */
export function generateChecksum(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

/** Parameters for the `createMetaEntity` factory helper. */
export interface CreateMetaEntityParams {
  id?: string;
  type: MetaEntityType;
  pluginId?: string;
  name: string;
  label: string;
  description?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  version?: string;
  checksum?: string;
  status?: MetaEntityStatus;
  relations?: MetaRelation[];
}

/**
 * Factory helper to create a fully-formed `MetaEntity` with sensible
 * defaults and auto-generated fields where not provided.
 */
export function createMetaEntity(params: CreateMetaEntityParams): MetaEntity {
  const now = new Date().toISOString();
  const id = params.id ?? metaId(params.type, params.name);
  const contentForChecksum = JSON.stringify({
    name: params.name,
    label: params.label,
    type: params.type,
    metadata: params.metadata ?? {},
    version: params.version ?? '0.1.0',
  });

  return {
    id,
    type: params.type,
    pluginId: params.pluginId ?? '',
    name: params.name,
    label: params.label,
    description: params.description,
    metadata: params.metadata ?? {},
    tags: params.tags ?? [],
    version: params.version ?? '0.1.0',
    checksum: params.checksum ?? generateChecksum(contentForChecksum),
    registeredAt: now,
    updatedAt: now,
    status: params.status ?? 'active',
    relations: params.relations ?? [],
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §3  MetaRegistry Class
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Central in-memory Meta Registry for AENEOS PHASE OMEGA.
 *
 * All entities (plugins, capabilities, tools, workflows, etc.) are
 * registered here with full metadata, typed relations, and integrity
 * checksums. Supports rich querying, dependency graph traversal, and
 * snapshot serialization.
 */
export class MetaRegistry {
  // ── Primary entity store ──────────────────────────────────────────
  private entities: Map<string, MetaEntity> = new Map();

  // ── Secondary index stores for fast lookups ─────────────────────
  private pluginIndex: Map<string, Set<string>> = new Map();
  private typeIndex: Map<MetaEntityType, Set<string>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private checksumIndex: Map<string, Set<string>> = new Map();

  constructor() {
    // Pre-initialise the type index with empty sets for every known type
    for (const t of META_ENTITY_TYPES) {
      this.typeIndex.set(t, new Set());
    }

    console.log('[MetaRegistry] Initialized — PHASE OMEGA Meta Kernel');
  }

  // ── Internal: Validation ─────────────────────────────────────────

  /**
   * Validate that an entity conforms to the required shape and
   * contains no conflicts with existing data.
   */
  private validateEntity(entity: MetaEntity): void {
    if (!entity.id || typeof entity.id !== 'string') {
      throw new Error(`[MetaRegistry] Entity must have a non-empty string id (got: "${entity.id}")`);
    }

    if (!META_ENTITY_TYPES.includes(entity.type)) {
      throw new Error(`[MetaRegistry] Unknown entity type "${entity.type}" for entity "${entity.id}"`);
    }

    if (!entity.name || typeof entity.name !== 'string') {
      throw new Error(`[MetaRegistry] Entity "${entity.id}" must have a non-empty string name`);
    }

    if (!entity.label || typeof entity.label !== 'string') {
      throw new Error(`[MetaRegistry] Entity "${entity.id}" must have a non-empty string label`);
    }

    if (!entity.version || typeof entity.version !== 'string') {
      throw new Error(`[MetaRegistry] Entity "${entity.id}" must have a non-empty string version`);
    }

    if (!entity.checksum || typeof entity.checksum !== 'string') {
      throw new Error(`[MetaRegistry] Entity "${entity.id}" must have a non-empty string checksum`);
    }

    if (!['active', 'deprecated', 'disabled'].includes(entity.status)) {
      throw new Error(`[MetaRegistry] Invalid status "${entity.status}" for entity "${entity.id}"`);
    }

    if (!Array.isArray(entity.tags)) {
      throw new Error(`[MetaRegistry] Entity "${entity.id}" tags must be an array`);
    }

    if (!Array.isArray(entity.relations)) {
      throw new Error(`[MetaRegistry] Entity "${entity.id}" relations must be an array`);
    }
  }

  // ── Internal: Index Management ───────────────────────────────────

  /**
   * Add entity id to all secondary indices.
   */
  private addToIndices(entity: MetaEntity): void {
    // Plugin index
    if (!this.pluginIndex.has(entity.pluginId)) {
      this.pluginIndex.set(entity.pluginId, new Set());
    }
    this.pluginIndex.get(entity.pluginId)!.add(entity.id);

    // Type index (guaranteed to exist from constructor)
    this.typeIndex.get(entity.type)!.add(entity.id);

    // Tag index
    for (const tag of entity.tags) {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(entity.id);
    }

    // Checksum index
    if (!this.checksumIndex.has(entity.checksum)) {
      this.checksumIndex.set(entity.checksum, new Set());
    }
    this.checksumIndex.get(entity.checksum)!.add(entity.id);
  }

  /**
   * Remove entity id from all secondary indices.
   */
  private removeFromIndices(entity: MetaEntity): void {
    // Plugin index
    const pluginIds = this.pluginIndex.get(entity.pluginId);
    if (pluginIds) {
      pluginIds.delete(entity.id);
      if (pluginIds.size === 0) {
        this.pluginIndex.delete(entity.pluginId);
      }
    }

    // Type index
    const typeIds = this.typeIndex.get(entity.type);
    if (typeIds) {
      typeIds.delete(entity.id);
    }

    // Tag index
    for (const tag of entity.tags) {
      const tagIds = this.tagIndex.get(tag);
      if (tagIds) {
        tagIds.delete(entity.id);
        if (tagIds.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    }

    // Checksum index
    const checksumIds = this.checksumIndex.get(entity.checksum);
    if (checksumIds) {
      checksumIds.delete(entity.id);
      if (checksumIds.size === 0) {
        this.checksumIndex.delete(entity.checksum);
      }
    }
  }

  // ── Registration ─────────────────────────────────────────────────

  /**
   * Register a single entity. Validates, stores, and indexes it.
   * If an entity with the same id already exists it is replaced
   * (upsert semantics).
   */
  register(entity: MetaEntity): void {
    this.validateEntity(entity);

    // If overwriting, remove old indices first
    const existing = this.entities.get(entity.id);
    if (existing) {
      this.removeFromIndices(existing);
      entity.registeredAt = existing.registeredAt; // preserve original registration time
    }

    entity.updatedAt = new Date().toISOString();
    this.entities.set(entity.id, entity);
    this.addToIndices(entity);

    console.log(
      `[MetaRegistry] Registered ${entity.type} "${entity.name}" (${entity.id}) ` +
      `from plugin "${entity.pluginId || '<builtin>'}" [${entity.status}]`
    );
  }

  /**
   * Register multiple entities in a single batch.
   */
  registerBatch(entities: MetaEntity[]): void {
    for (const entity of entities) {
      this.register(entity);
    }
    console.log(`[MetaRegistry] Batch registered ${entities.length} entities`);
  }

  // ── Unregistration ───────────────────────────────────────────────

  /**
   * Unregister a single entity by id.
   */
  unregister(id: string): boolean {
    const entity = this.entities.get(id);
    if (!entity) {
      console.warn(`[MetaRegistry] Unregister failed — entity "${id}" not found`);
      return false;
    }

    this.removeFromIndices(entity);
    this.entities.delete(id);

    console.log(`[MetaRegistry] Unregistered ${entity.type} "${entity.name}" (${id})`);
    return true;
  }

  /**
   * Unregister ALL entities belonging to a specific plugin.
   */
  unregisterByPlugin(pluginId: string): number {
    const ids = this.pluginIndex.get(pluginId);
    if (!ids || ids.size === 0) {
      console.warn(`[MetaRegistry] UnregisterByPlugin — no entities for plugin "${pluginId}"`);
      return 0;
    }

    const count = ids.size;
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity) {
        this.removeFromIndices(entity);
        this.entities.delete(id);
      }
    }

    console.log(`[MetaRegistry] Unregistered ${count} entities from plugin "${pluginId}"`);
    return count;
  }

  /**
   * Unregister ALL entities of a specific type.
   */
  unregisterByType(type: MetaEntityType): number {
    if (!META_ENTITY_TYPES.includes(type)) {
      throw new Error(`[MetaRegistry] Unknown type "${type}" for unregisterByType`);
    }

    const ids = this.typeIndex.get(type);
    if (!ids || ids.size === 0) {
      console.warn(`[MetaRegistry] UnregisterByType — no entities of type "${type}"`);
      return 0;
    }

    const count = ids.size;
    for (const id of ids) {
      const entity = this.entities.get(id);
      if (entity) {
        this.removeFromIndices(entity);
        this.entities.delete(id);
      }
    }

    console.log(`[MetaRegistry] Unregistered ${count} entities of type "${type}"`);
    return count;
  }

  // ── Retrieval ─────────────────────────────────────────────────────

  /**
   * Retrieve a single entity by id.
   */
  get(id: string): MetaEntity | undefined {
    return this.entities.get(id);
  }

  /**
   * Retrieve ALL entities.
   */
  getAll(): MetaEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Flexible query interface. Returns entities matching ALL provided
   * criteria (logical AND).
   */
  query(q: MetaQuery): MetaEntity[] {
    let results = Array.from(this.entities.values());

    if (q.types && q.types.length > 0) {
      results = results.filter((e) => q.types!.includes(e.type));
    }

    if (q.pluginId !== undefined) {
      results = results.filter((e) => e.pluginId === q.pluginId);
    }

    if (q.tags && q.tags.length > 0) {
      results = results.filter((e) =>
        q.tags!.every((tag) => e.tags.includes(tag))
      );
    }

    if (q.status !== undefined) {
      results = results.filter((e) => e.status === q.status);
    }

    if (q.nameContains !== undefined) {
      const needle = q.nameContains.toLowerCase();
      results = results.filter((e) => e.name.toLowerCase().includes(needle));
    }

    if (q.labelContains !== undefined) {
      const needle = q.labelContains.toLowerCase();
      results = results.filter((e) => e.label.toLowerCase().includes(needle));
    }

    // Apply offset first, then limit
    if (q.offset !== undefined && q.offset > 0) {
      results = results.slice(q.offset);
    }

    if (q.limit !== undefined && q.limit > 0) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  /**
   * Get all entities of a specific type.
   */
  getByType(type: MetaEntityType): MetaEntity[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.entities.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get all entities belonging to a specific plugin.
   */
  getByPlugin(pluginId: string): MetaEntity[] {
    const ids = this.pluginIndex.get(pluginId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.entities.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get all entities that have ALL of the specified tags.
   */
  getByTags(tags: string[]): MetaEntity[] {
    if (tags.length === 0) return [];

    let candidateIds: Set<string> | undefined;

    for (const tag of tags) {
      const ids = this.tagIndex.get(tag);
      if (!ids) return []; // Tag not found → no matches possible
      if (!candidateIds) {
        candidateIds = new Set(ids);
      } else {
        // Intersection: keep only ids present in both sets
        candidateIds = new Set([...candidateIds].filter((id) => ids.has(id)));
      }
      if (candidateIds.size === 0) return [];
    }

    return Array.from(candidateIds!)
      .map((id) => this.entities.get(id)!)
      .filter(Boolean);
  }

  /**
   * Get all entities that reference `targetId` in their relations.
   */
  getRelatedTo(targetId: string): MetaEntity[] {
    return Array.from(this.entities.values()).filter((e) =>
      e.relations.some((r) => r.targetId === targetId)
    );
  }

  /**
   * Build and return the dependency graph for a given plugin.
   *
   * Returns a map where each key is an entity id belonging to the plugin
   * and the value is the set of entity ids (from any plugin) that it
   * depends on via 'depends_on' relations.
   */
  getDependencyGraph(pluginId: string): Map<string, Set<string>> {
    const pluginEntities = this.getByPlugin(pluginId);
    const graph = new Map<string, Set<string>>();

    for (const entity of pluginEntities) {
      const deps = new Set<string>();
      for (const rel of entity.relations) {
        if (rel.type === 'depends_on') {
          deps.add(rel.targetId);
        }
      }
      graph.set(entity.id, deps);
    }

    return graph;
  }

  // ── Integrity ─────────────────────────────────────────────────────

  /**
   * Verify that the stored checksum for a given entity matches the
   * provided checksum value.
   */
  verifyChecksum(entityId: string, checksum: string): boolean {
    const entity = this.entities.get(entityId);
    if (!entity) return false;
    return entity.checksum === checksum;
  }

  // ── Projection ─────────────────────────────────────────────────────

  /**
   * Project the registry onto a single entity type, returning entities,
   * count, and the set of distinct plugin ids that own them.
   */
  project(type: MetaEntityType): MetaProjectionResult {
    const entities = this.getByType(type);
    const plugins = new Set(entities.map((e) => e.pluginId));
    return {
      entities,
      count: entities.length,
      plugins: Array.from(plugins),
    };
  }

  // ── Serialization ────────────────────────────────────────────────

  /**
   * Return a JSON-serializable snapshot of the entire registry state.
   * Useful for persistence, debugging, or transport.
   */
  snapshot(): {
    entities: MetaEntity[];
    stats: MetaRegistryStats;
    timestamp: string;
  } {
    return {
      entities: this.getAll(),
      stats: this.getStats(),
      timestamp: new Date().toISOString(),
    };
  }

  // ── Statistics ────────────────────────────────────────────────────

  /**
   * Compute and return aggregate statistics about the registry.
   */
  getStats(): MetaRegistryStats {
    let activeEntities = 0;
    let deprecatedEntities = 0;
    let disabledEntities = 0;
    let totalRelations = 0;
    let oldest: string | null = null;
    let newest: string | null = null;

    const typesBreakdown: Record<MetaEntityType, number> = {
      plugin: 0,
      capability: 0,
      tool: 0,
      ui: 0,
      workflow: 0,
      schema: 0,
      knowledge: 0,
      agent: 0,
      search: 0,
      builder: 0,
      report: 0,
      widget: 0,
      theme: 0,
      permission: 0,
    };

    for (const entity of this.entities.values()) {
      // Status counts
      if (entity.status === 'active') activeEntities++;
      else if (entity.status === 'deprecated') deprecatedEntities++;
      else if (entity.status === 'disabled') disabledEntities++;

      // Type breakdown
      typesBreakdown[entity.type]++;

      // Relations
      totalRelations += entity.relations.length;

      // Timestamps
      if (!oldest || entity.registeredAt < oldest) {
        oldest = entity.registeredAt;
      }
      if (!newest || entity.registeredAt > newest) {
        newest = entity.registeredAt;
      }
    }

    return {
      totalEntities: this.entities.size,
      activeEntities,
      deprecatedEntities,
      disabledEntities,
      totalPlugins: this.pluginIndex.size,
      typesBreakdown,
      totalRelations,
      oldestEntity: oldest,
      newestEntity: newest,
    };
  }

  // ── Utility ──────────────────────────────────────────────────────

  /** Check whether an entity with the given id exists. */
  has(id: string): boolean {
    return this.entities.has(id);
  }

  /** Total number of registered entities. */
  get size(): number {
    return this.entities.size;
  }

  /** Remove ALL entities and reset all indices. */
  clear(): void {
    this.entities.clear();
    this.pluginIndex.clear();
    this.tagIndex.clear();
    this.checksumIndex.clear();

    // Re-initialise the type index
    for (const t of META_ENTITY_TYPES) {
      this.typeIndex.set(t, new Set());
    }

    console.log('[MetaRegistry] Cleared — all entities and indices removed');
  }

  /**
   * Compact the registry by removing entities whose `updatedAt`
   * is older than `maxAgeMs` milliseconds ago from now.
   * Returns the number of entities removed.
   */
  compact(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;

    for (const [id, entity] of this.entities.entries()) {
      const updatedTs = new Date(entity.updatedAt).getTime();
      if (updatedTs < cutoff) {
        this.removeFromIndices(entity);
        this.entities.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[MetaRegistry] Compacted — removed ${removed} stale entities (maxAge=${maxAgeMs}ms)`);
    }

    return removed;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// §4  Singleton Access
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let _singleton: MetaRegistry | null = null;

/**
 * Get the global MetaRegistry singleton instance.
 * Created lazily on first call.
 */
export function getMetaRegistry(): MetaRegistry {
  if (!_singleton) {
    _singleton = new MetaRegistry();
  }
  return _singleton;
}

/**
 * Destroy the current singleton (useful for testing or hot-reload resets).
 * The next call to `getMetaRegistry()` will create a fresh instance.
 */
export function resetMetaRegistry(): void {
  if (_singleton) {
    _singleton.clear();
  }
  _singleton = null;
  console.log('[MetaRegistry] Singleton reset — PHASE OMEGA Meta Kernel destroyed');
}
