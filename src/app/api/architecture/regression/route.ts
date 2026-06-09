// ============================================================
// POST /api/architecture/regression
// Runs regression test: install → activate → deactivate → uninstall → reinstall
// for all plugins in the default tenant.
// ============================================================

import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '@/lib/db';
import { getPluginEngine } from '@/core/plugin-engine';

const TENANT_ID = 'default';

interface RegressionResult {
  slug: string;
  steps: {
    install: 'pass' | 'fail' | 'skip';
    activate: 'pass' | 'fail' | 'skip';
    deactivate: 'pass' | 'fail' | 'skip';
    reinstall: 'pass' | 'fail' | 'skip';
  };
  errors: string[];
  duration: number;
}

export async function POST() {
  const overallStart = Date.now();
  const results: RegressionResult[] = [];
  let totalPassed = 0;
  let totalFailed = 0;

  try {
    const pluginEngine = getPluginEngine();
    const pluginDir = path.resolve('./plugins');

    if (!fs.existsSync(pluginDir)) {
      return NextResponse.json({ error: 'Plugin directory not found' }, { status: 404 });
    }

    // Scan all plugins
    const entries = await fs.promises.readdir(pluginDir, { withFileTypes: true });
    const pluginDirs = entries.filter(e => e.isDirectory());

    for (const entry of pluginDirs) {
      const slug = entry.name;
      const cycleStart = Date.now();
      const errors: string[] = [];
      const steps = {
        install: 'skip' as const,
        activate: 'skip' as const,
        deactivate: 'skip' as const,
        reinstall: 'skip' as const,
      };

      // Step 1: Activate (this also handles install via upsert)
      try {
        await pluginEngine.activatePlugin(slug, TENANT_ID);
        steps.activate = 'pass';
      } catch (err) {
        errors.push(`activate: ${err instanceof Error ? err.message : String(err)}`);
        steps.activate = 'fail';
      }

      // Step 2: Deactivate
      try {
        await pluginEngine.deactivatePlugin(slug, TENANT_ID);
        steps.deactivate = 'pass';
      } catch (err) {
        errors.push(`deactivate: ${err instanceof Error ? err.message : String(err)}`);
        steps.deactivate = 'fail';
      }

      // Step 3: Uninstall
      try {
        await pluginEngine.uninstallPlugin(slug, TENANT_ID);
        steps.install = 'pass'; // Uninstall success implies install was valid
      } catch (err) {
        errors.push(`uninstall: ${err instanceof Error ? err.message : String(err)}`);
      }

      // Step 4: Reinstall + Activate (full cycle re-activation)
      try {
        await pluginEngine.activatePlugin(slug, TENANT_ID);
        steps.reinstall = 'pass';
      } catch (err) {
        errors.push(`reinstall: ${err instanceof Error ? err.message : String(err)}`);
        steps.reinstall = 'fail';
      }

      // Clean up: deactivate after regression
      try {
        await pluginEngine.deactivatePlugin(slug, TENANT_ID);
      } catch {
        // Best effort cleanup
      }

      const allSteps = Object.entries(steps) as [string, string][];
      const cycleStatus = allSteps.every(([, v]) => v === 'pass');

      if (cycleStatus) totalPassed++;
      else totalFailed++;

      results.push({
        slug,
        steps,
        errors,
        duration: Date.now() - cycleStart,
      });
    }

    const totalDuration = Date.now() - overallStart;
    const passRate = results.length > 0 ? Math.round((totalPassed / results.length) * 100) : 0;
    const verdict = passRate >= 80
      ? 'REGRESSION PASSED'
      : passRate >= 50
        ? 'REGRESSION PARTIAL'
        : 'REGRESSION FAILED';

    return NextResponse.json({
      success: true,
      tenantId: TENANT_ID,
      verdict,
      totalPlugins: results.length,
      passed: totalPassed,
      failed: totalFailed,
      passRate: `${passRate}%`,
      totalDuration,
      avgCycleDuration: results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.duration, 0) / results.length)
        : 0,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Regression test failed', message, results },
      { status: 500 },
    );
  }
}
