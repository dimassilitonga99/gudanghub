/* ═══════════════════════════════════════════════════════════════════════
   API — v3.5 Ultra Fast + Reliable
   - LocalStorage cache (stale-while-revalidate)
   - Prewarm AppScript
   - Auto-retry dengan exponential backoff
   - Parallel loading
   ═══════════════════════════════════════════════════════════════════════ */

import { API_URL, SETTINGS } from './config.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

const pendingRequests = new Map();
const memCache = new Map();

// LocalStorage cache prefix
const LS_CACHE_PREFIX = 'gudanghub_cache_';
const LS_CACHE_TTL = {
  getBarang: 5 * 60 * 1000,        // 5 menit
  getOrders: 60 * 1000,             // 1 menit
  getCabang: 30 * 60 * 1000,        // 30 menit
};

// ─────────────────────────────────────────────────────────────────────────
// LOCAL STORAGE CACHE
// ─────────────────────────────────────────────────────────────────────────

function getLSCache(action) {
  try {
    const key = LS_CACHE_PREFIX + action;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.time || !parsed.data) return null;

    return {
      data: parsed.data,
      time: parsed.time,
      age: Date.now() - parsed.time,
    };
  } catch {
    return null;
  }
}

function setLSCache(action, data) {
  try {
    const key = LS_CACHE_PREFIX + action;
    localStorage.setItem(key, JSON.stringify({
      time: Date.now(),
      data: data,
    }));
  } catch (e) {
    // localStorage full, ignore
    console.warn('[API] LS cache write failed:', e.message);
  }
}

export function clearLSCache(action) {
  try {
    if (action) {
      localStorage.removeItem(LS_CACHE_PREFIX + action);
    } else {
      // Clear all
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(LS_CACHE_PREFIX)) {
          localStorage.removeItem(k);
        }
      });
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// RESPONSE PARSER
// ─────────────────────────────────────────────────────────────────────────

