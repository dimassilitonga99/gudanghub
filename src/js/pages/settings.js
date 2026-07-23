/* ═══════════════════════════════════════════════════════════════════════
   SETTINGS PAGE — with Lucide Icons
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, getInitials, storage, isStandalone } from '../utils.js';
import { requireAuth } from '../session.js';
import { CABANG, SESSION } from '../config.js';
import { toast, confirm } from '../ui.js';
import { icon, injectIcons } from '../icons.js';

const PREFS_KEY = 'gudanghub_prefs';

const DEFAULT_PREFS = {
  darkMode: true,
  browserNotif: false,
  soundNotif: false,
  autoRefresh: true,
};

const state = {
  session: null,
  prefs: { ...DEFAULT_PREFS },
};

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

function init() {
  state.session = requireAuth();
  if (!state.session) return;

  // Inject icons dulu
  injectIcons();

  loadPrefs();

  const backLink = $('btnBack');
  if (backLink) {
    if (state.session.role === 'admin') {
      backLink.href = './dashboard.html';
    } else {
      backLink.href = `./order.html?cabang=${state.session.idCabang || ''}`;
    }
  }

  renderPrefs();
  renderCabangList();
  renderSystemInfo();

  if (state.session.role === 'admin') {
    renderUserList();
  }

  bindEvents();
}

// ─────────────────────────────────────────────────────────────────────────
// PREFERENCES
// ─────────────────────────────────────────────────────────────────────────

function loadPrefs() {
  const stored = storage.get(PREFS_KEY, {});
  state.prefs = { ...DEFAULT_PREFS, ...stored };
}

function savePrefs() {
  storage.set(PREFS_KEY, state.prefs);
}

function renderPrefs() {
  $('tglDarkMode').checked = state.prefs.darkMode;
  $('tglNotifBrowser').checked = state.prefs.browserNotif;
  $('tglSoundNotif').checked = state.prefs.soundNotif;
  $('tglAutoRefresh').checked = state.prefs.autoRefresh;

  document.documentElement.setAttribute(
    'data-theme',
    state.prefs.darkMode ? 'dark' : 'light'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// USER LIST
// ─────────────────────────────────────────────────────────────────────────

function renderUserList() {
  const section = $('userSection');
  if (!section) return;

  section.style.display = '';

  const users = [
    { username: 'admin', nama: 'Admin Gudang Pusat', role: 'admin', idCabang: '' },
    { username: 'cb001', nama: 'Toko Nasional Eltari – Arfa', role: 'cabang', idCabang: 'CB001' },
    { username: 'cb002', nama: 'Toko Perabot Mama Oesapa – Akmal', role: 'cabang', idCabang: 'CB002' },
    { username: 'cb003', nama: 'Toko Perabot Mama TDM – Shally', role: 'cabang', idCabang: 'CB003' },
    { username: 'cb004', nama: 'Toko Perabot Mama Kefamenanu – Fajar', role: 'cabang', idCabang: 'CB004' },
  ];

  const list = $('usersList');
  if (!list) return;

  list.innerHTML = users.map((user) => `
    <div class="user-row">
      <div class="user-row-avatar">${getInitials(user.nama)}</div>
      <div class="user-row-info">
        <div class="user-row-name">${escapeHtml(user.nama)}</div>
        <div class="user-row-username">@${escapeHtml(user.username)}</div>
        <div class="user-row-tags">
          <span class="user-tag ${user.role}">
            ${icon(user.role === 'admin' ? 'warehouse' : 'store', { size: 10 })}
            ${user.role === 'admin' ? 'Admin' : 'Cabang'}
          </span>
          ${user.idCabang ? `
            <span class="user-tag cabang">
              ${icon('tag', { size: 10 })}
              ${user.idCabang}
            </span>
          ` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────
// CABANG LIST
// ─────────────────────────────────────────────────────────────────────────

function renderCabangList() {
  const container = $('cabangList');
  if (!container) return;

  container.innerHTML = Object.entries(CABANG).map(([id, info]) => `
    <div class="cabang-card">
      <div class="cabang-card-header">
        <div class="cabang-card-icon">
          ${icon('store', { size: 20 })}
        </div>
        <div>
          <div class="cabang-card-title">${escapeHtml(info.nama)}</div>
          <div class="cabang-card-id">${id} · PIC: ${escapeHtml(info.pic)}</div>
        </div>
      </div>
      <div class="cabang-card-info">
        <div class="cabang-card-info-line">
          ${icon('phone', { size: 12 })}
          <b>${escapeHtml(info.telepon || '-')}</b>
        </div>
        <div class="cabang-card-info-line">
          ${icon('map-pin', { size: 12 })}
          ${escapeHtml(info.alamat || '-')}
        </div>
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────
// SYSTEM INFO
// ─────────────────────────────────────────────────────────────────────────

function renderSystemInfo() {
  try {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += ((localStorage[key].length + key.length) * 2);
      }
    }
    const kb = (total / 1024).toFixed(1);
    $('storageUsed').textContent = kb + ' KB';
  } catch {
    $('storageUsed').textContent = 'N/A';
  }

  const isPwa = isStandalone();
  const swSupported = 'serviceWorker' in navigator;
  const pwaStatus = isPwa ? 'Installed'
                  : swSupported ? 'Ready'
                  : 'Not Supported';
  $('pwaStatus').textContent = pwaStatus;
  if (isPwa) $('pwaStatus').style.color = 'var(--success)';

  const ua = navigator.userAgent;
  let browser = 'Unknown';
  if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opera|opr/i.test(ua)) browser = 'Opera';

  $('browserInfo').textContent = browser;
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {
  $('tglDarkMode')?.addEventListener('change', (e) => {
    state.prefs.darkMode = e.target.checked;
    savePrefs();
    document.documentElement.setAttribute('data-theme', e.target.checked ? 'dark' : 'light');
    toast.success(`Mode ${e.target.checked ? 'gelap' : 'terang'} diaktifkan.`);
  });

  $('tglNotifBrowser')?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      if (!('Notification' in window)) {
        toast.error('Browser tidak mendukung notifikasi.');
        e.target.checked = false;
        return;
      }

      try {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          toast.warning('Izin notifikasi ditolak oleh browser.');
          e.target.checked = false;
          state.prefs.browserNotif = false;
        } else {
          state.prefs.browserNotif = true;
          toast.success('Notifikasi browser aktif!');

          new Notification('GudangHub', {
            body: 'Notifikasi berhasil diaktifkan!',
            icon: './public/icons/icon-192.png',
          });
        }
      } catch {
        e.target.checked = false;
        state.prefs.browserNotif = false;
        toast.error('Gagal mengaktifkan notifikasi.');
      }
    } else {
      state.prefs.browserNotif = false;
    }
    savePrefs();
  });

  $('tglSoundNotif')?.addEventListener('change', (e) => {
    state.prefs.soundNotif = e.target.checked;
    savePrefs();
    if (e.target.checked) {
      playTestSound();
      toast.success('Suara notifikasi aktif.');
    }
  });

  $('tglAutoRefresh')?.addEventListener('change', (e) => {
    state.prefs.autoRefresh = e.target.checked;
    savePrefs();
    toast.info(e.target.checked
      ? 'Auto-refresh aktif (setiap 1 menit)'
      : 'Auto-refresh dimatikan'
    );
  });

  $('btnClearCache')?.addEventListener('click', async () => {
    const ok = await confirm({
      icon: '🗑️',
      title: 'Hapus Cache Lokal?',
      message: 'Semua data lokal akan dihapus:\n• Preferensi\n• Riwayat notifikasi\n• Cache API\n\nAnda TIDAK akan logout.',
      okText: 'Ya, Hapus',
      okVariant: 'danger',
    });

    if (!ok) return;

    try {
      const session = sessionStorage.getItem(SESSION.key);
      localStorage.clear();
      sessionStorage.clear();
      if (session) sessionStorage.setItem(SESSION.key, session);

      toast.success('Cache lokal berhasil dihapus.');

      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      toast.error('Gagal menghapus cache.');
    }
  });

  $('btnResetPrefs')?.addEventListener('click', async () => {
    const ok = await confirm({
      icon: '🔄',
      title: 'Reset ke Default?',
      message: 'Semua preferensi akan dikembalikan ke pengaturan default.',
      okText: 'Ya, Reset',
      okVariant: 'primary',
    });

    if (!ok) return;

    state.prefs = { ...DEFAULT_PREFS };
    savePrefs();
    renderPrefs();
    toast.success('Preferensi direset ke default.');
  });
}

// ─────────────────────────────────────────────────────────────────────────
// SOUND
// ─────────────────────────────────────────────────────────────────────────

function playTestSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}