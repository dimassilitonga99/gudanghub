/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD PAGE — with Lucide Icons
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, sortBy, parseAnyDate } from '../../utils.js';
import { CABANG } from '../../config.js';
import { icon, injectIcons } from '../../icons.js';
import { showEditModal } from './edit-modal.js';
import { showPage } from '../dashboard.js';

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

export function renderDashboardPage(state) {
  const name = state.session?.nama || state.session?.username || 'Admin';

  return `
    <header class="page-header">
      <h1>
        <span data-icon="sparkles" data-icon-size="24" data-icon-color="var(--orange)"></span>
        Selamat datang, ${escapeHtml(name)}!
      </h1>
      <p>Ringkasan operasional PT Central Perabot Utama hari ini</p>
    </header>

    <div class="stats-grid">
      ${buildStatCard('Total Order', 'statTotal', 'Semua pesanan masuk', 'package', 'var(--orange)', 'rgba(255,107,0,0.15)')}
      ${buildStatCard('Menunggu', 'statPending', 'Perlu persetujuan', 'clock', 'var(--warning)', 'rgba(245,158,11,0.15)')}
      ${buildStatCard('Disetujui', 'statApproved', 'Pesanan berhasil', 'check-circle', 'var(--success)', 'rgba(34,197,94,0.15)')}
      ${buildStatCard('Ditolak', 'statRejected', 'Pesanan ditolak', 'x-circle', 'var(--danger)', 'rgba(239,68,68,0.15)')}
    </div>

    <div class="grid-3-1">
      <section class="panel">
        <header class="panel-header">
          <div class="panel-title">
            <span data-icon="clock" data-icon-size="18" data-icon-color="var(--warning)"></span>
            Order Menunggu Persetujuan
          </div>
          <button class="panel-action" type="button" data-goto="orders">
            Lihat Semua
            <span data-icon="arrow-right" data-icon-size="12"></span>
          </button>
        </header>
        <div class="panel-body" style="padding: 0;">
          <div class="order-table-wrap">
            <table class="order-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cabang</th>
                  <th>Item</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody id="pendingOrdersBody">
                <tr>
                  <td colspan="4">
                    <div class="empty-state">
                      <div class="spinner spinner-lg" style="color: var(--orange); margin-bottom: 12px;"></div>
                      <p>Memuat...</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="panel">
        <header class="panel-header">
          <div class="panel-title">
            <span data-icon="chart-pie" data-icon-size="18" data-icon-color="var(--orange)"></span>
            Status Order
          </div>
        </header>
        <div class="panel-body">
          ${buildDonutHtml()}
        </div>
      </section>
    </div>

    <div class="grid-2">
      <section class="panel">
        <header class="panel-header">
          <div class="panel-title">
            <span data-icon="chart-bar" data-icon-size="18" data-icon-color="var(--orange)"></span>
            Pesanan per Cabang
          </div>
        </header>
        <div class="panel-body">
          <div class="bar-chart" id="barChart"></div>
        </div>
      </section>

      <section class="panel">
        <header class="panel-header">
          <div class="panel-title">
            <span data-icon="activity" data-icon-size="18" data-icon-color="var(--orange)"></span>
            Aktivitas Terbaru
          </div>
        </header>
        <div class="panel-body" id="activityFeed">
          <div class="empty-state">
            <div class="spinner spinner-lg" style="color: var(--orange); margin-bottom: 12px;"></div>
            <p>Memuat aktivitas...</p>
          </div>
        </div>
      </section>
    </div>
  `;
}

function buildStatCard(label, valueId, description, iconName, color, iconBg) {
  return `
    <article class="stat-card" data-goto="orders">
      <div class="stat-header">
        <div class="stat-label">${label}</div>
        <div class="stat-icon" style="background: ${iconBg}; color: ${color};">
          <span data-icon="${iconName}" data-icon-size="20"></span>
        </div>
      </div>
      <div class="stat-value" id="${valueId}" style="color: ${color};">–</div>
      <div class="stat-change">${description}</div>
    </article>
  `;
}

