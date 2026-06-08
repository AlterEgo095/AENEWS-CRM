// ============================================================
// AENEWS Enterprise OS — Knowledge Registry
// ============================================================
// Central registry where plugins register domain knowledge
// that the AI can reason about.
//
// Each plugin brings its knowledge:
//   Policies, PDFs, Markdown docs, Rules, FAQ, Schemas, etc.
//
// Architecture:
//   Plugin → registerKnowledge()
//   KnowledgeRegistry → stores, indexes, searches
//   AI Gateway → queries registry → reasons on knowledge
//
// Knowledge entries are:
//   - Typed (policy, faq, schema, rule, document, glossary)
//   - Searchable (full-text search on title + content)
//   - Scoped (per plugin, per tenant)
//   - Versioned (track changes over time)
// ============================================================

// ============================================================
// Types
// ============================================================

export type KnowledgeType =
  | 'policy'
  | 'faq'
  | 'schema'
  | 'rule'
  | 'document'
  | 'glossary'
  | 'guide'
  | 'template'
  | 'custom';

export interface KnowledgeEntry {
  /** Unique identifier, e.g. "crm.knowledge.privacy-policy" */
  id: string;
  /** Plugin that owns this knowledge */
  pluginId: string;
  /** Knowledge type */
  type: KnowledgeType;
  /** Title / short name */
  title: string;
  /** Description (optional) */
  description?: string;
  /** Full content text (markdown supported) */
  content: string;
  /** Tags for categorization and search */
  tags?: string[];
  /** Keywords for AI discovery */
  keywords?: string[];
  /** Language of the content */
  language?: string;
  /** Version */
  version?: string;
  /** Whether this entry is active */
  active?: boolean;
  /** Related knowledge entry IDs */
  related?: string[];
  /** Category for grouping */
  category?: string;
  /** Metadata (arbitrary plugin-specific data) */
  metadata?: Record<string, unknown>;
  /** When this entry was last updated */
  updatedAt?: Date;
}

export interface KnowledgeSearchResult {
  entry: KnowledgeEntry;
  score: number;
  snippet?: string;
}

export interface KnowledgeRegistryStats {
  total: number;
  active: number;
  byType: Record<string, number>;
  byPlugin: Record<string, number>;
}

// ============================================================
// Knowledge Registry
// ============================================================

export class KnowledgeRegistry {
  private entries: Map<string, KnowledgeEntry> = new Map();
  private pluginIndex: Map<string, Set<string>> = new Map();
  private typeIndex: Map<KnowledgeType, Set<string>> = new Map();

  constructor() {
    console.log('[KnowledgeRegistry] Initialized');
  }

  // ============================================================
  // Registration
  // ============================================================

  /**
   * Register a knowledge entry.
   */
  register(entry: KnowledgeEntry): void {
    this.validateEntry(entry);

    if (this.entries.has(entry.id)) {
      console.warn(`[KnowledgeRegistry] Entry "${entry.id}" is being overwritten.`);
    }

    this.entries.set(entry.id, entry);

    // Plugin index
    if (!this.pluginIndex.has(entry.pluginId)) {
      this.pluginIndex.set(entry.pluginId, new Set());
    }
    this.pluginIndex.get(entry.pluginId)!.add(entry.id);

    // Type index
    if (!this.typeIndex.has(entry.type)) {
      this.typeIndex.set(entry.type, new Set());
    }
    this.typeIndex.get(entry.type)!.add(entry.id);

    console.log(
      `[KnowledgeRegistry] Registered "${entry.id}" (type: ${entry.type}, plugin: ${entry.pluginId})`,
    );
  }

  /**
   * Bulk register multiple entries from a plugin.
   */
  registerBatch(entries: KnowledgeEntry[]): void {
    for (const entry of entries) {
      this.register(entry);
    }
  }

  // ============================================================
  // Unregistration
  // ============================================================

  unregister(entryId: string): void {
    const entry = this.entries.get(entryId);
    if (!entry) return;

    this.removeFromIndices(entry);
    this.entries.delete(entryId);
  }

  unregisterByPlugin(pluginId: string): void {
    const entryIds = this.pluginIndex.get(pluginId);
    if (!entryIds || entryIds.size === 0) return;

    for (const entryId of entryIds) {
      const entry = this.entries.get(entryId);
      if (entry) {
        this.removeFromIndices(entry);
        this.entries.delete(entryId);
      }
    }

    this.pluginIndex.delete(pluginId);
  }

  // ============================================================
  // Getters
  // ============================================================

  get(entryId: string): KnowledgeEntry | undefined {
    return this.entries.get(entryId);
  }

  getAll(): KnowledgeEntry[] {
    return Array.from(this.entries.values());
  }

  getActive(): KnowledgeEntry[] {
    return this.getAll().filter((e) => e.active !== false);
  }

  getByPlugin(pluginId: string): KnowledgeEntry[] {
    const ids = this.pluginIndex.get(pluginId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.entries.get(id))
      .filter(Boolean) as KnowledgeEntry[];
  }

