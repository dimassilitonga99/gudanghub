/* ═══════════════════════════════════════════════════════════════════════
   HISTORY PAGE — v3.6 Fast Load + Reset Orders + Next Order Number
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, parseAnyDate, sortBy } from '../../utils.js';
import { orders as ordersApi, callApi, clearLSCache } from '../../api.js';
import { toast, confirm as confirmDialog, prompt as promptDialog } from '../../ui.js';
import { icon } from '../../icons.js';
import { showPrintFormCabang, initPrintFormCabang } from './print-form-cabang.js';

let localState = {
  orders: [],
  filter: 'ALL',
  dateFrom: '',
  dateTo: '',
  quickDate: '',
  isLoading: false,
  stateRef: null,
  hasLoaded: false,
};

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

export function renderHistoryPage(state) {

  var today = new Date();
  var firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  var todayStr = formatDateInput(today);
  var firstDayStr = formatDateInput(firstDay);

  return `
    <header class="page-heading">
      <h1 style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        <span data-icon="file" data-icon-size="24" data-icon-color="var(--orange)"></span>
        <span style="flex: 1;">Riwayat Order</span>
        <button class="btn-reset-orders" id="btnResetOrders" type="button" title="Reset semua order">
          ${icon('trash', { size: 14 })}
          Reset
        </button>
      </h1>
      <p>
        Semua order dari cabang
        <strong id="historyBranchLabel" style="color: var(--orange);">${escapeHtml(state.branchId)}</strong>
        · <span id="nextOrderNumber" style="color: var(--muted); font-size: 12px;">Nomor order berikutnya: -</span>
      </p>
    </header>

    <!-- STATUS FILTER -->
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

    <!-- DATE FILTER -->
    <div class="date-filter-bar">
      <span class="date-filter-label">
        ${icon('calendar', { size: 14 })}
        Tanggal:
      </span>

      <input
        type="date"
        class="date-input"
        id="dateFrom"
        value="${firstDayStr}"
        title="Dari tanggal"
      >

      <span style="color: var(--muted); font-size: 12px;">s/d</span>

      <input
        type="date"
        class="date-input"
        id="dateTo"
        value="${todayStr}"
        title="Sampai tanggal"
      >

      <div class="date-filter-actions">
        <button class="btn-date-filter" id="btnApplyDate" type="button">
          ${icon('filter', { size: 14 })}
          Terapkan
        </button>

        <button class="btn-date-reset" id="btnResetDate" type="button">
          ${icon('refresh', { size: 14 })}
          Reset
        </button>
      </div>

      <span class="date-range-info" id="dateRangeInfo">
        ${icon('calendar-clock', { size: 12 })}
        <span id="dateRangeText"></span>
      </span>
    </div>

    <!-- QUICK DATE BUTTONS -->
    <div class="quick-date-bar">
      <button class="quick-date-btn" type="button" data-quick-date="today">
        ${icon('calendar', { size: 12 })} Hari Ini
      </button>
      <button class="quick-date-btn" type="button" data-quick-date="yesterday">
        ${icon('calendar', { size: 12 })} Kemarin
      </button>
      <button class="quick-date-btn" type="button" data-quick-date="week">
        ${icon('calendar-days', { size: 12 })} 7 Hari
      </button>
      <button class="quick-date-btn active" type="button" data-quick-date="month">
        ${icon('calendar-days', { size: 12 })} Bulan Ini
      </button>
      <button class="quick-date-btn" type="button" data-quick-date="all">
        ${icon('list', { size: 12 })} Semua
      </button>
    </div>

    <!-- ORDER LIST -->
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

  var today = new Date();
  var firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  localState.dateFrom = formatDateInput(firstDay);
  localState.dateTo = formatDateInput(today);
  localState.quickDate = 'month';

  initPrintFormCabang();

  // Status filter
  $('historyFilter')?.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-history-filter]');
    if (!chip) return;

    localState.filter = chip.dataset.historyFilter;

    document.querySelectorAll('[data-history-filter]').forEach(function (c) {
      c.classList.remove('active');
    });

    chip.classList.add('active');
    renderHistoryList(state);
  });

  // Date filter
  $('btnApplyDate')?.addEventListener('click', function () {
    applyDateFilter(state);
  });

  $('btnResetDate')?.addEventListener('click', function () {
    resetDateFilter(state);
  });

  // Quick date
  document.querySelectorAll('[data-quick-date]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyQuickDate(btn.dataset.quickDate, state);
    });
  });

  // Enter key di date input
  $('dateFrom')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') applyDateFilter(state);
  });

  $('dateTo')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') applyDateFilter(state);
  });

  // ★ Reset Orders button
  $('btnResetOrders')?.addEventListener('click', function () {
    handleResetOrders(state);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// RESET ALL ORDERS — Hapus semua order dengan password admin
// ─────────────────────────────────────────────────────────────────────────

async function handleResetOrders(state) {

  // Step 1: Konfirmasi awal
  var ok = await confirmDialog({
    icon: '⚠️',
    title: 'Reset Semua Order?',
    message: 'PERHATIAN! Tindakan ini akan:\n\n'
      + '• Menghapus SEMUA order dari sistem\n'
      + '• Nomor order kembali ke 01\n'
      + '• Data tidak bisa dikembalikan\n\n'
      + 'Apakah Anda yakin ingin mereset total?\n\n'
      + '🔒 Dibutuhkan PASSWORD ADMIN untuk melanjutkan.',
    okText: 'Ya, Lanjutkan',
    okVariant: 'danger',
  });

  if (!ok) return;

  // Step 2: Minta password admin
  var password = await promptDialog({
    icon: '🔒',
    title: 'Masukkan Password Admin',
    message: 'Ketik password admin gudang untuk mengkonfirmasi reset.\n\nPassword ini WAJIB benar untuk melanjutkan.',
    placeholder: 'Password admin...',
    okText: 'Konfirmasi Reset',
    okVariant: 'danger',
    required: true,
  });

  if (!password) return;

  // Step 3: Kirim request reset ke backend
  try {

    toast.info('Memproses reset...', { duration: 10000 });

    var result = await callApi('resetAllOrders', {
      password: password,
      idCabang: state.branchId,
    }, {
      dedupe: false,
      timeout: 60000,
    });

    if (result.status !== 'ok') {
      toast.error(result.message || 'Reset gagal. Password salah?');
      return;
    }

    toast.success(result.message || 'Semua order berhasil direset! Nomor order kembali ke 01.', { duration: 5000 });

    // Clear cache
    clearLSCache('getOrders');

    // Reload history
    localState.orders = [];
    localState.hasLoaded = false;
    window.__cabangOrdersCache = [];

    await loadHistory(state);

  } catch (error) {
    toast.error('Gagal reset: ' + error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE NEXT ORDER NUMBER DISPLAY
// ─────────────────────────────────────────────────────────────────────────

function updateNextOrderNumber() {
  var el = $('nextOrderNumber');
  if (!el) return;

  try {
    var cachedOrders = window.__cabangOrdersCache || [];
    var now = new Date();
    var targetMonth = now.getMonth();
    var targetYear = now.getFullYear();

    var sameMonth = cachedOrders.filter(function (o) {
      var d = parseAnyDate(o.TANGGAL_ORDER);
      return d && d.getTime() !== 0
        && d.getMonth() === targetMonth
        && d.getFullYear() === targetYear;
    });

    var nextNomor = sameMonth.length + 1;
    var formatted = nextNomor < 10 ? '0' + nextNomor : String(nextNomor);

    el.textContent = 'Nomor order berikutnya: ' + formatted;
  } catch (e) {
    el.textContent = 'Nomor order berikutnya: 01';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DATE FILTER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

function applyDateFilter(state) {
  var from = $('dateFrom')?.value || '';
  var to = $('dateTo')?.value || '';

  localState.dateFrom = from;
  localState.dateTo = to;
  localState.quickDate = '';

  document.querySelectorAll('[data-quick-date]').forEach(function (b) {
    b.classList.remove('active');
  });

  updateDateRangeInfo();
  renderHistoryList(state);
}

function resetDateFilter(state) {
  localState.dateFrom = '';
  localState.dateTo = '';
  localState.quickDate = 'all';

  $('dateFrom').value = '';
  $('dateTo').value = '';

  document.querySelectorAll('[data-quick-date]').forEach(function (b) {
    b.classList.toggle('active', b.dataset.quickDate === 'all');
  });

  updateDateRangeInfo();
  renderHistoryList(state);
}

function applyQuickDate(type, state) {

  var today = new Date();
  var from = '';
  var to = formatDateInput(today);

  switch (type) {
    case 'today':
      from = formatDateInput(today);
      break;
    case 'yesterday':
      var yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      from = formatDateInput(yesterday);
      to = formatDateInput(yesterday);
      break;
    case 'week':
      var weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      from = formatDateInput(weekAgo);
      break;
    case 'month':
      var firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      from = formatDateInput(firstDay);
      break;
    case 'all':
      from = '';
      to = '';
      break;
  }

  localState.dateFrom = from;
  localState.dateTo = to;
  localState.quickDate = type;

  $('dateFrom').value = from;
  $('dateTo').value = to;

  document.querySelectorAll('[data-quick-date]').forEach(function (b) {
    b.classList.toggle('active', b.dataset.quickDate === type);
  });

  updateDateRangeInfo();
  renderHistoryList(state);
}

function updateDateRangeInfo() {
  var infoEl = $('dateRangeInfo');
  var textEl = $('dateRangeText');

  if (!infoEl || !textEl) return;

  if (!localState.dateFrom && !localState.dateTo) {
    infoEl.classList.remove('show');
    return;
  }

  var from = localState.dateFrom ? formatDateReadableShort(localState.dateFrom) : 'Awal';
  var to = localState.dateTo ? formatDateReadableShort(localState.dateTo) : 'Sekarang';

  textEl.textContent = from + ' — ' + to;
  infoEl.classList.add('show');
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD DATA — FAST dengan Stale-While-Revalidate
// ─────────────────────────────────────────────────────────────────────────

export async function loadHistory(state) {

  if (localState.isLoading) return;

  localState.isLoading = true;
  localState.stateRef = state;

  var list = $('historyList');
  if (!list) {
    localState.isLoading = false;
    return;
  }

  if (!localState.hasLoaded) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="loading-spinner"></div>
        <div>Memuat riwayat...</div>
      </div>
    `;
  }

  try {

    var result = await ordersApi.getAllFast(function (freshResult) {
      if (freshResult && freshResult.status === 'ok') {
        console.log('[History] Fresh data received in background');
        processOrdersData(state, freshResult.data || []);
        renderHistoryList(state);
        updateNextOrderNumber();
      }
    });

    if (result.status !== 'ok' && !result._fromCache) {
      throw new Error(result.message || 'Riwayat gagal dimuat');
    }

    processOrdersData(state, result.data || []);
    localState.hasLoaded = true;

    if (result._fromCache) {
      console.log('[History] Loaded from cache (age:', Math.round(result._cacheAge / 1000), 's)');
    }

    renderHistoryList(state);
    updateNextOrderNumber();

  } catch (error) {

    console.error('[History] Load error:', error);

    if (!localState.hasLoaded) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icon('alert-triangle', { size: 48, color: 'var(--danger)' })}</div>
          <p>Gagal memuat riwayat.</p>
          <p style="font-size: 12px; color: var(--muted); margin-top: 8px;">${error.message}</p>
          <button class="secondary-button" id="retryHistoryBtn" type="button" style="margin-top: 16px;">
            ${icon('refresh', { size: 14 })}
            Coba Lagi
          </button>
        </div>
      `;

      $('retryHistoryBtn')?.addEventListener('click', function () {
        loadHistory(state);
      });
    }

  } finally {
    localState.isLoading = false;
  }
}

function processOrdersData(state, allOrders) {

  var branchOrders = allOrders
    .filter(function (o) {
      return String(o.ID_CABANG || '').toUpperCase() === state.branchId;
    })
    .map(function (o) {
      return Object.assign({}, o, {
        _sortKey: parseAnyDate(o.TANGGAL_ORDER).getTime(),
      });
    });

  localState.orders = sortBy(branchOrders, '_sortKey', 'desc');

  window.__cabangOrdersCache = localState.orders;
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER LIST
// ─────────────────────────────────────────────────────────────────────────

function renderHistoryList(state) {

  var list = $('historyList');
  if (!list) return;

  var filtered = localState.orders;

  if (localState.filter !== 'ALL') {
    filtered = filtered.filter(function (o) {
      return String(o.STATUS || '').toUpperCase() === localState.filter;
    });
  }

  if (localState.dateFrom || localState.dateTo) {

    filtered = filtered.filter(function (o) {

      var orderDate = parseAnyDate(o.TANGGAL_ORDER);

      if (!orderDate || orderDate.getTime() === 0) {
        return false;
      }

      var orderDateOnly = new Date(
        orderDate.getFullYear(),
        orderDate.getMonth(),
        orderDate.getDate()
      );

      if (localState.dateFrom) {
        var fromParts = localState.dateFrom.split('-');
        var fromDate = new Date(
          parseInt(fromParts[0]),
          parseInt(fromParts[1]) - 1,
          parseInt(fromParts[2])
        );

        if (orderDateOnly < fromDate) return false;
      }

      if (localState.dateTo) {
        var toParts = localState.dateTo.split('-');
        var toDate = new Date(
          parseInt(toParts[0]),
          parseInt(toParts[1]) - 1,
          parseInt(toParts[2])
        );

        if (orderDateOnly > toDate) return false;
      }

      return true;
    });
  }

  if (!filtered.length) {

    var msg = 'Tidak ada order';

    if (localState.filter !== 'ALL') {
      msg += ' dengan status "' + localState.filter + '"';
    }

    if (localState.dateFrom || localState.dateTo) {
      msg += ' pada rentang tanggal yang dipilih';
    }

    msg += '.';

    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon('file', { size: 48, color: 'var(--muted)' })}</div>
        <p>${msg}</p>
        ${(localState.dateFrom || localState.dateTo) ? `
          <button class="btn-date-reset" type="button" id="btnResetDateEmpty" style="margin-top: 12px;">
            ${icon('refresh', { size: 14 })}
            Tampilkan Semua
          </button>
        ` : ''}
      </div>
    `;

    $('btnResetDateEmpty')?.addEventListener('click', function () {
      resetDateFilter(state);
    });

    return;
  }

  var countInfo = filtered.length + ' order';

  if (localState.dateFrom || localState.dateTo) {
    countInfo += ' (difilter)';
  }

  list.innerHTML = `
    <div style="padding: 0 0 8px; font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 6px;">
      ${icon('package', { size: 12 })}
      ${countInfo}
    </div>
  ` + filtered.map(buildHistoryItem).join('');

  list.querySelectorAll('[data-download-order]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      handleDownload(btn.dataset.downloadOrder);
    });
  });
}

function buildHistoryItem(order) {

  var status = String(order.STATUS || 'PENDING').toUpperCase();

  var statusClass = status === 'PENDING' ? 'status-pending'
                  : status === 'APPROVED' ? 'status-approved'
                  : 'status-rejected';

  var statusIconName = {
    PENDING: 'clock',
    APPROVED: 'check-circle',
    REJECTED: 'x-circle',
  }[status] || 'clock';

  var details = order.DETAIL || [];

    var itemText = details.length
    ? details.slice(0, 3).map(function (d) {
        var txt = escapeHtml(d.KODE_BARANG) + ' × ' + escapeHtml(d.QTY);
        if (d.CATATAN_ITEM) {
          txt += ' <span style="color:#DC2626; font-style:italic;">(' + escapeHtml(d.CATATAN_ITEM) + ')</span>';
        }
        return txt;
      }).join(', ') + (details.length > 3 ? ' +' + (details.length - 3) + ' lagi' : '')
    : 'detail tidak tersedia';

  var approvedItems = details.filter(function (d) {
    return String(d.ITEM_STATUS || 'APPROVED').toUpperCase() === 'APPROVED';
  });

  var totalHarga = approvedItems.reduce(function (s, d) {
    return s + (parseFloat(d.QTY) || 0) * (parseFloat(d.HARGA_SATUAN) || 0);
  }, 0);

  var catatanClean = cleanCatatan(order.CATATAN);

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

      ${catatanClean ? `
        <div class="history-note" style="margin-top: 4px;">
          ${icon('message', { size: 12 })}
          ${escapeHtml(catatanClean)}
        </div>
      ` : ''}

      <div class="history-actions">
        <button class="btn-download-history" type="button" data-download-order="${escapeHtml(order.ORDER_ID)}">
          ${icon('download', { size: 14 })}
          Download Form
        </button>
      </div>
    </article>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// DOWNLOAD HANDLER
// ─────────────────────────────────────────────────────────────────────────

function handleDownload(orderId) {

  var order = localState.orders.find(function (o) {
    return o.ORDER_ID === orderId;
  });

  if (!order) {
    console.error('Order not found:', orderId);
    return;
  }

  showPrintFormCabang(order);
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────

function cleanCatatan(catatan) {
  return String(catatan || '')
    .replace(/\[STOK AKTUAL\][\s\S]*/, '')
    .replace(/\[MASSAL\]\s*/, '')
    .replace(/\[FORM\][^\n]*/g, '')
    .trim();
}

function formatDateInput(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function formatDateReadableShort(dateStr) {
  if (!dateStr) return '';

  var months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];

  var parts = dateStr.split('-');

  if (parts.length < 3) return dateStr;

  var day = parseInt(parts[2]);
  var month = months[parseInt(parts[1]) - 1] || parts[1];
  var year = parts[0];

  return day + ' ' + month + ' ' + year;
}
