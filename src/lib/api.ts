import { API_URL, SETTINGS } from './config';

export { API_URL };

const V5_BASE = 'https://gudanghub-api.vercel.app/api';

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
// V5 REST API — Token & Request
// ─────────────────────────────────────────────────────────────────────────

const LS_ACCESS = 'v5_access';
const LS_REFRESH = 'v5_refresh';

function getAccess(): string {
  try { return localStorage.getItem(LS_ACCESS) || ''; } catch { return ''; }
}
export function setV5Tokens(a: string, r: string) {
  try { localStorage.setItem(LS_ACCESS, a); localStorage.setItem(LS_REFRESH, r); } catch {}
}
export function clearV5Tokens() {
  try { localStorage.removeItem(LS_ACCESS); localStorage.removeItem(LS_REFRESH); } catch {}
}

async function refreshAccess(): Promise<string> {
  let rt = '';
  try { rt = localStorage.getItem(LS_REFRESH) || ''; } catch {}
  if (!rt) throw new Error('AUTH_REQUIRED');
  const r = await fetch(V5_BASE + '/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + rt },
  });
  if (!r.ok) { clearV5Tokens(); throw new Error('AUTH_REQUIRED'); }
  const j = await r.json();
  setV5Tokens(j.access_token, rt);
  return j.access_token;
}

async function v5Fetch(path: string, opts?: { method?: string; body?: string; token?: string }): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const tok = opts?.token || getAccess();
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const r = await fetchWithTimeout(V5_BASE + path, {
    method: opts?.method || 'GET',
    headers,
    body: opts?.body,
  }, 45000);
  const j = await r.json();
  if (r.status === 401) {
    const newTok = await refreshAccess().catch(() => '');
    if (!newTok) { clearV5Tokens(); return { error: 'AUTH_REQUIRED' }; }
    headers['Authorization'] = 'Bearer ' + newTok;
    const retry = await fetchWithTimeout(V5_BASE + path, {
      method: opts?.method || 'GET', headers, body: opts?.body,
    }, 45000);
    return retry.json();
  }
  return j;
}

