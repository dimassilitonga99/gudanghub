/* ═══════════════════════════════════════════════════════════════════════
   PICKER DASHBOARD — Verifikasi order sebelum ke Admin
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
  assignedCabang: [],  // cabang yang ditangani picker ini
};

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {

  prewarmAppScript();

  state.session = requireAuth();
  if (!state.session) return;

  // Validasi role picker
  if (state.session.role !== 'picker') {
    window.location.href = './login.html';
    return;
  }

  injectIcons();

  // Set user info
  var nameEl = $('pickerUserName');
  if (nameEl) nameEl.textContent = state.session.nama || state.session.username;

  // Parse assigned cabang (dari idCabang, bisa multi: "CB001,CB002")
  var idCabangRaw = String(state.session.idCabang || '').trim().toUpperCase();
  if (idCabangRaw) {
    state.assignedCabang = idCabangRaw.split(',').map(function (c) { return c.trim(); }).filter(Boolean);
  } else {
    // Kalau kosong → handle semua cabang
    state.assignedCabang = Object.keys(CABANG);
  }

  bindEvents();
  await loadOrders();
}

// ─────────────────────────────────────────────────────────────────────────
// EVENTS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {

  // Filter
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

  // Logout
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

    // Filter hanya order dari cabang yang ditangani picker ini
    state.allOrders = allOrders.filter(function (o) {
      var cabangId = String(o.ID_CABANG || '').toUpperCase();
      return state.assignedCabang.indexOf(cabangId) !== -1;
    });

    // Sort terbaru dulu
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
        + '<p>Gagal memuat order: ' + error.message + '</p>'
        + '<button class="picker-filter-btn" id="btnRetry" type="button" style="margin-top: 12px;">'
        + icon('refresh', { size: 14 }) + ' Coba Lagi</button>'
        + '</div>';

      $('btnRetry')?.addEventListener('click', loadOrders);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────

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

  container.innerHTML = filtered.map(function (order) {
    return buildOrderCard(order);
  }).join('');

  // Bind events di setiap card
  container.querySelectorAll('[data-picker-submit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      submitPicked(btn.dataset.pickerSubmit);
    });
  });

  injectIcons(container);
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD ORDER CARD
// ─────────────────────────────────────────────────────────────────────────

function buildOrderCard(order) {

  var status = String(order.STATUS || 'PENDING').toUpperCase();
  var branch = CABANG[order.ID_CABANG] || { nama: '-', pic: '-' };
  var details = order.DETAIL || [];
  var isPending = (status === 'PENDING');
  var isPicked = (status === 'PICKED');

  var statusClass = status === 'PENDING' ? 'pending' : status === 'PICKED' ? 'picked' : '';
  var statusLabel = status === 'PENDING' ? 'Menunggu Verifikasi'
                  : status === 'PICKED' ? 'Sudah Diverifikasi'
                  : status === 'APPROVED' ? 'Disetujui Admin'
                  : status === 'REJECTED' ? 'Ditolak'
                  : status;

  // Items HTML
  var itemsHtml = details.map(function (item, idx) {
    var itemId = escapeHtml(order.ORDER_ID) + '_' + idx;
    return ''
      + '<div class="picker-item">'
      + '<div class="picker-item-check">'
      + '<input type="checkbox" id="chk_' + itemId + '" data-order="' + escapeHtml(order.ORDER_ID) + '" data-idx="' + idx + '"'
      + (isPending ? '' : ' checked disabled')
      + '>'
      + '</div>'
      + '<div class="picker-item-info">'
      + '<div class="picker-item-name">' + escapeHtml(item.NAMA_BARANG || '-') + '</div>'
      + '<div class="picker-item-code">' + escapeHtml(item.KODE_BARANG || '-') + ' · ' + escapeHtml(item.SATUAN || 'PCS') + '</div>'
      + '</div>'
      + '<div class="picker-item-qty">' + (item.QTY || 0) + '</div>'
      + '<div class="picker-item-stok">'
      + '<div class="picker-stok-label">Stok Real</div>'
      + '<input type="number" class="picker-stok-input" min="0" placeholder="0"'
      + ' data-stok-order="' + escapeHtml(order.ORDER_ID) + '" data-stok-idx="' + idx + '"'
      + ' value="' + (item.STOK_GUDANG || '') + '"'
      + (isPending ? '' : ' disabled')
      + '>'
      + '</div>'
      + '</div>';
  }).join('');

  return ''
    + '<article class="picker-order-card ' + (isPicked ? 'picked' : '') + '">'

    // Header
    + '<div class="picker-order-header">'
    + '<div>'
    + '<div class="picker-order-id">' + escapeHtml(order.ORDER_ID) + '</div>'
    + '<div class="picker-order-meta">'
    + icon('store', { size: 12 }) + ' ' + escapeHtml(branch.nama || order.ID_CABANG)
    + ' · ' + icon('calendar-clock', { size: 12 }) + ' ' + escapeHtml(formatWita(order.TANGGAL_ORDER, false))
    + ' · ' + details.length + ' item'
    + '</div>'
    + '</div>'
    + '<span class="picker-order-status ' + statusClass + '">' + statusLabel + '</span>'
    + '</div>'

    // Items
    + '<div class="picker-items">' + itemsHtml + '</div>'

    // Catatan picker
    + (isPending ? ''
      + '<div class="picker-note-section">'
      + '<div class="picker-note-label">'
      + icon('message', { size: 12 })
      + ' Catatan Picker (opsional)'
      + '</div>'
      + '<textarea class="picker-note-input" placeholder="Tulis catatan untuk admin..."'
      + ' data-note-order="' + escapeHtml(order.ORDER_ID) + '"></textarea>'
      + '</div>'
      : '')

    // Footer (tombol submit — hanya untuk PENDING)
    + (isPending ? ''
      + '<div class="picker-order-footer">'
      + '<button class="btn-picker-submit" type="button" data-picker-submit="' + escapeHtml(order.ORDER_ID) + '">'
      + icon('check-check', { size: 16 })
      + ' Kirim Verifikasi ke Admin'
      + '</button>'
      + '</div>'
      : '')

    + '</article>';
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMIT PICKED — Kirim verifikasi ke Admin
// ─────────────────────────────────────────────────────────────────────────

async function submitPicked(orderId) {

  // Kumpulkan data dari form
  var checkedItems = [];
  var stokData = [];
  var noteEl = document.querySelector('[data-note-order="' + orderId + '"]');
  var pickerNote = noteEl ? noteEl.value.trim() : '';

  // Cek semua checkbox & stok input
  document.querySelectorAll('[data-order="' + orderId + '"]').forEach(function (chk) {
    var idx = parseInt(chk.dataset.idx);
    checkedItems.push({
      index: idx,
      checked: chk.checked,
    });
  });

  document.querySelectorAll('[data-stok-order="' + orderId + '"]').forEach(function (input) {
    var idx = parseInt(input.dataset.stokIdx);
    stokData.push({
      index: idx,
      stokReal: input.value.trim(),
    });
  });

  // Konfirmasi
  var ok = await confirm({
    icon: '📋',
    title: 'Kirim Verifikasi?',
    message: 'Order ' + orderId + ' akan dikirim ke Admin dengan status PICKED (terverifikasi).\n\nAdmin akan mereview hasil verifikasi Anda.',
    okText: 'Ya, Kirim',
    okVariant: 'info',
  });

  if (!ok) return;

  // Kirim ke server
  try {

    toast.info('Mengirim verifikasi...', { duration: 10000 });

    var result = await callApi('pickerVerify', {
      orderId: orderId,
      pickerUsername: state.session.username,
      pickerNama: state.session.nama || state.session.username,
      checkedItems: checkedItems,
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

    toast.success('Verifikasi berhasil dikirim ke Admin!', { duration: 4000 });

    // Reload
    await loadOrders();

  } catch (error) {
    toast.error('Gagal: ' + error.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
