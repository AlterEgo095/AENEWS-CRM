// ============================================================
// AENEWS Enterprise OS — AI Gateway
// Provider-agnostic AI integration layer.
// Currently backed by z-ai-web-dev-sdk; the adapter pattern
// makes it trivial to swap in OpenAI / Anthropic / local later.
// ============================================================

import ZAI from 'z-ai-web-dev-sdk';

// ── Config ──────────────────────────────────────────────────

export type AIProvider = 'z-ai' | 'openai' | 'anthropic' | 'local';

export interface AIGatewayConfig {
  provider: AIProvider;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

// ── Request / Response types ──────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** JSON-stringified tool call arguments (assistant role) */
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  /** tool call id this message is responding to (tool role) */
  tool_call_id?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
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

// ── Singleton ────────────────────────────────────────────────

let _instance: AIGateway | undefined;

export function getAIGateway(): AIGateway {
  if (!_instance) {
    _instance = new AIGateway({ provider: 'z-ai' });
  }
  return _instance;
}

// ── AIGateway ────────────────────────────────────────────────

export class AIGateway {
  private config: AIGatewayConfig;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  constructor(config: AIGatewayConfig) {
    this.config = config;
  }

  // ── Initialisation ──────────────────────────────────────

  private async ensureClient(): Promise<Awaited<ReturnType<typeof ZAI.create>>> {
    if (!this.zai) {
      this.zai = await ZAI.create();
    }
    return this.zai;
  }

  // ── Chat ────────────────────────────────────────────────

  /**
   * Send a chat completion request to the AI provider.
   *
   * The z-ai-web-dev-sdk uses the "assistant" role for system prompts
   * (not "system" like the OpenAI API). We normalise here.
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const client = await this.ensureClient();

    // Build the messages array for z-ai-web-dev-sdk
    const sdkMessages: { role: string; content: string }[] = [];

    // If there's a separate systemPrompt, prepend it as the first message
    // using the "assistant" role (z-ai convention for system messages)
    if (request.systemPrompt) {
      sdkMessages.push({
        role: 'assistant',
        content: request.systemPrompt,
      });
    }

    // Map remaining messages — convert "system" to "assistant" for z-ai
    for (const msg of request.messages) {
      const role = msg.role === 'system' ? 'assistant' : msg.role;
      // Skip tool messages — z-ai SDK doesn't support tool calling natively
      // We'll handle tool results via inline content instead
      if (msg.role === 'tool') {
        // We'll inject tool results as part of the conversation flow
        // by converting them to assistant context
        sdkMessages.push({
          role: 'assistant',
          content: `[Tool Result for ${msg.tool_call_id ?? 'unknown'}]: ${msg.content}`,
        });
        continue;
      }
      sdkMessages.push({
        role,
        content: msg.content,
      });
    }

    // Ensure we have at least one message
    if (sdkMessages.length === 0) {
      sdkMessages.push({
        role: 'assistant',
        content: 'You are a helpful assistant.',
      });
      sdkMessages.push({
        role: 'user',
        content: 'Hello',
      });
    }

    try {
      const completion = await client.chat.completions.create({
        messages: sdkMessages,
        thinking: { type: 'disabled' },
      });

      const choice = completion.choices?.[0];
      const content = choice?.message?.content ?? '';

      return {
        content,
        // z-ai-web-dev-sdk doesn't return structured tool_calls,
        // so we parse them from content if the AI formatted them
        toolCalls: parseToolCallsFromContent(content),
      };
    } catch (error) {
      console.error('[AIGateway] Chat completion failed:', error);
      throw new Error(
        `AI chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  // ── Streaming (future) ───────────────────────────────────

  /**
   * Placeholder for streaming support.
   * z-ai-web-dev-sdk supports streaming via the `stream: true` option.
   */
  async *chatStream(request: ChatRequest): AsyncGenerator<string> {
    const client = await this.ensureClient();

    const sdkMessages: { role: string; content: string }[] = [];

    if (request.systemPrompt) {
      sdkMessages.push({ role: 'assistant', content: request.systemPrompt });
    }

    for (const msg of request.messages) {
      const role = msg.role === 'system' ? 'assistant' : msg.role;
      if (msg.role === 'tool') {
        sdkMessages.push({
          role: 'assistant',
          content: `[Tool Result]: ${msg.content}`,
        });
        continue;
      }
      sdkMessages.push({ role, content: msg.content });
    }

    if (sdkMessages.length === 0) {
      sdkMessages.push({ role: 'assistant', content: 'You are a helpful assistant.' });
      sdkMessages.push({ role: 'user', content: 'Hello' });
    }

    const completion = await client.chat.completions.create({
      messages: sdkMessages,
      thinking: { type: 'disabled' },
      // Note: streaming may require specific SDK version support
    });

    // For now, yield the complete response
    const content = completion.choices?.[0]?.message?.content ?? '';
    yield content;
  }

  // ── Health Check ────────────────────────────────────────

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
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Try to parse structured tool call JSON from AI response content.
 * The AI may format tool calls as:
 * ```json
 * {"tool_calls": [{"name": "create_contact", "arguments": {...}}]}
 * ```
 */
function parseToolCallsFromContent(
  content: string,
): ChatResponse['toolCalls'] {
  try {
    // Try to find a JSON block in the response
    const jsonMatch = content.match(/\{[\s\S]*"tool_calls"[\s\S]*\}/);
    if (!jsonMatch) return undefined;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.tool_calls)) return undefined;

    return parsed.tool_calls.map(
      (tc: { name: string; arguments: Record<string, unknown> }, i: number) => ({
        id: `call_${Date.now()}_${i}`,
        name: tc.name,
        arguments: JSON.stringify(tc.arguments),
      }),
    );
  } catch {
    return undefined;
  }
}
