/* ═══════════════════════════════════════════════════════════════════════
   KATALOG PAGE — Master Barang
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, debounce, toInt, unique } from '../../utils.js';
import { getKategoriIcon } from '../../config.js';

let localState = {
  searchQuery: '',
  categoryFilter: '',
  filteredKatalog: [],
};

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

export function renderKatalogPage(state) {
  return `
    <header class="page-header">
      <h1>📚 Katalog Barang</h1>
      <p>Daftar master barang di gudang pusat</p>
    </header>

    <div class="filter-bar" id="katalogFilterBar">
      <div class="search-input-wrap">
        <span class="search-icon">🔍</span>
        <input
          class="search-input"
          id="katalogSearch"
          type="search"
          placeholder="Cari kode atau nama barang..."
          autocomplete="off"
        >
      </div>
    </div>

    <div class="filter-bar" id="katalogCategoryBar" style="margin-bottom: 20px;">
      <!-- Diisi oleh JS -->
    </div>

    <div class="stats-grid" id="katalogStats" style="grid-template-columns: repeat(4, 1fr); margin-bottom: 20px;">
      ${buildKatalogStat('Total Barang', 'katalogTotal', '📦', 'var(--orange)')}
      ${buildKatalogStat('Stok Aman', 'katalogOk', '✅', 'var(--success)')}
      ${buildKatalogStat('Stok Menipis', 'katalogLow', '⚠️', 'var(--warning)')}
      ${buildKatalogStat('Stok Habis', 'katalogEmpty', '❌', 'var(--danger)')}
    </div>

    <section class="panel">
      <div class="panel-body" style="padding: 0;">
        <div class="order-table-wrap">
          <table class="order-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Kode</th>
                <th>Nama</th>
                <th>Kategori</th>
                <th>Satuan</th>
                <th>Harga</th>
                <th>Stok</th>
              </tr>
            </thead>
            <tbody id="katalogBody">
              <tr>
                <td colspan="7">
                  <div class="empty-state">
                    <div class="spinner spinner-lg" style="color: var(--orange); margin-bottom: 12px;"></div>
                    <p>Memuat katalog...</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;
}

function buildKatalogStat(label, valueId, icon, color) {
  return `
    <article class="stat-card">
      <div class="stat-header">
        <div class="stat-label">${label}</div>
        <div class="stat-icon" style="background: ${color}20;">${icon}</div>
      </div>
      <div class="stat-value" id="${valueId}" style="color: ${color};">–</div>
    </article>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE DATA
// ─────────────────────────────────────────────────────────────────────────

export function updateKatalogData(state) {
  updateKatalogStats(state);
  renderCategoryChips(state);
  applyKatalogFilters(state);
  renderKatalogTable(state);
  bindKatalogEvents(state);
}

function updateKatalogStats(state) {
  const total = state.allKatalog.length;
  const empty = state.allKatalog.filter((item) => toInt(item.STOK) === 0).length;
  const low = state.allKatalog.filter((item) => {
    const stok = toInt(item.STOK);
    return stok > 0 && stok <= 5;
  }).length;
  const ok = total - empty - low;

  $('katalogTotal') && ($('katalogTotal').textContent = total);
  $('katalogOk') && ($('katalogOk').textContent = ok);
  $('katalogLow') && ($('katalogLow').textContent = low);
  $('katalogEmpty') && ($('katalogEmpty').textContent = empty);
}

function renderCategoryChips(state) {
  const container = $('katalogCategoryBar');
  if (!container) return;

  const categories = unique(
    state.allKatalog.map((item) => String(item.KATEGORI || '').trim()).filter(Boolean)
  ).sort();

  const chips = [
    { value: '', label: 'Semua Kategori' },
    ...categories.map((cat) => ({ value: cat, label: cat })),
  ];

  container.innerHTML = chips.map((chip) => `
    <button
      class="filter-btn${localState.categoryFilter === chip.value ? ' active' : ''}"
      type="button"
      data-category="${escapeHtml(chip.value)}"
    >
      ${chip.value ? getKategoriIcon(chip.value) + ' ' : ''}${escapeHtml(chip.label)}
    </button>
  `).join('');
}

function applyKatalogFilters(state) {
  const query = localState.searchQuery.toLowerCase().trim();

  localState.filteredKatalog = state.allKatalog.filter((item) => {
    const code = String(item.KODE_BARANG || '').toLowerCase();
    const name = String(item.NAMA_BARANG || '').toLowerCase();
    const category = String(item.KATEGORI || '');

    const searchMatch = !query || code.includes(query) || name.includes(query);
    const categoryMatch = !localState.categoryFilter || category === localState.categoryFilter;

    return searchMatch && categoryMatch;
  });
}

function renderKatalogTable(state) {
  const body = $('katalogBody');
  if (!body) return;

  if (!localState.filteredKatalog.length) {
    body.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <p>Tidak ada barang yang cocok</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = localState.filteredKatalog.map((item, index) => {
    const stok = toInt(item.STOK);
    const stokColor = stok === 0 ? 'var(--danger)'
                    : stok <= 5 ? 'var(--warning)'
                    : 'var(--success)';
    const stokBadge = stok === 0 ? 'Habis'
                    : stok <= 5 ? `Sisa ${stok}`
                    : stok;
    const kategori = String(item.KATEGORI || '-');
    const icon = getKategoriIcon(kategori);

    return `
      <tr>
        <td>${index + 1}</td>
        <td><span class="order-id">${escapeHtml(item.KODE_BARANG)}</span></td>
        <td>${escapeHtml(item.NAMA_BARANG)}</td>
        <td>
          <span class="cabang-badge">${icon} ${escapeHtml(kategori)}</span>
        </td>
        <td>${escapeHtml(item.SATUAN || '-')}</td>
        <td style="color: var(--orange); font-weight: 700;">
          ${formatRupiah(item.HARGA)}
        </td>
        <td style="color: ${stokColor}; font-weight: 700; text-align: center;">
          ${stokBadge}
        </td>
      </tr>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindKatalogEvents(state) {
  // Search
  const searchInput = $('katalogSearch');
  if (searchInput) {
    searchInput.value = localState.searchQuery;

    const handleSearch = debounce((e) => {
      localState.searchQuery = e.target.value;
      applyKatalogFilters(state);
      renderKatalogTable(state);
    }, 200);

    searchInput.addEventListener('input', handleSearch);
  }

  // Category filter
  document.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      localState.categoryFilter = btn.dataset.category;
      renderCategoryChips(state);
      applyKatalogFilters(state);
      renderKatalogTable(state);
      // Re-bind (karena chip re-rendered)
      bindCategoryChips(state);
    });
  });
}

function bindCategoryChips(state) {
  document.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      localState.categoryFilter = btn.dataset.category;
      renderCategoryChips(state);
      applyKatalogFilters(state);
      renderKatalogTable(state);
      bindCategoryChips(state);
    });
  });
}
