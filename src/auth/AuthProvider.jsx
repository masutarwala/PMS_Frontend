import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refreshSession, setAccessToken, setSessionExpiredHandler } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { clearSessionStates } from '@/hooks/useSessionState';
import { setUserTimeZone } from '@/lib/timezone';
import { AuthContext } from './auth-context';

/**
 * Holds the signed-in session: { user, permissions, menus }.
 * status: 'loading' (restoring from the refresh cookie) | 'authenticated' | 'anonymous'
 */
export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('loading');
  const [session, setSession] = useState(null);

  const apply = useCallback((data) => {
    setAccessToken(data.accessToken ?? null);
    setUserTimeZone(data.user?.timeZone); // all dates / times follow the user's zone
    setSession({ user: data.user, permissions: data.permissions, projectAccess: data.projectAccess, menus: data.menus });
    setStatus('authenticated');
  }, []);

  const clear = useCallback(() => {
    setAccessToken(null);
    setSession(null);
    setStatus('anonymous');
    queryClient.clear();
  }, [queryClient]);

  // Restore the session on page load (refresh cookie → new access token).
  useEffect(() => {
    let active = true;
    refreshSession()
      .then((data) => active && apply(data))
      .catch(() => active && clear());
    return () => {
      active = false;
    };
  }, [apply, clear]);

  // Any API call whose refresh fails ends the session.
  useEffect(() => setSessionExpiredHandler(clear), [clear]);

  const login = useCallback(
    async (credentials) => {
      const data = await authApi.login(credentials);
      apply(data);
      return data;
    },
    [apply],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSessionStates();
      clear();
    }
  }, [clear]);

  // Re-reads permissions and menus (e.g. after editing the current user's role).
  const reloadSession = useCallback(async () => {
    const data = await authApi.me();
    setUserTimeZone(data.user?.timeZone);
    setSession({ user: data.user, permissions: data.permissions, projectAccess: data.projectAccess, menus: data.menus });
  }, []);

  const can = useCallback(
    (screen, action = 'view') => Boolean(session?.permissions?.[screen]?.[action]),
    [session],
  );

  const value = useMemo(
    () => ({ status, session, user: session?.user ?? null, login, logout, reloadSession, can }),
    [status, session, login, logout, reloadSession, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
