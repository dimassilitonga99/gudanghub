/* ═══════════════════════════════════════════════════════════════════════
   PWA HELPER — Install prompt, update handler, connection status
   ═══════════════════════════════════════════════════════════════════════ */

import { toast } from './ui.js';
import { isStandalone, storage } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

const state = {
  deferredPrompt: null,
  swRegistration: null,
  installBannerShown: false,
  updateAvailable: false,
};

const INSTALL_DISMISSED_KEY = 'gudanghub_install_dismissed';
const INSTALL_PROMPT_DELAY = 30000; // 30 detik setelah load
const INSTALL_DISMISS_DAYS = 7; // Jangan tunjukkan lagi selama 7 hari

// ─────────────────────────────────────────────────────────────────────────
// SERVICE WORKER REGISTRATION
// ─────────────────────────────────────────────────────────────────────────

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: './',
    });

    state.swRegistration = registration;
    console.log('[PWA] Service Worker registered:', registration.scope);

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      console.log('[PWA] New Service Worker found');

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // Ada versi baru yang siap
          state.updateAvailable = true;
          showUpdateNotification(newWorker);
        }
      });
    });

    // Cek update setiap 60 menit
    setInterval(() => {
      registration.update().catch(() => {});
    }, 60 * 60 * 1000);

    return registration;

  } catch (error) {
    console.warn('[PWA] Service Worker registration failed:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE NOTIFICATION
// ─────────────────────────────────────────────────────────────────────────

function showUpdateNotification(newWorker) {
  // Buat banner update
  const banner = document.createElement('div');
  banner.id = 'pwaUpdateBanner';
  banner.setAttribute('role', 'alert');
  banner.style.cssText = `
    position: fixed;
    top: max(16px, env(safe-area-inset-top, 16px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;
    background: linear-gradient(135deg, #ff6b00, #ff8c38);
    color: #fff;
    padding: 14px 20px;
    border-radius: 14px;
    box-shadow: 0 12px 40px rgba(255, 107, 0, 0.5);
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: calc(100% - 32px);
    width: 400px;
    font-family: 'Manrope', sans-serif;
    font-size: 13px;
    font-weight: 600;
    animation: pwaSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  banner.innerHTML = `
    <span style="font-size: 20px;">🔄</span>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 800; margin-bottom: 2px;">Update tersedia!</div>
      <div style="font-size: 11px; opacity: 0.9;">Klik untuk pakai versi terbaru</div>
    </div>
    <button id="pwaUpdateBtn" style="
      background: #fff;
      color: #e05a00;
      border: 0;
      padding: 8px 14px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
      font-family: inherit;
      min-height: 36px;
      white-space: nowrap;
    ">
      Update
    </button>
    <button id="pwaUpdateClose" aria-label="Tutup" style="
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
      border: 0;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      display: grid;
      place-items: center;
      font-family: inherit;
    ">
      ✕
    </button>
  `;

  // Inject animation style
  if (!document.getElementById('pwaAnimStyle')) {
    const style = document.createElement('style');
    style.id = 'pwaAnimStyle';
    style.textContent = `
      @keyframes pwaSlideDown {
        from { opacity: 0; transform: translate(-50%, -20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      @keyframes pwaSlideUp {
        from { opacity: 1; transform: translate(-50%, 0); }
        to { opacity: 0; transform: translate(-50%, -20px); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(banner);

  // Update button
  document.getElementById('pwaUpdateBtn').addEventListener('click', () => {
    banner.style.animation = 'pwaSlideUp 0.3s ease';
    setTimeout(() => banner.remove(), 300);

    // Kirim message ke SW untuk skip waiting
    newWorker.postMessage({ type: 'SKIP_WAITING' });

    // Reload setelah SW aktif
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });

  // Close button
  document.getElementById('pwaUpdateClose').addEventListener('click', () => {
    banner.style.animation = 'pwaSlideUp 0.3s ease';
    setTimeout(() => banner.remove(), 300);
  });

  // Auto-hide setelah 15 detik
  setTimeout(() => {
    if (document.body.contains(banner)) {
      banner.style.animation = 'pwaSlideUp 0.3s ease';
      setTimeout(() => banner.remove(), 300);
    }
  }, 15000);
}

// ─────────────────────────────────────────────────────────────────────────
// INSTALL PROMPT
// ─────────────────────────────────────────────────────────────────────────

export function initInstallPrompt() {
  // Skip kalau sudah installed
  if (isStandalone()) {
    console.log('[PWA] App is already installed');
    return;
  }

  // Skip kalau user recently dismissed
  const dismissed = storage.get(INSTALL_DISMISSED_KEY);
  if (dismissed && Date.now() - dismissed < INSTALL_DISMISS_DAYS * 86400000) {
    return;
  }

  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    console.log('[PWA] Install prompt captured');

    // Show install banner setelah delay
    setTimeout(() => {
      if (state.deferredPrompt && !state.installBannerShown) {
        showInstallBanner();
      }
    }, INSTALL_PROMPT_DELAY);
  });

  // Listen for successful install
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed!');
    state.deferredPrompt = null;
    hideInstallBanner();
    toast.success('🎉 GudangHub terinstall! Buka dari home screen.');

    // Clear dismissed flag
    storage.remove(INSTALL_DISMISSED_KEY);
  });
}

function showInstallBanner() {
  if (state.installBannerShown) return;
  if (!state.deferredPrompt) return;

  state.installBannerShown = true;

  const banner = document.createElement('div');
  banner.id = 'pwaInstallBanner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Install GudangHub');
  banner.style.cssText = `
    position: fixed;
    bottom: max(16px, env(safe-area-inset-bottom, 16px));
    left: 50%;
    transform: translateX(-50%);
    z-index: 9998;
    background: #1e1e3a;
    border: 1px solid rgba(255, 107, 0, 0.4);
    color: #e2e8f0;
    padding: 16px;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    gap: 14px;
    max-width: calc(100% - 32px);
    width: 420px;
    font-family: 'Manrope', sans-serif;
    animation: pwaSlideUpBanner 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  banner.innerHTML = `
    <div style="
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #ff6b00, #ff8c38);
      display: grid;
      place-items: center;
      font-size: 24px;
      flex-shrink: 0;
      box-shadow: 0 6px 18px rgba(255, 107, 0, 0.4);
    ">📱</div>

    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 800; font-size: 14px; margin-bottom: 2px;">
        Install GudangHub
      </div>
      <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
        Akses lebih cepat, offline support, dan notifikasi.
      </div>
    </div>

    <button id="pwaInstallBtn" style="
      background: linear-gradient(135deg, #ff6b00, #ff8c38);
      color: #fff;
      border: 0;
      padding: 10px 16px;
      border-radius: 10px;
      font-weight: 800;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
      min-height: 40px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(255, 107, 0, 0.4);
    ">
      Install
    </button>

    <button id="pwaInstallClose" aria-label="Tutup" style="
      background: rgba(255, 255, 255, 0.06);
      color: #94a3b8;
      border: 0;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 15px;
      display: grid;
      place-items: center;
      font-family: inherit;
      flex-shrink: 0;
    ">
      ✕
    </button>
  `;

  // Inject animation
  if (!document.getElementById('pwaInstallAnim')) {
    const style = document.createElement('style');
    style.id = 'pwaInstallAnim';
    style.textContent = `
      @keyframes pwaSlideUpBanner {
        from { opacity: 0; transform: translate(-50%, 40px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      @keyframes pwaSlideDownBanner {
        from { opacity: 1; transform: translate(-50%, 0); }
        to { opacity: 0; transform: translate(-50%, 40px); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(banner);

  // Install button click
  document.getElementById('pwaInstallBtn').addEventListener('click', async () => {
    if (!state.deferredPrompt) return;

    try {
      state.deferredPrompt.prompt();
      const { outcome } = await state.deferredPrompt.userChoice;

      console.log('[PWA] Install prompt result:', outcome);

      if (outcome === 'accepted') {
        toast.success('✅ Installing...');
      } else {
        // User dismissed
        storage.set(INSTALL_DISMISSED_KEY, Date.now());
      }

      state.deferredPrompt = null;
      hideInstallBanner();
    } catch (error) {
      console.error('[PWA] Install error:', error);
      hideInstallBanner();
    }
  });

  // Close button
  document.getElementById('pwaInstallClose').addEventListener('click', () => {
    storage.set(INSTALL_DISMISSED_KEY, Date.now());
    hideInstallBanner();
  });
}

function hideInstallBanner() {
  const banner = document.getElementById('pwaInstallBanner');
  if (!banner) return;

  banner.style.animation = 'pwaSlideDownBanner 0.3s ease';
  setTimeout(() => banner.remove(), 300);
}

// ─────────────────────────────────────────────────────────────────────────
// CONNECTION STATUS (Online/Offline detection)
// ─────────────────────────────────────────────────────────────────────────

export function initConnectionStatus() {
  let isOnline = navigator.onLine;

  const showOfflineBanner = () => {
    if (document.getElementById('pwaOfflineBanner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwaOfflineBanner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = `
      position: fixed;
      top: max(16px, env(safe-area-inset-top, 16px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      background: #ef4444;
      color: #fff;
      padding: 10px 18px;
      border-radius: 20px;
      box-shadow: 0 8px 24px rgba(239, 68, 68, 0.5);
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Manrope', sans-serif;
      font-size: 12px;
      font-weight: 700;
      animation: pwaSlideDown 0.3s ease;
    `;

    banner.innerHTML = `
      <span>📡</span>
      <span>Anda sedang offline</span>
    `;

    document.body.appendChild(banner);
  };

  const showOnlineBanner = () => {
    // Hapus offline banner
    document.getElementById('pwaOfflineBanner')?.remove();

    // Show online banner sebentar
    const banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.style.cssText = `
      position: fixed;
      top: max(16px, env(safe-area-inset-top, 16px));
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      background: #22c55e;
      color: #fff;
      padding: 10px 18px;
      border-radius: 20px;
      box-shadow: 0 8px 24px rgba(34, 197, 94, 0.5);
      display: flex;
      align-items: center;
      gap: 8px;
      font-family: 'Manrope', sans-serif;
      font-size: 12px;
      font-weight: 700;
      animation: pwaSlideDown 0.3s ease;
    `;

    banner.innerHTML = `
      <span>✅</span>
      <span>Kembali online!</span>
    `;

    document.body.appendChild(banner);

    setTimeout(() => {
      banner.style.animation = 'pwaSlideUp 0.3s ease';
      setTimeout(() => banner.remove(), 300);
    }, 3000);
  };

  window.addEventListener('online', () => {
    if (!isOnline) {
      isOnline = true;
      console.log('[PWA] Back online');
      showOnlineBanner();
    }
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    console.log('[PWA] Went offline');
    showOfflineBanner();
  });

  // Cek status awal
  if (!navigator.onLine) {
    showOfflineBanner();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SW MESSAGE HANDLER
// ─────────────────────────────────────────────────────────────────────────

export function initServiceWorkerListener() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, version } = event.data || {};

    if (type === 'SW_ACTIVATED') {
      console.log('[PWA] Service Worker activated:', version);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// CLEAR CACHE (public API)
// ─────────────────────────────────────────────────────────────────────────

export async function clearServiceWorkerCache() {
  if (!state.swRegistration || !state.swRegistration.active) {
    return false;
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve(true);

    state.swRegistration.active.postMessage(
      { type: 'CLEAR_CACHE' },
      [channel.port2]
    );

    setTimeout(() => resolve(false), 3000);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// INIT ALL
// ─────────────────────────────────────────────────────────────────────────

export function initPwa() {
  registerServiceWorker();
  initInstallPrompt();
  initConnectionStatus();
  initServiceWorkerListener();
}

// Auto-init kalau dipanggil langsung
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPwa);
  } else {
    initPwa();
  }
}
