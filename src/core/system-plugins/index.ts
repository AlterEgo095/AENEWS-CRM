/**
 * AENEWS Enterprise OS — PHASE SIGMA : MICRO-KERNEL
 * System Services Initializer
 *
 * Creates and registers the core system services (logger, config, storage)
 * into the Micro-Kernel's ServiceContainer. These services are available
 * to all plugins at runtime via `kernel.serviceContainer.resolve('logger')`.
 */

import { getMicroKernel } from '@/core/micro-kernel';

import { createLoggerService } from './logger-service';
import type { LoggerService } from './logger-service';

import { createConfigService } from './config-service';
import type { ConfigService } from './config-service';

import { createStorageService } from './storage-service';
import type { StorageService } from './storage-service';

// ─── Re-exports ─────────────────────────────────────────────────────

export { createLoggerService } from './logger-service';
export type { LoggerService, LogEntry } from './logger-service';

export { createConfigService } from './config-service';
export type { ConfigService } from './config-service';

export { createStorageService } from './storage-service';
export type { StorageService } from './storage-service';

// ─── Service Metadata ──────────────────────────────────────────────

const SERVICES_META = {
  logger:  { providerId: 'system-logger',  version: '1.0.0' },
  config:  { providerId: 'system-config',  version: '1.0.0' },
  storage: { providerId: 'system-storage', version: '1.0.0' },
} as const;

// ─── Initialization ────────────────────────────────────────────────

/**
 * Initialize and register all core system services into the
 * Micro-Kernel's ServiceContainer.
 *
 * Must be called during the kernel boot sequence, after the ServiceContainer
 * is available but before plugins are activated.
 *
 * Services registered:
 * - `logger`  → LoggerService  (in-memory structured log buffer)
 * - `config`  → ConfigService  (in-memory key-value store)
 * - `storage` → StorageService (Prisma-backed database access)
 */
export async function initializeSystemServices(): Promise<void> {
  const kernel = getMicroKernel();
  const { serviceContainer } = kernel;

  // ── Logger ──
  const logger = createLoggerService();
  serviceContainer.register(
    'logger',
    logger,
    SERVICES_META.logger.providerId,
    SERVICES_META.logger.version,
  );
  logger.info('system-logger', 'Logger service initialized');

  // ── Config ──
  const config = createConfigService({
    // Seed with kernel version for plugins to query compatibility
    'kernel.version': 'SIGMA-1.0.0',
    'kernel.phase': kernel.phase,
  });
  serviceContainer.register(
    'config',
    config,
    SERVICES_META.config.providerId,
    SERVICES_META.config.version,
  );
  logger.info('system-config', 'Config service initialized');

  // ── Storage ──
  const storage = createStorageService();
  serviceContainer.register(
    'storage',
    storage,
    SERVICES_META.storage.providerId,
    SERVICES_META.storage.version,
  );
  logger.info('system-storage', 'Storage service initialized');

  logger.info('system-initializer', `All ${serviceContainer.count} system services initialized successfully`);
}
