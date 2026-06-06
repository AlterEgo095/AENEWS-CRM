// ============================================================
// AENEWS Enterprise OS — MCP Gateway
// Model Context Protocol: AI ↔ Plugin Tool Discovery & Execution
//
// The MCP Gateway is the bridge between the AI chat system and
// the plugin ecosystem. It:
//   1. Discovers which tools are available for a tenant
//   2. Formats them for the LLM (system prompt / tool definitions)
//   3. Executes tool calls requested by the AI
//   4. Manages the tool-call loop (AI → tools → AI → final answer)
// ============================================================

import type { ToolRegistry, RegisteredTool } from '../tool-registry';
import type { AIGateway, ChatMessage } from '../ai-gateway';

// ── Types ────────────────────────────────────────────────────

export interface MCPToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  toolCallId: string;
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface MCPTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface MCPContext {
  tenantId: string;
  userId: string;
  model?: string;
}

export interface MCPMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls?: MCPToolCall[];
  tool_call_id?: string;
  tool_name?: string;
}

export interface AIResponse {
  content: string;
  toolCalls?: MCPToolCall[];
  toolResults?: MCPToolResult[];
}

// ── MCPGateway ───────────────────────────────────────────────

export class MCPGateway {
  private toolRegistry: ToolRegistry;
  private aiGateway: AIGateway;
  private initialized = false;
  private tenantRefreshInProgress: Map<string, Promise<void>> = new Map();

  constructor(toolRegistry: ToolRegistry, aiGateway: AIGateway) {
    this.toolRegistry = toolRegistry;
    this.aiGateway = aiGateway;
  }

