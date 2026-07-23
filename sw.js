/* ═══════════════════════════════════════════════════════════════════════
   SERVICE WORKER — GudangHub v3.0
   Offline support + smart caching + update notification
   ═══════════════════════════════════════════════════════════════════════ */

const APP_VERSION = 'v3.0.0';
const CACHE_PREFIX = 'gudanghub';
const STATIC_CACHE = `${CACHE_PREFIX}-static-${APP_VERSION}`;
const DYNAMIC_CACHE = `${CACHE_PREFIX}-dynamic-${APP_VERSION}`;
const API_CACHE = `${CACHE_PREFIX}-api-${APP_VERSION}`;

// Files yang di-precache saat install (shell aplikasi)
const PRECACHE_URLS = [
  './',
  './index.html',
  './login.html',
  './dashboard.html',
  './order.html',
  './ganti-password.html',
  './laporan.html',
  './profil.html',
  './notifikasi.html',
  './settings.html',
  './manifest.json',
  './public/icons/icon-192.png',
  './public/icons/icon-512.png',
];

// Domain API (untuk network-first strategy)
const API_DOMAINS = [
  'script.google.com',
  'script.googleusercontent.com',
];

// Domain fonts (cache-first, jarang berubah)
const FONT_DOMAINS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ─────────────────────────────────────────────────────────────────────────
// INSTALL — Precache shell aplikasi
// ─────────────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  console.log('[SW] Installing version:', APP_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching app shell...');
        // Cache satu-satu (skip yang gagal, biar ga block install)
        return Promise.allSettled(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('[SW] Failed to cache:', url, err.message);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Precache complete');
        // Aktifkan SW baru langsung, tanpa nunggu reload
        return self.skipWaiting();
      })
  );
});

// ─────────────────────────────────────────────────────────────────────────
// ACTIVATE — Cleanup cache lama
// ─────────────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating version:', APP_VERSION);

  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name.startsWith(CACHE_PREFIX))
            .filter((name) =>
              ![STATIC_CACHE, DYNAMIC_CACHE, API_CACHE].includes(name)
            )
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        )
      ),

      // Take control of all clients (tabs) langsung
      self.clients.claim(),
    ]).then(() => {
      console.log('[SW] Activated successfully');

      // Kirim message ke semua client bahwa SW baru aktif
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SW_ACTIVATED',
            version: APP_VERSION,
          });
        });
      });
    })
  );
});

// ─────────────────────────────────────────────────────────────────────────
// FETCH — Smart caching strategies
// ─────────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome extensions & chrome://
  if (url.protocol === 'chrome-extension:' || url.protocol === 'chrome:') return;

  // Skip cross-origin selain fonts & API
  const isApi = API_DOMAINS.some((d) => url.hostname.includes(d));
  const isFont = FONT_DOMAINS.some((d) => url.hostname.includes(d));
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin && !isApi && !isFont) return;

  // ─── STRATEGY 1: API — Network First (fresh data prioritized) ───
  if (isApi) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // ─── STRATEGY 2: Fonts — Cache First (jarang berubah) ───
  if (isFont) {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
    return;
  }

  // ─── STRATEGY 3: HTML pages — Network First (fresh content) ───
  if (request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // ─── STRATEGY 4: Assets (CSS, JS, images) — Cache First with revalidation ───
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE));
});

// ─────────────────────────────────────────────────────────────────────────
// CACHING STRATEGIES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Network First — coba network dulu, fallback ke cache
 * Cocok untuk: API, HTML pages
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    // Try network with 8 second timeout
    const networkResponse = await fetchWithTimeout(request, 8000);

    // Cache the response (kalau valid)
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone()).catch(() => {});
    }

    return networkResponse;
  } catch (error) {
    // Network gagal → fallback ke cache
    console.log('[SW] Network failed, using cache:', request.url);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Cache juga tidak ada → fallback ke offline page
    if (request.destination === 'document') {
      return caches.match('./index.html');
    }

    // Return offline error response
    return new Response(
      JSON.stringify({
        status: 'error',
        offline: true,
        message: 'Anda sedang offline. Cek koneksi internet Anda.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Cache First — coba cache dulu, fallback ke network
 * Cocok untuk: fonts, static images
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone()).catch(() => {});
    }

    return networkResponse;
  } catch (error) {
    console.warn('[SW] Failed to fetch:', request.url);
    return new Response('', { status: 503 });
  }
}

/**
 * Stale While Revalidate — return cache immediately, update in background
 * Cocok untuk: CSS, JS, images (yang bisa berubah tapi cache OK)
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Fetch in background (untuk update cache)
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.ok) {
        cache.put(request, networkResponse.clone()).catch(() => {});
      }
      return networkResponse;
    })
    .catch(() => cachedResponse);

  // Return cached kalau ada, else wait network
  return cachedResponse || fetchPromise;
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function fetchWithTimeout(request, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout'));
    }, timeout);

    fetch(request)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// MESSAGES — Handle commands from client
// ─────────────────────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (!event.data) return;

  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      // Client suruh SW baru langsung aktif
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      // Client minta hapus semua cache
      event.waitUntil(clearAllCaches());
      break;

    case 'GET_VERSION':
      // Client minta versi SW
      event.ports[0]?.postMessage({ version: APP_VERSION });
      break;
  }
});

async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name.startsWith(CACHE_PREFIX))
      .map((name) => caches.delete(name))
  );
  console.log('[SW] All caches cleared');
}

// ─────────────────────────────────────────────────────────────────────────
// PUSH NOTIFICATION (untuk masa depan)
// ─────────────────────────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'GudangHub', body: event.data.text() };
  }

  const title = data.title || 'GudangHub';
  const options = {
    body: data.body || 'Anda mendapat notifikasi baru',
    icon: './public/icons/icon-192.png',
    badge: './public/icons/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'gudanghub-push',
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Buka' },
      { action: 'close', title: 'Tutup' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = event.notification.data?.url || './notifikasi.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Cek apakah ada tab yang sudah terbuka
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // Kalau tidak ada, buka baru
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

console.log('[SW] GudangHub Service Worker loaded:', APP_VERSION);
