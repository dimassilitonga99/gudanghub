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
  login: (username: string, password: string) => Promise<SessionData>;
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

  const login = useCallback(async (username: string, password: string): Promise<SessionData> => {
    const result = await auth.login({ username, password });
    if (result.status !== 'ok' || !result.token) {
      throw new Error(String(result.message || 'Login gagal.'));
    }
    const user = (result.user as { username?: string; nama?: string; role?: string; idCabang?: string | null }) || {};
    const s = saveSession(user, String(result.token));
    if (!s) throw new Error('Gagal menyimpan sesi.');
    setLastUsername(s.username);
    setSessionState(s);
    return s;
  }, []);

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
    return () => setAuthRequiredHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      valid,
      isAdmin,
      isCabang,
      isPicker,
      login,
      logout,
      homeRoute: homeRouteForSession(valid ? session : null),
    }),
    [session, valid, isAdmin, isCabang, isPicker, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus dipakai di dalam AuthProvider');
  return ctx;
}