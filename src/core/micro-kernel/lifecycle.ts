/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * Lifecycle Manager — Plugin Lifecycle Control
 *
 * Manages: install, activate, deactivate, update, rollback, remove
 * All operations are hot-swap capable (no restart required).
 */

import type { PluginState, PluginManifest, HotSwapOperation, HotSwapResult, LifecyclePhase } from './types';

export interface LifecycleTransition {
  pluginId: string;
  from: PluginState;
  to: PluginState;
  phase: LifecyclePhase;
  timestamp: number;
  success: boolean;
  duration: number;
}

interface LifecycleHandler {
  phase: LifecyclePhase;
  handler: () => void | Promise<void>;
  priority: number;
}

export class LifecycleManager {
  private states: Map<string, PluginState> = new Map();
  private handlers: Map<string, LifecycleHandler[]> = new Map();
  private transitions: LifecycleTransition[] = [];
  private maxHistory = 1000;

  /** Get current state of a plugin */
  getState(pluginId: string): PluginState | undefined {
    return this.states.get(pluginId);
  }

  /** Set state of a plugin */
  setState(pluginId: string, state: PluginState): void {
    const from = this.states.get(pluginId);
    this.states.set(pluginId, state);

    // Record transition
    const transition: LifecycleTransition = {
      pluginId,
      from: from || 'discovered',
      to: state,
      phase: this._stateToPhase(state),
      timestamp: Date.now(),
      success: true,
      duration: 0,
    };

    this.transitions.push(transition);
    if (this.transitions.length > this.maxHistory) {
      this.transitions = this.transitions.slice(-this.maxHistory);
    }
  }

  /** Register a lifecycle handler */
  on(pluginId: string, phase: LifecyclePhase, handler: () => void | Promise<void>, priority = 0): () => void {
    if (!this.handlers.has(pluginId)) {
      this.handlers.set(pluginId, []);
    }
    const entry: LifecycleHandler = { phase, handler, priority };
    this.handlers.get(pluginId)!.push(entry);
    this.handlers.get(pluginId)!.sort((a, b) => b.priority - a.priority);

    return () => {
      const handlers = this.handlers.get(pluginId);
      if (handlers) {
        const idx = handlers.indexOf(entry);
        if (idx !== -1) handlers.splice(idx, 1);
      }
    };
  }

  /** Execute handlers for a specific phase */
  async executePhase(pluginId: string, phase: LifecyclePhase): Promise<{ success: boolean; errors: string[]; duration: number }> {
    const start = Date.now();
    const handlers = this.handlers.get(pluginId)?.filter(h => h.phase === phase) || [];
    const errors: string[] = [];

    for (const handler of handlers) {
      try {
        await handler.handler();
      } catch (err) {
        errors.push(String(err));
      }
    }

    const duration = Date.now() - start;
    return { success: errors.length === 0, errors, duration };
  }

  /** Execute a hot-swap operation */
  async executeHotSwap(pluginId: string, operation: HotSwapOperation): Promise<HotSwapResult> {
    const start = Date.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    const phaseMap: Record<HotSwapOperation, PluginState> = {
      install: 'ready',
      activate: 'active',
      deactivate: 'inactive',
      update: 'updating',
      rollback: 'ready',
      remove: 'discovered',
    };

    const phaseNameMap: Record<HotSwapOperation, LifecyclePhase> = {
      install: 'install',
      activate: 'activate',
      deactivate: 'deactivate',
      update: 'update',
      rollback: 'rollback',
      remove: 'uninstall',
    };

    try {
      // Pre-operation phase
      const preResult = await this.executePhase(pluginId, `pre-${operation === 'remove' ? 'uninstall' : operation === 'update' ? 'install' : 'install'}` as LifecyclePhase);
      if (!preResult.success) {
        warnings.push(...preResult.errors);
      }

      // Main operation
      const mainResult = await this.executePhase(pluginId, phaseNameMap[operation]);
      if (!mainResult.success) {
        errors.push(...mainResult.errors);
      }

      // Update state
      if (errors.length === 0) {
        this.setState(pluginId, phaseMap[operation]);
      }

    } catch (err) {
      errors.push(String(err));
    }

    return {
      operation,
      pluginId,
      success: errors.length === 0,
      duration: Date.now() - start,
      affectedServices: [],
      affectedRegistries: [],
      warnings,
      errors,
    };
  }

  /** Get all transitions */
  getTransitions(filter?: { pluginId?: string; limit?: number }): LifecycleTransition[] {
    let result = [...this.transitions];
    if (filter?.pluginId) {
      result = result.filter(t => t.pluginId === filter.pluginId);
    }
    const limit = filter?.limit || result.length;
    return result.slice(-limit);
  }

  /** Get all plugin states */
  getAllStates(): Map<string, PluginState> {
    return new Map(this.states);
  }

  /** Get stats */
  getStats(): { total: number; active: number; inactive: number; error: number } {
    let active = 0, inactive = 0, error = 0;
    for (const state of this.states.values()) {
      if (state === 'active') active++;
      else if (state === 'error') error++;
      else if (state === 'inactive') inactive++;
    }
    return { total: this.states.size, active, inactive, error };
  }

  private _stateToPhase(state: PluginState): LifecyclePhase {
    const map: Record<PluginState, LifecyclePhase> = {
      discovered: 'pre-install',
      validated: 'pre-install',
      resolving: 'install',
      ready: 'install',
      active: 'activate',
      deactivating: 'deactivate',
      inactive: 'deactivate',
      error: 'install',
      updating: 'update',
    };
    return map[state] || 'install';
  }

  /** Clear all state */
  clear(): void {
    this.states.clear();
    this.handlers.clear();
    this.transitions = [];
  }
}

// Singleton
let _lifecycle: LifecycleManager | null = null;

export function getLifecycleManager(): LifecycleManager {
  if (!_lifecycle) {
    _lifecycle = new LifecycleManager();
  }
  return _lifecycle;
}

export function resetLifecycleManager(): void {
  _lifecycle = new LifecycleManager();
}
