import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  clearSession,
  getSession,
  homeRouteForSession,
  isSessionValid,
  setLastUsername,
  setSession as saveSession,
  type SessionData,
} from '@/lib/session';
import { auth } from '@/lib/api';
import { setAuthRequiredHandler } from '@/lib/api';
import { ROUTES, API_URL } from '@/lib/config';

interface AuthContextValue {
  session: SessionData | null;
  valid: boolean;
  isAdmin: boolean;
  isCabang: boolean;
  isPicker: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<SessionData>;
  restoreSession: (user: {
    username?: string;
    nama?: string;
    role?: string;
    idCabang?: string | null;
  }, token: string | null, refreshToken?: string | null) => Promise<SessionData>;
  logout: () => void;
  homeRoute: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<SessionData | null>(() => getSession());

  const valid = isSessionValid(session);
  const isAdmin = session?.role === 'admin';
  const isCabang = session?.role === 'cabang';
  const isPicker = session?.role === 'picker';

  const login = useCallback(
    async (username: string, password: string, remember = false): Promise<SessionData> => {
      const result = await auth.login({ username, password });
      if (result.status !== 'ok') {
        throw new Error(String(result.message || 'Login gagal.'));
      }
      const user = (result.user as { username?: string; nama?: string; role?: string; idCabang?: string | null }) || {};
      const token = typeof result.access_token === 'string' ? result.access_token : 
                    typeof result.token === 'string' ? result.token : null;
      const refreshToken = typeof result.refresh_token === 'string' ? result.refresh_token : null;
      const s = saveSession(user, token, refreshToken);
      if (!s) throw new Error('Gagal menyimpan sesi.');
      setLastUsername(remember ? s.username : '');
      setSessionState(s);
      return s;
    },
    [],
  );

  // Login instan dari cache kredensial (vanilla: token 'cached-'+Date.now())
  const restoreSession = useCallback(
    async (user: { username?: string; nama?: string; role?: string; idCabang?: string | null }, token: string | null, refreshToken: string | null = null): Promise<SessionData> => {
      const s = saveSession(user, token, refreshToken);
      if (!s) throw new Error('Gagal menyimpan sesi.');
      setSessionState(s);
      return s;
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
    setSessionState(null);
    window.location.href = ROUTES.login;
  }, []);

  useEffect(() => {
    setAuthRequiredHandler(() => {
      clearSession();
      setSessionState(null);
      if (!window.location.pathname.includes('login')) {
        window.location.href = ROUTES.login;
      }
    });

    // Auto-refresh token sebelum expire (12 menit setelah login, karena token 15 menit)
    const checkAndRefresh = async () => {
      const s = getSession();
      if (!s || !s.token || !s.refreshToken) return;

      // Cek apakah token akan expire dalam 3 menit
      const tokenExpiresAt = new Date(s.loginAt).getTime() + 15 * 60 * 1000; // 15 menit dari login
      const timeUntilExpiry = tokenExpiresAt - Date.now();
      
      if (timeUntilExpiry < 3 * 60 * 1000 && timeUntilExpiry > 0) {
        console.log('[Auth] Token expiring soon, refreshing...');
        try {
          const response = await fetch(API_URL + '/auth/refresh', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${s.refreshToken}`,
            },
          });

          if (response.ok) {
            const result = await response.json();
            if (result.access_token) {
              const updated = saveSession(
                { username: s.username, nama: s.nama, role: s.role, idCabang: s.idCabang },
                result.access_token,
                s.refreshToken
              );
              if (updated) {
                setSessionState(updated);
                console.log('[Auth] Token auto-refreshed');
              }
            }
          }
        } catch (error) {
          console.warn('[Auth] Auto-refresh failed:', (error as Error).message);
        }
      }
    };

    // Check every 2 minutes
    const interval = setInterval(checkAndRefresh, 2 * 60 * 1000);
    checkAndRefresh(); // Check immediately

    return () => {
      setAuthRequiredHandler(null);
      clearInterval(interval);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      valid,
      isAdmin,
      isCabang,
      isPicker,
      login,
      restoreSession,
      logout,
      homeRoute: homeRouteForSession(valid ? session : null),
    }),
    [session, valid, isAdmin, isCabang, isPicker, login, restoreSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}