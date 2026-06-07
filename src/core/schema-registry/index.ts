// ============================================================
// AENEWS Enterprise OS — Schema Registry
// ============================================================
// Dynamic schema management. Plugins declare objects/fields/
// relations/indexes/constraints. The Schema Registry generates
// DB mappings, API schemas, UI forms, and validation rules.
//
// Architecture:
//   Plugin → registerSchema()
//   SchemaRegistry → stores object definitions
//   Generate → DB migrations, API routes, UI components, Validation
//
// This makes AENEWS totally dynamic — new objects don't require
// code changes, just schema declarations.
// ============================================================

// ============================================================
// Types
// ============================================================

export type FieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'float'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'phone'
  | 'url'
  | 'select'
  | 'multiselect'
  | 'relation'
  | 'file'
  | 'json'
  | 'computed';

export type RelationType = 'one_to_one' | 'one_to_many' | 'many_to_many';

export interface FieldDefinition {
  /** Unique field name within the object */
  name: string;
  /** Display label */
  label: string;
  /** Field type */
  type: FieldType;
  /** Description */
  description?: string;
  /** Whether this field is required */
  required?: boolean;
  /** Default value */
  defaultValue?: unknown;
  /** Validation rules */
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    unique?: boolean;
  };
  /** For select/multiselect — available options */
  options?: Array<{ label: string; value: string }>;
  /** For relation fields */
  relation?: {
    object: string;
    type: RelationType;
    foreignKey?: string;
    onDelete?: 'cascade' | 'set_null' | 'restrict';
  };
  /** For computed fields */
  compute?: string;
  /** Whether this field is searchable */
  searchable?: boolean;
  /** Whether this field appears in list views by default */
  showInList?: boolean;
  /** Whether this field appears in detail views by default */
  showInDetail?: boolean;
  /** Sort order */
  order?: number;
  /** UI component override */
  component?: string;
}

export interface IndexDefinition {
  name: string;
  fields: string[];
  unique?: boolean;
}

