/* ═══════════════════════════════════════════════════════════════════════
   LAPORAN PAGE — Print-ready report
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, formatWita, parseAnyDate, sortBy, toNumber } from '../utils.js';
import { orders as ordersApi } from '../api.js';
import { requireAuth } from '../session.js';
import { CABANG, getStatusInfo, getHomeRoute } from '../config.js';
import { toast } from '../ui.js';

// State
const state = {
  session: null,
  allOrders: [],
  filteredOrders: [],
  filter: {
    cabang: '',
    period: 'all',
    status: '',
  },
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

  // Meta
  $('metaCreatedBy').textContent = state.session.nama || state.session.username;
  $('metaCreatedAt').textContent = formatWita(new Date().toISOString());

  // Bind events
  bindEvents();

  // Load data
  await loadData();
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD DATA
// ─────────────────────────────────────────────────────────────────────────

async function loadData() {
  try {
    const result = await ordersApi.getAll({ cache: false });

    if (result.status !== 'ok') {
      throw new Error(result.message || 'Gagal memuat data');
    }

    state.allOrders = result.data || [];
    applyFilters();
    renderAll();

  } catch (error) {
    toast.error('Gagal memuat laporan: ' + error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FILTERS
// ─────────────────────────────────────────────────────────────────────────

function applyFilters() {
  let filtered = [...state.allOrders];

  // Filter cabang
  if (state.filter.cabang) {
    filtered = filtered.filter(
      (o) => String(o.ID_CABANG || '').toUpperCase() === state.filter.cabang
    );
  }

  // Filter status
  if (state.filter.status) {
    filtered = filtered.filter(
      (o) => String(o.STATUS || '').toUpperCase() === state.filter.status
    );
  }

  // Filter periode
  if (state.filter.period !== 'all') {
    const now = new Date();
    const cutoff = new Date();

    switch (state.filter.period) {
      case 'today':
        cutoff.setHours(0, 0, 0, 0);
        break;
      case 'week':
        cutoff.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoff.setDate(now.getDate() - 30);
        break;
      case 'quarter':
        cutoff.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        cutoff.setFullYear(now.getFullYear() - 1);
        break;
    }

    filtered = filtered.filter((o) => {
      const orderDate = parseAnyDate(o.TANGGAL_ORDER);
      return orderDate >= cutoff;
    });
  }

  state.filteredOrders = filtered;

  // Update period label
  const periodLabels = {
    all: 'Semua Periode',
    today: 'Hari Ini',
    week: '7 Hari Terakhir',
    month: '30 Hari Terakhir',
    quarter: '3 Bulan Terakhir',
    year: '1 Tahun Terakhir',
  };
  $('reportPeriod').textContent = periodLabels[state.filter.period] || 'Semua Periode';
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

function renderAll() {
  renderStats();
  renderCabangTable();
  renderDetailTable();
  renderMeta();
}

function countByStatus(orders, status) {
  return orders.filter((o) => String(o.STATUS || '').toUpperCase() === status).length;
}

function calcTotal(order) {
  const details = order.DETAIL || [];
  return details
    .filter((d) => String(d.ITEM_STATUS || 'APPROVED').toUpperCase() === 'APPROVED')
    .reduce((s, d) => s + toNumber(d.QTY) * toNumber(d.HARGA_SATUAN), 0);
}

function renderStats() {
  const total = state.filteredOrders.length;
  const approved = countByStatus(state.filteredOrders, 'APPROVED');
  const pending = countByStatus(state.filteredOrders, 'PENDING');
  const rejected = countByStatus(state.filteredOrders, 'REJECTED');

  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  $('statTotal').textContent = total;
  $('statApproved').textContent = approved;
  $('statPending').textContent = pending;
  $('statRejected').textContent = rejected;

  $('statApprovedSub').textContent = `${approvalRate}% dari total`;
  $('statPendingSub').textContent = pending > 0 ? 'Perlu diproses' : 'Semua terproses';
  $('statRejectedSub').textContent = total > 0 ? `${Math.round((rejected / total) * 100)}% ditolak` : '-';
  $('statTotalSub').textContent = 'Semua pesanan';
}

function renderCabangTable() {
  const tbody = $('tableCabangBody');
  if (!tbody) return;

  let grandTotal = 0;
  let grandPending = 0;
  let grandApproved = 0;
  let grandRejected = 0;

  const rows = Object.entries(CABANG).map(([id, info]) => {
    const branchOrders = state.filteredOrders.filter((o) => o.ID_CABANG === id);
    const total = branchOrders.length;
    const pending = countByStatus(branchOrders, 'PENDING');
    const approved = countByStatus(branchOrders, 'APPROVED');
    const rejected = countByStatus(branchOrders, 'REJECTED');
    const rate = total > 0 ? Math.round((approved / total) * 100) : 0;

    grandTotal += total;
    grandPending += pending;
    grandApproved += approved;
    grandRejected += rejected;

    return `
      <tr>
        <td><span class="badge-cabang">${info.icon} ${id}</span></td>
        <td>${escapeHtml(info.nama)}</td>
        <td style="color: var(--muted);">${escapeHtml(info.pic)}</td>
        <td style="text-align: right; font-weight: 700;">${total}</td>
        <td style="text-align: right; color: var(--warning);">${pending}</td>
        <td style="text-align: right; color: var(--success); font-weight: 700;">${approved}</td>
        <td style="text-align: right; color: var(--danger);">${rejected}</td>
        <td>
          <div class="rate-bar">
            <div class="rate-bar-track">
              <div class="rate-bar-fill" style="width: ${rate}%;"></div>
            </div>
            <span class="rate-value">${rate}%</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const grandRate = grandTotal > 0 ? Math.round((grandApproved / grandTotal) * 100) : 0;

  const totalRow = `
    <tr class="total-row">
      <td colspan="3">TOTAL</td>
      <td style="text-align: right;">${grandTotal}</td>
      <td style="text-align: right;">${grandPending}</td>
      <td style="text-align: right;">${grandApproved}</td>
      <td style="text-align: right;">${grandRejected}</td>
      <td>
        <div class="rate-bar">
          <div class="rate-bar-track">
            <div class="rate-bar-fill" style="width: ${grandRate}%;"></div>
          </div>
          <span class="rate-value">${grandRate}%</span>
        </div>
      </td>
    </tr>
  `;

  tbody.innerHTML = rows + totalRow;
}

function renderDetailTable() {
  const tbody = $('tableDetailBody');
  if (!tbody) return;

  if (!state.filteredOrders.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <div class="empty-icon">📋</div>
          <p>Tidak ada data yang cocok dengan filter.</p>
        </td>
      </tr>
    `;
    $('detailCount').textContent = '0 order';
    return;
  }

  // Sort by tanggal (terbaru dulu)
  const sorted = sortBy(
    state.filteredOrders.map((o) => ({
      ...o,
      _sortKey: parseAnyDate(o.TANGGAL_ORDER).getTime(),
    })),
    '_sortKey',
    'desc'
  );

  tbody.innerHTML = sorted.map((order, i) => {
    const status = String(order.STATUS || 'PENDING').toUpperCase();
    const statusInfo = getStatusInfo(status);
    const branch = CABANG[order.ID_CABANG] || { pic: '-', icon: '🏪' };
    const itemCount = order.DETAIL?.length || 0;
    const total = calcTotal(order);

    const statusColor = status === 'APPROVED' ? 'var(--success)'
                      : status === 'REJECTED' ? 'var(--danger)'
                      : 'var(--warning)';

    return `
      <tr>
        <td style="color: var(--muted);">${i + 1}</td>
        <td style="font-family: var(--font-mono); color: var(--orange); font-weight: 700; font-size: 11px;">
          ${escapeHtml(order.ORDER_ID)}
        </td>
        <td>
          <span class="badge-cabang">${branch.icon} ${escapeHtml(order.ID_CABANG)}</span>
          <div style="font-size: 11px; color: var(--muted); margin-top: 2px;">${escapeHtml(branch.pic)}</div>
        </td>
        <td style="font-size: 12px;">${escapeHtml(formatWita(order.TANGGAL_ORDER, false))}</td>
        <td>
          <span style="color: ${statusColor}; font-weight: 700; font-size: 11px;">
            ${statusInfo.icon} ${status}
          </span>
        </td>
        <td style="text-align: right;">${itemCount}</td>
        <td style="text-align: right; color: var(--orange); font-weight: 700;">
          ${formatRupiah(total)}
        </td>
      </tr>
    `;
  }).join('');

  $('detailCount').textContent = `${state.filteredOrders.length} order`;
}

function renderMeta() {
  const total = state.filteredOrders.length;
  const approved = countByStatus(state.filteredOrders, 'APPROVED');
  const rate = total > 0 ? Math.round((approved / total) * 100) : 0;

  $('metaTotalOrder').textContent = total + ' order';
  $('metaApprovalRate').textContent = rate + '%';
  $('metaCreatedAt').textContent = formatWita(new Date().toISOString());
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {
  $('filterCabang')?.addEventListener('change', (e) => {
    state.filter.cabang = e.target.value;
    applyFilters();
    renderAll();
  });

  $('filterPeriod')?.addEventListener('change', (e) => {
    state.filter.period = e.target.value;
    applyFilters();
    renderAll();
  });

  $('filterStatus')?.addEventListener('change', (e) => {
    state.filter.status = e.target.value;
    applyFilters();
    renderAll();
  });

  $('btnPrint')?.addEventListener('click', () => {
    // Update timestamp sebelum print
    $('metaCreatedAt').textContent = formatWita(new Date().toISOString());
    setTimeout(() => window.print(), 100);
  });

  // Keyboard: Ctrl+P
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      // Biarkan browser handle
      $('metaCreatedAt').textContent = formatWita(new Date().toISOString());
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
