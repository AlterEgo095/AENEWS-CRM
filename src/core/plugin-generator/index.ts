// =============================================================================
// AENEWS Enterprise OS — PHASE OMEGA
// Plugin Generator
// AI-powered plugin generation from natural language descriptions.
// Uses intelligent keyword matching and scoring to extract domain, entities,
// features, and produces a complete plugin specification.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input to the generator — a natural language description of the desired plugin. */
export interface GeneratorInput {
  description: string;
  domain?: string;
  features?: string[];
  language?: string;
}

/** Full output of the generation process. */
export interface GeneratorOutput {
  manifest: Record<string, unknown>;
  schema: Record<string, unknown>;
  entities: string[];
  suggestedTools: string[];
  suggestedWorkflows: string[];
  suggestedDashboards: string[];
  suggestedPermissions: string[];
  completeness: number;
}

/** Template used for generating plugin manifests. */
export interface GenerationTemplate {
  name: string;
  slug: string;
  version: string;
  id: string;
  description: string;
  author: string;
  capabilities: string[];
  menus: string[];
  permissions: string[];
  events: string[];
  entities: string[];
  settings: string[];
}

/** Stats returned by the generator. */
export interface GeneratorStats {
  totalGenerated: number;
  byDomain: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Domain Knowledge — keyword maps for intelligent extraction
// ---------------------------------------------------------------------------

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  'crm': ['contact', 'customer', 'lead', 'deal', 'pipeline', 'account', 'crm', 'sales', 'prospect'],
  'ecommerce': ['product', 'cart', 'order', 'checkout', 'inventory', 'shipping', 'payment', 'store', 'shop', 'catalog', 'ecommerce', 'e-commerce'],
  'hr': ['employee', 'department', 'payroll', 'leave', 'attendance', 'recruitment', 'onboarding', 'performance', 'hr', 'human resource', 'talent'],
  'finance': ['invoice', 'expense', 'budget', 'tax', 'accounting', 'ledger', 'revenue', 'cost', 'profit', 'finance', 'billing', 'payment'],
  'project': ['project', 'task', 'sprint', 'milestone', 'kanban', 'board', 'assignment', 'deadline', 'timesheet', 'backlog'],
  'marketing': ['campaign', 'audience', 'segment', 'analytics', 'email', 'social', 'content', 'newsletter', 'marketing', 'promotion', 'funnel'],
  'support': ['ticket', 'issue', 'bug', 'resolution', 'faq', 'knowledge base', 'chat', 'helpdesk', 'support', 'sla'],
  'inventory': ['stock', 'warehouse', 'sku', 'supplier', 'reorder', 'fulfillment', 'inventory', 'shipment'],
  'analytics': ['dashboard', 'report', 'chart', 'metric', 'kpi', 'visualization', 'analytics', 'insight', 'trend'],
  'communication': ['message', 'notification', 'chat', 'channel', 'thread', 'mention', 'communication', 'broadcast'],
  'content': ['article', 'page', 'blog', 'media', 'asset', 'document', 'content', 'cms', 'editorial', 'publish'],
};

const ENTITY_PATTERNS: Record<string, string[]> = {
  'contact': ['contact', 'person', 'customer', 'client', 'user'],
  'company': ['company', 'organization', 'account', 'business', 'enterprise', 'firm'],
  'product': ['product', 'item', 'goods', 'merchandise', 'commodity'],
  'order': ['order', 'purchase', 'transaction', 'sale'],
  'invoice': ['invoice', 'bill', 'receipt', 'voucher'],
  'task': ['task', 'todo', 'assignment', 'action item', 'work item'],
  'project': ['project', 'initiative', 'program', 'endeavor'],
  'ticket': ['ticket', 'issue', 'request', 'case'],
  'employee': ['employee', 'staff', 'worker', 'team member'],
  'document': ['document', 'file', 'attachment', 'record'],
  'campaign': ['campaign', 'promotion', 'drive', 'initiative'],
  'report': ['report', 'analysis', 'summary', 'brief'],
};

