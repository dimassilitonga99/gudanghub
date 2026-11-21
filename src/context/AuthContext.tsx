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
import { ROUTES } from '@/lib/config';

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
      
      // Support both formats:
      // - New format: access_token + refresh_token (direct backend API)
      // - Worker format: token (refresh_token only, worker handles access token)
      const accessToken = typeof result.access_token === 'string' ? result.access_token : null;
      const refreshToken = typeof result.refresh_token === 'string' ? result.refresh_token : 
                          typeof result.token === 'string' ? result.token : null;
      
      const s = saveSession(user, accessToken, refreshToken);
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

    // Catatan: refresh token TIDAK dilakukan di klien. Sesi yang disimpan adalah
    // refresh-JWT dari Worker, dan Worker menukarnya jadi access token di server
    // (ensureAccess). Dulu ada fetch ke API_URL + '/auth/refresh' di sini yang
    // selalu gagal karena Worker tidak punya route itu (hanya ?action=), sehingga
    // memicu request sia-sia tiap 2 menit.

    return () => {
      setAuthRequiredHandler(null);
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