// ============================================================
// AENEWS Enterprise OS — Search Engine
// Full-text cross-plugin search with relevance scoring,
// deduplication, faceted results, and parallel execution.
// ============================================================

// ============================================================
// Types
// ============================================================

/**
 * Describes a searchable entity registered by a plugin.
 * Plugins call `searchEngine.registerEntity()` at init time
 * so the engine knows which handlers to invoke on each query.
 */
export interface SearchableEntity {
  /** Unique entity name, e.g. "contacts", "invoices" */
  name: string;
  /** The plugin that owns this entity */
  pluginId: string;
  /** Field on the raw data whose value becomes SearchResult.title */
  labelField: string;
  /** Optional field whose value becomes SearchResult.description */
  descriptionField?: string;
  /**
   * Mustache-style template for the result href.
   * e.g. "/crm/contacts/{{id}}" — `{{field}}` tokens are
   * interpolated from the handler's raw result object.
   */
  hrefTemplate: string;
  /** Optional icon identifier (Lucide icon name, etc.) */
  icon?: string;
  /** Fields of the raw data object to search across */
  fields: string[];
  /**
   * Plugin-provided search handler. Returns raw matching records;
   * the engine normalises them into SearchResult objects.
   */
  handler: (
    query: string,
    tenantId: string,
    options?: SearchOptions,
  ) => Promise<RawSearchHit[]>;
  /** Permissions required to see results from this entity */
  permissions?: string[];
  /** Relevance multiplier (default 1). Higher = boosted in ranking. */
  weight?: number;
}

/**
 * A raw hit returned by a plugin handler before normalisation.
 * The engine reads `labelField`, `descriptionField`, and any
 * tokens in `hrefTemplate` from this object.
 */
export interface RawSearchHit {
  /** Unique identifier for the record */
  id: string;
  /** Full raw data — fields referenced by the entity config */
  [key: string]: unknown;
}

/**
 * Options forwarded to entity handlers and used by the engine
 * for pagination, filtering, and scoping.
 */
export interface SearchOptions {
  /** Maximum results to return (default 20) */
  limit?: number;
  /** Offset for pagination (default 0) */
  offset?: number;
  /** Arbitrary key/value filters passed to handlers */
  filters?: Record<string, any>;
  /** Restrict search to a single entity type */
  entityType?: string;
  /** Restrict search to a single plugin */
  pluginId?: string;
}

/**
 * A normalised, scored search result ready for the UI.
 */
export interface SearchResult {
  /** Record identifier */
  id: string;
  /** Entity type name, e.g. "contacts" */
  entityType: string;
  /** Human-readable entity name, e.g. "Contacts" */
  entityName: string;
  /** Owning plugin id */
  pluginId: string;
  /** Display title — value of the entity's labelField */
  title: string;
  /** Optional description — value of descriptionField */
  description?: string;
  /** Navigable link — interpolated hrefTemplate */
  href: string;
  /** Icon identifier */
  icon?: string;
  /** Computed relevance score (higher = more relevant) */
  score: number;
  /** Arbitrary extra data from the handler */
  metadata?: Record<string, any>;
}

/** The shape returned by the engine's `search()` method. */
export interface SearchResponse {
  results: SearchResult[];
  /** Total matched results (across all entities, before limit/offset) */
  total: number;
  /** Count of results per entityType */
  facets: Record<string, number>;
}

/** Describes a registered entity type (used for UI search category display). */
export interface EntityTypeInfo {
  name: string;
  pluginId: string;
  label: string;
}

/** Engine statistics. */
export interface SearchEngineStats {
  totalEntities: number;
  totalPlugins: number;
  entityTypes: string[];
}

// ============================================================
// Internal helpers
// ============================================================

/** Normalize a string for search comparison: lowercase, strip diacritics. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // strip combining diacritical marks
}

/**
 * Tokenize a query string into individual search terms.
 * Strips punctuation and splits on whitespace.
 */
