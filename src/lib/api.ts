import { API_URL, APPS_SCRIPT_URL, SETTINGS } from './config';
import { getSession } from './session';

export { API_URL };

// Action baru yang belum dikenal worker proxy → panggil Apps Script langsung
// (CORS Apps Script terbuka penuh; FormData POST = simple request tanpa preflight).
const DIRECT_ACTIONS = ['submitFeedback', 'createBarang', 'updateBarang', 'deleteBarang'];

function apiBaseUrl(action: string): string {
  return DIRECT_ACTIONS.indexOf(action) !== -1 ? APPS_SCRIPT_URL : API_URL;
}

export interface ApiResult<T = unknown> {
  status: 'ok' | 'error';
  message?: string;
  code?: string;
  data?: T;
  [key: string]: unknown;
}

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

const pendingRequests = new Map<string, Promise<ApiResult>>();
const memCache = new Map<string, { data: ApiResult; time: number }>();
const LS_CACHE_PREFIX = 'gudanghub_cache_';

export const PUBLIC_ACTIONS = ['login', 'forgotPassword', 'ping'];

// ─────────────────────────────────────────────────────────────────────────
// AUTH-REQUIRED HANDLER (global, bisa di-override oleh React app)
// ─────────────────────────────────────────────────────────────────────────

let authRequiredHandler: (() => void) | null = null;

export function setAuthRequiredHandler(fn: (() => void) | null): void {
  authRequiredHandler = fn;
}

function handleAuthRequired(): void {
  try {
    sessionStorage.removeItem('gudanghub_session');
    localStorage.removeItem('gudanghub_session');
  } catch {
    /* ignore */
  }
  if (authRequiredHandler) {
    authRequiredHandler();
    return;
  }
  try {
    const isLoginPage = window.location.pathname.indexOf('login') !== -1;
    if (!isLoginPage) {
      window.location.href = './login';
    }
  } catch {
    /* ignore */
  }
}

function attachToken(action: string, payload: Record<string, unknown>): Record<string, unknown> {
  if (PUBLIC_ACTIONS.indexOf(action) !== -1) return payload;
  const s = getSession();
  if (s && s.token) {
    return { ...payload, token: s.token };
  }
  return payload;
}

// ─────────────────────────────────────────────────────────────────────────
// LOCAL STORAGE CACHE
// ─────────────────────────────────────────────────────────────────────────

interface LSCacheEntry {
  time: number;
  data: ApiResult;
}

function getLSCache(action: string): { data: ApiResult; time: number; age: number } | null {
  try {
    const key = LS_CACHE_PREFIX + action;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LSCacheEntry;
    if (!parsed || !parsed.time || !parsed.data) return null;
    return { data: parsed.data, time: parsed.time, age: Date.now() - parsed.time };
  } catch {
    return null;
  }
}

function setLSCache(action: string, data: ApiResult): void {
  try {
    const key = LS_CACHE_PREFIX + action;
    localStorage.setItem(
      key,
      JSON.stringify({ time: Date.now(), data } satisfies LSCacheEntry),
    );
  } catch (e) {
    console.warn('[API] LS cache write failed:', (e as Error).message);
  }
}

export function clearLSCache(action?: string): void {
  try {
    if (action) {
      localStorage.removeItem(LS_CACHE_PREFIX + action);
    } else {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(LS_CACHE_PREFIX)) localStorage.removeItem(k);
      });
    }
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RESPONSE PARSER (mendukung GZIP 'GZ1:')
// ─────────────────────────────────────────────────────────────────────────

async function decompressGz(text: string): Promise<string> {
  const b64 = text.slice(4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Browser tidak mendukung dekompresi.');
  }
  const ds = new DecompressionStream('gzip');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return await new Response(stream).text();
}

export async function parseResponse(text: string): Promise<ApiResult> {
  if (!text || !text.trim()) {
    return { status: 'error', message: 'Respons kosong dari server.' };
  }

  try {
    if (text.indexOf('GZ1:') === 0) {
      const plain = await decompressGz(text);
      return JSON.parse(plain) as ApiResult;
    }
    return JSON.parse(text) as ApiResult;
  } catch {
    /* continue */
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ApiResult;
    }
  } catch {
    /* continue */
  }

  const lower = text.toLowerCase();
  if (lower.includes('sign in') || lower.includes('accounts.google')) {
    return {
      status: 'error',
      message: 'Server AppScript butuh login. Cek deployment access ke "Anyone".',
    };
  }

  return { status: 'error', message: 'Format respons server tidak valid.' };
}

