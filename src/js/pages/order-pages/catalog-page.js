/* ═══════════════════════════════════════════════════════════════════════
   CATALOG PAGE — Tab Barang Manual + Edit Item Manual
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, debounce, toInt, unique } from '../../utils.js';
import { icon, kategoriIcon, injectIcons } from '../../icons.js';
import { toast } from '../../ui.js';
import { addToCart, updateCartUi } from './cart.js';

var SATUAN_OPTIONS = ['PCS', 'DUS', 'KRG', 'SET', 'PACK', 'IKAT', 'GROSS'];

var KATEGORI_MANUAL = [
  'PLASTIK', 'ELEKTRONIK', 'ALUMUNIUM', 'STAINLESS', 'KACA',
  'BATU', 'KAYU', 'BESI', 'KAIN', 'KERAMIK', 'LAINNYA'
];

var localState = {
  searchQuery: '',
  activeCategory: '',
  visibleProducts: [],
  visibleCount: 0,
  itemsPerPage: 40,
  editingKey: null,  // ★ Key item yang sedang di-edit
};

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

export function renderCatalogPage(state) {
  return `
    <div class="search-wrap">
      <div class="search-box">
        <span class="search-icon" data-icon="search" data-icon-size="16"></span>
        <input
          id="searchInput"
          type="search"
          placeholder="Cari kode atau nama barang..."
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        >
      </div>
    </div>

    <div class="filter-scroll" id="filterScroll">
      <button class="filter-chip active" type="button" data-category="">
        ${icon('list', { size: 14 })}
        Semua
      </button>
      <button class="filter-chip filter-chip-manual" type="button" data-category="__MANUAL__">
        ${icon('edit', { size: 14 })}
        Barang Manual
      </button>
    </div>

    <div class="section-label" id="sectionLabel">
      Memuat katalog...
    </div>

    <div class="catalog-grid" id="catalogGrid">
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div>Memuat katalog barang...</div>
      </div>
    </div>

    <div id="manualFormWrapper" style="display: none;"></div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initCatalog(state) {

  var searchInput = $('searchInput');

  if (searchInput) {
    var handleSearch = debounce(function (e) {
      localState.searchQuery = e.target.value;

      if (localState.activeCategory === '__MANUAL__') {
        localState.activeCategory = '';
        hideManualForm();
        buildCategoryFilters(state);
      }

      filterCatalog(state);
      renderCatalog(state);
    }, 200);

    searchInput.addEventListener('input', handleSearch);
  }

  $('filterScroll')?.addEventListener('click', function (e) {
    var chip = e.target.closest('[data-category]');
    if (!chip) return;

    localState.activeCategory = chip.dataset.category || '';

    document.querySelectorAll('.filter-chip').forEach(function (c) {
      c.classList.remove('active');
    });

    chip.classList.add('active');

    if (localState.activeCategory === '__MANUAL__') {
      showManualForm(state);
    } else {
      hideManualForm();
      filterCatalog(state);
      renderCatalog(state);
    }
  });

  $('catalogGrid')?.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;

    var code = target.dataset.code;
    var action = target.dataset.action;

    if (action === 'add') addItemToCart(state, code);
    else if (action === 'increase') changeQty(state, code, 1);
    else if (action === 'decrease') changeQty(state, code, -1);
    else if (action === 'load-more') loadMore(state);
  });

  $('catalogGrid')?.addEventListener('change', function (e) {
    var qtyTarget = e.target.closest('[data-action="set-qty"]');
    if (qtyTarget) {
      setQty(state, qtyTarget.dataset.code, qtyTarget.value);
      return;
    }

    var satuanTarget = e.target.closest('[data-action="set-satuan"]');
    if (satuanTarget) {
      var code = satuanTarget.dataset.code;
      if (state.cart[code]) {
        state.cart[code].satuan = satuanTarget.value;
        updateCartUi(state);
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────

export function updateCatalog(state) {
  buildCategoryFilters(state);

  if (localState.activeCategory !== '__MANUAL__') {
    filterCatalog(state);
    renderCatalog(state);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CATEGORY FILTERS
// ─────────────────────────────────────────────────────────────────────────

function buildCategoryFilters(state) {
  var wrapper = $('filterScroll');
  if (!wrapper) return;

  var categories = unique(
    state.allProducts
      .map(function (p) { return String(p.KATEGORI || '').trim(); })
      .filter(Boolean)
  ).sort();

  var html = ''
    + '<button class="filter-chip '
    + (localState.activeCategory === '' ? 'active' : '')
    + '" type="button" data-category="">'
    + icon('list', { size: 14 })
    + ' Semua'
    + '</button>'
    + '<button class="filter-chip filter-chip-manual '
    + (localState.activeCategory === '__MANUAL__' ? 'active' : '')
    + '" type="button" data-category="__MANUAL__">'
    + icon('edit', { size: 14 })
    + ' Barang Manual'
    + '</button>'
    + categories.map(function (cat) {
        return '<button class="filter-chip '
          + (localState.activeCategory === cat ? 'active' : '')
          + '" type="button" data-category="' + escapeHtml(cat) + '">'
          + kategoriIcon(cat, { size: 14 })
          + ' ' + escapeHtml(cat)
          + '</button>';
      }).join('');

  wrapper.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────
// FILTER & RENDER CATALOG
// ─────────────────────────────────────────────────────────────────────────

function filterCatalog(state) {
  var query = localState.searchQuery.toLowerCase().trim();
  var activeCat = localState.activeCategory.toLowerCase();

  localState.visibleProducts = state.allProducts.filter(function (product) {
    var code = String(product.KODE_BARANG || '').toLowerCase();
    var name = String(product.NAMA_BARANG || '').toLowerCase();
    var category = String(product.KATEGORI || '').toLowerCase();

    var searchMatch = !query || code.indexOf(query) !== -1 || name.indexOf(query) !== -1 || category.indexOf(query) !== -1;
    var categoryMatch = !activeCat || category === activeCat;

    return searchMatch && categoryMatch;
  });
}

function renderCatalog(state) {
  var grid = $('catalogGrid');
  var label = $('sectionLabel');
  if (!grid) return;

  grid.style.display = '';
  if (label) label.style.display = '';

  var count = localState.visibleProducts.length;
  var firstBatch = localState.visibleProducts.slice(0, localState.itemsPerPage);
  var remaining = count - firstBatch.length;

  if (label) label.textContent = 'Katalog Barang · ' + count + ' item';

  localState.visibleCount = firstBatch.length;

  if (!count) {
    grid.innerHTML = ''
      + '<div class="empty-state">'
      + '<div class="empty-icon">' + icon('search', { size: 48, color: 'var(--muted)' }) + '</div>'
      + '<p>Barang tidak ditemukan.</p>'
      + (localState.searchQuery || localState.activeCategory
        ? '<button class="secondary-button" id="clearFilterBtn" type="button" style="margin-top: 12px;">'
          + icon('refresh', { size: 14 }) + ' Reset Filter</button>'
        : '')
      + '</div>';

    $('clearFilterBtn')?.addEventListener('click', function () {
      localState.searchQuery = '';
      localState.activeCategory = '';
      var searchInput = $('searchInput');
      if (searchInput) searchInput.value = '';
      hideManualForm();
      buildCategoryFilters(state);
      filterCatalog(state);
      renderCatalog(state);
    });
    return;
  }

  grid.innerHTML = firstBatch.map(function (p) {
    return buildProductCard(p, state);
  }).join('');

  if (remaining > 0) appendLoadMoreButton(remaining);
}

function buildProductCard(product, state) {
  var code = String(product.KODE_BARANG || '');
  var name = String(product.NAMA_BARANG || '');
  var category = String(product.KATEGORI || '');
  var unit = String(product.SATUAN || 'PCS').toUpperCase();
  var price = parseFloat(product.HARGA) || 0;
  var stock = toInt(product.STOK);
  var quantity = state.cart[code] ? state.cart[code].qty : 1;
  var cartSatuan = state.cart[code] ? state.cart[code].satuan : unit;
  var inCart = Boolean(state.cart[code]);
  var stockClass = stock === 0 ? 'stock-empty' : stock <= 5 ? 'stock-low' : 'stock-ok';
  var stockText = stock === 0 ? 'Habis' : stock <= 5 ? 'Sisa ' + stock : 'Stok: ' + stock;
  var escCode = escapeHtml(code);

  // ★ Gambar produk (fallback ke icon kategori)
    var imgSrc = './images/produk/' + code.toUpperCase() + '.webp';

  var satuanOptionsHtml = SATUAN_OPTIONS.map(function (s) {
    var selected = (s === cartSatuan) ? ' selected' : '';
    return '<option value="' + s + '"' + selected + '>' + s + '</option>';
  }).join('');

  return ''
    + '<article class="item-card ' + (inCart ? 'in-cart' : '') + '" id="card-' + escCode + '">'
    + '<span class="item-stock-badge ' + stockClass + '">' + stockText + '</span>'

    // ★ GAMBAR PRODUK dengan fallback
    + '<div class="item-image-wrap">'
    + '<img class="item-image" src="' + imgSrc + '" alt="' + escapeHtml(name) + '" loading="lazy"'
    + ' onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'grid\';">'
    + '<div class="item-icon-fallback" style="display:none;">'
    + kategoriIcon(category, { size: 24 })
    + '</div>'
    + '</div>'

    + '<div class="item-code">' + escCode + '</div>'
    + '<div class="item-name">' + escapeHtml(name) + '</div>'
    + '<div class="item-category">' + escapeHtml(category) + '</div>'
    + '<div class="item-price">' + formatRupiah(price) + '</div>'
    + '<div class="item-unit">per ' + escapeHtml(unit) + '</div>'
    + '<div class="quantity-control">'
    + '<button class="quantity-button" type="button" data-action="decrease" data-code="' + escCode + '">' + icon('minus', { size: 14 }) + '</button>'
    + '<input class="quantity-input" id="qty-' + escCode + '" type="number" min="1" value="' + quantity + '" data-action="set-qty" data-code="' + escCode + '">'
    + '<button class="quantity-button" type="button" data-action="increase" data-code="' + escCode + '">' + icon('plus', { size: 14 }) + '</button>'
    + '</div>'
    + '<div class="satuan-control"><span class="satuan-label">Satuan:</span>'
    + '<select class="satuan-select" id="satuan-' + escCode + '" data-action="set-satuan" data-code="' + escCode + '">' + satuanOptionsHtml + '</select></div>'
    + '<button class="add-button ' + (inCart ? 'added' : '') + '" type="button" data-action="add" data-code="' + escCode + '">'
    + (inCart ? icon('check', { size: 14 }) + ' Di Keranjang' : icon('plus', { size: 14 }) + ' Tambah')
    + '</button>'
    + '</article>';
}
function appendLoadMoreButton(remaining) {
  var wrapper = document.createElement('div');
  wrapper.dataset.loadMore = 'true';
  wrapper.style.cssText = 'grid-column: 1 / -1; padding: 20px; text-align: center;';
  wrapper.innerHTML = '<button class="secondary-button" type="button" data-action="load-more">'
    + icon('chevron-down', { size: 14 }) + ' Tampilkan ' + remaining + ' lainnya</button>';
  $('catalogGrid')?.appendChild(wrapper);
}

function loadMore(state) {
  document.querySelector('[data-load-more]')?.remove();
  var nextBatch = localState.visibleProducts.slice(localState.visibleCount, localState.visibleCount + localState.itemsPerPage);
  $('catalogGrid')?.insertAdjacentHTML('beforeend', nextBatch.map(function (p) { return buildProductCard(p, state); }).join(''));
  localState.visibleCount += nextBatch.length;
  var remaining = localState.visibleProducts.length - localState.visibleCount;
  if (remaining > 0) appendLoadMoreButton(remaining);
}

// ─────────────────────────────────────────────────────────────────────────
// CART ACTIONS
// ─────────────────────────────────────────────────────────────────────────

function normalizeQty(value) { return Math.max(1, toInt(value, 1)); }

function addItemToCart(state, code) {
  var product = state.productByCode[String(code).toUpperCase()];
  if (!product) { toast.error('Barang tidak ditemukan.'); return; }

  var input = $('qty-' + code);
  var quantity = normalizeQty(input?.value || 1);
  var satuanSelect = $('satuan-' + code);
  var selectedSatuan = satuanSelect ? satuanSelect.value : String(product.SATUAN || 'PCS');

  state.cart[code] = {
    kode: code, nama: String(product.NAMA_BARANG || ''), kategori: String(product.KATEGORI || ''),
    harga: parseFloat(product.HARGA) || 0, satuan: selectedSatuan, qty: quantity,
    stokSistem: toInt(product.STOK), stokGudang: '', stokToko: '', isManual: false, catatanItem: '',
  };

  updateCartUi(state);
  renderCatalog(state);
  toast.success('Ditambah ke keranjang.', { duration: 1500 });
}

function changeQty(state, code, delta) {
  var input = $('qty-' + code);
  var newQty = normalizeQty(toInt(input?.value, 1) + delta);
  if (input) input.value = newQty;
  if (state.cart[code]) { state.cart[code].qty = newQty; updateCartUi(state); }
}

function setQty(state, code, value) {
  var newQty = normalizeQty(value);
  var input = $('qty-' + code);
  if (input) input.value = newQty;
  if (state.cart[code]) { state.cart[code].qty = newQty; updateCartUi(state); }
}

// ═══════════════════════════════════════════════════════════════════════
// MANUAL FORM — Tambah & Edit barang baru
// ═══════════════════════════════════════════════════════════════════════

function showManualForm(state) {
  var grid = $('catalogGrid');
  var label = $('sectionLabel');
  if (grid) grid.style.display = 'none';
  if (label) label.style.display = 'none';

  localState.editingKey = null; // Reset edit mode

  var wrapper = $('manualFormWrapper');
  if (!wrapper) return;

  wrapper.style.display = 'block';
  renderManualFormContent(state, wrapper);
}

function hideManualForm() {
  var grid = $('catalogGrid');
  var label = $('sectionLabel');
  var wrapper = $('manualFormWrapper');

  if (grid) grid.style.display = '';
  if (label) label.style.display = '';
  if (wrapper) { wrapper.style.display = 'none'; wrapper.innerHTML = ''; }

  localState.editingKey = null;
}

function renderManualFormContent(state, wrapper) {

  var isEditing = localState.editingKey !== null;
  var editItem = isEditing ? state.cart[localState.editingKey] : null;

  var formTitle = isEditing ? '✏️ Edit Barang Manual' : '➕ Tambah Barang Manual';
  var btnText = isEditing ? 'Simpan Perubahan' : 'Tambah ke Keranjang';
  var btnIcon = isEditing ? icon('save', { size: 16 }) : icon('plus', { size: 16 });
  var btnClass = isEditing ? 'btn-save-manual-catalog' : 'btn-add-manual-catalog';

  // Pre-fill values kalau editing
  var vNama = editItem ? escapeHtml(editItem.nama) : '';
  var vKode = editItem ? escapeHtml(editItem.kode) : '';
  var vQty = editItem ? editItem.qty : 1;
  var vStokGudang = editItem ? (editItem.stokGudang !== '' ? editItem.stokGudang : '') : '';
  var vStokToko = editItem ? (editItem.stokToko !== '' ? editItem.stokToko : '') : '';

  var kategoriOptions = KATEGORI_MANUAL.map(function (k) {
    var selected = (editItem && editItem.kategori === k) ? ' selected' : '';
    return '<option value="' + k + '"' + selected + '>' + k + '</option>';
  }).join('');

  var satuanOptions = SATUAN_OPTIONS.map(function (s) {
    var selected = (editItem && editItem.satuan === s) ? ' selected' : '';
    return '<option value="' + s + '"' + selected + '>' + s + '</option>';
  }).join('');

  wrapper.innerHTML = ''
    + '<div class="manual-info-box">'
    + icon('alert-triangle', { size: 16, color: 'var(--warning)' })
    + ' <b>Barang Manual</b> — untuk barang baru yang belum ada di katalog. Harga otomatis Rp 0.'
    + '</div>'

    + '<div class="manual-form-catalog">'

    // ★ Form Title (berubah saat edit)
    + '<div class="manual-form-title">'
    + formTitle
    + (isEditing ? '<button class="manual-cancel-edit" id="btnCancelEdit" type="button">' + icon('close', { size: 14 }) + ' Batal Edit</button>' : '')
    + '</div>'

    + '<div class="manual-form-row">'
    + '<div class="manual-field">'
    + '<label class="manual-label">Nama Barang <span style="color:var(--danger)">*</span></label>'
    + '<input type="text" class="manual-input" id="mfNama" placeholder="Contoh: Wajan Anti Lengket 30cm" value="' + vNama + '">'
    + '</div>'
    + '</div>'

    + '<div class="manual-form-row">'
    + '<div class="manual-field">'
    + '<label class="manual-label">Kode Barang (opsional)</label>'
    + '<input type="text" class="manual-input" id="mfKode" placeholder="Kosongkan atau isi - atau 0" value="' + vKode + '"' + (isEditing ? ' disabled style="opacity:0.5; cursor:not-allowed;"' : '') + '>'
    + '</div>'
    + '<div class="manual-field">'
    + '<label class="manual-label">Kategori</label>'
    + '<select class="manual-input" id="mfKategori">' + kategoriOptions + '</select>'
    + '</div>'
    + '</div>'

    + '<div class="manual-form-row">'
    + '<div class="manual-field">'
    + '<label class="manual-label">Jumlah <span style="color:var(--danger)">*</span></label>'
    + '<input type="number" class="manual-input" id="mfQty" min="1" value="' + vQty + '" placeholder="1">'
    + '</div>'
    + '<div class="manual-field">'
    + '<label class="manual-label">Satuan</label>'
    + '<select class="manual-input" id="mfSatuan">' + satuanOptions + '</select>'
    + '</div>'
    + '</div>'

    + '<div class="manual-form-row">'
    + '<div class="manual-field">'
    + '<label class="manual-label">' + icon('warehouse', { size: 12 }) + ' Stok Gudang <span style="color:var(--danger)">*</span></label>'
    + '<input type="number" class="manual-input" id="mfStokGudang" min="0" placeholder="0" value="' + vStokGudang + '">'
    + '</div>'
    + '<div class="manual-field">'
    + '<label class="manual-label">' + icon('store', { size: 12 }) + ' Stok Toko <span style="color:var(--danger)">*</span></label>'
    + '<input type="number" class="manual-input" id="mfStokToko" min="0" placeholder="0" value="' + vStokToko + '">'
    + '</div>'
    + '</div>'

    + '<button class="' + btnClass + '" id="btnManualAction" type="button">'
    + btnIcon + ' ' + btnText
    + '</button>'

    + '</div>'

    + '<div class="manual-added-title">'
    + icon('list', { size: 14 })
    + ' Barang Manual di Keranjang'
    + '</div>'
    + '<div id="manualAddedList"></div>';

  // Bind action button
  $('btnManualAction')?.addEventListener('click', function () {
    if (isEditing) {
      saveEditedManual(state);
    } else {
      addManualToCart(state);
    }
  });

  // Bind cancel edit
  $('btnCancelEdit')?.addEventListener('click', function () {
    localState.editingKey = null;
    renderManualFormContent(state, wrapper);
  });

  // Enter key di field terakhir
  $('mfStokToko')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isEditing) saveEditedManual(state);
      else addManualToCart(state);
    }
  });

  renderManualAddedList(state);

  setTimeout(function () { $('mfNama')?.focus(); }, 100);
}

// ─────────────────────────────────────────────────────────────────────────
// ADD MANUAL ITEM
// ─────────────────────────────────────────────────────────────────────────

function addManualToCart(state) {
  var nama = $('mfNama')?.value.trim() || '';
  var kode = $('mfKode')?.value.trim() || '';
  var kategori = $('mfKategori')?.value || 'LAINNYA';
  var qty = Math.max(1, toInt($('mfQty')?.value, 1));
  var satuan = $('mfSatuan')?.value || 'PCS';
  var stokGudang = $('mfStokGudang')?.value.trim();
  var stokToko = $('mfStokToko')?.value.trim();

  if (!nama) { toast.error('Nama barang wajib diisi.'); $('mfNama')?.focus(); return; }
  if (stokGudang === '' || stokToko === '') {
    toast.error('Stok gudang dan stok toko wajib diisi.');
    if (stokGudang === '') $('mfStokGudang')?.focus();
    else $('mfStokToko')?.focus();
    return;
  }

  var displayKode = kode || '-';
  var cartKey = kode;
  if (!cartKey || cartKey === '-' || cartKey === '0') {
    cartKey = '_manual_' + Date.now().toString().slice(-8) + '_' + Math.random().toString(36).slice(2, 6);
  }

  if (kode && kode !== '-' && kode !== '0' && state.cart[cartKey]) {
    toast.warning('Kode "' + kode + '" sudah ada di keranjang.'); $('mfKode')?.focus(); return;
  }

  state.cart[cartKey] = {
    kode: displayKode, nama: nama, kategori: kategori, harga: 0, satuan: satuan,
    qty: qty, stokSistem: 0, stokGudang: Math.max(0, toInt(stokGudang, 0)),
    stokToko: Math.max(0, toInt(stokToko, 0)), isManual: true, catatanItem: '', _cartKey: cartKey,
  };

  toast.success('"' + nama + '" ditambahkan ke keranjang.', { duration: 2000 });

  // Reset form
  $('mfNama').value = ''; $('mfKode').value = ''; $('mfQty').value = 1;
  $('mfStokGudang').value = ''; $('mfStokToko').value = '';
  $('mfNama')?.focus();

  updateCartUi(state);
  renderManualAddedList(state);
}

// ─────────────────────────────────────────────────────────────────────────
// ★ EDIT MANUAL ITEM
// ─────────────────────────────────────────────────────────────────────────

function startEditManual(state, cartKey) {
  localState.editingKey = cartKey;

  var wrapper = $('manualFormWrapper');
  if (wrapper) {
    renderManualFormContent(state, wrapper);
  }

  // Scroll ke form
  wrapper?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function saveEditedManual(state) {
  var key = localState.editingKey;
  if (!key || !state.cart[key]) {
    toast.error('Item tidak ditemukan.');
    return;
  }

  var nama = $('mfNama')?.value.trim() || '';
  var kategori = $('mfKategori')?.value || 'LAINNYA';
  var qty = Math.max(1, toInt($('mfQty')?.value, 1));
  var satuan = $('mfSatuan')?.value || 'PCS';
  var stokGudang = $('mfStokGudang')?.value.trim();
  var stokToko = $('mfStokToko')?.value.trim();

  if (!nama) { toast.error('Nama barang wajib diisi.'); $('mfNama')?.focus(); return; }
  if (stokGudang === '' || stokToko === '') {
    toast.error('Stok gudang dan stok toko wajib diisi.');
    if (stokGudang === '') $('mfStokGudang')?.focus();
    else $('mfStokToko')?.focus();
    return;
  }

  // Update item yang ada (kode tidak berubah)
  state.cart[key].nama = nama;
  state.cart[key].kategori = kategori;
  state.cart[key].qty = qty;
  state.cart[key].satuan = satuan;
  state.cart[key].stokGudang = Math.max(0, toInt(stokGudang, 0));
  state.cart[key].stokToko = Math.max(0, toInt(stokToko, 0));

  toast.success('"' + nama + '" berhasil diperbarui.', { duration: 2000 });

  // Kembali ke mode tambah
  localState.editingKey = null;

  updateCartUi(state);

  var wrapper = $('manualFormWrapper');
  if (wrapper) renderManualFormContent(state, wrapper);
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER MANUAL ADDED LIST (dengan tombol Edit)
// ─────────────────────────────────────────────────────────────────────────

function renderManualAddedList(state) {
  var wrapper = $('manualAddedList');
  if (!wrapper) return;

  var manualItems = [];
  var cartKeys = Object.keys(state.cart);

  for (var i = 0; i < cartKeys.length; i++) {
    var item = state.cart[cartKeys[i]];
    if (item.isManual) {
      manualItems.push({ item: item, key: cartKeys[i] });
    }
  }

  if (!manualItems.length) {
    wrapper.innerHTML = ''
      + '<div class="empty-state" style="border: 1px dashed var(--line-soft); border-radius: 14px; padding: 30px 20px;">'
      + '<div class="empty-icon" style="opacity:0.4;">' + icon('edit', { size: 40, color: 'var(--muted)' }) + '</div>'
      + '<div style="font-size: 13px;">Belum ada barang manual di keranjang.</div>'
      + '</div>';
    return;
  }

  wrapper.innerHTML = ''
    + '<div style="display: flex; gap: 8px; margin-bottom: 10px;">'
    + '<span style="padding: 4px 12px; border-radius: 20px; background: rgba(245,158,11,0.15); color: var(--warning); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">'
    + icon('edit', { size: 12 }) + ' ' + manualItems.length + ' barang manual</span></div>'
    + manualItems.map(function (entry) {
      var item = entry.item;
      var key = entry.key;
      var isCurrentEdit = (localState.editingKey === key);

      return ''
        + '<article class="manual-added-item' + (isCurrentEdit ? ' editing' : '') + '">'
        + '<div class="manual-added-icon">' + icon('edit', { size: 18, color: 'var(--warning)' }) + '</div>'
        + '<div class="manual-added-info">'
        + '<div class="manual-added-name">' + escapeHtml(item.nama) + '</div>'
        + '<div class="manual-added-meta">'
        + 'Kode: ' + escapeHtml(item.kode) + ' · ' + escapeHtml(item.kategori) + ' · '
        + item.qty + ' ' + escapeHtml(item.satuan) + '</div>'
        + '<div class="manual-added-stock">'
        + icon('warehouse', { size: 10 }) + ' Gudang: <b>' + item.stokGudang + '</b> · '
        + icon('store', { size: 10 }) + ' Toko: <b>' + item.stokToko + '</b></div>'
        + '</div>'
        + '<div class="manual-added-actions">'
        // ★ TOMBOL EDIT
        + '<button class="manual-added-edit" type="button" data-manual-edit="' + escapeHtml(key) + '" title="Edit">'
        + icon('edit-2', { size: 14 }) + '</button>'
        // TOMBOL HAPUS
        + '<button class="manual-added-delete" type="button" data-manual-remove="' + escapeHtml(key) + '" title="Hapus">'
        + icon('trash', { size: 14 }) + '</button>'
        + '</div>'
        + '</article>';
    }).join('');

  // Bind edit buttons
  wrapper.querySelectorAll('[data-manual-edit]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      startEditManual(state, btn.dataset.manualEdit);
    });
  });

  // Bind delete buttons
  wrapper.querySelectorAll('[data-manual-remove]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.dataset.manualRemove;

      // Kalau yang dihapus sedang di-edit, cancel edit
      if (localState.editingKey === key) {
        localState.editingKey = null;
        var formWrapper = $('manualFormWrapper');
        if (formWrapper) renderManualFormContent(state, formWrapper);
      }

      delete state.cart[key];
      updateCartUi(state);
      renderManualAddedList(state);
      toast.info('Dihapus dari keranjang.', { duration: 1500 });
    });
  });
}
