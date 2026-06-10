/**
 * AENEWS Enterprise OS — PHASE SIGMA API
 * Micro-Kernel Status & Operations
 *
 * Endpoints:
 * GET  /api/sigma          — Full kernel state snapshot
 * POST /api/sigma          — Kernel operations (reboot, activate, deactivate, install, remove)
 * GET  /api/sigma?section=plugins     — Plugin states only
 * GET  /api/sigma?section=registries  — Registry snapshot only
 * GET  /api/sigma?section=services    — Service list only
 * GET  /api/sigma?section=events      — Event log only
 * GET  /api/sigma?section=logs        — Logger output only
 * GET  /api/sigma?section=lifecycle   — Lifecycle transitions only
 */

import { NextResponse } from 'next/server';
import { getMicroKernel, resetMicroKernel } from '@/core/micro-kernel';
import { ALL_SYSTEM_PLUGINS } from '@/core/micro-kernel/system-plugins';
import { adaptManifests } from '@/core/micro-kernel/manifest-adapter';
import { initializeSystemServices } from '@/core/system-plugins';
import type { PluginManifest } from '@/core/micro-kernel/types';

let kernelBooted = false;

// ─── Filesystem Discovery ──────────────────────────────────────────

async function scanPluginManifests(): Promise<Array<{ id: string; manifest: PluginManifest }>> {
  const fs = await import('fs/promises');
  const path = await import('path');
  const pluginsDir = path.join(process.cwd(), 'plugins');

  const rawManifests: unknown[] = [];

  // 1. System Plugins (already in kernel format)
  for (const sp of ALL_SYSTEM_PLUGINS) {
    rawManifests.push(sp);
  }

  // 2. Business Plugins from filesystem (SDK format → auto-adapted)
  try {
    const dirs = await fs.readdir(pluginsDir);
    for (const dir of dirs) {
      try {
        const manifestPath = path.join(pluginsDir, dir, 'plugin.json');
        const content = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);
        if (manifest.id) {
          rawManifests.push(manifest);
        }
      } catch {
        // Skip invalid plugins (no plugin.json)
      }
    }
  } catch {
    // plugins dir doesn't exist
  }

  // 3. Adapt all manifests to Kernel format
  const adapted = adaptManifests(rawManifests);
  return adapted.map(m => ({ id: m.id, manifest: m }));
}

// ─── Boot the Kernel ─────────────────────────────────────────────────

async function bootKernel(): Promise<void> {
  if (kernelBooted) return;
  kernelBooted = true;

  // 1. Initialize system services (logger, config, storage)
  await initializeSystemServices();

  // 2. Scan and adapt plugin manifests
  const manifests = await scanPluginManifests();

  // 3. Boot the micro-kernel
  const kernel = getMicroKernel();
  await kernel.boot(manifests);
}