function tokenize(query: string): string[] {
  return normalize(query)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

/**
 * Compute a text-relevance score for a value against a query.
 *
 * Scoring tiers (cumulative):
 *  - Exact full-string match              → +3.0
 *  - Every token appears as a prefix      → +2.0
 *  - Some tokens appear as a prefix       → +1.0
 *  - Token contains (substring) match     → +0.5
 *  - Per-matching-token bonus             → +0.1 per token
 */
function textRelevance(value: string, query: string): number {
  if (!value || !query) return 0;

  const normalizedValue = normalize(value);
  const normalizedQuery = normalize(query);
  const tokens = tokenize(query);

  if (tokens.length === 0) return 0;

  let score = 0;

  // Exact full-string match (highest signal)
  if (normalizedValue === normalizedQuery) {
    score += 3.0;
  }

  // Per-token analysis
  let prefixMatches = 0;
  let containsMatches = 0;
  const words = normalizedValue.split(/\s+/);

  for (const token of tokens) {
    // Check if any word in the value starts with this token
    const hasPrefix = words.some((w) => w.startsWith(token));
    if (hasPrefix) {
      prefixMatches++;
    }

    // Check if token appears anywhere as a substring
    if (normalizedValue.includes(token)) {
      containsMatches++;
      score += 0.1; // per-token bonus
    }
  }

  // Tier bonuses
  if (prefixMatches === tokens.length && tokens.length > 0) {
    score += 2.0; // all tokens are prefixes of some word
  } else if (prefixMatches > 0) {
    score += 1.0; // some tokens are prefixes
  }

  if (containsMatches === tokens.length && tokens.length > 0) {
    score += 0.5; // all tokens found (substring)
  }

  return score;
}

/**
 * Interpolate `{{field}}` tokens in a template string
 * with values from a data object.
 */
function interpolateTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, field) => {
    const value = data[field];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

/**
 * Safely extract a string value from a raw hit object.
 */
function getStringValue(
  data: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = data[field];
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return undefined;
  return String(value);
}

// ============================================================
// Search Engine
// ============================================================

export class SearchEngine {
  /** Registered searchable entities keyed by entity name. */
  private entities: Map<string, SearchableEntity> = new Map();

  // ----------------------------------------------------------
  // REGISTRATION
  // ----------------------------------------------------------

  /**
   * REGISTER: Register a searchable entity provided by a plugin.
   * If an entity with the same name already exists it is replaced.
   */
  registerEntity(entity: SearchableEntity): void {
    this.entities.set(entity.name, {
      ...entity,
      weight: entity.weight ?? 1,
    });
  }

  /**
   * UNREGISTER: Remove a specific entity by name.
   */
  unregisterEntity(entityName: string): boolean {
    return this.entities.delete(entityName);
  }

  /**
   * UNREGISTER BY PLUGIN: Remove all entities belonging to a plugin.
   * Typically called when a plugin is disabled or uninstalled.
   */
  unregisterByPlugin(pluginId: string): number {
    let removed = 0;
    for (const [name, entity] of this.entities) {
      if (entity.pluginId === pluginId) {
        this.entities.delete(name);
        removed++;
      }
    }
    return removed;
  }

  // ----------------------------------------------------------
  // SEARCHING
  // ----------------------------------------------------------

  /**
   * SEARCH: Execute a full-text search across all (or filtered)
   * registered entities in parallel.
   *
   * Returns scored, deduplicated, paginated results with facets.
   */
  async search(
    query: string,
    tenantId: string,
    options?: SearchOptions,
  ): Promise<SearchResponse> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
      return { results: [], total: 0, facets: {} };
    }

    // Determine which entities to query
    const targetEntities: SearchableEntity[] = [];

    for (const entity of this.entities.values()) {
      // Apply pluginId filter
      if (options?.pluginId && entity.pluginId !== options.pluginId) {
        continue;
      }
      // Apply entityType filter
      if (options?.entityType && entity.name !== options.entityType) {
        continue;
      }
      targetEntities.push(entity);
    }

    if (targetEntities.length === 0) {
      return { results: [], total: 0, facets: {} };
    }

    // Dispatch to all target entity handlers in parallel
    const entityPromises = targetEntities.map(async (entity) => {
      try {
        const rawHits = await entity.handler(normalizedQuery, tenantId, {
          ...options,
          limit: options?.limit ?? 100, // fetch more upstream for better ranking
        });
        return { entity, hits: rawHits };
      } catch (error) {
        // Graceful degradation: one plugin failure must not break the whole search
        console.error(
          `[SearchEngine] Handler error for entity "${entity.name}" ` +
          `(plugin: ${entity.pluginId}):`,
          error,
        );
        return { entity, hits: [] };
      }
    });

    const entityResults = await Promise.all(entityPromises);

    // Normalize, score, and collect all results
    const allResults: SearchResult[] = [];
    const seenKeys = new Set<string>(); // for deduplication

    for (const { entity, hits } of entityResults) {
      for (const hit of hits) {
        const id = getStringValue(hit, 'id');
        if (!id) continue; // skip hits without an id

        const dedupeKey = `${entity.name}:${id}`;
        if (seenKeys.has(dedupeKey)) continue;
        seenKeys.add(dedupeKey);

        const title = getStringValue(hit, entity.labelField) ?? 'Untitled';
        const description = entity.descriptionField
          ? getStringValue(hit, entity.descriptionField)
          : undefined;
        const href = interpolateTemplate(entity.hrefTemplate, hit);

        // Compute text relevance across all configured fields
        let fieldScore = 0;
        let maxFieldScore = 0;

        for (const field of entity.fields) {
          const fieldValue = getStringValue(hit, field);
          if (fieldValue) {
            const s = textRelevance(fieldValue, normalizedQuery);
            fieldScore += s;
            if (s > maxFieldScore) maxFieldScore = s;
          }
        }

        // Also score against the title specifically (boosted)
        const titleScore = textRelevance(title, normalizedQuery) * 1.5;

        // Final score: best field match + title bonus, multiplied by entity weight
        const score =
          (maxFieldScore + titleScore) * (entity.weight ?? 1);

        // Build metadata from any extra fields not in the core config
        const coreFields = new Set<string>([
          'id',
          entity.labelField,
          ...(entity.descriptionField ? [entity.descriptionField] : []),
        ]);
        const metadata: Record<string, any> = {};
        for (const [key, value] of Object.entries(hit)) {
          if (!coreFields.has(key) && key !== 'id') {
            metadata[key] = value;
          }
        }

        allResults.push({
          id,
          entityType: entity.name,
          entityName: this.formatEntityLabel(entity.name),
          pluginId: entity.pluginId,
          title,
          description: description ?? undefined,
          href,
          icon: entity.icon,
          score,
          metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        });
      }
    }

    // Sort by relevance score (descending)
    allResults.sort((a, b) => b.score - a.score);

    // Build facets (count per entityType across ALL results, before pagination)
    const facets: Record<string, number> = {};
    for (const result of allResults) {
      facets[result.entityType] = (facets[result.entityType] ?? 0) + 1;
    }

    // Total before pagination
    const total = allResults.length;

    // Apply pagination
    const paginatedResults = allResults.slice(offset, offset + limit);

    return {
      results: paginatedResults,
      total,
      facets,
    };
  }

  /**
   * SEARCH SINGLE: Search within a single entity type.
   * Convenience wrapper around `search()` that sets the entityType filter.
   */
  async searchSingle(
    query: string,
    tenantId: string,
    entityType: string,
    options?: Omit<SearchOptions, 'entityType'>,
  ): Promise<SearchResult[]> {
    const response = await this.search(query, tenantId, {
      ...options,
      entityType,
    });
    return response.results;
  }

  // ----------------------------------------------------------
  // METADATA
  // ----------------------------------------------------------

  /**
   * GET ENTITY TYPES: List all registered entity types.
   * Useful for building search category filters in the UI.
   */
  getEntityTypes(): EntityTypeInfo[] {
    const types: EntityTypeInfo[] = [];
    for (const entity of this.entities.values()) {
      types.push({
        name: entity.name,
        pluginId: entity.pluginId,
        label: this.formatEntityLabel(entity.name),
      });
    }
    return types;
  }

  /**
   * GET STATS: Return summary statistics about the engine state.
   */
  getStats(): SearchEngineStats {
    const plugins = new Set<string>();
    const entityTypes: string[] = [];

    for (const entity of this.entities.values()) {
      plugins.add(entity.pluginId);
      entityTypes.push(entity.name);
    }

    return {
      totalEntities: this.entities.size,
      totalPlugins: plugins.size,
      entityTypes,
    };
  }

  // ----------------------------------------------------------
  // INTERNAL
  // ----------------------------------------------------------

  /**
   * Format an entity machine-name into a human-readable label.
   * e.g. "sales-orders" → "Sales Orders"
   */
  private formatEntityLabel(name: string): string {
    return name
      .split(/[-_]/)
      .map((segment) =>
        segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase(),
      )
      .join(' ');
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: SearchEngine | null = null;

/**
 * Returns the singleton SearchEngine instance.
 * Safe to call multiple times — always returns the same object.
 */
export function getSearchEngine(): SearchEngine {
  if (!_instance) {
    _instance = new SearchEngine();
  }
  return _instance;
}

/**
 * Reset the singleton (for testing).
 * Not intended for production use.
 */
export function resetSearchEngine(): void {
  _instance = null;
}
