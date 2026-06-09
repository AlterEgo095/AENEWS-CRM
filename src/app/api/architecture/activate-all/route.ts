// ============================================================
// POST /api/architecture/activate-all
// Activates all 20 plugins for the default tenant.
// ============================================================

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getPluginEngine } from '@/core/plugin-engine';

const TENANT_ID = 'default';

export async function POST() {
  const startTime = Date.now();
  const results: Array<{
    slug: string;
    status: 'activated' | 'error';
    error?: string;
    registered?: Record<string, number>;
    duration?: number;
  }> = [];

  try {
    const pluginEngine = getPluginEngine();
    const pluginDir = path.resolve('./plugins');

    if (!fs.existsSync(pluginDir)) {
      return NextResponse.json({ error: 'Plugin directory not found' }, { status: 404 });
    }

    const entries = await fs.promises.readdir(pluginDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginStart = Date.now();
      try {
        const result = await pluginEngine.activatePlugin(entry.name, TENANT_ID);
        results.push({
          slug: entry.name,
          status: 'activated',
          registered: result.registered,
          duration: Date.now() - pluginStart,
        });
      } catch (err) {
        results.push({
          slug: entry.name,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          duration: Date.now() - pluginStart,
        });
      }
    }

    const activated = results.filter(r => r.status === 'activated').length;
    const failed = results.filter(r => r.status === 'error').length;
    const totalDuration = Date.now() - startTime;

    // Get engine stats after activation
    const engineStats = pluginEngine.getStats();

    return NextResponse.json({
      success: true,
      tenantId: TENANT_ID,
      activated,
      failed,
      totalPlugins: results.length,
      duration: totalDuration,
      results,
      engineStats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Activation failed', message, results },
      { status: 500 },
    );
  }
}
