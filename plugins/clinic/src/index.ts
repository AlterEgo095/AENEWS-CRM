import type { PluginServerModule } from '@/core/plugin-sdk';

export default {
  onInstall: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Installing Clinical Management plugin...`);
  },
  onActivate: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Activating Clinical Management plugin...`);
  },
  onDeactivate: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Deactivating Clinical Management plugin...`);
  },
  onUninstall: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Uninstalling Clinical Management plugin...`);
  },
} satisfies PluginServerModule;
