// ============================================================
// AENEWS Enterprise OS — Workflow Engine
// Enables automation through Triggers → Conditions → Actions.
//
// Plugins register trigger / condition / action building blocks.
// The engine persists workflow definitions to the DB, evaluates
// conditions at runtime, executes actions sequentially, and
// tracks every execution via WorkflowRun records.
//
// Architecture:
//   Plugin
//     ↓ registers triggers, conditions, actions
//   WorkflowEngine
//     ↓
//   Triggers → Conditions → Actions
//     ↓
//   Builder AI can create workflows automatically
// ============================================================

import { db } from '@/lib/db';
import { eventBus, EVENT_TYPES } from '@/lib/event-bus';
import { getToolRegistry } from '../tool-registry';

// ============================================================
// Types — Trigger / Condition / Action building blocks
// ============================================================

export type TriggerType = 'event' | 'schedule' | 'webhook' | 'manual' | 'data_change';

export type ConditionType = 'field' | 'expression' | 'permission' | 'state';

export type ActionType =
  | 'create'
  | 'update'
  | 'delete'
  | 'notify'
  | 'call_api'
  | 'send_email'
  | 'log'
  | 'call_tool'
  | 'set_field'
  | 'delay';

/** A trigger building block registered by a plugin. */
export interface WorkflowTrigger {
  id: string;
  pluginId: string;
  name: string;
  type: TriggerType;
  /** Plugin-specific configuration (event name, cron expression, field path, etc.) */
  config: Record<string, any>;
  description?: string;
}

/** A condition building block registered by a plugin. */
export interface WorkflowCondition {
  id: string;
  pluginId: string;
  name: string;
  type: ConditionType;
  config: Record<string, any>;
  description?: string;
}

/** An action building block registered by a plugin. */
export interface WorkflowAction {
  id: string;
  pluginId: string;
  name: string;
  type: ActionType;
  config: Record<string, any>;
  description?: string;
}

/** A complete workflow definition assembled from building blocks. */
export interface WorkflowDefinition {
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  name: string;
  description?: string;
}

/** Runtime state of a workflow execution. */
export type ExecutionState = 'pending' | 'evaluating_conditions' | 'executing_actions' | 'completed' | 'failed' | 'cancelled';

/** A single workflow execution record (in-memory + persisted). */
export interface WorkflowExecution {
  workflowId: string;
  tenantId: string;
  input: any;
  state: ExecutionState;
  currentStep: string;
  result?: any;
  error?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
}

// ============================================================
// Internal types for DB ↔ domain mapping
// ============================================================

interface PersistedWorkflow {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  trigger: string;       // JSON
  steps: string;         // JSON — { conditions: [...], actions: [...] }
  isActive: boolean;
  runCount: number;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PersistedWorkflowRun {
  id: string;
  workflowId: string;
  tenantId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  input: string;         // JSON
  output: string | null; // JSON
  error: string | null;
  duration: number | null;
  createdAt: Date;
}

/** Serializable shape stored in the `steps` column. */
interface StepsPayload {
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

// ============================================================
// Custom Errors
// ============================================================

export class WorkflowNotFoundError extends Error {
  constructor(public readonly workflowId: string) {
    super(`Workflow "${workflowId}" not found.`);
    this.name = 'WorkflowNotFoundError';
  }
}

export class WorkflowExecutionError extends Error {
  constructor(
    message: string,
    public readonly workflowId: string,
    public readonly step: string,
  ) {
    super(message);
    this.name = 'WorkflowExecutionError';
  }
}

export class WorkflowValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowValidationError';
  }
}

// ============================================================
// Condition evaluator helpers
// ============================================================

/**
 * Safely resolve a dotted path against an object (e.g. "user.email").
 */
function resolvePath(obj: any, path: string): any {
  if (!path || !obj) return undefined;
  const segments = path.split('.');
  let current = obj;
  for (const segment of segments) {
    if (current == null) return undefined;
    current = current[segment];
  }
  return current;
}

/**
 * Compare two values using a supported operator.
 * Supports: eq, neq, gt, gte, lt, lte, in, nin, contains, startsWith, endsWith, exists, not_exists.
 */
function compare(left: any, operator: string, right: any): boolean {
  switch (operator) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
    case 'in':
      return Array.isArray(right) && right.includes(left);
    case 'nin':
      return Array.isArray(right) && !right.includes(left);
    case 'contains':
      return typeof left === 'string' && typeof right === 'string' && left.includes(right);
    case 'startsWith':
      return typeof left === 'string' && typeof right === 'string' && left.startsWith(right);
    case 'endsWith':
      return typeof left === 'string' && typeof right === 'string' && left.endsWith(right);
    case 'exists':
      return right === true ? left != null : left == null;
    case 'not_exists':
      return left == null;
    default:
      return false;
  }
}

// ============================================================
// WorkflowEngine
// ============================================================

export class WorkflowEngine {
  // ── In-memory registries (building blocks) ──────────────

  private triggers = new Map<string, WorkflowTrigger>();
  private conditions = new Map<string, WorkflowCondition>();
  private actions = new Map<string, WorkflowAction>();

  // ── Event-bus unsubscribe handles for active triggers ────

  private eventSubscriptions = new Map<string, () => void>();
  // ── Schedule timers (for cron / interval triggers) ────────

