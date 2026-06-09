// ============================================================
// POST /api/architecture/deactivate-all
// Deactivates all plugins.
// ============================================================

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '@/lib/db';
import { getPluginEngine } from '@/core/plugin-engine';

const TENANT_ID = 'default';

export async function POST() {
  const startTime = Date.now();
  const results: Array<{
    slug: string;
    status: 'deactivated' | 'error';
    error?: string;
    duration?: number;
  }> = [];

  try {
    // Get all active plugins from DB
    const activePlugins = await db.installedPlugin.findMany({
      where: { tenantId: TENANT_ID, status: 'ACTIVE' },
      include: { plugin: { select: { slug: true } } },
    });

    const pluginEngine = getPluginEngine();

    for (const installed of activePlugins) {
      const pluginStart = Date.now();
      const slug = installed.plugin?.slug || installed.pluginId;

      try {
        await pluginEngine.deactivatePlugin(slug, TENANT_ID);
        results.push({
          slug,
          status: 'deactivated',
          duration: Date.now() - pluginStart,
        });
      } catch (err) {
        results.push({
          slug,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          duration: Date.now() - pluginStart,
        });
      }
    }

    // Also scan plugin directory and attempt to deactivate any found
    const pluginDir = path.resolve('./plugins');
    if (fs.existsSync(pluginDir)) {
      const entries = await fs.promises.readdir(pluginDir, { withFileTypes: true });
      const deactivatedSlugs = new Set(results.map(r => r.slug));

      for (const entry of entries) {
        if (!entry.isDirectory() || deactivatedSlugs.has(entry.name)) continue;

        const pluginStart = Date.now();
        try {
          await pluginEngine.deactivatePlugin(entry.name, TENANT_ID);
          results.push({
            slug: entry.name,
            status: 'deactivated',
            duration: Date.now() - pluginStart,
          });
        } catch {
          // Plugin wasn't active, skip
        }
      }
    }

    const deactivated = results.filter(r => r.status === 'deactivated').length;
    const failed = results.filter(r => r.status === 'error').length;
    const totalDuration = Date.now() - startTime;

    // Verify all deactivated in DB
    const remainingActive = await db.installedPlugin.count({
      where: { tenantId: TENANT_ID, status: 'ACTIVE' },
    });

    return NextResponse.json({
      success: true,
      tenantId: TENANT_ID,
      deactivated,
      failed,
      remainingActive,
      totalPlugins: results.length,
      duration: totalDuration,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Deactivation failed', message, results },
      { status: 500 },
    );
  }
}
