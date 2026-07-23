/* ═══════════════════════════════════════════════════════════════════════
   PROFIL PAGE — User profile + activity log
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, formatTimeAgo, getInitials, parseAnyDate, sortBy } from '../utils.js';
import { orders as ordersApi } from '../api.js';
import { requireAuth, getSessionRemainingMinutes, logout } from '../session.js';
import { CABANG, getHomeRoute } from '../config.js';
import { toast, confirm } from '../ui.js';

const state = {
  session: null,
};

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {
  state.session = requireAuth();
  if (!state.session) return;

  renderProfile();
  renderInfo();
  renderSessionInfo();
  updateSessionRemaining();
  bindEvents();

  // Load activity
  await loadActivity();

  // Update session remaining tiap menit
  setInterval(updateSessionRemaining, 60000);
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER PROFILE
// ─────────────────────────────────────────────────────────────────────────

function renderProfile() {
  const s = state.session;

  $('profileAvatar').textContent = getInitials(s.nama || s.username);
  $('profileName').textContent = s.nama || s.username || '-';
  $('profileUsername').textContent = '@' + (s.username || '-');

  const roleLabel = s.role === 'admin'
    ? '🏪 Admin Gudang Pusat'
    : `🏬 Cabang ${s.idCabang || ''}`;
  $('profileRole').textContent = roleLabel;

  // Back link + home link
  const backLink = $('btnBack');
  const homeLink = $('btnMainHome');
  const targetHome = s.role === 'admin'
    ? './dashboard.html'
    : `./order.html?cabang=${s.idCabang || ''}`;

  if (backLink) backLink.href = targetHome;
  if (homeLink) homeLink.href = targetHome;
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER INFO
// ─────────────────────────────────────────────────────────────────────────

function renderInfo() {
  const s = state.session;

  if (s.role === 'admin') {
    $('infoCabang').textContent = 'Gudang Pusat';
    $('infoCabangSub').textContent = 'Admin — Semua Cabang';
    $('infoKontak').textContent = 'silitongadimas@gmail.com';
    $('infoAlamat').textContent = 'PT Central Perabot Utama, NTT';
  } else {
    const cabang = CABANG[s.idCabang];
    if (cabang) {
      $('infoCabang').textContent = cabang.nama;
      $('infoCabangSub').textContent = `${cabang.id} · PIC ${cabang.pic}`;
      $('infoKontak').textContent = cabang.telepon || '-';
      $('infoAlamat').textContent = cabang.alamat || '-';
    } else {
      $('infoCabang').textContent = s.idCabang || '-';
      $('infoCabangSub').textContent = 'Detail tidak tersedia';
    }
  }

  // Login info
  if (s.loginAt) {
    $('infoLoginAt').textContent = formatWita(s.loginAt);
    $('infoLoginAgo').textContent = formatTimeAgo(s.loginAt);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER SESSION INFO
// ─────────────────────────────────────────────────────────────────────────

function renderSessionInfo() {
  const s = state.session;

  $('sessionToken').textContent = s.token
    ? (s.token.substring(0, 8) + '...' + s.token.substring(s.token.length - 4))
    : 'N/A';

  if (s.expires) {
    $('sessionExpires').textContent = formatWita(s.expires);
  }
}

function updateSessionRemaining() {
  const remaining = getSessionRemainingMinutes();

  if (remaining <= 0) {
    $('sessionRemaining').textContent = '⚠️ Expired';
    $('sessionRemaining').style.color = 'var(--danger)';
    // Force logout kalau expired
    setTimeout(() => logout(true), 1000);
    return;
  }

  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;

  let text = '';
  if (hours > 0) text += `${hours}j `;
  text += `${minutes}m`;

  $('sessionRemaining').textContent = text;

  // Warning kalau < 30 menit
  if (remaining < 30) {
    $('sessionRemaining').style.color = 'var(--warning)';
  } else {
    $('sessionRemaining').style.color = 'var(--success)';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────────────────

async function loadActivity() {
  const list = $('activityList');
  if (!list) return;

  try {
    const result = await ordersApi.getAll({ cache: true });
    if (result.status !== 'ok') {
      throw new Error(result.message);
    }

    const allOrders = result.data || [];
    const s = state.session;

    // Filter: admin lihat semua, cabang hanya orderannya
    const relevantOrders = s.role === 'admin'
      ? allOrders
      : allOrders.filter((o) => String(o.ID_CABANG).toUpperCase() === s.idCabang);

    // Sort desc, ambil 15 terbaru
    const activities = sortBy(
      relevantOrders.map((o) => ({
        ...o,
        _sortKey: parseAnyDate(o.TANGGAL_ORDER).getTime(),
      })),
      '_sortKey',
      'desc'
    ).slice(0, 15);

    renderActivity(activities);

  } catch (error) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Gagal memuat aktivitas.</p>
      </div>
    `;
  }
}

function renderActivity(activities) {
  const list = $('activityList');
  const countEl = $('activityCount');

  if (!list) return;

  if (!activities.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <p>Belum ada aktivitas.</p>
      </div>
    `;
    if (countEl) countEl.textContent = '0 aktivitas';
    return;
  }

  if (countEl) countEl.textContent = `${activities.length} aktivitas`;

  const statusIconMap = {
    PENDING: { icon: '⏳', color: 'orange', label: 'menunggu persetujuan' },
    APPROVED: { icon: '✅', color: 'green', label: 'disetujui' },
    REJECTED: { icon: '❌', color: 'red', label: 'ditolak' },
  };

  list.innerHTML = activities.map((order) => {
    const status = String(order.STATUS || 'PENDING').toUpperCase();
    const info = statusIconMap[status] || statusIconMap.PENDING;
    const branch = CABANG[order.ID_CABANG];
    const branchName = branch ? branch.pic : order.ID_CABANG;

    return `
      <div class="activity-item">
        <div class="activity-icon ${info.color}">${info.icon}</div>
        <div class="activity-content">
          <div class="activity-desc">
            Order <strong>${escapeHtml(order.ORDER_ID)}</strong>
            dari <b>${escapeHtml(branchName)}</b>
            ${info.label}
          </div>
          <div class="activity-time">
            🕐 ${escapeHtml(formatTimeAgo(order.TANGGAL_ORDER))}
            · ${escapeHtml(formatWita(order.TANGGAL_ORDER, false))}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────

async function handleLogout() {
  const ok = await confirm({
    icon: '🚪',
    title: 'Keluar dari GudangHub?',
    message: 'Anda akan diarahkan ke halaman login.',
    okText: 'Ya, Keluar',
    okVariant: 'danger',
  });

  if (ok) {
    logout(true);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {
  $('btnLogout')?.addEventListener('click', handleLogout);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
