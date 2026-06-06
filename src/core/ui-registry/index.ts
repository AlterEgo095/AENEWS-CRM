// ============================================================
// AENEWS Enterprise OS — UI Registry
// Central registry where plugins register UI extensions.
// The frontend queries this registry to build a 100% dynamic UI:
//   Sidebar, Topbar, Pages, Widgets, Dashboard Cards,
//   Actions, and Commands are all driven by plugins.
// ============================================================

// ============================================================
// UI Extension Types
// ============================================================

/**
 * Sidebar navigation item registered by a plugin.
 * Displayed in the main application sidebar, grouped by section.
 */
export interface UISidebarItem {
  /** Globally unique identifier for this sidebar item (e.g. "crm:contacts") */
  id: string;
  /** Plugin that owns this item */
  pluginId: string;
  /** Display label */
  label: string;
  /** Icon name or identifier (e.g. lucide icon key, or a React component ref) */
  icon?: string;
  /** Navigation href when clicked */
  href?: string;
  /** Section group (e.g. "main", "analytics", "admin") */
  section?: string;
  /** Sort order within the section (lower = first, default 0) */
  order?: number;
  /** Parent item id for nested sidebar items */
  parentId?: string;
  /** Optional badge (e.g. count, "new", "3") */
  badge?: string | number;
  /** Permission required to see this item */
  permission?: string;
}

/**
 * Topbar action registered by a plugin.
 * Displayed as a button/action in the application top bar.
 */
export interface UITopbarAction {
  /** Globally unique identifier */
  id: string;
  /** Plugin that owns this action */
  pluginId: string;
  /** Display label (tooltip or text) */
  label: string;
  /** Icon name */
  icon?: string;
  /** Action identifier — the frontend maps this to a handler */
  action: string;
  /** Sort order (lower = first, default 0) */
  order?: number;
  /** Permission required to see/use this action */
  permission?: string;
}

/**
 * Page route registered by a plugin.
 * Each page becomes a route in the application router.
 */
export interface UIPage {
  /** Globally unique identifier */
  id: string;
  /** Plugin that owns this page */
  pluginId: string;
  /** URL path (e.g. "/crm/contacts") */
  path: string;
  /** Page title */
  title: string;
  /** Icon for breadcrumbs/nav */
  icon?: string;
  /** Component identifier — the frontend resolves this to a React component */
  component?: string;
  /** Permissions required to access this page */
  permissions?: string[];
  /** Layout override (e.g. "full-width", "sidebar-hidden", "blank") */
  layout?: string;
  /** Sort order among pages */
  order?: number;
}

/**
 * Widget registered by a plugin.
 * Widgets are rendered inside pages or dashboards.
 */
export interface UIWidget {
  /** Globally unique identifier */
  id: string;
  /** Plugin that owns this widget */
  pluginId: string;
  /** Widget type determines rendering strategy */
  type: 'chart' | 'table' | 'list' | 'card' | 'stat' | 'calendar' | 'kanban' | 'custom';
  /** Display title */
  title: string;
  /** Component identifier — the frontend resolves this to a React component */
  component?: string;
  /** Widget size on the grid */
  size?: 'sm' | 'md' | 'lg' | 'full';
  /** Widget-specific configuration (chart config, data source, etc.) */
  config?: Record<string, any>;
  /** Permissions required to see this widget */
  permissions?: string[];
}

/**
 * Dashboard card registered by a plugin.
 * Compact info cards shown on the main dashboard overview.
 */
export interface UIDashboardCard {
  /** Globally unique identifier */
  id: string;
  /** Plugin that owns this card */
  pluginId: string;
  /** Card title */
  title: string;
  /** Optional description or subtitle */
  description?: string;
  /** Icon name */
  icon?: string;
  /** Primary value to display */
  value?: string | number;
  /** Trend indicator (e.g. "+12%", "-3%", "up", "down") */
  trend?: string;
  /** Navigation href when card is clicked */
  href?: string;
  /** Accent color */
  color?: string;
  /** Sort order on the dashboard (lower = first) */
  order?: number;
}

