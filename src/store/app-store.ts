import { create } from 'zustand';

interface AppState {
  // Navigation
  currentView: string;
  sidebarOpen: boolean;
  setCurrentView: (view: string) => void;
  toggleSidebar: () => void;

  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Current tenant
  currentTenant: { id: string; name: string; slug: string } | null;
  setCurrentTenant: (tenant: { id: string; name: string; slug: string }) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Navigation
  currentView: 'dashboard',
  sidebarOpen: true,
  setCurrentView: (view: string) => set({ currentView: view }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Theme
  theme: 'system',
  setTheme: (theme: 'light' | 'dark' | 'system') => set({ theme }),

  // Current tenant
  currentTenant: null,
  setCurrentTenant: (tenant: { id: string; name: string; slug: string }) =>
    set({ currentTenant: tenant }),
}));
