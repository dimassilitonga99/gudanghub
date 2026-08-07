/* ═══════════════════════════════════════════════════════════════════════
   PICKER DASHBOARD — v4 Lock Input + History + Filter Toko & Tanggal
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, parseAnyDate, sortBy } from '../utils.js';
import { orders as ordersApi, callApi, prewarmAppScript } from '../api.js';
import { requireAuth, logout } from '../session.js';
import { CABANG } from '../config.js';
import { toast, confirm as confirmDialog } from '../ui.js';
import { icon, injectIcons } from '../icons.js';

var state = {
  session: null,
  allOrders: [],
  filter: 'ALL',
  filterToko: '',
  filterDateFrom: '',
  filterDateTo: '',
  filterQuick: 'month',
  assignedCabang: [],
  pickerData: {},
};

var PICKER_DATA_KEY = 'gudanghub_picker_data';

// ─────────────────────────────────────────────────────────────────────────
// PICKER DATA PERSISTENCE (localStorage)
// ─────────────────────────────────────────────────────────────────────────

function loadPickerData() {
  try {
    var raw = localStorage.getItem(PICKER_DATA_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch { return {}; }
}

function savePickerData() {
  try {
    localStorage.setItem(PICKER_DATA_KEY, JSON.stringify(state.pickerData));
  } catch {}
}

function getItemData(orderId, idx) {
  var key = orderId + '_' + idx;
  if (!state.pickerData[key]) {
    state.pickerData[key] = {
      value: '',
      locked: false,
      history: [],
    };
  }
  return state.pickerData[key];
}

function setItemValue(orderId, idx, value) {
  var data = getItemData(orderId, idx);
  var now = new Date();
  var timeStr = padZ(now.getHours()) + ':' + padZ(now.getMinutes()) + ':' + padZ(now.getSeconds());
  var dateStr = padZ(now.getDate()) + '/' + padZ(now.getMonth() + 1);

  var action = data.history.length === 0 ? 'Diisi pertama' : 'Diedit ke-' + data.history.length;

  data.value = value;
  data.locked = true;
  data.history.push({
    value: value,
    time: dateStr + ' ' + timeStr,
    action: action,
  });

  savePickerData();
}

function unlockItem(orderId, idx) {
  var data = getItemData(orderId, idx);
  data.locked = false;
  savePickerData();
}

function padZ(n) { return String(n).padStart(2, '0'); }

// ─────────────────────────────────────────────────────────────────────────
// FILTER HELPERS
// ─────────────────────────────────────────────────────────────────────────

function populateTokoFilter() {
  var select = $('filterToko');
  if (!select) return;

  // Hitung order per cabang
  var counts = {};
  state.allOrders.forEach(function (o) {
    var id = String(o.ID_CABANG || '').toUpperCase();
    counts[id] = (counts[id] || 0) + 1;
  });

  var html = '<option value="">Semua Toko (' + state.assignedCabang.length + ' cabang, ' + state.allOrders.length + ' order)</option>';

  state.assignedCabang.forEach(function (cabangId) {
    var info = CABANG[cabangId] || {};
    var nama = info.nama || cabangId;
    var count = counts[cabangId] || 0;
    var selected = state.filterToko === cabangId ? ' selected' : '';
    html += '<option value="' + cabangId + '"' + selected + '>'
      + cabangId + ' — ' + escapeHtml(nama) + ' (' + count + ' order)'
      + '</option>';
  });

  select.innerHTML = html;
}

function applyQuickDate(type) {
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

  state.filterDateFrom = from;
  state.filterDateTo = to;
  state.filterQuick = type;

  var dateFromEl = $('filterDateFrom');
  var dateToEl = $('filterDateTo');
  if (dateFromEl) dateFromEl.value = from;
  if (dateToEl) dateToEl.value = to;

  document.querySelectorAll('[data-quick]').forEach(function (b) {
    b.classList.toggle('active', b.dataset.quick === type);
  });

  renderOrders();
}

function clearQuickActive() {
  state.filterQuick = '';
  document.querySelectorAll('[data-quick]').forEach(function (b) {
    b.classList.remove('active');
  });
}

function formatDateInput(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function getFilteredOrders() {
  var filtered = state.allOrders;

  // Filter status
  if (state.filter !== 'ALL') {
    filtered = filtered.filter(function (o) {
      return String(o.STATUS || '').toUpperCase() === state.filter;
    });
  }

  // Filter toko
  if (state.filterToko) {
    filtered = filtered.filter(function (o) {
      return String(o.ID_CABANG || '').toUpperCase() === state.filterToko;
    });
  }

  // Filter tanggal
  if (state.filterDateFrom || state.filterDateTo) {
    filtered = filtered.filter(function (o) {
      var orderDate = parseAnyDate(o.TANGGAL_ORDER);
      if (!orderDate || orderDate.getTime() === 0) return false;

      var orderDateOnly = new Date(
        orderDate.getFullYear(),
        orderDate.getMonth(),
        orderDate.getDate()
      );

      if (state.filterDateFrom) {
        var fromParts = state.filterDateFrom.split('-');
        var fromDate = new Date(parseInt(fromParts[0]), parseInt(fromParts[1]) - 1, parseInt(fromParts[2]));
        if (orderDateOnly < fromDate) return false;
      }

      if (state.filterDateTo) {
        var toParts = state.filterDateTo.split('-');
        var toDate = new Date(parseInt(toParts[0]), parseInt(toParts[1]) - 1, parseInt(toParts[2]));
        if (orderDateOnly > toDate) return false;
      }

      return true;
    });
  }

  return filtered;
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {
  prewarmAppScript();

  state.session = requireAuth();
  if (!state.session) return;

  if (state.session.role !== 'picker') {
    window.location.href = './login.html';
    return;
  }

  injectIcons();

  var nameEl = $('pickerUserName');
  if (nameEl) nameEl.textContent = state.session.nama || state.session.username;

  var idCabangRaw = String(state.session.idCabang || '').trim().toUpperCase();
  if (idCabangRaw) {
    state.assignedCabang = idCabangRaw.split(',').map(function (c) { return c.trim(); }).filter(Boolean);
  } else {
    state.assignedCabang = Object.keys(CABANG);
  }

  state.pickerData = loadPickerData();

  bindEvents();
  await loadOrders();
}

// ─────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {

  // Status filter
  $('pickerFilter')?.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    document.querySelectorAll('.picker-filter-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderOrders();
  });

  // Logout
  $('btnLogout')?.addEventListener('click', async function () {
    var ok = await confirmDialog({ icon: '🚪', title: 'Keluar?', message: 'Anda akan diarahkan ke halaman login.', okText: 'Ya, Keluar', okVariant: 'danger' });
    if (ok) logout(true);
  });

  // Refresh
  $('btnRefreshPicker')?.addEventListener('click', function () { loadOrders(); });

  // Filter toko
  $('filterToko')?.addEventListener('change', function (e) {
    state.filterToko = e.target.value;
    renderOrders();
  });

  // Filter tanggal manual
  $('filterDateFrom')?.addEventListener('change', function () {
    state.filterDateFrom = $('filterDateFrom').value;
    clearQuickActive();
    renderOrders();
  });

  $('filterDateTo')?.addEventListener('change', function () {
    state.filterDateTo = $('filterDateTo').value;
    clearQuickActive();
    renderOrders();
  });

  // Quick date buttons
  document.querySelectorAll('[data-quick]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyQuickDate(btn.dataset.quick);
    });
  });

  // Enter key di date input
  $('filterDateFrom')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { clearQuickActive(); renderOrders(); }
  });

  $('filterDateTo')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { clearQuickActive(); renderOrders(); }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD ORDERS
// ─────────────────────────────────────────────────────────────────────────

async function loadOrders() {
  try {
    var result = await ordersApi.getAll({ cache: false });
    if (result.status !== 'ok') throw new Error(result.message || 'Gagal memuat');

    state.allOrders = (result.data || []).filter(function (o) {
      return state.assignedCabang.indexOf(String(o.ID_CABANG || '').toUpperCase()) !== -1;
    });

    state.allOrders = sortBy(
      state.allOrders.map(function (o) {
        return Object.assign({}, o, { _sortKey: parseAnyDate(o.TANGGAL_ORDER).getTime() });
      }), '_sortKey', 'desc'
    );

    // Populate toko filter
    populateTokoFilter();

    // Apply default quick date (bulan ini)
    applyQuickDate(state.filterQuick || 'month');

  } catch (error) {
    var container = $('pickerOrders');
    if (container) {
      container.innerHTML = '<div class="picker-empty">'
        + '<div class="picker-empty-icon">' + icon('alert-triangle', { size: 48, color: 'var(--danger)' }) + '</div>'
        + '<p>Gagal: ' + escapeHtml(error.message) + '</p>'
        + '<button class="picker-filter-btn" id="btnRetry" type="button" style="margin-top:12px;">'
        + icon('refresh', { size: 14 }) + ' Coba Lagi</button></div>';
      $('btnRetry')?.addEventListener('click', loadOrders);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE STATS (based on filtered)
// ─────────────────────────────────────────────────────────────────────────

function updateStats() {
  var filtered = getFilteredOrders();

  var pending = 0;
  var picked = 0;
  var approved = 0;
  var rejected = 0;

  filtered.forEach(function (o) {
    var s = String(o.STATUS).toUpperCase();
    if (s === 'PENDING') pending++;
    else if (s === 'PICKED') picked++;
    else if (s === 'APPROVED') approved++;
    else if (s === 'REJECTED') rejected++;
  });

  $('statPending').textContent = pending;
  $('statPicked').textContent = picked;
  $('statApproved').textContent = approved;
  $('statTotal').textContent = filtered.length;
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER ORDERS
// ─────────────────────────────────────────────────────────────────────────

function renderOrders() {
  updateStats();

  var container = $('pickerOrders');
  if (!container) return;

  var filtered = getFilteredOrders();

  if (!filtered.length) {
    var emptyMsg = 'Tidak ada order';
    if (state.filter !== 'ALL') emptyMsg += ' status "' + state.filter + '"';
    if (state.filterToko) {
      var tokoInfo = CABANG[state.filterToko];
      emptyMsg += ' dari ' + (tokoInfo ? tokoInfo.nama : state.filterToko);
    }
    if (state.filterDateFrom || state.filterDateTo) emptyMsg += ' pada periode terpilih';
    emptyMsg += '.';

    container.innerHTML = '<div class="picker-empty">'
      + '<div class="picker-empty-icon">' + icon('package', { size: 48, color: 'var(--muted)' }) + '</div>'
      + '<p>' + emptyMsg + '</p>'
      + '</div>';
    return;
  }

  // Info jumlah
  var countInfo = filtered.length + ' order';
  if (state.filterToko || state.filterDateFrom || state.filterDateTo || state.filter !== 'ALL') {
    countInfo += ' (difilter)';
  }

  container.innerHTML = ''
    + '<div style="padding: 0 0 8px; font-size: 11px; color: var(--muted); display: flex; align-items: center; gap: 6px;">'
    + icon('package', { size: 12 })
    + countInfo
    + '</div>'
    + filtered.map(buildOrderCard).join('');

  bindCardEvents(container);
  injectIcons(container);
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD ORDER CARD
// ─────────────────────────────────────────────────────────────────────────

function buildOrderCard(order) {
  var status = String(order.STATUS || 'PENDING').toUpperCase();
  var branch = CABANG[order.ID_CABANG] || { nama: '-', pic: '-' };
  var details = order.DETAIL || [];
  var canEdit = (status === 'PENDING' || status === 'PICKED');

  var statusClass = status === 'PENDING' ? 'pending' : status === 'PICKED' ? 'picked' : status === 'APPROVED' ? 'approved' : status === 'REJECTED' ? 'rejected' : '';
  var statusLabel = status === 'PENDING' ? 'Menunggu' : status === 'PICKED' ? 'Sudah Diverifikasi' : status === 'APPROVED' ? 'Disetujui' : status === 'REJECTED' ? 'Ditolak' : status;
  var statusIconName = status === 'PENDING' ? 'clock' : status === 'PICKED' ? 'check-check' : status === 'APPROVED' ? 'check-circle' : 'x-circle';

  var itemsHtml = details.map(function (item, idx) {
    return buildItemRow(order, item, idx, canEdit);
  }).join('');

  var btnText = status === 'PICKED'
    ? icon('refresh', { size: 16 }) + ' Update Verifikasi'
    : icon('check-check', { size: 16 }) + ' Kirim Verifikasi ke Admin';
  var btnClass = status === 'PICKED' ? 'btn-picker-resubmit' : 'btn-picker-submit';

  // Hitung progress
  var totalItems = details.length;
  var filledItems = 0;
  details.forEach(function (item, idx) {
    var data = getItemData(order.ORDER_ID, idx);
    var serverPicker = item.STOK_PICKER !== undefined && item.STOK_PICKER !== '' ? String(item.STOK_PICKER) : '';
    if (data.value !== '' || serverPicker !== '') filledItems++;
  });

  var progressPct = totalItems > 0 ? Math.round((filledItems / totalItems) * 100) : 0;
  var progressColor = progressPct === 100 ? 'var(--success)' : progressPct > 0 ? '#3b82f6' : 'var(--muted)';

  return ''
    + '<article class="picker-order-card ' + statusClass + '">'

    // Header
    + '<div class="picker-order-header">'
    + '<div>'
    + '<div class="picker-order-id">' + escapeHtml(order.ORDER_ID) + '</div>'
    + '<div class="picker-order-meta">'
    + icon('store', { size: 12 }) + ' ' + escapeHtml(branch.nama || order.ID_CABANG)
    + ' · PIC: ' + escapeHtml(branch.pic || '-')
    + ' · ' + icon('calendar-clock', { size: 12 }) + ' ' + escapeHtml(formatWita(order.TANGGAL_ORDER, false))
    + ' · ' + details.length + ' item'
    + '</div>'
    // Progress bar
    + '<div class="picker-progress">'
    + '<div class="picker-progress-bar" style="width: ' + progressPct + '%; background: ' + progressColor + ';"></div>'
    + '</div>'
    + '<div class="picker-progress-text" style="color: ' + progressColor + ';">'
    + filledItems + '/' + totalItems + ' diisi (' + progressPct + '%)'
    + '</div>'
    + '</div>'
    + '<span class="picker-order-status ' + statusClass + '">'
    + icon(statusIconName, { size: 12 }) + ' ' + statusLabel + '</span>'
    + '</div>'

    // Column headers
    + '<div class="picker-items-header">'
    + '<div>STATUS</div>'
    + '<div>BARANG</div>'
    + '<div style="text-align:center;">ORDER</div>'
    + '<div style="text-align:center;">DISIAPKAN</div>'
    + '<div style="text-align:center;">RIWAYAT</div>'
    + '</div>'

    + '<div class="picker-items">' + itemsHtml + '</div>'

    // Catatan
    + (canEdit ? ''
      + '<div class="picker-note-section">'
      + '<div class="picker-note-label">' + icon('message', { size: 12 }) + ' Catatan Picker</div>'
      + '<textarea class="picker-note-input" placeholder="Tulis catatan untuk admin..."'
      + ' data-note-order="' + escapeHtml(order.ORDER_ID) + '">' + escapeHtml(getPickerNote(order)) + '</textarea>'
      + '</div>' : '')

    // Submit
    + (canEdit ? ''
      + '<div class="picker-order-footer">'
      + '<button class="' + btnClass + '" type="button" data-picker-submit="' + escapeHtml(order.ORDER_ID) + '">'
      + btnText + '</button></div>' : '')

    + '</article>';
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD ITEM ROW
// ─────────────────────────────────────────────────────────────────────────

function buildItemRow(order, item, idx, canEdit) {
  var orderId = order.ORDER_ID;
  var itemData = getItemData(orderId, idx);

  var qtyOrder = parseInt(item.QTY) || 0;

  var serverPicker = item.STOK_PICKER !== undefined && item.STOK_PICKER !== '' ? String(item.STOK_PICKER) : '';
  var currentValue = itemData.value !== '' ? itemData.value : serverPicker;
  var isLocked = itemData.locked || (serverPicker !== '' && itemData.value === '');
  var isFilled = currentValue !== '';
  var editCount = itemData.history.length;

  if (itemData.value === '' && serverPicker !== '') {
    itemData.value = serverPicker;
    itemData.locked = true;
    if (itemData.history.length === 0) {
      itemData.history.push({ value: serverPicker, time: 'dari server', action: 'Sinkron' });
    }
    savePickerData();
  }

  // Status visual
  var statusHtml = '';
  if (isFilled && isLocked) {
    statusHtml = '<div class="picker-status-icon locked" title="Terkunci">' + icon('check-circle', { size: 18 }) + '</div>';
  } else if (isFilled && !isLocked) {
    statusHtml = '<div class="picker-status-icon editing" title="Sedang diedit">' + icon('edit-2', { size: 18 }) + '</div>';
  } else {
    statusHtml = '<div class="picker-status-icon empty" title="Belum diisi">' + icon('circle', { size: 18 }) + '</div>';
  }

  var pickerInt = parseInt(currentValue) || 0;
  var qtyColor = isFilled && pickerInt < qtyOrder ? 'var(--danger)' : isFilled ? 'var(--success)' : 'var(--orange)';

  // History
  var historyHtml = '';
  if (editCount > 0) {
    var lastEntry = itemData.history[itemData.history.length - 1];
    historyHtml = '<div class="picker-history-badge" title="' + escapeHtml(buildHistoryTooltip(itemData.history)) + '">'
      + (editCount === 1 ? '1x' : editCount + 'x')
      + '<br><span class="picker-history-time">' + escapeHtml(lastEntry.time) + '</span>'
      + '</div>';
  } else {
    historyHtml = '<div class="picker-history-badge empty">-</div>';
  }

  var escOrderId = escapeHtml(orderId);

  return ''
    + '<div class="picker-item ' + (isLocked ? 'locked' : '') + ' ' + (isFilled ? 'filled' : '') + '">'

    + '<div class="picker-item-status">' + statusHtml + '</div>'

    + '<div class="picker-item-info">'
    + '<div class="picker-item-name">' + escapeHtml(item.NAMA_BARANG || '-') + '</div>'
    + '<div class="picker-item-code">' + escapeHtml(item.KODE_BARANG || '-') + ' · ' + escapeHtml(item.SATUAN || 'PCS') + '</div>'
    + '</div>'

    + '<div class="picker-item-qty-section">'
    + '<div class="picker-qty-value" style="color: var(--orange);">' + qtyOrder + '</div>'
    + '</div>'

    + '<div class="picker-item-stok">'
    + '<div class="picker-stok-input-wrap ' + (isLocked ? 'is-locked' : '') + '">'
    + '<input type="number" class="picker-stok-input ' + (isFilled ? 'filled' : '') + '"'
    + ' min="0" placeholder="0"'
    + ' data-stok-order="' + escOrderId + '" data-stok-idx="' + idx + '"'
    + ' value="' + currentValue + '"'
    + ' style="color: ' + qtyColor + ';"'
    + (isLocked && canEdit ? ' readonly' : '')
    + (canEdit ? '' : ' disabled')
    + '>'
    + (isLocked && canEdit
      ? '<button class="picker-unlock-btn" type="button" data-unlock-order="' + escOrderId + '" data-unlock-idx="' + idx + '" title="Edit kembali">'
        + icon('lock', { size: 12 }) + '</button>'
      : '')
    + (!isLocked && canEdit && isFilled
      ? '<button class="picker-lock-btn" type="button" data-lock-order="' + escOrderId + '" data-lock-idx="' + idx + '" title="Kunci">'
        + icon('check', { size: 12 }) + '</button>'
      : '')
    + '</div>'
    + '</div>'

    + '<div class="picker-item-history">' + historyHtml + '</div>'

    + '</div>';
}

function buildHistoryTooltip(history) {
  return history.map(function (h, i) {
    return (i + 1) + '. ' + h.action + ': ' + h.value + ' (' + h.time + ')';
  }).join('\n');
}

function getPickerNote(order) {
  var details = order.DETAIL || [];
  for (var i = 0; i < details.length; i++) {
    var reason = String(details[i].REASON || '');
    var match = reason.match(/\[PICKER\]\s*(.*)/);
    if (match) return match[1].trim();
  }
  return '';
}

// ─────────────────────────────────────────────────────────────────────────
// BIND CARD EVENTS
// ─────────────────────────────────────────────────────────────────────────

function bindCardEvents(container) {

  // Input stok — auto lock setelah blur
  container.querySelectorAll('.picker-stok-input').forEach(function (input) {
    input.addEventListener('blur', function () {
      if (input.readOnly || input.disabled) return;

      var orderId = input.dataset.stokOrder;
      var idx = parseInt(input.dataset.stokIdx);
      var value = input.value.trim();

      if (value !== '') {
        setItemValue(orderId, idx, value);
        renderOrders();
        toast.success('Item dikunci ✓', { duration: 1000 });
      }
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      }
    });
  });

  // Unlock button
  container.querySelectorAll('[data-unlock-order]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var orderId = btn.dataset.unlockOrder;
      var idx = parseInt(btn.dataset.unlockIdx);
      var itemData = getItemData(orderId, idx);

      var ok = await confirmDialog({
        icon: '🔓',
        title: 'Edit Kembali?',
        message: 'Item ini sudah dikunci dengan nilai: ' + itemData.value + '\n\n'
          + 'Riwayat edit: ' + itemData.history.length + ' kali\n\n'
          + 'Apakah Anda yakin ingin mengedit kembali?',
        okText: 'Ya, Edit',
        okVariant: 'info',
      });

      if (!ok) return;

      unlockItem(orderId, idx);
      renderOrders();
      toast.info('Input terbuka — silakan edit.', { duration: 2000 });
    });
  });

  // Lock button
  container.querySelectorAll('[data-lock-order]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var orderId = btn.dataset.lockOrder;
      var idx = parseInt(btn.dataset.lockIdx);
      var input = document.querySelector('[data-stok-order="' + orderId + '"][data-stok-idx="' + idx + '"]');

      if (input && input.value.trim() !== '') {
        setItemValue(orderId, idx, input.value.trim());
        renderOrders();
        toast.success('Item dikunci ✓', { duration: 1000 });
      }
    });
  });

  // Submit buttons
  container.querySelectorAll('[data-picker-submit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      submitPicked(btn.dataset.pickerSubmit);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMIT PICKED
// ─────────────────────────────────────────────────────────────────────────

async function submitPicked(orderId) {

  var order = state.allOrders.find(function (o) { return o.ORDER_ID === orderId; });
  if (!order) return;

  var details = order.DETAIL || [];
  var stokData = [];
  var filledCount = 0;

  details.forEach(function (item, idx) {
    var data = getItemData(orderId, idx);
    var value = data.value || '';

    stokData.push({
      index: idx,
      stokPicker: value,
      editCount: data.history.length,
      lastEdit: data.history.length > 0 ? data.history[data.history.length - 1].time : '',
    });

    if (value !== '') filledCount++;
  });

  if (filledCount === 0) {
    toast.warning('Isi minimal 1 stok barang.', { duration: 4000 });
    return;
  }

  // Cek ada yang belum dikunci
  var unlockedCount = 0;
  details.forEach(function (item, idx) {
    var data = getItemData(orderId, idx);
    if (data.value !== '' && !data.locked) unlockedCount++;
  });

  if (unlockedCount > 0) {
    toast.warning(unlockedCount + ' item belum dikunci. Kunci semua sebelum submit.', { duration: 4000 });
    return;
  }

  var noteEl = document.querySelector('[data-note-order="' + orderId + '"]');
  var pickerNote = noteEl ? noteEl.value.trim() : '';

  var isResubmit = String(order.STATUS).toUpperCase() === 'PICKED';

  var ok = await confirmDialog({
    icon: isResubmit ? '🔄' : '📋',
    title: isResubmit ? 'Update Verifikasi?' : 'Kirim Verifikasi?',
    message: 'Order ' + orderId + '\n\n'
      + filledCount + ' dari ' + details.length + ' item sudah diisi.\n\n'
      + (isResubmit ? 'Perubahan akan langsung terkirim ke Admin.' : 'Status akan berubah menjadi PICKED.'),
    okText: isResubmit ? 'Ya, Update' : 'Ya, Kirim',
    okVariant: 'info',
  });

  if (!ok) return;

  try {
    toast.info('Mengirim...', { duration: 10000 });

    var result = await callApi('pickerVerify', {
      orderId: orderId,
      pickerUsername: state.session.username,
      pickerNama: state.session.nama || state.session.username,
      stokData: stokData,
      pickerNote: pickerNote,
    }, { dedupe: false, timeout: 30000 });

    if (result.status !== 'ok') {
      toast.error(result.message || 'Gagal.');
      return;
    }

    toast.success(isResubmit ? 'Verifikasi diupdate!' : 'Verifikasi dikirim!', { duration: 4000 });
    await loadOrders();

  } catch (error) {
    toast.error('Gagal: ' + error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