function buildDonutHtml() {
  return `
    <div class="donut-wrap">
      <svg width="120" height="120" viewBox="0 0 120 120" aria-label="Status order chart">
        <circle cx="60" cy="60" r="44" fill="none" stroke="#1e1e3a" stroke-width="18"></circle>
        <circle id="donutApproved" cx="60" cy="60" r="44" fill="none"
                stroke="#22c55e" stroke-width="18"
                stroke-dasharray="0 276.5" stroke-linecap="round"
                style="transform: rotate(-90deg); transform-origin: center;
                       transition: stroke-dasharray 0.6s ease;"></circle>
        <circle id="donutPending" cx="60" cy="60" r="44" fill="none"
                stroke="#f59e0b" stroke-width="18"
                stroke-dasharray="0 276.5" stroke-linecap="round"
                style="transform: rotate(-90deg); transform-origin: center;
                       transition: stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease;"></circle>
        <circle id="donutRejected" cx="60" cy="60" r="44" fill="none"
                stroke="#ef4444" stroke-width="18"
                stroke-dasharray="0 276.5" stroke-linecap="round"
                style="transform: rotate(-90deg); transform-origin: center;
                       transition: stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease;"></circle>
        <text id="donutTotal" x="60" y="56" fill="#fff" font-size="20"
              font-weight="800" text-anchor="middle">0</text>
        <text x="60" y="72" fill="#94a3b8" font-size="10" text-anchor="middle">Total</text>
      </svg>

      <div class="donut-legend">
        ${legendRow('#22c55e', 'Disetujui', 'legendApproved')}
        ${legendRow('#f59e0b', 'Tertunda', 'legendPending')}
        ${legendRow('#ef4444', 'Ditolak', 'legendRejected')}
      </div>
    </div>
  `;
}

