import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  tenantId: string;
  roles: string[];
  permissions: string[];
  avatarUrl: string | null;
}

interface AuthState {
  // Auth
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRegisterMode: boolean;

  // Actions
  setUser: (user: AuthUser | null, token: string | null) => void;
  logout: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setRegisterMode: (mode: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      isRegisterMode: false,

      setUser: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: !!user && !!token,
          isLoading: false,
        }),

      logout: async () => {
        const token = useAuthStore.getState().token;
        if (token) {
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch {
            // ignore network errors
          }
        }
        set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      },

      setLoading: (isLoading) => set({ isLoading }),

      setRegisterMode: (isRegisterMode) => set({ isRegisterMode }),

      clear: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: 'aenews-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