// ─────────────────────────────────────────────────────────────────────────
// FETCH WITH TIMEOUT
// ─────────────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (error) {
    clearTimeout(timer);
    if ((error as Error).name === 'AbortError') {
      throw new Error('Server lambat (timeout). Coba lagi dalam beberapa detik.');
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LOW-LEVEL CALLS
// ─────────────────────────────────────────────────────────────────────────

async function apiPostForm(action: string, payload: Record<string, unknown>, timeout: number): Promise<ApiResult> {
  const body = JSON.stringify({ ...attachToken(action, payload), action });
  const formData = new FormData();
  formData.append('payload', body);
  const response = await fetchWithTimeout(apiBaseUrl(action), { method: 'POST', body: formData }, timeout);
  const text = await response.text();
  return await parseResponse(text);
}

async function apiGetQuery(action: string, payload: Record<string, unknown>, timeout: number): Promise<ApiResult> {
  const body = JSON.stringify({ ...attachToken(action, payload), action });
  const url =
    apiBaseUrl(action) +
    '?action=' +
    encodeURIComponent(action) +
    '&payload=' +
    encodeURIComponent(body) +
    '&t=' +
    Date.now();
  if (url.length > 7000) {
    throw new Error('Payload terlalu besar.');
  }
  const response = await fetchWithTimeout(url, { cache: 'no-store' }, timeout);
  const text = await response.text();
  return await parseResponse(text);
}

// ─────────────────────────────────────────────────────────────────────────
// EXECUTE WITH RETRY
// ─────────────────────────────────────────────────────────────────────────

async function executeWithRetry(
  action: string,
  payload: Record<string, unknown>,
  timeout: number,
  maxRetries: number,
): Promise<ApiResult> {
  let lastError: Error | null = null;
  // Payload besar (mis. gambar base64) HANYA lewat POST FormData —
  // fallback GET dibuang karena URL tak muat & errornya menyesatkan.
  const isBig = JSON.stringify(payload).length > 6000;
  const strategies: Array<(a: string, p: Record<string, unknown>, t: number) => Promise<ApiResult>> =
    action === 'login' || isBig ? [apiPostForm] : [apiPostForm, apiGetQuery];

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (const strategy of strategies) {
      try {
        const result = await strategy(action, payload, timeout);
        if (result && result.status) {
          return result;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn('[API]', strategy.name, 'attempt', attempt, 'failed:', (error as Error).message);
      }
    }
    if (attempt < maxRetries) {
      const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 3000);
      await new Promise((r) => setTimeout(r, delayMs));
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

export interface CallOptions {
  dedupe?: boolean;
  cache?: boolean;
  cacheTtl?: number;
  timeout?: number;
  maxRetries?: number;
}

export async function callApi(
  action: string,
  payload: Record<string, unknown> = {},
  options: CallOptions = {},
): Promise<ApiResult> {
  const dedupe = options.dedupe !== undefined ? options.dedupe : true;
  const useCache = options.cache || false;
  const cacheTtl = options.cacheTtl || SETTINGS.cacheDuration;
  const timeout = options.timeout || 45000;
  const maxRetries = options.maxRetries || 2;

  const cacheKey = action + '::' + JSON.stringify(payload);

  if (useCache) {
    const cached = memCache.get(cacheKey);
    if (cached && Date.now() - cached.time < cacheTtl) {
      return cached.data;
    }
  }

  if (dedupe && pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey)!;
  }

  const promise = executeWithRetry(action, payload, timeout, maxRetries)
    .then((result) => {
      if (result && result.code === 'AUTH_REQUIRED' && PUBLIC_ACTIONS.indexOf(action) === -1) {
        handleAuthRequired();
      }
      // Write-through: data bersama (getOrders/getBarang/getCabang) selalu
      // disegarkan di cache lokal walau dipanggil dengan cache:false,
      // supaya refresh pasca-write tidak meninggalkan cache basi.
      const sharedReads = action === 'getOrders' || action === 'getBarang' || action === 'getCabang';
      // Hasil KOSONG pun ditulis (array sah): reset semua order membuat getOrders
      // mengembalikan [], dan cache lokal harus ikut bersih — bukan data lama.
      if ((useCache || sharedReads) && result.status === 'ok' && Array.isArray(result.data)) {
        memCache.set(cacheKey, { data: result, time: Date.now() });
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
// STALE-WHILE-REVALIDATE
// ─────────────────────────────────────────────────────────────────────────

export interface StaleOptions extends CallOptions {
  ttl?: number;
  maxAge?: number;
  onFresh?: (result: ApiResult) => void;
}

export async function callApiStale(
  action: string,
  payload: Record<string, unknown> = {},
  options: StaleOptions = {},
): Promise<ApiResult> {
  const maxAge = options.maxAge || 24 * 60 * 60 * 1000;
  const onFresh = options.onFresh || null;
  const timeout = options.timeout || 45000;

  const cached = getLSCache(action);

  if (cached && cached.age < maxAge) {
    // SELALU revalidate di background (bukan hanya saat umur > ttl):
    // data bisa basi karena write dari browser lain (reset order, approve,
    // reject, order baru). Tanpa ini, F5 dalam ttl menampilkan data lama
    // yang tidak pernah terkoreksi.
    setTimeout(() => {
      executeWithRetry(action, payload, timeout, 2)
        .then((freshResult) => {
          if (
            freshResult &&
            freshResult.code === 'AUTH_REQUIRED' &&
            PUBLIC_ACTIONS.indexOf(action) === -1
          ) {
            handleAuthRequired();
            return;
          }
          // Hasil KOSONG pun sah (mis. semua order direset): tetap tulis cache
          // dan kabari UI, supaya data lama tidak hidup terus.
          if (freshResult && freshResult.status === 'ok' && Array.isArray(freshResult.data)) {
            setLSCache(action, freshResult);
            memCache.set(action + '::' + JSON.stringify(payload), {
              data: freshResult,
              time: Date.now(),
            });
            if (typeof onFresh === 'function') {
              onFresh(freshResult);
            }
          }
        })
        .catch(() => {
          /* ignore */
        });
    }, 100);

    return { ...cached.data, _fromCache: true, _cacheAge: cached.age, _stale: true };
  }

  const result = await executeWithRetry(action, payload, timeout, 2);

  if (result && result.code === 'AUTH_REQUIRED' && PUBLIC_ACTIONS.indexOf(action) === -1) {
    handleAuthRequired();
    return result;
  }

  if (result && result.status === 'ok' && Array.isArray(result.data)) {
    setLSCache(action, result);
    memCache.set(action + '::' + JSON.stringify(payload), { data: result, time: Date.now() });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// PREWARM & KEEP-ALIVE
// ─────────────────────────────────────────────────────────────────────────

let prewarmDone = false;

export function prewarmAppScript(): void {
  if (prewarmDone) return;
  prewarmDone = true;
  try {
    fetch(API_URL + '?action=ping&t=' + Date.now(), {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
    }).catch(() => {
      /* ignore */
    });
  } catch {
    /* ignore */
  }
}

let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

export function startKeepAlive(intervalMs = 4 * 60 * 1000): void {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => {
    try {
      if (!document.hidden) {
        fetch(API_URL + '?action=ping&t=' + Date.now(), {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
        }).catch(() => {
          /* ignore */
        });
      }
    } catch {
      /* ignore */
    }
  }, intervalMs);
}

startKeepAlive();

// ─────────────────────────────────────────────────────────────────────────
// CACHE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────

export function clearCache(prefix?: string): void {
  if (!prefix) {
    memCache.clear();
    return;
  }
  const keysToDelete: string[] = [];
  for (const key of memCache.keys()) {
    if (key.startsWith(prefix)) keysToDelete.push(key);
  }
  keysToDelete.forEach((k) => memCache.delete(k));
}

export function clearPending(): void {
  pendingRequests.clear();
}

// ─────────────────────────────────────────────────────────────────────────
// HIGH-LEVEL API METHODS
// ─────────────────────────────────────────────────────────────────────────

export const auth = {
  login(data: Record<string, unknown>): Promise<ApiResult> {
    clearPending();
    return callApi('login', data, { dedupe: false, cache: false, timeout: 15000, maxRetries: 1 });
  },
  changePassword(data: Record<string, unknown>): Promise<ApiResult> {
    return callApi('changePassword', data, { dedupe: false, timeout: 20000 });
  },
  forgotPassword(data: Record<string, unknown>): Promise<ApiResult> {
    return callApi('forgotPassword', data, { dedupe: false, timeout: 20000 });
  },
};

export const katalog = {
  getAll(options: CallOptions = {}): Promise<ApiResult> {
    return callApi('getBarang', {}, {
      cache: options.cache !== false,
      cacheTtl: 5 * 60 * 1000,
      timeout: 45000,
      maxRetries: options.maxRetries ?? 2,
    });
  },
  getAllFast(onFresh?: (r: ApiResult) => void): Promise<ApiResult> {
    return callApiStale('getBarang', {}, {
      ttl: 5 * 60 * 1000,
      maxAge: 24 * 60 * 60 * 1000,
      onFresh,
      timeout: 45000,
    });
  },
  async refresh(): Promise<ApiResult> {
    clearCache('getBarang');
    clearLSCache('getBarang');
    return katalog.getAll({ cache: false });
  },
  create(data: Record<string, unknown>): Promise<ApiResult> {
    return callApi('createBarang', data, { dedupe: false, timeout: 90000, maxRetries: 3 });
  },
  update(data: Record<string, unknown>): Promise<ApiResult> {
    return callApi('updateBarang', data, { dedupe: false, timeout: 90000, maxRetries: 3 });
  },
  remove(kode: string): Promise<ApiResult> {
    return callApi('deleteBarang', { kode }, { dedupe: false, timeout: 60000, maxRetries: 3 });
  },
  getGambar(kode: string): Promise<ApiResult> {
    return callApi('getGambar', { kode }, { dedupe: false, cache: false, timeout: 30000 });
  },
};

export const cabang = {
  getAll(options: CallOptions = {}): Promise<ApiResult> {
    return callApi('getCabang', {}, {
      cache: options.cache !== false,
      cacheTtl: 30 * 60 * 1000,
      timeout: 45000,
    });
  },
};

export const cart = {
  sync(data: Record<string, unknown>): Promise<ApiResult> {
    return callApi('syncCart', data, { dedupe: false, timeout: 15000, cache: false });
  },
  get(username: string): Promise<ApiResult> {
    return callApi('getCart', { username }, { dedupe: true, timeout: 15000, cache: false });
  },
};

export const orders = {
  getAll(options: CallOptions = {}): Promise<ApiResult> {
    return callApi('getOrders', {}, {
      cache: options.cache !== false,
      cacheTtl: 30 * 1000,
      timeout: 45000,
    });
  },
  getAllFast(onFresh?: (r: ApiResult) => void): Promise<ApiResult> {
    return callApiStale('getOrders', {}, {
      ttl: 30 * 1000,
      maxAge: 60 * 60 * 1000,
      onFresh,
      timeout: 45000,
    });
  },
  getDetail(orderId: string): Promise<ApiResult> {
    return callApi('getOrderDetail', { orderId }, { cache: false, timeout: 30000 });
  },
  submit(data: Record<string, unknown>): Promise<ApiResult> {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi('submitOrder', data, { dedupe: false, timeout: 60000 });
  },
  updateStatus(data: Record<string, unknown>): Promise<ApiResult> {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi('updateStatus', data, { dedupe: false, timeout: 30000 });
  },
  edit(data: Record<string, unknown>): Promise<ApiResult> {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi('editOrder', data, { dedupe: false, timeout: 60000 });
  },
  sendEmail(data: Record<string, unknown>): Promise<ApiResult> {
    return callApi('sendEmailNotif', data, { dedupe: false, timeout: 30000 });
  },
  refresh(): Promise<ApiResult> {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return orders.getAll({ cache: false });
  },
  resetAll(data: Record<string, unknown>): Promise<ApiResult> {
    clearCache('getOrders');
    clearLSCache('getOrders');
    return callApi('resetAllOrders', data, { dedupe: false, timeout: 60000 });
  },
};

// ─────────────────────────────────────────────────────────────────────────
// LOAD ALL (parallel)
// ─────────────────────────────────────────────────────────────────────────

export async function loadAll(options: { cache?: boolean } = {}): Promise<{
  orders: unknown[];
  katalog: unknown[];
  errors: unknown[];
}> {
  const useCache = options.cache !== undefined ? options.cache : true;
  const results = await Promise.allSettled([
    orders.getAll({ cache: useCache }),
    katalog.getAll({ cache: useCache }),
  ]);

  const ordersRes = results[0];
  const katalogRes = results[1];

  return {
    orders:
      ordersRes.status === 'fulfilled' && ordersRes.value.status === 'ok'
        ? (ordersRes.value.data as unknown[])
        : [],
    katalog:
      katalogRes.status === 'fulfilled' && katalogRes.value.status === 'ok'
        ? (katalogRes.value.data as unknown[])
        : [],
    errors: [
      ordersRes.status === 'rejected' ? ordersRes.reason : null,
      katalogRes.status === 'rejected' ? katalogRes.reason : null,
    ].filter(Boolean),
  };
}