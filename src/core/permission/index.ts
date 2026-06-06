import { db } from '@/lib/db';
import type { Role } from '@prisma/client';

// ============================================================
// AENEWS RBAC Engine — Role-Based Access Control
// ============================================================

export interface PermissionCheck {
  userId: string;
  tenantId: string;
  permission: string; // e.g. "crm.contacts.read"
}

export class PermissionEngine {
  /**
   * CHECK: Check if a user has a specific permission
   * Checks: 1) User's roles, 2) Role's permissions, 3) Superadmin bypass
   */
  async check({ userId, tenantId, permission }: PermissionCheck): Promise<boolean> {
    const permissions = await this.getPermissions(userId, tenantId);

    // Direct match
    if (permissions.includes(permission)) return true;

    // Wildcard match: "crm.*" grants "crm.contacts.read"
    for (const p of permissions) {
      if (p.endsWith('.*') && permission.startsWith(p.slice(0, -1))) {
        return true;
      }
    }

    // Super wildcard: "*"
    if (permissions.includes('*')) return true;

    return false;
  }

  /**
   * GET PERMISSIONS: Get all permissions for a user in a tenant
   */
  async getPermissions(userId: string, tenantId: string): Promise<string[]> {
    const userRoles = await db.userRole.findMany({
      where: { userId, tenantId },
      include: { role: true },
    });

    const permissionSet = new Set<string>();

    for (const ur of userRoles) {
      try {
        const perms: string[] = JSON.parse(ur.role.permissions);
        perms.forEach((p) => permissionSet.add(p));
      } catch {
        // ignore malformed JSON
      }
    }

    return Array.from(permissionSet);
  }

  /**
   * GET ROLES: Get all roles for a user in a tenant
   */
  async getRoles(userId: string, tenantId: string): Promise<Role[]> {
    const userRoles = await db.userRole.findMany({
      where: { userId, tenantId },
      include: { role: true },
    });

    return userRoles.map((ur) => ur.role);
  }

  /**
   * HAS ROLE: Check if user has a specific role
   */
  async hasRole(
    userId: string,
    tenantId: string,
    roleName: string
  ): Promise<boolean> {
    const roles = await this.getRoles(userId, tenantId);
    return roles.some((r) => r.name === roleName);
  }

  /**
   * ASSIGN ROLE: Assign a role to a user in a tenant
   */
  async assignRole(
    userId: string,
    tenantId: string,
    roleId: string
  ): Promise<void> {
    // Verify role belongs to tenant
    const role = await db.role.findUnique({
      where: { id: roleId },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new PermissionError(`Role ${roleId} not found in tenant ${tenantId}`);
    }

    await db.userRole.upsert({
      where: {
        userId_roleId_tenantId: {
          userId,
          roleId,
          tenantId,
        },
      },
      update: {},
      create: {
        userId,
        roleId,
        tenantId,
      },
    });
  }

  /**
   * REVOKE ROLE: Remove a role from a user
   */
  async revokeRole(
    userId: string,
    tenantId: string,
    roleId: string
  ): Promise<void> {
    const userRole = await db.userRole.findUnique({
      where: {
        userId_roleId_tenantId: {
          userId,
          roleId,
          tenantId,
        },
      },
    });

    if (userRole) {
      await db.userRole.delete({ where: { id: userRole.id } });
    }
  }

  /**
   * CREATE ROLE: Create a new role with permissions
   */
  async createRole(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      permissions: string[];
      isDefault?: boolean;
    }
  ): Promise<Role> {
    return db.role.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description || null,
        isDefault: data.isDefault || false,
        permissions: JSON.stringify(data.permissions),
      },
    });
  }

  /**
   * UPDATE ROLE: Update role metadata and permissions
   */
  async updateRole(
    roleId: string,
    data: {
      name?: string;
      description?: string;
      permissions?: string[];
      isDefault?: boolean;
    }
  ): Promise<Role> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.permissions !== undefined) updateData.permissions = JSON.stringify(data.permissions);
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    return db.role.update({
      where: { id: roleId },
      data: updateData,
    });
  }

  /**
   * UPDATE ROLE PERMISSIONS: Update only the permissions of a role
   */
  async updateRolePermissions(
    roleId: string,
    permissions: string[]
  ): Promise<void> {
    await db.role.update({
      where: { id: roleId },
      data: { permissions: JSON.stringify(permissions) },
    });
  }

  /**
   * DELETE ROLE: Delete a role (unassigns all users first)
   */
  async deleteRole(roleId: string): Promise<void> {
    await db.userRole.deleteMany({ where: { roleId } });
    await db.role.delete({ where: { id: roleId } });
  }

  /**
   * GET ALL ROLES: Get all roles for a tenant
   */
  async getAllRoles(tenantId: string): Promise<Role[]> {
    return db.role.findMany({
      where: { tenantId },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * GET ROLE BY NAME: Get a role by name within a tenant
   */
  async getRoleByName(
    tenantId: string,
    name: string
  ): Promise<Role | null> {
    return db.role.findFirst({
      where: { tenantId, name },
    });
  }

  /**
   * REQUIRE PERMISSIONS: Middleware/helper that throws if user lacks permission
   * Usage:
   *   const requirePerm = permissionEngine.require('crm.contacts.read');
   *   await requirePerm(userId, tenantId);
   */
  require(permissions: string | string[]) {
    return async (userId: string, tenantId: string): Promise<void> => {
      const perms = Array.isArray(permissions) ? permissions : [permissions];
      for (const perm of perms) {
        const hasPermission = await this.check({ userId, tenantId, permission: perm });
        if (!hasPermission) {
          throw new PermissionError(`Permission denied: ${perm}`);
        }
      }
    };
  }

  /**
   * REQUIRE ANY: Middleware/helper that throws if user lacks ANY of the permissions
   */
  requireAny(permissions: string | string[]) {
    return async (userId: string, tenantId: string): Promise<void> => {
      const perms = Array.isArray(permissions) ? permissions : [permissions];
      let hasAny = false;
      for (const perm of perms) {
        const hasPermission = await this.check({ userId, tenantId, permission: perm });
        if (hasPermission) {
          hasAny = true;
          break;
        }
      }
      if (!hasAny) {
        throw new PermissionError(
          `Permission denied: requires one of [${perms.join(', ')}]`
        );
      }
    };
  }

  /**
   * REQUIRE ROLE: Middleware/helper that throws if user lacks the specified role
   */
  requireRole(roleName: string) {
    return async (userId: string, tenantId: string): Promise<void> => {
      const hasRole = await this.hasRole(userId, tenantId, roleName);
      if (!hasRole) {
        throw new PermissionError(`Role required: ${roleName}`);
      }
    };
  }
}

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

// Singleton
export const permissionEngine = new PermissionEngine();
