/* ═══════════════════════════════════════════════════════════════════════
   CART — Bottom sheet with Satuan Selector + Lucide Icons
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, toInt } from '../../utils.js';
import { orders as ordersApi } from '../../api.js';
import { toast, confirm } from '../../ui.js';
import { icon } from '../../icons.js';

// Satuan options
var SATUAN_OPTIONS = ['PCS', 'DUS', 'KRG', 'SET', 'PACK', 'IKAT', 'GROSS'];

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
    confirmSubmit(state);
  });

  // Cart items CLICK actions
  $('cartItems')?.addEventListener('click', function (e) {

    var target = e.target.closest('[data-cart-action]');
    if (!target) return;

    var code = target.dataset.code;
    var action = target.dataset.cartAction;

    if (action === 'delete') {
      removeFromCart(state, code);
    } else if (action === 'increase') {
      changeCartQty(state, code, 1);
    } else if (action === 'decrease') {
      changeCartQty(state, code, -1);
    }
  });

  // Cart items CHANGE events (qty + satuan)
  $('cartItems')?.addEventListener('change', function (e) {

    // Qty change
    var qtyTarget = e.target.closest('[data-cart-action="set-qty"]');
    if (qtyTarget) {
      setCartQty(state, qtyTarget.dataset.code, qtyTarget.value);
      return;
    }

    // Satuan change
    var satuanTarget = e.target.closest('[data-cart-action="set-satuan"]');
    if (satuanTarget) {

      var code = satuanTarget.dataset.code;

      if (state.cart[code]) {
        state.cart[code].satuan = satuanTarget.value;
        updateCartUi(state);
        // Re-render untuk update subtotal display
        renderCartSheet(state);
      }
    }
  });

  // ESC close
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
  if (cartCount) {
    cartCount.textContent = qty + ' item · ' + formatRupiah(total);
  }

  var cartItemCount = $('cartItemCount');
  if (cartItemCount) {
    cartItemCount.textContent = qty + ' item';
  }

  var cartTotal = $('cartTotal');
  if (cartTotal) {
    cartTotal.textContent = formatRupiah(total);
  }

  validateCartStocks(state);
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
    return buildCartItem(item);
  }).join('');

  bindStockInputs(state);
  validateCartStocks(state);
}


function buildCartItem(item) {

  var code = escapeHtml(item.kode);
  var gudangEmpty = isEmpty(item.stokGudang);
  var tokoEmpty = isEmpty(item.stokToko);

  // Build satuan options
  var satuanOptionsHtml = SATUAN_OPTIONS.map(function (s) {
    var selected = (s === item.satuan) ? ' selected' : '';
    return '<option value="' + s + '"' + selected + '>' + s + '</option>';
  }).join('');

  return ''
    + '<article class="cart-item">'

    + '<div class="cart-info">'
    + '<div class="cart-name">' + escapeHtml(item.nama) + '</div>'
    + '<div class="cart-code">' + code + '</div>'

    + '<div class="cart-price-row">'

    // Qty control
    + '<span class="cart-quantity">'
    + '<button type="button" data-cart-action="decrease" data-code="' + code + '">'
    + icon('minus', { size: 12 })
    + '</button>'
    + '<input type="number" min="1" value="' + item.qty + '"'
    + ' data-cart-action="set-qty" data-code="' + code + '">'
    + '<button type="button" data-cart-action="increase" data-code="' + code + '">'
    + icon('plus', { size: 12 })
    + '</button>'
    + '</span>'

    // Satuan selector
    + '<select class="cart-satuan-select"'
    + ' data-cart-action="set-satuan"'
    + ' data-code="' + code + '">'
    + satuanOptionsHtml
    + '</select>'

    + '<span>× ' + formatRupiah(item.harga) + '</span>'
    + '<span>=</span>'
    + '<span class="cart-subtotal">' + formatRupiah(item.qty * item.harga) + '</span>'

    + '</div>'
    + '</div>'

    + '<div class="cart-right">'

    + '<div class="stock-label">Isi stok aktual</div>'

    + '<div class="cart-stock-row">'

    // Stok Gudang
    + '<label class="stock-group ' + (gudangEmpty ? 'empty' : '') + '" title="Stok di Gudang Pusat">'
    + '<span class="stock-group-icon">' + icon('warehouse', { size: 12 }) + '</span>'
    + '<input class="stock-input"'
    + ' type="number"'
    + ' min="0"'
    + ' placeholder="Gudang"'
    + ' value="' + (gudangEmpty ? '' : item.stokGudang) + '"'
    + ' data-stock-type="gudang"'
    + ' data-code="' + code + '">'
    + '</label>'

    // Stok Toko
    + '<label class="stock-group ' + (tokoEmpty ? 'empty' : '') + '" title="Stok di Toko/Cabang">'
    + '<span class="stock-group-icon">' + icon('store', { size: 12 }) + '</span>'
    + '<input class="stock-input"'
    + ' type="number"'
    + ' min="0"'
    + ' placeholder="Toko"'
    + ' value="' + (tokoEmpty ? '' : item.stokToko) + '"'
    + ' data-stock-type="toko"'
    + ' data-code="' + code + '">'
    + '</label>'

    + '</div>'

    // Delete button
    + '<button class="cart-delete"'
    + ' type="button"'
    + ' data-cart-action="delete"'
    + ' data-code="' + code + '"'
    + ' title="Hapus dari keranjang">'
    + icon('trash', { size: 14 })
    + '</button>'

    + '</div>'

    + '</article>';
}


function isEmpty(value) {
  return value === '' || value === undefined || value === null;
}

// ─────────────────────────────────────────────────────────────────────────
// STOCK INPUTS
// ─────────────────────────────────────────────────────────────────────────

function bindStockInputs(state) {

  document.querySelectorAll('[data-stock-type]').forEach(function (input) {

    input.addEventListener('input', function () {

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
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// VALIDASI
// ─────────────────────────────────────────────────────────────────────────

function validateCartStocks(state) {

  var items = Object.values(state.cart);

  var gudangMissing = items.filter(function (i) {
    return isEmpty(i.stokGudang);
  }).length;

  var tokoMissing = items.filter(function (i) {
    return isEmpty(i.stokToko);
  }).length;

  var missing = gudangMissing + tokoMissing;
  var valid = items.length > 0 && missing === 0;

  var submitBtn = $('cartSubmitButton');
  if (submitBtn) {
    submitBtn.disabled = !valid;
  }

  var warning = $('cartWarning');
  var warningText = $('cartWarningText');

  if (warning && warningText) {

    if (!valid && items.length > 0) {
      warning.classList.add('show');
      warningText.textContent = 'Wajib isi stok gudang ('
        + gudangMissing + ' kosong) dan stok toko ('
        + tokoMissing + ' kosong).';
    } else {
      warning.classList.remove('show');
    }
  }

  return valid;
}

// ─────────────────────────────────────────────────────────────────────────
// CART QTY ACTIONS
// ─────────────────────────────────────────────────────────────────────────

function clampCartQty(state, code, value) {

  var product = state.productByCode[String(code).toUpperCase()];
  var stock = product ? toInt(product.STOK) : 0;
  var qty = Math.max(1, toInt(value, 1));

  if (stock > 0 && qty > stock) {
    qty = stock;
    toast.info('Maksimal stok ' + stock + '.');
  }

  return qty;
}


function changeCartQty(state, code, delta) {

  if (!state.cart[code]) return;

  state.cart[code].qty = clampCartQty(
    state,
    code,
    state.cart[code].qty + delta
  );

  updateCartUi(state);
  renderCartSheet(state);
}


function setCartQty(state, code, value) {

  if (!state.cart[code]) return;

  state.cart[code].qty = clampCartQty(state, code, value);
  updateCartUi(state);
  renderCartSheet(state);
}


function removeFromCart(state, code) {

  delete state.cart[code];
  updateCartUi(state);
  renderCartSheet(state);

  // Update catalog card
  var card = $('card-' + code);

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
// SUBMIT
// ─────────────────────────────────────────────────────────────────────────

async function confirmSubmit(state) {

  var items = Object.values(state.cart);

  if (!items.length) {
    toast.error('Keranjang kosong.');
    return;
  }

  if (!validateCartStocks(state)) {
    toast.warning('Isi stok gudang dan stok toko untuk semua barang.', {
      duration: 4000,
    });
    return;
  }

  var total = items.reduce(function (s, i) {
    return s + i.qty * i.harga;
  }, 0);

  var summary = items.map(function (i) {
    return '• ' + i.nama + ': minta ' + i.qty + ' ' + i.satuan
      + '\n   (Gudang: ' + i.stokGudang + ', Toko: ' + i.stokToko + ')';
  }).join('\n');

  var ok = await confirm({
    icon: '🚀',
    title: 'Kirim Order ke Gudang?',
    message: items.length + ' jenis barang · Total ' + formatRupiah(total)
      + '\n\n' + summary
      + '\n\nKirim order untuk ' + state.branchId + '?',
    okText: 'Ya, Kirim',
    okVariant: 'primary',
  });

  if (!ok) return;

  await submitOrder(state, items);
}


async function submitOrder(state, items) {

  if (state.isSubmitting) return;

  state.isSubmitting = true;

  var submitBtn = $('cartSubmitButton');
  var originalText = submitBtn?.innerHTML;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner spinner-sm" style="color: #fff;"></span> Mengirim...';
  }

  var userNote = $('cartNoteInput')?.value.trim() || '';

  var stockNote = items.map(function (i) {
    return i.kode + ': gudang ' + i.stokGudang + ', toko ' + i.stokToko;
  }).join(' | ');

  var catatan = userNote
    ? userNote + '\n\n[STOK AKTUAL] ' + stockNote
    : '[STOK AKTUAL] ' + stockNote;

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
      };
    }),
  };

  try {

    var result = await ordersApi.submit(payload);

    if (result.status === 'ok') {

      state.cart = {};

      var noteInput = $('cartNoteInput');
      if (noteInput) noteInput.value = '';

      closeCart();
      updateCartUi(state);

      // Re-render catalog
      var catalogModule = await import('./catalog-page.js');
      catalogModule.updateCatalog(state);

      toast.success('Order berhasil dikirim!', { duration: 4000 });

      // Redirect ke history
      setTimeout(function () {
        var historyTab = document.querySelector('[data-tab="history"]');
        historyTab?.click();
      }, 1000);

    } else {
      toast.error(result.message || 'Gagal mengirim order.');
    }

  } catch (error) {
    toast.error(error.message || 'Terjadi kesalahan.');
  } finally {

    state.isSubmitting = false;

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText
        || (icon('send', { size: 18 }) + ' Kirim Order ke Gudang');
    }
  }
}