const COMMON_FIELDS: Record<string, Array<{ name: string; type: string }>> = {
  'contact': [
    { name: 'firstName', type: 'string' },
    { name: 'lastName', type: 'string' },
    { name: 'email', type: 'string' },
    { name: 'phone', type: 'string' },
    { name: 'company', type: 'string' },
    { name: 'title', type: 'string' },
    { name: 'status', type: 'enum:active,inactive,archived' },
    { name: 'tags', type: 'string[]' },
    { name: 'notes', type: 'text' },
    { name: 'createdAt', type: 'datetime' },
    { name: 'updatedAt', type: 'datetime' },
  ],
  'company': [
    { name: 'name', type: 'string' },
    { name: 'industry', type: 'string' },
    { name: 'website', type: 'string' },
    { name: 'size', type: 'enum:1-10,11-50,51-200,201-1000,1000+' },
    { name: 'revenue', type: 'decimal' },
    { name: 'address', type: 'json' },
    { name: 'status', type: 'enum:active,inactive' },
    { name: 'createdAt', type: 'datetime' },
  ],
  'product': [
    { name: 'name', type: 'string' },
    { name: 'sku', type: 'string' },
    { name: 'description', type: 'text' },
    { name: 'price', type: 'decimal' },
    { name: 'category', type: 'string' },
    { name: 'stock', type: 'integer' },
    { name: 'status', type: 'enum:active,draft,archived' },
    { name: 'imageUrl', type: 'string' },
    { name: 'createdAt', type: 'datetime' },
    { name: 'updatedAt', type: 'datetime' },
  ],
  'order': [
    { name: 'orderNumber', type: 'string' },
    { name: 'customer', type: 'reference:contact' },
    { name: 'items', type: 'json' },
    { name: 'total', type: 'decimal' },
    { name: 'status', type: 'enum:pending,confirmed,shipped,delivered,cancelled' },
    { name: 'orderDate', type: 'datetime' },
    { name: 'shippingAddress', type: 'json' },
  ],
  'task': [
    { name: 'title', type: 'string' },
    { name: 'description', type: 'text' },
    { name: 'assignee', type: 'reference:contact' },
    { name: 'status', type: 'enum:todo,in_progress,done,blocked' },
    { name: 'priority', type: 'enum:low,medium,high,critical' },
    { name: 'dueDate', type: 'datetime' },
    { name: 'project', type: 'reference:project' },
    { name: 'createdAt', type: 'datetime' },
    { name: 'updatedAt', type: 'datetime' },
  ],
  'ticket': [
    { name: 'subject', type: 'string' },
    { name: 'description', type: 'text' },
    { name: 'status', type: 'enum:open,in_progress,resolved,closed' },
    { name: 'priority', type: 'enum:low,medium,high,urgent' },
    { name: 'reporter', type: 'reference:contact' },
    { name: 'assignee', type: 'reference:contact' },
    { name: 'category', type: 'string' },
    { name: 'resolution', type: 'text' },
    { name: 'createdAt', type: 'datetime' },
    { name: 'resolvedAt', type: 'datetime' },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Scores each domain against the input tokens using keyword overlap.
 * Returns domains sorted by score (highest first).
 */
function scoreDomains(tokens: string[]): Array<{ domain: string; score: number }> {
  const results: Array<{ domain: string; score: number }> = [];

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    const keywordSet = new Set(keywords);
    let matches = 0;
    for (const t of tokens) {
      if (keywordSet.has(t)) matches++;
    }
    const score = keywords.length > 0 ? matches / keywords.length : 0;
    results.push({ domain, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Scores each entity type against the input tokens.
 * Returns entities sorted by score (highest first).
 */
function scoreEntities(tokens: string[]): Array<{ entity: string; score: number }> {
  const results: Array<{ entity: string; score: number }> = [];

  for (const [entity, keywords] of Object.entries(ENTITY_PATTERNS)) {
    const keywordSet = new Set(keywords);
    let matches = 0;
    for (const t of tokens) {
      if (keywordSet.has(t)) matches++;
    }
    const score = keywords.length > 0 ? matches / keywords.length : 0;
    results.push({ entity, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

// ---------------------------------------------------------------------------
// PluginGenerator
// ---------------------------------------------------------------------------

export class PluginGenerator {
  /** Running statistics. */
  private _totalGenerated = 0;
  private _byDomain: Record<string, number> = {};

  constructor() {
    console.log('[PluginGenerator] Initialized — PHASE OMEGA Auto-Generation');
  }

  // ---- Public API ----------------------------------------------------------

  /**
   * Generates a complete plugin specification from a natural language
   * description. Uses keyword scoring to extract domain, entities, and
   * features, then produces manifest, schema, tools, workflows, dashboards,
   * and permissions.
   */
  generate(input: GeneratorInput): GeneratorOutput {
    const tokens = tokenize(input.description);
    const domainScores = scoreDomains(tokens);
    const entityScores = scoreEntities(tokens);

    // Determine domain
    const detectedDomain = domainScores[0]?.score ?? 0 > 0
      ? domainScores[0]!.domain
      : input.domain ?? 'general';

    // Determine entities (score > 0)
    const entities = entityScores
      .filter((e) => e.score > 0)
      .slice(0, 5)
      .map((e) => e.entity);

    // If user specified features, use them; otherwise extract from description
    const features = input.features ?? this._extractFeatures(tokens);

    // Generate all outputs
    const template = this._buildTemplate(input, detectedDomain, entities, features);
    const manifest = this.generateManifest(template);
    const schema = this.generateSchema(entities);
    const suggestedTools = this._generateToolNames(detectedDomain, entities);
    const suggestedWorkflows = this._generateWorkflowNames(detectedDomain, entities);
    const suggestedDashboards = this._generateDashboardNames(detectedDomain, entities);
    const suggestedPermissions = this.generatePermissions(features);

    // Compute completeness score
    const completeness = this._computeCompleteness(manifest, schema, entities, features);

    // Update stats
    this._totalGenerated++;
    this._byDomain[detectedDomain] = (this._byDomain[detectedDomain] ?? 0) + 1;

    console.log(
      `[PluginGenerator] Generated "${template.name}" (domain: ${detectedDomain}, entities: ${entities.length}, tools: ${suggestedTools.length}, completeness: ${Math.round(completeness * 100)}%)`
    );

    return {
      manifest,
      schema,
      entities,
      suggestedTools,
      suggestedWorkflows,
      suggestedDashboards,
      suggestedPermissions,
      completeness,
    };
  }

  /**
   * Generates a plugin.json manifest from a GenerationTemplate.
   */
  generateManifest(template: GenerationTemplate): Record<string, unknown> {
    const manifest: Record<string, unknown> = {
      name: template.name,
      id: template.id,
      version: template.version,
      description: template.description,
      author: template.author,
      slug: template.slug,
      capabilities: template.capabilities,
      menus: template.menus,
      permissions: template.permissions,
      events: template.events,
      entities: template.entities,
      settings: template.settings,
      compatibility: '1.0.0',
      engine: 'phase-omega',
    };

    console.log(`[PluginGenerator] Manifest generated: ${template.id}@${template.version}`);
    return manifest;
  }

  /**
   * Generates schema definitions for the given entity types.
   * Each entity gets its standard fields from COMMON_FIELDS.
   */
  generateSchema(entities: string[]): Record<string, unknown> {
    const schema: Record<string, unknown> = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      entities: {},
    };

    const entitiesMap = schema.entities as Record<string, unknown>;

    for (const entity of entities) {
      const fields = COMMON_FIELDS[entity];
      if (fields) {
        entitiesMap[entity] = {
          name: entity,
          tableName: `${entity}s`,
          fields: fields.map((f) => ({
            name: f.name,
            type: f.type,
            required: ['id', 'createdAt', 'updatedAt'].includes(f.name),
            indexed: ['id', 'status', 'email', 'name'].includes(f.name),
          })),
          relations: this._generateRelations(entity, entities),
        };
      } else {
        // Generic entity with basic fields
        entitiesMap[entity] = {
          name: entity,
          tableName: `${entity}s`,
          fields: [
            { name: 'id', type: 'string', required: true, indexed: true },
            { name: 'name', type: 'string', required: true },
            { name: 'description', type: 'text', required: false },
            { name: 'status', type: 'enum:active,inactive,archived', required: false },
            { name: 'createdAt', type: 'datetime', required: true },
            { name: 'updatedAt', type: 'datetime', required: true },
          ],
          relations: [],
        };
      }
    }

    console.log(`[PluginGenerator] Schema generated: ${entities.length} entity definition(s)`);
    return schema;
  }

  /**
   * Generates permission IDs from a list of features.
   * Each feature gets read, create, update, delete, and manage permissions.
   */
  generatePermissions(features: string[]): string[] {
    const permissions: string[] = [];

    const actions = ['read', 'create', 'update', 'delete', 'manage'];

    for (const feature of features) {
      const slug = slugify(feature);
      for (const action of actions) {
        permissions.push(`${slug}:${action}`);
      }
    }

    // Add global permissions
    permissions.push('plugin:access');
    permissions.push('plugin:configure');
    permissions.push('plugin:admin');

    console.log(`[PluginGenerator] Permissions generated: ${permissions.length} from ${features.length} feature(s)`);
    return permissions;
  }

  /**
   * Generates default settings configuration for a given domain.
   */
  generateSettings(domain: string): Record<string, unknown>[] {
    const commonSettings: Record<string, unknown>[] = [
      {
        key: 'enabled',
        label: 'Enable Plugin',
        type: 'boolean',
        defaultValue: true,
        description: 'Whether this plugin is active',
      },
      {
        key: 'pageSize',
        label: 'Page Size',
        type: 'number',
        defaultValue: 25,
        description: 'Number of items per page in lists',
      },
    ];

    const domainSettings: Record<string, Record<string, unknown>[]> = {
      crm: [
        { key: 'defaultPipeline', label: 'Default Pipeline', type: 'string', defaultValue: 'Sales Pipeline', description: 'Default sales pipeline for new deals' },
        { key: 'autoAssign', label: 'Auto-assign Leads', type: 'boolean', defaultValue: true, description: 'Automatically assign leads to sales reps' },
      ],
      ecommerce: [
        { key: 'currency', label: 'Currency', type: 'string', defaultValue: 'USD', description: 'Default currency for prices' },
        { key: 'taxRate', label: 'Tax Rate (%)', type: 'number', defaultValue: 10, description: 'Default tax rate' },
      ],
      hr: [
        { key: 'fiscalYearStart', label: 'Fiscal Year Start', type: 'string', defaultValue: '01-01', description: 'Start date of fiscal year' },
        { key: 'leaveAccrual', label: 'Leave Accrual', type: 'boolean', defaultValue: true, description: 'Enable automatic leave accrual' },
      ],
      finance: [
        { key: 'fiscalYear', label: 'Fiscal Year', type: 'string', defaultValue: new Date().getFullYear().toString(), description: 'Current fiscal year' },
        { key: 'autoInvoice', label: 'Auto-generate Invoices', type: 'boolean', defaultValue: false, description: 'Automatically generate invoices for orders' },
      ],
      project: [
        { key: 'defaultSprintDuration', label: 'Default Sprint Duration (days)', type: 'number', defaultValue: 14, description: 'Default sprint length' },
        { key: 'autoArchiveCompleted', label: 'Auto-archive Completed', type: 'boolean', defaultValue: false, description: 'Auto-archive completed projects' },
      ],
      support: [
        { key: 'autoCloseDays', label: 'Auto-close After (days)', type: 'number', defaultValue: 7, description: 'Auto-close resolved tickets after N days' },
        { key: 'priorityRules', label: 'Priority Rules', type: 'boolean', defaultValue: true, description: 'Enable priority-based routing' },
      ],
      marketing: [
        { key: 'defaultSender', label: 'Default Sender Email', type: 'string', defaultValue: '', description: 'Default sender email for campaigns' },
        { key: 'trackOpens', label: 'Track Email Opens', type: 'boolean', defaultValue: true, description: 'Track email open rates' },
      ],
    };

    const settings = [
      ...commonSettings,
      ...(domainSettings[domain] ?? []),
      {
        key: 'notifications',
        label: 'Enable Notifications',
        type: 'boolean',
        defaultValue: true,
        description: 'Enable plugin notifications',
      },
    ];

    console.log(`[PluginGenerator] Settings generated: ${settings.length} for domain "${domain}"`);
    return settings;
  }

  /**
   * Generates capabilities from a list of features.
   */
  generateCapabilities(features: string[]): Array<{ type: string; name: string; description: string }> {
    const capabilities: Array<{ type: string; name: string; description: string }> = [];

    for (const feature of features) {
      const slug = slugify(feature);

      capabilities.push({
        type: 'entity',
        name: `${feature} Management`,
        description: `Create, read, update, and delete ${feature.toLowerCase()} records`,
      });

      capabilities.push({
        type: 'tool',
        name: `${feature} Search`,
        description: `Search and filter ${feature.toLowerCase()} records`,
      });

      capabilities.push({
        type: 'tool',
        name: `Export ${feature}`,
        description: `Export ${feature.toLowerCase()} data to CSV or JSON`,
      });

      capabilities.push({
        type: 'dashboard',
        name: `${feature} Dashboard`,
        description: `Overview dashboard for ${feature.toLowerCase()} with key metrics`,
      });

      capabilities.push({
        type: 'workflow',
        name: `${feature} Lifecycle`,
        description: `Manage the full lifecycle of ${feature.toLowerCase()} records`,
      });
    }

    // Add standard capabilities
    capabilities.push(
      { type: 'tool', name: 'Bulk Operations', description: 'Perform bulk actions on records' },
      { type: 'tool', name: 'Audit Log', description: 'View audit history for all operations' },
      { type: 'workflow', name: 'Notification Workflow', description: 'Send notifications on important events' }
    );

    console.log(`[PluginGenerator] Capabilities generated: ${capabilities.length} from ${features.length} feature(s)`);
    return capabilities;
  }

  /**
   * Estimates the complexity of generating a plugin from the given input.
   */
  estimateComplexity(input: GeneratorInput): { entities: number; fields: number; workflows: number; tools: number } {
    const tokens = tokenize(input.description);
    const entityScores = scoreEntities(tokens);
    const features = input.features ?? this._extractFeatures(tokens);

    const entities = entityScores.filter((e) => e.score > 0).slice(0, 5).length;

    let fields = 0;
    for (const e of entityScores.filter((e) => e.score > 0).slice(0, 5)) {
      fields += COMMON_FIELDS[e.entity]?.length ?? 6;
    }

    const workflows = Math.max(1, Math.ceil(features.length / 3));
    const tools = features.length * 2 + 2;

    return { entities, fields, workflows, tools };
  }

  /** Returns generator statistics. */
  getStats(): GeneratorStats {
    return {
      totalGenerated: this._totalGenerated,
      byDomain: { ...this._byDomain },
    };
  }

  // ---- Private helpers -----------------------------------------------------

  /**
   * Extracts feature names from description tokens by looking for
   * action-noun patterns and known feature keywords.
   */
  private _extractFeatures(tokens: string[]): string[] {
    const actionWords = new Set(['manage', 'create', 'track', 'monitor', 'report', 'analyze', 'configure', 'control', 'automate', 'handle', 'process', 'send', 'receive', 'schedule', 'generate', 'import', 'export']);

    const features: string[] = [];
    const seen = new Set<string>();

    // Look for action + noun patterns in consecutive tokens
    for (let i = 0; i < tokens.length - 1; i++) {
      if (actionWords.has(tokens[i])) {
        const feature = `${tokens[i]} ${tokens[i + 1]}`;
        const key = slugify(feature);
        if (!seen.has(key)) {
          features.push(feature);
          seen.add(key);
        }
      }
    }

    // Also extract standalone nouns that match entity patterns
    for (const [entity, keywords] of Object.entries(ENTITY_PATTERNS)) {
      const kwSet = new Set(keywords);
      for (const t of tokens) {
        if (kwSet.has(t) && !seen.has(entity)) {
          features.push(`${entity} management`);
          seen.add(entity);
          break;
        }
      }
    }

    return features.length > 0 ? features : ['Basic Management'];
  }

  /** Builds a GenerationTemplate from input + detected domain/entities/features. */
  private _buildTemplate(input: GeneratorInput, domain: string, entities: string[], features: string[]): GenerationTemplate {
    const name = this._extractName(input.description) ?? `${domain.charAt(0).toUpperCase() + domain.slice(1)} Plugin`;
    const slug = slugify(name);
    const id = slug;

    return {
      name,
      slug,
      version: '1.0.0',
      id,
      description: input.description,
      author: 'AENEWS Generator',
      capabilities: this.generateCapabilities(features).map((c) => `${c.type}:${slugify(c.name)}`),
      menus: [
        { label: name, path: `/${slug}`, icon: 'Package' },
        { label: `${name} Dashboard`, path: `/${slug}/dashboard`, icon: 'BarChart3' },
        ...entities.slice(0, 4).map((e) => ({
          label: e.charAt(0).toUpperCase() + e.slice(1) + 's',
          path: `/${slug}/${e}s`,
          icon: 'List',
        })),
      ].map((m) => JSON.stringify(m)),
      permissions: this.generatePermissions(features),
      events: [
        `${slug}:created`,
        `${slug}:updated`,
        `${slug}:deleted`,
        `${slug}:status_changed`,
      ],
      entities,
      settings: this.generateSettings(domain).map((s) => String(s.key)),
    };
  }

  /** Attempts to extract a plugin name from the description. */
  private _extractName(description: string): string | null {
    // Try to find quoted or title-case phrases
    const quoted = description.match(/"([^"]+)"/);
    if (quoted) return quoted[1];

    // Try to find a phrase that looks like a title (words starting with capitals)
    const titleMatch = description.match(/(?:for|called|named)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
    if (titleMatch) return titleMatch[1];

    // Use first meaningful phrase
    const words = description.split(/\s+/).slice(0, 4).filter((w) => w.length > 2);
    if (words.length >= 2) {
      return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }

    return null;
  }

  /** Generates tool name suggestions for a domain and entities. */
  private _generateToolNames(domain: string, entities: string[]): string[] {
    const tools: string[] = [];

    for (const entity of entities) {
      const name = entity.charAt(0).toUpperCase() + entity.slice(1);
      tools.push(`${name} Search`);
      tools.push(`Create ${name}`);
      tools.push(`Update ${name}`);
      tools.push(`Delete ${name}`);
      tools.push(`Export ${name}s`);
    }

    tools.push(`${domain.charAt(0).toUpperCase() + domain.slice(1)} Analytics`);
    tools.push('Bulk Import');
    tools.push('Generate Report');

    return [...new Set(tools)];
  }

  /** Generates workflow name suggestions. */
  private _generateWorkflowNames(domain: string, entities: string[]): string[] {
    const workflows: string[] = [];

    for (const entity of entities) {
      const name = entity.charAt(0).toUpperCase() + entity.slice(1);
      workflows.push(`${name} Approval Workflow`);
      workflows.push(`${name} Notification Workflow`);
    }

    workflows.push(`${domain.charAt(0).toUpperCase() + domain.slice(1)} Onboarding Workflow`);
    workflows.push('Data Cleanup Workflow');

    return [...new Set(workflows)];
  }

  /** Generates dashboard name suggestions. */
  private _generateDashboardNames(domain: string, entities: string[]): string[] {
    const dashboards: string[] = [
      `${domain.charAt(0).toUpperCase() + domain.slice(1)} Overview`,
      'Activity Feed',
      'Recent Changes',
    ];

    for (const entity of entities.slice(0, 2)) {
      const name = entity.charAt(0).toUpperCase() + entity.slice(1);
      dashboards.push(`${name} Analytics`);
    }

    return dashboards;
  }

  /** Generates relations between entities. */
  private _generateRelations(entity: string, allEntities: string[]): Array<{ target: string; type: string; field: string }> {
    const relations: Array<{ target: string; type: string; field: string }> = [];

    for (const other of allEntities) {
      if (other === entity) continue;

      // Define sensible relations
      const relationMap: Record<string, Array<{ target: string; type: string }>> = {
        contact: [
          { target: 'company', type: 'many-to-one' },
          { target: 'order', type: 'one-to-many' },
          { target: 'ticket', type: 'one-to-many' },
          { target: 'task', type: 'one-to-many' },
        ],
        company: [
          { target: 'contact', type: 'one-to-many' },
        ],
        order: [
          { target: 'contact', type: 'many-to-one' },
          { target: 'product', type: 'many-to-many' },
          { target: 'invoice', type: 'one-to-one' },
        ],
        task: [
          { target: 'contact', type: 'many-to-one' },
          { target: 'project', type: 'many-to-one' },
        ],
        ticket: [
          { target: 'contact', type: 'many-to-one' },
        ],
      };

      const entityRelations = relationMap[entity];
      if (entityRelations) {
        for (const rel of entityRelations) {
          if (rel.target === other) {
            relations.push({
              target: other,
              type: rel.type,
              field: `${other}Id`,
            });
          }
        }
      }
    }

    return relations;
  }

  /** Computes a completeness score (0-1) based on what was generated. */
  private _computeCompleteness(
    manifest: Record<string, unknown>,
    schema: Record<string, unknown>,
    entities: string[],
    features: string[]
  ): number {
    let score = 0;
    const total = 6;

    if (manifest.id) score++;
    if (manifest.version) score++;
    if (manifest.capabilities && (manifest.capabilities as string[]).length > 0) score++;
    if (schema.entities && Object.keys(schema.entities as object).length > 0) score++;
    if (entities.length > 0) score++;
    if (features.length > 0) score++;

    // Bonus for richness
    if (entities.length >= 3) score += 0.2;
    if (features.length >= 3) score += 0.2;
    if ((manifest.capabilities as string[]).length >= 5) score += 0.2;

    return Math.min(1, score / total);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: PluginGenerator | null = null;

/** Returns the singleton PluginGenerator instance. */
export function getPluginGenerator(): PluginGenerator {
  if (!_instance) {
    _instance = new PluginGenerator();
  }
  return _instance;
}

/** Resets the singleton — useful for testing. */
export function resetPluginGenerator(): void {
  _instance = null;
  console.log('[PluginGenerator] Singleton reset');
}