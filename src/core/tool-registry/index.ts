// ============================================================
// AENEWS Enterprise OS — Tool Registry
// Central registry where plugins register AI-callable tools.
// The AI/MCP Gateway queries this registry to discover available tools.
// ============================================================

import type { JSONSchema, ToolHandler, ToolContext, ToolResult } from '../plugin-sdk';

// ============================================================
// Registered Tool
// ============================================================

export interface RegisteredTool {
  /** The plugin that registered this tool */
  pluginId: string;
  /** Fully qualified tool name (e.g. "crm.contacts.create") */
  name: string;
  /** Human-readable description for AI discovery */
  description: string;
  /** JSON Schema describing the tool's input parameters */
  parameters: JSONSchema;
  /** The handler function that executes the tool */
  handler: ToolHandler;
  /** Permissions required to invoke this tool */
  permissions?: string[];
}

// ============================================================
// MCP Tool Definition — what the AI Gateway consumes
// ============================================================

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  annotations?: {
    pluginId: string;
    permissions?: string[];
  };
}

// ============================================================
// Tool Invocation Result
// ============================================================

export interface ToolInvocationResult {
  toolName: string;
  success: boolean;
  data?: unknown;
  error?: string;
  durationMs: number;
}

// ============================================================
// Tool Registry
// ============================================================

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private tenantActivePlugins: Map<string, Set<string>> = new Map();

  /**
   * Register a tool for a plugin. The fully qualified name is
   * constructed as "pluginId:toolName" to avoid collisions.
   */
  register(
    pluginId: string,
    name: string,
    tool: Omit<RegisteredTool, 'pluginId' | 'name'>,
  ): void {
    const qualifiedName = this.qualifyName(pluginId, name);

    if (this.tools.has(qualifiedName)) {
      console.warn(
        `[ToolRegistry] Tool "${qualifiedName}" is being overwritten by plugin "${pluginId}".`,
      );
    }

    this.tools.set(qualifiedName, {
      pluginId,
      name: qualifiedName,
      description: tool.description,
      parameters: tool.parameters,
      handler: tool.handler,
      permissions: tool.permissions,
    });
  }

  /**
   * Unregister a specific tool by name, or all tools for a plugin.
   */
  unregister(pluginId: string, name?: string): void {
    if (name) {
      const qualifiedName = this.qualifyName(pluginId, name);
      this.tools.delete(qualifiedName);
    } else {
      // Remove all tools for this plugin
      for (const [key, tool] of this.tools) {
        if (tool.pluginId === pluginId) {
          this.tools.delete(key);
        }
      }
    }
  }

  /**
   * Get a registered tool by its fully qualified name.
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get a registered tool by plugin ID and tool name.
   */
  getByName(pluginId: string, name: string): RegisteredTool | undefined {
    return this.tools.get(this.qualifyName(pluginId, name));
  }

  /**
   * Get all tools registered by a specific plugin.
   */
  getByPlugin(pluginId: string): RegisteredTool[] {
    const result: RegisteredTool[] = [];
    for (const tool of this.tools.values()) {
      if (tool.pluginId === pluginId) {
        result.push(tool);
      }
    }
    return result;
  }

  /**
   * Get all registered tools.
   */
  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools available for a specific tenant.
   * Only returns tools from plugins that are active for that tenant.
   */
  getForTenant(tenantId: string): RegisteredTool[] {
    const activePlugins = this.tenantActivePlugins.get(tenantId);
    if (!activePlugins || activePlugins.size === 0) {
      return [];
    }

    const result: RegisteredTool[] = [];
    for (const tool of this.tools.values()) {
      if (activePlugins.has(tool.pluginId)) {
        result.push(tool);
      }
    }
    return result;
  }

  /**
   * Mark a plugin as active for a tenant (makes its tools available).
   */
  activatePluginForTenant(pluginId: string, tenantId: string): void {
    if (!this.tenantActivePlugins.has(tenantId)) {
      this.tenantActivePlugins.set(tenantId, new Set());
    }
    this.tenantActivePlugins.get(tenantId)!.add(pluginId);
  }

  /**
   * Mark a plugin as inactive for a tenant (hides its tools).
   */
  deactivatePluginForTenant(pluginId: string, tenantId: string): void {
    const activePlugins = this.tenantActivePlugins.get(tenantId);
    if (activePlugins) {
      activePlugins.delete(pluginId);
      if (activePlugins.size === 0) {
        this.tenantActivePlugins.delete(tenantId);
      }
    }
  }

  /**
   * Remove all tenant mappings for a plugin (e.g., on uninstall).
   */
  removePluginFromAllTenants(pluginId: string): void {
    for (const [tenantId, plugins] of this.tenantActivePlugins) {
      plugins.delete(pluginId);
      if (plugins.size === 0) {
        this.tenantActivePlugins.delete(tenantId);
      }
    }
  }

  /**
   * Export all registered tools as MCP-compatible tool definitions.
   * This is what the AI Gateway uses to discover available tools.
   */
  toMCPTools(): MCPToolDefinition[] {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
      annotations: {
        pluginId: tool.pluginId,
        ...(tool.permissions && tool.permissions.length > 0
          ? { permissions: tool.permissions }
          : {}),
      },
    }));
  }

  /**
   * Export MCP tools for a specific tenant only.
   */
  toMCPTenantTools(tenantId: string): MCPToolDefinition[] {
    return this.getForTenant(tenantId).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.parameters,
      annotations: {
        pluginId: tool.pluginId,
        ...(tool.permissions && tool.permissions.length > 0
          ? { permissions: tool.permissions }
          : {}),
      },
    }));
  }

  /**
   * Invoke a tool by name with the given parameters and context.
   * Returns the result with timing information.
   */
  async invoke(
    name: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolInvocationResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        toolName: name,
        success: false,
        error: `Tool "${name}" not found in registry`,
        durationMs: 0,
      };
    }

    // Check permissions if defined
    if (tool.permissions && tool.permissions.length > 0 && context.userId) {
      // In a real implementation, this would check against the user's permissions
      // For now, we just log the permission check
      console.log(
        `[ToolRegistry] Permission check for "${name}" by user "${context.userId}": ${tool.permissions.join(', ')}`,
      );
    }

    const start = performance.now();
    try {
      const result: ToolResult = await tool.handler(params, context);
      const durationMs = Math.round(performance.now() - start);

      return {
        toolName: name,
        success: result.success,
        data: result.data,
        error: result.error,
        durationMs,
      };
    } catch (error) {
      const durationMs = Math.round(performance.now() - start);
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        toolName: name,
        success: false,
        error: errorMessage,
        durationMs,
      };
    }
  }

  /**
   * Get the total number of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Get the total number of tenant-plugin mappings.
   */
  get tenantCount(): number {
    return this.tenantActivePlugins.size;
  }

  /**
   * Check if a tool exists in the registry.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Clear all registered tools and tenant mappings.
   */
  clear(): void {
    this.tools.clear();
    this.tenantActivePlugins.clear();
  }

  /**
   * Construct a fully qualified tool name: pluginId:toolName
   */
  private qualifyName(pluginId: string, name: string): string {
    // If name already contains a colon, it's already qualified
    if (name.includes(':')) {
      return name;
    }
    return `${pluginId}:${name}`;
  }
}
