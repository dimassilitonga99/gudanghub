import { SESSION, ROUTES, getHomeRoute as getHomeRouteFromConfig, type Role } from './config';

export interface SessionData {
  username: string;
  nama: string;
  role: Role;
  idCabang: string | null;
  token: string | null;
  loginAt: string;
  expires: string;
}

export function getSession(): SessionData | null {
  try {
    const raw = sessionStorage.getItem(SESSION.key);
    return raw ? (JSON.parse(raw) as SessionData) : null;
  } catch {
    return null;
  }
}

export function setSession(
  user: { username?: string; nama?: string; role?: string; idCabang?: string | null },
  token: string | null = null,
): SessionData | null {
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION.durationHours * 60 * 60 * 1000);

  const sessionData: SessionData = {
    username: String(user.username || '').toLowerCase(),
    nama: String(user.nama || ''),
    role: (String(user.role || '').toLowerCase() || 'cabang') as Role,
    idCabang: user.idCabang ? String(user.idCabang).toUpperCase() : null,
    token: token || null,
    loginAt: now.toISOString(),
    expires: expires.toISOString(),
  };

  try {
    sessionStorage.setItem(SESSION.key, JSON.stringify(sessionData));
    return sessionData;
  } catch {
    return null;
  }
}

export function clearSession(): boolean {
  try {
    sessionStorage.removeItem(SESSION.key);
    return true;
  } catch {
    return false;
  }
}

export function isSessionValid(currentSession: SessionData | null = null): boolean {
  const s = currentSession || getSession();
  if (!s || !s.expires) return false;
  try {
    return new Date(s.expires) > new Date();
  } catch {
    return false;
  }
}

export function isAdmin(currentSession: SessionData | null = null): boolean {
  const s = currentSession || getSession();
  return s?.role === 'admin';
}

export function isCabang(currentSession: SessionData | null = null): boolean {
  const s = currentSession || getSession();
  return s?.role === 'cabang';
}

export function isPicker(currentSession: SessionData | null = null): boolean {
  const s = currentSession || getSession();
  return s?.role === 'picker';
}

export function getSessionRemainingMinutes(): number {
  const s = getSession();
  if (!s || !s.expires) return 0;
  try {
    const diff = new Date(s.expires).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 60000));
  } catch {
    return 0;
  }
}

export function getLastUsername(): string {
  try {
    return localStorage.getItem(SESSION.lastUserKey) || '';
  } catch {
    return '';
  }
}

export function setLastUsername(username: string): boolean {
  try {
    if (username) {
      localStorage.setItem(SESSION.lastUserKey, String(username));
    } else {
      localStorage.removeItem(SESSION.lastUserKey);
    }
    return true;
  } catch {
    return false;
  }
}

export function getHomeRoute(role: string): string {
  return getHomeRouteFromConfig(role);
}

export function homeRouteForSession(s: SessionData | null): string {
  if (!s) return ROUTES.login;
  if (s.role === 'admin') return ROUTES.dashboard;
  if (s.role === 'picker') return ROUTES.picker;
  return s.idCabang ? `${ROUTES.order}?cabang=${encodeURIComponent(s.idCabang)}` : ROUTES.order;
}

export function logout(redirectAfter = true): void {
  clearSession();
  if (redirectAfter) {
    window.location.href = ROUTES.login;
  }
}

export function onSessionChange(callback: (s: SessionData | null) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === SESSION.key) {
      callback(e.newValue ? (JSON.parse(e.newValue) as SessionData) : null);
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export function watchSessionExpiry(onExpired: () => void, intervalMs = 60000): () => void {
  const check = () => {
    if (!isSessionValid()) {
      onExpired?.();
    }
  };
  const timer = setInterval(check, intervalMs);
  return () => clearInterval(timer);
}