import type { PluginServerModule } from '@/core/plugin-sdk';

export default {
  onInstall: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Installing Insurance Management plugin...`);
  },
  onActivate: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Activating Insurance Management plugin...`);
  },
  onDeactivate: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Deactivating Insurance Management plugin...`);
  },
  onUninstall: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Uninstalling Insurance Management plugin...`);
  },
} satisfies PluginServerModule;
