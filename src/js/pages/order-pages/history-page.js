/* ═══════════════════════════════════════════════════════════════════════
   HISTORY PAGE — Riwayat order cabang
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, parseAnyDate, sortBy } from '../../utils.js';
import { orders as ordersApi } from '../../api.js';
import { getStatusInfo } from '../../config.js';

// State lokal
let localState = {
  orders: [],
  filter: 'ALL',
  isLoading: false,
};

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

export function renderHistoryPage(state) {
  return `
    <header class="page-heading">
      <h1>📋 Riwayat Order</h1>
      <p>
        Semua order dari cabang
        <strong id="historyBranchLabel" style="color: var(--orange);">${escapeHtml(state.branchId)}</strong>
      </p>
    </header>

    <div class="filter-scroll" id="historyFilter">
      <button class="filter-chip active" type="button" data-history-filter="ALL">Semua</button>
      <button class="filter-chip" type="button" data-history-filter="PENDING">⏳ Tertunda</button>
      <button class="filter-chip" type="button" data-history-filter="APPROVED">✅ Disetujui</button>
      <button class="filter-chip" type="button" data-history-filter="REJECTED">❌ Ditolak</button>
    </div>

    <div class="history-list" id="historyList">
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>Klik tab Riwayat untuk memuat data.</p>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initHistory(state) {
  // Filter chips
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

    // Filter hanya cabang ini + sort by tanggal (terbaru dulu)
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
        <div class="empty-icon">⚠️</div>
        <p>Gagal memuat riwayat.</p>
        <button class="secondary-button" id="retryHistoryBtn" type="button" style="margin-top: 16px;">
          🔄 Coba Lagi
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

  // Filter by status
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
        <div class="empty-icon">📋</div>
        <p>${msg}</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(buildHistoryItem).join('');
}

function buildHistoryItem(order) {
  const status = String(order.STATUS || 'PENDING').toUpperCase();
  const statusInfo = getStatusInfo(status);

  const statusClass = status === 'PENDING' ? 'status-pending'
                    : status === 'APPROVED' ? 'status-approved'
                    : 'status-rejected';

  const details = order.DETAIL || [];
  const itemText = details.length
    ? details.slice(0, 3).map((d) =>
        `${escapeHtml(d.KODE_BARANG)} × ${escapeHtml(d.QTY)}`
      ).join(', ') + (details.length > 3 ? ` +${details.length - 3} lagi` : '')
    : 'detail tidak tersedia';

  // Hitung total items yang disetujui
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
          ${statusInfo.icon} ${escapeHtml(status)}
        </span>
      </div>
      <div class="history-date">🕐 ${escapeHtml(formatWita(order.TANGGAL_ORDER))}</div>
      <div class="history-items">📦 ${itemText}</div>
      ${totalHarga > 0 ? `
        <div class="history-note" style="color: var(--orange); font-weight: 700;">
          💰 Total: Rp ${totalHarga.toLocaleString('id-ID')}
        </div>
      ` : ''}
      ${order.CATATAN ? `
        <div class="history-note" style="margin-top: 4px;">
          📝 ${escapeHtml(cleanCatatan(order.CATATAN))}
        </div>
      ` : ''}
    </article>
  `;
}

/**
 * Hilangkan section [STOK AKTUAL] dari catatan untuk display
 */
function cleanCatatan(catatan) {
  return String(catatan || '').replace(/\[STOK AKTUAL\][\s\S]*/, '').trim();
}
