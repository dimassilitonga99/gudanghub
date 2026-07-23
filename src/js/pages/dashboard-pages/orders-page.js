/* ═══════════════════════════════════════════════════════════════════════
   ORDERS PAGE — Semua Pesanan dengan filter & search
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, debounce } from '../../utils.js';
import { CABANG, getStatusInfo } from '../../config.js';
import { showEditModal } from './edit-modal.js';

// State lokal untuk filter
let localState = {
  currentFilter: 'ALL',
  searchQuery: '',
  filteredOrders: [],
};

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

export function renderOrdersPage(state) {
  return `
    <header class="page-header">
      <h1>📦 Semua Pesanan</h1>
      <p>Kelola, edit item, dan proses seluruh pesanan dari empat cabang</p>
    </header>

    <div class="filter-bar">
      ${filterBtn('ALL', 'Semua', true)}
      ${filterBtn('PENDING', '⏳ Tertunda')}
      ${filterBtn('APPROVED', '✅ Disetujui')}
      ${filterBtn('REJECTED', '❌ Ditolak')}

      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input
          class="search-input"
          id="orderSearch"
          type="search"
          placeholder="Cari ID atau cabang..."
          autocomplete="off"
        >
      </div>
    </div>

    <section class="panel">
      <div class="panel-body" style="padding: 0;">
        <div class="order-table-wrap">
          <table class="order-table">
            <thead>
              <tr>
                <th>#</th>
                <th>ID</th>
                <th>Cabang</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="allOrdersBody">
              <tr>
                <td colspan="6">
                  <div class="empty-state">
                    <div class="spinner spinner-lg" style="color: var(--orange); margin-bottom: 12px;"></div>
                    <p>Memuat data...</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function filterBtn(value, label, active = false) {
  return `
    <button
      class="filter-btn${active ? ' active' : ''}"
      type="button"
      data-filter="${value}"
    >
      ${label}
    </button>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE DATA
// ─────────────────────────────────────────────────────────────────────────

export function updateOrdersData(state) {
  applyFilters(state);
  renderOrdersTable(state);
  bindOrdersEvents(state);
}

function applyFilters(state) {
  const query = localState.searchQuery.toLowerCase().trim();

  localState.filteredOrders = state.allOrders.filter((order) => {
    // Filter by status
    const statusMatch =
      localState.currentFilter === 'ALL' ||
      String(order.STATUS || '').toUpperCase() === localState.currentFilter;

    // Filter by search
    const id = String(order.ORDER_ID || '').toLowerCase();
    const branch = String(order.ID_CABANG || '').toLowerCase();
    const searchMatch = !query || id.includes(query) || branch.includes(query);

    return statusMatch && searchMatch;
  });
}

function renderOrdersTable(state) {
  const body = $('allOrdersBody');
  if (!body) return;

  if (!localState.filteredOrders.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <p>Tidak ada order yang cocok dengan filter</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = localState.filteredOrders.map((order, index) => {
    const branch = CABANG[order.ID_CABANG] || { pic: '-', icon: '🏪' };
    const status = String(order.STATUS || 'PENDING').toUpperCase();
    const statusInfo = getStatusInfo(status);
    const orderId = escapeHtml(order.ORDER_ID);

    const actionButtons = status === 'PENDING'
      ? `
        <button class="btn-approve" type="button" data-quick-approve="${orderId}" title="Setujui">✅</button>
        <button class="btn-reject" type="button" data-quick-reject="${orderId}" title="Tolak">❌</button>
      `
      : '';

    const statusClass = status === 'PENDING' ? 'pending'
                     : status === 'APPROVED' ? 'approved'
                     : 'rejected';

    return `
      <tr>
        <td>${index + 1}</td>
        <td><span class="order-id">${orderId}</span></td>
        <td><span class="cabang-badge">${branch.icon} ${escapeHtml(branch.pic)}</span></td>
        <td>${escapeHtml(formatWita(order.TANGGAL_ORDER))}</td>
        <td>
          <span class="status-badge ${statusClass}">
            ${statusInfo.icon} ${status}
          </span>
        </td>
        <td>
          <div class="action-btns">
            ${actionButtons}
            <button class="btn-detail" type="button" data-show-detail="${orderId}">✏️ Kelola</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  bindOrderRowActions(body, state);
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindOrdersEvents(state) {
  // Filter buttons
  document.querySelectorAll('.filter-btn[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      localState.currentFilter = btn.dataset.filter;
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters(state);
      renderOrdersTable(state);
    });
  });

  // Search input
  const searchInput = $('orderSearch');
  if (searchInput) {
    // Restore previous search
    searchInput.value = localState.searchQuery;

    const handleSearch = debounce((e) => {
      localState.searchQuery = e.target.value;
      applyFilters(state);
      renderOrdersTable(state);
    }, 200);

    searchInput.addEventListener('input', handleSearch);
  }

  // Restore filter button active state
  const activeBtn = document.querySelector(`.filter-btn[data-filter="${localState.currentFilter}"]`);
  if (activeBtn) {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }
}

function bindOrderRowActions(container, state) {
  container.querySelectorAll('[data-quick-approve]').forEach((btn) => {
    btn.addEventListener('click', () => quickApprove(btn.dataset.quickApprove, state));
  });

  container.querySelectorAll('[data-quick-reject]').forEach((btn) => {
    btn.addEventListener('click', () => quickReject(btn.dataset.quickReject, state));
  });

  container.querySelectorAll('[data-show-detail]').forEach((btn) => {
    btn.addEventListener('click', () => showEditModal(btn.dataset.showDetail, state));
  });
}

// ─────────────────────────────────────────────────────────────────────────
// QUICK ACTIONS (shared logic — reuse dari dashboard-page)
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
    okText: '✅ Ya, Setujui',
    okVariant: 'success',
  });

  if (!ok) return;

  const idx = state.allOrders.findIndex((o) => o.ORDER_ID === orderId);
  const oldStatus = idx >= 0 ? state.allOrders[idx].STATUS : null;
  if (idx >= 0) {
    state.allOrders[idx].STATUS = 'APPROVED';
    updateOrdersData(state);
    updatePendingBadge();
  }

  toast.info('⏳ Memproses...');

  const result = await ordersApi.updateStatus({
    orderId,
    status: 'APPROVED',
    alasan: '',
  });

  if (result.status === 'ok') {
    toast.success('✅ Order disetujui!');
    await loadData(true);
  } else {
    if (idx >= 0 && oldStatus) {
      state.allOrders[idx].STATUS = oldStatus;
      updateOrdersData(state);
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
    okText: '❌ Ya, Tolak',
    okVariant: 'danger',
    required: true,
  });

  if (!reason) return;

  const idx = state.allOrders.findIndex((o) => o.ORDER_ID === orderId);
  const oldStatus = idx >= 0 ? state.allOrders[idx].STATUS : null;
  if (idx >= 0) {
    state.allOrders[idx].STATUS = 'REJECTED';
    updateOrdersData(state);
    updatePendingBadge();
  }

  toast.info('⏳ Memproses...');

  const result = await ordersApi.updateStatus({
    orderId,
    status: 'REJECTED',
    alasan: reason,
  });

  if (result.status === 'ok') {
    toast.success('❌ Order ditolak.');
    await loadData(true);
  } else {
    if (idx >= 0 && oldStatus) {
      state.allOrders[idx].STATUS = oldStatus;
      updateOrdersData(state);
      updatePendingBadge();
    }
    toast.error(result.message || 'Gagal update status.');
  }
}
