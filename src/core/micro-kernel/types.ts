/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * Core Type Definitions — The Immutable Foundation
 *
 * RÈGLE ABSOLUE : Ces types ne changent JAMAIS.
 * Le Kernel est minimal, déterministe et immuable.
 */

// ─── Plugin Identity ───────────────────────────────────────────────

export interface PluginId {
  id: string;
  version: string;
}

export type PluginCategory = 'system' | 'business';
export type PluginState = 'discovered' | 'validated' | 'resolving' | 'ready' | 'active' | 'deactivating' | 'inactive' | 'error' | 'updating';

export interface PluginManifest {
  aenews: '1';
  id: string;
  slug: string;
  name: string;
  description: string;
  version: string;
  category: PluginCategory;
  author: string;
  license: string;
  provides?: string[];
  dependencies?: PluginDependency[];
  kernelVersion?: string;
  compatibility?: Record<string, string>;
  capabilities?: CapabilityDefinition[];
  tools?: ToolDefinition[];
  schemas?: SchemaDefinition[];
  menus?: MenuDefinition[];
  events?: EventDefinition[];
  workflows?: WorkflowDefinition[];
  knowledge?: KnowledgeDefinition[];
  agents?: AgentDefinition[];
  widgets?: WidgetDefinition[];
  dashboard?: DashboardCardDefinition[];
  permissions?: string[];
  settings?: SettingDefinition[];
  entry?: { server?: string };
  tags?: string[];
  icon?: string;
  color?: string;
}

export interface PluginDependency {
  id: string;
  version: string;
  required?: boolean;
}

export interface CapabilityDefinition {
  id: string;
  type: 'search' | 'create' | 'read' | 'update' | 'delete' | 'sync' | 'notify' | 'analyze' | 'export' | 'import' | 'custom';
  description: string;
  entity?: string;
  schema?: string;
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  rateLimit?: number;
  cacheTTL?: number;
}

export interface SchemaDefinition {
  id: string;
  name: string;
  fields: FieldDefinition[];
  relations?: RelationDefinition[];
}

export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'email' | 'url' | 'select' | 'multiselect' | 'json' | 'file' | 'reference';
  label: string;
  required?: boolean;
  unique?: boolean;
  options?: { label: string; value: string }[];
  referenceTo?: string;
}

export interface RelationDefinition {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  target: string;
  field?: string;
  through?: string;
}

export interface MenuDefinition {
  id: string;
  label: string;
  icon?: string;
  path: string;
  section?: string;
  order?: number;
  badge?: string;
  permission?: string;
}

export interface EventDefinition {
  id: string;
  name: string;
  description: string;
  payload?: Record<string, unknown>;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  trigger: { type: string; config: Record<string, unknown> };
  conditions?: { type: string; config: Record<string, unknown> }[];
  actions?: { type: string; config: Record<string, unknown> }[];
}

export interface KnowledgeDefinition {
  id: string;
  name: string;
  description: string;
  type: 'documents' | 'faq' | 'policies' | 'procedures' | 'training';
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities?: string[];
  tools?: string[];
  knowledge?: string[];
}

export interface WidgetDefinition {
  id: string;
  name: string;
  type: 'chart' | 'table' | 'list' | 'stat' | 'calendar' | 'kanban';
  config?: Record<string, unknown>;
}

export interface DashboardCardDefinition {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  metrics?: string[];
}

export interface SettingDefinition {
  id: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'json';
  default: unknown;
  options?: { label: string; value: string }[];
  description?: string;
}

// ─── Metadata Graph ──────────────────────────────────────────────

export interface MetadataNode {
  pluginId: string;
  pluginVersion: string;
  category: PluginCategory;
  state: PluginState;
  manifest: PluginManifest;
  validatedAt: number;
  checksum: string;
}

export interface MetadataEdge {
  from: string;
  to: string;
  versionConstraint: string;
  resolved: boolean;
}

export interface MetadataGraph {
  nodes: Map<string, MetadataNode>;
  edges: MetadataEdge[];
  root: string[];
  layers: string[][];
  timestamp: number;
}

// ─── Service Container ────────────────────────────────────────────

export type ServiceName =
  | 'logger' | 'config' | 'storage' | 'cache' | 'search'
  | 'eventBus' | 'ai' | 'notification' | 'workflow' | 'tenant'
  | 'security' | 'billing' | 'settings' | 'metrics';

export interface ServiceDescriptor {
  name: ServiceName;
  version: string;
  instance: unknown;
  provider: string;
  state: 'available' | 'starting' | 'ready' | 'stopping' | 'unavailable';
}

// ─── Registry Manager ───────────────────────────────────────────

export type RegistryType =
  | 'capability' | 'tool' | 'ui' | 'schema' | 'workflow'
  | 'knowledge' | 'agent' | 'search' | 'builder' | 'event';

export interface RegistryEntry {
  id: string;
  type: string;
  pluginId: string;
  data: unknown;
  registeredAt: number;
  version: string;
}

// ─── Kernel State ────────────────────────────────────────────────

export type KernelPhase = 'init' | 'booting' | 'discovering' | 'resolving' | 'loading' | 'ready' | 'running' | 'shutting-down' | 'stopped';

export interface KernelMetrics {
  bootTime: number;
  discoveryTime: number;
  pluginCount: { system: number; business: number; total: number };
  registryCount: number;
  serviceCount: number;
  memoryUsage: number;
  uptime: number;
}

export interface KernelState {
  phase: KernelPhase;
  phaseHistory: { phase: KernelPhase; timestamp: number }[];
  metrics: KernelMetrics;
  startedAt: number;
  version: string;
}

// ─── Event Bus ───────────────────────────────────────────────────

export interface EventBusEvent {
  id: string;
  type: string;
  source: string;
  payload: unknown;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface EventBusSubscription {
  id: string;
  pattern: string;
  handler: (event: EventBusEvent) => void | Promise<void>;
  once?: boolean;
  priority?: number;
}

// ─── Security ────────────────────────────────────────────────────

export interface SecurityContext {
  tenantId?: string;
  userId?: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
}

// ─── Lifecycle ───────────────────────────────────────────────────

export type LifecyclePhase = 'pre-install' | 'install' | 'post-install' | 'activate' | 'deactivate' | 'uninstall' | 'update' | 'rollback';

// ─── Hot Swap ────────────────────────────────────────────────────

export type HotSwapOperation = 'install' | 'activate' | 'deactivate' | 'update' | 'rollback' | 'remove';

export interface HotSwapResult {
  operation: HotSwapOperation;
  pluginId: string;
  success: boolean;
  duration: number;
  affectedServices: string[];
  affectedRegistries: string[];
  warnings: string[];
  errors: string[];
}

// ─── Simulation ──────────────────────────────────────────────────

export interface SimulationResult {
  id: string;
  type: 'install' | 'uninstall' | 'update' | 'migration' | 'rollback' | 'load' | 'conflict';
  success: boolean;
  impact: {
    affectedPlugins: string[];
    affectedServices: string[];
    affectedRegistries: string[];
    estimatedDowntime: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  warnings: string[];
  errors: string[];
  recommendations: string[];
}
