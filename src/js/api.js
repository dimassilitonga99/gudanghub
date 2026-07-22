/* ═══════════════════════════════════════════════════════════════════════
   API — Wrapper untuk komunikasi dengan Google Apps Script
   ═══════════════════════════════════════════════════════════════════════ */

import { API_URL, SETTINGS } from './config.js';
import { sleep, retry } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

const pendingRequests = new Map(); // deduplication
const cache = new Map(); // simple cache

// ─────────────────────────────────────────────────────────────────────────
// RESPONSE PARSER
// ─────────────────────────────────────────────────────────────────────────

/**
 * Parse response text menjadi JSON dengan fallback
 * Google Apps Script kadang return HTML wrapper, kita extract JSON-nya
 */
export function parseResponse(text) {
  if (!text || !text.trim()) {
    return { status: 'error', message: 'Respons kosong dari server.' };
  }

  // Coba parse langsung
  try {
    return JSON.parse(text);
  } catch {
    // Fallback: extract JSON dari HTML/text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Failed
      }
    }
    return {
      status: 'error',
      message: 'Format respons server tidak valid.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FETCH WITH TIMEOUT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fetch dengan timeout support
 */
async function fetchWithTimeout(url, options = {}, timeout = SETTINGS.apiTimeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout — koneksi lambat atau server tidak merespon.');
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LOW-LEVEL API CALLS
// ─────────────────────────────────────────────────────────────────────────

/**
 * GET request ke API
 */
async function apiGet(action, payload = {}) {
  const body = JSON.stringify({ ...payload, action });
  const url = `${API_URL}?action=${encodeURIComponent(action)}&payload=${encodeURIComponent(body)}&t=${Date.now()}`;

  // Cek panjang URL (batas ± 8000 chars untuk GET)
  if (url.length > 7000) {
    throw new Error('Payload terlalu besar untuk GET, gunakan POST.');
  }

  const response = await fetchWithTimeout(url, { cache: 'no-store' });
  return parseResponse(await response.text());
}

/**
 * POST request ke API (dengan FormData untuk kompatibilitas)
 */
async function apiPost(action, payload = {}) {
  const body = JSON.stringify({ ...payload, action });

  // Try POST JSON dulu (jika Apps Script support)
  try {
    const response = await fetchWithTimeout(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const result = parseResponse(await response.text());
    if (result.status) return result;
  } catch {
    // Fallback ke FormData
  }

  // POST FormData (paling kompatibel dengan Apps Script)
  const formData = new FormData();
  formData.append('payload', body);

  const response = await fetchWithTimeout(API_URL, {
    method: 'POST',
    body: formData,
  });
  return parseResponse(await response.text());
}

/**
 * Smart call — auto pilih GET atau POST
 */
export async function callApi(action, payload = {}, options = {}) {
  const { preferMethod = 'auto', dedupe = true, cache: useCache = false, cacheTtl = SETTINGS.cacheDuration } = options;

  // Cache lookup (untuk GET-like requests)
  if (useCache) {
    const cacheKey = `${action}::${JSON.stringify(payload)}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.time < cacheTtl) {
      return cached.data;
    }
  }

  // Deduplication (cegah request ganda saat masih pending)
  if (dedupe) {
    const dedupeKey = `${action}::${JSON.stringify(payload)}`;
    if (pendingRequests.has(dedupeKey)) {
      return pendingRequests.get(dedupeKey);
    }

    const promise = executeCall(action, payload, preferMethod).finally(() => {
      pendingRequests.delete(dedupeKey);
    });

    pendingRequests.set(dedupeKey, promise);

    const result = await promise;

    if (useCache && result.status === 'ok') {
      const cacheKey = `${action}::${JSON.stringify(payload)}`;
      cache.set(cacheKey, { data: result, time: Date.now() });
    }

    return result;
  }

  return executeCall(action, payload, preferMethod);
}

/**
 * Execute call dengan retry & fallback
 */
async function executeCall(action, payload, preferMethod = 'auto') {
  const strategies = preferMethod === 'get'
    ? [apiGet, apiPost]
    : preferMethod === 'post'
    ? [apiPost, apiGet]
    : [apiPost, apiGet]; // default: POST first

  let lastError = null;

  for (const strategy of strategies) {
    try {
      const result = await strategy(action, payload);
      if (result.status === 'ok' || result.status === 'error') {
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }

  return {
    status: 'error',
    message: lastError?.message || 'Gagal terhubung ke server. Cek koneksi internet Anda.',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CACHE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Clear cache (semua atau by prefix)
 */
export function clearCache(prefix = '') {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// HIGH-LEVEL API METHODS
// ─────────────────────────────────────────────────────────────────────────

/**
 * ═══ AUTH ═══
 */

export const auth = {
  /**
   * Login user
   */
  login({ username, password }) {
    return callApi('login', { username, password }, { dedupe: false });
  },

  /**
   * Change password
   */
  changePassword({ username, passwordLama, passwordBaru }) {
    return callApi('changePassword', { username, passwordLama, passwordBaru }, { dedupe: false });
  },

  /**
   * Forgot password (kirim reset ke admin)
   */
  forgotPassword({ username }) {
    return callApi('forgotPassword', { username }, { dedupe: false });
  },
};

/**
 * ═══ KATALOG ═══
 */

export const katalog = {
  /**
   * Get all products
   */
  getAll(options = {}) {
    return callApi('getBarang', {}, { cache: options.cache !== false, cacheTtl: 60000 });
  },

  /**
   * Refresh (clear cache & fetch ulang)
   */
  refresh() {
    clearCache('getBarang');
    return this.getAll({ cache: false });
  },
};

/**
 * ═══ CABANG ═══
 */

export const cabang = {
  getAll(options = {}) {
    return callApi('getCabang', {}, { cache: options.cache !== false, cacheTtl: 300000 }); // cache 5 menit
  },
};

/**
 * ═══ ORDERS ═══
 */

export const orders = {
  /**
   * Get all orders (dengan detail)
   */
  getAll(options = {}) {
    return callApi('getOrders', {}, { cache: options.cache !== false, cacheTtl: 30000 });
  },

  /**
   * Get detail 1 order
   */
  getDetail(orderId) {
    return callApi('getOrderDetail', { orderId }, { cache: false });
  },

  /**
   * Submit order baru (dari cabang)
   */
  submit({ idCabang, catatan, items }) {
    clearCache('getOrders');
    return callApi('submitOrder', { idCabang, catatan, items }, { dedupe: false });
  },

  /**
   * Update status order (approve/reject seluruh)
   */
  updateStatus({ orderId, status, alasan = '' }) {
    clearCache('getOrders');
    return callApi('updateStatus', { orderId, status, alasan }, { dedupe: false });
  },

  /**
   * Edit order (per-item edit, save/send email)
   */
  edit({ orderId, items, catatanAdmin = '', diprosesOleh = '', kirimEmail = false }) {
    clearCache('getOrders');
    return callApi('editOrder', {
      orderId,
      items,
      catatanAdmin,
      diprosesOleh,
      kirimEmail,
    }, { dedupe: false });
  },

  /**
   * Kirim ulang email notifikasi
   */
  sendEmail({ orderId, catatanAdmin = '' }) {
    return callApi('sendEmailNotif', { orderId, catatanAdmin }, { dedupe: false });
  },

  /**
   * Refresh (clear cache)
   */
  refresh() {
    clearCache('getOrders');
    return this.getAll({ cache: false });
  },
};

/**
 * ═══ COMBINED (loading utility) ═══
 */

/**
 * Load semua data sekaligus (parallel)
 */
export async function loadAll(options = {}) {
  const { cache: useCache = true } = options;

  const [ordersRes, katalogRes] = await Promise.allSettled([
    orders.getAll({ cache: useCache }),
    katalog.getAll({ cache: useCache }),
  ]);

  return {
    orders: ordersRes.status === 'fulfilled' && ordersRes.value.status === 'ok'
      ? ordersRes.value.data
      : [],
    katalog: katalogRes.status === 'fulfilled' && katalogRes.value.status === 'ok'
      ? katalogRes.value.data
      : [],
    errors: [
      ordersRes.status === 'rejected' ? ordersRes.reason : null,
      katalogRes.status === 'rejected' ? katalogRes.reason : null,
    ].filter(Boolean),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// EXPORT DEFAULT
// ─────────────────────────────────────────────────────────────────────────

export default {
  callApi,
  parseResponse,
  clearCache,
  loadAll,
  auth,
  katalog,
  cabang,
  orders,
};
