// ============================================================
// AENEWS Enterprise OS — Settings Engine
// Plugin-scoped settings with tenant-level overrides.
//
// Architecture:
//   Plugin manifest (defaults)
//     ↓ registerPluginSettings()
//   SettingsEngine
//     ↓ merge
//   Tenant overrides (DB — InstalledPlugin.settings JSON)
//     ↓
//   Final settings per plugin per tenant
//
// Each plugin declares its settings via PluginSettingDefinition
// objects.  Tenants can override those defaults, which are
// persisted in the InstalledPlugin.settings JSON column.
// ============================================================

import { db } from '@/lib/db';

// ============================================================
// Types
// ============================================================

export type SettingType = 'string' | 'number' | 'boolean' | 'select' | 'json';

export type SettingScope = 'global' | 'tenant' | 'user';

export type SettingSource = 'default' | 'tenant' | 'user';

/** Declares a single setting that a plugin exposes. */
export interface PluginSettingDefinition {
  key: string;
  type: SettingType;
  label: string;
  description?: string;
  defaultValue?: any;
  options?: Array<{ label: string; value: any }>;
  required?: boolean;
  scope?: SettingScope;
  group?: string;
}

/** Resolved setting value with provenance metadata. */
export interface PluginSettingValue {
  key: string;
  value: any;
  overridden: boolean;
  source: SettingSource;
}

// ============================================================
// Custom Errors
// ============================================================

export class PluginNotRegisteredError extends Error {
  constructor(public readonly pluginId: string) {
    super(`Plugin "${pluginId}" is not registered with the SettingsEngine.`);
    this.name = 'PluginNotRegisteredError';
  }
}

export class SettingNotFoundError extends Error {
  constructor(public readonly pluginId: string, public readonly key: string) {
    super(`Setting "${key}" not found for plugin "${pluginId}".`);
    this.name = 'SettingNotFoundError';
  }
}

export class SettingValidationError extends Error {
  constructor(message: string, public readonly pluginId: string, public readonly key: string) {
    super(message);
    this.name = 'SettingValidationError';
  }
}

// ============================================================
// SettingsEngine
// ============================================================

export class SettingsEngine {
  // ── In-memory registry of plugin setting definitions ──────
  private definitions = new Map<string, PluginSettingDefinition[]>();

  // ── Initialisation guard ──────────────────────────────────
  private _initialized = false;

  // ===========================================================
  // Initialisation
  // ===========================================================

  async initialize(): Promise<void> {
    if (this._initialized) return;

    console.log('[SettingsEngine] Initialized.');
    this._initialized = true;
  }

  // ===========================================================
  // Registry — Plugin setting definitions
  // ===========================================================

  /**
   * Register a plugin's setting definitions.
   * Plugins call this during their bootstrap phase so the
   * engine knows what keys, types, defaults, and validation
   * rules to apply.
   */
  registerPluginSettings(pluginId: string, settings: PluginSettingDefinition[]): void {
    // ── Validate definitions ──────────────────────────────────
    const keys = new Set<string>();
    for (const def of settings) {
      if (!def.key || !def.type || !def.label) {
        throw new Error(
          `Invalid setting definition for plugin "${pluginId}": key, type, and label are required.`,
        );
      }
      if (keys.has(def.key)) {
        throw new Error(
          `Duplicate setting key "${def.key}" for plugin "${pluginId}".`,
        );
      }
      keys.add(def.key);
    }

    this.definitions.set(pluginId, settings);
    console.log(
      `[SettingsEngine] Registered ${settings.length} setting(s) for plugin "${pluginId}".`,
    );
  }

  /**
   * Remove all setting definitions for a plugin.
   * Called during plugin uninstall / disable lifecycle.
   */
  unregisterPluginSettings(pluginId: string): void {
    const count = this.definitions.get(pluginId)?.length ?? 0;
    this.definitions.delete(pluginId);
    console.log(
      `[SettingsEngine] Unregistered ${count} setting(s) for plugin "${pluginId}".`,
    );
  }

  // ===========================================================
  // Read — Get resolved settings
  // ===========================================================

