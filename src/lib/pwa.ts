import { toast } from 'sonner';

const INSTALL_DISMISSED_KEY = 'gudanghub_install_dismissed';
const INSTALL_PROMPT_DELAY = 30000;
const INSTALL_DISMISS_DAYS = 7;

const state: {
  deferredPrompt: Event | null;
  installBannerShown: boolean;
} = {
  deferredPrompt: null,
  installBannerShown: false,
};

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches;
}

function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage penuh */
  }
}

function storageRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage penuh */
  }
}

function injectAnimStyle(id: string, css: string) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

const slideDownAnim = `
  @keyframes pwaSlideDown {
    from { opacity: 0; transform: translate(-50%, -20px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes pwaSlideUp {
    from { opacity: 1; transform: translate(-50%, 0); }
    to { opacity: 0; transform: translate(-50%, -20px); }
  }
`;

function hideBanner(id: string) {
  const banner = document.getElementById(id);
  if (!banner) return;
  banner.style.animation = 'pwaSlideUp 0.3s ease';
  setTimeout(() => banner.remove(), 300);
}

function showUpdateNotification(newWorker: ServiceWorker) {
  if (document.getElementById('pwaUpdateBanner')) return;
  injectAnimStyle('pwaAnimStyle', slideDownAnim);

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
    font-size: 13px;
    font-weight: 600;
    animation: pwaSlideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  banner.innerHTML = `
    <span style="font-size: 20px;">&#x1F504;</span>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 800; margin-bottom: 2px;">Update tersedia!</div>
      <div style="font-size: 11px; opacity: 0.9;">Klik untuk pakai versi terbaru</div>
    </div>
    <button id="pwaUpdateBtn" style="
      background: #fff; color: #e05a00; border: 0; padding: 8px 14px;
      border-radius: 8px; font-weight: 800; font-size: 12px; cursor: pointer;
      min-height: 36px; white-space: nowrap;
    ">Update</button>
    <button id="pwaUpdateClose" aria-label="Tutup" style="
      background: rgba(255,255,255,0.2); color: #fff; border: 0;
      width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
      font-size: 16px; display: grid; place-items: center;
    ">&#x2715;</button>
  `;

  document.body.appendChild(banner);

  document.getElementById('pwaUpdateBtn')?.addEventListener('click', () => {
    hideBanner('pwaUpdateBanner');
    newWorker.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  });

  document.getElementById('pwaUpdateClose')?.addEventListener('click', () => {
    hideBanner('pwaUpdateBanner');
  });

  setTimeout(() => hideBanner('pwaUpdateBanner'), 15000);
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateNotification(newWorker);
            }
          });
        });
        setInterval(() => {
          registration.update().catch(() => {});
        }, 60 * 60 * 1000);
      })
      .catch(() => {
        /* SW gagal register — aplikasi tetap berjalan */
      });
  });
}

function showInstallBanner() {
  if (state.installBannerShown || !state.deferredPrompt) return;
  state.installBannerShown = true;

  injectAnimStyle(
    'pwaInstallAnim',
    `
      @keyframes pwaSlideUpBanner {
        from { opacity: 0; transform: translate(-50%, 40px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      @keyframes pwaSlideDownBanner {
        from { opacity: 1; transform: translate(-50%, 0); }
        to { opacity: 0; transform: translate(-50%, 40px); }
      }
    `,
  );

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
    animation: pwaSlideUpBanner 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  `;

  banner.innerHTML = `
    <div style="
      width: 48px; height: 48px; border-radius: 12px;
      background: linear-gradient(135deg, #ff6b00, #ff8c38);
      display: grid; place-items: center; font-size: 24px;
      flex-shrink: 0; box-shadow: 0 6px 18px rgba(255, 107, 0, 0.4);
    ">&#x1F4F1;</div>
    <div style="flex: 1; min-width: 0;">
      <div style="font-weight: 800; font-size: 14px; margin-bottom: 2px;">Install GudangHub</div>
      <div style="font-size: 12px; color: #94a3b8; line-height: 1.4;">
        Akses lebih cepat, offline support, dan notifikasi.
      </div>
    </div>
    <button id="pwaInstallBtn" style="
      background: linear-gradient(135deg, #ff6b00, #ff8c38);
      color: #fff; border: 0; padding: 10px 16px; border-radius: 10px;
      font-weight: 800; font-size: 13px; cursor: pointer;
      min-height: 40px; white-space: nowrap;
      box-shadow: 0 4px 12px rgba(255, 107, 0, 0.4);
    ">Install</button>
    <button id="pwaInstallClose" aria-label="Tutup" style="
      background: rgba(255,255,255,0.06); color: #94a3b8; border: 0;
      width: 32px; height: 32px; border-radius: 8px; cursor: pointer;
      font-size: 15px; display: grid; place-items: center;
    ">&#x2715;</button>
  `;

  document.body.appendChild(banner);

  document.getElementById('pwaInstallBtn')?.addEventListener('click', async () => {
    const promptEvent = state.deferredPrompt as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: string }>;
    };
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        toast.success('Menginstal...');
      } else {
        storageSet(INSTALL_DISMISSED_KEY, String(Date.now()));
      }
      state.deferredPrompt = null;
      hideInstallBanner();
    } catch {
      hideInstallBanner();
    }
  });

  document.getElementById('pwaInstallClose')?.addEventListener('click', () => {
    storageSet(INSTALL_DISMISSED_KEY, String(Date.now()));
    hideInstallBanner();
  });
}

function hideInstallBanner() {
  const banner = document.getElementById('pwaInstallBanner');
  if (!banner) return;
  banner.style.animation = 'pwaSlideDownBanner 0.3s ease';
  setTimeout(() => banner.remove(), 300);
}

export function initInstallPrompt() {
  if (isStandalone()) return;

  const dismissed = storageGet(INSTALL_DISMISSED_KEY);
  if (dismissed && Date.now() - Number(dismissed) < INSTALL_DISMISS_DAYS * 86400000) {
    return;
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.deferredPrompt = e;
    setTimeout(() => {
      if (state.deferredPrompt && !state.installBannerShown) {
        showInstallBanner();
      }
    }, INSTALL_PROMPT_DELAY);
  });

  window.addEventListener('appinstalled', () => {
    state.deferredPrompt = null;
    hideInstallBanner();
    toast.success('GudangHub terinstall! Buka dari home screen.');
    storageRemove(INSTALL_DISMISSED_KEY);
  });
}

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
      font-size: 12px;
      font-weight: 700;
      animation: pwaSlideDown 0.3s ease;
    `;
    banner.innerHTML = `
      <span>&#x1F4E1;</span>
      <span>Anda sedang offline</span>
    `;
    document.body.appendChild(banner);
  };

  const showOnlineBanner = () => {
    document.getElementById('pwaOfflineBanner')?.remove();

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
      font-size: 12px;
      font-weight: 700;
      animation: pwaSlideDown 0.3s ease;
    `;
    banner.innerHTML = `
      <span>&#x2705;</span>
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
      showOnlineBanner();
    }
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    showOfflineBanner();
  });

  if (!navigator.onLine) {
    showOfflineBanner();
  }
}