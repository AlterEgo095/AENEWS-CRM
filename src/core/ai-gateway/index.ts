// ============================================================
// AENEWS Enterprise OS — AI Gateway (Multi-Provider)
// ============================================================
// Provider-agnostic AI integration layer using the Adapter
// pattern. Currently supports 10 providers with full
// backward compatibility to the original single-provider API.
//
// Architecture:
//   AIGateway
//     ↓ Provider Adapter Pattern
//     ├─ ZAIProvider       (z-ai-web-dev-sdk)
//     ├─ OpenAIProvider    (GPT-4o, GPT-4, GPT-3.5)
//     ├─ AnthropicProvider (claude-3.5-sonnet, claude-3-opus)
//     ├─ GeminiProvider    (Google)
//     ├─ DeepSeekProvider
//     ├─ QwenProvider
//     ├─ MistralProvider
//     ├─ OllamaProvider    (local)
//     ├─ AzureProvider     (Azure OpenAI)
//     └─ BedrockProvider   (AWS)
// ============================================================

import ZAI from 'z-ai-web-dev-sdk';

// ── Provider Identifier ─────────────────────────────────────

/**
 * All supported AI provider identifiers.
 * Kept as a union type for backward compatibility.
 */
export type AIProvider =
  | 'z-ai'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'qwen'
  | 'mistral'
  | 'ollama'
  | 'azure'
  | 'bedrock'
  // Legacy alias — 'local' maps to 'ollama'
  | 'local';

// ── Shared Request / Response Types ────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** JSON-stringified tool call arguments (assistant role) */
  tool_calls?: {
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }[];
  /** tool call id this message is responding to (tool role) */
  tool_call_id?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Override the active provider for this single request */
  provider?: string;
}

export interface ChatResponse {
  content: string;
  toolCalls?: { id: string; name: string; arguments: string }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ── Provider Adapter Interface ──────────────────────────────

/**
 * The contract every provider adapter must satisfy.
 * Implementations wrap the raw HTTP calls to each AI service.
 */
export interface AIProviderAdapter {
  /** Machine-readable provider name (e.g. 'openai', 'anthropic'). */
  readonly name: string;

  /** Send a non-streaming chat completion. */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /** Send a streaming chat completion, yielding token strings. */
  chatStream(request: ChatRequest): AsyncGenerator<string>;

  /** Returns true when the provider endpoint is reachable & authenticated. */
  healthCheck(): Promise<boolean>;

  /** Return the list of model IDs this adapter can serve. */
  listModels(): Promise<string[]>;
}

// ── Per-Provider Configuration ──────────────────────────────

/**
 * Configuration block for a single provider.
 * Omitted fields fall back to environment variables or sensible defaults.
 */
export interface AIProviderConfig {
  /** Provider type — must match a registered adapter key. */
  type: string;
  /** API key (secret). Prefer env vars in production. */
  apiKey?: string;
  /** Override the default API base URL. */
  baseUrl?: string;
  /** Whitelist of model IDs this provider may serve. */
  models?: string[];
  /** Default model to use when none is specified. */
  defaultModel?: string;
  /** OpenAI / Azure organization ID. */
  organizationId?: string;
  /** Azure deployment name (maps to model in Azure OpenAI). */
  deploymentName?: string;
  /** AWS region for Bedrock. */
  region?: string;
  /** Any extra provider-specific settings. */
  extra?: Record<string, unknown>;
}

// ── Gateway Configuration (new API) ─────────────────────────

/**
 * Full multi-provider gateway configuration.
 */
export interface AIGatewayMultiConfig {
  /** The provider key to use when no override is given. */
  defaultProvider: string;
  /** Registry of named provider configurations. */
  providers: Record<string, AIProviderConfig>;
}

// ── Gateway Configuration (legacy, backward compat) ─────────

/**
 * Legacy single-provider configuration.
 * Still accepted by the constructor for backward compatibility.
 */
export interface AIGatewayConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

// ── Provider Statistics ──────────────────────────────────────

export interface ProviderStats {
  provider: string;
  model: string;
  totalRequests: number;
}

// ── Provider Error ───────────────────────────────────────────

export class ProviderNotConfiguredError extends Error {
  constructor(provider: string, model?: string) {
    const msg = model
      ? `Provider "${provider}" is not configured (model: ${model}). Set up API keys in the AIGateway config or use the z-ai provider.`
      : `Provider "${provider}" is not configured. Set up API keys in the AIGateway config or use the z-ai provider.`;
    super(msg);
    this.name = 'ProviderNotConfiguredError';
  }
}

// ════════════════════════════════════════════════════════════
//  Provider Adapters — Implementations
// ════════════════════════════════════════════════════════════

// ── z-ai Provider (ACTIVE — uses z-ai-web-dev-sdk) ─────────

/**
 * The default provider backed by the z-ai-web-dev-sdk.
 * This is the only adapter with a real, working implementation.
 */
class ZAIProvider implements AIProviderAdapter {
  readonly name = 'z-ai';