  /**
   * Get a single resolved setting value for a plugin + tenant.
   * Merges: plugin defaults ← tenant overrides.
   */
  async getSetting(pluginId: string, key: string, tenantId: string): Promise<any> {
    const defs = this.getDefinitionsOrThrow(pluginId);
    const def = defs.find((d) => d.key === key);
    if (!def) throw new SettingNotFoundError(pluginId, key);

    const overrides = await this.getTenantOverrides(pluginId, tenantId);

    if (overrides[key] !== undefined) {
      return overrides[key];
    }

    return def.defaultValue !== undefined ? def.defaultValue : null;
  }

  /**
   * Get all resolved settings for a plugin + tenant.
   * Returns a map of key → PluginSettingValue with provenance.
   */
  async getSettings(
    pluginId: string,
    tenantId: string,
  ): Promise<Record<string, PluginSettingValue>> {
    const defs = this.getDefinitionsOrThrow(pluginId);
    const overrides = await this.getTenantOverrides(pluginId, tenantId);

    const result: Record<string, PluginSettingValue> = {};

    for (const def of defs) {
      const hasOverride = overrides[def.key] !== undefined;
      result[def.key] = {
        key: def.key,
        value: hasOverride ? overrides[def.key] : (def.defaultValue !== undefined ? def.defaultValue : null),
        overridden: hasOverride,
        source: hasOverride ? 'tenant' : 'default',
      };
    }

    return result;
  }

  // ===========================================================
  // Write — Override settings at tenant level
  // ===========================================================

  /**
   * Set a single tenant-level override for a plugin setting.
   */
  async setSetting(
    pluginId: string,
    key: string,
    value: any,
    tenantId: string,
  ): Promise<void> {
    const defs = this.getDefinitionsOrThrow(pluginId);
    const def = defs.find((d) => d.key === key);
    if (!def) throw new SettingNotFoundError(pluginId, key);

    this.validateSettingValue(def, value);

    const overrides = await this.getTenantOverrides(pluginId, tenantId);
    overrides[key] = value;

    await this.saveTenantOverrides(pluginId, tenantId, overrides);
    console.log(
      `[SettingsEngine] Set "${key}" for plugin "${pluginId}" in tenant "${tenantId}".`,
    );
  }

  /**
   * Bulk-set multiple tenant-level overrides for a plugin.
   * All values are validated before any writes occur.
   */
  async setSettings(
    pluginId: string,
    values: Record<string, any>,
    tenantId: string,
  ): Promise<void> {
    const defs = this.getDefinitionsOrThrow(pluginId);

    // ── Validate all values before persisting ────────────────
    for (const [key, value] of Object.entries(values)) {
      const def = defs.find((d) => d.key === key);
      if (!def) throw new SettingNotFoundError(pluginId, key);
      this.validateSettingValue(def, value);
    }

    const overrides = await this.getTenantOverrides(pluginId, tenantId);
    Object.assign(overrides, values);

    await this.saveTenantOverrides(pluginId, tenantId, overrides);
    console.log(
      `[SettingsEngine] Set ${Object.keys(values).length} setting(s) for plugin "${pluginId}" in tenant "${tenantId}".`,
    );
  }

  /**
   * Reset a single setting to its default value.
   */
  async resetSetting(pluginId: string, key: string, tenantId: string): Promise<void> {
    const defs = this.getDefinitionsOrThrow(pluginId);
    const def = defs.find((d) => d.key === key);
    if (!def) throw new SettingNotFoundError(pluginId, key);

    const overrides = await this.getTenantOverrides(pluginId, tenantId);

    if (overrides[key] !== undefined) {
      delete overrides[key];
      await this.saveTenantOverrides(pluginId, tenantId, overrides);
      console.log(
        `[SettingsEngine] Reset "${key}" for plugin "${pluginId}" in tenant "${tenantId}".`,
      );
    }
  }

  /**
   * Reset ALL tenant-level overrides for a plugin back to defaults.
   */
  async resetAllSettings(pluginId: string, tenantId: string): Promise<void> {
    await this.saveTenantOverrides(pluginId, tenantId, {});
    console.log(
      `[SettingsEngine] Reset all settings for plugin "${pluginId}" in tenant "${tenantId}".`,
    );
  }

  // ===========================================================
  // Inspection — Defaults & Stats
  // ===========================================================

