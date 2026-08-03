/* ═══════════════════════════════════════════════════════════════════════
   API — Wrapper untuk komunikasi dengan Google Apps Script
   v3.3 — Fast Login, Anti-Error, Robust Response Parser
   ═══════════════════════════════════════════════════════════════════════ */

import { API_URL, SETTINGS } from './config.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

const pendingRequests = new Map();
const cache = new Map();

// ─────────────────────────────────────────────────────────────────────────
// RESPONSE PARSER — Super robust
// ─────────────────────────────────────────────────────────────────────────

export function parseResponse(text) {
  if (!text || !text.trim()) {
    return { status: 'error', message: 'Respons kosong dari server.' };
  }

  // Strategy 1: Direct JSON parse
  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  // Strategy 2: Extract JSON dari HTML wrapper
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // continue
    }
  }

  // Strategy 3: Cek keyword auth di response
  const lower = text.toLowerCase();
  if (lower.includes('sign in') || lower.includes('accounts.google')) {
    return {
      status: 'error',
      message: 'Server AppScript butuh login. Cek deployment access ke "Anyone".'
    };
  }

  return {
    status: 'error',
    message: 'Format respons server tidak valid. Cek koneksi.',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FETCH WITH TIMEOUT
// ─────────────────────────────────────────────────────────────────────────

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
      throw new Error('Koneksi timeout. Cek internet Anda.');
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LOW-LEVEL API CALLS — Simplified, gunakan hanya 1 method (POST FormData)
// ─────────────────────────────────────────────────────────────────────────

/**
 * POST via FormData — paling kompatibel dengan Google Apps Script
 * Tidak trigger CORS preflight (text/plain vs application/json)
 */
async function apiPostForm(action, payload = {}, timeout) {
  const body = JSON.stringify({ ...payload, action });

  const formData = new FormData();
  formData.append('payload', body);

  const response = await fetchWithTimeout(
    API_URL,
    {
      method: 'POST',
      body: formData,
    },
    timeout
  );

  const text = await response.text();
  return parseResponse(text);
}

/**
 * GET fallback (untuk read-only cepat)
 */
async function apiGetQuery(action, payload = {}, timeout) {
  const body = JSON.stringify({ ...payload, action });
  const url = `${API_URL}?action=${encodeURIComponent(action)}&payload=${encodeURIComponent(body)}&t=${Date.now()}`;

  if (url.length > 7000) {
    throw new Error('Payload terlalu besar.');
  }

  const response = await fetchWithTimeout(url, { cache: 'no-store' }, timeout);
  const text = await response.text();
  return parseResponse(text);
}

// ─────────────────────────────────────────────────────────────────────────
// SMART CALL — Dedup, cache, dual-strategy
// ─────────────────────────────────────────────────────────────────────────

export async function callApi(action, payload = {}, options = {}) {
  const {
    preferMethod = 'auto',
    dedupe = true,
    cache: useCache = false,
    cacheTtl = SETTINGS.cacheDuration,
    timeout = SETTINGS.apiTimeout,
  } = options;

  const cacheKey = `${action}::${JSON.stringify(payload)}`;

  // Cache lookup
  if (useCache) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.time < cacheTtl) {
      return cached.data;
    }
  }

  // Deduplication
  if (dedupe && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const promise = executeCall(action, payload, preferMethod, timeout)
    .then((result) => {
      if (useCache && result.status === 'ok') {
        cache.set(cacheKey, { data: result, time: Date.now() });
      }
      return result;
    })
    .finally(() => {
      if (dedupe) {
        pendingRequests.delete(cacheKey);
      }
    });

  if (dedupe) {
    pendingRequests.set(cacheKey, promise);
  }

  return promise;
}

/**
 * Execute dengan fallback strategy
 */
async function executeCall(action, payload, preferMethod, timeout) {
  const strategies = preferMethod === 'get'
    ? [apiGetQuery, apiPostForm]
    : [apiPostForm, apiGetQuery];

  let lastError = null;

  for (const strategy of strategies) {
    try {
      const result = await strategy(action, payload, timeout);
      // Terima response apapun asal ada status
      if (result && result.status) {
        return result;
      }
    } catch (error) {
      lastError = error;
      console.warn(`[API] ${strategy.name} failed for ${action}:`, error.message);
    }
  }

  return {
    status: 'error',
    message: lastError?.message || 'Gagal terhubung ke server.',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CACHE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

export function clearCache(prefix = '') {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

// Clear pending requests (untuk force retry)
export function clearPending() {
  pendingRequests.clear();
}

// ─────────────────────────────────────────────────────────────────────────
// HIGH-LEVEL API METHODS
// ─────────────────────────────────────────────────────────────────────────

export const auth = {

  /**
   * Login — HYPER FAST
   * - Timeout 15 detik (bukan default 30)
   * - Tidak pakai cache
   * - Tidak pakai dedupe (setiap login harus fresh)
   * - POST FormData langsung
   */
  async login({ username, password }) {
    // Clear pending sebelum login (bypass stuck request)
    clearPending();

    return callApi(
      'login',
      { username, password },
      {
        dedupe: false,
        cache: false,
        timeout: 15000,
        preferMethod: 'post',
      }
    );
  },

  changePassword({ username, passwordLama, passwordBaru }) {
    return callApi(
      'changePassword',
      { username, passwordLama, passwordBaru },
      { dedupe: false, timeout: 15000 }
    );
  },

  forgotPassword({ username }) {
    return callApi(
      'forgotPassword',
      { username },
      { dedupe: false, timeout: 15000 }
    );
  },
};

export const katalog = {
  getAll(options = {}) {
    return callApi(
      'getBarang',
      {},
      { cache: options.cache !== false, cacheTtl: 60000 }
    );
  },

  refresh() {
    clearCache('getBarang');
    return this.getAll({ cache: false });
  },
};

export const cabang = {
  getAll(options = {}) {
    return callApi(
      'getCabang',
      {},
      { cache: options.cache !== false, cacheTtl: 300000 }
    );
  },
};

export const orders = {
  getAll(options = {}) {
    return callApi(
      'getOrders',
      {},
      { cache: options.cache !== false, cacheTtl: 30000 }
    );
  },

  getDetail(orderId) {
    return callApi('getOrderDetail', { orderId }, { cache: false });
  },

  submit({ idCabang, catatan, items }) {
    clearCache('getOrders');
    return callApi(
      'submitOrder',
      { idCabang, catatan, items },
      { dedupe: false }
    );
  },

  updateStatus({ orderId, status, alasan = '' }) {
    clearCache('getOrders');
    return callApi(
      'updateStatus',
      { orderId, status, alasan },
      { dedupe: false }
    );
  },

  edit({ orderId, items, catatanAdmin = '', diprosesOleh = '', kirimEmail = false }) {
    clearCache('getOrders');
    return callApi(
      'editOrder',
      { orderId, items, catatanAdmin, diprosesOleh, kirimEmail },
      { dedupe: false }
    );
  },

  sendEmail({ orderId, catatanAdmin = '' }) {
    return callApi(
      'sendEmailNotif',
      { orderId, catatanAdmin },
      { dedupe: false }
    );
  },

  refresh() {
    clearCache('getOrders');
    return this.getAll({ cache: false });
  },
};

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

export default {
  callApi,
  parseResponse,
  clearCache,
  clearPending,
  loadAll,
  auth,
  katalog,
  cabang,
  orders,
};
