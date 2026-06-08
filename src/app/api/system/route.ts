import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getToolRegistry } from '@/core/tool-registry';
import { bootstrapPlatform } from '@/lib/bootstrap';
import { seedDemoData } from '@/lib/seed';

/**
 * GET /api/system
 * Returns system health, stats, and version information.
 * Auto-seeds demo data on first call.
 */
export async function GET() {
  try {
    const registry = getToolRegistry();

    // Auto-seed and bootstrap on first call
    await seedDemoData();
    await bootstrapPlatform();

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
