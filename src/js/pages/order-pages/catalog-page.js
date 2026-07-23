/* ═══════════════════════════════════════════════════════════════════════
   CATALOG PAGE — Katalog barang dengan filter kategori & search
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, debounce, toInt, unique } from '../../utils.js';
import { getKategoriIcon } from '../../config.js';
import { toast } from '../../ui.js';
import { addToCart, updateCartUi } from './cart.js';

// State lokal
let localState = {
  searchQuery: '',
  activeCategory: '',
  visibleProducts: [],
  visibleCount: 0,
  itemsPerPage: 40,
};

// ─────────────────────────────────────────────────────────────────────────
// RENDER (initial HTML)
// ─────────────────────────────────────────────────────────────────────────

export function renderCatalogPage(state) {
  return `
    <div class="search-wrap">
      <div class="search-box">
        <span class="search-icon">🔍</span>
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
// INIT (dipanggil sekali setelah render)
// ─────────────────────────────────────────────────────────────────────────

export function initCatalog(state) {
  // Search
  const searchInput = $('searchInput');
  if (searchInput) {
    const handleSearch = debounce((e) => {
      localState.searchQuery = e.target.value;
      filterCatalog(state);
      renderCatalog(state);
    }, 200);

    searchInput.addEventListener('input', handleSearch);
  }

  // Filter chip click (delegation)
  $('filterScroll')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-category]');
    if (!chip) return;

    localState.activeCategory = chip.dataset.category || '';

    document.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');

    filterCatalog(state);
    renderCatalog(state);
  });

  // Catalog grid actions (delegation)
  $('catalogGrid')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const code = target.dataset.code;
    const action = target.dataset.action;

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

  // Qty input change
  $('catalogGrid')?.addEventListener('change', (e) => {
    const target = e.target.closest('[data-action="set-qty"]');
    if (!target) return;

    setQty(state, target.dataset.code, target.value);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE (dipanggil setelah data ready)
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
  const wrapper = $('filterScroll');
  if (!wrapper) return;

  const categories = unique(
    state.allProducts
      .map((p) => String(p.KATEGORI || '').trim())
      .filter(Boolean)
  ).sort();

  wrapper.innerHTML = `
    <button class="filter-chip ${localState.activeCategory === '' ? 'active' : ''}"
            type="button" data-category="">
      Semua
    </button>
    ${categories.map((cat) => `
      <button class="filter-chip ${localState.activeCategory === cat ? 'active' : ''}"
              type="button" data-category="${escapeHtml(cat)}">
        ${getKategoriIcon(cat)} ${escapeHtml(cat)}
      </button>
    `).join('')}
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// FILTER & RENDER
// ─────────────────────────────────────────────────────────────────────────

function filterCatalog(state) {
  const query = localState.searchQuery.toLowerCase().trim();
  const activeCat = localState.activeCategory.toLowerCase();

  localState.visibleProducts = state.allProducts.filter((product) => {
    const code = String(product.KODE_BARANG || '').toLowerCase();
    const name = String(product.NAMA_BARANG || '').toLowerCase();
    const category = String(product.KATEGORI || '').toLowerCase();

    const searchMatch = !query
      || code.includes(query)
      || name.includes(query)
      || category.includes(query);

    const categoryMatch = !activeCat || category === activeCat;

    return searchMatch && categoryMatch;
  });
}

function renderCatalog(state) {
  const grid = $('catalogGrid');
  const label = $('sectionLabel');
  if (!grid) return;

  const count = localState.visibleProducts.length;
  const firstBatch = localState.visibleProducts.slice(0, localState.itemsPerPage);
  const remaining = count - firstBatch.length;

  if (label) label.textContent = `Katalog Barang · ${count} item`;

  localState.visibleCount = firstBatch.length;

  if (!count) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>Barang tidak ditemukan.</p>
        ${localState.searchQuery || localState.activeCategory ? `
          <button class="secondary-button" id="clearFilterBtn" type="button" style="margin-top: 12px;">
            🔄 Reset Filter
          </button>
        ` : ''}
      </div>
    `;

    $('clearFilterBtn')?.addEventListener('click', () => {
      localState.searchQuery = '';
      localState.activeCategory = '';
      const searchInput = $('searchInput');
      if (searchInput) searchInput.value = '';
      buildCategoryFilters(state);
      filterCatalog(state);
      renderCatalog(state);
    });

    return;
  }

  grid.innerHTML = firstBatch.map((p) => buildProductCard(p, state)).join('');

  if (remaining > 0) {
    appendLoadMoreButton(remaining);
  }
}

function buildProductCard(product, state) {
  const code = String(product.KODE_BARANG || '');
  const name = String(product.NAMA_BARANG || '');
  const category = String(product.KATEGORI || '');
  const unit = String(product.SATUAN || 'PCS');
  const price = parseFloat(product.HARGA) || 0;
  const stock = toInt(product.STOK);
  const quantity = state.cart[code]?.qty || 1;
  const inCart = Boolean(state.cart[code]);

  const stockClass = stock === 0 ? 'stock-empty'
                   : stock <= 5 ? 'stock-low'
                   : 'stock-ok';
  const stockText = stock === 0 ? 'Habis'
                  : stock <= 5 ? `Sisa ${stock}`
                  : `Stok: ${stock}`;

  const escCode = escapeHtml(code);

  return `
    <article class="item-card ${inCart ? 'in-cart' : ''}" id="card-${escCode}">
      <span class="item-stock-badge ${stockClass}">${stockText}</span>
      <span class="item-emoji">${getKategoriIcon(category)}</span>
      <div class="item-code">${escCode}</div>
      <div class="item-name">${escapeHtml(name)}</div>
      <div class="item-category">${escapeHtml(category)}</div>
      <div class="item-price">${formatRupiah(price)}</div>
      <div class="item-unit">per ${escapeHtml(unit)}</div>

      <div class="quantity-control">
        <button class="quantity-button" type="button" data-action="decrease" data-code="${escCode}">−</button>
        <input class="quantity-input"
               id="qty-${escCode}"
               type="number"
               min="1"
               max="${stock || 9999}"
               value="${quantity}"
               data-action="set-qty"
               data-code="${escCode}">
        <button class="quantity-button" type="button" data-action="increase" data-code="${escCode}">+</button>
      </div>

      <button class="add-button ${inCart ? 'added' : ''}"
              type="button"
              ${stock === 0 ? 'disabled' : ''}
              data-action="add"
              data-code="${escCode}">
        ${inCart ? '✅ Di Keranjang' : '+ Tambah'}
      </button>
    </article>
  `;
}

function appendLoadMoreButton(remaining) {
  const wrapper = document.createElement('div');
  wrapper.dataset.loadMore = 'true';
  wrapper.style.cssText = 'grid-column: 1 / -1; padding: 20px; text-align: center;';
  wrapper.innerHTML = `
    <button class="secondary-button" type="button" data-action="load-more">
      Tampilkan ${remaining} lainnya ▼
    </button>
  `;
  $('catalogGrid')?.appendChild(wrapper);
}

function loadMore(state) {
  document.querySelector('[data-load-more]')?.remove();

  const nextBatch = localState.visibleProducts.slice(
    localState.visibleCount,
    localState.visibleCount + localState.itemsPerPage
  );

  const cardsHtml = nextBatch.map((p) => buildProductCard(p, state)).join('');
  $('catalogGrid')?.insertAdjacentHTML('beforeend', cardsHtml);

  localState.visibleCount += nextBatch.length;

  const remaining = localState.visibleProducts.length - localState.visibleCount;
  if (remaining > 0) {
    appendLoadMoreButton(remaining);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CART ACTIONS
// ─────────────────────────────────────────────────────────────────────────

function clampQty(state, code, value) {
  const product = state.productByCode[String(code).toUpperCase()];
  const stock = product ? toInt(product.STOK) : 0;
  let qty = Math.max(1, toInt(value, 1));

  if (stock > 0 && qty > stock) {
    qty = stock;
    toast.info(`⚠️ Maksimal stok ${stock}.`);
  }

  return qty;
}

function addItemToCart(state, code) {
  const product = state.productByCode[String(code).toUpperCase()];

  if (!product) {
    toast.error('❌ Barang tidak ditemukan.');
    return;
  }

  const stock = toInt(product.STOK);
  if (stock === 0) {
    toast.error('❌ Stok habis.');
    return;
  }

  const input = $(`qty-${code}`);
  const quantity = clampQty(state, code, input?.value || 1);

  state.cart[code] = {
    kode: code,
    nama: String(product.NAMA_BARANG || ''),
    kategori: String(product.KATEGORI || ''),
    harga: parseFloat(product.HARGA) || 0,
    satuan: String(product.SATUAN || 'PCS'),
    qty: quantity,
    stokGudang: '',
    stokToko: '',
  };

  updateCartUi(state);
  renderCatalog(state);
  toast.success('✅ Ditambah ke keranjang.', { duration: 1500 });
}

function changeQty(state, code, delta) {
  const input = $(`qty-${code}`);
  const currentQty = toInt(input?.value, 1);
  const newQty = clampQty(state, code, currentQty + delta);

  if (input) input.value = newQty;

  if (state.cart[code]) {
    state.cart[code].qty = newQty;
    updateCartUi(state);
  }
}

function setQty(state, code, value) {
  const newQty = clampQty(state, code, value);
  const input = $(`qty-${code}`);

  if (input) input.value = newQty;

  if (state.cart[code]) {
    state.cart[code].qty = newQty;
    updateCartUi(state);
  }
}
