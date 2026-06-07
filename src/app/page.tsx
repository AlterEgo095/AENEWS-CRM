'use client';

import { useEffect, useState } from 'react';
import PlatformLayout from '@/components/layout/platform-layout';
import AuthPage from '@/components/auth/auth-page';
import { useAuthStore } from '@/store/auth-store';

export default function Home() {
  const { isAuthenticated, token, setUser, setLoading } = useAuthStore();
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Validate existing token on mount
    const validateToken = async () => {
      if (!token) {
        setLoading(false);
        setInitializing(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setUser(data.user, token);
        } else {
          // Token is invalid
          setUser(null, null);
        }
      } catch {
        // Network error — keep existing session state
      } finally {
        setInitializing(false);
      }
    };

    validateToken();
  }, [token, setUser, setLoading]);

  // Show loading while validating
  if (initializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xl animate-pulse">
            A
          </div>
          <p className="text-sm text-muted-foreground">Loading workspace...</p>
        </div>
      </div>
    );
  }

  // Auth gate
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return <PlatformLayout />;
}
