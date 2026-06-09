import type { PluginServerModule } from '@/core/plugin-sdk';

export default {
  onInstall: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Installing Hotel Management plugin...`);
  },
  onActivate: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Activating Hotel Management plugin...`);
  },
  onDeactivate: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Deactivating Hotel Management plugin...`);
  },
  onUninstall: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Uninstalling Hotel Management plugin...`);
  },
} satisfies PluginServerModule;