/**
 * Contextual action registered by a plugin.
 * Actions appear in context menus, entity views, or bulk-action bars.
 */
export interface UIAction {
  /** Globally unique identifier */
  id: string;
  /** Plugin that owns this action */
  pluginId: string;
  /** Display label */
  label: string;
  /** Icon name */
  icon?: string;
  /** Action identifier — the frontend maps this to a handler */
  action: string;
  /** Keyboard shortcut (e.g. "Ctrl+K", "Cmd+Shift+N") */
  shortcut?: string;
  /** Permission required to use this action */
  permission?: string;
  /** Context scopes where this action appears (e.g. ["contact-list", "contact-detail"]) */
  contexts?: string[];
}

/**
 * Command registered by a plugin.
 * Commands are indexed for the command palette / spotlight search.
 */
export interface UICommand {
  /** Globally unique identifier */
  id: string;
  /** Plugin that owns this command */
  pluginId: string;
  /** Display label */
  label: string;
  /** Icon name */
  icon?: string;
  /** Command identifier — the frontend maps this to a handler */
  command: string;
  /** Keyboard shortcut */
  shortcut?: string;
  /** Search keywords for command palette discovery */
  keywords?: string[];
  /** Permission required to execute this command */
  permission?: string;
}

// ============================================================
// Composite type for the full UI snapshot sent to the frontend
// ============================================================

export interface UIFullSnapshot {
  sidebar: UISidebarItem[];
  topbar: UITopbarAction[];
  pages: UIPage[];
  widgets: UIWidget[];
  dashboardCards: UIDashboardCard[];
  actions: UIAction[];
  commands: UICommand[];
}

// ============================================================
// Registry Statistics
// ============================================================

export interface UIRegistryStats {
  sidebarItems: number;
  topbarActions: number;
  pages: number;
  widgets: number;
  dashboardCards: number;
  actions: number;
  commands: number;
}

// ============================================================
// UI Registry Errors
// ============================================================

export class UIRegistryDuplicateError extends Error {
  constructor(type: string, id: string) {
    super(`[UIRegistry] Duplicate ${type} registration with id "${id}". Existing entry will be updated.`);
    this.name = 'UIRegistryDuplicateError';
  }
}

export class UIRegistryValidationError extends Error {
  constructor(message: string) {
    super(`[UIRegistry] Validation error: ${message}`);
    this.name = 'UIRegistryValidationError';
  }
}

// ============================================================
// UI Registry — Core class
// ============================================================

export class UIRegistry {
  // ── Internal Stores ──────────────────────────────────────
  private sidebarItems: Map<string, UISidebarItem> = new Map();
  private topbarActions: Map<string, UITopbarAction> = new Map();
  private pages: Map<string, UIPage> = new Map();
  private widgets: Map<string, UIWidget> = new Map();
  private dashboardCards: Map<string, UIDashboardCard> = new Map();
  private actions: Map<string, UIAction> = new Map();
  private commands: Map<string, UICommand> = new Map();

  /** Track which plugin IDs have registered extensions (for bulk unregister) */
  private pluginExtensions: Map<string, Set<string>> = new Map();

  /** Cached tenant-to-active-plugins mapping for getForTenant */
  private tenantActivePlugins: Map<string, Set<string>> = new Map();

  /** Initialization guard */
  private _initialized = false;

  // ============================================================
  // INITIALIZATION
  // ============================================================