// ─── GET Handler ────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const kernel = getMicroKernel();
    await bootKernel();

    const url = new URL(request.url);
    const section = url.searchParams.get('section');

    // Section-specific responses
    if (section) {
      return NextResponse.json({ success: true, section, data: getSectionData(kernel, section) });
    }

    // Full kernel state
    const state = kernel.getState();
    const metrics = kernel.getMetrics();
    const discovery = kernel.lastDiscovery;
    const systemPlugins = kernel.systemPlugins;
    const pluginStates = kernel.getPluginStates();
    const registryStats = kernel.registryManager.getStats();
    const serviceList = kernel.serviceContainer.list();
    const eventStats = {
      subscriptionCount: kernel.eventBus.subscriptionCount,
      eventCount: kernel.eventBus.eventCount,
    };
    const securityStats = kernel.security.getStats();

    let systemCount = 0;
    let businessCount = 0;
    const activePlugins: string[] = [];
    for (const [id, s] of pluginStates) {
      if (id.startsWith('system-')) systemCount++;
      else businessCount++;
      if (s === 'active') activePlugins.push(id);
    }

    // Collect plugin details from discovery graph
    const pluginDetails: Array<{
      id: string;
      name: string;
      slug: string;
      version: string;
      category: string;
      state: string;
      capabilities: number;
    }> = [];

    if (discovery?.graph.nodes) {
      for (const [id, node] of discovery.graph.nodes) {
        const state = pluginStates.get(id) || node.state;
        pluginDetails.push({
          id,
          name: node.manifest.name,
          slug: node.manifest.slug,
          version: node.manifest.version,
          category: node.category,
          state,
          capabilities: node.manifest.capabilities?.length || 0,
        });
      }
    }

    return NextResponse.json({
      success: true,
      kernel: {
        phase: state.phase,
        version: state.version,
        bootTime: metrics.bootTime,
        discoveryTime: metrics.discoveryTime,
        uptime: metrics.uptime,
        memoryMB: metrics.memoryUsage,
      },
      plugins: {
        system: systemCount,
        business: businessCount,
        total: systemCount + businessCount,
        active: activePlugins.length,
        states: Object.fromEntries(pluginStates),
        details: pluginDetails,
      },
      registries: registryStats,
      totalRegistryEntries: kernel.registryManager.totalCount,
      services: serviceList.map(s => ({
        name: s.name,
        provider: s.provider,
        version: s.version,
        state: s.state,
      })),
      serviceCount: serviceList.length,
      events: eventStats,
      security: securityStats,
      discovery: discovery ? {
        success: discovery.success,
        duration: discovery.duration,
        stats: discovery.stats,
        errors: discovery.errors,
        warnings: discovery.warnings,
        layers: discovery.graph.layers,
      } : null,
      systemPluginDetails: systemPlugins,
      architecture: {
        layers: 4,
        names: ['Micro-Kernel', 'System Plugins', 'Business Plugins', 'AI Plugins'],
        kernelComponents: [
          'Boot', 'Discovery', 'Manifest', 'Dependency',
          'Runtime', 'Container', 'Registry',
          'Lifecycle', 'Security', 'Events',
        ],
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// ─── POST Handler ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, pluginId, manifest } = body;
    const kernel = getMicroKernel();

    switch (action) {
      case 'reboot': {
        kernelBooted = true;
        resetMicroKernel();
        await initializeSystemServices();
        const manifests = await scanPluginManifests();
        await kernel.boot(manifests);
        return NextResponse.json({ success: true, action: 'reboot', message: 'Kernel rebooted successfully' });
      }

      case 'activate': {
        if (!pluginId) return NextResponse.json({ success: false, error: 'pluginId is required' }, { status: 400 });
        const result = await kernel.activatePlugin(pluginId);
        return NextResponse.json({ success: result.success, result });
      }

      case 'deactivate': {
        if (!pluginId) return NextResponse.json({ success: false, error: 'pluginId is required' }, { status: 400 });
        const result = await kernel.deactivatePlugin(pluginId);
        return NextResponse.json({ success: result.success, result });
      }

      case 'install': {
        if (!manifest) return NextResponse.json({ success: false, error: 'manifest is required' }, { status: 400 });
        const adapted = adaptManifests([manifest]);
        const result = await kernel.installPlugin(adapted[0]);
        return NextResponse.json({ success: result.success, result });
      }

      case 'remove': {
        if (!pluginId) return NextResponse.json({ success: false, error: 'pluginId is required' }, { status: 400 });
        const result = await kernel.removePlugin(pluginId);
        return NextResponse.json({ success: result.success, result });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: "${action}"` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// ─── Section Data Helper ────────────────────────────────────────────

function getSectionData(kernel: ReturnType<typeof getMicroKernel>, section: string): unknown {
  switch (section) {
    case 'plugins': {
      const states = kernel.getPluginStates();
      const discovery = kernel.lastDiscovery;
      const details: Array<Record<string, unknown>> = [];
      if (discovery?.graph.nodes) {
        for (const [id, node] of discovery.graph.nodes) {
          details.push({
            id,
            name: node.manifest.name,
            slug: node.manifest.slug,
            version: node.manifest.version,
            category: node.category,
            state: states.get(id) || node.state,
            capabilities: node.manifest.capabilities?.length || 0,
            tools: node.manifest.tools?.length || 0,
            events: node.manifest.events?.length || 0,
            menus: node.manifest.menus?.length || 0,
            settings: node.manifest.settings?.length || 0,
          });
        }
      }
      return { states: Object.fromEntries(states), details };
    }

    case 'registries':
      return {
        stats: kernel.registryManager.getStats(),
        total: kernel.registryManager.totalCount,
        snapshot: kernel.registryManager.getSnapshot(),
      };

    case 'services':
      return {
        list: kernel.serviceContainer.list().map(s => ({
          name: s.name,
          provider: s.provider,
          version: s.version,
          state: s.state,
        })),
        count: kernel.serviceContainer.count,
      };

    case 'events':
      return {
        subscriptionCount: kernel.eventBus.subscriptionCount,
        eventCount: kernel.eventBus.eventCount,
        recentEvents: kernel.eventBus.getLog({ limit: 50 }),
      };

    case 'logs': {
      try {
        const logger = kernel.serviceContainer.resolve<{ getLogs: (limit?: number) => unknown[] }>('logger');
        return { logs: logger.getLogs(100) };
      } catch {
        return { logs: [], message: 'Logger service not available' };
      }
    }

    case 'lifecycle': {
      const transitions = kernel.lifecycle.getTransitions({ limit: 50 });
      return { transitions };
    }

    case 'security':
      return kernel.security.getStats();

    default:
      return { error: `Unknown section: "${section}"` };
  }
}
