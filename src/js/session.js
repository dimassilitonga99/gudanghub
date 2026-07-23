/* ═══════════════════════════════════════════════════════════════════════
   SESSION — User Authentication & Session Management
   ═══════════════════════════════════════════════════════════════════════ */

import { SESSION, ROUTES, getHomeRoute as getHomeRouteFromConfig } from './config.js';

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION.key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(user, token = null) {
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION.durationHours * 60 * 60 * 1000);

  const sessionData = {
    username: String(user.username || '').toLowerCase(),
    nama: String(user.nama || ''),
    role: String(user.role || '').toLowerCase(),
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

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION.key);
    return true;
  } catch {
    return false;
  }
}

export function isSessionValid(currentSession = null) {
  const s = currentSession || getSession();
  if (!s || !s.expires) return false;
  try {
    return new Date(s.expires) > new Date();
  } catch {
    return false;
  }
}

export function isAdmin(currentSession = null) {
  const s = currentSession || getSession();
  return s?.role === 'admin';
}

export function isCabang(currentSession = null) {
  const s = currentSession || getSession();
  return s?.role === 'cabang';
}

export function getSessionRemainingMinutes() {
  const s = getSession();
  if (!s || !s.expires) return 0;
  try {
    const diff = new Date(s.expires) - new Date();
    return Math.max(0, Math.floor(diff / 60000));
  } catch {
    return 0;
  }
}

export function getLastUsername() {
  try {
    return localStorage.getItem(SESSION.lastUserKey) || '';
  } catch {
    return '';
  }
}

export function setLastUsername(username) {
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

// Re-export getHomeRoute from config
export function getHomeRoute(role) {
  return getHomeRouteFromConfig(role);
}

export function requireAuth() {
  const s = getSession();
  if (!s || !isSessionValid(s)) {
    clearSession();
    redirectToLogin();
    return null;
  }
  return s;
}

export function requireAdmin() {
  const s = requireAuth();
  if (!s) return null;
  if (s.role !== 'admin') {
    redirectToHome(s);
    return null;
  }
  return s;
}

export function requireCabang() {
  const s = requireAuth();
  if (!s) return null;
  if (s.role !== 'cabang') {
    redirectToHome(s);
    return null;
  }
  return s;
}

export function redirectIfAuthenticated() {
  const s = getSession();
  if (s && isSessionValid(s)) {
    redirectToHome(s);
    return true;
  }
  return false;
}

export function redirectToLogin() {
  if (window.location.pathname.endsWith(ROUTES.login)) return;
  window.location.href = ROUTES.login;
}

export function redirectToHome(currentSession = null) {
  const s = currentSession || getSession();
  if (!s) return redirectToLogin();

  const route = getHomeRouteFromConfig(s.role);
  const url = s.role === 'cabang' && s.idCabang
    ? `${route}?cabang=${encodeURIComponent(s.idCabang)}`
    : route;

  window.location.href = url;
}

export function logout(redirectAfter = true) {
  clearSession();
  if (redirectAfter) {
    redirectToLogin();
  }
}

export function onSessionChange(callback) {
  const handler = (e) => {
    if (e.key === SESSION.key) {
      callback(e.newValue ? JSON.parse(e.newValue) : null);
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

export function watchSessionExpiry(onExpired, intervalMs = 60000) {
  const check = () => {
    if (!isSessionValid()) {
      onExpired?.();
    }
  };
  const timer = setInterval(check, intervalMs);
  return () => clearInterval(timer);
}

export default {
  getSession,
  setSession,
  clearSession,
  isSessionValid,
  isAdmin,
  isCabang,
  getSessionRemainingMinutes,
  getLastUsername,
  setLastUsername,
  getHomeRoute,
  requireAuth,
  requireAdmin,
  requireCabang,
  redirectIfAuthenticated,
  redirectToLogin,
  redirectToHome,
  logout,
  onSessionChange,
  watchSessionExpiry,
};