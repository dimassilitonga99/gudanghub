/* ═══════════════════════════════════════════════════════════════════════
   API — v3.6 Ultra Fast + Reliable + Reset Orders
   ═══════════════════════════════════════════════════════════════════════ */

import { auth, prewarmAppScript } from '../api.js';
import { API_URL } from '../config.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

const pendingRequests = new Map();
const memCache = new Map();

const LS_CACHE_PREFIX = 'gudanghub_cache_';

// ─────────────────────────────────────────────────────────────────────────
// LOCAL STORAGE CACHE
// ─────────────────────────────────────────────────────────────────────────

function getLSCache(action) {
  try {
    var key = LS_CACHE_PREFIX + action;
    var raw = localStorage.getItem(key);
    if (!raw) return null;

    var parsed = JSON.parse(raw);
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
    var key = LS_CACHE_PREFIX + action;
    localStorage.setItem(key, JSON.stringify({
      time: Date.now(),
      data: data,
    }));
  } catch (e) {
    console.warn('[API] LS cache write failed:', e.message);
  }
}

export function clearLSCache(action) {
  try {
    if (action) {
      localStorage.removeItem(LS_CACHE_PREFIX + action);
    } else {
      Object.keys(localStorage).forEach(function (k) {
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

  var jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // continue
    }
  }

  var lower = text.toLowerCase();
  if (lower.includes('sign in') || lower.includes('accounts.google')) {
    return {
      status: 'error',
      message: 'Server AppScript butuh login. Cek deployment access ke "Anyone".',
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

async function fetchWithTimeout(url, options, timeout) {
  if (!timeout) timeout = 45000;

  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, timeout);

  try {
    var response = await fetch(url, Object.assign({}, options, {
      signal: controller.signal,
    }));
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

async function apiPostForm(action, payload, timeout) {
  var body = JSON.stringify(Object.assign({}, payload, { action: action }));

  var formData = new FormData();
  formData.append('payload', body);

  var response = await fetchWithTimeout(
    API_URL,
    { method: 'POST', body: formData },
    timeout
  );

  var text = await response.text();
  return parseResponse(text);
}

async function apiGetQuery(action, payload, timeout) {
  var body = JSON.stringify(Object.assign({}, payload, { action: action }));
  var url = API_URL + '?action=' + encodeURIComponent(action) + '&payload=' + encodeURIComponent(body) + '&t=' + Date.now();

  if (url.length > 7000) {
    throw new Error('Payload terlalu besar.');
  }

  var response = await fetchWithTimeout(url, { cache: 'no-store' }, timeout);
  var text = await response.text();
  return parseResponse(text);
}

// ─────────────────────────────────────────────────────────────────────────
// EXECUTE WITH RETRY
// ─────────────────────────────────────────────────────────────────────────

async function executeWithRetry(action, payload, timeout, maxRetries) {
  if (!timeout) timeout = 45000;
  if (!maxRetries) maxRetries = 2;

  var lastError = null;
  var strategies = [apiPostForm, apiGetQuery];

  for (var attempt = 1; attempt <= maxRetries; attempt++) {
    for (var s = 0; s < strategies.length; s++) {
      try {
        var result = await strategies[s](action, payload, timeout);
        if (result && result.status) {
          return result;
        }
      } catch (error) {
        lastError = error;
        console.warn('[API] ' + strategies[s].name + ' attempt ' + attempt + ' failed:', error.message);
      }
    }

    if (attempt < maxRetries) {
      var delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
      await new Promise(function (r) { setTimeout(r, delayMs); });
    }
  }

  return {
    status: 'error',
    message: lastError ? lastError.message : 'Gagal terhubung ke server.',
  };
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC: callApi
// ─────────────────────────────────────────────────────────────────────────

export async function callApi(action, payload, options) {
  if (!payload) payload = {};
  if (!options) options = {};

  var dedupe = options.dedupe !== undefined ? options.dedupe : true;
  var useCache = options.cache || false;
  var cacheTtl = options.cacheTtl || SETTINGS.cacheDuration;
  var timeout = options.timeout || 45000;

  var cacheKey = action + '::' + JSON.stringify(payload);

  // Memory cache
  if (useCache) {
    var cached = memCache.get(cacheKey);
    if (cached && Date.now() - cached.time < cacheTtl) {
      return cached.data;
    }
  }

  // Deduplication
  if (dedupe && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  var promise = executeWithRetry(action, payload, timeout)
    .then(function (result) {
      if (useCache && result.status === 'ok') {
        memCache.set(cacheKey, { data: result, time: Date.now() });
        setLSCache(action, result);
      }
      return result;
    })
    .finally(function () {
      if (dedupe) pendingRequests.delete(cacheKey);
    });

  if (dedupe) pendingRequests.set(cacheKey, promise);

  return promise;
}

// ─────────────────────────────────────────────────────────────────────────
// STALE-WHILE-REVALIDATE
// ─────────────────────────────────────────────────────────────────────────

export async function callApiStale(action, payload, options) {
  if (!payload) payload = {};
  if (!options) options = {};

  var ttl = options.ttl || 5 * 60 * 1000;
  var maxAge = options.maxAge || 24 * 60 * 60 * 1000;
  var onFresh = options.onFresh || null;
  var timeout = options.timeout || 45000;

  // Check localStorage cache
  var cached = getLSCache(action);

  if (cached && cached.age < maxAge) {

    // Fresh cache
    if (cached.age < ttl) {
      return Object.assign({}, cached.data, {
        _fromCache: true,
        _cacheAge: cached.age,
      });
    }

    // Stale cache — return + refresh in background
    setTimeout(function () {
      executeWithRetry(action, payload, timeout).then(function (freshResult) {
        if (freshResult && freshResult.status === 'ok') {
          setLSCache(action, freshResult);
          memCache.set(action + '::' + JSON.stringify(payload), {
            data: freshResult,
            time: Date.now(),
          });

          if (typeof onFresh === 'function') {
            onFresh(freshResult);
          }
        }
      }).catch(function () {});
    }, 100);

    return Object.assign({}, cached.data, {
      _fromCache: true,
      _cacheAge: cached.age,
      _stale: true,
    });
  }

  // No cache — fetch fresh
  var result = await executeWithRetry(action, payload, timeout);

  if (result && result.status === 'ok') {
    setLSCache(action, result);
    memCache.set(action + '::' + JSON.stringify(payload), {
      data: result,
      time: Date.now(),
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// PREWARM
// ─────────────────────────────────────────────────────────────────────────

var prewarmDone = false;

export function prewarmAppScript() {
  if (prewarmDone) return;
  prewarmDone = true;

  try {
    fetch(API_URL + '?ping=1&t=' + Date.now(), {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
    }).catch(function () {});
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// CACHE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

export function clearCache(prefix) {
  if (!prefix) {
    memCache.clear();
    return;
  }
  for (var key of memCache.keys()) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
}

export function clearPending() {
  pendingRequests.clear();
}

// ─────────────────────────────────────────────────────────────────────────
// HIGH-LEVEL API METHODS
// ─────────────────────────────────────────────────────────────────────────

export var auth = {

  login: function (data) {
    clearPending();
    return callApi('login', data, {
      dedupe: false,
      cache: false,
      timeout: 20000,
    });
  },

  changePassword: function (data) {
    return callApi('changePassword', data, {
      dedupe: false,
      timeout: 20000,
    });
  },

  forgotPassword: function (data) {
    return callApi('forgotPassword', data, {
      dedupe: false,
      timeout: 20000,
    });
  },
};

export var katalog = {

  getAll: function (options) {
    if (!options) options = {};
    return callApi('getBarang', {}, {
      cache: options.cache !== false,
      cacheTtl: 5 * 60 * 1000,
      timeout: 45000,
    });
  },

  getAllFast: function (onFresh) {
    return callApiStale('getBarang', {}, {
      ttl: 5 * 60 * 1000,
      maxAge: 24 * 60 * 60 * 1000,
      onFresh: onFresh,
      timeout: 45000,
    });
  },

  refresh: function () {
    clearCache('getBarang');
    clearLSCache('getBarang');
    return this.getAll({ cache: false });
  },
};

export var cabang = {

  getAll: function (options) {
    if (!options) options = {};
    return callApi('getCabang', {}, {
      cache: options.cache !== false,
      cacheTtl: 30 * 60 * 1000,
      timeout: 45000,
    });
  },
};

export var orders = {

  getAll: function (options) {
    if (!options) options = {};
    return callApi('getOrders', {}, {
      cache: options.cache !== false,
      cacheTtl: 30 * 1000,
      timeout: 45000,
    });
  },

  getAllFast: function (onFresh) {
    return callApiStale('getOrders', {}, {
      ttl: 30 * 1000,
      maxAge: 60 * 60 * 1000,
      onFresh: onFresh,
      timeout: 45000,
    });
  },

  getDetail: function (orderId) {
    return callApi('getOrderDetail', { orderId: orderId }, {
      cache: false,
      timeout: 30000,
    });
  },

  submit: function (data) {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi('submitOrder', data, {
      dedupe: false,
      timeout: 60000,
    });
  },

  updateStatus: function (data) {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi('updateStatus', data, {
      dedupe: false,
      timeout: 30000,
    });
  },

  edit: function (data) {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi('editOrder', data, {
      dedupe: false,
      timeout: 60000,
    });
  },

  sendEmail: function (data) {
    return callApi('sendEmailNotif', data, {
      dedupe: false,
      timeout: 30000,
    });
  },

  refresh: function () {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return this.getAll({ cache: false });
  },

  resetAll: function (data) {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi('resetAllOrders', data, {
      dedupe: false,
      timeout: 60000,
    });
  },
};

// ─────────────────────────────────────────────────────────────────────────
// LOAD ALL (parallel)
// ─────────────────────────────────────────────────────────────────────────

export async function loadAll(options) {
  if (!options) options = {};
  var useCache = options.cache !== undefined ? options.cache : true;

  var results = await Promise.allSettled([
    orders.getAll({ cache: useCache }),
    katalog.getAll({ cache: useCache }),
  ]);

  var ordersRes = results[0];
  var katalogRes = results[1];

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
  callApi: callApi,
  callApiStale: callApiStale,
  parseResponse: parseResponse,
  clearCache: clearCache,
  clearLSCache: clearLSCache,
  clearPending: clearPending,
  prewarmAppScript: prewarmAppScript,
  loadAll: loadAll,
  auth: auth,
  katalog: katalog,
  cabang: cabang,
  orders: orders,
};
