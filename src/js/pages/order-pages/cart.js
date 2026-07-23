/* ═══════════════════════════════════════════════════════════════════════
   CART — Bottom sheet with Lucide Icons
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, toInt } from '../../utils.js';
import { orders as ordersApi } from '../../api.js';
import { toast, confirm } from '../../ui.js';
import { icon, injectIcons } from '../../icons.js';

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initCart(state) {
  $('openCartButton')?.addEventListener('click', () => openCart(state));

  $('closeCartButton')?.addEventListener('click', closeCart);
  $('sheetOverlay')?.addEventListener('click', closeCart);

  $('cartSubmitButton')?.addEventListener('click', () => confirmSubmit(state));

  $('cartItems')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-cart-action]');
    if (!target) return;

    const code = target.dataset.code;
    const action = target.dataset.cartAction;

    if (action === 'delete') {
      removeFromCart(state, code);
    } else if (action === 'increase') {
      changeCartQty(state, code, 1);
    } else if (action === 'decrease') {
      changeCartQty(state, code, -1);
    }
  });

  $('cartItems')?.addEventListener('change', (e) => {
    const target = e.target.closest('[data-cart-action="set-qty"]');
    if (target) {
      setCartQty(state, target.dataset.code, target.value);
    }
  });

  document.addEventListener('keydown', (e) => {
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
  const items = Object.values(state.cart);
  const total = items.reduce((s, i) => s + i.qty * i.harga, 0);
  const qty = items.reduce((s, i) => s + i.qty, 0);

  $('cartBar')?.classList.toggle('show', items.length > 0);
  const cartCount = $('cartCount');
  if (cartCount) cartCount.textContent = `${qty} item · ${formatRupiah(total)}`;

  const cartItemCount = $('cartItemCount');
  if (cartItemCount) cartItemCount.textContent = `${qty} item`;

  const cartTotal = $('cartTotal');
  if (cartTotal) cartTotal.textContent = formatRupiah(total);

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
  const items = Object.values(state.cart);
  const wrapper = $('cartItems');
  if (!wrapper) return;

  if (!items.length) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${icon('cart', { size: 48, color: 'var(--muted)' })}</div>
        <div>Keranjang kosong.</div>
        <div style="margin-top: 8px; font-size: 12px;">Tambahkan barang dari katalog dulu ya!</div>
      </div>
    `;
    validateCartStocks(state);
    return;
  }

  wrapper.innerHTML = items.map((item) => buildCartItem(item)).join('');

  bindStockInputs(state);
  validateCartStocks(state);
}

function buildCartItem(item) {
  const code = escapeHtml(item.kode);
  const gudangEmpty = isEmpty(item.stokGudang);
  const tokoEmpty = isEmpty(item.stokToko);

  return `
    <article class="cart-item">
      <div class="cart-info">
        <div class="cart-name">${escapeHtml(item.nama)}</div>
        <div class="cart-code">${code}</div>

        <div class="cart-price-row">
          <span class="cart-quantity">
            <button type="button" data-cart-action="decrease" data-code="${code}">
              ${icon('minus', { size: 12 })}
            </button>
            <input type="number" min="1" value="${item.qty}"
                   data-cart-action="set-qty" data-code="${code}">
            <button type="button" data-cart-action="increase" data-code="${code}">
              ${icon('plus', { size: 12 })}
            </button>
          </span>
          <span>× ${formatRupiah(item.harga)}</span>
          <span>=</span>
          <span class="cart-subtotal">${formatRupiah(item.qty * item.harga)}</span>
        </div>
      </div>

      <div class="cart-right">
        <div class="stock-label">Isi stok aktual</div>

        <div class="cart-stock-row">
          <label class="stock-group ${gudangEmpty ? 'empty' : ''}" title="Stok di Gudang Pusat">
            <span class="stock-group-icon">${icon('warehouse', { size: 12 })}</span>
            <input class="stock-input"
                   type="number"
                   min="0"
                   placeholder="Gudang"
                   value="${gudangEmpty ? '' : item.stokGudang}"
                   data-stock-type="gudang"
                   data-code="${code}">
          </label>

          <label class="stock-group ${tokoEmpty ? 'empty' : ''}" title="Stok di Toko/Cabang">
            <span class="stock-group-icon">${icon('store', { size: 12 })}</span>
            <input class="stock-input"
                   type="number"
                   min="0"
                   placeholder="Toko"
                   value="${tokoEmpty ? '' : item.stokToko}"
                   data-stock-type="toko"
                   data-code="${code}">
          </label>
        </div>

        <button class="cart-delete"
                type="button"
                data-cart-action="delete"
                data-code="${code}"
                title="Hapus dari keranjang">
          ${icon('trash', { size: 14 })}
        </button>
      </div>
    </article>
  `;
}

function isEmpty(value) {
  return value === '' || value === undefined || value === null;
}

// ─────────────────────────────────────────────────────────────────────────
// STOCK INPUTS
// ─────────────────────────────────────────────────────────────────────────

function bindStockInputs(state) {
  document.querySelectorAll('[data-stock-type]').forEach((input) => {
    input.addEventListener('input', (e) => {
      const code = input.dataset.code;
      const type = input.dataset.stockType;
      const value = input.value.trim();

      const numeric = value === '' ? '' : Math.max(0, toInt(value, 0));
      const field = type === 'gudang' ? 'stokGudang' : 'stokToko';

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
  const items = Object.values(state.cart);

  const gudangMissing = items.filter((i) => isEmpty(i.stokGudang)).length;
  const tokoMissing = items.filter((i) => isEmpty(i.stokToko)).length;
  const missing = gudangMissing + tokoMissing;

  const valid = items.length > 0 && missing === 0;

  const submitBtn = $('cartSubmitButton');
  if (submitBtn) submitBtn.disabled = !valid;

  const warning = $('cartWarning');
  const warningText = $('cartWarningText');

  if (warning && warningText) {
    if (!valid && items.length > 0) {
      warning.classList.add('show');
      warningText.textContent = `Wajib isi stok gudang (${gudangMissing} kosong) dan stok toko (${tokoMissing} kosong).`;
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
  const product = state.productByCode[String(code).toUpperCase()];
  const stock = product ? toInt(product.STOK) : 0;
  let qty = Math.max(1, toInt(value, 1));

  if (stock > 0 && qty > stock) {
    qty = stock;
    toast.info(`Maksimal stok ${stock}.`);
  }

  return qty;
}

function changeCartQty(state, code, delta) {
  if (!state.cart[code]) return;

  state.cart[code].qty = clampCartQty(state, code, state.cart[code].qty + delta);
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

  // Update catalog card (remove "in-cart" state)
  const card = $(`card-${code}`);
  if (card) {
    card.classList.remove('in-cart');
    const addBtn = card.querySelector('.add-button');
    if (addBtn) {
      addBtn.classList.remove('added');
      addBtn.innerHTML = `${icon('plus', { size: 14 })} Tambah`;
    }
  }

  toast.info('Dihapus dari keranjang.', { duration: 1500 });
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────────────────────────────────

async function confirmSubmit(state) {
  const items = Object.values(state.cart);

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

  const total = items.reduce((s, i) => s + i.qty * i.harga, 0);

  const summary = items.map((i) =>
    `• ${i.nama}: minta ${i.qty} ${i.satuan}\n   (Gudang: ${i.stokGudang}, Toko: ${i.stokToko})`
  ).join('\n');

  const ok = await confirm({
    icon: '🚀',
    title: 'Kirim Order ke Gudang?',
    message: `${items.length} jenis barang · Total ${formatRupiah(total)}\n\n${summary}\n\nKirim order untuk ${state.branchId}?`,
    okText: 'Ya, Kirim',
    okVariant: 'primary',
  });

  if (!ok) return;

  await submitOrder(state, items);
}

async function submitOrder(state, items) {
  if (state.isSubmitting) return;

  state.isSubmitting = true;

  const submitBtn = $('cartSubmitButton');
  const originalText = submitBtn?.innerHTML;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner spinner-sm" style="color: #fff;"></span> Mengirim...';
  }

  const userNote = $('cartNoteInput')?.value.trim() || '';

  const stockNote = items.map((i) =>
    `${i.kode}: gudang ${i.stokGudang}, toko ${i.stokToko}`
  ).join(' | ');

  const catatan = userNote
    ? `${userNote}\n\n[STOK AKTUAL] ${stockNote}`
    : `[STOK AKTUAL] ${stockNote}`;

  const payload = {
    idCabang: state.branchId,
    catatan,
    items: items.map((i) => ({
      kode: i.kode,
      nama: i.nama,
      kategori: i.kategori,
      qty: i.qty,
      satuan: i.satuan,
      harga: i.harga,
      stokGudang: i.stokGudang,
      stokToko: i.stokToko,
    })),
  };

  try {
    const result = await ordersApi.submit(payload);

    if (result.status === 'ok') {
      state.cart = {};
      const noteInput = $('cartNoteInput');
      if (noteInput) noteInput.value = '';

      closeCart();
      updateCartUi(state);

      const { updateCatalog } = await import('./catalog-page.js');
      updateCatalog(state);

      toast.success('Order berhasil dikirim!', { duration: 4000 });

      setTimeout(() => {
        const historyTab = document.querySelector('[data-tab="history"]');
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
      submitBtn.innerHTML = originalText || `${icon('send', { size: 18 })} Kirim Order ke Gudang`;
    }
  }
}