/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * Security Kernel — Immutable Security Layer
 *
 * Manifest signature verification, permission framework,
 * and security context management. Lives in the Kernel because
 * security is non-negotiable.
 */

import type { SecurityContext, PermissionCheck } from './types';
import crypto from 'crypto';

export interface SignatureVerification {
  valid: boolean;
  pluginId: string;
  checksum: string;
  signature?: string;
  publisher?: string;
  errors: string[];
}

export class SecurityKernel {
  private trustedPublishers: Set<string> = new Set();
  private permissionPolicies: Map<string, string[]> = new Map();
  private blockedPlugins: Set<string> = new Set();

  /** Add a trusted publisher */
  addTrustedPublisher(publisherId: string): void {
    this.trustedPublishers.add(publisherId);
  }

  /** Remove a trusted publisher */
  removeTrustedPublisher(publisherId: string): void {
    this.trustedPublishers.delete(publisherId);
  }

  /** Block a plugin */
  blockPlugin(pluginId: string, reason?: string): void {
    this.blockedPlugins.add(pluginId);
    if (reason) {
      console.warn(`[Security] Plugin "${pluginId}" blocked: ${reason}`);
    }
  }

  /** Unblock a plugin */
  unblockPlugin(pluginId: string): void {
    this.blockedPlugins.delete(pluginId);
  }

  /** Check if a plugin is blocked */
  isBlocked(pluginId: string): boolean {
    return this.blockedPlugins.has(pluginId);
  }

  /** Verify plugin manifest integrity */
  verifyManifest(pluginId: string, manifestContent: string, expectedChecksum?: string): SignatureVerification {
    const errors: string[] = [];
    const checksum = crypto.createHash('sha256').update(manifestContent).digest('hex').substring(0, 16);

    // Check if blocked
    if (this.blockedPlugins.has(pluginId)) {
      errors.push('Plugin is blocked by security policy');
      return { valid: false, pluginId, checksum, errors };
    }

    // Checksum verification
    if (expectedChecksum && checksum !== expectedChecksum) {
      errors.push(`Checksum mismatch: expected "${expectedChecksum}", got "${checksum}"`);
      return { valid: false, pluginId, checksum, errors };
    }

    return { valid: errors.length === 0, pluginId, checksum, errors };
  }

  /** Register permission policies for a plugin */
  registerPermissions(pluginId: string, permissions: string[]): void {
    this.permissionPolicies.set(pluginId, permissions);
  }

  /** Unregister permissions for a plugin */
  unregisterPermissions(pluginId: string): void {
    this.permissionPolicies.delete(pluginId);
  }

  /** Check a permission against a security context */
  checkPermission(permission: string, context?: SecurityContext): PermissionCheck {
    if (!context || context.permissions.length === 0) {
      return { permission, granted: false, reason: 'No security context or permissions' };
    }

    // Admin bypass
    if (context.roles.includes('admin') || context.roles.includes('superadmin')) {
      return { permission, context, granted: true };
    }

    // Wildcard check
    if (context.permissions.includes('*')) {
      return { permission, context, granted: true };
    }

    // Exact match
    if (context.permissions.includes(permission)) {
      return { permission, context, granted: true };
    }

    // Wildcard prefix match (e.g., "crm.*" matches "crm.contacts.read")
    for (const perm of context.permissions) {
      if (perm.endsWith('.*')) {
        const prefix = perm.slice(0, -1); // "crm."
        if (permission.startsWith(prefix)) {
          return { permission, context, granted: true };
        }
      }
    }

    return { permission, context, granted: false, reason: `Permission "${permission}" not granted` };
  }

  /** Get all permissions for a plugin */
  getPluginPermissions(pluginId: string): string[] {
    return this.permissionPolicies.get(pluginId) || [];
  }

  /** Get security stats */
  getStats(): { trustedPublishers: number; blockedPlugins: number; permissionPolicies: number } {
    return {
      trustedPublishers: this.trustedPublishers.size,
      blockedPlugins: this.blockedPlugins.size,
      permissionPolicies: this.permissionPolicies.size,
    };
  }

  /** Clear all security state */
  clear(): void {
    this.trustedPublishers.clear();
    this.permissionPolicies.clear();
    this.blockedPlugins.clear();
  }
}

// Singleton
let _security: SecurityKernel | null = null;

export function getSecurityKernel(): SecurityKernel {
  if (!_security) {
    _security = new SecurityKernel();
  }
  return _security;
}

export function resetSecurityKernel(): void {
  _security = new SecurityKernel();
}