  getByType(type: KnowledgeType): KnowledgeEntry[] {
    const ids = this.typeIndex.get(type);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.entries.get(id))
      .filter(Boolean) as KnowledgeEntry[];
  }

  getByCategory(category: string): KnowledgeEntry[] {
    return this.getAll().filter(
      (e) => e.category?.toLowerCase() === category.toLowerCase(),
    );
  }

  // ============================================================
  // Search
  // ============================================================

  /**
   * Search knowledge entries by query.
   * Matches against title, description, content, tags, keywords, and type.
   * Returns results sorted by relevance score.
   */
  search(query: string, limit: number = 20): KnowledgeSearchResult[] {
    if (!query || query.trim().length === 0) {
      return this.getActive()
        .slice(0, limit)
        .map((entry) => ({ entry, score: 0 }));
    }

    const normalized = query.toLowerCase().trim();
    const words = normalized.split(/\s+/);

    interface Scored {
      entry: KnowledgeEntry;
      score: number;
    }

    const scored: Scored[] = [];

    for (const entry of this.entries.values()) {
      if (entry.active === false) continue;

      let score = 0;

      // ID match
      if (entry.id.toLowerCase().includes(normalized)) score += 300;

      // Title match (highest weight for knowledge)
      const titleLower = entry.title.toLowerCase();
      if (titleLower === normalized) score += 500;
      else if (titleLower.startsWith(normalized)) score += 300;
      else if (titleLower.includes(normalized)) score += 150;

      // Description match
      if (entry.description) {
        const descLower = entry.description.toLowerCase();
        for (const word of words) {
          if (descLower.includes(word)) score += 30;
        }
      }

      // Content match (lower weight since content is long)
      const contentLower = entry.content.toLowerCase();
      for (const word of words) {
        if (contentLower.includes(word)) score += 10;
      }

      // Tag match
      if (entry.tags) {
        for (const tag of entry.tags) {
          if (tag.toLowerCase().includes(normalized)) score += 60;
          for (const word of words) {
            if (tag.toLowerCase().includes(word)) score += 30;
          }
        }
      }

      // Keyword match
      if (entry.keywords) {
        for (const kw of entry.keywords) {
          if (kw.toLowerCase().includes(normalized)) score += 80;
          for (const word of words) {
            if (kw.toLowerCase().includes(word)) score += 40;
          }
        }
      }

      // Type match
      if (entry.type === normalized) score += 40;

      // Category match
      if (entry.category && entry.category.toLowerCase().includes(normalized)) score += 50;

      if (score > 0) scored.push({ entry, score });
    }

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map(({ entry, score }) => {
      // Generate snippet from content
      let snippet: string | undefined;
      if (score > 0) {
        const idx = entry.content.toLowerCase().indexOf(normalized);
        if (idx >= 0) {
          const start = Math.max(0, idx - 50);
          const end = Math.min(entry.content.length, idx + normalized.length + 100);
          snippet =
            (start > 0 ? '...' : '') +
            entry.content.slice(start, end).trim() +
            (end < entry.content.length ? '...' : '');
        }
      }

      return { entry, score, snippet };
    });
  }

  /**
   * Get knowledge entries relevant to a set of tags/categories.
   */
  getRelevant(tags: string[], categories?: string[]): KnowledgeEntry[] {
    const tagSet = new Set(tags.map((t) => t.toLowerCase()));
    const catSet = categories ? new Set(categories.map((c) => c.toLowerCase())) : null;

    return this.getActive().filter((entry) => {
      const entryTags = new Set(entry.tags?.map((t) => t.toLowerCase()) ?? []);
      const hasTag = [...tagSet].some((t) => entryTags.has(t));
      const matchesCat = catSet ? catSet.has(entry.category?.toLowerCase() || '') : true;
      return hasTag || matchesCat;
    });
  }

  // ============================================================
  // Statistics
  // ============================================================

  getStats(): KnowledgeRegistryStats {
    const byType: Record<string, number> = {};
    const byPlugin: Record<string, number> = {};
    let active = 0;

    for (const entry of this.entries.values()) {
      byType[entry.type] = (byType[entry.type] ?? 0) + 1;
      byPlugin[entry.pluginId] = (byPlugin[entry.pluginId] ?? 0) + 1;
      if (entry.active !== false) active++;
    }

    return { total: this.entries.size, active, byType, byPlugin };
  }

  has(entryId: string): boolean {
    return this.entries.has(entryId);
  }

  get size(): number {
    return this.entries.size;
  }

  // ============================================================
  // Maintenance
  // ============================================================

  clear(): void {
    this.entries.clear();
    this.pluginIndex.clear();
    this.typeIndex.clear();
  }

  // ============================================================
  // Internal
  // ============================================================

  private validateEntry(entry: KnowledgeEntry): void {
    if (!entry.id || typeof entry.id !== 'string') {
      throw new Error('Knowledge entry must have a non-empty string "id"');
    }
    if (!entry.pluginId || typeof entry.pluginId !== 'string') {
      throw new Error('Knowledge entry must have a non-empty "pluginId"');
    }
    if (!entry.title || typeof entry.title !== 'string') {
      throw new Error('Knowledge entry must have a non-empty "title"');
    }
    if (!entry.content || typeof entry.content !== 'string') {
      throw new Error('Knowledge entry must have non-empty "content"');
    }
    const validTypes: Set<string> = new Set([
      'policy', 'faq', 'schema', 'rule', 'document', 'glossary', 'guide', 'template', 'custom',
    ]);
    if (!validTypes.has(entry.type)) {
      throw new Error(`Invalid knowledge type "${entry.type}". Must be one of: ${Array.from(validTypes).join(', ')}`);
    }
  }

  private removeFromIndices(entry: KnowledgeEntry): void {
    const pluginIds = this.pluginIndex.get(entry.pluginId);
    if (pluginIds) {
      pluginIds.delete(entry.id);
      if (pluginIds.size === 0) this.pluginIndex.delete(entry.pluginId);
    }

    const typeIds = this.typeIndex.get(entry.type);
    if (typeIds) {
      typeIds.delete(entry.id);
      if (typeIds.size === 0) this.typeIndex.delete(entry.type);
    }
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: KnowledgeRegistry | undefined;

export function getKnowledgeRegistry(): KnowledgeRegistry {
  if (!_instance) {
    _instance = new KnowledgeRegistry();
  }
  return _instance;
}

export function resetKnowledgeRegistry(): void {
  _instance = undefined;
}
