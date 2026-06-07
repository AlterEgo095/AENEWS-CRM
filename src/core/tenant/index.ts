import { db } from '@/lib/db';
import type { Tenant } from '@prisma/client';

// ============================================================
// AENEWS Tenant Service — Multi-tenant workspace management
// ============================================================

export class TenantService {
  /**
   * CREATE: Create a new tenant/workspace
   */
  async create(data: {
    name: string;
    slug: string;
    domain?: string;
    logoUrl?: string;
    plan?: string;
  }): Promise<Tenant> {
    const tenant = await db.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        domain: data.domain || null,
        logoUrl: data.logoUrl || null,
        plan: data.plan || 'free',
        status: 'active',
        settings: JSON.stringify({
          theme: 'light',
          language: 'en',
          timezone: 'UTC',
        }),
      },
    });

    // Create default roles for the tenant
    await db.role.createMany({
      data: [
        {
          tenantId: tenant.id,
          name: 'Admin',
          description: 'Full system administrator with all permissions',
          isDefault: false,
          permissions: JSON.stringify([
            'plugins.manage',
            'users.manage',
            'roles.manage',
            'organizations.manage',
            'notifications.manage',
            'audit.view',
            'chat.manage',
            'workflows.manage',
            'files.manage',
            'settings.manage',
            'billing.manage',
          ]),
        },
        {
          tenantId: tenant.id,
          name: 'Member',
          description: 'Standard member with basic access',
          isDefault: true,
          permissions: JSON.stringify([
            'dashboard.view',
            'chat.use',
            'notifications.view',
          ]),
        },
        {
          tenantId: tenant.id,
          name: 'Viewer',
          description: 'Read-only access to data',
          isDefault: false,
          permissions: JSON.stringify([
            'dashboard.view',
            'notifications.view',
          ]),
        },
      ],
    });

    return tenant;
  }

  /**
   * GET: Get tenant by ID
   */
  async getById(id: string): Promise<Tenant | null> {
    return db.tenant.findUnique({
      where: { id },
    });
  }

  /**
   * GET: Get tenant by slug
   */
  async getBySlug(slug: string): Promise<Tenant | null> {
    return db.tenant.findUnique({
      where: { slug },
    });
  }

  /**
   * LIST: List all tenants (admin only — filtering by plan/status)
   */
  async list(filter?: {
    plan?: string;
    status?: string;
  }): Promise<Tenant[]> {
    const where: Record<string, unknown> = {};
    if (filter?.plan) where.plan = filter.plan;
    if (filter?.status) where.status = filter.status;

    return db.tenant.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * UPDATE: Update tenant settings
   */
  async update(
    id: string,
    data: Partial<Pick<Tenant, 'name' | 'domain' | 'logoUrl' | 'plan' | 'status'>>
  ): Promise<Tenant> {
    return db.tenant.update({
      where: { id },
      data,
    });
  }

  /**
   * SUSPEND: Suspend a tenant
   */
  async suspend(id: string, reason?: string): Promise<void> {
    const current = await db.tenant.findUnique({ where: { id } });
    const currentSettings = current ? JSON.parse(current.settings) : {};
    await db.tenant.update({
      where: { id },
      data: {
        status: 'suspended',
        settings: JSON.stringify({ ...currentSettings, suspensionReason: reason || 'No reason provided' }),
      },
    });
  }

  /**
   * ACTIVATE: Reactivate a suspended tenant
   */
  async activate(id: string): Promise<void> {
    await db.tenant.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  /**
   * GET SETTINGS: Get tenant settings as typed object
   */
  async getSettings(tenantId: string): Promise<Record<string, unknown>> {
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) return {};

    try {
      return JSON.parse(tenant.settings);
    } catch {
      return {};
    }
  }

  /**
   * UPDATE SETTINGS: Update tenant settings (deep merge)
   */
  async updateSettings(
    tenantId: string,
    settings: Record<string, unknown>
  ): Promise<void> {
    const current = await this.getSettings(tenantId);
    const merged = { ...current, ...settings };

    await db.tenant.update({
      where: { id: tenantId },
      data: { settings: JSON.stringify(merged) },
    });
  }

  /**
   * CHECK PLUGIN: Check if a plugin is installed and active for a tenant
   */
  async isPluginActive(tenantId: string, pluginId: string): Promise<boolean> {
    // Check by plugin slug
    const plugin = await db.plugin.findUnique({
      where: { slug: pluginId },
    });

    if (!plugin) return false;

    const installed = await db.installedPlugin.findUnique({
      where: {
        tenantId_pluginId: {
          tenantId,
          pluginId: plugin.id,
        },
      },
    });

    return installed?.status === 'ACTIVE';
  }

  /**
   * GET ACTIVE PLUGINS: Get all active plugin IDs for a tenant
   */
  async getActivePlugins(tenantId: string): Promise<string[]> {
    const installed = await db.installedPlugin.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
      include: { plugin: { select: { slug: true } } },
    });

    return installed.map((ip) => ip.plugin.slug);
  }

  /**
   * GET MEMBER COUNT: Get the number of users in a tenant
   */
  async getMemberCount(tenantId: string): Promise<number> {
    return db.user.count({
      where: { tenantId, isActive: true },
    });
  }
}

// Singleton
export const tenantService = new TenantService();
