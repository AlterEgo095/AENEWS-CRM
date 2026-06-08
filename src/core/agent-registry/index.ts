// ============================================================
// AENEWS Enterprise OS — Agent Registry
// ============================================================
// Central registry where plugins register AI agents.
// The AI Gateway orchestrates all registered agents —
// plugins expose agents, the central AI discovers and
// delegates to them.
//
// Architecture:
//   Plugin → registerAgent()
//   AgentRegistry → stores agent definitions
//   AI Gateway → queries registry → discovers agents → orchestrates
//
// Each agent has:
//   - Identity (name, description, pluginId)
//   - Capabilities (what it can do)
//   - Tools (which tools it has access to)
//   - Knowledge (which knowledge bases it references)
//   - Configuration (model, temperature, system prompt)
//   - Status (active/inactive)
// ============================================================

// ============================================================
// Types
// ============================================================

export type AgentStatus = 'active' | 'inactive' | 'error';

export interface AgentDefinition {
  /** Unique identifier, e.g. "crm.contact-agent" */
  id: string;
  /** Plugin that owns this agent */
  pluginId: string;
  /** Human-readable name */
  name: string;
  /** Description of what this agent does */
  description: string;
  /** Category for grouping (e.g. "crm", "finance", "hr") */
  category?: string;
  /** Icon for UI display */
  icon?: string;
  /** System prompt that defines the agent's personality and role */
  systemPrompt: string;
  /** IDs of tools this agent can use (from ToolRegistry) */
  tools?: string[];
  /** IDs of capabilities this agent can invoke */
  capabilities?: string[];
  /** IDs of knowledge bases this agent references */
  knowledge?: string[];
  /** Language model to use (overrides gateway default) */
  model?: string;
  /** Temperature for model responses */
  temperature?: number;
  /** Max tokens for responses */
  maxTokens?: number;
  /** Permissions required to interact with this agent */
  permissions?: string[];
  /** Tags for discovery */
  tags?: string[];
  /** Agent version */
  version?: string;
  /** Custom configuration */
  config?: Record<string, unknown>;
}

export interface AgentExecutionResult {
  success: boolean;
  response?: string;
  error?: string;
  agentId: string;
  durationMs: number;
  toolCalls?: Array<{
    toolName: string;
    arguments: Record<string, unknown>;
    result: unknown;
  }>;
}

export interface AgentRegistryStats {
  total: number;
  active: number;
  byCategory: Record<string, number>;
  byPlugin: Record<string, number>;
}

// ============================================================
// Agent Registry
// ============================================================