  /** Get the raw default values for a plugin's settings. */
  getDefaults(pluginId: string): Record<string, any> {
    const defs = this.definitions.get(pluginId);
    if (!defs) return {};

    const defaults: Record<string, any> = {};
    for (const def of defs) {
      if (def.defaultValue !== undefined) {
        defaults[def.key] = def.defaultValue;
      }
    }
    return defaults;
  }

  /** Get all registered plugin setting definitions. */
  getAllSettingsDefinitions(): Array<{ pluginId: string; settings: PluginSettingDefinition[] }> {
    const result: Array<{ pluginId: string; settings: PluginSettingDefinition[] }> = [];
    for (const [pluginId, settings] of this.definitions) {
      result.push({ pluginId, settings: [...settings] });
    }
    return result;
  }

  /** Get aggregate stats across all registered plugins. */
  getStats(): { totalPlugins: number; totalSettings: number } {
    let totalSettings = 0;
    for (const [, settings] of this.definitions) {
      totalSettings += settings.length;
    }
    return {
      totalPlugins: this.definitions.size,
      totalSettings,
    };
  }

  // ===========================================================
  // Private helpers
  // ===========================================================

  /**
   * Get definitions for a plugin, or throw if not registered.
   */
  private getDefinitionsOrThrow(pluginId: string): PluginSettingDefinition[] {
    const defs = this.definitions.get(pluginId);
    if (!defs) throw new PluginNotRegisteredError(pluginId);
    return defs;
  }

  /**
   * Load tenant-level overrides from the InstalledPlugin.settings JSON.
   */
  private async getTenantOverrides(
    pluginId: string,
    tenantId: string,
  ): Promise<Record<string, any>> {
    const installed = await db.installedPlugin.findUnique({
      where: {
        tenantId_pluginId: { tenantId, pluginId },
      },
    });

    if (!installed) return {};

    try {
      return JSON.parse(installed.settings) as Record<string, any>;
    } catch {
      return {};
    }
  }

  /**
   * Persist tenant-level overrides to the InstalledPlugin.settings JSON.
   * Upserts the InstalledPlugin record if it doesn't exist yet.
   */
  private async saveTenantOverrides(
    pluginId: string,
    tenantId: string,
    overrides: Record<string, any>,
  ): Promise<void> {
    await db.installedPlugin.upsert({
      where: {
        tenantId_pluginId: { tenantId, pluginId },
      },
      update: {
        settings: JSON.stringify(overrides),
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        pluginId,
        settings: JSON.stringify(overrides),
      },
    });
  }

  /**
   * Validate a setting value against its definition (type + required + select options).
   */
  private validateSettingValue(def: PluginSettingDefinition, value: any): void {
    switch (def.type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new SettingValidationError(
            `Setting "${def.key}" must be a string, received ${typeof value}.`,
            def.key,
            def.key,
          );
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new SettingValidationError(
            `Setting "${def.key}" must be a valid number.`,
            def.key,
            def.key,
          );
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new SettingValidationError(
            `Setting "${def.key}" must be a boolean.`,
            def.key,
            def.key,
          );
        }
        break;

      case 'select':
        if (def.options && def.options.length > 0) {
          const validValues = def.options.map((o) => o.value);
          if (!validValues.includes(value)) {
            throw new SettingValidationError(
              `Setting "${def.key}" must be one of: ${validValues.join(', ')}. Got: ${value}.`,
              def.key,
              def.key,
            );
          }
        }
        break;

      case 'json':
        try {
          JSON.stringify(value);
        } catch {
          throw new SettingValidationError(
            `Setting "${def.key}" must be JSON-serializable.`,
            def.key,
            def.key,
          );
        }
        break;
    }

    if (def.required && (value === undefined || value === null || value === '')) {
      throw new SettingValidationError(
        `Setting "${def.key}" is required and cannot be empty.`,
        def.key,
        def.key,
      );
    }
  }
}

// ============================================================
// Singleton accessor
// ============================================================

let _settingsEngine: SettingsEngine | null = null;

export function getSettingsEngine(): SettingsEngine {
  if (!_settingsEngine) {
    _settingsEngine = new SettingsEngine();
  }
  return _settingsEngine;
}