function legendRow(color, label, valueId) {
  return `
    <div class="legend-item">
      <div class="legend-dot" style="background: ${color};"></div>
      <span class="legend-label">${label}</span>
      <span class="legend-val" id="${valueId}" style="color: ${color};">0</span>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE DATA
// ─────────────────────────────────────────────────────────────────────────

export function updateDashboardData(state) {
  updateStats(state);
  updateDonut(state);
  updateBarChart(state);
  updatePendingTable(state);
  updateActivityFeed(state);
  bindPageEvents(state);
}

function countByStatus(orders, status) {
  return orders.filter((o) => String(o.STATUS || '').toUpperCase() === status).length;
}

function updateStats(state) {
  const total = state.allOrders.length;
  const pending = countByStatus(state.allOrders, 'PENDING');
  const approved = countByStatus(state.allOrders, 'APPROVED');
  const rejected = countByStatus(state.allOrders, 'REJECTED');

  $('statTotal') && ($('statTotal').textContent = total);
  $('statPending') && ($('statPending').textContent = pending);
  $('statApproved') && ($('statApproved').textContent = approved);
  $('statRejected') && ($('statRejected').textContent = rejected);
}

function updateDonut(state) {
  const total = state.allOrders.length || 1;
  const approved = countByStatus(state.allOrders, 'APPROVED');
  const pending = countByStatus(state.allOrders, 'PENDING');
  const rejected = countByStatus(state.allOrders, 'REJECTED');

  const circumference = 2 * Math.PI * 44;

  const approvedLen = (approved / total) * circumference;
  const pendingLen = (pending / total) * circumference;
  const rejectedLen = (rejected / total) * circumference;

  const donutA = $('donutApproved');
  const donutP = $('donutPending');
  const donutR = $('donutRejected');

  if (donutA) {
    donutA.setAttribute('stroke-dasharray', `${approvedLen} ${circumference - approvedLen}`);
  }

  if (donutP) {
    donutP.setAttribute('stroke-dasharray', `${pendingLen} ${circumference - pendingLen}`);
    donutP.setAttribute('stroke-dashoffset', `-${approvedLen}`);
  }

  if (donutR) {
    donutR.setAttribute('stroke-dasharray', `${rejectedLen} ${circumference - rejectedLen}`);
    donutR.setAttribute('stroke-dashoffset', `-${approvedLen + pendingLen}`);
  }

  $('donutTotal') && ($('donutTotal').textContent = state.allOrders.length);
  $('legendApproved') && ($('legendApproved').textContent = approved);
  $('legendPending') && ($('legendPending').textContent = pending);
  $('legendRejected') && ($('legendRejected').textContent = rejected);
}

function updateBarChart(state) {
  const chart = $('barChart');
  if (!chart) return;

  const branchIds = Object.keys(CABANG);
  const labels = branchIds.map((id) => CABANG[id].pic);
  const counts = branchIds.map(
    (id) => state.allOrders.filter((o) => o.ID_CABANG === id).length
  );
  const max = Math.max(...counts, 1);

  chart.innerHTML = counts
    .map(
      (count, i) => `
      <div class="bar-item" title="${labels[i]}: ${count} order">
        <div class="bar-fill" style="height: ${Math.max((count / max) * 90 + 4, 4)}%;"></div>
        <div class="bar-label">${labels[i]}</div>
      </div>
    `
    )
    .join('');
}

function updatePendingTable(state) {
  const body = $('pendingOrdersBody');
  if (!body) return;

  const pendingOrders = state.allOrders.filter(
    (o) => String(o.STATUS || '').toUpperCase() === 'PENDING'
  );

  if (!pendingOrders.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            <div class="empty-state-icon">${icon('check-circle', { size: 48, color: 'var(--success)' })}</div>
            <p>Semua order sudah diproses!</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = pendingOrders.slice(0, 5).map((order) => {
    const branch = CABANG[order.ID_CABANG] || { pic: '-' };
    const itemCount = order.DETAIL?.length || 0;
    const orderId = escapeHtml(order.ORDER_ID);

    return `
      <tr>
        <td><span class="order-id">${orderId}</span></td>
        <td>
          <span class="cabang-badge">
            ${icon('store', { size: 14 })}
            ${escapeHtml(branch.pic)}
          </span>
        </td>
        <td style="text-align: center;">${itemCount}</td>
        <td>
          <div class="action-btns">
            <button class="btn-approve" type="button" data-quick-approve="${orderId}" title="Setujui">
              ${icon('check', { size: 14 })}
            </button>
            <button class="btn-reject" type="button" data-quick-reject="${orderId}" title="Tolak">
              ${icon('close', { size: 14 })}
            </button>
            <button class="btn-detail" type="button" data-show-detail="${orderId}">
              ${icon('edit', { size: 12 })}
              Kelola
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  bindOrderActions(body, state);
}

