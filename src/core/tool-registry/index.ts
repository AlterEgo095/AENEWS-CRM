// ============================================================
// AENEWS Enterprise OS — Tool Registry
// Central registry where plugins register AI-callable tools.
// ============================================================

import type { JSONSchema } from '../plugin-sdk';

// ============================================================
// Registered Tool
// ============================================================

export interface RegisteredTool {
  pluginId: string;
  pluginSlug: string;
  pluginName: string;
  name: string;
  description: string;
  parameters: JSONSchema;
  handler: (params: Record<string, unknown>, ctx: any) => Promise<unknown>;
  permissions?: string[];
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
  private _initialized = false;

  /**
   * Initialize the registry (e.g., refresh tenant data from DB).
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;
    // Refresh all known tenants from DB
    try {
      const { db } = await import('@/lib/db');
      const tenants = await db.tenant.findMany({ where: { status: 'active' } });
      for (const tenant of tenants) {
        const activePlugins = await db.installedPlugin.findMany({
          where: { tenantId: tenant.id, status: 'ACTIVE' },
          include: { plugin: { select: { slug: true, name: true } } },
        });
        const set = new Set<string>();
        for (const ip of activePlugins) {
          if (ip.plugin) set.add(ip.plugin.id);
        }
        this.tenantActivePlugins.set(tenant.id, set);
      }
    } catch (error) {
      console.warn('[ToolRegistry] Failed to initialize from DB:', error);
    }
    this._initialized = true;
    console.log(`[ToolRegistry] Initialized with ${this.tools.size} tools`);
  }

  /**
   * Refresh tenant active plugins from DB.
   */
  async refreshTenant(tenantId: string): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const activePlugins = await db.installedPlugin.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { plugin: { select: { slug: true, name: true } } },
      });
      const set = new Set<string>();
      for (const ip of activePlugins) {
        if (ip.plugin) set.add(ip.plugin.id);
      }
      this.tenantActivePlugins.set(tenantId, set);
    } catch (error) {
      console.warn(`[ToolRegistry] Failed to refresh tenant ${tenantId}:`, error);
    }
  }

  /**
   * Register a tool for a plugin.
   */
  register(
    pluginId: string,
    name: string,
    tool: {
      description: string;
      parameters: JSONSchema;
      execute: (params: Record<string, unknown>, ctx: any) => Promise<unknown>;
    },
  ): void {
    const qualifiedName = this.qualifyName(pluginId, name);

    if (this.tools.has(qualifiedName)) {
      console.warn(`[ToolRegistry] Tool "${qualifiedName}" is being overwritten.`);
    }

    // Get plugin metadata for pluginSlug/pluginName
    const pluginSlug = pluginId.includes('.') ? pluginId.split('.').pop() || pluginId : pluginId;
    const pluginName = pluginId.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    this.tools.set(qualifiedName, {
      pluginId,
      pluginSlug,
      pluginName,
      name: qualifiedName,
      description: tool.description,
      parameters: tool.parameters,
      handler: tool.execute,
      permissions: undefined,
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
   * Get all registered tools.
   */
  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools available for a specific tenant.
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
   * Mark a plugin as active for a tenant.
   */
  activatePluginForTenant(pluginId: string, tenantId: string): void {
    if (!this.tenantActivePlugins.has(tenantId)) {
      this.tenantActivePlugins.set(tenantId, new Set());
    }
    this.tenantActivePlugins.get(tenantId)!.add(pluginId);
  }

  /**
   * Mark a plugin as inactive for a tenant.
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
   * Remove all tenant mappings for a plugin.
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
   * Check if a tool exists.
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
   * Construct a fully qualified tool name.
   */
  private qualifyName(pluginId: string, name: string): string {
    if (name.includes(':')) {
      return name;
    }
    return `${pluginId}:${name}`;
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: ToolRegistry | undefined;

export function getToolRegistry(): ToolRegistry {
  if (!_instance) {
    _instance = new ToolRegistry();
  }
  return _instance;
}
