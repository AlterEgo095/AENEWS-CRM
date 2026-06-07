// ============================================================
// AENEWS Enterprise OS — CLI Tools
// ============================================================
// Re-exports all CLI utilities for programmatic access.
//
// Usage (programmatic):
//   import { createPlugin, parseArgs, generatePluginTemplate } from '@/core/cli';
//
// Usage (CLI):
//   npx create-aenews-plugin <plugin-name> [options]
// ============================================================

export { main as createPlugin } from './create-plugin';
