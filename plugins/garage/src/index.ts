import type { PluginServerModule } from '@/core/plugin-sdk';

export default {
  onInstall: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Installing Garage Management plugin...`);
  },
  onActivate: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Activating Garage Management plugin...`);
  },
  onDeactivate: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Deactivating Garage Management plugin...`);
  },
  onUninstall: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Uninstalling Garage Management plugin...`);
  },
} satisfies PluginServerModule;
