// ============================================================
// AENEWS Enterprise OS — Discovery API
// GET  : Returns discovery stats + last result
// POST : Forces re-discovery and returns new result
// ============================================================

import { NextResponse } from 'next/server';
import { getDiscoveryEngine } from '@/core/discovery-engine';
import { bootstrapPlatform, isBootstrapped } from '@/lib/bootstrap';

// ============================================================
// GET — Return current discovery stats and last result
// ============================================================

export async function GET() {
  try {
    const engine = getDiscoveryEngine();

    // Ensure bootstrap has run so discovery data is available
    if (!isBootstrapped()) {
      await bootstrapPlatform();
    }

    const stats = engine.getStats();
    const lastResult = engine.getLastResult();

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      stats,
      result: lastResult
        ? {
            status: lastResult.status,
            timestamp: lastResult.timestamp,
            durationMs: lastResult.durationMs,
            pluginsScanned: lastResult.pluginsScanned,
            pluginsValid: lastResult.pluginsValid,
            pluginsInvalid: lastResult.pluginsInvalid,
            errors: lastResult.errors,
            registries: lastResult.registries,
          }
        : null,
      discoveredAt: engine.discoveredAt ? new Date(engine.discoveredAt).toISOString() : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Discovery API] GET failed:', error);
    return NextResponse.json(
      { status: 'error', message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}

// ============================================================
// POST — Force re-discovery
// ============================================================

export async function POST() {
  try {
    const engine = getDiscoveryEngine();
    const result = await engine.rediscover();
    const stats = engine.getStats();

    return NextResponse.json({
      status: 'ok',
      action: 'rediscovered',
      timestamp: new Date().toISOString(),
      stats,
      result: {
        status: result.status,
        timestamp: result.timestamp,
        durationMs: result.durationMs,
        pluginsScanned: result.pluginsScanned,
        pluginsValid: result.pluginsValid,
        pluginsInvalid: result.pluginsInvalid,
        errors: result.errors,
        registries: result.registries,
      },
      discoveredAt: engine.discoveredAt ? new Date(engine.discoveredAt).toISOString() : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Discovery API] POST failed:', error);
    return NextResponse.json(
      { status: 'error', message, timestamp: new Date().toISOString() },
      { status: 500 },
    );
  }
}