function updateActivityFeed(state) {
  const feed = $('activityFeed');
  if (!feed) return;

  if (!state.allOrders.length) {
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('activity', { size: 48, color: 'var(--muted)' })}</div>
        <p>Belum ada aktivitas</p>
      </div>
    `;
    return;
  }

  const latest = sortBy(
    [...state.allOrders].map((o) => ({
      ...o,
      _sortKey: parseAnyDate(o.TANGGAL_ORDER).getTime(),
    })),
    '_sortKey',
    'desc'
  ).slice(0, 6);

  const statusColor = { PENDING: 'orange', APPROVED: 'green', REJECTED: 'red' };
  const statusIconName = { PENDING: 'clock', APPROVED: 'check-circle', REJECTED: 'x-circle' };

  feed.innerHTML = latest.map((order) => {
    const status = String(order.STATUS || 'PENDING').toUpperCase();
    const branch = CABANG[order.ID_CABANG] || { pic: '-' };

    return `
      <div class="activity-item">
        <div class="activity-dot ${statusColor[status] || 'blue'}"></div>
        <div class="activity-content">
          <div class="activity-text">
            ${icon(statusIconName[status] || 'package', { size: 14 })}
            <strong>${escapeHtml(order.ORDER_ID)}</strong>
            dari ${escapeHtml(branch.pic)} · ${escapeHtml(order.ID_CABANG)}
          </div>
          <div class="activity-time">
            ${icon('clock', { size: 12 })}
            ${escapeHtml(formatWita(order.TANGGAL_ORDER))}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindPageEvents(state) {
  document.querySelectorAll('[data-goto="orders"]').forEach((el) => {
    el.addEventListener('click', () => showPage('orders'));
  });
}

function bindOrderActions(container, state) {
  container.querySelectorAll('[data-quick-approve]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      quickApprove(btn.dataset.quickApprove, state);
    });
  });

  container.querySelectorAll('[data-quick-reject]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      quickReject(btn.dataset.quickReject, state);
    });
  });

  container.querySelectorAll('[data-show-detail]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEditModal(btn.dataset.showDetail, state);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// QUICK ACTIONS
// ─────────────────────────────────────────────────────────────────────────

async function quickApprove(orderId, state) {
  const { confirm, toast } = await import('../../ui.js');
  const { orders: ordersApi } = await import('../../api.js');
  const { updatePendingBadge, loadData } = await import('../dashboard.js');

  const order = state.allOrders.find((o) => o.ORDER_ID === orderId);
  const branch = CABANG[order?.ID_CABANG] || { pic: '-' };

  const ok = await confirm({
    icon: '✅',
    title: 'Setujui Pesanan?',
    message: `${orderId}\nCabang: ${branch.pic}\n\nSemua item akan disetujui.\nEmail akan dikirim ke cabang.`,
    okText: 'Ya, Setujui',
    okVariant: 'success',
  });

  if (!ok) return;

  const idx = state.allOrders.findIndex((o) => o.ORDER_ID === orderId);
  const oldStatus = idx >= 0 ? state.allOrders[idx].STATUS : null;
  if (idx >= 0) {
    state.allOrders[idx].STATUS = 'APPROVED';
    updateDashboardData(state);
    updatePendingBadge();
  }

  toast.info('Memproses...');

  const result = await ordersApi.updateStatus({
    orderId,
    status: 'APPROVED',
    alasan: '',
  });

  if (result.status === 'ok') {
    toast.success('Order disetujui!');
    await loadData(true);
  } else {
    if (idx >= 0 && oldStatus) {
      state.allOrders[idx].STATUS = oldStatus;
      updateDashboardData(state);
      updatePendingBadge();
    }
    toast.error(result.message || 'Gagal update status.');
  }
}

async function quickReject(orderId, state) {
  const { prompt, toast } = await import('../../ui.js');
  const { orders: ordersApi } = await import('../../api.js');
  const { updatePendingBadge, loadData } = await import('../dashboard.js');

  const order = state.allOrders.find((o) => o.ORDER_ID === orderId);
  const branch = CABANG[order?.ID_CABANG] || { pic: '-' };

  const reason = await prompt({
    icon: '❌',
    title: 'Tolak Seluruh Pesanan',
    message: `${orderId} — Cabang: ${branch.pic}\n\nIsi alasan penolakan:`,
    placeholder: 'Contoh: Stok habis...',
    okText: 'Ya, Tolak',
    okVariant: 'danger',
    required: true,
  });

  if (!reason) return;

  const idx = state.allOrders.findIndex((o) => o.ORDER_ID === orderId);
  const oldStatus = idx >= 0 ? state.allOrders[idx].STATUS : null;
  if (idx >= 0) {
    state.allOrders[idx].STATUS = 'REJECTED';
    updateDashboardData(state);
    updatePendingBadge();
  }

  toast.info('Memproses...');

  const result = await ordersApi.updateStatus({
    orderId,
    status: 'REJECTED',
    alasan: reason,
  });

  if (result.status === 'ok') {
    toast.success('Order ditolak.');
    await loadData(true);
  } else {
    if (idx >= 0 && oldStatus) {
      state.allOrders[idx].STATUS = oldStatus;
      updateDashboardData(state);
      updatePendingBadge();
    }
    toast.error(result.message || 'Gagal update status.');
  }
}