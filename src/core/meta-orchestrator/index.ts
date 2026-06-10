// =============================================================================
// AENEWS Enterprise OS — PHASE OMEGA
// AI Meta Orchestrator
// Capability-based plugin selection and routing. Knows ONLY capabilities,
// tools, knowledge, agents, schemas, policies, and builders. Contains ZERO
// business knowledge. Routes intents to the right plugins and agents.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Capability types known to the orchestrator. */
export type CapabilityType = 'tool' | 'agent' | 'workflow' | 'knowledge' | 'schema' | 'builder';

/** Input to the orchestrator's planning phase. */
export interface OrchestratorRequest {
  /** Natural language or structured intent describing what the user wants. */
  intent: string;
  /** Additional context for the request. */
  context?: Record<string, unknown>;
  /** Preferences that constrain the plan. */
  preferences?: {
    maxPlugins?: number;
    maxTools?: number;
    preferredTypes?: CapabilityType[];
  };
}

/** A single step in the execution plan. */
export interface OrchestratorStep {
  type: 'discover' | 'select' | 'route' | 'execute';
  pluginId?: string;
  toolId?: string;
  agentId?: string;
  description: string;
}

/** The full plan produced by the orchestrator. */
export interface OrchestratorPlan {
  steps: OrchestratorStep[];
  selectedPlugins: string[];
  selectedTools: string[];
  selectedAgents: string[];
  confidence: number;
  reasoning: string;
}

/** A registered capability in the system. */
interface CapabilityEntry {
  id: string;
  name: string;
  description: string;
  pluginId: string;
  type: CapabilityType;
  keywords: string[];
}

/** Stats returned by the orchestrator. */
export interface OrchestratorStats {
  plansCreated: number;
  plansExecuted: number;
  avgConfidence: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tokenize a string into lowercase words, stripping punctuation. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/**
 * Computes a simple relevance score between a query and a target,
 * based on keyword overlap (Jaccard-like) with bonus for exact matches.
 */
function relevanceScore(queryTokens: string[], targetTokens: string[]): number {
  if (queryTokens.length === 0 || targetTokens.length === 0) return 0;

  const querySet = new Set(queryTokens);
  const targetSet = new Set(targetTokens);
  let overlap = 0;

  for (const t of querySet) {
    if (targetSet.has(t)) overlap++;
  }

  // Jaccard similarity
  const union = new Set([...querySet, ...targetSet]);
  const jaccard = union.size > 0 ? overlap / union.size : 0;

  // Bonus for exact phrase match
  const queryPhrase = queryTokens.join(' ');
  const targetPhrase = targetTokens.join(' ');
  const exactBonus = targetPhrase.includes(queryPhrase) ? 0.3 : 0;

  return Math.min(1, jaccard + exactBonus);
}

// ---------------------------------------------------------------------------
// MetaOrchestrator
// ---------------------------------------------------------------------------

export class MetaOrchestrator {
  /** All registered capabilities in the system. */
  private capabilities: Map<string, CapabilityEntry> = new Map();

  /** Running statistics. */
  private _plansCreated = 0;
  private _plansExecuted = 0;
  private _totalConfidence = 0;

  constructor() {
    console.log('[MetaOrchestrator] Initialized — PHASE OMEGA Cognitive Router');
  }

  // ---- Capability Registration (internal, called by other engines) ---------

  /**
   * Registers a capability into the orchestrator's knowledge base.
   * Called by plugin engine, tool registry, agent registry, etc.
   */
  registerCapability(entry: CapabilityEntry): void {
    this.capabilities.set(entry.id, entry);
  }

  /** Removes a capability by ID. */
  unregisterCapability(id: string): void {
    this.capabilities.delete(id);
  }

  // ---- Public API ----------------------------------------------------------

