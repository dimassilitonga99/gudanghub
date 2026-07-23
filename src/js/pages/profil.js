/* ═══════════════════════════════════════════════════════════════════════
   PROFIL PAGE — with Lucide Icons
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, formatTimeAgo, getInitials, parseAnyDate, sortBy } from '../utils.js';
import { orders as ordersApi } from '../api.js';
import { requireAuth, getSessionRemainingMinutes, logout } from '../session.js';
import { CABANG } from '../config.js';
import { toast, confirm } from '../ui.js';
import { icon, injectIcons } from '../icons.js';

const state = {
  session: null,
};

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {
  state.session = requireAuth();
  if (!state.session) return;

  // Inject icons dulu
  injectIcons();

  renderProfile();
  renderInfo();
  renderSessionInfo();
  updateSessionRemaining();
  bindEvents();

  await loadActivity();

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

  const roleIcon = s.role === 'admin' ? 'warehouse' : 'store';
  const roleLabel = s.role === 'admin'
    ? 'Admin Gudang Pusat'
    : `Cabang ${s.idCabang || ''}`;

  $('profileRole').innerHTML = `
    ${icon(roleIcon, { size: 12 })}
    ${roleLabel}
  `;

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

  if (s.loginAt) {
    $('infoLoginAt').textContent = formatWita(s.loginAt);
    $('infoLoginAgo').textContent = formatTimeAgo(s.loginAt);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SESSION INFO
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
    $('sessionRemaining').textContent = 'Expired';
    $('sessionRemaining').style.color = 'var(--danger)';
    setTimeout(() => logout(true), 1000);
    return;
  }

  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;

  let text = '';
  if (hours > 0) text += `${hours}j `;
  text += `${minutes}m`;

  $('sessionRemaining').textContent = text;

  if (remaining < 30) {
    $('sessionRemaining').style.color = 'var(--warning)';
  } else {
    $('sessionRemaining').style.color = 'var(--success)';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ACTIVITY
// ─────────────────────────────────────────────────────────────────────────

async function loadActivity() {
  const list = $('activityList');
  if (!list) return;

  list.innerHTML = `
    <div class="empty-state">
      <div class="loading-spinner" style="width: 32px; height: 32px; border: 3px solid var(--line-soft); border-top-color: var(--orange); border-radius: 50%; animation: spin 0.7s linear infinite; margin: 0 auto 12px;"></div>
      <p>Memuat aktivitas...</p>
    </div>
  `;

  try {
    const result = await ordersApi.getAll({ cache: true });
    if (result.status !== 'ok') {
      throw new Error(result.message);
    }

    const allOrders = result.data || [];
    const s = state.session;

    const relevantOrders = s.role === 'admin'
      ? allOrders
      : allOrders.filter((o) => String(o.ID_CABANG).toUpperCase() === s.idCabang);

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
        <div class="empty-icon">${icon('alert-triangle', { size: 40, color: 'var(--danger)' })}</div>
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
        <div class="empty-icon">${icon('activity', { size: 40, color: 'var(--muted)' })}</div>
        <p>Belum ada aktivitas.</p>
      </div>
    `;
    if (countEl) countEl.textContent = '0 aktivitas';
    return;
  }

  if (countEl) countEl.textContent = `${activities.length} aktivitas`;

  const statusInfo = {
    PENDING: { iconName: 'clock', color: 'orange', label: 'menunggu persetujuan' },
    APPROVED: { iconName: 'check-circle', color: 'green', label: 'disetujui' },
    REJECTED: { iconName: 'x-circle', color: 'red', label: 'ditolak' },
  };

  list.innerHTML = activities.map((order) => {
    const status = String(order.STATUS || 'PENDING').toUpperCase();
    const info = statusInfo[status] || statusInfo.PENDING;
    const branch = CABANG[order.ID_CABANG];
    const branchName = branch ? branch.pic : order.ID_CABANG;

    return `
      <div class="activity-item">
        <div class="activity-icon ${info.color}">
          ${icon(info.iconName, { size: 18 })}
        </div>
        <div class="activity-content">
          <div class="activity-desc">
            Order <strong>${escapeHtml(order.ORDER_ID)}</strong>
            dari <b>${escapeHtml(branchName)}</b>
            ${info.label}
          </div>
          <div class="activity-time">
            ${icon('clock', { size: 12 })}
            ${escapeHtml(formatTimeAgo(order.TANGGAL_ORDER))}
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