  // ── Initialisation ──────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.toolRegistry.initialize();
    this.initialized = true;
    console.log('[MCPGateway] Initialized');
  }

  /**
   * Ensure tenant tools are loaded. Refreshes from DB if stale
   * or never loaded. Deduplicates concurrent refreshes.
   */
  private async ensureTenantTools(tenantId: string): Promise<void> {
    const inProgress = this.tenantRefreshInProgress.get(tenantId);
    if (inProgress) {
      await inProgress;
      return;
    }

    const refreshPromise = this.toolRegistry.refreshTenant(tenantId);
    this.tenantRefreshInProgress.set(tenantId, refreshPromise);
    try {
      await refreshPromise;
    } finally {
      this.tenantRefreshInProgress.delete(tenantId);
    }
  }

  // ── Tool Discovery ───────────────────────────────────────

  /**
   * GET TOOLS: Returns all available tools for a tenant in MCP
   * format — ready to be injected into the system prompt or
   * passed as tool definitions to an LLM.
   */
  async getTools(tenantId: string): Promise<MCPTool[]> {
    await this.ensureTenantTools(tenantId);
    const tools = this.toolRegistry.getForTenant(tenantId);
    return tools.map((tool) => this.formatToolForMCP(tool));
  }

  /**
   * Get raw RegisteredTool array for a tenant.
   */
  async getRegisteredTools(tenantId: string): Promise<RegisteredTool[]> {
    await this.ensureTenantTools(tenantId);
    return this.toolRegistry.getForTenant(tenantId);
  }

  // ── Tool Execution ───────────────────────────────────────

  /**
   * EXECUTE TOOL: Run a single tool call from the AI.
   * Validates tool existence, checks context, and invokes handler.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context: MCPContext,
  ): Promise<MCPToolResult> {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return {
        toolCallId: '',
        toolName,
        success: false,
        error: `Tool "${toolName}" not found in registry. Available tools: ${this.toolRegistry.getAll().map((t) => t.name).join(', ') || 'none'}`,
      };
    }

    // TODO: Check permissions when RBAC is wired up
    if (tool.permissions && tool.permissions.length > 0) {
      // Future: verify user has required permissions
      console.log(`[MCP] Tool "${toolName}" requires permissions: ${tool.permissions.join(', ')}`);
    }

    const executionContext = {
      pluginId: tool.pluginId,
      pluginSlug: tool.pluginSlug,
      tenantId: context.tenantId,
      userId: context.userId,
    };

    try {
      const startTime = Date.now();
      const result = await tool.handler(args, executionContext);
      const duration = Date.now() - startTime;

      console.log(
        `[MCP] Executed "${toolName}" (${tool.pluginSlug}) in ${duration}ms`,
      );

      return {
        toolCallId: '',
        toolName,
        success: true,
        data: result,
      };
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MCP] Tool "${toolName}" execution failed:`, errorMsg);

      return {
        toolCallId: '',
        toolName,
        success: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel (best-effort).
   */
  async executeTools(
    toolCalls: MCPToolCall[],
    context: MCPContext,
  ): Promise<MCPToolResult[]> {
    const results = await Promise.all(
      toolCalls.map(async (tc) => {
        const result = await this.executeTool(tc.name, tc.arguments, context);
        return { ...result, toolCallId: tc.id };
      }),
    );
    return results;
  }

  // ── System Prompt Builder ─────────────────────────────────

  /**
   * BUILD SYSTEM PROMPT: Generate a dynamic system prompt that
   * describes all available tools for the LLM. This is injected
   * as the first message in the conversation.
   */
  async buildSystemPrompt(tenantId: string): Promise<string> {
    const tools = await this.getTools(tenantId);

    // Group tools by plugin for better readability
    const toolsByPlugin = new Map<string, MCPTool[]>();
    for (const tool of tools) {
      const reg = this.toolRegistry.get(tool.function.name);
      if (!reg) continue;
      const key = reg.pluginName;
      if (!toolsByPlugin.has(key)) toolsByPlugin.set(key, []);
      toolsByPlugin.get(key)!.push(tool);
    }

    let prompt = `You are the AENEWS AI Assistant — the intelligent core of the AENEWS Enterprise Operating System.\n\n`;
    prompt += `## Capabilities\n\n`;
    prompt += `You have access to **${tools.length} tools** across **${toolsByPlugin.size} active plugins**. `;
    prompt += `When a user's request can be fulfilled by a tool, use it. `;
    prompt += `If no tool is available, explain clearly and suggest alternatives.\n\n`;

    if (toolsByPlugin.size > 0) {
      prompt += `## Available Tools\n\n`;

      for (const [pluginName, pluginTools] of toolsByPlugin) {
        prompt += `### ${pluginName}\n`;
        for (const tool of pluginTools) {
          prompt += `- **\`${tool.function.name}\`**: ${tool.function.description}\n`;
          const params = tool.function.parameters;
          if (params && Object.keys(params).length > 0) {
            prompt += `  Parameters: \`${JSON.stringify(params)}\`\n`;
          }
        }
        prompt += `\n`;
      }
    }

    prompt += `## Behavioural Guidelines\n\n`;
    prompt += `1. **Always use tools** when the user asks for data, creation, updates, or actions that map to available tools.\n`;
    prompt += `2. **Explain your actions**: Tell the user what tool you're calling and why, before presenting results.\n`;
    prompt += `3. **Be concise but informative**: Provide the key information the user needs without excessive verbosity.\n`;
    prompt += `4. **Respond in the user's language**: Detect the language and reply in kind.\n`;
    prompt += `5. **Handle errors gracefully**: If a tool fails, explain the error and suggest alternatives.\n`;
    prompt += `6. **No tool for request?**: If the user asks for something outside your tool set, explain what you can do and what would be needed.\n`;
    prompt += `7. **Format data**: Use tables, lists, and markdown for data presentation.\n`;
    prompt += `8. **Do not fabricate data**: Only report what tools return. Never make up numbers, names, or records.\n`;

    return prompt;
  }

  // ── Full Message Processing ──────────────────────────────

  /**
   * PROCESS MESSAGE: The complete AI conversation loop.
   *
   * 1. Build the system prompt with available tools
   * 2. Send the conversation (history + new message) to the LLM
   * 3. If the LLM requests tool calls, execute them
   * 4. Feed tool results back to the LLM
   * 5. Repeat until a final text answer is produced
   * 6. Return the complete response with all intermediate data
   *
   * @param maxToolRounds Maximum number of tool-call rounds before forcing a final answer
   */
  async processMessage(
    message: string,
    context: MCPContext,
    history: MCPMessage[],
    maxToolRounds = 3,
  ): Promise<AIResponse> {
    // Ensure tools are loaded for this tenant
    await this.ensureTenantTools(context.tenantId);

    // Build system prompt
    const systemPrompt = await this.buildSystemPrompt(context.tenantId);

    // Prepare messages for the AI
    const chatMessages: ChatMessage[] = history.map((msg) => ({
      role: msg.role === 'system' ? 'system' : msg.role,
      content: msg.content,
    }));

    // Add the new user message
    chatMessages.push({
      role: 'user',
      content: message,
    });

    const allToolResults: MCPToolResult[] = [];
    let round = 0;

    // ── Tool call loop ───────────────────────────────────
    while (round < maxToolRounds) {
      round++;
      console.log(`[MCP] AI loop round ${round}/${maxToolRounds}`);

      // Call the AI
      const aiResponse = await this.aiGateway.chat({
        messages: chatMessages,
        systemPrompt: round === 1 ? systemPrompt : undefined,
      });

      // Check if the AI wants to call tools
      const toolCalls = aiResponse.toolCalls;
      if (!toolCalls || toolCalls.length === 0) {
        // No tool calls — this is the final answer
        return {
          content: aiResponse.content,
          toolResults: allToolResults.length > 0 ? allToolResults : undefined,
        };
      }

      // Execute tool calls
      const mcpCalls: MCPToolCall[] = toolCalls.map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: JSON.parse(tc.arguments),
      }));

      const results = await this.executeTools(mcpCalls, context);
      allToolResults.push(...results);

      // Build tool result messages to feed back to the AI
      const toolResultContent = results
        .map((r) => {
          if (r.success) {
            return `[Tool Result - ${r.toolName}]: ${JSON.stringify(r.data)}`;
          }
          return `[Tool Error - ${r.toolName}]: ${r.error}`;
        })
        .join('\n\n');

      // Add assistant's tool call intent + tool results to conversation
      chatMessages.push({
        role: 'assistant',
        content: aiResponse.content,
      });
      chatMessages.push({
        role: 'tool',
        content: toolResultContent,
        tool_call_id: toolCalls[0]?.id,
      });
    }

    // If we exhausted tool rounds, get a final summary
    const finalResponse = await this.aiGateway.chat({
      messages: chatMessages,
    });

    return {
      content: finalResponse.content,
      toolCalls: undefined,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
    };
  }

  // ── Helpers ──────────────────────────────────────────────

  private formatToolForMCP(tool: RegisteredTool): MCPTool {
    return {
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    };
  }
}