  /**
   * Given an OrchestratorRequest, produces a plan that identifies the best
   * plugins, tools, and agents to fulfill the intent.
   */
  plan(request: OrchestratorRequest): OrchestratorPlan {
    const queryTokens = tokenize(request.intent);
    const maxPlugins = request.preferences?.maxPlugins ?? 5;
    const maxTools = request.preferences?.maxTools ?? 10;
    const preferredTypes = new Set(request.preferences?.preferredTypes ?? []);

    // Score all capabilities
    const scored: Array<{ entry: CapabilityEntry; score: number }> = [];

    for (const [, entry] of this.capabilities) {
      // Filter by preferred types if specified
      if (preferredTypes.size > 0 && !preferredTypes.has(entry.type)) continue;

      const entryTokens = tokenize(`${entry.name} ${entry.description} ${entry.keywords.join(' ')}`);
      const score = relevanceScore(queryTokens, entryTokens);

      if (score > 0) {
        scored.push({ entry, score });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Extract unique plugins, tools, agents
    const selectedPlugins: string[] = [];
    const selectedTools: string[] = [];
    const selectedAgents: string[] = [];
    const seenPlugins = new Set<string>();

    for (const { entry, score: _score } of scored) {
      if (selectedPlugins.length >= maxPlugins) break;

      if (!seenPlugins.has(entry.pluginId)) {
        selectedPlugins.push(entry.pluginId);
        seenPlugins.add(entry.pluginId);
      }

      if (entry.type === 'tool' && selectedTools.length < maxTools) {
        selectedTools.push(entry.id);
      }

      if (entry.type === 'agent' && selectedAgents.length < maxPlugins) {
        selectedAgents.push(entry.id);
      }
    }

    // Build steps
    const steps: OrchestratorStep[] = [];

    if (selectedPlugins.length > 0) {
      steps.push({
        type: 'discover',
        description: `Discovered ${selectedPlugins.length} relevant plugin(s): ${selectedPlugins.join(', ')}`,
      });

      for (const pluginId of selectedPlugins) {
        steps.push({
          type: 'select',
          pluginId,
          description: `Selected plugin "${pluginId}" for intent resolution`,
        });
      }
    }

    if (selectedTools.length > 0) {
      steps.push({
        type: 'route',
        description: `Routing to ${selectedTools.length} tool(s): ${selectedTools.slice(0, 3).join(', ')}${selectedTools.length > 3 ? ` +${selectedTools.length - 3} more` : ''}`,
      });

      for (const toolId of selectedTools.slice(0, 5)) {
        steps.push({
          type: 'execute',
          toolId,
          description: `Execute tool "${toolId}"`,
        });
      }
    }

    if (selectedAgents.length > 0) {
      steps.push({
        type: 'route',
        description: `Routing to agent(s): ${selectedAgents.slice(0, 3).join(', ')}`,
      });

      for (const agentId of selectedAgents.slice(0, 3)) {
        steps.push({
          type: 'execute',
          agentId,
          description: `Delegate to agent "${agentId}"`,
        });
      }
    }

    // Confidence based on best score
    const bestScore = scored.length > 0 ? scored[0]!.score : 0;
    const confidence = Math.min(1, bestScore > 0 ? 0.3 + bestScore * 0.7 : 0);

    const reasoning = scored.length > 0
      ? `Intent "${request.intent}" matched ${scored.length} capabilities. Top match: "${scored[0]!.entry.name}" (score: ${Math.round(scored[0]!.score * 100)}%).`
      : `No capabilities matched intent "${request.intent}". The system may need additional plugins.`;

    // Update stats
    this._plansCreated++;
    this._totalConfidence += confidence;

    return {
      steps: steps.length > 0 ? steps : [{ type: 'discover', description: 'No matching capabilities found' }],
      selectedPlugins,
      selectedTools,
      selectedAgents,
      confidence: Math.round(confidence * 1000) / 1000,
      reasoning,
    };
  }

  /**
   * Executes a plan step by step. Each step produces a result object.
   * In this implementation, tools and agents are simulated.
   */
  async execute(plan: OrchestratorPlan): Promise<Array<{ step: OrchestratorStep; result: unknown }>> {
    const results: Array<{ step: OrchestratorStep; result: unknown }> = [];

    for (const step of plan.steps) {
      let result: unknown;

      switch (step.type) {
        case 'discover':
          result = { status: 'discovered', description: step.description };
          break;

        case 'select':
          result = { status: 'selected', pluginId: step.pluginId };
          break;

        case 'route':
          result = { status: 'routed', toolId: step.toolId, agentId: step.agentId };
          break;

        case 'execute': {
          if (step.toolId) {
            const cap = this.capabilities.get(step.toolId);
            result = {
              status: 'executed',
              toolId: step.toolId,
              output: cap ? `Executed ${cap.name} successfully` : `Tool ${step.toolId} not found`,
            };
          } else if (step.agentId) {
            const cap = this.capabilities.get(step.agentId);
            result = {
              status: 'delegated',
              agentId: step.agentId,
              output: cap ? `Agent ${cap.name} processed the request` : `Agent ${step.agentId} not found`,
            };
          } else {
            result = { status: 'executed', description: step.description };
          }
          break;
        }

        default:
          result = { status: 'unknown', description: step.description };
      }

      results.push({ step, result });
    }

    this._plansExecuted++;
    console.log(`[MetaOrchestrator] Plan executed: ${results.length} step(s), ${plan.selectedPlugins.length} plugin(s)`);

    return results;
  }

  /**
   * Fuzzy-matches an intent to plugin capabilities and returns plugin IDs
   * sorted by relevance.
   */
  selectPluginForIntent(intent: string, capabilities: Array<{ pluginId: string; name: string; description: string; keywords?: string[] }>): string[] {
    const queryTokens = tokenize(intent);

    const scored = capabilities.map((cap) => {
      const capTokens = tokenize(`${cap.name} ${cap.description} ${(cap.keywords ?? []).join(' ')}`);
      return { pluginId: cap.pluginId, score: relevanceScore(queryTokens, capTokens) };
    });

    scored.sort((a, b) => b.score - a.score);

    // Deduplicate, filter out zero-scores
    const seen = new Set<string>();
    const result: string[] = [];
    for (const s of scored) {
      if (s.score > 0 && !seen.has(s.pluginId)) {
        result.push(s.pluginId);
        seen.add(s.pluginId);
      }
    }

    return result;
  }

  /**
   * Matches a task description to available tools and returns tool IDs
   * sorted by relevance.
   */
  selectToolForTask(task: string, tools: Array<{ id: string; name: string; description: string; keywords?: string[] }>): string[] {
    const queryTokens = tokenize(task);

    const scored = tools.map((tool) => {
      const toolTokens = tokenize(`${tool.name} ${tool.description} ${(tool.keywords ?? []).join(' ')}`);
      return { id: tool.id, score: relevanceScore(queryTokens, toolTokens) };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter((s) => s.score > 0).map((s) => s.id);
  }

  /**
   * Matches a query to agent expertise and returns agent IDs sorted by
   * relevance.
   */
  selectAgentForQuery(query: string, agents: Array<{ id: string; name: string; expertise: string; description?: string }>): string[] {
    const queryTokens = tokenize(query);

    const scored = agents.map((agent) => {
      const agentTokens = tokenize(`${agent.name} ${agent.expertise} ${agent.description ?? ''}`);
      return { id: agent.id, score: relevanceScore(queryTokens, agentTokens) };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.filter((s) => s.score > 0).map((s) => s.id);
  }

  /**
   * Returns an overview of all registered capabilities grouped by type.
   */
  getCapabilitiesOverview(): { plugins: string[]; tools: string[]; agents: string[]; workflows: string[] } {
    const plugins = new Set<string>();
    const tools: string[] = [];
    const agents: string[] = [];
    const workflows: string[] = [];

    for (const [, cap] of this.capabilities) {
      plugins.add(cap.pluginId);

      switch (cap.type) {
        case 'tool':
          tools.push(cap.id);
          break;
        case 'agent':
          agents.push(cap.id);
          break;
        case 'workflow':
          workflows.push(cap.id);
          break;
      }
    }

    return {
      plugins: Array.from(plugins),
      tools,
      agents,
      workflows,
    };
  }

  /** Returns orchestrator statistics. */
  getStats(): OrchestratorStats {
    return {
      plansCreated: this._plansCreated,
      plansExecuted: this._plansExecuted,
      avgConfidence: this._plansCreated > 0 ? Math.round((this._totalConfidence / this._plansCreated) * 1000) / 1000 : 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: MetaOrchestrator | null = null;

/** Returns the singleton MetaOrchestrator instance. */
export function getMetaOrchestrator(): MetaOrchestrator {
  if (!_instance) {
    _instance = new MetaOrchestrator();
  }
  return _instance;
}

/** Resets the singleton — useful for testing. */
export function resetMetaOrchestrator(): void {
  _instance = null;
  console.log('[MetaOrchestrator] Singleton reset');
}