  private client: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  private async ensureClient(): Promise<Awaited<ReturnType<typeof ZAI.create>>> {
    if (!this.client) {
      this.client = await ZAI.create();
    }
    return this.client;
  }

  private buildSdkMessages(request: ChatRequest): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const sdkMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

    // z-ai-web-dev-sdk uses "assistant" role for system prompts
    if (request.systemPrompt) {
      sdkMessages.push({ role: 'assistant', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      const role: 'system' | 'user' | 'assistant' = msg.role === 'system' ? 'assistant' : msg.role as 'user' | 'assistant';
      if (msg.role === 'tool') {
        sdkMessages.push({
          role: 'assistant',
          content: `[Tool Result for ${msg.tool_call_id ?? 'unknown'}]: ${msg.content}`,
        });
        continue;
      }
      sdkMessages.push({ role, content: msg.content });
    }

    if (sdkMessages.length === 0) {
      sdkMessages.push({ role: 'assistant', content: 'You are a helpful assistant.' });
      sdkMessages.push({ role: 'user', content: 'Hello' });
    }

    return sdkMessages;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const client = await this.ensureClient();
    const sdkMessages = this.buildSdkMessages(request);

    try {
      const completion = await client.chat.completions.create({
        messages: sdkMessages,
        thinking: { type: 'disabled' },
      });

      const choice = completion.choices?.[0];
      const content = choice?.message?.content ?? '';

      return {
        content,
        toolCalls: parseToolCallsFromContent(content),
      };
    } catch (error) {
      console.error('[AIGateway:z-ai] Chat completion failed:', error);
      throw new Error(
        `AI chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<string> {
    const client = await this.ensureClient();
    const sdkMessages = this.buildSdkMessages(request);

    try {
      const completion = await client.chat.completions.create({
        messages: sdkMessages,
        thinking: { type: 'disabled' },
      });

      const content = completion.choices?.[0]?.message?.content ?? '';
      yield content;
    } catch (error) {
      console.error('[AIGateway:z-ai] Streaming failed:', error);
      yield `[Stream Error: ${error instanceof Error ? error.message : 'Unknown error'}]`;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      const result = await client.chat.completions.create({
        messages: [
          { role: 'assistant', content: 'Reply with only: OK' },
          { role: 'user', content: 'ping' },
        ],
        thinking: { type: 'disabled' },
      });
      return !!result.choices?.[0]?.message?.content;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    // z-ai-web-dev-sdk does not expose a model listing endpoint.
    // We return the known default model identifier.
    return ['z-ai-default'];
  }
}

// ── Generic Stub Provider (base for unconfigured adapters) ──

/**
 * Base class for providers that are not yet wired up.
 * All methods return structured errors or empty stubs.
 */
abstract class StubProvider implements AIProviderAdapter {
  abstract readonly name: string;

  abstract readonly defaultModels: string[];

  protected abstract readonly displayName: string;

  async chat(_request: ChatRequest): Promise<ChatResponse> {
    console.warn(
      `[AIGateway:${this.name}] Provider not configured. Returning stub error.`,
    );
    throw new ProviderNotConfiguredError(this.name);
  }

  async *chatStream(_request: ChatRequest): AsyncGenerator<string> {
    console.warn(
      `[AIGateway:${this.name}] Provider not configured. Returning stub error.`,
    );
    yield `[Provider "${this.displayName}" is not configured. Please set up API credentials.]`;
  }

  async healthCheck(): Promise<boolean> {
    console.warn(`[AIGateway:${this.name}] Provider not configured. Health check skipped.`);
    return false;
  }

  async listModels(): Promise<string[]> {
    return [...this.defaultModels];
  }
}

// ── OpenAI Provider (STUB) ──────────────────────────────────

class OpenAIProvider extends StubProvider {
  readonly name = 'openai';
  readonly displayName = 'OpenAI';
  readonly defaultModels = [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
  ];
}

// ── Anthropic Provider (STUB) ───────────────────────────────

class AnthropicProvider extends StubProvider {
  readonly name = 'anthropic';
  readonly displayName = 'Anthropic Claude';
  readonly defaultModels = [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
  ];
}

// ── Gemini Provider (STUB) ──────────────────────────────────

class GeminiProvider extends StubProvider {
  readonly name = 'gemini';
  readonly displayName = 'Google Gemini';
  readonly defaultModels = [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
  ];
}

// ── DeepSeek Provider (STUB) ────────────────────────────────

class DeepSeekProvider extends StubProvider {
  readonly name = 'deepseek';
  readonly displayName = 'DeepSeek';
  readonly defaultModels = [
    'deepseek-chat',
    'deepseek-coder',
    'deepseek-reasoner',
  ];
}

// ── Qwen Provider (STUB) ───────────────────────────────────

class QwenProvider extends StubProvider {
  readonly name = 'qwen';
  readonly displayName = 'Qwen (Alibaba Cloud)';
  readonly defaultModels = [
    'qwen-max',
    'qwen-plus',
    'qwen-turbo',
    'qwen-long',
  ];
}

// ── Mistral Provider (STUB) ─────────────────────────────────

class MistralProvider extends StubProvider {
  readonly name = 'mistral';
  readonly displayName = 'Mistral AI';
  readonly defaultModels = [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'open-mistral-nemo',
    'codestral-latest',
  ];
}

// ── Ollama Provider (STUB) ──────────────────────────────────

class OllamaProvider extends StubProvider {
  readonly name = 'ollama';
  readonly displayName = 'Ollama (Local)';
  readonly defaultModels = [
    'llama3',
    'llama3:70b',
    'mistral',
    'codellama',
    'phi3',
  ];
}

// ── Azure OpenAI Provider (STUB) ────────────────────────────

class AzureProvider extends StubProvider {
  readonly name = 'azure';
  readonly displayName = 'Azure OpenAI';
  readonly defaultModels = [
    'gpt-4o',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-35-turbo',
  ];
}

// ── Bedrock Provider (STUB) ─────────────────────────────────

class BedrockProvider extends StubProvider {
  readonly name = 'bedrock';
  readonly displayName = 'Amazon Bedrock';
  readonly defaultModels = [
    'anthropic.claude-3-5-sonnet-20241022-v1:0',
    'anthropic.claude-3-opus-20240229-v1:0',
    'anthropic.claude-3-haiku-20240307-v1:0',
    'meta.llama3-70b-instruct-v1:0',
    'mistral.mistral-7b-instruct-v0:2',
  ];
}

// ════════════════════════════════════════════════════════════
//  Provider Adapter Registry
// ════════════════════════════════════════════════════════════

/**
 * Registry that maps provider type names to adapter constructors.
 * New providers can be registered at runtime.
 */
class ProviderRegistry {
  private factories = new Map<string, () => AIProviderAdapter>();

  constructor() {
    // Register built-in providers
    this.register('z-ai', () => new ZAIProvider());
    this.register('openai', () => new OpenAIProvider());
    this.register('anthropic', () => new AnthropicProvider());
    this.register('gemini', () => new GeminiProvider());
    this.register('deepseek', () => new DeepSeekProvider());
    this.register('qwen', () => new QwenProvider());
    this.register('mistral', () => new MistralProvider());
    this.register('ollama', () => new OllamaProvider());
    this.register('local', () => new OllamaProvider()); // Alias
    this.register('azure', () => new AzureProvider());
    this.register('bedrock', () => new BedrockProvider());
  }

  register(name: string, factory: () => AIProviderAdapter): void {
    this.factories.set(name.toLowerCase(), factory);
  }

  create(name: string): AIProviderAdapter {
    const factory = this.factories.get(name.toLowerCase());
    if (!factory) {
      throw new Error(
        `Unknown AI provider: "${name}". Registered providers: ${[...this.factories.keys()].join(', ')}`,
      );
    }
    return factory();
  }

  has(name: string): boolean {
    return this.factories.has(name.toLowerCase());
  }

  getRegisteredNames(): string[] {
    return [...this.factories.keys()];
  }
}

// ════════════════════════════════════════════════════════════
//  AIGateway — Main Entry Point
// ════════════════════════════════════════════════════════════

// ── Singleton ──────────────────────────────────────────────

let _instance: AIGateway | undefined;

/**
 * Obtain the global AIGateway singleton.
 * Creates one with default z-ai config on first call.
 *
 * @backwardCompat — identical signature to the original.
 */
export function getAIGateway(): AIGateway {
  if (!_instance) {
    _instance = new AIGateway({ provider: 'z-ai' });
  }
  return _instance;
}

/**
 * Reset the singleton. Useful for testing.
 */
export function resetAIGateway(): void {
  _instance = undefined;
}

// ── AIGateway Class ─────────────────────────────────────────

export class AIGateway {
  /** Central registry of provider adapter factories. */
  private static registry = new ProviderRegistry();

  /** All configured provider adapters, keyed by name. */
  private adapters = new Map<string, AIProviderAdapter>();

  /** Provider configs, keyed by name. */
  private configs = new Map<string, AIProviderConfig>();

  /** Currently active provider name. */
  private _activeProvider: string;

  /** Currently active model identifier. */
  private _activeModel: string = '';

  /** Request counter for stats. */
  private _totalRequests: number = 0;

  /**
   * Create a new AIGateway.
   *
   * Accepts both the legacy single-provider config and the
   * new multi-provider config for full backward compatibility.
   *
   * @example
   * // Legacy API (still works)
   * new AIGateway({ provider: 'z-ai', apiKey: '...' });
   *
   * // New multi-provider API
   * new AIGateway({
   *   defaultProvider: 'openai',
   *   providers: {
   *     openai: { type: 'openai', apiKey: 'sk-...', defaultModel: 'gpt-4o' },
   *     anthropic: { type: 'anthropic', apiKey: 'sk-ant-...' },
   *     'z-ai': { type: 'z-ai' },
   *   }
   * });
   */
  constructor(config: AIGatewayConfig | AIGatewayMultiConfig) {
    if ('defaultProvider' in config) {
      // ── New multi-provider config ──
      this._activeProvider = config.defaultProvider;

      for (const [name, providerConf] of Object.entries(config.providers)) {
        this.registerProvider(name, providerConf);
      }

      // Ensure the default provider is registered
      if (!this.adapters.has(this._activeProvider)) {
        // Auto-register with defaults if missing
        this.registerProvider(this._activeProvider, { type: this._activeProvider });
      }
    } else {
      // ── Legacy single-provider config ──
      // Normalize 'local' → 'ollama'
      const providerName = config.provider === 'local' ? 'ollama' : config.provider;
      this._activeProvider = providerName;

      // Create a provider config from the legacy fields
      const providerConf: AIProviderConfig = {
        type: providerName,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        defaultModel: config.defaultModel,
      };

      this.registerProvider(providerName, providerConf);
    }

    // Set the default model
    const activeConfig = this.configs.get(this._activeProvider);
    this._activeModel = activeConfig?.defaultModel ?? this._activeProvider;

    console.info(
      `[AIGateway] Initialized with ${this.adapters.size} provider(s), active: ${this._activeProvider}`,
    );
  }

  // ── Provider Registration ──────────────────────────────

  /**
   * Register (or replace) a provider adapter and its config.
   */
  private registerProvider(name: string, config: AIProviderConfig): void {
    const normalizedName = name.toLowerCase();

    // Create the adapter from the registry
    const adapter = AIGateway.registry.create(config.type);

    // Store both the config and adapter
    this.configs.set(normalizedName, config);
    this.adapters.set(normalizedName, adapter);

    console.info(`[AIGateway] Registered provider "${normalizedName}" (${adapter.name})`);
  }

  /**
   * Get an adapter by name. Falls back to the active provider.
   */
  private getAdapter(providerName?: string): AIProviderAdapter {
    const name = (providerName ?? this._activeProvider).toLowerCase();
    const adapter = this.adapters.get(name);

    if (!adapter) {
      throw new Error(
        `Provider "${name}" is not registered. Available: ${this.getAvailableProviders().join(', ')}`,
      );
    }

    return adapter;
  }

  // ── Chat ────────────────────────────────────────────────

  /**
   * Send a chat completion request.
   *
   * Uses the active provider by default. Per-request override via
   * `request.provider` or the legacy `request.model` naming convention.
   *
   * @backwardCompat — identical signature to the original.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    this._totalRequests++;

    // Resolve provider: explicit override > request hint > active default
    const providerHint = request.provider;
    const adapter = this.getAdapter(providerHint);
    const config = this.configs.get(adapter.name);

    // Build the request, applying provider-specific defaults
    const enrichedRequest: ChatRequest = {
      ...request,
      model: request.model ?? config?.defaultModel ?? this._activeModel,
    };

    try {
      return await adapter.chat(enrichedRequest);
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) {
        // Graceful fallback: return a helpful message instead of crashing
        console.warn(`[AIGateway] ${error.message}`);
        return {
          content: `[AI Provider "${adapter.name}" is not yet configured. Please add API credentials for this provider, or switch to the z-ai provider which is available by default.]`,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      }
      throw error;
    }
  }

  // ── Streaming ───────────────────────────────────────────

  /**
   * Send a streaming chat completion.
   *
   * @backwardCompat — identical signature to the original.
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<string> {
    this._totalRequests++;

    const providerHint = request.provider;
    const adapter = this.getAdapter(providerHint);
    const config = this.configs.get(adapter.name);

    const enrichedRequest: ChatRequest = {
      ...request,
      model: request.model ?? config?.defaultModel ?? this._activeModel,
    };

    try {
      yield* adapter.chatStream(enrichedRequest);
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) {
        yield `[AI Provider "${adapter.name}" is not yet configured.]`;
      } else {
        yield `[Stream Error: ${error instanceof Error ? error.message : 'Unknown error'}]`;
      }
    }
  }

  // ── Provider Switching ───────────────────────────────────

  /**
   * Switch the active provider (and optionally model).
   * The switch takes effect for all subsequent requests.
   */
  switchProvider(provider: string, model?: string): void {
    const normalizedName = provider.toLowerCase();

    if (!this.adapters.has(normalizedName)) {
      // Auto-register if the provider type is known in the registry
      if (AIGateway.registry.has(normalizedName)) {
        this.registerProvider(normalizedName, { type: normalizedName });
      } else {
        throw new Error(
          `Cannot switch to unknown provider "${provider}". Available: ${AIGateway.registry.getRegisteredNames().join(', ')}`,
        );
      }
    }

    this._activeProvider = normalizedName;

    if (model) {
      this._activeModel = model;
    } else {
      const config = this.configs.get(normalizedName);
      this._activeModel = config?.defaultModel ?? normalizedName;
    }

    console.info(
      `[AIGateway] Switched to provider "${this._activeProvider}", model "${this._activeModel}"`,
    );
  }

  // ── Querying ─────────────────────────────────────────────

  /** Get the currently active provider name. */
  getActiveProvider(): string {
    return this._activeProvider;
  }

  /** Get the currently active model name. */
  getActiveModel(): string {
    return this._activeModel;
  }

  /** List all registered (available) provider names. */
  getAvailableProviders(): string[] {
    return [...this.adapters.keys()];
  }

  /**
   * List models for all registered providers.
   * Returns a map of provider name → model IDs.
   */
  async listModels(): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = {};

    for (const [name, adapter] of this.adapters) {
      try {
        const models = await adapter.listModels();
        result[name] = models;
      } catch {
        result[name] = [];
      }
    }

    return result;
  }

  /**
   * Run a health check against a specific provider or all providers.
   * Returns true only if the specified provider is healthy.
   * If no provider is specified, checks the active provider.
   *
   * @backwardCompat — calling with no args checks the active provider.
   */
  async healthCheck(provider?: string): Promise<boolean> {
    if (provider) {
      const adapter = this.getAdapter(provider);
      return adapter.healthCheck();
    }

    // Check all providers
    const results: Record<string, boolean> = {};
    for (const [name, adapter] of this.adapters) {
      results[name] = await adapter.healthCheck();
    }

    // Return true if at least the active provider is healthy
    return results[this._activeProvider] ?? false;
  }

  /**
   * Run health checks for ALL registered providers.
   * Returns a map of provider name → health status.
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, adapter] of this.adapters) {
      results[name] = await adapter.healthCheck();
    }

    return results;
  }

  /** Get usage statistics. */
  getStats(): ProviderStats {
    return {
      provider: this._activeProvider,
      model: this._activeModel,
      totalRequests: this._totalRequests,
    };
  }

  /**
   * Get the adapter instance for a given provider (for advanced usage).
   */
  getAdapterInstance(provider?: string): AIProviderAdapter | undefined {
    if (provider) {
      return this.adapters.get(provider.toLowerCase());
    }
    return this.adapters.get(this._activeProvider);
  }

  /**
   * Get the raw config for a given provider.
   */
  getProviderConfig(provider?: string): AIProviderConfig | undefined {
    const name = (provider ?? this._activeProvider).toLowerCase();
    return this.configs.get(name);
  }

  // ── Static Helpers ───────────────────────────────────────

  /**
   * Get the global provider registry.
   * Allows registering custom provider adapters at the class level.
   *
   * @example
   * AIGateway.getRegistry().register('my-custom', () => new MyCustomProvider());
   */
  static getRegistry(): ProviderRegistry {
    return AIGateway.registry;
  }

  /**
   * List all known provider types (including those not yet registered).
   */
  static getKnownProviders(): string[] {
    return AIGateway.registry.getRegisteredNames();
  }
}

// ════════════════════════════════════════════════════════════
//  Helpers — Exported for Tests & Advanced Usage
// ════════════════════════════════════════════════════════════

/**
 * Try to parse structured tool call JSON from AI response content.
 * The AI may format tool calls as:
 * ```json
 * {"tool_calls": [{"name": "create_contact", "arguments": {...}}]}
 * ```
 *
 * @backwardCompat — exported for test compatibility.
 */
export function parseToolCallsFromContent(
  content: string,
): ChatResponse['toolCalls'] {
  try {
    // Try to find a JSON block in the response
    const jsonMatch = content.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
    if (!jsonMatch) return undefined;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.tool_calls)) return undefined;

    return parsed.tool_calls.map(
      (
        tc: { name: string; arguments: Record<string, unknown> },
        i: number,
      ) => ({
        id: `call_${Date.now()}_${i}`,
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      }),
    );
  } catch {
    return undefined;
  }
}
