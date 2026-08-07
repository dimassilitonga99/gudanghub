/* ═══════════════════════════════════════════════════════════════════════
   PICKER DASHBOARD — v2 Bisa Re-edit setelah PICKED
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, parseAnyDate, sortBy } from '../utils.js';
import { orders as ordersApi, callApi, prewarmAppScript } from '../api.js';
import { requireAuth, logout } from '../session.js';
import { CABANG } from '../config.js';
import { toast, confirm } from '../ui.js';
import { icon, injectIcons } from '../icons.js';

var state = {
  session: null,
  allOrders: [],
  filter: 'ALL',
  assignedCabang: [],
};

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

  bindEvents();
  await loadOrders();
}

function bindEvents() {
  $('pickerFilter')?.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-filter]');
    if (!btn) return;

    state.filter = btn.dataset.filter;
    document.querySelectorAll('.picker-filter-btn').forEach(function (b) {
      b.classList.remove('active');
    });
    btn.classList.add('active');
    renderOrders();
  });

  $('btnLogout')?.addEventListener('click', async function () {
    var ok = await confirm({
      icon: '🚪',
      title: 'Keluar?',
      message: 'Anda akan diarahkan ke halaman login.',
      okText: 'Ya, Keluar',
      okVariant: 'danger',
    });
    if (ok) logout(true);
  });

  // Refresh button
  $('btnRefreshPicker')?.addEventListener('click', function () {
    loadOrders();
  });
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD ORDERS
// ─────────────────────────────────────────────────────────────────────────

async function loadOrders() {
  try {
    var result = await ordersApi.getAll({ cache: false });

    if (result.status !== 'ok') {
      throw new Error(result.message || 'Gagal memuat order');
    }

    var allOrders = result.data || [];

    state.allOrders = allOrders.filter(function (o) {
      var cabangId = String(o.ID_CABANG || '').toUpperCase();
      return state.assignedCabang.indexOf(cabangId) !== -1;
    });

    state.allOrders = sortBy(
      state.allOrders.map(function (o) {
        return Object.assign({}, o, {
          _sortKey: parseAnyDate(o.TANGGAL_ORDER).getTime(),
        });
      }),
      '_sortKey', 'desc'
    );

    updateStats();
    renderOrders();

  } catch (error) {
    var container = $('pickerOrders');
    if (container) {
      container.innerHTML = ''
        + '<div class="picker-empty">'
        + '<div class="picker-empty-icon">' + icon('alert-triangle', { size: 48, color: 'var(--danger)' }) + '</div>'
        + '<p>Gagal memuat: ' + error.message + '</p>'
        + '<button class="picker-filter-btn" id="btnRetry" type="button" style="margin-top: 12px;">'
        + icon('refresh', { size: 14 }) + ' Coba Lagi</button>'
        + '</div>';
      $('btnRetry')?.addEventListener('click', loadOrders);
    }
  }
}

function updateStats() {
  var pending = state.allOrders.filter(function (o) { return String(o.STATUS).toUpperCase() === 'PENDING'; }).length;
  var picked = state.allOrders.filter(function (o) { return String(o.STATUS).toUpperCase() === 'PICKED'; }).length;
  var approved = state.allOrders.filter(function (o) { return String(o.STATUS).toUpperCase() === 'APPROVED'; }).length;

  $('statPending').textContent = pending;
  $('statPicked').textContent = picked;
  $('statApproved').textContent = approved;
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
    filtered = filtered.filter(function (o) {
      return String(o.STATUS || '').toUpperCase() === state.filter;
    });
  }

  if (!filtered.length) {
    container.innerHTML = ''
      + '<div class="picker-empty">'
      + '<div class="picker-empty-icon">' + icon('package', { size: 48, color: 'var(--muted)' }) + '</div>'
      + '<p>Tidak ada order' + (state.filter !== 'ALL' ? ' dengan status "' + state.filter + '"' : '') + '.</p>'
      + '</div>';
    return;
  }

  container.innerHTML = filtered.map(buildOrderCard).join('');

  // Bind submit buttons
  container.querySelectorAll('[data-picker-submit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      submitPicked(btn.dataset.pickerSubmit);
    });
  });

  injectIcons(container);
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD ORDER CARD — Picker bisa edit PENDING & PICKED
// ─────────────────────────────────────────────────────────────────────────

function buildOrderCard(order) {

  var status = String(order.STATUS || 'PENDING').toUpperCase();
  var branch = CABANG[order.ID_CABANG] || { nama: '-', pic: '-' };
  var details = order.DETAIL || [];

  // ★ Picker bisa edit kalau PENDING atau PICKED (re-edit)
  var canEdit = (status === 'PENDING' || status === 'PICKED');

  var statusClass = status === 'PENDING' ? 'pending'
                  : status === 'PICKED' ? 'picked'
                  : status === 'APPROVED' ? 'approved'
                  : status === 'REJECTED' ? 'rejected'
                  : '';

  var statusLabel = status === 'PENDING' ? 'Menunggu Verifikasi'
                  : status === 'PICKED' ? 'Sudah Diverifikasi'
                  : status === 'APPROVED' ? 'Disetujui Admin'
                  : status === 'REJECTED' ? 'Ditolak'
                  : status;

  var statusIcon = status === 'PENDING' ? 'clock'
                 : status === 'PICKED' ? 'check-check'
                 : status === 'APPROVED' ? 'check-circle'
                 : status === 'REJECTED' ? 'x-circle'
                 : 'clock';

  // Items HTML
  var itemsHtml = details.map(function (item, idx) {
    var itemId = escapeHtml(order.ORDER_ID) + '_' + idx;
    var qtyOrder = parseInt(item.QTY) || 0;
    var stokPicker = item.STOK_PICKER !== undefined && item.STOK_PICKER !== '' ? item.STOK_PICKER : '';
    var stokGudang = item.STOK_GUDANG !== undefined && item.STOK_GUDANG !== '' ? item.STOK_GUDANG : '';

    // Tampilkan stok yang sudah diisi picker (kalau ada)
    var currentStok = stokPicker !== '' ? stokPicker : stokGudang;

    // Warna qty: merah kalau stok picker < qty order
    var qtyClass = '';
    if (stokPicker !== '' && parseInt(stokPicker) < qtyOrder) {
      qtyClass = ' style="color: var(--danger);"';
    }

    return ''
      + '<div class="picker-item">'

      // Checkbox
      + '<div class="picker-item-check">'
      + '<input type="checkbox" id="chk_' + itemId + '"'
      + ' data-order="' + escapeHtml(order.ORDER_ID) + '" data-idx="' + idx + '"'
      + (stokPicker !== '' ? ' checked' : '')
      + (canEdit ? '' : ' disabled')
      + '>'
      + '</div>'

      // Info barang
      + '<div class="picker-item-info">'
      + '<div class="picker-item-name">' + escapeHtml(item.NAMA_BARANG || '-') + '</div>'
      + '<div class="picker-item-code">' + escapeHtml(item.KODE_BARANG || '-') + ' · ' + escapeHtml(item.SATUAN || 'PCS') + '</div>'
      + '</div>'

      // Qty yang diorder cabang
      + '<div class="picker-item-qty-section">'
      + '<div class="picker-qty-label">ORDER</div>'
      + '<div class="picker-qty-value">' + qtyOrder + '</div>'
      + '</div>'

      // Stok yang disiapkan picker
      + '<div class="picker-item-stok">'
      + '<div class="picker-stok-label">DISIAPKAN</div>'
      + '<input type="number" class="picker-stok-input" min="0" placeholder="0"'
      + ' data-stok-order="' + escapeHtml(order.ORDER_ID) + '" data-stok-idx="' + idx + '"'
      + ' value="' + currentStok + '"'
      + (canEdit ? '' : ' disabled')
      + '>'
      + '</div>'

      + '</div>';
  }).join('');

  // Tombol text
  var btnText = status === 'PICKED'
    ? icon('refresh', { size: 16 }) + ' Update Verifikasi'
    : icon('check-check', { size: 16 }) + ' Kirim Verifikasi ke Admin';

  var btnClass = status === 'PICKED' ? 'btn-picker-resubmit' : 'btn-picker-submit';

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
    + '</div>'
    + '<span class="picker-order-status ' + statusClass + '">'
    + icon(statusIcon, { size: 12 }) + ' ' + statusLabel
    + '</span>'
    + '</div>'

    // Column headers
    + '<div class="picker-items-header">'
    + '<div></div>'
    + '<div>BARANG</div>'
    + '<div style="text-align:center;">ORDER</div>'
    + '<div style="text-align:center;">DISIAPKAN</div>'
    + '</div>'

    // Items
    + '<div class="picker-items">' + itemsHtml + '</div>'

    // Catatan picker (editable kalau PENDING atau PICKED)
    + (canEdit ? ''
      + '<div class="picker-note-section">'
      + '<div class="picker-note-label">'
      + icon('message', { size: 12 })
      + ' Catatan Picker'
      + '</div>'
      + '<textarea class="picker-note-input" placeholder="Tulis catatan untuk admin (opsional)..."'
      + ' data-note-order="' + escapeHtml(order.ORDER_ID) + '">'
      + escapeHtml(getPickerNote(order))
      + '</textarea>'
      + '</div>'
      : '')

    // Footer (tombol — PENDING dan PICKED bisa submit/resubmit)
    + (canEdit ? ''
      + '<div class="picker-order-footer">'
      + '<button class="' + btnClass + '" type="button" data-picker-submit="' + escapeHtml(order.ORDER_ID) + '">'
      + btnText
      + '</button>'
      + '</div>'
      : '')

    + '</article>';
}

// Ambil catatan picker dari REASON field
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
// SUBMIT / RE-SUBMIT PICKED
// ─────────────────────────────────────────────────────────────────────────

async function submitPicked(orderId) {

  var stokData = [];
  var noteEl = document.querySelector('[data-note-order="' + orderId + '"]');
  var pickerNote = noteEl ? noteEl.value.trim() : '';

  // Kumpulkan stok data
  document.querySelectorAll('[data-stok-order="' + orderId + '"]').forEach(function (input) {
    var idx = parseInt(input.dataset.stokIdx);
    stokData.push({
      index: idx,
      stokPicker: input.value.trim(),
    });
  });

  // Validasi: minimal 1 item harus diisi stok
  var filledCount = stokData.filter(function (s) { return s.stokPicker !== ''; }).length;

  if (filledCount === 0) {
    toast.warning('Isi minimal 1 stok barang yang disiapkan.', { duration: 4000 });
    return;
  }

  // Cari order untuk cek status
  var order = state.allOrders.find(function (o) { return o.ORDER_ID === orderId; });
  var isResubmit = order && String(order.STATUS).toUpperCase() === 'PICKED';

  var confirmMsg = isResubmit
    ? 'Update verifikasi order ' + orderId + '?\n\nPerubahan akan langsung terkirim ke Admin.'
    : 'Kirim verifikasi order ' + orderId + ' ke Admin?\n\nStatus akan berubah menjadi PICKED.';

  var ok = await confirm({
    icon: isResubmit ? '🔄' : '📋',
    title: isResubmit ? 'Update Verifikasi?' : 'Kirim Verifikasi?',
    message: confirmMsg,
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
    }, {
      dedupe: false,
      timeout: 30000,
    });

    if (result.status !== 'ok') {
      toast.error(result.message || 'Gagal mengirim verifikasi.');
      return;
    }

    toast.success(isResubmit ? 'Verifikasi berhasil diupdate!' : 'Verifikasi berhasil dikirim!', { duration: 4000 });

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
