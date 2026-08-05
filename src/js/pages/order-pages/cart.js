/* ═══════════════════════════════════════════════════════════════════════
   CART — v3.7 Persistent Cart (localStorage + Server Sync)
   Cart tetap ada saat refresh, logout, beda device
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, toInt } from '../../utils.js';
import { orders as ordersApi, callApi } from '../../api.js';
import { toast, confirm } from '../../ui.js';
import { icon } from '../../icons.js';
import { showPreOrderDialog } from './pre-order-dialog.js';

var SATUAN_OPTIONS = ['PCS', 'DUS', 'KRG', 'SET', 'PACK', 'IKAT', 'GROSS'];

// ─────────────────────────────────────────────────────────────────────────
// CART PERSISTENCE (localStorage + Server)
// ─────────────────────────────────────────────────────────────────────────

var CART_STORAGE_KEY = 'gudanghub_cart';
var CART_SYNC_TIMER = null;

function getUsername() {
  try {
    var session = JSON.parse(sessionStorage.getItem('gudanghub_session') || '{}');
    return String(session.username || '').toLowerCase();
  } catch {
    return '';
  }
}

function getCartKey() {
  var username = getUsername();
  return username ? CART_STORAGE_KEY + '_' + username : CART_STORAGE_KEY;
}

function saveCartLocal(cart) {
  try {
    localStorage.setItem(getCartKey(), JSON.stringify(cart || {}));
  } catch (e) {
    console.warn('[Cart] Local save failed:', e.message);
  }
}

function saveCartAndSync(state) {
  // Simpan ke localStorage langsung (instant)
  saveCartLocal(state.cart);

  // Debounce sync ke server (2 detik setelah perubahan terakhir)
  clearTimeout(CART_SYNC_TIMER);
  CART_SYNC_TIMER = setTimeout(function () {
    syncToServer(state);
  }, 2000);
}

export function loadCartLocal() {
  try {
    var raw = localStorage.getItem(getCartKey());
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

export function clearCartAll(state) {
  try {
    localStorage.removeItem(getCartKey());
  } catch {}

  // Hapus dari server
  syncToServer(state, true);
}

// ─── Server Sync ───

async function syncToServer(state, isEmpty) {
  var username = getUsername();
  if (!username) return;

  try {
    var cartData = isEmpty ? '{}' : JSON.stringify(state.cart || {});

    await callApi('syncCart', {
      username: username,
      cart: cartData,
    }, {
      dedupe: false,
      timeout: 15000,
      cache: false,
    });

    var count = isEmpty ? 0 : Object.keys(state.cart || {}).length;
    console.log('[Cart] Synced to server (' + count + ' items)');

  } catch (err) {
    console.warn('[Cart] Server sync failed:', err.message);
  }
}

export async function loadCartServer() {
  var username = getUsername();
  if (!username) return {};

  try {
    var result = await callApi('getCart', {
      username: username,
    }, {
      dedupe: true,
      timeout: 15000,
      cache: false,
    });

    if (result && result.status === 'ok' && result.cart) {
      try {
        var parsed = JSON.parse(result.cart);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          var count = Object.keys(parsed).length;
          if (count > 0) {
            console.log('[Cart] Loaded from server (' + count + ' items)');
          }
          return parsed;
        }
      } catch {}
    }

    return {};
  } catch (err) {
    console.warn('[Cart] Server load failed:', err.message);
    return {};
  }
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initCart(state) {

  $('openCartButton')?.addEventListener('click', function () {
    openCart(state);
  });

  $('closeCartButton')?.addEventListener('click', closeCart);
  $('sheetOverlay')?.addEventListener('click', closeCart);

  $('cartSubmitButton')?.addEventListener('click', function () {
    showPreviewBeforeSubmit(state);
  });

  $('cartItems')?.addEventListener('click', function (e) {
    var target = e.target.closest('[data-cart-action]');
    if (!target) return;

    var code = target.dataset.code;
    var action = target.dataset.cartAction;

    if (action === 'delete') removeFromCart(state, code);
    else if (action === 'increase') changeCartQty(state, code, 1);
    else if (action === 'decrease') changeCartQty(state, code, -1);
    else if (action === 'toggle-note') toggleNote(code);
  });

  $('cartItems')?.addEventListener('change', function (e) {
    var qtyTarget = e.target.closest('[data-cart-action="set-qty"]');
    if (qtyTarget) {
      setCartQty(state, qtyTarget.dataset.code, qtyTarget.value);
      return;
    }

    var satuanTarget = e.target.closest('[data-cart-action="set-satuan"]');
    if (satuanTarget) {
      var code = satuanTarget.dataset.code;
      if (state.cart[code]) {
        state.cart[code].satuan = satuanTarget.value;
        updateCartUi(state);
        renderCartSheet(state);
      }
    }
  });

  $('cartItems')?.addEventListener('input', function (e) {
    var noteTarget = e.target.closest('[data-cart-action="set-note"]');
    if (noteTarget) {
      var code = noteTarget.dataset.code;
      if (state.cart[code]) {
        state.cart[code].catatanItem = noteTarget.value;
        saveCartAndSync(state);
      }
    }

    var stockTarget = e.target.closest('[data-stock-type]');
    if (stockTarget) {
      handleStockInput(state, stockTarget);
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('cartSheet')?.classList.contains('show')) {
      closeCart();
    }
  });

  updateCartUi(state);
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────

export function addToCart(state, code) {
  updateCartUi(state);
}

export function updateCartUi(state) {
  var items = Object.values(state.cart);
  var total = items.reduce(function (s, i) { return s + i.qty * i.harga; }, 0);
  var qty = items.reduce(function (s, i) { return s + i.qty; }, 0);

  $('cartBar')?.classList.toggle('show', items.length > 0);

  var cartCount = $('cartCount');
  if (cartCount) cartCount.textContent = qty + ' item · ' + formatRupiah(total);

  var cartItemCount = $('cartItemCount');
  if (cartItemCount) cartItemCount.textContent = qty + ' item';

  var cartTotal = $('cartTotal');
  if (cartTotal) cartTotal.textContent = formatRupiah(total);

  validateCartStocks(state);

  // ★ Simpan cart setiap update
  saveCartAndSync(state);
}

// ─────────────────────────────────────────────────────────────────────────
// OPEN / CLOSE
// ─────────────────────────────────────────────────────────────────────────

function openCart(state) {
  renderCartSheet(state);
  $('sheetOverlay')?.classList.add('show');
  $('cartSheet')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  $('sheetOverlay')?.classList.remove('show');
  $('cartSheet')?.classList.remove('show');
  document.body.style.overflow = '';
}

// ─────────────────────────────────────────────────────────────────────────
// TOGGLE NOTE
// ─────────────────────────────────────────────────────────────────────────

function toggleNote(code) {
  var wrapper = document.querySelector('[data-note-wrapper="' + code + '"]');
  var button = document.querySelector('[data-cart-action="toggle-note"][data-code="' + code + '"]');

  if (!wrapper) return;

  var isVisible = wrapper.style.display !== 'none';

  if (isVisible) {
    wrapper.style.display = 'none';
    if (button) button.classList.remove('active');
  } else {
    wrapper.style.display = 'block';
    if (button) button.classList.add('active');
    setTimeout(function () {
      var input = wrapper.querySelector('input');
      input?.focus();
    }, 50);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER CART
// ─────────────────────────────────────────────────────────────────────────

function renderCartSheet(state) {
  var items = Object.values(state.cart);
  var wrapper = $('cartItems');
  if (!wrapper) return;

  if (!items.length) {
    wrapper.innerHTML = ''
      + '<div class="empty-state">'
      + '<div class="empty-icon">'
      + icon('cart', { size: 48, color: 'var(--muted)' })
      + '</div>'
      + '<div>Keranjang kosong.</div>'
      + '<div style="margin-top: 8px; font-size: 12px;">Tambahkan barang dari katalog dulu ya!</div>'
      + '</div>';

    validateCartStocks(state);
    return;
  }

  wrapper.innerHTML = items.map(function (item) {
    return buildCartItem(item, state);
  }).join('');

  validateCartStocks(state);
}

function buildCartItem(item, state) {
  var code = escapeHtml(item.kode);
  var cartKey = item._cartKey || item.kode;
  var escCartKey = escapeHtml(cartKey);
  var gudangEmpty = isEmpty(item.stokGudang);
  var tokoEmpty = isEmpty(item.stokToko);

  var product = state.productByCode ? state.productByCode[String(item.kode).toUpperCase()] : null;
  var stokSistem = product ? toInt(product.STOK) : (item.stokSistem || 0);

  var stokSistemClass = stokSistem === 0 ? 'stock-empty'
                      : stokSistem <= 5 ? 'stock-low'
                      : 'stock-ok';

  var stokSistemText = stokSistem === 0 ? 'Habis' : 'Stok Sistem: ' + stokSistem;

  var satuanOptionsHtml = SATUAN_OPTIONS.map(function (s) {
    var selected = (s === item.satuan) ? ' selected' : '';
    return '<option value="' + s + '"' + selected + '>' + s + '</option>';
  }).join('');

  var catatanItem = item.catatanItem || '';
  var noteVisible = catatanItem.length > 0;
  var noteBtnClass = noteVisible ? 'note-toggle-btn active' : 'note-toggle-btn';

  return ''
    + '<article class="cart-item">'
    + '<div class="cart-info">'
    + '<div class="cart-name">'
    + escapeHtml(item.nama)
    + (catatanItem ? ' <span class="cart-note-inline">(' + escapeHtml(catatanItem) + ')</span>' : '')
    + '</div>'
    + '<div class="cart-code">'
    + code
    + (item.isManual ? '' : ' <span class="cart-stok-sistem ' + stokSistemClass + '">' + stokSistemText + '</span>')
    + '</div>'
    + '<div class="cart-price-row">'
    + '<span class="cart-quantity">'
    + '<button type="button" data-cart-action="decrease" data-code="' + escCartKey + '">'
    + icon('minus', { size: 12 })
    + '</button>'
    + '<input type="number" min="1" value="' + item.qty + '" data-cart-action="set-qty" data-code="' + escCartKey + '">'
    + '<button type="button" data-cart-action="increase" data-code="' + escCartKey + '">'
    + icon('plus', { size: 12 })
    + '</button>'
    + '</span>'
    + '<select class="cart-satuan-select" data-cart-action="set-satuan" data-code="' + escCartKey + '">'
    + satuanOptionsHtml
    + '</select>'
    + '<span>× ' + formatRupiah(item.harga) + '</span>'
    + '<span>=</span>'
    + '<span class="cart-subtotal">' + formatRupiah(item.qty * item.harga) + '</span>'
    + '</div>'

    // Note input
    + '<div class="cart-note-wrapper" data-note-wrapper="' + escCartKey + '" style="' + (noteVisible ? '' : 'display:none;') + '">'
    + '<label class="cart-note-label">'
    + icon('message', { size: 12 })
    + ' Catatan untuk barang ini:'
    + '</label>'
    + '<input type="text" class="cart-note-input" placeholder="contoh: pesan warna merah"'
    + ' value="' + escapeHtml(catatanItem) + '"'
    + ' data-cart-action="set-note" data-code="' + escCartKey + '"'
    + ' maxlength="80">'
    + '<div class="cart-note-hint">Max 80 karakter — akan muncul di form order</div>'
    + '</div>'

    + '</div>'

    + '<div class="cart-right">'

    + '<button class="' + noteBtnClass + '" type="button" data-cart-action="toggle-note" data-code="' + escCartKey + '" title="Tambah catatan">'
    + icon('message', { size: 14 })
    + '</button>'

    + '<div class="stock-label">ISI STOK AKTUAL</div>'
    + '<div class="stock-labels-row">'
    + '<span class="stock-mini-label">' + icon('warehouse', { size: 10 }) + ' Gudang</span>'
    + '<span class="stock-mini-label">' + icon('store', { size: 10 }) + ' Toko</span>'
    + '</div>'
    + '<div class="cart-stock-row">'
    + '<label class="stock-group ' + (gudangEmpty ? 'empty' : '') + '" title="Stok Gudang">'
    + '<span class="stock-group-icon">' + icon('warehouse', { size: 12 }) + '</span>'
    + '<input class="stock-input" type="number" min="0" placeholder="0"'
    + ' value="' + (gudangEmpty ? '' : item.stokGudang) + '"'
    + ' data-stock-type="gudang" data-code="' + escCartKey + '">'
    + '</label>'
    + '<label class="stock-group ' + (tokoEmpty ? 'empty' : '') + '" title="Stok Toko">'
    + '<span class="stock-group-icon">' + icon('store', { size: 12 }) + '</span>'
    + '<input class="stock-input" type="number" min="0" placeholder="0"'
    + ' value="' + (tokoEmpty ? '' : item.stokToko) + '"'
    + ' data-stock-type="toko" data-code="' + escCartKey + '">'
    + '</label>'
    + '</div>'
    + '<button class="cart-delete" type="button" data-cart-action="delete" data-code="' + escCartKey + '" title="Hapus">'
    + icon('trash', { size: 14 })
    + '</button>'
    + '</div>'
    + '</article>';
}

function isEmpty(value) {
  return value === '' || value === undefined || value === null;
}

function handleStockInput(state, input) {
  var code = input.dataset.code;
  var type = input.dataset.stockType;
  var value = input.value.trim();

  var numeric = value === '' ? '' : Math.max(0, toInt(value, 0));
  var field = type === 'gudang' ? 'stokGudang' : 'stokToko';

  if (state.cart[code]) {
    state.cart[code][field] = numeric;
  }

  input.closest('.stock-group')?.classList.toggle('empty', value === '');
  validateCartStocks(state);
}

function validateCartStocks(state) {
  var items = Object.values(state.cart);

  var gudangMissing = items.filter(function (i) { return isEmpty(i.stokGudang); }).length;
  var tokoMissing = items.filter(function (i) { return isEmpty(i.stokToko); }).length;
  var missing = gudangMissing + tokoMissing;
  var valid = items.length > 0 && missing === 0;

  var submitBtn = $('cartSubmitButton');
  if (submitBtn) submitBtn.disabled = !valid;

  var warning = $('cartWarning');
  var warningText = $('cartWarningText');

  if (warning && warningText) {
    if (!valid && items.length > 0) {
      warning.classList.add('show');
      warningText.textContent = 'Wajib isi stok gudang (' + gudangMissing + ' kosong) dan stok toko (' + tokoMissing + ' kosong).';
    } else {
      warning.classList.remove('show');
    }
  }

  return valid;
}

// ─────────────────────────────────────────────────────────────────────────
// CART QTY
// ─────────────────────────────────────────────────────────────────────────

function normalizeQty(value) {
  return Math.max(1, toInt(value, 1));
}

function changeCartQty(state, code, delta) {
  if (!state.cart[code]) return;
  state.cart[code].qty = normalizeQty(state.cart[code].qty + delta);
  updateCartUi(state);
  renderCartSheet(state);
}

function setCartQty(state, code, value) {
  if (!state.cart[code]) return;
  state.cart[code].qty = normalizeQty(value);
  updateCartUi(state);
  renderCartSheet(state);
}

function removeFromCart(state, code) {
  var item = state.cart[code];
  var displayCode = item ? item.kode : code;

  delete state.cart[code];
  updateCartUi(state);
  renderCartSheet(state);

  // Update catalog card (kalau barang katalog)
  var card = $('card-' + displayCode);
  if (card) {
    card.classList.remove('in-cart');
    var addBtn = card.querySelector('.add-button');
    if (addBtn) {
      addBtn.classList.remove('added');
      addBtn.innerHTML = icon('plus', { size: 14 }) + ' Tambah';
    }
  }

  toast.info('Dihapus dari keranjang.', { duration: 1500 });
}

// ─────────────────────────────────────────────────────────────────────────
// PREVIEW SEBELUM SUBMIT
// ─────────────────────────────────────────────────────────────────────────

function showPreviewBeforeSubmit(state) {

  var items = Object.values(state.cart);

  if (!items.length) {
    toast.error('Keranjang kosong.');
    return;
  }

  if (!validateCartStocks(state)) {
    toast.warning('Isi stok gudang dan stok toko untuk semua barang.', { duration: 4000 });
    return;
  }

  closeCart();

  showPreOrderDialog({
    items: items,
    branchId: state.branchId,
    catatan: $('cartNoteInput')?.value || '',
    onConfirm: async function (config) {
      await submitOrder(state, items, config);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMIT ORDER
// ─────────────────────────────────────────────────────────────────────────

async function submitOrder(state, items, formConfig) {

  if (state.isSubmitting) return;
  state.isSubmitting = true;

  var userNote = $('cartNoteInput')?.value.trim() || '';

  var stockNote = items.map(function (i) {
    return i.kode + ': gudang ' + i.stokGudang + ', toko ' + i.stokToko;
  }).join(' | ');

  var formInfo = '';
  if (formConfig) {
    formInfo = '[FORM] No.' + formConfig.nomorOrder
             + ' Tgl.' + formConfig.tanggalOrder.toLocaleDateString('id-ID');
  }

  var catatan = userNote
    ? userNote + '\n\n' + formInfo + '\n\n[STOK AKTUAL] ' + stockNote
    : formInfo + '\n\n[STOK AKTUAL] ' + stockNote;

  var payload = {
    idCabang: state.branchId,
    catatan: catatan,
    items: items.map(function (i) {
      return {
        kode: i.kode,
        nama: i.nama,
        kategori: i.kategori,
        qty: i.qty,
        satuan: i.satuan,
        harga: i.harga,
        stokGudang: i.stokGudang,
        stokToko: i.stokToko,
        stokSistem: i.stokSistem !== undefined ? i.stokSistem : 0,
        isManual: i.isManual || false,
        catatanItem: i.catatanItem || '',
      };
    }),
  };

  try {
    var result = await ordersApi.submit(payload);

    if (result.status === 'ok') {
      state.cart = {};

      // ★ Hapus cart dari storage + server
      clearCartAll(state);

      var noteInput = $('cartNoteInput');
      if (noteInput) noteInput.value = '';

      updateCartUi(state);

      var catalogModule = await import('./catalog-page.js');
      catalogModule.updateCatalog(state);

      toast.success('Order berhasil dikirim!', { duration: 4000 });

      setTimeout(function () {
        var historyTab = document.querySelector('[data-tab="history"]');
        historyTab?.click();
      }, 1000);

    } else {
      throw new Error(result.message || 'Gagal mengirim order.');
    }
  } catch (error) {
    toast.error(error.message || 'Terjadi kesalahan.');
    throw error;
  } finally {
    state.isSubmitting = false;
  }
}
