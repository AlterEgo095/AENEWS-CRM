import { create } from 'zustand';

// ============================================================
// Plugin Info (frontend-friendly)
// ============================================================

export interface PluginInfo {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  author?: string;
  license?: string;
  capabilities: any[];
  status: string;
  installed: boolean;
  installedAt?: string;
  installStatus?: string | null;
  installSettings?: Record<string, unknown> | null;
}

// ============================================================
// System Stats
// ============================================================

export interface SystemStats {
  status: string;
  version: string;
  sdkVersion: string;
  timestamp: string;
  stats: {
    plugins: { total: number; active: number };
    tools: { registered: number };
    tenants: number;
    users: number;
    events: number;
  };
}

// ============================================================
// Event Log
// ============================================================

export interface EventLogEntry {
  id: string;
  tenantId: string;
  eventType: string;
  payload: unknown;
  sourcePlugin?: string | null;
  createdAt: string;
}

// ============================================================
// App State
// ============================================================

interface AppState {
  // Navigation
  currentView: string;
  setCurrentView: (view: string) => void;

  // Plugins
  plugins: PluginInfo[];
  setPlugins: (plugins: PluginInfo[]) => void;

  // System
  systemStats: SystemStats | null;
  setSystemStats: (stats: SystemStats | null) => void;

  // Events
  recentEvents: EventLogEntry[];
  setRecentEvents: (events: EventLogEntry[]) => void;

  // Loading states
  pluginsLoading: boolean;
  setPluginsLoading: (loading: boolean) => void;
  systemLoading: boolean;
  setSystemLoading: (loading: boolean) => void;
  eventsLoading: boolean;
  setEventsLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentView: 'dashboard',
  setCurrentView: (view: string) => set({ currentView: view }),

  // Plugins
  plugins: [],
  setPlugins: (plugins) => set({ plugins }),

  // System
  systemStats: null,
  setSystemStats: (stats) => set({ systemStats: stats }),

  // Events
  recentEvents: [],
  setRecentEvents: (events) => set({ recentEvents: events }),

  // Loading states
  pluginsLoading: false,
  setPluginsLoading: (loading) => set({ pluginsLoading: loading }),
  systemLoading: false,
  setSystemLoading: (loading) => set({ systemLoading: loading }),
  eventsLoading: false,
  setEventsLoading: (loading) => set({ eventsLoading: loading }),
}));