export interface ObjectDefinition {
  /** Unique identifier, e.g. "crm.contact" */
  id: string;
  /** Plugin that owns this object */
  pluginId: string;
  /** Object name (singular, lowercase) */
  name: string;
  /** Plural name */
  namePlural: string;
  /** Display label (singular) */
  labelSingular: string;
  /** Display label (plural) */
  labelPlural: string;
  /** Icon for UI */
  icon?: string;
  /** Description */
  description?: string;
  /** Fields */
  fields: FieldDefinition[];
  /** Indexes */
  indexes?: IndexDefinition[];
  /** Category */
  category?: string;
  /** Tags */
  tags?: string[];
  /** Permissions */
  permissions?: {
    create?: string;
    read?: string;
    update?: string;
    delete?: string;
  };
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface SchemaRegistryStats {
  totalObjects: number;
  totalFields: number;
  byPlugin: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface GeneratedAPISchema {
  endpoint: string;
  method: string;
  description: string;
  parameters: Record<string, unknown>;
}

// ============================================================
// Schema Registry
// ============================================================

export class SchemaRegistry {
  private objects: Map<string, ObjectDefinition> = new Map();
  private pluginIndex: Map<string, Set<string>> = new Map();

  constructor() {
    console.log('[SchemaRegistry] Initialized');
  }

  // ============================================================
  // Registration
  // ============================================================

  /**
   * Register a new object schema.
   */
  register(object: ObjectDefinition): void {
    this.validateObject(object);

    if (this.objects.has(object.id)) {
      console.warn(`[SchemaRegistry] Object "${object.id}" is being overwritten.`);
    }

    this.objects.set(object.id, object);

    // Plugin index
    if (!this.pluginIndex.has(object.pluginId)) {
      this.pluginIndex.set(object.pluginId, new Set());
    }
    this.pluginIndex.get(object.pluginId)!.add(object.id);

    console.log(
      `[SchemaRegistry] Registered object "${object.id}" with ${object.fields.length} field(s) (plugin: ${object.pluginId})`,
    );
  }

  // ============================================================
  // Unregistration
  // ============================================================

  unregister(objectId: string): void {
    const obj = this.objects.get(objectId);
    if (!obj) return;

    const pluginIds = this.pluginIndex.get(obj.pluginId);
    if (pluginIds) {
      pluginIds.delete(objectId);
      if (pluginIds.size === 0) this.pluginIndex.delete(obj.pluginId);
    }

    this.objects.delete(objectId);
  }

  unregisterByPlugin(pluginId: string): void {
    const objectIds = this.pluginIndex.get(pluginId);
    if (!objectIds) return;

    for (const objectId of objectIds) {
      this.objects.delete(objectId);
    }

    this.pluginIndex.delete(pluginId);
  }

  // ============================================================
  // Getters
  // ============================================================

  get(objectId: string): ObjectDefinition | undefined {
    return this.objects.get(objectId);
  }

  getAll(): ObjectDefinition[] {
    return Array.from(this.objects.values());
  }

  getByPlugin(pluginId: string): ObjectDefinition[] {
    const ids = this.pluginIndex.get(pluginId);
    if (!ids) return [];
    return Array.from(ids)
      .map((id) => this.objects.get(id))
      .filter(Boolean) as ObjectDefinition[];
  }

  /**
   * Get a specific field from an object.
   */
  getField(objectId: string, fieldName: string): FieldDefinition | undefined {
    const obj = this.objects.get(objectId);
    return obj?.fields.find((f) => f.name === fieldName);
  }

  /**
   * Get all relation fields for an object.
   */
  getRelations(objectId: string): FieldDefinition[] {
    const obj = this.objects.get(objectId);
    return obj?.fields.filter((f) => f.type === 'relation') ?? [];
  }

  /**
   * Get all searchable fields for an object.
   */
  getSearchableFields(objectId: string): FieldDefinition[] {
    const obj = this.objects.get(objectId);
    return obj?.fields.filter((f) => f.searchable !== false) ?? [];
  }

  // ============================================================
  // Generation
  // ============================================================

  /**
   * Generate Prisma-compatible model definition.
   */
  generatePrismaModel(object: ObjectDefinition): string {
    const lines: string[] = [];
    lines.push(`model ${toPascalCase(object.name)} {`);

    // ID field
    lines.push(`  id        String   @id @default(cuid())`);

    // Tenant isolation
    lines.push(`  tenantId  String`);

    // Fields
    for (const field of object.fields) {
      lines.push(this.generatePrismaField(field, object.name));
    }

    // Timestamps
    lines.push(`  createdAt DateTime @default(now())`);
    lines.push(`  updatedAt DateTime @updatedAt`);

    // Indexes
    lines.push('');

    lines.push(`  @@index([tenantId])`);

    if (object.indexes) {
      for (const index of object.indexes) {
        if (index.unique) {
          lines.push(`  @@unique([${index.fields.join(', ')}])`);
        } else {
          lines.push(`  @@index([${index.fields.join(', ')}])`);
        }
      }
    }

    lines.push(`}`);
    return lines.join('\n');
  }

  /**
   * Generate API route definitions for an object.
   */
  generateAPIRoutes(object: ObjectDefinition): GeneratedAPISchema[] {
    const base = `/api/objects/${object.name}`;
    const routes: GeneratedAPISchema[] = [
      {
        endpoint: base,
        method: 'GET',
        description: `List ${object.labelPlural}`,
        parameters: { page: 1, limit: 20, sort: 'createdAt', order: 'desc' },
      },
      {
        endpoint: `${base}/:id`,
        method: 'GET',
        description: `Get a single ${object.labelSingular}`,
        parameters: {},
      },
      {
        endpoint: base,
        method: 'POST',
        description: `Create a ${object.labelSingular}`,
        parameters: this.generateFieldParams(object.fields.filter((f) => f.name !== 'id')),
      },
      {
        endpoint: `${base}/:id`,
        method: 'PUT',
        description: `Update a ${object.labelSingular}`,
        parameters: { _partial: true },
      },
      {
        endpoint: `${base}/:id`,
        method: 'DELETE',
        description: `Delete a ${object.labelSingular}`,
        parameters: {},
      },
    ];

    return routes;
  }

  /**
   * Generate JSON Schema for API validation.
   */
  generateJSONSchema(object: ObjectDefinition): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const field of object.fields) {
      properties[field.name] = this.fieldToJSONSchema(field);
      if (field.required) required.push(field.name);
    }

    return {
      type: 'object',
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }

  /**
   * Generate form field configuration for the UI Builder.
   */
  generateFormConfig(object: ObjectDefinition): Array<Record<string, unknown>> {
    return object.fields
      .filter((f) => !f.compute)
      .map((field) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required ?? false,
        defaultValue: field.defaultValue,
        options: field.options,
        description: field.description,
        component: field.component,
        validation: field.validation,
        order: field.order ?? 0,
      }));
  }

  // ============================================================
  // Search
  // ============================================================

  search(query: string): ObjectDefinition[] {
    const normalized = query.toLowerCase().trim();
    return this.getAll().filter(
      (obj) =>
        obj.id.toLowerCase().includes(normalized) ||
        obj.name.toLowerCase().includes(normalized) ||
        obj.labelSingular.toLowerCase().includes(normalized) ||
        obj.labelPlural.toLowerCase().includes(normalized) ||
        obj.description?.toLowerCase().includes(normalized) ||
        obj.category?.toLowerCase().includes(normalized) ||
        obj.tags?.some((t) => t.toLowerCase().includes(normalized)),
    );
  }

  // ============================================================
  // Statistics
  // ============================================================

  getStats(): SchemaRegistryStats {
    const byPlugin: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let totalFields = 0;

    for (const obj of this.objects.values()) {
      byPlugin[obj.pluginId] = (byPlugin[obj.pluginId] ?? 0) + 1;
      if (obj.category) {
        byCategory[obj.category] = (byCategory[obj.category] ?? 0) + 1;
      }
      totalFields += obj.fields.length;
    }

    return { totalObjects: this.objects.size, totalFields, byPlugin, byCategory };
  }

  has(objectId: string): boolean {
    return this.objects.has(objectId);
  }

  get size(): number {
    return this.objects.size;
  }

  // ============================================================
  // Maintenance
  // ============================================================

  clear(): void {
    this.objects.clear();
    this.pluginIndex.clear();
  }

  // ============================================================
  // Internal
  // ============================================================

  private validateObject(object: ObjectDefinition): void {
    if (!object.id || typeof object.id !== 'string') {
      throw new Error('Object must have a non-empty string "id"');
    }
    if (!object.pluginId || typeof object.pluginId !== 'string') {
      throw new Error('Object must have a non-empty "pluginId"');
    }
    if (!object.name || typeof object.name !== 'string') {
      throw new Error('Object must have a non-empty "name"');
    }
    if (!object.fields || !Array.isArray(object.fields) || object.fields.length === 0) {
      throw new Error('Object must have a non-empty "fields" array');
    }

    // Check for duplicate field names
    const fieldNames = new Set<string>();
    for (const field of object.fields) {
      if (fieldNames.has(field.name)) {
        throw new Error(`Duplicate field name "${field.name}" in object "${object.id}"`);
      }
      fieldNames.add(field.name);
    }
  }

  private generatePrismaField(field: FieldDefinition, objectName: string): string {
    const indent = '  ';
    let line = `${indent}${field.name}  `;

    switch (field.type) {
      case 'string':
      case 'email':
      case 'phone':
      case 'url':
      case 'select':
        line += 'String';
        break;
      case 'text':
        line += 'String';
        break;
      case 'number':
      case 'float':
        line += 'Float';
        break;
      case 'boolean':
        line += 'Boolean';
        break;
      case 'date':
      case 'datetime':
        line += 'DateTime';
        break;
      case 'json':
        line += 'String'; // Stored as JSON string in SQLite
        break;
      case 'relation':
        line += 'String'; // FK stored as String
        break;
      case 'file':
        line += 'String';
        break;
      case 'computed':
        return ''; // Computed fields don't get stored
      default:
        line += 'String';
    }

    // Default value
    if (field.defaultValue !== undefined && field.type !== 'relation') {
      if (typeof field.defaultValue === 'string') {
        line += `   @default("${field.defaultValue}")`;
      } else if (typeof field.defaultValue === 'boolean') {
        line += `   @default(${field.defaultValue})`;
      } else if (typeof field.defaultValue === 'number') {
        line += `   @default(${field.defaultValue})`;
      }
    }

    // Optional marker
    if (!field.required && field.type !== 'boolean') {
      line += '   ?';
    }

    // Unique constraint
    if (field.validation?.unique) {
      line += '   @unique';
    }

    return line;
  }

  private fieldToJSONSchema(field: FieldDefinition): Record<string, unknown> {
    const schema: Record<string, unknown> = {
      type: this.fieldTypeToJSONType(field.type),
      description: field.description,
    };

    if (field.type === 'select' || field.type === 'multiselect') {
      schema.enum = field.options?.map((o) => o.value) ?? [];
    }

    if (field.validation) {
      if (field.validation.minLength) schema.minLength = field.validation.minLength;
      if (field.validation.maxLength) schema.maxLength = field.validation.maxLength;
      if (field.validation.min) schema.minimum = field.validation.min;
      if (field.validation.max) schema.maximum = field.validation.max;
      if (field.validation.pattern) schema.pattern = field.validation.pattern;
    }

    return schema;
  }

  private fieldTypeToJSONType(type: FieldType): string {
    switch (type) {
      case 'string':
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
      case 'select':
      case 'multiselect':
      case 'relation':
      case 'file':
      case 'json':
        return 'string';
      case 'number':
      case 'float':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'date':
      case 'datetime':
        return 'string'; // ISO date string
      case 'computed':
        return 'string';
      default:
        return 'string';
    }
  }

  private generateFieldParams(fields: FieldDefinition[]): Record<string, unknown> {
    const params: Record<string, unknown> = {};
    for (const field of fields) {
      params[field.name] = {
        type: field.type,
        label: field.label,
        required: field.required ?? false,
      };
    }
    return params;
  }
}

// ============================================================
// Helpers
// ============================================================

function toPascalCase(str: string): string {
  return str
    .split(/[_\s-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

// ============================================================
// Singleton
// ============================================================

let _instance: SchemaRegistry | undefined;

export function getSchemaRegistry(): SchemaRegistry {
  if (!_instance) {
    _instance = new SchemaRegistry();
  }
  return _instance;
}

export function resetSchemaRegistry(): void {
  _instance = undefined;
}
