// ============================================================
// AENEWS Enterprise OS — Builder Engine Foundation
// Drag-and-drop component builder for forms, pages, widgets,
// dashboards, reports, tables, agents, and automations.
//
// Architecture:
//   BuilderComponentType
//     ↓ createComponent()
//   BuilderEngine
//     ↓ persist
//   BuilderComponent model (Prisma)
//     ↓
//   Schema validation, export / import, duplication
//
// The engine manages the lifecycle of builder components:
// creation, retrieval, update, deletion, duplication, and
// cross-instance import/export.  Schema validation ensures
// structural integrity of field definitions and action configs.
// ============================================================

import { db } from '@/lib/db';

// ============================================================
// Types — Component & Schema
// ============================================================

export type BuilderComponentType =
  | 'form'
  | 'page'
  | 'widget'
  | 'dashboard'
  | 'report'
  | 'table'
  | 'agent'
  | 'automation';

export type BuilderFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'richtext'
  | 'file'
  | 'relation'
  | 'custom';

export type BuilderActionType =
  | 'submit'
  | 'api_call'
  | 'navigate'
  | 'event'
  | 'workflow';

/** A single field definition inside a component schema. */
export interface BuilderField {
  id: string;
  name: string;
  type: BuilderFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
  validation?: Record<string, any>;
  config?: Record<string, any>;
}

/** An action that a component can perform. */
export interface BuilderAction {
  id: string;
  name: string;
  type: BuilderActionType;
  config: Record<string, any>;
}

/** The structural schema of a component (fields + actions). */
export interface BuilderSchema {
  fields: BuilderField[];
  actions?: BuilderAction[];
}

/** A persisted builder component. */
export interface BuilderComponent {
  id: string;
  type: BuilderComponentType;
  name: string;
  description?: string;
  config: Record<string, any>;
  pluginId?: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Result of schema validation. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Stats returned by getStats(). */
export interface BuilderStats {
  totalComponents: number;
  byType: Record<string, number>;
}

// ============================================================
// Valid component type set (for runtime validation)
// ============================================================

const VALID_COMPONENT_TYPES: ReadonlySet<BuilderComponentType> = new Set([
  'form',
  'page',
  'widget',
  'dashboard',
  'report',
  'table',
  'agent',
  'automation',
]);

const VALID_FIELD_TYPES: ReadonlySet<BuilderFieldType> = new Set([
  'text',
  'number',
  'boolean',
  'select',
  'multiselect',
  'date',
  'email',
  'phone',
  'textarea',
  'richtext',
  'file',
  'relation',
  'custom',
]);

const VALID_ACTION_TYPES: ReadonlySet<BuilderActionType> = new Set([
  'submit',
  'api_call',
  'navigate',
  'event',
  'workflow',
]);

// ============================================================
// Custom Errors
// ============================================================

export class ComponentNotFoundError extends Error {
  constructor(public readonly componentId: string) {
    super(`Builder component "${componentId}" not found.`);
    this.name = 'ComponentNotFoundError';
  }
}

export class ComponentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComponentValidationError';
  }
}

export class ComponentImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComponentImportError';
  }
}

// ============================================================
// BuilderEngine
// ============================================================

export class BuilderEngine {
  private _initialized = false;

  // ===========================================================
  // Initialisation
  // ===========================================================

  async initialize(): Promise<void> {
    if (this._initialized) return;

    console.log('[BuilderEngine] Initialized.');
    this._initialized = true;
  }

  // ===========================================================
  // CRUD — Component lifecycle
  // ===========================================================

  /**
   * Create a new builder component.
   * @param type   The component type (form, page, widget, etc.)
   * @param name   Human-readable component name
   * @param tenantId  Owning tenant
   * @param config Optional initial configuration (schema, layout, etc.)
   * @param pluginId  Optional plugin that owns this component
   */
  async createComponent(
    type: BuilderComponentType,
    name: string,
    tenantId: string,
    config?: Record<string, any>,
    pluginId?: string,
  ): Promise<BuilderComponent> {
    if (!VALID_COMPONENT_TYPES.has(type)) {
      throw new ComponentValidationError(
        `Invalid component type: "${type}". Must be one of: ${Array.from(VALID_COMPONENT_TYPES).join(', ')}.`,
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ComponentValidationError('Component name is required.');
    }

    const resolvedConfig = config ?? {};

    // ── Validate schema if present in config ─────────────────
    if (resolvedConfig.schema) {
      const validation = this.validateSchema(resolvedConfig.schema);
      if (!validation.valid) {
        throw new ComponentValidationError(
          `Schema validation failed: ${validation.errors.join('; ')}`,
        );
      }
    }

    const record = await db.builderComponent.create({
      data: {
        type,
        name: name.trim(),
        config: JSON.stringify(resolvedConfig),
        pluginId: pluginId ?? null,
        tenantId,
      },
    });

    console.log(
      `[BuilderEngine] Created ${type} component "${record.id}" ("${name}") for tenant "${tenantId}".`,
    );
    return this.toDomainComponent(record);
  }

  /**
   * Get a single component by ID.
   */
  async getComponent(id: string): Promise<BuilderComponent | null> {
    const record = await db.builderComponent.findUnique({
      where: { id },
    });
    return record ? this.toDomainComponent(record) : null;
  }

  /**
   * List components for a tenant, optionally filtered by type.
   */
  async listComponents(
    tenantId: string,
    type?: BuilderComponentType,
  ): Promise<BuilderComponent[]> {
    const where: Record<string, any> = { tenantId };
    if (type) {
      where.type = type;
    }

    const records = await db.builderComponent.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    });

