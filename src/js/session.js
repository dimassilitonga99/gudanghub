/* ═══════════════════════════════════════════════════════════════════════
   SESSION — User Authentication & Session Management
   ═══════════════════════════════════════════════════════════════════════ */

import { SESSION, ROUTES, getHomeRoute } from './config.js';

// ─────────────────────────────────────────────────────────────────────────
// LOW-LEVEL STORAGE
// ─────────────────────────────────────────────────────────────────────────

/**
 * Baca session dari sessionStorage
 */
export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION.key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Simpan session
 */
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

/**
 * Hapus session
 */
export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION.key);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SESSION VALIDATION
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cek apakah session valid (ada + belum expired)
 */
export function isSessionValid(currentSession = null) {
  const s = currentSession || getSession();
  if (!s || !s.expires) return false;

  try {
    return new Date(s.expires) > new Date();
  } catch {
    return false;
  }
}

/**
 * Cek apakah user adalah admin
 */
export function isAdmin(currentSession = null) {
  const s = currentSession || getSession();
  return s?.role === 'admin';
}

/**
 * Cek apakah user adalah cabang
 */
export function isCabang(currentSession = null) {
  const s = currentSession || getSession();
  return s?.role === 'cabang';
}

/**
 * Get sisa waktu session (dalam menit)
 */
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

// ─────────────────────────────────────────────────────────────────────────
// LAST USER (untuk "Remember Me")
// ─────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────
// GUARDS (untuk protect halaman)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Require valid session, else redirect to login
 * @returns session data jika valid, else null (dan sudah redirect)
 */
export function requireAuth() {
  const s = getSession();

  if (!s || !isSessionValid(s)) {
    clearSession();
    redirectToLogin();
    return null;
  }

  return s;
}

/**
 * Require admin role
 */
export function requireAdmin() {
  const s = requireAuth();
  if (!s) return null;

  if (s.role !== 'admin') {
    redirectToHome(s);
    return null;
  }

  return s;
}

/**
 * Require cabang role
 */
export function requireCabang() {
  const s = requireAuth();
  if (!s) return null;

  if (s.role !== 'cabang') {
    redirectToHome(s);
    return null;
  }

  return s;
}

/**
 * Jangan tampilkan jika sudah login (buat halaman login)
 */
export function redirectIfAuthenticated() {
  const s = getSession();
  if (s && isSessionValid(s)) {
    redirectToHome(s);
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────
// REDIRECT HELPERS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Redirect ke halaman login
 */
export function redirectToLogin() {
  if (window.location.pathname.endsWith(ROUTES.login)) return;
  window.location.href = ROUTES.login;
}

/**
 * Redirect ke home sesuai role
 */
export function redirectToHome(currentSession = null) {
  const s = currentSession || getSession();
  if (!s) return redirectToLogin();

  const route = getHomeRoute(s.role);

  // Untuk cabang, tambahkan query param cabang
  const url = s.role === 'cabang' && s.idCabang
    ? `${route}?cabang=${encodeURIComponent(s.idCabang)}`
    : route;

  window.location.href = url;
}

/**
 * Logout & redirect
 */
export function logout(redirectAfter = true) {
  clearSession();
  if (redirectAfter) {
    redirectToLogin();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SESSION EVENTS (untuk detect logout dari tab lain, dll)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Listen untuk perubahan session (dari tab lain)
 */
export function onSessionChange(callback) {
  const handler = (e) => {
    if (e.key === SESSION.key) {
      callback(e.newValue ? JSON.parse(e.newValue) : null);
    }
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/**
 * Auto-check session validity setiap N detik
 * Callback dipanggil ketika session expired
 */
export function watchSessionExpiry(onExpired, intervalMs = 60000) {
  const check = () => {
    if (!isSessionValid()) {
      onExpired?.();
    }
  };

  const timer = setInterval(check, intervalMs);
  return () => clearInterval(timer);
}

// ─────────────────────────────────────────────────────────────────────────
// EXPORT DEFAULT
// ─────────────────────────────────────────────────────────────────────────

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