function mapBarang(r: any): Record<string, unknown> {
  return {
    KODE_BARANG: r.kode, NAMA_BARANG: r.nama, KATEGORI: r.kategori || '',
    SATUAN: r.satuan || 'PCS', HARGA: Number(r.harga), STOK: r.stok ?? 0,
    STOK_GUDANG: r.stok_gudang ?? '', STOK_TOKO: r.stok_toko ?? '',
    DESKRIPSI: r.deskripsi || '', GAMBAR_KEY: r.gambar_key || '',
    UPDATED_AT: r.updated_at,
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function mapOrder(o: any): Record<string, unknown> {
  const fmt = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${pad2(d.getUTCDate())}-${pad2(d.getUTCMonth()+1)}-${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}:${pad2(d.getUTCSeconds())}`;
  };
  return {
    ORDER_ID: o.id, NOMOR_ORDER: o.nomor || '', ID_CABANG: o.cabang_id,
    NAMA_CABANG: o.nama_cabang || '', PIC: o.pic || '',
    TANGGAL_ORDER: fmt(o.tanggal), CATATAN: o.catatan || '',
    STATUS: o.status || 'PENDING', TANGGAL_PROSES: fmt(o.tanggal_proses),
    DIPROSES_OLEH: o.diproses_oleh || '',
    DETAIL: (o.items || []).map((i: any) => ({
      ORDER_ID: i.order_id, KODE_BARANG: i.kode_barang, NAMA_BARANG: i.nama_snapshot,
      KATEGORI: i.kategori || '', QTY: Number(i.qty), SATUAN: i.satuan || 'PCS',
      HARGA_SATUAN: Number(i.harga), SUBTOTAL: Number(i.subtotal),
      ITEM_STATUS: i.item_status, ORIGINAL_QTY: i.original_qty ?? '',
      REASON: i.reason || '', STOK_SISTEM: i.stok_sistem ?? '',
      STOK_GUDANG: i.stok_gudang ?? '', STOK_TOKO: i.stok_toko ?? '',
      STOK_PICKER: i.stok_picker ?? '', CATATAN_ITEM: i.catatan_item || '',
    })),
  };
}

// ── Action Router: GAS action name → REST endpoint ─────────────────────
async function executeAction(
  action: string,
  payload: Record<string, unknown>,
): Promise<ApiResult> {
  const P = payload;

  switch (action) {

    case 'ping':
      return { status: 'ok', message: 'pong' };

    case 'login': {
      const r = await fetch(V5_BASE + '/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: P.username, password: P.password }),
      });
      const j = await r.json();
      if (r.status !== 200) return { status: 'error', message: j.error || 'Login gagal.' };
      setV5Tokens(j.access_token, j.refresh_token);
      return { status: 'ok', token: j.access_token, user: j.user };
    }

    case 'forgotPassword':
      return { status: 'ok', message: 'Hubungi Admin Gudang untuk reset password.' };

    case 'getBarang': {
      const first = await v5Fetch('/barang?limit=2000');
      if (first.error) return { status: 'error', message: first.error };
      let all = [...(first.data || [])];
      let cursor = first.next_cursor;
      while (cursor && all.length < 6000) {
        const next = await v5Fetch('/barang?limit=2000&cursor=' + encodeURIComponent(cursor));
        if (next.error || !next.data?.length) break;
        all = all.concat(next.data);
        cursor = next.next_cursor;
      }
      return { status: 'ok', data: all.map(mapBarang) };
    }

    case 'getCabang':
      return { status: 'ok', data: [
        { ID_CABANG: 'CB001', NAMA_CABANG: 'Toko Nasional Eltari – Arfa', PIC: 'Arfa' },
        { ID_CABANG: 'CB002', NAMA_CABANG: 'Toko Perabot Mama Oesapa – Akmal', PIC: 'Akmal' },
        { ID_CABANG: 'CB003', NAMA_CABANG: 'Toko Perabot Mama TDM – Shally', PIC: 'Shally' },
        { ID_CABANG: 'CB004', NAMA_CABANG: 'Toko Perabot Mama Kefamenanu – Fajar', PIC: 'Fajar' },
      ]};

    case 'createBarang': {
      const j = await v5Fetch('/barang', { method: 'POST', body: JSON.stringify({
        kode: P.kode, nama: P.nama, kategori: P.kategori, satuan: P.satuan,
        harga: P.harga, stok: P.stok,
        stok_gudang: P.stokGudang === '' ? null : P.stokGudang,
        stok_toko: P.stokToko === '' ? null : P.stokToko,
        deskripsi: P.deskripsi || '',
      })});
      if (j.error) return { status: 'error', message: j.error };
      return { status: 'ok', message: 'Barang berhasil ditambahkan.', data: mapBarang(j.data) };
    }

    case 'updateBarang': {
      const kode = String(P.kode || '').toUpperCase();
      const body: Record<string, unknown> = {};
      if (P.nama !== undefined) body.nama = P.nama;
      if (P.kategori !== undefined) body.kategori = P.kategori;
      if (P.satuan !== undefined) body.satuan = P.satuan;
      if (P.harga !== undefined) body.harga = P.harga;
      if (P.stok !== undefined) body.stok = P.stok;
      if (P.stokGudang !== undefined) body.stok_gudang = P.stokGudang === '' ? null : P.stokGudang;
      if (P.stokToko !== undefined) body.stok_toko = P.stokToko === '' ? null : P.stokToko;
      if (P.deskripsi !== undefined) body.deskripsi = P.deskripsi;
      const j = await v5Fetch('/barang/' + encodeURIComponent(kode), { method: 'PATCH', body: JSON.stringify(body) });
      if (j.error) return { status: 'error', message: j.error };
      return { status: 'ok', message: 'Barang berhasil diperbarui.' };
    }

    case 'deleteBarang': {
      const kode = String(P.kode || '').toUpperCase();
      const j = await v5Fetch('/barang/' + encodeURIComponent(kode), { method: 'DELETE' });
      if (j.error) return { status: 'error', message: j.error };
      return { status: 'ok', message: 'Barang berhasil dihapus.' };
    }

    case 'getOrders': {
      const j = await v5Fetch('/orders');
      if (j.error) return { status: 'error', message: j.error };
      return { status: 'ok', data: (j.data || []).map(mapOrder) };
    }

    case 'getOrderDetail': {
      const orderId = String(P.orderId || '');
      const j = await v5Fetch('/orders/' + encodeURIComponent(orderId) + '/detail');
      if (j.error) return { status: 'error', message: j.error };
      return { status: 'ok', data: mapOrder(j.data).DETAIL };
    }

    case 'submitOrder': {
      const items = Array.isArray(P.items) ? P.items : [];
      const j = await v5Fetch('/orders', { method: 'POST', body: JSON.stringify({
        idCabang: P.idCabang, catatan: P.catatan, nomorOrder: P.nomorOrder,
        items: items.map((it: any) => ({ kode: it.kode, qty: it.qty, satuan: it.satuan, harga: it.harga })),
      })});
      if (j.error) return { status: 'error', message: j.error };
      return { status: 'ok', message: 'Order berhasil dikirim!', orderId: j.orderId };
    }

    case 'updateStatus': {
      const j = await v5Fetch('/orders/' + encodeURIComponent(String(P.orderId)) + '/status', {
        method: 'PATCH', body: JSON.stringify({ status: P.status, alasan: P.alasan || '' }),
      });
      if (j.error) return { status: 'error', message: j.error };
      return { status: 'ok', message: 'Status berhasil diupdate ke ' + P.status };
    }

    case 'editOrder': {
      const items = Array.isArray(P.items) ? P.items : [];
      const j = await v5Fetch('/orders/' + encodeURIComponent(String(P.orderId)) + '/edit', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map((it: any) => ({
            kode: it.kode, qty: it.qty, satuan: it.satuan, harga: it.harga,
            itemStatus: it.itemStatus || it.status || 'APPROVED',
            originalQty: it.originalQty, reason: it.reason,
            nama: it.nama, kategori: it.kategori, catatanItem: it.catatanItem,
          })),
          kirimEmail: !!P.kirimEmail,
        }),
      });
      if (j.error) return { status: 'error', message: j.error };
      return { status: 'ok', message: 'Perubahan disimpan.' };
    }

    case 'pickerVerify': {
      const j = await v5Fetch('/orders/' + encodeURIComponent(String(P.orderId)) + '/pick', { method: 'POST' });
      if (j.error) return { status: 'error', message: j.error };
      return { status: 'ok', message: 'Order diverifikasi oleh Picker.' };
    }

    case 'syncCart':
      await v5Fetch('/cart/sync', { method: 'POST', body: JSON.stringify({ cart: P.cart }) });
      return { status: 'ok', message: 'Cart disimpan.' };

    case 'getCart': {
      const j = await v5Fetch('/cart');
      return { status: 'ok', cart: typeof j.cart === 'string' ? j.cart : JSON.stringify(j.cart || '{}') };
    }

    case 'changePassword': {
      const j = await v5Fetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ passwordLama: P.passwordLama, passwordBaru: P.passwordBaru }),
      });
      if (j.error) return { status: 'error', message: j.error };
      return { status: 'ok', message: 'Password berhasil diubah.' };
    }

    case 'submitFeedback': {
      await v5Fetch('/feedback', { method: 'POST', body: JSON.stringify({ rating: P.rating, pesan: P.pesan || '' }) });
      return { status: 'ok', message: 'Terima kasih atas masukan Anda.' };
    }

    default:
      return { status: 'error', message: 'Action tidak dikenal: ' + action };
  }
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

// Retry wrapper di atas executeAction (REST v5)
async function executeWithRetry(
  action: string,
  payload: Record<string, unknown>,
  _timeout: number,
  maxRetries: number,
): Promise<ApiResult> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeAction(action, payload);
      if (result && result.status) return result;
    } catch (error) {
      lastError = error as Error;
      const msg = lastError.message || '';
      // AUTH_REQUIRED jangan di-retry — langsuk lempar agar handler logout jalan
      if (msg === 'AUTH_REQUIRED') break;
      console.warn('[API]', action, 'attempt', attempt, 'failed:', msg);
    }
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, Math.min(1000 * Math.pow(2, attempt - 1), 3000)));
    }
  }
  return { status: 'error', message: lastError ? lastError.message : 'Gagal terhubung ke server.' };
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
    return callApi('login', data, { dedupe: false, cache: false, timeout: 45000, maxRetries: 2 });
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
