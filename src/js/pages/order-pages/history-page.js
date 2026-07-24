/* ═══════════════════════════════════════════════════════════════════════
   HISTORY PAGE — with Lucide Icons + Print Form Feature
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, parseAnyDate, sortBy } from '../../utils.js';
import { orders as ordersApi } from '../../api.js';
import { getStatusInfo } from '../../config.js';
import { icon } from '../../icons.js';
import { showPrintFormCabang, initPrintFormCabang } from './print-form-cabang.js';

let localState = {
  orders: [],
  filter: 'ALL',
  isLoading: false,
  stateRef: null,
};

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

export function renderHistoryPage(state) {
  return `
    <header class="page-heading">
      <h1>
        <span data-icon="file" data-icon-size="24" data-icon-color="var(--orange)"></span>
        Riwayat Order
      </h1>
      <p>
        Semua order dari cabang
        <strong id="historyBranchLabel" style="color: var(--orange);">${escapeHtml(state.branchId)}</strong>
      </p>
    </header>

    <div class="filter-scroll" id="historyFilter">
      <button class="filter-chip active" type="button" data-history-filter="ALL">
        ${icon('list', { size: 14 })}
        Semua
      </button>
      <button class="filter-chip" type="button" data-history-filter="PENDING">
        ${icon('clock', { size: 14 })}
        Tertunda
      </button>
      <button class="filter-chip" type="button" data-history-filter="APPROVED">
        ${icon('check-circle', { size: 14 })}
        Disetujui
      </button>
      <button class="filter-chip" type="button" data-history-filter="REJECTED">
        ${icon('x-circle', { size: 14 })}
        Ditolak
      </button>
    </div>

    <div class="history-list" id="historyList">
      <div class="empty-state">
        <div class="empty-icon">${icon('file', { size: 48, color: 'var(--muted)' })}</div>
        <p>Klik tab Riwayat untuk memuat data.</p>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initHistory(state) {
  localState.stateRef = state;

  // Init print form modal
  initPrintFormCabang();

  $('historyFilter')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-history-filter]');
    if (!chip) return;

    localState.filter = chip.dataset.historyFilter;

    document.querySelectorAll('[data-history-filter]').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');

    renderHistoryList(state);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD DATA
// ─────────────────────────────────────────────────────────────────────────

export async function loadHistory(state) {
  if (localState.isLoading) return;

  localState.isLoading = true;
  localState.stateRef = state;
  const list = $('historyList');
  if (!list) return;

  list.innerHTML = `
    <div class="empty-state">
      <div class="loading-spinner"></div>
      <div>Memuat riwayat...</div>
    </div>
  `;

  try {
    const result = await ordersApi.getAll({ cache: false });

    if (result.status !== 'ok') {
      throw new Error(result.message || 'Riwayat gagal dimuat');
    }

    const allOrders = result.data || [];

    const branchOrders = allOrders
      .filter((o) => String(o.ID_CABANG || '').toUpperCase() === state.branchId)
      .map((o) => ({
        ...o,
        _sortKey: parseAnyDate(o.TANGGAL_ORDER).getTime(),
      }));

    localState.orders = sortBy(branchOrders, '_sortKey', 'desc');

    renderHistoryList(state);
  } catch (error) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon('alert-triangle', { size: 48, color: 'var(--danger)' })}</div>
        <p>Gagal memuat riwayat.</p>
        <button class="secondary-button" id="retryHistoryBtn" type="button" style="margin-top: 16px;">
          ${icon('refresh', { size: 14 })}
          Coba Lagi
        </button>
      </div>
    `;
    $('retryHistoryBtn')?.addEventListener('click', () => loadHistory(state));
  } finally {
    localState.isLoading = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER LIST
// ─────────────────────────────────────────────────────────────────────────

function renderHistoryList(state) {
  const list = $('historyList');
  if (!list) return;

  const filtered = localState.filter === 'ALL'
    ? localState.orders
    : localState.orders.filter((o) =>
        String(o.STATUS || '').toUpperCase() === localState.filter
      );

  if (!filtered.length) {
    const msg = localState.filter === 'ALL'
      ? 'Belum ada riwayat order.'
      : `Tidak ada order dengan status "${localState.filter}".`;

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon('file', { size: 48, color: 'var(--muted)' })}</div>
        <p>${msg}</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(buildHistoryItem).join('');

  // Bind click events untuk tombol download
  list.querySelectorAll('[data-download-order]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDownload(btn.dataset.downloadOrder);
    });
  });
}

function buildHistoryItem(order) {
  const status = String(order.STATUS || 'PENDING').toUpperCase();

  const statusClass = status === 'PENDING' ? 'status-pending'
                    : status === 'APPROVED' ? 'status-approved'
                    : 'status-rejected';

  const statusIconName = {
    PENDING: 'clock',
    APPROVED: 'check-circle',
    REJECTED: 'x-circle',
  }[status] || 'clock';

  const details = order.DETAIL || [];
  const itemText = details.length
    ? details.slice(0, 3).map((d) =>
        `${escapeHtml(d.KODE_BARANG)} × ${escapeHtml(d.QTY)}`
      ).join(', ') + (details.length > 3 ? ` +${details.length - 3} lagi` : '')
    : 'detail tidak tersedia';

  const approvedItems = details.filter((d) =>
    String(d.ITEM_STATUS || 'APPROVED').toUpperCase() === 'APPROVED'
  );
  const totalHarga = approvedItems.reduce((s, d) =>
    s + (parseFloat(d.QTY) || 0) * (parseFloat(d.HARGA_SATUAN) || 0), 0
  );

  return `
    <article class="history-item">
      <div class="history-header">
        <div class="history-id">${escapeHtml(order.ORDER_ID)}</div>
        <span class="status-badge ${statusClass}">
          ${icon(statusIconName, { size: 12 })}
          ${escapeHtml(status)}
        </span>
      </div>
      <div class="history-date">
        ${icon('calendar-clock', { size: 12 })}
        ${escapeHtml(formatWita(order.TANGGAL_ORDER))}
      </div>
      <div class="history-items">
        ${icon('package', { size: 12 })}
        ${itemText}
      </div>
      ${totalHarga > 0 ? `
        <div class="history-note" style="color: var(--orange); font-weight: 700;">
          ${icon('trending-up', { size: 12 })}
          Total: Rp ${totalHarga.toLocaleString('id-ID')}
        </div>
      ` : ''}
      ${order.CATATAN ? `
        <div class="history-note" style="margin-top: 4px;">
          ${icon('message', { size: 12 })}
          ${escapeHtml(cleanCatatan(order.CATATAN))}
        </div>
      ` : ''}

      <!-- DOWNLOAD BUTTON -->
      <div class="history-actions">
        <button class="btn-download-history" type="button" data-download-order="${escapeHtml(order.ORDER_ID)}">
          ${icon('download', { size: 14 })}
          Download Form
        </button>
      </div>
    </article>
  `;
}

function cleanCatatan(catatan) {
  return String(catatan || '').replace(/\[STOK AKTUAL\][\s\S]*/, '').trim();
}

// ─────────────────────────────────────────────────────────────────────────
// HANDLE DOWNLOAD
// ─────────────────────────────────────────────────────────────────────────

function handleDownload(orderId) {
  const order = localState.orders.find((o) => o.ORDER_ID === orderId);

  if (!order) {
    const { toast } = window.__gudangHubOrder ? { toast: null } : { toast: null };
    if (toast) toast.error('Order tidak ditemukan.');
    console.error('Order not found:', orderId);
    return;
  }

  showPrintFormCabang(order);
}
