import { db } from '@/lib/db';
import crypto from 'crypto';

// ============================================================
// AENEWS Auth System — Token-based authentication with sessions
// ============================================================

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  tenantId: string;
  roles: string[];
  permissions: string[];
  avatarUrl: string | null;
}

export interface AuthConfig {
  sessionExpiry?: number; // in hours, default 24
  tokenLength?: number; // session token length, default 64
}

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

function generateToken(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Build an AuthUser object from a raw DB user + roles/permissions
 */
async function buildAuthUser(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  tenantId: string;
}): Promise<AuthUser> {
  const userRoles = await db.userRole.findMany({
    where: { userId: user.id, tenantId: user.tenantId },
    include: { role: true },
  });

  const roles: string[] = [];
  const permissionSet = new Set<string>();

  for (const ur of userRoles) {
    roles.push(ur.role.name);
    try {
      const perms: string[] = JSON.parse(ur.role.permissions);
      perms.forEach((p) => permissionSet.add(p));
    } catch {
      // ignore malformed JSON
    }
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    tenantId: user.tenantId,
    roles,
    permissions: Array.from(permissionSet),
    avatarUrl: user.avatarUrl,
  };
}

export class AuthService {
  private config: AuthConfig;

  constructor(config?: AuthConfig) {
    this.config = {
      sessionExpiry: 24,
      tokenLength: 64,
      ...config,
    };
  }

  /**
   * LOGIN: Authenticate user by email + password
   * In MVP, password verification is permissive for demo purposes.
   * Production should use bcrypt or argon2.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    try {
      // 1. Find user by email
      const user = await db.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!user) {
        return { success: false, error: 'Invalid email or password' };
      }

      if (!user.isActive) {
        return { success: false, error: 'Account is deactivated' };
      }

      // 2. Check tenant is active
      const tenant = await db.tenant.findUnique({
        where: { id: user.tenantId },
      });

      if (!tenant || tenant.status !== 'active') {
        return { success: false, error: 'Organization is suspended' };
      }

      // 3. In MVP, accept any non-empty password for demo users
      // Production: replace with bcrypt.compare(password, user.passwordHash)
      if (!password || password.length === 0) {
        return { success: false, error: 'Password is required' };
      }

      // 4. Create session token
      const token = generateToken(this.config.tokenLength!);
      const expiresAt = new Date(
        Date.now() + (this.config.sessionExpiry! || 24) * 60 * 60 * 1000
      );

      // 5. Store session in DB
      await db.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // 6. Update lastLoginAt
      await db.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // 7. Build AuthUser
      const authUser = await buildAuthUser(user);

      return { success: true, user: authUser, token };
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * REGISTER: Create a new user account (creates default tenant + admin role)
   */
  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    organizationName: string;
  }): Promise<LoginResult> {
    try {
      // 1. Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email: data.email.toLowerCase().trim() },
      });

      if (existingUser) {
        return { success: false, error: 'Email already registered' };
      }

      // 2. Create default tenant
      const slug = data.organizationName
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const tenant = await db.tenant.create({
        data: {
          name: data.organizationName,
          slug,
          plan: 'free',
          status: 'active',
          settings: JSON.stringify({
            theme: 'light',
            language: 'en',
            timezone: 'UTC',
          }),
        },
      });

      // 3. Create default admin role
      const adminRole = await db.role.create({
        data: {
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
      });

      // 4. Create default Member role
      const memberRole = await db.role.create({
        data: {
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
      });

      // 5. Create user
      const user = await db.user.create({
        data: {
          email: data.email.toLowerCase().trim(),
          firstName: data.firstName,
          lastName: data.lastName,
          isActive: true,
          tenantId: tenant.id,
        },
      });

      // 6. Assign admin role
      await db.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id,
          tenantId: tenant.id,
        },
      });

      // 7. Create session
      const token = generateToken(this.config.tokenLength!);
      const expiresAt = new Date(
        Date.now() + (this.config.sessionExpiry! || 24) * 60 * 60 * 1000
      );

      await db.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // 8. Build AuthUser
      const authUser = await buildAuthUser(user);

      return { success: true, user: authUser, token };
    } catch (error) {
      console.error('[AuthService] Register error:', error);
      return { success: false, error: 'Failed to create account' };
    }
  }

  /**
   * VALIDATE: Validate a session token and return the user
   */
  async validateToken(token: string): Promise<AuthUser | null> {
    try {
      // 1. Look up session in DB
      const session = await db.session.findUnique({
        where: { token },
        include: { user: true },
      });

      if (!session) {
        return null;
      }

      // 2. Check expiry
      if (session.expiresAt < new Date()) {
        // Clean up expired session
        await db.session.delete({ where: { id: session.id } });
        return null;
      }

      // 3. Check user is active
      if (!session.user.isActive) {
        return null;
      }

      // 4. Update lastLoginAt
      await db.user.update({
        where: { id: session.user.id },
        data: { lastLoginAt: new Date() },
      });

      // 5. Build and return AuthUser
      return buildAuthUser(session.user);
    } catch (error) {
      console.error('[AuthService] validateToken error:', error);
      return null;
    }
  }

  /**
   * LOGOUT: Invalidate a session
   */
  async logout(token: string): Promise<void> {
    await db.session.deleteMany({ where: { token } });
  }

  /**
   * CREATE API KEY: Generate a new API key for a user
   */
  async createApiKey(
    userId: string,
    tenantId: string,
    name: string,
    permissions?: string[]
  ): Promise<string> {
    const key = `aenews_${crypto.randomBytes(32).toString('hex')}`;
    await db.apiKey.create({
      data: {
        userId,
        tenantId,
        name,
        key,
        permissions: JSON.stringify(permissions || []),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      },
    });
    return key;
  }

  /**
   * VALIDATE API KEY: Check if an API key is valid
   */
  async validateApiKey(key: string): Promise<AuthUser | null> {
    try {
      // 1. Find API key in DB (not expired)
      const apiKey = await db.apiKey.findUnique({
        where: { key },
        include: { user: true },
      });

      if (!apiKey) {
        return null;
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        return null;
      }

      if (!apiKey.user.isActive) {
        return null;
      }

      // 2. Build AuthUser (merge API key permissions with role permissions)
      const authUser = await buildAuthUser(apiKey.user);

      // 3. Merge API key permissions
      try {
        const keyPerms: string[] = JSON.parse(apiKey.permissions);
        const mergedPerms = new Set([...authUser.permissions, ...keyPerms]);
        authUser.permissions = Array.from(mergedPerms);
      } catch {
        // ignore malformed JSON
      }

      return authUser;
    } catch (error) {
      console.error('[AuthService] validateApiKey error:', error);
      return null;
    }
  }

  /**
   * GET AUTH USER: Get AuthUser from a token or API key string
   * Automatically detects token format (session vs API key)
   */
  async getAuthUser(authHeader: string | null): Promise<AuthUser | null> {
    if (!authHeader) return null;

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    if (token.startsWith('aenews_')) {
      return this.validateApiKey(token);
    }

    return this.validateToken(token);
  }
}

// Singleton
export const authService = new AuthService();
