import type { PluginServerModule } from '@/core/plugin-sdk';

export default {
  onInstall: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Installing Restaurant Management plugin...`);
  },
  onActivate: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Activating Restaurant Management plugin...`);
  },
  onDeactivate: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Deactivating Restaurant Management plugin...`);
  },
  onUninstall: async (ctx: any) => {
    console.log(`[${ctx.pluginId}] Uninstalling Restaurant Management plugin...`);
  },
} satisfies PluginServerModule;
