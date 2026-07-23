/* ═══════════════════════════════════════════════════════════════════════
   NOTIFIKASI PAGE — with Lucide Icons
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, formatTimeAgo, parseAnyDate, sortBy, storage } from '../utils.js';
import { orders as ordersApi } from '../api.js';
import { requireAuth } from '../session.js';
import { CABANG, SETTINGS } from '../config.js';
import { toast, confirm } from '../ui.js';
import { icon, injectIcons } from '../icons.js';

const READ_KEY = 'gudanghub_notif_read';
const state = {
  session: null,
  orders: [],
  filter: 'all',
  readIds: new Set(),
  pollingInterval: null,
  lastRefreshTime: null,
};

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {
  state.session = requireAuth();
  if (!state.session) return;

  // Inject icons dulu
  injectIcons();

  loadReadIds();

  const backLink = $('btnBack');
  if (backLink) {
    if (state.session.role === 'admin') {
      backLink.href = './dashboard.html';
    } else {
      backLink.href = `./order.html?cabang=${state.session.idCabang || ''}`;
    }
  }

  bindEvents();
  await loadNotifications();
  startPolling();

  document.addEventListener('visibilitychange', handleVisibility);
}

// ─────────────────────────────────────────────────────────────────────────
// READ STATE
// ─────────────────────────────────────────────────────────────────────────

function loadReadIds() {
  const stored = storage.get(READ_KEY, []);
  state.readIds = new Set(Array.isArray(stored) ? stored : []);
}

function saveReadIds() {
  const arr = [...state.readIds].slice(-200);
  storage.set(READ_KEY, arr);
}

function isRead(id) {
  return state.readIds.has(id);
}

function markRead(id) {
  state.readIds.add(id);
  saveReadIds();
}

function markAllRead() {
  state.orders.forEach((o) => state.readIds.add(o.ORDER_ID));
  saveReadIds();
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD DATA
// ─────────────────────────────────────────────────────────────────────────

async function loadNotifications(silent = false) {
  try {
    if (!silent) {
      const list = $('notifList');
      if (!state.orders.length && list) {
        list.innerHTML = `
          <div class="loading-state">
            <div class="loading-spinner"></div>
            <p>Memuat notifikasi...</p>
          </div>
        `;
      }
    }

    const result = await ordersApi.getAll({ cache: false });

    if (result.status !== 'ok') {
      throw new Error(result.message || 'Gagal memuat');
    }

    const allOrders = result.data || [];

    const relevantOrders = state.session.role === 'admin'
      ? allOrders
      : allOrders.filter((o) =>
          String(o.ID_CABANG || '').toUpperCase() === state.session.idCabang
        );

    const sorted = sortBy(
      relevantOrders.map((o) => ({
        ...o,
        _sortKey: parseAnyDate(o.TANGGAL_ORDER).getTime(),
      })),
      '_sortKey',
      'desc'
    );

    if (state.orders.length > 0 && silent) {
      detectNewNotifications(state.orders, sorted);
    }

    state.orders = sorted;
    state.lastRefreshTime = new Date();

    renderChipCounts();
    renderNotifications();
    updateLastRefresh();

  } catch (error) {
    const list = $('notifList');
    if (list && !state.orders.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icon('alert-triangle', { size: 48, color: 'var(--danger)' })}</div>
          <p style="margin-bottom: 12px;">Gagal memuat notifikasi.</p>
          <button class="btn-mark-read" id="btnRetryLoad" type="button">
            ${icon('refresh', { size: 14 })}
            Coba Lagi
          </button>
        </div>
      `;
      $('btnRetryLoad')?.addEventListener('click', () => loadNotifications(false));
    }
  }
}

function detectNewNotifications(oldOrders, newOrders) {
  const oldIds = new Set(oldOrders.map((o) => o.ORDER_ID));

  const newlyAdded = newOrders.filter((o) => !oldIds.has(o.ORDER_ID));

  if (newlyAdded.length > 0) {
    const first = newlyAdded[0];
    const status = String(first.STATUS || 'PENDING').toUpperCase();
    const cabang = CABANG[first.ID_CABANG];
    const branchName = cabang ? cabang.pic : first.ID_CABANG;

    let message = '';
    if (state.session.role === 'admin') {
      if (status === 'PENDING') {
        message = `Order baru dari ${branchName}!`;
      } else {
        message = `Update: ${first.ORDER_ID}`;
      }
    } else {
      if (status === 'APPROVED') {
        message = `Order ${first.ORDER_ID} disetujui!`;
      } else if (status === 'REJECTED') {
        message = `Order ${first.ORDER_ID} ditolak.`;
      }
    }

    if (message) {
      toast({
        message: message + (newlyAdded.length > 1 ? ` (+${newlyAdded.length - 1} lainnya)` : ''),
        type: status === 'APPROVED' ? 'success' :
              status === 'REJECTED' ? 'danger' : 'info',
        duration: 5000,
      });

      sendBrowserNotification(message);
    }
  }
}

function sendBrowserNotification(message) {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    new Notification('GudangHub', {
      body: message,
      icon: './public/icons/icon-192.png',
      badge: './public/icons/icon-192.png',
      tag: 'gudanghub-notif',
    });
  }
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {}
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

function renderChipCounts() {
  const total = state.orders.length;
  const unread = state.orders.filter((o) => !isRead(o.ORDER_ID)).length;
  const pending = state.orders.filter((o) => String(o.STATUS).toUpperCase() === 'PENDING').length;
  const approved = state.orders.filter((o) => String(o.STATUS).toUpperCase() === 'APPROVED').length;
  const rejected = state.orders.filter((o) => String(o.STATUS).toUpperCase() === 'REJECTED').length;

  $('countAll').textContent = total;
  $('countUnread').textContent = unread;
  $('countPending').textContent = pending;
  $('countApproved').textContent = approved;
  $('countRejected').textContent = rejected;

  $('notifTotalCount').textContent = unread;
}

function renderNotifications() {
  const list = $('notifList');
  if (!list) return;

  let filtered = [...state.orders];

  if (state.filter === 'unread') {
    filtered = filtered.filter((o) => !isRead(o.ORDER_ID));
  } else if (state.filter !== 'all') {
    filtered = filtered.filter((o) =>
      String(o.STATUS || '').toUpperCase() === state.filter
    );
  }

  if (!filtered.length) {
    const emptyIcon = state.filter === 'unread' ? 'check-check' : 'bell';
    const emptyMsg = state.filter === 'all' ? 'Belum ada notifikasi'
                   : state.filter === 'unread' ? 'Semua notifikasi sudah dibaca!'
                   : `Tidak ada notifikasi dengan status "${state.filter}"`;

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon(emptyIcon, { size: 56, color: 'var(--muted)' })}</div>
        <p>${emptyMsg}</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(buildNotifItem).join('');

  list.querySelectorAll('.notif-item').forEach((el) => {
    el.addEventListener('click', () => handleNotifClick(el.dataset.id));
  });
}

function buildNotifItem(order) {
  const status = String(order.STATUS || 'PENDING').toUpperCase();
  const branch = CABANG[order.ID_CABANG] || { pic: '-' };
  const unread = !isRead(order.ORDER_ID);

  const iconClass = status === 'PENDING' ? 'pending'
                  : status === 'APPROVED' ? 'approved'
                  : 'rejected';

  const statusIconName = {
    PENDING: 'clock',
    APPROVED: 'check-circle',
    REJECTED: 'x-circle',
  }[status] || 'clock';

  const statusTagClass = status === 'PENDING' ? 'status-pending'
                       : status === 'APPROVED' ? 'status-approved'
                       : 'status-rejected';

  let title, desc, titleIconName;
  if (state.session.role === 'admin') {
    if (status === 'PENDING') {
      titleIconName = 'package';
      title = `Order Baru dari ${escapeHtml(branch.pic)}`;
      desc = `Cabang <strong>${escapeHtml(order.ID_CABANG)}</strong> mengirim order <strong>${escapeHtml(order.ORDER_ID)}</strong> dengan ${(order.DETAIL || []).length} item. Menunggu persetujuan Anda.`;
    } else if (status === 'APPROVED') {
      titleIconName = 'check-circle';
      title = `Order Disetujui`;
      desc = `Order <strong>${escapeHtml(order.ORDER_ID)}</strong> dari ${escapeHtml(branch.pic)} telah Anda setujui.`;
    } else {
      titleIconName = 'x-circle';
      title = `Order Ditolak`;
      desc = `Order <strong>${escapeHtml(order.ORDER_ID)}</strong> dari ${escapeHtml(branch.pic)} ditolak.`;
    }
  } else {
    if (status === 'PENDING') {
      titleIconName = 'clock';
      title = `Order Menunggu Persetujuan`;
      desc = `Order <strong>${escapeHtml(order.ORDER_ID)}</strong> sedang menunggu review dari admin gudang.`;
    } else if (status === 'APPROVED') {
      titleIconName = 'check-circle';
      title = `Order Anda Disetujui!`;
      desc = `Admin gudang telah menyetujui order <strong>${escapeHtml(order.ORDER_ID)}</strong>. Segera cek email untuk detail.`;
    } else {
      titleIconName = 'x-circle';
      title = `Order Anda Ditolak`;
      desc = `Order <strong>${escapeHtml(order.ORDER_ID)}</strong> ditolak. Cek email untuk alasannya.`;
    }
  }

  return `
    <article class="notif-item ${unread ? 'unread' : ''}" data-id="${escapeHtml(order.ORDER_ID)}">
      <div class="notif-icon ${iconClass}">
        ${icon(statusIconName, { size: 22 })}
      </div>
      <div class="notif-body">
        <div class="notif-header">
          <div class="notif-title">
            ${icon(titleIconName, { size: 16 })}
            ${title}
          </div>
          <div class="notif-time" title="${escapeHtml(formatWita(order.TANGGAL_ORDER))}">
            ${escapeHtml(formatTimeAgo(order.TANGGAL_ORDER))}
          </div>
        </div>
        <div class="notif-desc">${desc}</div>
        <div class="notif-meta">
          <span class="notif-tag cabang">
            ${icon('store', { size: 11 })}
            ${escapeHtml(order.ID_CABANG)}
          </span>
          <span class="notif-tag ${statusTagClass}">
            ${icon(statusIconName, { size: 11 })}
            ${status}
          </span>
          ${order.TANGGAL_PROSES ? `
            <span class="notif-tag cabang" style="opacity: 0.6;">
              ${icon('clock', { size: 11 })}
              ${escapeHtml(formatWita(order.TANGGAL_PROSES, false))}
            </span>
          ` : ''}
        </div>
      </div>
    </article>
  `;
}

function updateLastRefresh() {
  const el = $('lastRefresh');
  if (el && state.lastRefreshTime) {
    el.textContent = 'Update: ' + formatTimeAgo(state.lastRefreshTime.toISOString());
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CLICK HANDLER
// ─────────────────────────────────────────────────────────────────────────

function handleNotifClick(orderId) {
  markRead(orderId);
  renderChipCounts();
  renderNotifications();

  if (state.session.role === 'admin') {
    window.location.href = `./dashboard.html#orders`;
  } else {
    window.location.href = `./order.html?cabang=${state.session.idCabang || ''}#history`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// POLLING
// ─────────────────────────────────────────────────────────────────────────

function startPolling() {
  if (state.pollingInterval) clearInterval(state.pollingInterval);

  state.pollingInterval = setInterval(() => {
    if (!document.hidden) {
      loadNotifications(true);
    }
  }, SETTINGS.notifPollingMs);

  setInterval(updateLastRefresh, 15000);
}

function stopPolling() {
  if (state.pollingInterval) {
    clearInterval(state.pollingInterval);
    state.pollingInterval = null;
  }
}

function handleVisibility() {
  if (document.hidden) {
    stopPolling();
  } else {
    startPolling();
    loadNotifications(true);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {
  $('filterChips')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-filter]');
    if (!chip) return;

    state.filter = chip.dataset.filter;

    document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');

    renderNotifications();
  });

  $('btnMarkAllRead')?.addEventListener('click', async () => {
    if (!state.orders.length) return;

    const ok = await confirm({
      icon: '✓',
      title: 'Tandai Semua Dibaca?',
      message: `${state.orders.length} notifikasi akan ditandai sebagai sudah dibaca.`,
      okText: 'Ya, Tandai',
      okVariant: 'primary',
    });

    if (!ok) return;

    markAllRead();
    renderChipCounts();
    renderNotifications();
    toast.success('Semua notifikasi ditandai dibaca.');
  });

  requestNotificationPermission();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}