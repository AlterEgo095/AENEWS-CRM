import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowEngine } from '@/core/workflow-engine';

/**
 * GET /api/workflows
 * List workflows for a tenant.
 * Query params:
 *   - tenantId (required)
 *   - active (optional) — Filter by active status (true/false)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const active = searchParams.get('active');

    if (!tenantId) {
      return NextResponse.json(
        { error: 'tenantId query parameter is required' },
        { status: 400 }
      );
    }

    const engine = getWorkflowEngine();

    const filter: { active?: boolean } = {};
    if (active !== null && active !== undefined) {
      filter.active = active === 'true';
    }

    const workflows = await engine.listWorkflows(tenantId, filter);
    const stats = await engine.getStats();

    return NextResponse.json({
      workflows,
      total: workflows.length,
      stats,
    });
  } catch (error) {
    console.error('[GET /api/workflows] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows
 * Create a new workflow.
 * Body: { tenantId, name, description?, trigger, conditions, actions }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, name, description, trigger, conditions, actions } = body;

    if (!tenantId || !name || !trigger || !actions) {
      return NextResponse.json(
        { error: 'tenantId, name, trigger, and actions are required' },
        { status: 400 }
      );
    }

    const engine = getWorkflowEngine();

    const workflowId = await engine.createWorkflow(tenantId, {
      name,
      description,
      trigger,
      conditions: conditions ?? [],
      actions,
    });

    return NextResponse.json(
      {
        message: `Workflow "${name}" created successfully`,
        workflowId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('[POST /api/workflows] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create workflow';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
