import { NextRequest, NextResponse } from 'next/server';
import { tenantService } from '@/core/tenant';
import { authService } from '@/core/auth';
import { permissionEngine, PermissionError } from '@/core/permission';

// ============================================================
// /api/tenants — Tenant management endpoints
// GET  /api/tenants        — list tenants (admin) or get by slug
// GET  /api/tenants/:id    — get tenant by ID
// POST /api/tenants        — create tenant (requires admin)
// PATCH /api/tenants/:id   — update tenant
// ============================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    const user = await authService.getAuthUser(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const id = searchParams.get('id');
    const plan = searchParams.get('plan');
    const status = searchParams.get('status');

    // Get tenant by slug or ID
    if (slug) {
      const tenant = await tenantService.getBySlug(slug);
      if (!tenant) {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ tenant });
    }

    if (id) {
      const tenant = await tenantService.getById(id);
      if (!tenant) {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ tenant });
    }

    // List tenants — requires admin permission
    try {
      await permissionEngine.require('settings.manage')(user.id, user.tenantId);
    } catch {
      // Non-admin: return only their own tenant
      const tenant = await tenantService.getById(user.tenantId);
      return NextResponse.json({ tenants: tenant ? [tenant] : [] });
    }

    const filter: { plan?: string; status?: string } = {};
    if (plan) filter.plan = plan;
    if (status) filter.status = status;

    const tenants = await tenantService.list(
      Object.keys(filter).length > 0 ? filter : undefined
    );

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error('[Tenants API] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    const user = await authService.getAuthUser(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Require admin permission
    try {
      await permissionEngine.require('settings.manage')(user.id, user.tenantId);
    } catch {
      return NextResponse.json(
        { error: 'Admin permission required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, slug, domain, logoUrl, plan } = body;

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      );
    }

    // Check slug uniqueness
    const existing = await tenantService.getBySlug(slug);
    if (existing) {
      return NextResponse.json(
        { error: 'Tenant with this slug already exists' },
        { status: 409 }
      );
    }

    const tenant = await tenantService.create({
      name,
      slug,
      domain,
      logoUrl,
      plan,
    });

    return NextResponse.json({ tenant }, { status: 201 });
  } catch (error) {
    console.error('[Tenants API] POST error:', error);
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    const user = await authService.getAuthUser(authHeader);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Require admin permission
    try {
      await permissionEngine.require('settings.manage')(user.id, user.tenantId);
    } catch {
      return NextResponse.json(
        { error: 'Admin permission required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, name, domain, logoUrl, plan, status } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (domain !== undefined) updateData.domain = domain;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl;
    if (plan !== undefined) updateData.plan = plan;
    if (status !== undefined) updateData.status = status;

    const tenant = await tenantService.update(
      id,
      updateData as Parameters<typeof tenantService.update>[1]
    );

    return NextResponse.json({ tenant });
  } catch (error) {
    console.error('[Tenants API] PATCH error:', error);
    if (error instanceof PermissionError) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
