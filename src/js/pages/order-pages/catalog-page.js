/* ═══════════════════════════════════════════════════════════════════════
   CATALOG PAGE — with Lucide Icons + Satuan Selector
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, debounce, toInt, unique } from '../../utils.js';
import { icon, kategoriIcon, injectIcons } from '../../icons.js';
import { toast } from '../../ui.js';
import { addToCart, updateCartUi } from './cart.js';

// Daftar satuan yang bisa dipilih
var SATUAN_OPTIONS = [
  'PCS',
  'DUS',
  'KRG',
  'SET',
  'PACK',
  'IKAT',
  'GROSS',
];

var localState = {
  searchQuery: '',
  activeCategory: '',
  visibleProducts: [],
  visibleCount: 0,
  itemsPerPage: 40,
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
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initCatalog(state) {

  // Search
  var searchInput = $('searchInput');

  if (searchInput) {

    var handleSearch = debounce(function (e) {
      localState.searchQuery = e.target.value;
      filterCatalog(state);
      renderCatalog(state);
    }, 200);

    searchInput.addEventListener('input', handleSearch);
  }

  // Filter chip click
  $('filterScroll')?.addEventListener('click', function (e) {

    var chip = e.target.closest('[data-category]');
    if (!chip) return;

    localState.activeCategory = chip.dataset.category || '';

    document.querySelectorAll('.filter-chip').forEach(function (c) {
      c.classList.remove('active');
    });

    chip.classList.add('active');

    filterCatalog(state);
    renderCatalog(state);
  });

  // Catalog grid CLICK actions
  $('catalogGrid')?.addEventListener('click', function (e) {

    var target = e.target.closest('[data-action]');
    if (!target) return;

    var code = target.dataset.code;
    var action = target.dataset.action;

    if (action === 'add') {
      addItemToCart(state, code);
    } else if (action === 'increase') {
      changeQty(state, code, 1);
    } else if (action === 'decrease') {
      changeQty(state, code, -1);
    } else if (action === 'load-more') {
      loadMore(state);
    }
  });

  // Catalog grid CHANGE events (qty + satuan)
  $('catalogGrid')?.addEventListener('change', function (e) {

    // Qty change
    var qtyTarget = e.target.closest('[data-action="set-qty"]');
    if (qtyTarget) {
      setQty(state, qtyTarget.dataset.code, qtyTarget.value);
      return;
    }

    // Satuan change
    var satuanTarget = e.target.closest('[data-action="set-satuan"]');
    if (satuanTarget) {

      var code = satuanTarget.dataset.code;

      // Update cart kalau sudah ada di cart
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
  filterCatalog(state);
  renderCatalog(state);
}

// ─────────────────────────────────────────────────────────────────────────
// CATEGORY FILTERS
// ─────────────────────────────────────────────────────────────────────────

function buildCategoryFilters(state) {

  var wrapper = $('filterScroll');
  if (!wrapper) return;

  var categories = unique(
    state.allProducts
      .map(function (p) {
        return String(p.KATEGORI || '').trim();
      })
      .filter(Boolean)
  ).sort();

  wrapper.innerHTML = ''
    + '<button class="filter-chip '
    + (localState.activeCategory === '' ? 'active' : '')
    + '" type="button" data-category="">'
    + icon('list', { size: 14 })
    + ' Semua'
    + '</button>'
    + categories.map(function (cat) {
        return '<button class="filter-chip '
          + (localState.activeCategory === cat ? 'active' : '')
          + '" type="button" data-category="' + escapeHtml(cat) + '">'
          + kategoriIcon(cat, { size: 14 })
          + ' ' + escapeHtml(cat)
          + '</button>';
      }).join('');
}

// ─────────────────────────────────────────────────────────────────────────
// FILTER & RENDER
// ─────────────────────────────────────────────────────────────────────────

function filterCatalog(state) {

  var query = localState.searchQuery.toLowerCase().trim();
  var activeCat = localState.activeCategory.toLowerCase();

  localState.visibleProducts = state.allProducts.filter(function (product) {

    var code = String(product.KODE_BARANG || '').toLowerCase();
    var name = String(product.NAMA_BARANG || '').toLowerCase();
    var category = String(product.KATEGORI || '').toLowerCase();

    var searchMatch = !query
      || code.indexOf(query) !== -1
      || name.indexOf(query) !== -1
      || category.indexOf(query) !== -1;

    var categoryMatch = !activeCat || category === activeCat;

    return searchMatch && categoryMatch;
  });
}


function renderCatalog(state) {

  var grid = $('catalogGrid');
  var label = $('sectionLabel');
  if (!grid) return;

  var count = localState.visibleProducts.length;
  var firstBatch = localState.visibleProducts.slice(0, localState.itemsPerPage);
  var remaining = count - firstBatch.length;

  if (label) {
    label.textContent = 'Katalog Barang · ' + count + ' item';
  }

  localState.visibleCount = firstBatch.length;

  if (!count) {

    grid.innerHTML = ''
      + '<div class="empty-state">'
      + '<div class="empty-icon">'
      + icon('search', { size: 48, color: 'var(--muted)' })
      + '</div>'
      + '<p>Barang tidak ditemukan.</p>'
      + (localState.searchQuery || localState.activeCategory
        ? '<button class="secondary-button" id="clearFilterBtn" type="button" style="margin-top: 12px;">'
          + icon('refresh', { size: 14 })
          + ' Reset Filter'
          + '</button>'
        : '')
      + '</div>';

    $('clearFilterBtn')?.addEventListener('click', function () {
      localState.searchQuery = '';
      localState.activeCategory = '';
      var searchInput = $('searchInput');
      if (searchInput) searchInput.value = '';
      buildCategoryFilters(state);
      filterCatalog(state);
      renderCatalog(state);
    });

    return;
  }

  grid.innerHTML = firstBatch.map(function (p) {
    return buildProductCard(p, state);
  }).join('');

  if (remaining > 0) {
    appendLoadMoreButton(remaining);
  }
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

  var stockClass = stock === 0 ? 'stock-empty'
                 : stock <= 5 ? 'stock-low'
                 : 'stock-ok';

  var stockText = stock === 0 ? 'Habis'
                : stock <= 5 ? 'Sisa ' + stock
                : 'Stok: ' + stock;

  var escCode = escapeHtml(code);

  // Build satuan options
  var satuanOptionsHtml = SATUAN_OPTIONS.map(function (s) {
    var selected = (s === cartSatuan) ? ' selected' : '';
    return '<option value="' + s + '"' + selected + '>' + s + '</option>';
  }).join('');

  return ''
    + '<article class="item-card ' + (inCart ? 'in-cart' : '') + '" id="card-' + escCode + '">'

    + '<span class="item-stock-badge ' + stockClass + '">' + stockText + '</span>'

    + '<div class="item-icon">'
    + kategoriIcon(category, { size: 24 })
    + '</div>'

    + '<div class="item-code">' + escCode + '</div>'
    + '<div class="item-name">' + escapeHtml(name) + '</div>'
    + '<div class="item-category">' + escapeHtml(category) + '</div>'
    + '<div class="item-price">' + formatRupiah(price) + '</div>'
    + '<div class="item-unit">per ' + escapeHtml(unit) + '</div>'

    // Quantity control
    + '<div class="quantity-control">'
    + '<button class="quantity-button" type="button" data-action="decrease" data-code="' + escCode + '">'
    + icon('minus', { size: 14 })
    + '</button>'
    + '<input class="quantity-input"'
    + ' id="qty-' + escCode + '"'
    + ' type="number"'
    + ' min="1"'
    + ' max="' + (stock || 9999) + '"'
    + ' value="' + quantity + '"'
    + ' data-action="set-qty"'
    + ' data-code="' + escCode + '">'
    + '<button class="quantity-button" type="button" data-action="increase" data-code="' + escCode + '">'
    + icon('plus', { size: 14 })
    + '</button>'
    + '</div>'

    // Satuan selector
    + '<div class="satuan-control">'
    + '<span class="satuan-label">Satuan:</span>'
    + '<select class="satuan-select"'
    + ' id="satuan-' + escCode + '"'
    + ' data-action="set-satuan"'
    + ' data-code="' + escCode + '">'
    + satuanOptionsHtml
    + '</select>'
    + '</div>'

    // Add button
    + '<button class="add-button ' + (inCart ? 'added' : '') + '"'
    + ' type="button"'
    + (stock === 0 ? ' disabled' : '')
    + ' data-action="add"'
    + ' data-code="' + escCode + '">'
    + (inCart
      ? icon('check', { size: 14 }) + ' Di Keranjang'
      : icon('plus', { size: 14 }) + ' Tambah')
    + '</button>'

    + '</article>';
}


function appendLoadMoreButton(remaining) {

  var wrapper = document.createElement('div');

  wrapper.dataset.loadMore = 'true';
  wrapper.style.cssText = 'grid-column: 1 / -1; padding: 20px; text-align: center;';

  wrapper.innerHTML = ''
    + '<button class="secondary-button" type="button" data-action="load-more">'
    + icon('chevron-down', { size: 14 })
    + ' Tampilkan ' + remaining + ' lainnya'
    + '</button>';

  $('catalogGrid')?.appendChild(wrapper);
}


function loadMore(state) {

  document.querySelector('[data-load-more]')?.remove();

  var nextBatch = localState.visibleProducts.slice(
    localState.visibleCount,
    localState.visibleCount + localState.itemsPerPage
  );

  var cardsHtml = nextBatch.map(function (p) {
    return buildProductCard(p, state);
  }).join('');

  $('catalogGrid')?.insertAdjacentHTML('beforeend', cardsHtml);

  localState.visibleCount += nextBatch.length;

  var remaining = localState.visibleProducts.length - localState.visibleCount;

  if (remaining > 0) {
    appendLoadMoreButton(remaining);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CART ACTIONS
// ─────────────────────────────────────────────────────────────────────────

function clampQty(state, code, value) {

  var product = state.productByCode[String(code).toUpperCase()];
  var stock = product ? toInt(product.STOK) : 0;
  var qty = Math.max(1, toInt(value, 1));

  if (stock > 0 && qty > stock) {
    qty = stock;
    toast.info('Maksimal stok ' + stock + '.');
  }

  return qty;
}


function addItemToCart(state, code) {

  var product = state.productByCode[String(code).toUpperCase()];

  if (!product) {
    toast.error('Barang tidak ditemukan.');
    return;
  }

  var stock = toInt(product.STOK);

  if (stock === 0) {
    toast.error('Stok habis.');
    return;
  }

  var input = $('qty-' + code);
  var quantity = clampQty(state, code, input?.value || 1);

  // Ambil satuan yang dipilih user
  var satuanSelect = $('satuan-' + code);
  var selectedSatuan = satuanSelect
    ? satuanSelect.value
    : String(product.SATUAN || 'PCS');

  state.cart[code] = {
    kode: code,
    nama: String(product.NAMA_BARANG || ''),
    kategori: String(product.KATEGORI || ''),
    harga: parseFloat(product.HARGA) || 0,
    satuan: selectedSatuan,
    qty: quantity,
    stokGudang: '',
    stokToko: '',
  };

  updateCartUi(state);
  renderCatalog(state);
  toast.success('Ditambah ke keranjang.', { duration: 1500 });
}


function changeQty(state, code, delta) {

  var input = $('qty-' + code);
  var currentQty = toInt(input?.value, 1);
  var newQty = clampQty(state, code, currentQty + delta);

  if (input) {
    input.value = newQty;
  }

  if (state.cart[code]) {
    state.cart[code].qty = newQty;
    updateCartUi(state);
  }
}


function setQty(state, code, value) {

  var newQty = clampQty(state, code, value);
  var input = $('qty-' + code);

  if (input) {
    input.value = newQty;
  }

  if (state.cart[code]) {
    state.cart[code].qty = newQty;
    updateCartUi(state);
  }
}