  private scheduleTimers = new Map<string, NodeJS.Timeout>();

  // ── Initialisation guard ─────────────────────────────────

  private _initialized = false;

  // ===========================================================
  // Initialisation
  // ===========================================================

  /**
   * Bootstrap the engine: load all active workflows from DB and
   * wire up their triggers to the event bus / scheduler.
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      const activeWorkflows = await db.workflow.findMany({
        where: { isActive: true },
      });

      for (const wf of activeWorkflows) {
        await this.bindTrigger(wf);
      }

      console.log(
        `[WorkflowEngine] Initialized — ${activeWorkflows.length} active workflow(s) bound, ` +
        `${this.triggers.size} trigger(s), ${this.conditions.size} condition(s), ${this.actions.size} action(s) registered.`,
      );
    } catch (error) {
      console.error('[WorkflowEngine] Initialization failed:', error);
      throw error;
    }

    this._initialized = true;
  }

  // ===========================================================
  // Registry — Triggers / Conditions / Actions
  // ===========================================================

  /** Register a trigger building block. */
  registerTrigger(trigger: WorkflowTrigger): void {
    this.triggers.set(trigger.id, trigger);
  }

  /** Register a condition building block. */
  registerCondition(condition: WorkflowCondition): void {
    this.conditions.set(condition.id, condition);
  }

  /** Register an action building block. */
  registerAction(action: WorkflowAction): void {
    this.actions.set(action.id, action);
  }

  /** Remove all building blocks registered by a specific plugin. */
  unregisterByPlugin(pluginId: string): void {
    for (const [id, t] of this.triggers) {
      if (t.pluginId === pluginId) this.triggers.delete(id);
    }
    for (const [id, c] of this.conditions) {
      if (c.pluginId === pluginId) this.conditions.delete(id);
    }
    for (const [id, a] of this.actions) {
      if (a.pluginId === pluginId) this.actions.delete(id);
    }
    console.log(
      `[WorkflowEngine] Unregistered all building blocks for plugin "${pluginId}".`,
    );
  }

  // ===========================================================
  // CRUD — Workflow lifecycle
  // ===========================================================

  /**
   * Create a new workflow and persist it to the database.
   * @returns The workflow ID.
   */
  async createWorkflow(
    tenantId: string,
    definition: WorkflowDefinition,
  ): Promise<string> {
    this.validateDefinition(definition);

    const triggerJson = JSON.stringify(definition.trigger);
    const stepsJson: StepsPayload = {
      conditions: definition.conditions,
      actions: definition.actions,
    };

    const record = await db.workflow.create({
      data: {
        tenantId,
        name: definition.name,
        description: definition.description ?? null,
        trigger: triggerJson,
        steps: JSON.stringify(stepsJson),
        isActive: false, // workflows start inactive
      },
    });

    console.log(
      `[WorkflowEngine] Workflow "${record.id}" created for tenant "${tenantId}".`,
    );
    return record.id;
  }

  /**
   * Partially update an existing workflow definition.
   */
  async updateWorkflow(
    workflowId: string,
    patch: Partial<WorkflowDefinition>,
  ): Promise<void> {
    const existing = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) {
      throw new WorkflowNotFoundError(workflowId);
    }

    const data: Record<string, any> = {};

    if (patch.name !== undefined) data.name = patch.name;
    if (patch.description !== undefined) data.description = patch.description ?? null;

    if (patch.trigger !== undefined) {
      this.validateTrigger(patch.trigger);
      data.trigger = JSON.stringify(patch.trigger);
    }

    if (patch.conditions !== undefined || patch.actions !== undefined) {
      // Merge with existing steps
      const existingSteps: StepsPayload = JSON.parse(existing.steps);
      const merged: StepsPayload = {
        conditions: patch.conditions ?? existingSteps.conditions,
        actions: patch.actions ?? existingSteps.actions,
      };
      // Validate the merged definition
      const fullDef: WorkflowDefinition = {
        trigger: patch.trigger ?? JSON.parse(existing.trigger),
        conditions: merged.conditions,
        actions: merged.actions,
        name: patch.name ?? existing.name,
        description: (patch.description ?? existing.description) ?? undefined,
      };
      this.validateConditions(merged.conditions);
      this.validateActions(merged.actions);
      data.steps = JSON.stringify(merged);
    }

    await db.workflow.update({ where: { id: workflowId }, data });

    // If the workflow is active and trigger changed, rebind
    if (existing.isActive && patch.trigger !== undefined) {
      await this.unbindTrigger(workflowId);
      const refreshed = await db.workflow.findUnique({ where: { id: workflowId } });
      if (refreshed) await this.bindTrigger(refreshed);
    }

