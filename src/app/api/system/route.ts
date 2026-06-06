import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getToolRegistry } from '@/core/tool-registry';

/**
 * GET /api/system
 * Returns system health, stats, and version information.
 */
export async function GET() {
  try {
    const registry = getToolRegistry();

    const [pluginCount, activePluginCount, tenantCount, userCount, eventCount] =
      await Promise.all([
        db.plugin.count(),
        db.installedPlugin.count({ where: { status: 'ACTIVE' } }),
        db.tenant.count(),
        db.user.count(),
        db.eventLog.count(),
      ]);

    return NextResponse.json({
      status: 'healthy',
      version: '0.1.0',
      sdkVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      stats: {
        plugins: {
          total: pluginCount,
          active: activePluginCount,
        },
        tools: {
          registered: registry.size,
        },
        tenants: tenantCount,
        users: userCount,
        events: eventCount,
      },
    });
  } catch (error) {
    console.error('[GET /api/system] Error:', error);
    return NextResponse.json(
      { status: 'error', error: 'System health check failed' },
      { status: 500 }
    );
  }
}
