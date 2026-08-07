/* ═══════════════════════════════════════════════════════════════════════
   PICKER DASHBOARD — v3 Lock Input + Edit History + Konfirmasi
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
  assignedCabang: [],
  pickerData: {},  // { orderId_idx: { value, locked, history: [{value, time, action}] } }
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

  // Load picker data dari localStorage
  state.pickerData = loadPickerData();

  bindEvents();
  await loadOrders();
}

function bindEvents() {
  $('pickerFilter')?.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    document.querySelectorAll('.picker-filter-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    renderOrders();
  });

  $('btnLogout')?.addEventListener('click', async function () {
    var ok = await confirmDialog({ icon: '🚪', title: 'Keluar?', message: 'Anda akan diarahkan ke halaman login.', okText: 'Ya, Keluar', okVariant: 'danger' });
    if (ok) logout(true);
  });

  $('btnRefreshPicker')?.addEventListener('click', function () { loadOrders(); });
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

    updateStats();
    renderOrders();
  } catch (error) {
    var container = $('pickerOrders');
    if (container) {
      container.innerHTML = '<div class="picker-empty"><p>Gagal: ' + error.message + '</p>'
        + '<button class="picker-filter-btn" id="btnRetry" type="button" style="margin-top:12px;">'
        + icon('refresh', { size: 14 }) + ' Coba Lagi</button></div>';
      $('btnRetry')?.addEventListener('click', loadOrders);
    }
  }
}

function updateStats() {
  var p = 0, pk = 0, a = 0;
  state.allOrders.forEach(function (o) {
    var s = String(o.STATUS).toUpperCase();
    if (s === 'PENDING') p++;
    else if (s === 'PICKED') pk++;
    else if (s === 'APPROVED') a++;
  });
  $('statPending').textContent = p;
  $('statPicked').textContent = pk;
  $('statApproved').textContent = a;
  $('statTotal').textContent = state.allOrders.length;
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER ORDERS
// ─────────────────────────────────────────────────────────────────────────

function renderOrders() {
  var container = $('pickerOrders');
  if (!container) return;

  var filtered = state.allOrders;
  if (state.filter !== 'ALL') {
    filtered = filtered.filter(function (o) { return String(o.STATUS || '').toUpperCase() === state.filter; });
  }

  if (!filtered.length) {
    container.innerHTML = '<div class="picker-empty"><div class="picker-empty-icon">'
      + icon('package', { size: 48, color: 'var(--muted)' }) + '</div><p>Tidak ada order.</p></div>';
    return;
  }

  container.innerHTML = filtered.map(buildOrderCard).join('');
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

  return ''
    + '<article class="picker-order-card ' + statusClass + '">'
    + '<div class="picker-order-header">'
    + '<div>'
    + '<div class="picker-order-id">' + escapeHtml(order.ORDER_ID) + '</div>'
    + '<div class="picker-order-meta">'
    + icon('store', { size: 12 }) + ' ' + escapeHtml(branch.nama || order.ID_CABANG)
    + ' · PIC: ' + escapeHtml(branch.pic || '-')
    + ' · ' + icon('calendar-clock', { size: 12 }) + ' ' + escapeHtml(formatWita(order.TANGGAL_ORDER, false))
    + ' · ' + details.length + ' item'
    + '</div></div>'
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
// BUILD ITEM ROW — dengan Lock, History, Status Visual
// ─────────────────────────────────────────────────────────────────────────

function buildItemRow(order, item, idx, canEdit) {
  var orderId = order.ORDER_ID;
  var itemData = getItemData(orderId, idx);

  var qtyOrder = parseInt(item.QTY) || 0;

  // Prioritas: pickerData lokal > server STOK_PICKER > kosong
  var serverPicker = item.STOK_PICKER !== undefined && item.STOK_PICKER !== '' ? String(item.STOK_PICKER) : '';
  var currentValue = itemData.value !== '' ? itemData.value : serverPicker;
  var isLocked = itemData.locked || (serverPicker !== '' && itemData.value === '');
  var isFilled = currentValue !== '';
  var editCount = itemData.history.length;

  // Sync dari server kalau lokal kosong
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
    statusHtml = '<div class="picker-status-icon locked" title="Terkunci — sudah diisi">' + icon('check-circle', { size: 18 }) + '</div>';
  } else if (isFilled && !isLocked) {
    statusHtml = '<div class="picker-status-icon editing" title="Sedang diedit">' + icon('edit-2', { size: 18 }) + '</div>';
  } else {
    statusHtml = '<div class="picker-status-icon empty" title="Belum diisi">' + icon('circle', { size: 18 }) + '</div>';
  }

  // Warna qty: merah kalau picker < order
  var pickerInt = parseInt(currentValue) || 0;
  var qtyColor = isFilled && pickerInt < qtyOrder ? 'var(--danger)' : isFilled ? 'var(--success)' : 'var(--orange)';

  // History tooltip
  var historyHtml = '';
  if (editCount > 0) {
    var lastEntry = itemData.history[itemData.history.length - 1];
    historyHtml = ''
      + '<div class="picker-history-badge" title="' + buildHistoryTooltip(itemData.history) + '">'
      + (editCount === 1 ? '1x' : editCount + 'x')
      + '<br><span class="picker-history-time">' + escapeHtml(lastEntry.time) + '</span>'
      + '</div>';
  } else {
    historyHtml = '<div class="picker-history-badge empty">-</div>';
  }

  var escOrderId = escapeHtml(orderId);

  return ''
    + '<div class="picker-item ' + (isLocked ? 'locked' : '') + ' ' + (isFilled ? 'filled' : '') + '">'

    // Status icon
    + '<div class="picker-item-status">' + statusHtml + '</div>'

    // Info barang
    + '<div class="picker-item-info">'
    + '<div class="picker-item-name">' + escapeHtml(item.NAMA_BARANG || '-') + '</div>'
    + '<div class="picker-item-code">' + escapeHtml(item.KODE_BARANG || '-') + ' · ' + escapeHtml(item.SATUAN || 'PCS') + '</div>'
    + '</div>'

    // Qty order
    + '<div class="picker-item-qty-section">'
    + '<div class="picker-qty-value" style="color: var(--orange);">' + qtyOrder + '</div>'
    + '</div>'

    // Input disiapkan (dengan lock)
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

    // History
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

  // Input stok — auto lock setelah blur (keluar dari input)
  container.querySelectorAll('.picker-stok-input').forEach(function (input) {
    input.addEventListener('blur', function () {
      if (input.readOnly || input.disabled) return;

      var orderId = input.dataset.stokOrder;
      var idx = parseInt(input.dataset.stokIdx);
      var value = input.value.trim();

      if (value !== '') {
        setItemValue(orderId, idx, value);
        input.readOnly = true;
        input.classList.add('filled');

        // Re-render item row
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

  // Unlock button — konfirmasi sebelum edit
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

  // Lock button (manual lock)
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