    return records.map((r: any) => this.toDomainComponent(r));
  }

  /**
   * Update an existing component (partial update).
   * Accepts any subset of: name, description, config, type.
   */
  async updateComponent(
    id: string,
    data: Partial<Pick<BuilderComponent, 'name' | 'description' | 'type' | 'config'>>,
  ): Promise<BuilderComponent> {
    const existing = await db.builderComponent.findUnique({ where: { id } });
    if (!existing) {
      throw new ComponentNotFoundError(id);
    }

    const updateData: Record<string, any> = {};

    if (data.name !== undefined) {
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        throw new ComponentValidationError('Component name is required.');
      }
      updateData.name = data.name.trim();
    }

    if (data.description !== undefined) {
      updateData.description = data.description ?? null;
    }

    if (data.type !== undefined) {
      if (!VALID_COMPONENT_TYPES.has(data.type)) {
        throw new ComponentValidationError(
          `Invalid component type: "${data.type}". Must be one of: ${Array.from(VALID_COMPONENT_TYPES).join(', ')}.`,
        );
      }
      updateData.type = data.type;
    }

    if (data.config !== undefined) {
      // ── Validate schema if present in config ───────────────
      if (data.config.schema) {
        const validation = this.validateSchema(data.config.schema);
        if (!validation.valid) {
          throw new ComponentValidationError(
            `Schema validation failed: ${validation.errors.join('; ')}`,
          );
        }
      }
      updateData.config = JSON.stringify(data.config);
    }

    const updated = await db.builderComponent.update({
      where: { id },
      data: updateData,
    });

    console.log(`[BuilderEngine] Updated component "${id}".`);
    return this.toDomainComponent(updated);
  }

  /**
   * Delete a component by ID.
   */
  async deleteComponent(id: string): Promise<void> {
    const existing = await db.builderComponent.findUnique({ where: { id } });
    if (!existing) {
      throw new ComponentNotFoundError(id);
    }

    await db.builderComponent.delete({ where: { id } });
    console.log(`[BuilderEngine] Deleted component "${id}".`);
  }

  // ===========================================================
  // Duplication
  // ===========================================================

  /**
   * Duplicate a component.  Creates a copy with a suffixed name
   * and a fresh ID.  All config (schema, layout, etc.) is deep-copied.
   */
  async duplicateComponent(id: string): Promise<BuilderComponent> {
    const existing = await db.builderComponent.findUnique({ where: { id } });
    if (!existing) {
      throw new ComponentNotFoundError(id);
    }

    const original = this.toDomainComponent(existing);
    const duplicateName = `${original.name} (Copy)`;

    const duplicate = await db.builderComponent.create({
      data: {
        type: original.type,
        name: duplicateName,
        description: original.description ?? null,
        config: JSON.stringify(original.config),
        pluginId: original.pluginId ?? null,
        tenantId: original.tenantId,
      },
    });

    console.log(
      `[BuilderEngine] Duplicated component "${id}" → "${duplicate.id}" as "${duplicateName}".`,
    );
    return this.toDomainComponent(duplicate);
  }

  // ===========================================================
  // Export / Import
  // ===========================================================

  /**
   * Export a component as a JSON string.
   * Produces a portable representation that can be re-imported
   * into any tenant.
   */
  async exportComponent(id: string): Promise<string> {
    const record = await db.builderComponent.findUnique({ where: { id } });
    if (!record) {
      throw new ComponentNotFoundError(id);
    }

    const component = this.toDomainComponent(record);

    const exportData = {
      __version: '1.0.0',
      __exportedAt: new Date().toISOString(),
      __sourceId: component.id,
      type: component.type,
      name: component.name,
      description: component.description ?? undefined,
      config: component.config,
      pluginId: component.pluginId ?? undefined,
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import a component from a JSON export string.
   * Creates a new component in the specified tenant.
   * Validates the JSON structure and schema before importing.
   */
  async importComponent(json: string, tenantId: string): Promise<BuilderComponent> {
    let parsed: any;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new ComponentImportError('Invalid JSON: failed to parse import data.');
    }

    // ── Validate import structure ───────────────────────────
    if (!parsed.type || !parsed.name) {
      throw new ComponentImportError(
        'Invalid import data: "type" and "name" are required.',
      );
    }

    if (!VALID_COMPONENT_TYPES.has(parsed.type)) {
      throw new ComponentImportError(
        `Invalid component type: "${parsed.type}". Must be one of: ${Array.from(VALID_COMPONENT_TYPES).join(', ')}.`,
      );
    }

    // ── Validate schema if present ────────────────────────────
    if (parsed.config?.schema) {
      const validation = this.validateSchema(parsed.config.schema);
      if (!validation.valid) {
        throw new ComponentImportError(
          `Schema validation failed: ${validation.errors.join('; ')}`,
        );
      }
    }

    const component = await this.createComponent(
      parsed.type,
      parsed.name,
      tenantId,
      parsed.config ?? {},
      parsed.pluginId,
    );

    console.log(
      `[BuilderEngine] Imported component "${component.id}" (${parsed.type}) into tenant "${tenantId}".`,
    );
    return component;
  }

  // ===========================================================
  // Schema Validation
  // ===========================================================

  /**
   * Validate a BuilderSchema.
   * Checks field definitions for structural integrity:
   *   - Required fields present
   *   - Valid field types
   *   - Valid action types
   *   - Duplicate IDs
   *   - Duplicate names
   */
  validateSchema(schema: BuilderSchema): ValidationResult {
    const errors: string[] = [];

    if (!schema || !Array.isArray(schema.fields)) {
      return { valid: false, errors: ['Schema must have a "fields" array.'] };
    }

    // ── Validate fields ──────────────────────────────────────
    const fieldIds = new Set<string>();
    const fieldNames = new Set<string>();

    for (let i = 0; i < schema.fields.length; i++) {
      const field = schema.fields[i];

      // Required properties
      if (!field.id) {
        errors.push(`Field at index ${i} is missing "id".`);
      }
      if (!field.name) {
        errors.push(`Field at index ${i} is missing "name".`);
      }
      if (!field.type) {
        errors.push(`Field at index ${i} is missing "type".`);
      }
      if (!field.label) {
        errors.push(`Field at index ${i} is missing "label".`);
      }

      // Validate field type
      if (field.type && !VALID_FIELD_TYPES.has(field.type)) {
        errors.push(
          `Field "${field.id ?? i}" has invalid type "${field.type}". Must be one of: ${Array.from(VALID_FIELD_TYPES).join(', ')}.`,
        );
      }

      // Check for duplicate IDs
      if (field.id) {
        if (fieldIds.has(field.id)) {
          errors.push(`Duplicate field ID: "${field.id}".`);
        }
        fieldIds.add(field.id);
      }

      // Check for duplicate names
      if (field.name) {
        if (fieldNames.has(field.name)) {
          errors.push(`Duplicate field name: "${field.name}".`);
        }
        fieldNames.add(field.name);
      }

      // Validate select/multiselect options
      if (
        (field.type === 'select' || field.type === 'multiselect') &&
        field.options &&
        !Array.isArray(field.options)
      ) {
        errors.push(`Field "${field.id ?? i}" of type "${field.type}" must have an "options" array.`);
      }
    }

    // ── Validate actions (if present) ────────────────────────
    if (schema.actions && Array.isArray(schema.actions)) {
      const actionIds = new Set<string>();

      for (let i = 0; i < schema.actions.length; i++) {
        const action = schema.actions[i];

        if (!action.id) {
          errors.push(`Action at index ${i} is missing "id".`);
        }
        if (!action.name) {
          errors.push(`Action at index ${i} is missing "name".`);
        }
        if (!action.type) {
          errors.push(`Action at index ${i} is missing "type".`);
        }

        // Validate action type
        if (action.type && !VALID_ACTION_TYPES.has(action.type)) {
          errors.push(
            `Action "${action.id ?? i}" has invalid type "${action.type}". Must be one of: ${Array.from(VALID_ACTION_TYPES).join(', ')}.`,
          );
        }

        // Check for duplicate IDs
        if (action.id) {
          if (actionIds.has(action.id)) {
            errors.push(`Duplicate action ID: "${action.id}".`);
          }
          actionIds.add(action.id);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ===========================================================
  // Stats
  // ===========================================================

  /**
   * Get aggregate statistics across all tenants.
   */
  async getStats(): Promise<BuilderStats> {
    const components = await db.builderComponent.findMany({
      select: { type: true },
    });

    const byType: Record<string, number> = {};
    for (const component of components) {
      byType[component.type] = (byType[component.type] ?? 0) + 1;
    }

    return {
      totalComponents: components.length,
      byType,
    };
  }

  // ===========================================================
  // Private helpers
  // ===========================================================

  /**
   * Convert a raw Prisma BuilderComponent record to a domain object.
   */
  private toDomainComponent(record: any): BuilderComponent {
    let config: Record<string, any> = {};
    try {
      config = JSON.parse(record.config);
    } catch {
      config = {};
    }

    return {
      id: record.id,
      type: record.type,
      name: record.name,
      description: record.description ?? undefined,
      config,
      pluginId: record.pluginId ?? undefined,
      tenantId: record.tenantId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}

// ============================================================
// Singleton accessor
// ============================================================

let _builderEngine: BuilderEngine | null = null;

export function getBuilderEngine(): BuilderEngine {
  if (!_builderEngine) {
    _builderEngine = new BuilderEngine();
  }
  return _builderEngine;
}
