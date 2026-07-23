/* ═══════════════════════════════════════════════════════════════════════
   NOTIFIKASI PAGE — Real-time notification dengan polling
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, formatTimeAgo, parseAnyDate, sortBy, storage } from '../utils.js';
import { orders as ordersApi } from '../api.js';
import { requireAuth } from '../session.js';
import { CABANG, SETTINGS, getStatusInfo } from '../config.js';
import { toast } from '../ui.js';

const STORAGE_KEY = 'gudanghub_notif_read';

const state = {
  session: null,
  notifications: [],
  readIds: new Set(),
  filter: 'all',
  refreshInterval: null,
  lastRefresh: null,
};

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {
  state.session = requireAuth();
  if (!state.session) return;

  // Set back link sesuai role
  const backLink = $('btnBack');
  if (backLink) {
    if (state.session.role === 'admin') {
      backLink.href = './dashboard.html';
    } else {
      backLink.href = `./order.html?cabang=${state.session.idCabang || ''}`;
    }
  }

  // Load read notifications from localStorage
  loadReadState();

  // Bind events
  bindEvents();

  // Initial load
  await loadNotifications();

  // Start polling
  startPolling();

  // Cleanup on unload
  window.addEventListener('beforeunload', stopPolling);

  // Pause when hidden, resume when visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
      loadNotifications(); // Refresh saat balik
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// STORAGE (READ STATE)
// ─────────────────────────────────────────────────────────────────────────

function loadReadState() {
  const readList = storage.get(STORAGE_KEY, []);
  state.readIds = new Set(readList);
}

function saveReadState() {
  // Simpan max 500 ID biar localStorage tidak membludak
  const arr = Array.from(state.readIds).slice(-500);
  storage.set(STORAGE_KEY, arr);
}

function markAsRead(id) {
  state.readIds.add(id);
  saveReadState();
}

function markAllAsRead() {
  state.notifications.forEach((n) => state.readIds.add(n.id));
  saveReadState();
  renderAll();
  toast.success('✅ Semua notifikasi ditandai sudah dibaca.');
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD DATA
// ─────────────────────────────────────────────────────────────────────────

async function loadNotifications() {
  try {
    const result = await ordersApi.getAll({ cache: false });
    if (result.status !== 'ok') {
      throw new Error(result.message || 'Gagal memuat');
    }

    const allOrders = result.data || [];
    const s = state.session;

    // Filter berdasarkan role
    const relevantOrders = s.role === 'admin'
      ? allOrders
      : allOrders.filter((o) => String(o.ID_CABANG || '').toUpperCase() === s.idCabang);

    // Convert ke notification format
    state.notifications = convertToNotifications(relevantOrders, s);

    state.lastRefresh = new Date();
    updateLastRefresh();
    renderAll();

  } catch (error) {
    const list = $('notifList');
    if (list && !state.notifications.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Gagal Memuat</h3>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    }
  }
}

/**
 * Convert order data ke format notifikasi
 */