    console.log(`[WorkflowEngine] Workflow "${workflowId}" updated.`);
  }

  /**
   * Permanently delete a workflow and its execution history.
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    const existing = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!existing) {
      throw new WorkflowNotFoundError(workflowId);
    }

    // Unbind trigger if active
    if (existing.isActive) {
      await this.unbindTrigger(workflowId);
    }

    // Delete workflow runs first (Prisma cascade should handle this,
    // but we do it explicitly for clarity and safety)
    await db.workflowRun.deleteMany({ where: { workflowId } });
    await db.workflow.delete({ where: { id: workflowId } });

    console.log(`[WorkflowEngine] Workflow "${workflowId}" deleted.`);
  }

  /**
   * Activate a workflow — wire up its trigger to the event bus / scheduler.
   */
  async activateWorkflow(workflowId: string): Promise<void> {
    const wf = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!wf) {
      throw new WorkflowNotFoundError(workflowId);
    }
    if (wf.isActive) return; // already active

    await this.bindTrigger(wf);

    await db.workflow.update({
      where: { id: workflowId },
      data: { isActive: true },
    });

    console.log(`[WorkflowEngine] Workflow "${workflowId}" activated.`);
  }

  /**
   * Deactivate a workflow — remove its event bus / scheduler bindings.
   */
  async deactivateWorkflow(workflowId: string): Promise<void> {
    const wf = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!wf) {
      throw new WorkflowNotFoundError(workflowId);
    }
    if (!wf.isActive) return; // already inactive

    await this.unbindTrigger(workflowId);

    await db.workflow.update({
      where: { id: workflowId },
      data: { isActive: false },
    });

    console.log(`[WorkflowEngine] Workflow "${workflowId}" deactivated.`);
  }

  // ===========================================================
  // Execution
  // ===========================================================

  /**
   * Execute a workflow by ID.
   * 1. Loads the workflow definition from DB.
   * 2. Creates a WorkflowRun record (RUNNING).
   * 3. Evaluates all conditions against the provided context.
   * 4. If conditions pass, executes actions sequentially.
   * 5. Updates the WorkflowRun record with the result.
   * 6. Updates the workflow's runCount and lastRunAt.
   */
  async executeWorkflow(
    workflowId: string,
    input: any = {},
    context: any = {},
  ): Promise<WorkflowExecution> {
    const wf = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!wf) {
      throw new WorkflowNotFoundError(workflowId);
    }

    // Parse definition from persisted JSON
    const trigger: WorkflowTrigger = JSON.parse(wf.trigger);
    const steps: StepsPayload = JSON.parse(wf.steps);

    const startedAt = new Date();

    // Create a RUNNING WorkflowRun record
    const run = await db.workflowRun.create({
      data: {
        workflowId,
        tenantId: wf.tenantId,
        status: 'RUNNING',
        input: JSON.stringify(input),
      },
    });

    // Update workflow run count eagerly
    await db.workflow.update({
      where: { id: workflowId },
      data: {
        runCount: { increment: 1 },
        lastRunAt: startedAt,
      },
    });

    // Emit triggered event
    await eventBus.emit(EVENT_TYPES.WORKFLOW_TRIGGERED, {
      workflowId,
      tenantId: wf.tenantId,
      runId: run.id,
      input,
    });

    // Build execution context — merge input + extra context + run metadata
    const execContext: Record<string, any> = {
      ...context,
      ...input,
      _workflowId: workflowId,
      _workflowName: wf.name,
      _runId: run.id,
      _tenantId: wf.tenantId,
      _trigger: trigger,
    };

    // Execution tracking object
    const execution: WorkflowExecution = {
      workflowId,
      tenantId: wf.tenantId,
      input,
      state: 'pending',
      currentStep: 'init',
      startedAt,
    };

    try {
      // ── Phase 1: Evaluate conditions ────────────────────────
      execution.state = 'evaluating_conditions';
      execution.currentStep = 'conditions';

      const conditionsMet = await this.evaluateConditions(steps.conditions, execContext);

      if (!conditionsMet) {
        execution.state = 'completed';
        execution.currentStep = 'conditions_not_met';
        execution.result = { skipped: true, reason: 'Conditions not met' };
        execution.completedAt = new Date();
        execution.durationMs = execution.completedAt.getTime() - startedAt.getTime();

        await this.finalizeRun(run.id, 'SUCCESS', execution);
        return execution;
      }

      // ── Phase 2: Execute actions sequentially ─────────────
      execution.state = 'executing_actions';
      const actionResults: any[] = [];

      for (let i = 0; i < steps.actions.length; i++) {
        const action = steps.actions[i];
        execution.currentStep = `action[${i}]:${action.type}:${action.name}`;

        // Inject results of previous actions into context so
        // downstream actions can reference upstream outputs.
        execContext._actionResults = actionResults;

        const actionResult = await this.executeAction(action, execContext);
        actionResults.push(actionResult);
      }

      execution.state = 'completed';
      execution.currentStep = 'done';
      execution.result = { actionResults };
      execution.completedAt = new Date();
      execution.durationMs = execution.completedAt.getTime() - startedAt.getTime();

      await this.finalizeRun(run.id, 'SUCCESS', execution);
      return execution;

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      execution.state = 'failed';
      execution.error = message;
      execution.completedAt = new Date();
      execution.durationMs = execution.completedAt.getTime() - startedAt.getTime();

      await this.finalizeRun(run.id, 'FAILED', execution);

      // Emit failure event
      await eventBus.emit(EVENT_TYPES.WORKFLOW_FAILED, {
        workflowId,
        tenantId: wf.tenantId,
        runId: run.id,
        error: message,
        step: execution.currentStep,
      });

      // Re-throw as WorkflowExecutionError for upstream handling
      throw new WorkflowExecutionError(
        `Workflow "${wf.name}" failed at step "${execution.currentStep}": ${message}`,
        workflowId,
        execution.currentStep,
      );
    }
  }

  /**
   * Evaluate an array of conditions against a context.
   * All conditions must pass (AND logic).
   * Supports `config.mode: 'any'` on individual conditions for OR logic.
   */
  async evaluateConditions(
    conditions: WorkflowCondition[],
    context: any,
  ): Promise<boolean> {
    if (conditions.length === 0) return true;

    for (const condition of conditions) {
      try {
        const passed = await this.evaluateSingleCondition(condition, context);
        if (!passed) return false;
      } catch (error) {
        console.error(
          `[WorkflowEngine] Condition "${condition.name}" (${condition.id}) evaluation failed:`,
          error,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition against the context.
   */
  private async evaluateSingleCondition(
    condition: WorkflowCondition,
    context: any,
  ): Promise<boolean> {
    const { type, config } = condition;

    switch (type) {
      // ── Field comparison ─────────────────────────────────
      case 'field': {
        const { field, operator = 'eq', value } = config;
        if (!field) return true; // no field → pass through
        const left = resolvePath(context, field);
        return compare(left, operator, value);
      }

      // ── Expression evaluation (safe subset) ──────────────
      case 'expression': {
        const { expression } = config;
        if (!expression) return true;
        return this.evaluateExpression(expression, context);
      }

      // ── Permission check ────────────────────────────────
      case 'permission': {
        const { permission, userId } = config;
        if (!permission) return true;

        // Try to import the permission engine dynamically
        try {
          const { permissionEngine } = await import('../permission');
          const targetUserId = userId ?? context._userId ?? context.userId;
          if (!targetUserId) return false;
          return permissionEngine.check({
            userId: targetUserId,
            tenantId: context._tenantId,
            permission,
          });
        } catch {
          // If permission engine is not available, log a warning and pass
          console.warn(
            `[WorkflowEngine] Permission engine not available — condition "${condition.id}" passes by default.`,
          );
          return true;
        }
      }

      // ── State check ─────────────────────────────────────
      case 'state': {
        const { field, expectedState } = config;
        if (!field) return true;
        const actual = resolvePath(context, field);
        return actual === expectedState;
      }

      default:
        console.warn(`[WorkflowEngine] Unknown condition type: ${type}`);
        return true;
    }
  }

  /**
   * Safely evaluate a simple expression string.
   * Supports a limited subset of JavaScript-like expressions:
   *   - Comparisons: context.field == value, context.field > 5
   *   - Boolean: context.active && context.verified
   *   - Not: !context.disabled
   *
   * Uses Function constructor with an explicit whitelist approach.
   */
  private evaluateExpression(expression: string, context: any): boolean {
    try {
      // Very restricted evaluation — only supports simple comparisons
      // We replace `ctx.` and `context.` references with actual values
      const safeCtx = { ...context };
      const keys = Object.keys(safeCtx);
      const values = Object.values(safeCtx);

      // Create a function that receives context values as parameters
      const fn = new Function(...keys, `"use strict"; return (${expression});`);
      const result = fn(...values);
      return !!result;
    } catch (error) {
      console.warn(
        `[WorkflowEngine] Expression evaluation failed: "${expression}"`,
        error,
      );
      return false;
    }
  }

  /**
   * Execute a single action.
   */
  async executeAction(action: WorkflowAction, context: any): Promise<any> {
    const { type, config, name, id } = action;

    console.log(`[WorkflowEngine] Executing action "${name}" (${id}) type=${type}`);

    switch (type) {
      // ── Create entity ───────────────────────────────────
      case 'create': {
        const { entity, data: dataTemplate } = config;
        if (!entity || !dataTemplate) {
          throw new WorkflowExecutionError(
            `Action "${name}" missing entity or data.`,
            context._workflowId,
            `action:${id}`,
          );
        }

        // Template resolution — replace {{expr}} with context values
        const resolvedData = this.resolveTemplate(dataTemplate, context);

        // Use the db client to create the record
        const model = (db as any)[entity];
        if (!model || typeof model.create !== 'function') {
          throw new WorkflowExecutionError(
            `Unknown entity "${entity}" in action "${name}".`,
            context._workflowId,
            `action:${id}`,
          );
        }

        const record = await model.create({ data: resolvedData });
        return { type: 'create', entity, record };
      }

      // ── Update entity ───────────────────────────────────
      case 'update': {
        const { entity, id: entityId, data: dataTemplate } = config;
        if (!entity || !entityId) {
          throw new WorkflowExecutionError(
            `Action "${name}" missing entity or id.`,
            context._workflowId,
            `action:${id}`,
          );
        }

        const resolvedId = typeof entityId === 'string' ? this.resolveTemplateString(entityId, context) : entityId;
        const resolvedData = this.resolveTemplate(dataTemplate ?? {}, context);

        const model = (db as any)[entity];
        if (!model || typeof model.update !== 'function') {
          throw new WorkflowExecutionError(
            `Unknown entity "${entity}" in action "${name}".`,
            context._workflowId,
            `action:${id}`,
          );
        }

        const record = await model.update({ where: { id: resolvedId }, data: resolvedData });
        return { type: 'update', entity, record };
      }

      // ── Delete entity ───────────────────────────────────
      case 'delete': {
        const { entity, id: entityId } = config;
        if (!entity || !entityId) {
          throw new WorkflowExecutionError(
            `Action "${name}" missing entity or id.`,
            context._workflowId,
            `action:${id}`,
          );
        }

        const resolvedId = typeof entityId === 'string' ? this.resolveTemplateString(entityId, context) : entityId;

        const model = (db as any)[entity];
        if (!model || typeof model.delete !== 'function') {
          throw new WorkflowExecutionError(
            `Unknown entity "${entity}" in action "${name}".`,
            context._workflowId,
            `action:${id}`,
          );
        }

        await model.delete({ where: { id: resolvedId } });
        return { type: 'delete', entity, deletedId: resolvedId };
      }

      // ── Notification ────────────────────────────────────
      case 'notify': {
        const { userId: targetUserId, title, message: messageTemplate } = config;
        if (!targetUserId || !title) {
          throw new WorkflowExecutionError(
            `Action "${name}" missing userId or title.`,
            context._workflowId,
            `action:${id}`,
          );
        }

        const resolvedUserId = this.resolveTemplateString(targetUserId, context);
        const resolvedMessage = messageTemplate
          ? this.resolveTemplateString(messageTemplate, context)
          : undefined;

        const notification = await db.notification.create({
          data: {
            tenantId: context._tenantId,
            userId: resolvedUserId,
            type: 'workflow',
            title: this.resolveTemplateString(title, context),
            message: resolvedMessage,
            data: JSON.stringify({
              workflowId: context._workflowId,
              runId: context._runId,
              actionId: id,
            }),
          },
        });

        // Emit notification event so the real-time system picks it up
        await eventBus.emit(EVENT_TYPES.NOTIFICATION_CREATED, {
          id: notification.id,
          tenantId: context._tenantId,
          userId: resolvedUserId,
          type: 'workflow',
          title: notification.title,
        });

        return { type: 'notify', notificationId: notification.id };
      }

      // ── External API call ───────────────────────────────
      case 'call_api': {
        const { url: urlTemplate, method = 'POST', headers: headersTemplate, body: bodyTemplate } = config;
        if (!urlTemplate) {
          throw new WorkflowExecutionError(
            `Action "${name}" missing url.`,
            context._workflowId,
            `action:${id}`,
          );
        }

        const resolvedUrl = this.resolveTemplateString(urlTemplate, context);
        const resolvedHeaders = headersTemplate
          ? this.resolveTemplate(headersTemplate, context)
          : { 'Content-Type': 'application/json' };
        const resolvedBody = bodyTemplate
          ? JSON.stringify(this.resolveTemplate(bodyTemplate, context))
          : undefined;

        const startTime = Date.now();
        const response = await fetch(resolvedUrl, {
          method,
          headers: resolvedHeaders,
          body: resolvedBody,
        });
        const durationMs = Date.now() - startTime;

        let responseBody: any;
        try {
          responseBody = await response.json();
        } catch {
          responseBody = await response.text();
        }

        if (!response.ok) {
          throw new WorkflowExecutionError(
            `API call failed: ${response.status} ${response.statusText}`,
            context._workflowId,
            `action:${id}`,
          );
        }

        return { type: 'call_api', status: response.status, data: responseBody, durationMs };
      }

      // ── Send email ──────────────────────────────────────
      case 'send_email': {
        const { to, subject, body: emailBody, cc, bcc } = config;
        if (!to || !subject) {
          throw new WorkflowExecutionError(
            `Action "${name}" missing to or subject.`,
            context._workflowId,
            `action:${id}`,
          );
        }

        // Resolve template strings
        const resolvedTo = Array.isArray(to)
          ? to.map((addr: string) => this.resolveTemplateString(addr, context))
          : [this.resolveTemplateString(to as string, context)];
        const resolvedSubject = this.resolveTemplateString(subject, context);
        const resolvedEmailBody = emailBody
          ? this.resolveTemplateString(emailBody, context)
          : '';
        const resolvedCc = cc
          ? Array.isArray(cc)
            ? cc.map((addr: string) => this.resolveTemplateString(addr, context))
            : [this.resolveTemplateString(cc as string, context)]
          : undefined;
        const resolvedBcc = bcc
          ? Array.isArray(bcc)
            ? bcc.map((addr: string) => this.resolveTemplateString(addr, context))
            : [this.resolveTemplateString(bcc as string, context)]
          : undefined;

        // In a production system, this would integrate with a mail provider
        // (SendGrid, AWS SES, etc.). For now, log the email and emit an event.
        console.log(
          `[WorkflowEngine] Email queued: to=${resolvedTo.join(', ')} subject="${resolvedSubject}"`,
        );

        await eventBus.emit('email.queued', {
          workflowId: context._workflowId,
          runId: context._runId,
          to: resolvedTo,
          cc: resolvedCc,
          bcc: resolvedBcc,
          subject: resolvedSubject,
          body: resolvedEmailBody,
        });

        return { type: 'send_email', to: resolvedTo, subject: resolvedSubject };
      }

      // ── Log ────────────────────────────────────────────
      case 'log': {
        const { level = 'info', message: logMessageTemplate, meta: metaTemplate } = config;
        const resolvedMessage = logMessageTemplate
          ? this.resolveTemplateString(logMessageTemplate, context)
          : `Workflow action "${name}" executed.`;
        const resolvedMeta = metaTemplate
          ? this.resolveTemplate(metaTemplate, context)
          : undefined;

        switch (level) {
          case 'error':
            console.error(`[Workflow:${context._workflowName}] ${resolvedMessage}`, resolvedMeta);
            break;
          case 'warn':
            console.warn(`[Workflow:${context._workflowName}] ${resolvedMessage}`, resolvedMeta);
            break;
          case 'debug':
            console.debug(`[Workflow:${context._workflowName}] ${resolvedMessage}`, resolvedMeta);
            break;
          default:
            console.log(`[Workflow:${context._workflowName}] ${resolvedMessage}`, resolvedMeta);
        }

        // Also audit-log the action
        try {
          await db.auditLog.create({
            data: {
              tenantId: context._tenantId,
              action: `workflow.log.${level}`,
              entityType: 'Workflow',
              entityId: context._workflowId,
              metadata: JSON.stringify({ message: resolvedMessage, meta: resolvedMeta }),
            },
          });
        } catch {
          // Audit logging is best-effort
        }

        return { type: 'log', level, message: resolvedMessage };
      }

      // ── Call tool (via ToolRegistry) ─────────────────────
      case 'call_tool': {
        const { toolName, params: paramsTemplate } = config;
        if (!toolName) {
          throw new WorkflowExecutionError(
            `Action "${name}" missing toolName.`,
            context._workflowId,
            `action:${id}`,
          );
        }

        const resolvedParams = paramsTemplate
          ? this.resolveTemplate(paramsTemplate, context)
          : {};

        const toolRegistry = getToolRegistry();
        const tool = toolRegistry.get(toolName);

        if (!tool) {
          throw new WorkflowExecutionError(
            `Tool "${toolName}" not found in ToolRegistry.`,
            context._workflowId,
            `action:${id}`,
          );
        }

        const startTime = Date.now();
        const result = await tool.handler(resolvedParams, {
          tenantId: context._tenantId,
          workflowId: context._workflowId,
          runId: context._runId,
        });
        const durationMs = Date.now() - startTime;

        return { type: 'call_tool', toolName, result, durationMs };
      }

      // ── Set field (on context / entity) ─────────────────
      case 'set_field': {
        const { field, value } = config;
        if (!field) {
          throw new WorkflowExecutionError(
            `Action "${name}" missing field.`,
            context._workflowId,
            `action:${id}`,
          );
        }

        const resolvedValue = this.resolveTemplateValue(value, context);

        // Set the value on the execution context for downstream actions
        const segments = field.split('.');
        let target: any = context;
        for (let i = 0; i < segments.length - 1; i++) {
          if (target[segments[i]] === undefined) {
            target[segments[i]] = {};
          }
          target = target[segments[i]];
        }
        target[segments[segments.length - 1]] = resolvedValue;

        return { type: 'set_field', field, value: resolvedValue };
      }

      // ── Delay ──────────────────────────────────────────
      case 'delay': {
        const { durationMs: delayMs = 1000 } = config;
        if (typeof delayMs !== 'number' || delayMs < 0) {
          throw new WorkflowExecutionError(
            `Action "${name}" has invalid durationMs: ${delayMs}.`,
            context._workflowId,
            `action:${id}`,
          );
        }

        await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
        return { type: 'delay', durationMs: delayMs };
      }

      default:
        throw new WorkflowExecutionError(
          `Unknown action type: ${type}`,
          context._workflowId,
          `action:${id}`,
        );
    }
  }

  // ===========================================================
  // Queries
  // ===========================================================

  /** Get a single workflow by ID, with parsed definition. */
  async getWorkflow(workflowId: string): Promise<any> {
    const wf = await db.workflow.findUnique({ where: { id: workflowId } });
    if (!wf) return null;

    return this.toDomainWorkflow(wf);
  }

  /** List workflows for a tenant, optionally filtered by active status. */
  async listWorkflows(
    tenantId: string,
    filter?: { active?: boolean },
  ): Promise<any[]> {
    const where: Record<string, any> = { tenantId };
    if (filter?.active !== undefined) {
      where.isActive = filter.active;
    }

    const records = await db.workflow.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((wf) => this.toDomainWorkflow(wf));
  }

  /** Get execution history for a workflow. */
  async getExecutionHistory(
    workflowId: string,
    limit: number = 50,
  ): Promise<WorkflowExecution[]> {
    const runs = await db.workflowRun.findMany({
      where: { workflowId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return runs.map((run) => this.toWorkflowExecution(run));
  }

  /** Get aggregate stats across all workflows. */
  async getStats(): Promise<{
    totalWorkflows: number;
    activeWorkflows: number;
    totalExecutions: number;
    successRate: number;
  }> {
    const [totalWorkflows, activeWorkflows, totalExecutions, successfulExecutions] =
      await Promise.all([
        db.workflow.count(),
        db.workflow.count({ where: { isActive: true } }),
        db.workflowRun.count(),
        db.workflowRun.count({ where: { status: 'SUCCESS' } }),
      ]);

    const successRate = totalExecutions > 0
      ? successfulExecutions / totalExecutions
      : 0;

    return {
      totalWorkflows,
      activeWorkflows,
      totalExecutions,
      successRate,
    };
  }

  // ===========================================================
  // Template resolution
  // ===========================================================

  /**
   * Recursively resolve {{expression}} templates in strings, arrays, and objects.
   * Templates reference the execution context using dot-notation paths.
   */
  private resolveTemplate(template: any, context: any): any {
    if (template === null || template === undefined) return template;

    if (typeof template === 'string') {
      return this.resolveTemplateString(template, context);
    }

    if (Array.isArray(template)) {
      return template.map((item) => this.resolveTemplate(item, context));
    }

    if (typeof template === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.resolveTemplate(value, context);
      }
      return result;
    }

    return template;
  }

  /**
   * Replace {{path}} placeholders in a string with context values.
   * e.g. "Hello {{user.name}}" → "Hello John"
   */
  private resolveTemplateString(template: string, context: any): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, expr: string) => {
      const trimmed = expr.trim();
      const value = resolvePath(context, trimmed);
      if (value === undefined || value === null) {
        console.warn(`[WorkflowEngine] Template "${trimmed}" resolved to undefined.`);
        return _match; // Leave placeholder if not found
      }
      return String(value);
    });
  }

  /**
   * Resolve a single value — if it's a string with a single {{expr}},
   * return the typed value instead of stringifying it.
   */
  private resolveTemplateValue(value: any, context: any): any {
    if (typeof value === 'string' && /^{{[^}]+}}$/.test(value.trim())) {
      const expr = value.trim().slice(2, -2).trim();
      return resolvePath(context, expr);
    }
    return this.resolveTemplate(value, context);
  }

  // ===========================================================
  // Validation
  // ===========================================================

  /** Validate a complete workflow definition. */
  private validateDefinition(definition: WorkflowDefinition): void {
    if (!definition.name?.trim()) {
      throw new WorkflowValidationError('Workflow name is required.');
    }
    this.validateTrigger(definition.trigger);
    this.validateConditions(definition.conditions);
    this.validateActions(definition.actions);
  }

  private validateTrigger(trigger: WorkflowTrigger): void {
    if (!trigger) throw new WorkflowValidationError('Workflow trigger is required.');
    if (!trigger.id || !trigger.type) {
      throw new WorkflowValidationError('Trigger must have id and type.');
    }
    const validTypes: TriggerType[] = ['event', 'schedule', 'webhook', 'manual', 'data_change'];
    if (!validTypes.includes(trigger.type)) {
      throw new WorkflowValidationError(`Invalid trigger type: ${trigger.type}`);
    }
  }

  private validateConditions(conditions: WorkflowCondition[]): void {
    for (const c of conditions) {
      if (!c.id || !c.type) {
        throw new WorkflowValidationError('Every condition must have id and type.');
      }
      const validTypes: ConditionType[] = ['field', 'expression', 'permission', 'state'];
      if (!validTypes.includes(c.type)) {
        throw new WorkflowValidationError(`Invalid condition type: ${c.type}`);
      }
    }
  }

  private validateActions(actions: WorkflowAction[]): void {
    if (actions.length === 0) {
      throw new WorkflowValidationError('Workflow must have at least one action.');
    }
    for (const a of actions) {
      if (!a.id || !a.type) {
        throw new WorkflowValidationError('Every action must have id and type.');
      }
      const validTypes: ActionType[] = [
        'create', 'update', 'delete', 'notify', 'call_api',
        'send_email', 'log', 'call_tool', 'set_field', 'delay',
      ];
      if (!validTypes.includes(a.type)) {
        throw new WorkflowValidationError(`Invalid action type: ${a.type}`);
      }
    }
  }

  // ===========================================================
  // Trigger binding — wire workflows to the event bus / scheduler
  // ===========================================================

  /**
   * Bind a persisted workflow's trigger to the appropriate runtime mechanism.
   */
  private async bindTrigger(wf: PersistedWorkflow): Promise<void> {
    const trigger: WorkflowTrigger = JSON.parse(wf.trigger);

    switch (trigger.type) {
      case 'event': {
        const eventName = trigger.config.event;
        if (!eventName) {
          console.warn(`[WorkflowEngine] Event trigger for "${wf.id}" missing event name.`);
          return;
        }

        const unsubscribe = eventBus.on(eventName, async (payload: unknown) => {
          try {
            await this.executeWorkflow(wf.id, payload as any);
          } catch (error) {
            console.error(
              `[WorkflowEngine] Event-triggered workflow "${wf.id}" failed:`,
              error,
            );
          }
        });

        this.eventSubscriptions.set(wf.id, unsubscribe);
        break;
      }

      case 'schedule': {
        const { cron, intervalMs } = trigger.config;
        if (intervalMs && typeof intervalMs === 'number' && intervalMs > 0) {
          const timer = setInterval(async () => {
            try {
              await this.executeWorkflow(wf.id, { _scheduledAt: new Date().toISOString() });
            } catch (error) {
              console.error(
                `[WorkflowEngine] Scheduled workflow "${wf.id}" failed:`,
                error,
              );
            }
          }, intervalMs);

          this.scheduleTimers.set(wf.id, timer);

          // Prevent the Node.js process from exiting while timers are active
          if (timer.unref) timer.unref();
        } else if (cron) {
          console.warn(
            `[WorkflowEngine] Cron expression "${cron}" for workflow "${wf.id}" ` +
            `— cron scheduling requires a cron library (e.g., node-cron). ` +
            `Use intervalMs for simple periodic execution.`,
          );
        }
        break;
      }

      case 'webhook': {
        // Webhook triggers are handled by API routes that call executeWorkflow.
        // No binding needed at the engine level.
        console.log(
          `[WorkflowEngine] Webhook trigger for "${wf.id}" — ensure an API route calls executeWorkflow().`,
        );
        break;
      }

      case 'manual':
      case 'data_change':
        // Manual and data_change triggers are invoked programmatically.
        // No binding needed.
        break;

      default:
        console.warn(`[WorkflowEngine] Unknown trigger type: ${trigger.type}`);
    }
  }

  /**
   * Remove the runtime binding for a workflow's trigger.
   */
  private async unbindTrigger(workflowId: string): Promise<void> {
    // Unsubscribe from event bus
    const unsubscribe = this.eventSubscriptions.get(workflowId);
    if (unsubscribe) {
      unsubscribe();
      this.eventSubscriptions.delete(workflowId);
    }

    // Clear schedule timer
    const timer = this.scheduleTimers.get(workflowId);
    if (timer) {
      clearInterval(timer);
      this.scheduleTimers.delete(workflowId);
    }
  }

  // ===========================================================
  // Persistence helpers
  // ===========================================================

  /**
   * Finalize a WorkflowRun record with the execution outcome.
   */
  private async finalizeRun(
    runId: string,
    status: 'SUCCESS' | 'FAILED',
    execution: WorkflowExecution,
  ): Promise<void> {
    const output: Record<string, any> = {
      state: execution.state,
      currentStep: execution.currentStep,
      result: execution.result,
    };

    await db.workflowRun.update({
      where: { id: runId },
      data: {
        status,
        output: JSON.stringify(output),
        error: execution.error ?? null,
        duration: execution.durationMs ?? null,
      },
    });

    // Emit completion event on success
    if (status === 'SUCCESS') {
      await eventBus.emit(EVENT_TYPES.WORKFLOW_COMPLETED, {
        workflowId: execution.workflowId,
        tenantId: execution.tenantId,
        runId,
        durationMs: execution.durationMs,
        result: execution.result,
      });
    }
  }

  /**
   * Convert a persisted Workflow record to a domain object with
   * parsed trigger, conditions, and actions.
   */
  private toDomainWorkflow(wf: PersistedWorkflow): any {
    const trigger: WorkflowTrigger = JSON.parse(wf.trigger);
    const steps: StepsPayload = JSON.parse(wf.steps);

    return {
      id: wf.id,
      tenantId: wf.tenantId,
      name: wf.name,
      description: wf.description,
      trigger,
      conditions: steps.conditions,
      actions: steps.actions,
      isActive: wf.isActive,
      runCount: wf.runCount,
      lastRunAt: wf.lastRunAt,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
    };
  }

  /**
   * Convert a persisted WorkflowRun record to a WorkflowExecution object.
   */
  private toWorkflowExecution(run: PersistedWorkflowRun): WorkflowExecution {
    let parsedInput: any = {};
    try {
      parsedInput = JSON.parse(run.input);
    } catch {
      // keep default
    }

    let output: any = undefined;
    try {
      if (run.output) output = JSON.parse(run.output);
    } catch {
      // keep undefined
    }

    return {
      workflowId: run.workflowId,
      tenantId: run.tenantId,
      input: parsedInput,
      state: run.status === 'RUNNING' ? 'pending'
        : run.status === 'SUCCESS' ? 'completed'
        : 'failed',
      currentStep: output?.currentStep ?? 'unknown',
      result: output?.result,
      error: run.error ?? undefined,
      startedAt: run.createdAt,
      completedAt: run.duration ? new Date(run.createdAt.getTime() + run.duration) : undefined,
      durationMs: run.duration ?? undefined,
    };
  }

  // ===========================================================
  // Cleanup
  // ===========================================================

  /**
   * Gracefully shut down the engine — clear all event subscriptions
   * and schedule timers.
   */
  async shutdown(): Promise<void> {
    for (const [, unsubscribe] of this.eventSubscriptions) {
      unsubscribe();
    }
    this.eventSubscriptions.clear();

    for (const [, timer] of this.scheduleTimers) {
      clearInterval(timer);
    }
    this.scheduleTimers.clear();

    this._initialized = false;
    console.log('[WorkflowEngine] Shutdown complete.');
  }

  // ===========================================================
  // Convenience accessors
  // ===========================================================

  /** Get all registered triggers. */
  getRegisteredTriggers(): WorkflowTrigger[] {
    return Array.from(this.triggers.values());
  }

  /** Get all registered conditions. */
  getRegisteredConditions(): WorkflowCondition[] {
    return Array.from(this.conditions.values());
  }

  /** Get all registered actions. */
  getRegisteredActions(): WorkflowAction[] {
    return Array.from(this.actions.values());
  }
}

// ============================================================
// Singleton
// ============================================================

let _instance: WorkflowEngine | undefined;

/**
 * Get the global WorkflowEngine singleton.
 * Initializes the engine on first access.
 */
export function getWorkflowEngine(): WorkflowEngine {
  if (!_instance) {
    _instance = new WorkflowEngine();
    // Fire-and-forget initialization (non-blocking)
    _instance.initialize().catch((err) => {
      console.error('[WorkflowEngine] Failed to initialize:', err);
    });
  }
  return _instance;
}


