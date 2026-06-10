/**
 * AENEWS Enterprise OS — PHASE SIGMA API
 * Micro-Kernel Status & Operations
 */

import { NextResponse } from 'next/server';
import { getMicroKernel, resetMicroKernel } from '@/core/micro-kernel';
import { ALL_SYSTEM_PLUGINS } from '@/core/micro-kernel/system-plugins';

let kernelBooted = false;

async function getPluginManifests() {
  const fs = await import('fs/promises');
  const path = await import('path');
  const pluginsDir = path.join(process.cwd(), 'plugins');

  const manifests: Array<{ id: string; manifest: unknown }> = [];

  for (const sp of ALL_SYSTEM_PLUGINS) {
    manifests.push({ id: sp.id, manifest: sp });
  }

  try {
    const dirs = await fs.readdir(pluginsDir);
    for (const dir of dirs) {
      try {
        const manifestPath = path.join(pluginsDir, dir, 'plugin.json');
        const content = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(content);
        if (manifest.id) {
          manifests.push({ id: manifest.id, manifest });
        }
      } catch {
        // Skip invalid plugins
      }
    }
  } catch {
    // plugins dir doesn't exist
  }

  return manifests;
}

export async function GET() {
  try {
    const kernel = getMicroKernel();

    if (!kernelBooted) {
      kernelBooted = true;
      const manifests = await getPluginManifests();
      await kernel.boot(manifests as any);
    }

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
        layers: 3,
        names: ['Micro-Kernel', 'System Plugins', 'Business Plugins'],
        kernelComponents: [
          'Boot', 'Discovery', 'Manifest Validation', 'Dependency Graph',
          'Runtime Manager', 'Event Bus', 'Service Container',
          'Registry Manager', 'Security', 'Lifecycle',
        ],
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, pluginId, manifest } = body;
    const kernel = getMicroKernel();

    switch (action) {
      case 'reboot': {
        kernelBooted = true;
        resetMicroKernel();
        const manifests = await getPluginManifests();
        await kernel.boot(manifests as any);
        return NextResponse.json({ success: true, action: 'reboot', message: 'Kernel rebooted successfully' });
      }
      case 'activate': {
        const result = await kernel.activatePlugin(pluginId);
        return NextResponse.json({ success: result.success, result });
      }
      case 'deactivate': {
        const result = await kernel.deactivatePlugin(pluginId);
        return NextResponse.json({ success: result.success, result });
      }
      default:
        return NextResponse.json({ success: false, error: `Unknown action: "${action}"` }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