export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();
  private statuses: Map<string, AgentStatus> = new Map();
  private pluginIndex: Map<string, Set<string>> = new Map();
  private categoryIndex: Map<string, Set<string>> = new Map();

  constructor() {
    console.log('[AgentRegistry] Initialized');
  }

  // ============================================================
  // Registration
  // ============================================================

  /**
   * Register a new AI agent.
   */
  register(agent: AgentDefinition): void {
    this.validateAgent(agent);

    if (this.agents.has(agent.id)) {
      console.warn(`[AgentRegistry] Agent "${agent.id}" is being overwritten.`);
    }

    this.agents.set(agent.id, agent);
    this.statuses.set(agent.id, 'active');

    // Update plugin index
    if (!this.pluginIndex.has(agent.pluginId)) {
      this.pluginIndex.set(agent.pluginId, new Set());
    }
    this.pluginIndex.get(agent.pluginId)!.add(agent.id);

    // Update category index
    const category = agent.category || 'general';
    if (!this.categoryIndex.has(category)) {
      this.categoryIndex.set(category, new Set());
    }
    this.categoryIndex.get(category)!.add(agent.id);

    console.log(
      `[AgentRegistry] Registered agent "${agent.id}" (plugin: ${agent.pluginId}, category: ${category})`,
    );
  }

  // ============================================================
  // Unregistration
  // ============================================================

  /**
   * Unregister a single agent by ID.
   */
  unregister(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) {
      console.warn(`[AgentRegistry] Cannot unregister "${agentId}": not found`);
      return;
    }

    this.removeFromIndices(agent);
    this.agents.delete(agentId);
    this.statuses.delete(agentId);

    console.log(`[AgentRegistry] Unregistered agent "${agentId}"`);
  }

  /**
   * Unregister all agents for a plugin.
   */
  unregisterByPlugin(pluginId: string): void {
    const agentIds = this.pluginIndex.get(pluginId);
    if (!agentIds || agentIds.size === 0) return;

    for (const agentId of agentIds) {
      const agent = this.agents.get(agentId);
      if (agent) {
        this.removeFromIndices(agent);
        this.agents.delete(agentId);
        this.statuses.delete(agentId);
      }
    }

    this.pluginIndex.delete(pluginId);
    console.log(`[AgentRegistry] Unregistered all agents for plugin "${pluginId}"`);
  }

  // ============================================================
  // Getters
  // ============================================================

  get(agentId: string): AgentDefinition | undefined {
    return this.agents.get(agentId);
  }

  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  getActive(): AgentDefinition[] {
    return this.getAll().filter((a) => this.statuses.get(a.id) === 'active');
  }

  getByPlugin(pluginId: string): AgentDefinition[] {
    const ids = this.pluginIndex.get(pluginId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.agents.get(id))
      .filter(Boolean) as AgentDefinition[];
  }

  getByCategory(category: string): AgentDefinition[] {
    const ids = this.categoryIndex.get(category);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.agents.get(id))
      .filter(Boolean) as AgentDefinition[];
  }

  /**
   * Discover agents by query text (for AI-driven agent selection).
   */
  discover(query: string): AgentDefinition[] {
    const normalized = query.toLowerCase().trim();
    const words = normalized.split(/\s+/);

    interface Scored {
      agent: AgentDefinition;
      score: number;
    }

    const scored: Scored[] = [];

    for (const agent of this.agents.values()) {
      if (this.statuses.get(agent.id) !== 'active') continue;

      let score = 0;

      if (agent.id.toLowerCase().includes(normalized)) score += 500;
      if (agent.name.toLowerCase().includes(normalized)) score += 300;
      if (agent.name.toLowerCase().startsWith(normalized)) score += 200;

      const descLower = agent.description.toLowerCase();
      for (const word of words) {
        if (agent.name.toLowerCase().includes(word)) score += 50;
        if (descLower.includes(word)) score += 20;
      }

      if (agent.category && agent.category.toLowerCase().includes(normalized)) score += 100;

      if (agent.tags) {
        for (const tag of agent.tags) {
          if (tag.toLowerCase().includes(normalized)) score += 40;
        }
      }

      if (score > 0) scored.push({ agent, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.agent);
  }

  /**
   * Get agents that have access to a specific tool.
   */
  getAgentsWithTool(toolId: string): AgentDefinition[] {
    return this.getActive().filter((a) => a.tools?.includes(toolId));
  }

  /**
   * Get agents that have a specific capability.
   */
  getAgentsWithCapability(capabilityId: string): AgentDefinition[] {
    return this.getActive().filter((a) => a.capabilities?.includes(capabilityId));
  }

  // ============================================================
  // Status Management
  // ============================================================

  getStatus(agentId: string): AgentStatus | undefined {
    return this.statuses.get(agentId);
  }

  setStatus(agentId: string, status: AgentStatus): void {
    if (!this.agents.has(agentId)) return;
    this.statuses.set(agentId, status);
  }

  deactivate(agentId: string): void {
    this.setStatus(agentId, 'inactive');
  }

  activate(agentId: string): void {
    this.setStatus(agentId, 'active');
  }

  // ============================================================
  // Statistics
  // ============================================================

  getStats(): AgentRegistryStats {
    const byCategory: Record<string, number> = {};
    const byPlugin: Record<string, number> = {};
    let active = 0;

    for (const agent of this.agents.values()) {
      const category = agent.category || 'general';
      byCategory[category] = (byCategory[category] ?? 0) + 1;
      byPlugin[agent.pluginId] = (byPlugin[agent.pluginId] ?? 0) + 1;
      if (this.statuses.get(agent.id) === 'active') active++;
    }

    return { total: this.agents.size, active, byCategory, byPlugin };
  }

  has(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  get size(): number {
    return this.agents.size;
  }

  // ============================================================
  // Maintenance
  // ============================================================

  clear(): void {
    this.agents.clear();
    this.statuses.clear();
    this.pluginIndex.clear();
    this.categoryIndex.clear();
  }

  getCategories(): string[] {
    return Array.from(this.categoryIndex.keys()).sort();
  }

  // ============================================================
  // Internal
  // ============================================================

  private validateAgent(agent: AgentDefinition): void {
    if (!agent.id || typeof agent.id !== 'string') {
      throw new Error('Agent must have a non-empty string "id"');
    }
    if (!agent.pluginId || typeof agent.pluginId !== 'string') {
      throw new Error('Agent must have a non-empty "pluginId"');
    }
    if (!agent.name || typeof agent.name !== 'string') {
      throw new Error('Agent must have a non-empty "name"');
    }
    if (!agent.description || typeof agent.description !== 'string') {
      throw new Error('Agent must have a non-empty "description"');
    }
    if (!agent.systemPrompt || typeof agent.systemPrompt !== 'string') {
      throw new Error('Agent must have a non-empty "systemPrompt"');
    }
  }

  private removeFromIndices(agent: AgentDefinition): void {
    const pluginIds = this.pluginIndex.get(agent.pluginId);
    if (pluginIds) {
      pluginIds.delete(agent.id);
      if (pluginIds.size === 0) this.pluginIndex.delete(agent.pluginId);
    }

    const category = agent.category || 'general';
    const catIds = this.categoryIndex.get(category);
    if (catIds) {
      catIds.delete(agent.id);
      if (catIds.size === 0) this.categoryIndex.delete(category);
    }
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: AgentRegistry | undefined;

export function getAgentRegistry(): AgentRegistry {
  if (!_instance) {
    _instance = new AgentRegistry();
  }
  return _instance;
}

export function resetAgentRegistry(): void {
  _instance = undefined;
}
