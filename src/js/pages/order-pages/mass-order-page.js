/* ═══════════════════════════════════════════════════════════════════════
   MASS ORDER PAGE — dengan Preview + Tab Barang Manual
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, toInt, debounce, pasteFromClipboard } from '../../utils.js';
import { orders as ordersApi } from '../../api.js';
import { toast, confirm } from '../../ui.js';
import { icon } from '../../icons.js';
import { showPreOrderDialog } from './pre-order-dialog.js';

// Satuan options
var SATUAN_OPTIONS = ['PCS', 'DUS', 'KRG', 'SET', 'PACK', 'IKAT', 'GROSS'];

// Kategori options untuk barang manual
var KATEGORI_OPTIONS = [
  'PLASTIK', 'ELEKTRONIK', 'ALUMUNIUM', 'STAINLESS', 'KACA',
  'BATU', 'KAYU', 'BESI', 'KAIN', 'KERAMIK', 'LAINNYA'
];

var localState = {
  activeTab: 'katalog', // 'katalog' atau 'manual'
  manualItems: [],       // items yang di-ketik manual
};

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

export function renderMassOrderPage(state) {
  return `
    <header class="page-heading">
      <h1>
        <span data-icon="zap" data-icon-size="24" data-icon-color="var(--orange)"></span>
        Order Massal
      </h1>
      <p>Copy-paste kode dari katalog, atau ketik manual untuk barang baru.</p>
    </header>

    <!-- TAB SELECTOR -->
    <div class="mass-tabs">
      <button class="mass-tab active" type="button" data-mass-tab="katalog">
        <span data-icon="boxes" data-icon-size="16"></span>
        Dari Katalog
      </button>
      <button class="mass-tab" type="button" data-mass-tab="manual">
        <span data-icon="edit" data-icon-size="16"></span>
        Ketik Manual (Barang Baru)
      </button>
    </div>

    <!-- ═══ TAB: KATALOG ═══ -->
    <div class="mass-tab-content active" data-mass-content="katalog">

      <section class="format-box">
        <div class="format-title">
          <span data-icon="file" data-icon-size="14"></span>
          Format: <span style="font-family: var(--font-mono);">KODE;JUMLAH</span>
        </div>
        <div class="format-example">
          NN00001;5<br>
          NN00002;10<br>
          NN00003;3
        </div>
        <div class="format-note">
          <span data-icon="info" data-icon-size="12"></span>
          Separator bisa ; , atau Tab. Isi juga stok gudang dan stok toko sebelum kirim.
        </div>
      </section>

      <section class="content-section">
        <textarea
          class="mass-input"
          id="massInput"
          placeholder="Contoh:&#10;NN00001;5&#10;NN00002;10"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
        ></textarea>

        <div class="inline-actions">
          <button class="secondary-button grow" id="pasteButton" type="button">
            <span data-icon="copy" data-icon-size="14"></span>
            Paste dari Clipboard
          </button>
          <button class="secondary-button" id="clearMassButton" type="button">
            <span data-icon="trash" data-icon-size="14"></span>
            Hapus
          </button>
        </div>
      </section>

      <section class="content-section">
        <div class="preview-title">Preview Barang Katalog</div>
        <div id="massPreview">
          <div class="empty-state" style="border: 1px dashed var(--line-soft); border-radius: 14px;">
            <div class="empty-icon">${icon('zap', { size: 48, color: 'var(--muted)' })}</div>
            <div>Mulai ketik atau paste kode di atas.</div>
          </div>
        </div>
      </section>
    </div>

    <!-- ═══ TAB: MANUAL ═══ -->
    <div class="mass-tab-content" data-mass-content="manual">

      <section class="format-box" style="background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.3);">
        <div class="format-title" style="color: var(--warning);">
          <span data-icon="alert-triangle" data-icon-size="14"></span>
          Untuk Barang BARU (belum ada di katalog)
        </div>
        <div class="format-note" style="margin-top: 8px;">
          <span data-icon="info" data-icon-size="12"></span>
          Ketik nama barang secara manual. Harga akan otomatis Rp 0.
        </div>
      </section>

      <section class="content-section">
        <div class="manual-form">
          <div class="manual-form-row">
            <div class="manual-field">
              <label class="manual-label">Nama Barang <span style="color:var(--danger)">*</span></label>
              <input type="text" class="manual-input" id="manualNama" placeholder="Contoh: Wajan Anti Lengket 30cm">
            </div>
          </div>

          <div class="manual-form-row">
            <div class="manual-field">
              <label class="manual-label">Kode Barang (opsional)</label>
              <input type="text" class="manual-input" id="manualKode" placeholder="Contoh: XM001">
            </div>
            <div class="manual-field">
              <label class="manual-label">Kategori</label>
              <select class="manual-input" id="manualKategori">
                ${KATEGORI_OPTIONS.map(function(k) {
                  return '<option value="' + k + '">' + k + '</option>';
                }).join('')}
              </select>
            </div>
          </div>

          <div class="manual-form-row">
            <div class="manual-field">
              <label class="manual-label">Jumlah <span style="color:var(--danger)">*</span></label>
              <input type="number" class="manual-input" id="manualQty" min="1" value="1" placeholder="1">
            </div>
            <div class="manual-field">
              <label class="manual-label">Satuan</label>
              <select class="manual-input" id="manualSatuan">
                ${SATUAN_OPTIONS.map(function(s) {
                  return '<option value="' + s + '">' + s + '</option>';
                }).join('')}
              </select>
            </div>
          </div>

          <div class="manual-form-row">
            <div class="manual-field">
              <label class="manual-label">
                <span data-icon="warehouse" data-icon-size="12"></span>
                Stok Gudang <span style="color:var(--danger)">*</span>
              </label>
              <input type="number" class="manual-input" id="manualStokGudang" min="0" placeholder="0">
            </div>
            <div class="manual-field">
              <label class="manual-label">
                <span data-icon="store" data-icon-size="12"></span>
                Stok Toko <span style="color:var(--danger)">*</span>
              </label>
              <input type="number" class="manual-input" id="manualStokToko" min="0" placeholder="0">
            </div>
          </div>

          <button class="btn-add-manual" id="btnAddManual" type="button">
            <span data-icon="plus" data-icon-size="16"></span>
            Tambah ke Daftar
          </button>
        </div>
      </section>

      <section class="content-section">
        <div class="preview-title">Daftar Barang Manual</div>
        <div id="manualList">
          <div class="empty-state" style="border: 1px dashed var(--line-soft); border-radius: 14px;">
            <div class="empty-icon">${icon('edit', { size: 48, color: 'var(--muted)' })}</div>
            <div>Belum ada barang manual.</div>
            <div style="margin-top: 8px; font-size: 12px;">Isi form di atas untuk menambah.</div>
          </div>
        </div>
      </section>
    </div>

    <!-- ═══ SUBMIT SECTION (shared) ═══ -->
    <section class="content-section" style="padding-bottom: 120px;">
      <div class="warning-banner" id="massWarning">
        <span data-icon="alert-triangle" data-icon-size="14"></span>
        <span id="massWarningText"></span>
      </div>

      <textarea
        class="note-input"
        id="massNoteInput"
        rows="2"
        placeholder="Catatan untuk admin (opsional)..."
      ></textarea>

      <button class="submit-button" id="massSubmitButton" type="button" disabled>
        <span data-icon="file" data-icon-size="18"></span>
        Preview Form Order
      </button>

      <div class="summary-bar" id="massSummary">
        <span id="massSummaryItems">0 item</span>
        <span id="massSummaryTotal">Rp 0</span>
      </div>
    </section>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initMassOrder(state) {

  // Tab switcher
  document.querySelectorAll('[data-mass-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var tabName = btn.dataset.massTab;
      switchTab(tabName, state);
    });
  });

  // ═══ Tab Katalog ═══
  const massInput = $('massInput');
  if (massInput) {
    const handleInput = debounce(() => {
      parseMassInput(state);
      renderMassPreview(state);
      updateSummary(state);
    }, 300);
    massInput.addEventListener('input', handleInput);
  }

  $('pasteButton')?.addEventListener('click', () => pasteFromClipboardHandler(state));
  $('clearMassButton')?.addEventListener('click', () => clearMassOrder(state));

  $('massPreview')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-mass-action]');
    if (!target) return;
    const index = toInt(target.dataset.index);
    const action = target.dataset.massAction;

    if (action === 'delete') deleteMassItem(state, index);
    else if (action === 'increase') updateMassItemQty(state, index, 1);
    else if (action === 'decrease') updateMassItemQty(state, index, -1);
  });

  $('massPreview')?.addEventListener('change', (e) => {
    const target = e.target.closest('[data-mass-action="set-qty"]');
    if (target) {
      setMassItemQty(state, toInt(target.dataset.index), target.value);
    }
    const stockTarget = e.target.closest('[data-mass-stock]');
    if (stockTarget) handleMassStockInput(state, stockTarget);
  });

  $('massPreview')?.addEventListener('input', (e) => {
    const stockTarget = e.target.closest('[data-mass-stock]');
    if (stockTarget) handleMassStockInput(state, stockTarget);
  });

  // ═══ Tab Manual ═══
  $('btnAddManual')?.addEventListener('click', function () {
    addManualItem(state);
  });

  $('manualList')?.addEventListener('click', function (e) {
    var deleteBtn = e.target.closest('[data-manual-delete]');
    if (deleteBtn) {
      var idx = toInt(deleteBtn.dataset.manualDelete);
      deleteManualItem(state, idx);
    }
  });

  // ═══ Submit ═══
  $('massSubmitButton')?.addEventListener('click', () => showPreviewBeforeSubmit(state));
}

// ─────────────────────────────────────────────────────────────────────────
// TAB SWITCHER
// ─────────────────────────────────────────────────────────────────────────

function switchTab(tabName, state) {

  localState.activeTab = tabName;

  document.querySelectorAll('[data-mass-tab]').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.massTab === tabName);
  });

  document.querySelectorAll('[data-mass-content]').forEach(function (content) {
    content.classList.toggle('active', content.dataset.massContent === tabName);
  });

  updateSummary(state);
}

// ─────────────────────────────────────────────────────────────────────────
// TAB MANUAL: Tambah Barang
// ─────────────────────────────────────────────────────────────────────────

function addManualItem(state) {

  var nama = $('manualNama')?.value.trim() || '';
  var kode = $('manualKode')?.value.trim() || '';
  var kategori = $('manualKategori')?.value || 'LAINNYA';
  var qty = Math.max(1, toInt($('manualQty')?.value, 1));
  var satuan = $('manualSatuan')?.value || 'PCS';
  var stokGudang = $('manualStokGudang')?.value.trim();
  var stokToko = $('manualStokToko')?.value.trim();

  // Validasi
  if (!nama) {
    toast.error('Nama barang wajib diisi.');
    $('manualNama')?.focus();
    return;
  }

  if (stokGudang === '' || stokToko === '') {
    toast.error('Stok gudang dan stok toko wajib diisi.');
    if (stokGudang === '') $('manualStokGudang')?.focus();
    else $('manualStokToko')?.focus();
    return;
  }

  // Auto-generate kode kalau kosong
  var finalKode = kode || ('MAN-' + Date.now().toString().slice(-6));

  // Init array kalau belum
  if (!state.manualItems) state.manualItems = [];

  state.manualItems.push({
    kode: finalKode,
    nama: nama,
    kategori: kategori,
    qty: qty,
    satuan: satuan,
    harga: 0, // Manual selalu 0
    stokGudang: Math.max(0, toInt(stokGudang, 0)),
    stokToko: Math.max(0, toInt(stokToko, 0)),
    stokSistem: 0,
    isManual: true,
  });

  toast.success('"' + nama + '" ditambahkan ke daftar.', { duration: 1500 });

  // Reset form
  $('manualNama').value = '';
  $('manualKode').value = '';
  $('manualQty').value = 1;
  $('manualStokGudang').value = '';
  $('manualStokToko').value = '';
  $('manualNama')?.focus();

  renderManualList(state);
  updateSummary(state);
}

function deleteManualItem(state, index) {
  if (!state.manualItems) return;
  state.manualItems.splice(index, 1);
  renderManualList(state);
  updateSummary(state);
}

function renderManualList(state) {

  var wrapper = $('manualList');
  if (!wrapper) return;

  var items = state.manualItems || [];

  if (!items.length) {
    wrapper.innerHTML = ''
      + '<div class="empty-state" style="border: 1px dashed var(--line-soft); border-radius: 14px;">'
      + '<div class="empty-icon">' + icon('edit', { size: 48, color: 'var(--muted)' }) + '</div>'
      + '<div>Belum ada barang manual.</div>'
      + '<div style="margin-top: 8px; font-size: 12px;">Isi form di atas untuk menambah.</div>'
      + '</div>';
    return;
  }

  wrapper.innerHTML = ''
    + '<div style="display: flex; gap: 8px; margin-bottom: 10px;">'
    + '<span style="padding: 4px 12px; border-radius: 20px; background: rgba(245,158,11,0.15); color: var(--warning); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">'
    + icon('edit', { size: 12 })
    + ' ' + items.length + ' barang manual'
    + '</span>'
    + '</div>'
    + items.map(function (item, i) {
      return ''
        + '<article class="massal-item valid" style="border-color: rgba(245,158,11,0.4);">'
        + '<div class="massal-icon">'
        + icon('edit', { size: 20, color: 'var(--warning)' })
        + '</div>'
        + '<div class="massal-info">'
        + '<div class="massal-code">' + escapeHtml(item.kode)
        + ' <span style="padding:1px 6px; background:#f59e0b; color:#fff; border-radius:3px; font-size:9px; font-weight:700;">MANUAL</span>'
        + '</div>'
        + '<div class="massal-name">' + escapeHtml(item.nama) + '</div>'
        + '<div class="massal-price">' + escapeHtml(item.kategori) + ' · ' + escapeHtml(item.satuan) + '</div>'
        + '<div style="font-size: 10px; color: var(--muted); margin-top: 2px;">'
        + 'Gudang: <b>' + item.stokGudang + '</b> · Toko: <b>' + item.stokToko + '</b>'
        + '</div>'
        + '</div>'
        + '<div class="massal-right">'
        + '<div class="massal-subtotal">' + item.qty + ' ' + item.satuan + '</div>'
        + '<button class="delete-button" type="button" data-manual-delete="' + i + '" title="Hapus">'
        + icon('trash', { size: 14 })
        + '</button>'
        + '</div>'
        + '</article>';
    }).join('');
}

// ─────────────────────────────────────────────────────────────────────────
// TAB KATALOG: Fungsi lama (parse, render, dll)
// ─────────────────────────────────────────────────────────────────────────

async function pasteFromClipboardHandler(state) {
  try {
    const text = await pasteFromClipboard();
    if (!text) { toast.info('Paste manual dengan Ctrl+V.'); return; }
    const input = $('massInput');
    if (input) {
      input.value = text;
      parseMassInput(state);
      renderMassPreview(state);
      updateSummary(state);
    }
    toast.success('Berhasil paste.');
  } catch { toast.info('Paste manual dengan Ctrl+V.'); }
}

function clearMassOrder(state) {
  const input = $('massInput');
  if (input) input.value = '';
  state.massItems = [];
  renderMassPreview(state);
  updateSummary(state);
}

function parseMassInput(state) {
  const text = $('massInput')?.value || '';
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  state.massItems = lines.map((line) => {
    const parts = line.split(/[;,\t]/).map((p) => p.trim());

    if (parts.length < 2) return { kode: line, valid: false, error: 'Format harus KODE;JUMLAH' };

    const code = String(parts[0]).toUpperCase();
    const quantity = toInt(parts[1], 0);
    const product = state.productByCode[code];

    if (!code) return { kode: '', valid: false, error: 'Kode kosong' };
    if (quantity <= 0) return { kode: code, valid: false, error: 'Jumlah harus > 0' };
    if (!product) return { kode: code, valid: false, error: `Barang ${code} tidak ditemukan` };

    const stock = toInt(product.STOK);

    return {
      kode: code,
      nama: String(product.NAMA_BARANG || ''),
      kategori: String(product.KATEGORI || ''),
      harga: parseFloat(product.HARGA) || 0,
      satuan: String(product.SATUAN || 'PCS'),
      qty: quantity,
      stock,
      valid: true,
      warning: quantity > stock ? `Melebihi stok sistem (${stock})` : '',
      stokGudang: '',
      stokToko: '',
      isManual: false,
    };
  });
}

function renderMassPreview(state) {
  const wrapper = $('massPreview');
  if (!wrapper) return;

  if (!state.massItems.length) {
    wrapper.innerHTML = `
      <div class="empty-state" style="border: 1px dashed var(--line-soft); border-radius: 14px;">
        <div class="empty-icon">${icon('zap', { size: 48, color: 'var(--muted)' })}</div>
        <div>Mulai ketik atau paste kode di atas.</div>
      </div>`;
    return;
  }

  const validCount = state.massItems.filter((i) => i.valid).length;
  const invalidCount = state.massItems.length - validCount;

  wrapper.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
      <span style="padding: 4px 12px; border-radius: 20px; background: rgba(34,197,94,0.15); color: var(--success); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
        ${icon('check-circle', { size: 12 })} ${validCount} valid
      </span>
      ${invalidCount ? `
        <span style="padding: 4px 12px; border-radius: 20px; background: rgba(239,68,68,0.15); color: var(--danger); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
          ${icon('x-circle', { size: 12 })} ${invalidCount} error
        </span>` : ''}
    </div>
    ${state.massItems.map((item, i) => buildMassItem(item, i)).join('')}`;
}

function buildMassItem(item, index) {
  if (!item.valid) {
    return `
      <article class="massal-item invalid">
        <div class="massal-icon">${icon('x-circle', { size: 20, color: 'var(--danger)' })}</div>
        <div class="massal-info">
          <div class="massal-code">${escapeHtml(item.kode || '?')}</div>
          <div class="massal-error">${icon('alert-triangle', { size: 10 })} ${escapeHtml(item.error)}</div>
        </div>
        <button class="delete-button" type="button" data-mass-action="delete" data-index="${index}">
          ${icon('trash', { size: 14 })}
        </button>
      </article>`;
  }

  const gudangEmpty = item.stokGudang === '';
  const tokoEmpty = item.stokToko === '';

  return `
    <article class="massal-item valid">
      <div class="massal-icon">
        ${item.warning
          ? icon('alert-triangle', { size: 20, color: 'var(--warning)' })
          : icon('check-circle', { size: 20, color: 'var(--success)' })}
      </div>
      <div class="massal-info">
        <div class="massal-code">${escapeHtml(item.kode)}</div>
        <div class="massal-name">${escapeHtml(item.nama)}</div>
        <div class="massal-price">${formatRupiah(item.harga)} / ${escapeHtml(item.satuan)} · Stok sistem: ${item.stock}</div>
        ${item.warning ? `<div class="massal-warning">${icon('alert-triangle', { size: 10 })} ${escapeHtml(item.warning)}</div>` : ''}
      </div>
      <div class="massal-right">
        <div class="massal-subtotal">${formatRupiah(item.qty * item.harga)}</div>
        <div class="massal-controls">
          <span class="compact-quantity">
            <button type="button" data-mass-action="decrease" data-index="${index}">${icon('minus', { size: 10 })}</button>
            <input type="number" min="1" value="${item.qty}" data-mass-action="set-qty" data-index="${index}">
            <button type="button" data-mass-action="increase" data-index="${index}">${icon('plus', { size: 10 })}</button>
          </span>
          <label class="stock-group ${gudangEmpty ? 'empty' : ''}" title="Stok Gudang">
            <span class="stock-group-icon">${icon('warehouse', { size: 12 })}</span>
            <input class="stock-input" type="number" min="0" placeholder="Gudang"
                   value="${gudangEmpty ? '' : item.stokGudang}"
                   data-mass-stock="gudang" data-index="${index}">
          </label>
          <label class="stock-group ${tokoEmpty ? 'empty' : ''}" title="Stok Toko">
            <span class="stock-group-icon">${icon('store', { size: 12 })}</span>
            <input class="stock-input" type="number" min="0" placeholder="Toko"
                   value="${tokoEmpty ? '' : item.stokToko}"
                   data-mass-stock="toko" data-index="${index}">
          </label>
          <button class="delete-button" type="button" data-mass-action="delete" data-index="${index}">
            ${icon('trash', { size: 14 })}
          </button>
        </div>
      </div>
    </article>`;
}

function handleMassStockInput(state, input) {
  const index = toInt(input.dataset.index);
  const value = input.value.trim();
  const field = input.dataset.massStock === 'gudang' ? 'stokGudang' : 'stokToko';
  if (state.massItems[index]) {
    state.massItems[index][field] = value === '' ? '' : Math.max(0, toInt(value, 0));
  }
  input.closest('.stock-group')?.classList.toggle('empty', value === '');
  updateSummary(state);
}

function syncMassInput(state) {
  const input = $('massInput');
  if (input) {
    input.value = state.massItems
      .map((i) => (i.valid ? `${i.kode};${i.qty}` : i.kode))
      .join('\n');
  }
}

function updateMassItemQty(state, index, delta) {
  if (!state.massItems[index]?.valid) return;
  state.massItems[index].qty = Math.max(1, state.massItems[index].qty + delta);
  const stock = state.massItems[index].stock;
  const qty = state.massItems[index].qty;
  state.massItems[index].warning = qty > stock ? `Melebihi stok sistem (${stock})` : '';
  syncMassInput(state);
  renderMassPreview(state);
  updateSummary(state);
}

function setMassItemQty(state, index, value) {
  if (!state.massItems[index]?.valid) return;
  state.massItems[index].qty = Math.max(1, toInt(value, 1));
  const stock = state.massItems[index].stock;
  const qty = state.massItems[index].qty;
  state.massItems[index].warning = qty > stock ? `Melebihi stok sistem (${stock})` : '';
  syncMassInput(state);
  renderMassPreview(state);
  updateSummary(state);
}

function deleteMassItem(state, index) {
  state.massItems.splice(index, 1);
  syncMassInput(state);
  renderMassPreview(state);
  updateSummary(state);
}

// ─────────────────────────────────────────────────────────────────────────
// SUMMARY (gabungan katalog + manual)
// ─────────────────────────────────────────────────────────────────────────

function getAllValidItems(state) {

  var katalogItems = (state.massItems || [])
    .filter(function (i) { return i.valid; })
    .filter(function (i) { return i.stokGudang !== '' && i.stokToko !== ''; });

  var manualItems = state.manualItems || [];

  return katalogItems.concat(manualItems);
}

function updateSummary(state) {

  var katalogValid = (state.massItems || []).filter(function (i) { return i.valid; });
  var manualCount = (state.manualItems || []).length;

  var totalItems = katalogValid.length + manualCount;

  var totalPrice = katalogValid.reduce(function (s, i) { return s + i.qty * i.harga; }, 0);
  var totalQty = katalogValid.reduce(function (s, i) { return s + i.qty; }, 0)
               + (state.manualItems || []).reduce(function (s, i) { return s + i.qty; }, 0);

  var summary = $('massSummary');
  if (summary) summary.classList.toggle('show', totalItems > 0);

  var summaryItems = $('massSummaryItems');
  if (summaryItems) {
    summaryItems.textContent = totalItems + ' jenis · ' + totalQty + ' unit';
  }

  var summaryTotal = $('massSummaryTotal');
  if (summaryTotal) summaryTotal.textContent = formatRupiah(totalPrice);

  // Validate stocks for katalog items
  var katalogMissing = katalogValid.filter(function (i) {
    return i.stokGudang === '' || i.stokToko === '';
  }).length;

  var warning = $('massWarning');
  var warningText = $('massWarningText');
  if (warning && warningText) {
    if (katalogMissing > 0) {
      warning.classList.add('show');
      warningText.textContent = 'Isi stok gudang dan toko untuk ' + katalogMissing + ' item katalog.';
    } else {
      warning.classList.remove('show');
    }
  }

  var canSubmit = totalItems > 0 && katalogMissing === 0;

  var submitBtn = $('massSubmitButton');
  if (submitBtn) {
    submitBtn.disabled = !canSubmit;
    submitBtn.innerHTML = totalItems > 0
      ? icon('file', { size: 18 }) + ' Preview Form Order (' + totalItems + ' item)'
      : icon('file', { size: 18 }) + ' Preview Form Order';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SHOW PREVIEW SEBELUM SUBMIT
// ─────────────────────────────────────────────────────────────────────────

function showPreviewBeforeSubmit(state) {

  var allItems = getAllValidItems(state);

  if (!allItems.length) {
    toast.error('Tidak ada barang untuk di-submit.');
    return;
  }

  // Show preview dialog
  showPreOrderDialog({
    items: allItems,
    branchId: state.branchId,
    catatan: $('massNoteInput')?.value || '',
    onConfirm: async function (config) {
      await submitMassOrder(state, allItems, config);
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────────────────────────────────

async function submitMassOrder(state, items, formConfig) {

  if (state.isSubmitting) return;
  state.isSubmitting = true;

  const userNote = $('massNoteInput')?.value.trim() || '';
  const stockNote = items.map((i) =>
    `${i.kode}: gudang ${i.stokGudang}, toko ${i.stokToko}`
  ).join(' | ');

  var formInfo = '';
  if (formConfig) {
    formInfo = '[FORM] No.' + formConfig.nomorOrder
             + ' Tgl.' + formConfig.tanggalOrder.toLocaleDateString('id-ID');
  }

  const catatan = `[MASSAL] ${userNote}${userNote ? '\n\n' : ''}${formInfo}\n\n[STOK AKTUAL] ${stockNote}`;

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
      stokSistem: i.stock !== undefined ? i.stock : (i.stokSistem || 0),
      isManual: i.isManual || false,
    })),
  };

  try {
    const result = await ordersApi.submit(payload);

    if (result.status === 'ok') {
      // Reset semua
      state.massItems = [];
      state.manualItems = [];

      const input = $('massInput');
      const note = $('massNoteInput');
      if (input) input.value = '';
      if (note) note.value = '';

      renderMassPreview(state);
      renderManualList(state);
      updateSummary(state);

      toast.success('Order massal berhasil dikirim!', { duration: 4000 });

      setTimeout(() => {
        const historyTab = document.querySelector('[data-tab="history"]');
        historyTab?.click();
      }, 1500);
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