export function parseResponse(text) {
  if (!text || !text.trim()) {
    return { status: 'error', message: 'Respons kosong dari server.' };
  }

  try {
    return JSON.parse(text);
  } catch {
    // continue
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // continue
    }
  }

  const lower = text.toLowerCase();
  if (lower.includes('sign in') || lower.includes('accounts.google')) {
    return {
      status: 'error',
      message: 'Server AppScript butuh login. Cek deployment access ke "Anyone".'
    };
  }

  return {
    status: 'error',
    message: 'Format respons server tidak valid.',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// FETCH WITH TIMEOUT
// ─────────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}, timeout = 45000) {
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
      throw new Error('Koneksi timeout. Server AppScript lambat.');
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LOW-LEVEL API CALLS
// ─────────────────────────────────────────────────────────────────────────

async function apiPostForm(action, payload = {}, timeout) {
  const body = JSON.stringify({ ...payload, action });

  const formData = new FormData();
  formData.append('payload', body);

  const response = await fetchWithTimeout(
    API_URL,
    { method: 'POST', body: formData },
    timeout
  );

  const text = await response.text();
  return parseResponse(text);
}

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
// SMART CALL dengan Auto-Retry
// ─────────────────────────────────────────────────────────────────────────

async function executeWithRetry(action, payload, timeout = 45000, maxRetries = 2) {

  let lastError = null;

  // Strategy: POST first, then GET as fallback
  const strategies = [apiPostForm, apiGetQuery];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {

    for (const strategy of strategies) {
      try {
        const result = await strategy(action, payload, timeout);
        if (result && result.status) {
          return result;
        }
      } catch (error) {
        lastError = error;
        console.warn(`[API] ${strategy.name} attempt ${attempt} failed:`, error.message);
      }
    }

    // Delay before next attempt (exponential backoff)
    if (attempt < maxRetries) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  return {
    status: 'error',
    message: lastError?.message || 'Gagal terhubung ke server.',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: callApi dengan Stale-While-Revalidate
// ─────────────────────────────────────────────────────────────────────────

export async function callApi(action, payload = {}, options = {}) {

  const {
    dedupe = true,
    cache: useCache = false,
    cacheTtl = SETTINGS.cacheDuration,
    timeout = 45000,
    onStaleData = null,   // Callback saat ada stale data (untuk stale-while-revalidate)
  } = options;

  const cacheKey = `${action}::${JSON.stringify(payload)}`;

  // ═══ MEMORY CACHE ═══
  if (useCache) {
    const cached = memCache.get(cacheKey);
    if (cached && Date.now() - cached.time < cacheTtl) {
      return cached.data;
    }
  }

  // ═══ DEDUPLICATION ═══
  if (dedupe && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  const promise = executeWithRetry(action, payload, timeout)
    .then((result) => {
      if (useCache && result.status === 'ok') {
        memCache.set(cacheKey, { data: result, time: Date.now() });
        // Save to localStorage too (persistent)
        setLSCache(action, result);
      }
      return result;
    })
    .finally(() => {
      if (dedupe) pendingRequests.delete(cacheKey);
    });

  if (dedupe) pendingRequests.set(cacheKey, promise);

  return promise;
}

// ─────────────────────────────────────────────────────────────────────────
// STALE-WHILE-REVALIDATE PATTERN
// ─────────────────────────────────────────────────────────────────────────

/**
 * Fetch dengan stale-while-revalidate:
 * 1. Return cache langsung (kalau ada) → INSTANT
 * 2. Fetch baru di background → update cache
 * 3. Panggil onFresh callback saat data baru siap
 */
export async function callApiStale(action, payload = {}, options = {}) {

  const {
    ttl = 5 * 60 * 1000,           // 5 menit (untuk cache expire)
    maxAge = 24 * 60 * 60 * 1000,  // 24 jam (batas maksimal cache)
    onFresh = null,                 // Callback saat data fresh datang
    timeout = 45000,
  } = options;

  // ═══ Check LocalStorage cache ═══
  const cached = getLSCache(action);

  if (cached && cached.age < maxAge) {

    // Fresh cache → return langsung
    if (cached.age < ttl) {
      return {
        ...cached.data,
        _fromCache: true,
        _cacheAge: cached.age,
      };
    }

    // Stale cache → return + refresh di background
    setTimeout(() => {
      executeWithRetry(action, payload, timeout).then(freshResult => {
        if (freshResult && freshResult.status === 'ok') {
          setLSCache(action, freshResult);
          memCache.set(`${action}::${JSON.stringify(payload)}`, {
            data: freshResult,
            time: Date.now(),
          });

          // Panggil callback jika ada
          if (typeof onFresh === 'function') {
            onFresh(freshResult);
          }
        }
      }).catch(() => {});
    }, 100);

    return {
      ...cached.data,
      _fromCache: true,
      _cacheAge: cached.age,
      _stale: true,
    };
  }

  // ═══ No cache → fetch fresh ═══
  const result = await executeWithRetry(action, payload, timeout);

  if (result && result.status === 'ok') {
    setLSCache(action, result);
    memCache.set(`${action}::${JSON.stringify(payload)}`, {
      data: result,
      time: Date.now(),
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// PREWARM APPSCRIPT (bangunkan cold start)
// ─────────────────────────────────────────────────────────────────────────

let prewarmDone = false;

export function prewarmAppScript() {
  if (prewarmDone) return;
  prewarmDone = true;

  // Fire-and-forget ping ke AppScript
  try {
    fetch(API_URL + '?ping=1&t=' + Date.now(), {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
    }).catch(() => {});
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// CACHE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

export function clearCache(prefix = '') {
  if (!prefix) {
    memCache.clear();
    return;
  }
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
}

export function clearPending() {
  pendingRequests.clear();
}

// ─────────────────────────────────────────────────────────────────────────
// HIGH-LEVEL API METHODS
// ─────────────────────────────────────────────────────────────────────────

export const auth = {

  async login({ username, password }) {
    clearPending();
    return callApi(
      'login',
      { username, password },
      {
        dedupe: false,
        cache: false,
        timeout: 20000,
      }
    );
  },

  changePassword({ username, passwordLama, passwordBaru }) {
    return callApi(
      'changePassword',
      { username, passwordLama, passwordBaru },
      { dedupe: false, timeout: 20000 }
    );
  },

  forgotPassword({ username }) {
    return callApi(
      'forgotPassword',
      { username },
      { dedupe: false, timeout: 20000 }
    );
  },
};

export const katalog = {

  // Regular fetch (bisa slow)
  getAll(options = {}) {
    return callApi(
      'getBarang',
      {},
      {
        cache: options.cache !== false,
        cacheTtl: 5 * 60 * 1000,  // 5 menit memory
        timeout: 45000,
      }
    );
  },

  // ★ FAST: Stale-while-revalidate (INSTANT dari cache)
  getAllFast(onFresh) {
    return callApiStale('getBarang', {}, {
      ttl: 5 * 60 * 1000,
      maxAge: 24 * 60 * 60 * 1000,
      onFresh: onFresh,
      timeout: 45000,
    });
  },

  refresh() {
    clearCache('getBarang');
    clearLSCache('getBarang');
    return this.getAll({ cache: false });
  },
};

export const cabang = {
  getAll(options = {}) {
    return callApi(
      'getCabang',
      {},
      {
        cache: options.cache !== false,
        cacheTtl: 30 * 60 * 1000,
        timeout: 45000,
      }
    );
  },
};

export const orders = {

  getAll(options = {}) {
    return callApi(
      'getOrders',
      {},
      {
        cache: options.cache !== false,
        cacheTtl: 30 * 1000,
        timeout: 45000,
      }
    );
       // ★ RESET semua order (butuh password admin)
  resetAll({ password, idCabang }) {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi(
      'resetAllOrders',
      { password, idCabang },
      { dedupe: false, timeout: 60000 }
    );
  },


  // ★ FAST: Stale-while-revalidate untuk orders
  getAllFast(onFresh) {
    return callApiStale('getOrders', {}, {
      ttl: 30 * 1000,
      maxAge: 60 * 60 * 1000,
      onFresh: onFresh,
      timeout: 45000,
    });
  },

  getDetail(orderId) {
    return callApi('getOrderDetail', { orderId }, { cache: false, timeout: 30000 });
  },

  submit({ idCabang, catatan, items }) {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi(
      'submitOrder',
      { idCabang, catatan, items },
      { dedupe: false, timeout: 60000 }
    );
  },

  updateStatus({ orderId, status, alasan = '' }) {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi(
      'updateStatus',
      { orderId, status, alasan },
      { dedupe: false, timeout: 30000 }
    );
  },

  edit({ orderId, items, catatanAdmin = '', diprosesOleh = '', kirimEmail = false }) {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi(
      'editOrder',
      { orderId, items, catatanAdmin, diprosesOleh, kirimEmail },
      { dedupe: false, timeout: 60000 }
    );
  },

  sendEmail({ orderId, catatanAdmin = '' }) {
    return callApi(
      'sendEmailNotif',
      { orderId, catatanAdmin },
      { dedupe: false, timeout: 30000 }
    );
  },

  refresh() {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return this.getAll({ cache: false });
  },
};

// ─────────────────────────────────────────────────────────────────────────
// LOAD ALL (parallel + stale-while-revalidate)
// ─────────────────────────────────────────────────────────────────────────

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
  callApiStale,
  parseResponse,
  clearCache,
  clearLSCache,
  clearPending,
  prewarmAppScript,
  loadAll,
  auth,
  katalog,
  cabang,
  orders,
};