  /**
   * Initialize the registry by loading tenant active-plugin mappings from DB.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      const { db } = await import('@/lib/db');
      const tenants = await db.tenant.findMany({ where: { status: 'active' } });

      for (const tenant of tenants) {
        const installed = await db.installedPlugin.findMany({
          where: { tenantId: tenant.id, status: 'ACTIVE' },
          select: { pluginId: true },
        });
        const pluginIds = new Set<string>();
        for (const ip of installed) {
          pluginIds.add(ip.pluginId);
        }
        this.tenantActivePlugins.set(tenant.id, pluginIds);
      }

      console.info(
        `[UIRegistry] Initialized — ${this.sidebarItems.size} sidebar, ${this.pages.size} pages, ${this.widgets.size} widgets, ${this.dashboardCards.size} dashboard cards, ${this.actions.size} actions, ${this.commands.size} commands`,
      );
    } catch (error) {
      console.warn('[UIRegistry] DB initialization failed (running without tenant data):', error);
    }

    this._initialized = true;
  }

  /**
   * Refresh a single tenant's active plugin set from DB.
   */
  async refreshTenant(tenantId: string): Promise<void> {
    try {
      const { db } = await import('@/lib/db');
      const installed = await db.installedPlugin.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { pluginId: true },
      });
      const pluginIds = new Set<string>();
      for (const ip of installed) {
        pluginIds.add(ip.pluginId);
      }
      this.tenantActivePlugins.set(tenantId, pluginIds);
    } catch (error) {
      console.warn(`[UIRegistry] Failed to refresh tenant ${tenantId}:`, error);
    }
  }

  // ============================================================
  // REGISTRATION
  // ============================================================

  /**
   * Register a sidebar navigation item.
   * If an item with the same id already exists, it will be overwritten with a warning.
   */
  registerSidebarItem(item: UISidebarItem): void {
    this.validateRequiredFields(item, ['id', 'pluginId', 'label']);

    if (this.sidebarItems.has(item.id)) {
      console.warn(`[UIRegistry] Sidebar item "${item.id}" is being overwritten by plugin "${item.pluginId}".`);
    }

    this.sidebarItems.set(item.id, { ...item, order: item.order ?? 0 });
    this.trackPluginExtension(item.pluginId, item.id);
  }

  /**
   * Register a topbar action.
   */
  registerTopbarAction(action: UITopbarAction): void {
    this.validateRequiredFields(action, ['id', 'pluginId', 'label', 'action']);

    if (this.topbarActions.has(action.id)) {
      console.warn(`[UIRegistry] Topbar action "${action.id}" is being overwritten by plugin "${action.pluginId}".`);
    }

    this.topbarActions.set(action.id, { ...action, order: action.order ?? 0 });
    this.trackPluginExtension(action.pluginId, action.id);
  }

  /**
   * Register a page route.
   * Warns on duplicate paths across different plugins.
   */
  registerPage(page: UIPage): void {
    this.validateRequiredFields(page, ['id', 'pluginId', 'path', 'title']);

    // Check for path collisions
    for (const existing of this.pages.values()) {
      if (existing.path === page.path && existing.pluginId !== page.pluginId) {
        console.warn(
          `[UIRegistry] Page path collision: "${page.path}" is already registered by plugin "${existing.pluginId}". New registration from "${page.pluginId}" will override.`,
        );
      }
    }

    if (this.pages.has(page.id)) {
      console.warn(`[UIRegistry] Page "${page.id}" is being overwritten by plugin "${page.pluginId}".`);
    }

    this.pages.set(page.id, { ...page, order: page.order ?? 0 });
    this.trackPluginExtension(page.pluginId, page.id);
  }

  /**
   * Register a widget.
   */
  registerWidget(widget: UIWidget): void {
    this.validateRequiredFields(widget, ['id', 'pluginId', 'type', 'title']);

    if (this.widgets.has(widget.id)) {
      console.warn(`[UIRegistry] Widget "${widget.id}" is being overwritten by plugin "${widget.pluginId}".`);
    }

    this.widgets.set(widget.id, { ...widget });
    this.trackPluginExtension(widget.pluginId, widget.id);
  }

  /**
   * Register a dashboard card.
   */
  registerDashboardCard(card: UIDashboardCard): void {
    this.validateRequiredFields(card, ['id', 'pluginId', 'title']);

    if (this.dashboardCards.has(card.id)) {
      console.warn(`[UIRegistry] Dashboard card "${card.id}" is being overwritten by plugin "${card.pluginId}".`);
    }

    this.dashboardCards.set(card.id, { ...card, order: card.order ?? 0 });
    this.trackPluginExtension(card.pluginId, card.id);
  }

  /**
   * Register a contextual action.
   */
  registerAction(action: UIAction): void {
    this.validateRequiredFields(action, ['id', 'pluginId', 'label', 'action']);

    if (this.actions.has(action.id)) {
      console.warn(`[UIRegistry] Action "${action.id}" is being overwritten by plugin "${action.pluginId}".`);
    }

    this.actions.set(action.id, { ...action, contexts: action.contexts ?? [] });
    this.trackPluginExtension(action.pluginId, action.id);
  }

  /**
   * Register a command for the command palette.
   */
  registerCommand(command: UICommand): void {
    this.validateRequiredFields(command, ['id', 'pluginId', 'label', 'command']);

    // Check for shortcut collisions
    if (command.shortcut) {
      for (const existing of this.commands.values()) {
        if (existing.shortcut === command.shortcut && existing.id !== command.id) {
          console.warn(
            `[UIRegistry] Shortcut collision: "${command.shortcut}" is already bound to command "${existing.id}". Command "${command.id}" from plugin "${command.pluginId}" will also use it.`,
          );
        }
      }
    }

    if (this.commands.has(command.id)) {
      console.warn(`[UIRegistry] Command "${command.id}" is being overwritten by plugin "${command.pluginId}".`);
    }

    this.commands.set(command.id, { ...command, keywords: command.keywords ?? [] });
    this.trackPluginExtension(command.pluginId, command.id);
  }

  /**
   * Bulk-register multiple UI extensions from a plugin at once.
   * Accepts any subset of extension types.
   */
  registerBatch(extensions: {
    sidebarItems?: UISidebarItem[];
    topbarActions?: UITopbarAction[];
    pages?: UIPage[];
    widgets?: UIWidget[];
    dashboardCards?: UIDashboardCard[];
    actions?: UIAction[];
    commands?: UICommand[];
  }): void {
    for (const item of extensions.sidebarItems ?? []) this.registerSidebarItem(item);
    for (const action of extensions.topbarActions ?? []) this.registerTopbarAction(action);
    for (const page of extensions.pages ?? []) this.registerPage(page);
    for (const widget of extensions.widgets ?? []) this.registerWidget(widget);
    for (const card of extensions.dashboardCards ?? []) this.registerDashboardCard(card);
    for (const action of extensions.actions ?? []) this.registerAction(action);
    for (const cmd of extensions.commands ?? []) this.registerCommand(cmd);
  }

  // ============================================================
  // UNREGISTRATION
  // ============================================================

  /**
   * Unregister ALL UI extensions associated with a given plugin.
   * Called during plugin unload/deactivation.
   */
  unregisterByPlugin(pluginId: string): void {
    const extensionIds = this.pluginExtensions.get(pluginId);

    if (!extensionIds || extensionIds.size === 0) {
      return;
    }

    const ids = Array.from(extensionIds);

    for (const id of ids) {
      this.sidebarItems.delete(id);
      this.topbarActions.delete(id);
      this.pages.delete(id);
      this.widgets.delete(id);
      this.dashboardCards.delete(id);
      this.actions.delete(id);
      this.commands.delete(id);
    }

    this.pluginExtensions.delete(pluginId);

    console.info(
      `[UIRegistry] Unregistered ${ids.length} extension(s) for plugin "${pluginId}".`,
    );
  }

  /**
   * Clear all registered UI extensions. Use with caution (mainly for tests).
   */
  clear(): void {
    this.sidebarItems.clear();
    this.topbarActions.clear();
    this.pages.clear();
    this.widgets.clear();
    this.dashboardCards.clear();
    this.actions.clear();
    this.commands.clear();
    this.pluginExtensions.clear();
  }

  // ============================================================
  // GETTERS — Filtered & Ordered
  // ============================================================

  /**
   * Get sidebar items, optionally filtered by section.
   * Results are sorted by order (ascending), then by id for stable tie-breaking.
   */
  getSidebarItems(section?: string): UISidebarItem[] {
    let items = Array.from(this.sidebarItems.values());

    if (section !== undefined) {
      items = items.filter((item) => item.section === section);
    }

    return this.sortByOrder(items);
  }

  /**
   * Get all topbar actions, sorted by order.
   */
  getTopbarActions(): UITopbarAction[] {
    return this.sortByOrder(Array.from(this.topbarActions.values()));
  }

  /**
   * Get all registered pages, sorted by order then path.
   */
  getPages(): UIPage[] {
    return this.sortByOrder(Array.from(this.pages.values()));
  }

  /**
   * Get all registered widgets.
   */
  getWidgets(): UIWidget[] {
    return Array.from(this.widgets.values());
  }

  /**
   * Get all dashboard cards, sorted by order.
   */
  getDashboardCards(): UIDashboardCard[] {
    return this.sortByOrder(Array.from(this.dashboardCards.values()));
  }

  /**
   * Get all actions, optionally filtered by context.
   * Results are sorted by label for consistent display.
   */
  getActions(context?: string): UIAction[] {
    let items = Array.from(this.actions.values());

    if (context !== undefined) {
      items = items.filter(
        (action) => action.contexts === undefined || action.contexts.length === 0 || action.contexts.includes(context),
      );
    }

    // Sort by label for predictable context-menu ordering
    return items.sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Get all commands for the command palette, sorted by label.
   */
  getCommands(): UICommand[] {
    return Array.from(this.commands.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }

  // ============================================================
  // TENANT-AWARE QUERIES
  // ============================================================

  /**
   * Get all UI extensions visible to a specific tenant.
   * Only extensions from plugins active for that tenant are included.
   */
  async getForTenant(tenantId: string): Promise<UIFullSnapshot> {
    const activePlugins = await this.resolveTenantPlugins(tenantId);

    const filterByPlugin = <T extends { pluginId: string }>(map: Map<string, T>): T[] => {
      if (!activePlugins || activePlugins.size === 0) return [];
      return Array.from(map.values()).filter((item) => activePlugins.has(item.pluginId));
    };

    return {
      sidebar: this.sortByOrder(filterByPlugin(this.sidebarItems)),
      topbar: this.sortByOrder(filterByPlugin(this.topbarActions)),
      pages: this.sortByOrder(filterByPlugin(this.pages)),
      widgets: filterByPlugin(this.widgets),
      dashboardCards: this.sortByOrder(filterByPlugin(this.dashboardCards)),
      actions: filterByPlugin(this.actions).sort((a, b) => a.label.localeCompare(b.label)),
      commands: filterByPlugin(this.commands).sort((a, b) => a.label.localeCompare(b.label)),
    };
  }

  // ============================================================
  // EXPORT
  // ============================================================

  /**
   * Export all UI extensions as a plain object.
   * Intended for serialization to the frontend via API response.
   * Strips function references and non-serializable fields.
   */
  exportAll(): Record<string, any> {
    return {
      sidebar: this.getSidebarItems().map(this.serializeSidebarItem),
      topbar: this.getTopbarActions().map(this.serializeTopbarAction),
      pages: this.getPages().map(this.serializePage),
      widgets: this.getWidgets().map(this.serializeWidget),
      dashboardCards: this.getDashboardCards().map(this.serializeDashboardCard),
      actions: this.getActions().map(this.serializeAction),
      commands: this.getCommands().map(this.serializeCommand),
    };
  }

  /**
   * Export UI extensions for a specific tenant.
   */
  async exportForTenant(tenantId: string): Promise<Record<string, any>> {
    const snapshot = await this.getForTenant(tenantId);
    return {
      sidebar: snapshot.sidebar.map(this.serializeSidebarItem),
      topbar: snapshot.topbar.map(this.serializeTopbarAction),
      pages: snapshot.pages.map(this.serializePage),
      widgets: snapshot.widgets.map(this.serializeWidget),
      dashboardCards: snapshot.dashboardCards.map(this.serializeDashboardCard),
      actions: snapshot.actions.map(this.serializeAction),
      commands: snapshot.commands.map(this.serializeCommand),
    };
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  /**
   * Get counts of all registered extensions.
   */
  getStats(): UIRegistryStats {
    return {
      sidebarItems: this.sidebarItems.size,
      topbarActions: this.topbarActions.size,
      pages: this.pages.size,
      widgets: this.widgets.size,
      dashboardCards: this.dashboardCards.size,
      actions: this.actions.size,
      commands: this.commands.size,
    };
  }

  // ============================================================
  // LOOKUP HELPERS
  // ============================================================

  /**
   * Get a single sidebar item by id.
   */
  getSidebarItemById(id: string): UISidebarItem | undefined {
    return this.sidebarItems.get(id);
  }

  /**
   * Get a single page by id.
   */
  getPageById(id: string): UIPage | undefined {
    return this.pages.get(id);
  }

  /**
   * Get a page by its URL path.
   */
  getPageByPath(path: string): UIPage | undefined {
    for (const page of this.pages.values()) {
      if (page.path === path) return page;
    }
    return undefined;
  }

  /**
   * Get a single command by its command string.
   */
  getCommandByCommand(command: string): UICommand | undefined {
    for (const cmd of this.commands.values()) {
      if (cmd.command === command) return cmd;
    }
    return undefined;
  }

  /**
   * Get child sidebar items for a given parent id.
   */
  getSidebarChildren(parentId: string): UISidebarItem[] {
    return this.sortByOrder(
      Array.from(this.sidebarItems.values()).filter((item) => item.parentId === parentId),
    );
  }

  /**
   * Get all extensions registered by a specific plugin.
   */
  getExtensionsByPlugin(pluginId: string): {
    sidebarItems: UISidebarItem[];
    topbarActions: UITopbarAction[];
    pages: UIPage[];
    widgets: UIWidget[];
    dashboardCards: UIDashboardCard[];
    actions: UIAction[];
    commands: UICommand[];
  } {
    const filter = <T extends { pluginId: string }>(map: Map<string, T>): T[] =>
      Array.from(map.values()).filter((item) => item.pluginId === pluginId);

    return {
      sidebarItems: this.sortByOrder(filter(this.sidebarItems)),
      topbarActions: this.sortByOrder(filter(this.topbarActions)),
      pages: this.sortByOrder(filter(this.pages)),
      widgets: filter(this.widgets),
      dashboardCards: this.sortByOrder(filter(this.dashboardCards)),
      actions: filter(this.actions),
      commands: filter(this.commands),
    };
  }

  /**
   * Check if any extension with the given id exists in the registry.
   */
  has(id: string): boolean {
    return (
      this.sidebarItems.has(id) ||
      this.topbarActions.has(id) ||
      this.pages.has(id) ||
      this.widgets.has(id) ||
      this.dashboardCards.has(id) ||
      this.actions.has(id) ||
      this.commands.has(id)
    );
  }

  // ============================================================
  // INTERNAL UTILITIES
  // ============================================================

  /**
   * Validate that required fields exist on an extension object.
   * Throws UIRegistryValidationError if any are missing.
   */
  private validateRequiredFields(obj: Record<string, any>, fields: string[]): void {
    const missing = fields.filter((f) => {
      const val = obj[f];
      return val === undefined || val === null || val === '';
    });

    if (missing.length > 0) {
      throw new UIRegistryValidationError(
        `Missing required fields: ${missing.join(', ')} (object: ${JSON.stringify({ id: obj.id, pluginId: obj.pluginId })})`,
      );
    }
  }

  /**
   * Track that an extension id belongs to a plugin, for bulk unregister.
   */
  private trackPluginExtension(pluginId: string, extensionId: string): void {
    if (!this.pluginExtensions.has(pluginId)) {
      this.pluginExtensions.set(pluginId, new Set());
    }
    this.pluginExtensions.get(pluginId)!.add(extensionId);
  }

  /**
   * Resolve the set of active plugin IDs for a tenant.
   * Uses cached data if available, otherwise queries DB.
   */
  private async resolveTenantPlugins(tenantId: string): Promise<Set<string> | undefined> {
    // Use cache if available
    const cached = this.tenantActivePlugins.get(tenantId);
    if (cached) return cached;

    // Fallback: try to load from DB on-the-fly
    try {
      const { db } = await import('@/lib/db');
      const installed = await db.installedPlugin.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: { pluginId: true },
      });
      const pluginIds = new Set<string>();
      for (const ip of installed) {
        pluginIds.add(ip.pluginId);
      }
      this.tenantActivePlugins.set(tenantId, pluginIds);
      return pluginIds;
    } catch {
      return undefined;
    }
  }

  /**
   * Sort an array of objects with optional `order` field.
   * Defaults order to 0, then breaks ties by id for stability.
   */
  private sortByOrder<T extends { order?: number; id: string }>(items: T[]): T[] {
    return items.sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.id.localeCompare(b.id);
    });
  }

  // ── Serializers: strip non-serializable fields ───────────

  private serializeSidebarItem(item: UISidebarItem): Record<string, any> {
    return {
      id: item.id,
      pluginId: item.pluginId,
      label: item.label,
      icon: item.icon ?? null,
      href: item.href ?? null,
      section: item.section ?? null,
      order: item.order ?? 0,
      parentId: item.parentId ?? null,
      badge: item.badge ?? null,
      permission: item.permission ?? null,
    };
  }

  private serializeTopbarAction(action: UITopbarAction): Record<string, any> {
    return {
      id: action.id,
      pluginId: action.pluginId,
      label: action.label,
      icon: action.icon ?? null,
      action: action.action,
      order: action.order ?? 0,
      permission: action.permission ?? null,
    };
  }

  private serializePage(page: UIPage): Record<string, any> {
    return {
      id: page.id,
      pluginId: page.pluginId,
      path: page.path,
      title: page.title,
      icon: page.icon ?? null,
      component: page.component ?? null,
      permissions: page.permissions ?? [],
      layout: page.layout ?? null,
      order: page.order ?? 0,
    };
  }

  private serializeWidget(widget: UIWidget): Record<string, any> {
    return {
      id: widget.id,
      pluginId: widget.pluginId,
      type: widget.type,
      title: widget.title,
      component: widget.component ?? null,
      size: widget.size ?? 'md',
      config: widget.config ?? {},
      permissions: widget.permissions ?? [],
    };
  }

  private serializeDashboardCard(card: UIDashboardCard): Record<string, any> {
    return {
      id: card.id,
      pluginId: card.pluginId,
      title: card.title,
      description: card.description ?? null,
      icon: card.icon ?? null,
      value: card.value ?? null,
      trend: card.trend ?? null,
      href: card.href ?? null,
      color: card.color ?? null,
      order: card.order ?? 0,
    };
  }

  private serializeAction(action: UIAction): Record<string, any> {
    return {
      id: action.id,
      pluginId: action.pluginId,
      label: action.label,
      icon: action.icon ?? null,
      action: action.action,
      shortcut: action.shortcut ?? null,
      permission: action.permission ?? null,
      contexts: action.contexts ?? [],
    };
  }

  private serializeCommand(command: UICommand): Record<string, any> {
    return {
      id: command.id,
      pluginId: command.pluginId,
      label: command.label,
      icon: command.icon ?? null,
      command: command.command,
      shortcut: command.shortcut ?? null,
      keywords: command.keywords ?? [],
      permission: command.permission ?? null,
    };
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: UIRegistry | undefined;

/**
 * Get the global UIRegistry singleton.
 * Creates the instance on first call; subsequent calls return the same instance.
 */
export function getUIRegistry(): UIRegistry {
  if (!_instance) {
    _instance = new UIRegistry();
  }
  return _instance;
}