function convertToNotifications(orders, session) {
  const notifs = [];

  orders.forEach((order) => {
    const orderId = order.ORDER_ID;
    const status = String(order.STATUS || 'PENDING').toUpperCase();
    const branch = CABANG[order.ID_CABANG] || { pic: order.ID_CABANG, nama: order.ID_CABANG };
    const orderDate = parseAnyDate(order.TANGGAL_ORDER);
    const processDate = order.TANGGAL_PROSES ? parseAnyDate(order.TANGGAL_PROSES) : null;

    // Notif 1: Order baru (untuk admin) / Order terkirim (untuk cabang)
    const newOrderId = `NEW-${orderId}`;
    if (session.role === 'admin') {
      notifs.push({
        id: newOrderId,
        type: 'new',
        status: 'pending',
        icon: '📦',
        color: 'orange',
        title: `Order baru dari ${branch.pic}`,
        description: `<strong>${escapeHtml(orderId)}</strong> menunggu persetujuan. ${order.DETAIL?.length || 0} item.`,
        timestamp: orderDate,
        actionUrl: `./dashboard.html#orders`,
        actionText: 'Lihat detail →',
      });
    } else {
      notifs.push({
        id: newOrderId,
        type: 'submitted',
        status: 'pending',
        icon: '📤',
        color: 'blue',
        title: `Order terkirim`,
        description: `<strong>${escapeHtml(orderId)}</strong> berhasil dikirim ke gudang pusat.`,
        timestamp: orderDate,
        actionUrl: `./order.html?cabang=${session.idCabang}#history`,
        actionText: 'Lihat riwayat →',
      });
    }

    // Notif 2: Status update (kalau sudah diproses)
    if (processDate && (status === 'APPROVED' || status === 'REJECTED')) {
      const statusInfo = getStatusInfo(status);
      const notifId = `STATUS-${orderId}-${status}`;

      if (session.role === 'admin') {
        // Admin: kalau approve/reject sendiri
        notifs.push({
          id: notifId,
          type: 'status',
          status: status.toLowerCase(),
          icon: statusInfo.icon,
          color: status === 'APPROVED' ? 'green' : 'red',
          title: `Order ${status === 'APPROVED' ? 'disetujui' : 'ditolak'}`,
          description: `<strong>${escapeHtml(orderId)}</strong> dari ${escapeHtml(branch.pic)}. Diproses oleh ${escapeHtml(order.DIPROSES_OLEH || 'Admin')}.`,
          timestamp: processDate,
          actionUrl: `./dashboard.html#orders`,
          actionText: 'Lihat →',
        });
      } else {
        // Cabang: notifikasi hasil approve/reject
        notifs.push({
          id: notifId,
          type: 'status',
          status: status.toLowerCase(),
          icon: statusInfo.icon,
          color: status === 'APPROVED' ? 'green' : 'red',
          title: status === 'APPROVED'
            ? `🎉 Order Anda disetujui!`
            : `Order Anda ditolak`,
          description: `<strong>${escapeHtml(orderId)}</strong> telah diproses admin.${status === 'APPROVED' ? ' Barang akan segera dikirim.' : ' Cek email untuk alasan.'}`,
          timestamp: processDate,
          actionUrl: `./order.html?cabang=${session.idCabang}#history`,
          actionText: 'Lihat detail →',
        });
      }
    }
  });

  // Sort by timestamp desc
  return sortBy(
    notifs.map((n) => ({ ...n, _sortKey: n.timestamp.getTime() })),
    '_sortKey',
    'desc'
  ).slice(0, 100); // max 100 notif
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

function renderAll() {
  renderCounts();
  renderList();
  updateHeaderUnread();
}

function renderCounts() {
  const total = state.notifications.length;
  const unread = state.notifications.filter((n) => !state.readIds.has(n.id)).length;
  const pending = state.notifications.filter((n) => n.status === 'pending').length;
  const approved = state.notifications.filter((n) => n.status === 'approved').length;
  const rejected = state.notifications.filter((n) => n.status === 'rejected').length;

  $('countAll').textContent = total;
  $('countUnread').textContent = unread;
  $('countPending').textContent = pending;
  $('countApproved').textContent = approved;
  $('countRejected').textContent = rejected;
}

function updateHeaderUnread() {
  const unread = state.notifications.filter((n) => !state.readIds.has(n.id)).length;
  const el = $('unreadCount');
  if (el) {
    el.textContent = unread > 0 ? (unread > 99 ? '99+' : unread) : '';
  }
}

function renderList() {
  const list = $('notifList');
  if (!list) return;

  const filtered = filterNotifications(state.notifications, state.filter);

  if (!filtered.length) {
    const emptyMsg = state.filter === 'unread' ? {
      icon: '✨',
      title: 'Semua Sudah Dibaca',
      desc: 'Tidak ada notifikasi baru untuk saat ini.',
    } : {
      icon: '🔔',
      title: 'Belum Ada Notifikasi',
      desc: 'Notifikasi akan muncul di sini saat ada aktivitas.',
    };

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${emptyMsg.icon}</div>
        <h3>${emptyMsg.title}</h3>
        <p>${emptyMsg.desc}</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(buildNotifItem).join('');

  // Bind click for each
  list.querySelectorAll('[data-notif-id]').forEach((el) => {
    el.addEventListener('click', (e) => {
      const id = el.dataset.notifId;
      const notif = state.notifications.find((n) => n.id === id);
      if (!notif) return;

      if (!state.readIds.has(id)) {
        markAsRead(id);
        renderAll();
      }

      // Kalau ada action URL, redirect
      if (notif.actionUrl) {
        // Don't prevent default kalau tag <a>
        return;
      }

      e.preventDefault();
    });
  });
}

function filterNotifications(notifs, filter) {
  switch (filter) {
    case 'unread':
      return notifs.filter((n) => !state.readIds.has(n.id));
    case 'pending':
      return notifs.filter((n) => n.status === 'pending');
    case 'approved':
      return notifs.filter((n) => n.status === 'approved');
    case 'rejected':
      return notifs.filter((n) => n.status === 'rejected');
    default:
      return notifs;
  }
}

function buildNotifItem(notif) {
  const isUnread = !state.readIds.has(notif.id);
  const tag = notif.actionUrl ? 'a' : 'div';
  const href = notif.actionUrl ? `href="${notif.actionUrl}"` : '';

  return `
    <${tag} ${href} class="notif-item ${isUnread ? 'unread' : ''}" data-notif-id="${escapeHtml(notif.id)}">
      <div class="notif-icon ${notif.color}">${notif.icon}</div>

      <div class="notif-content">
        <div class="notif-header">
          <div class="notif-title">${escapeHtml(notif.title)}</div>
          ${isUnread ? '<span class="notif-badge new">BARU</span>' : ''}
        </div>

        <div class="notif-desc">${notif.description}</div>

        <div class="notif-footer">
          <div class="notif-time">
            <span>🕐</span>
            <span>${escapeHtml(formatTimeAgo(notif.timestamp))}</span>
            <span class="notif-time-full">· ${escapeHtml(formatWita(notif.timestamp))}</span>
          </div>
          ${notif.actionText ? `<div class="notif-action">${escapeHtml(notif.actionText)}</div>` : ''}
        </div>
      </div>
    </${tag}>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// POLLING
// ─────────────────────────────────────────────────────────────────────────

function startPolling() {
  if (state.refreshInterval) return;

  state.refreshInterval = setInterval(() => {
    if (!document.hidden) {
      loadNotifications();
    }
  }, SETTINGS.notifPollingMs);
}

function stopPolling() {
  if (state.refreshInterval) {
    clearInterval(state.refreshInterval);
    state.refreshInterval = null;
  }
}

function updateLastRefresh() {
  const el = $('lastRefresh');
  if (el && state.lastRefresh) {
    const time = state.lastRefresh.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    el.textContent = `· ${time}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {
  // Filter tabs
  document.querySelectorAll('.notif-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.filter = tab.dataset.filter;
      document.querySelectorAll('.notif-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      renderList();
    });
  });

  // Mark all as read
  $('btnMarkAllRead')?.addEventListener('click', markAllAsRead);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
