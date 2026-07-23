/* ═══════════════════════════════════════════════════════════════════════
   MASS ORDER PAGE — with Lucide Icons
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, toInt, debounce, pasteFromClipboard } from '../../utils.js';
import { orders as ordersApi } from '../../api.js';
import { toast, confirm } from '../../ui.js';
import { icon } from '../../icons.js';

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
      <p>Copy-paste kode dan jumlah barang sekaligus untuk order banyak barang.</p>
    </header>

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
      <div class="preview-title">Preview Barang</div>
      <div id="massPreview">
        <div class="empty-state" style="border: 1px dashed var(--line-soft); border-radius: 14px;">
          <div class="empty-icon">${icon('zap', { size: 48, color: 'var(--muted)' })}</div>
          <div>Mulai ketik atau paste kode di atas.</div>
        </div>
      </div>
    </section>

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
        <span data-icon="send" data-icon-size="18"></span>
        Kirim Order Massal
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
  const massInput = $('massInput');

  if (massInput) {
    const handleInput = debounce(() => {
      parseMassInput(state);
      renderMassPreview(state);
      updateMassSummary(state);
    }, 300);

    massInput.addEventListener('input', handleInput);
  }

  $('pasteButton')?.addEventListener('click', () => pasteFromClipboardHandler(state));
  $('clearMassButton')?.addEventListener('click', () => clearMassOrder(state));
  $('massSubmitButton')?.addEventListener('click', () => confirmMassSubmit(state));

  $('massPreview')?.addEventListener('click', (e) => {
    const target = e.target.closest('[data-mass-action]');
    if (!target) return;

    const index = toInt(target.dataset.index);
    const action = target.dataset.massAction;

    if (action === 'delete') {
      deleteMassItem(state, index);
    } else if (action === 'increase') {
      updateMassItemQty(state, index, 1);
    } else if (action === 'decrease') {
      updateMassItemQty(state, index, -1);
    }
  });

  $('massPreview')?.addEventListener('change', (e) => {
    const target = e.target.closest('[data-mass-action="set-qty"]');
    if (target) {
      setMassItemQty(state, toInt(target.dataset.index), target.value);
    }

    const stockTarget = e.target.closest('[data-mass-stock]');
    if (stockTarget) {
      handleMassStockInput(state, stockTarget);
    }
  });

  $('massPreview')?.addEventListener('input', (e) => {
    const stockTarget = e.target.closest('[data-mass-stock]');
    if (stockTarget) {
      handleMassStockInput(state, stockTarget);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// PASTE / CLEAR
// ─────────────────────────────────────────────────────────────────────────

async function pasteFromClipboardHandler(state) {
  try {
    const text = await pasteFromClipboard();
    if (!text) {
      toast.info('Paste manual dengan Ctrl+V.');
      return;
    }

    const input = $('massInput');
    if (input) {
      input.value = text;
      parseMassInput(state);
      renderMassPreview(state);
      updateMassSummary(state);
    }

    toast.success('Berhasil paste.');
  } catch {
    toast.info('Paste manual dengan Ctrl+V.');
  }
}

function clearMassOrder(state) {
  const input = $('massInput');
  if (input) input.value = '';

  state.massItems = [];
  renderMassPreview(state);
  updateMassSummary(state);
}

// ─────────────────────────────────────────────────────────────────────────
// PARSE
// ─────────────────────────────────────────────────────────────────────────

function parseMassInput(state) {
  const text = $('massInput')?.value || '';
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);

  state.massItems = lines.map((line) => {
    const parts = line.split(/[;,\t]/).map((p) => p.trim());

    if (parts.length < 2) {
      return {
        kode: line,
        valid: false,
        error: 'Format harus KODE;JUMLAH',
      };
    }

    const code = String(parts[0]).toUpperCase();
    const quantity = toInt(parts[1], 0);
    const product = state.productByCode[code];

    if (!code) {
      return { kode: '', valid: false, error: 'Kode kosong' };
    }

    if (quantity <= 0) {
      return { kode: code, valid: false, error: 'Jumlah harus > 0' };
    }

    if (!product) {
      return { kode: code, valid: false, error: `Barang ${code} tidak ditemukan` };
    }

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
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER PREVIEW
// ─────────────────────────────────────────────────────────────────────────

function renderMassPreview(state) {
  const wrapper = $('massPreview');
  if (!wrapper) return;

  if (!state.massItems.length) {
    wrapper.innerHTML = `
      <div class="empty-state" style="border: 1px dashed var(--line-soft); border-radius: 14px;">
        <div class="empty-icon">${icon('zap', { size: 48, color: 'var(--muted)' })}</div>
        <div>Mulai ketik atau paste kode di atas.</div>
      </div>
    `;
    return;
  }

  const validCount = state.massItems.filter((i) => i.valid).length;
  const invalidCount = state.massItems.length - validCount;

  wrapper.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap;">
      <span style="padding: 4px 12px; border-radius: 20px; background: rgba(34,197,94,0.15); color: var(--success); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
        ${icon('check-circle', { size: 12 })}
        ${validCount} valid
      </span>
      ${invalidCount ? `
        <span style="padding: 4px 12px; border-radius: 20px; background: rgba(239,68,68,0.15); color: var(--danger); font-size: 11px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
          ${icon('x-circle', { size: 12 })}
          ${invalidCount} error
        </span>
      ` : ''}
    </div>
    ${state.massItems.map((item, i) => buildMassItem(item, i)).join('')}
  `;

  validateMassStocks(state);
}

function buildMassItem(item, index) {
  if (!item.valid) {
    return `
      <article class="massal-item invalid">
        <div class="massal-icon">${icon('x-circle', { size: 20, color: 'var(--danger)' })}</div>
        <div class="massal-info">
          <div class="massal-code">${escapeHtml(item.kode || '?')}</div>
          <div class="massal-error">
            ${icon('alert-triangle', { size: 10 })}
            ${escapeHtml(item.error)}
          </div>
        </div>
        <button class="delete-button" type="button" data-mass-action="delete" data-index="${index}">
          ${icon('trash', { size: 14 })}
        </button>
      </article>
    `;
  }

  const gudangEmpty = item.stokGudang === '';
  const tokoEmpty = item.stokToko === '';

  return `
    <article class="massal-item valid">
      <div class="massal-icon">
        ${item.warning
          ? icon('alert-triangle', { size: 20, color: 'var(--warning)' })
          : icon('check-circle', { size: 20, color: 'var(--success)' })
        }
      </div>

      <div class="massal-info">
        <div class="massal-code">${escapeHtml(item.kode)}</div>
        <div class="massal-name">${escapeHtml(item.nama)}</div>
        <div class="massal-price">${formatRupiah(item.harga)} / ${escapeHtml(item.satuan)}</div>
        ${item.warning ? `
          <div class="massal-warning">
            ${icon('alert-triangle', { size: 10 })}
            ${escapeHtml(item.warning)}
          </div>
        ` : ''}
      </div>

      <div class="massal-right">
        <div class="massal-subtotal">${formatRupiah(item.qty * item.harga)}</div>

        <div class="massal-controls">
          <span class="compact-quantity">
            <button type="button" data-mass-action="decrease" data-index="${index}">
              ${icon('minus', { size: 10 })}
            </button>
            <input type="number" min="1" value="${item.qty}"
                   data-mass-action="set-qty" data-index="${index}">
            <button type="button" data-mass-action="increase" data-index="${index}">
              ${icon('plus', { size: 10 })}
            </button>
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
    </article>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// STOCK HANDLERS
// ─────────────────────────────────────────────────────────────────────────

function handleMassStockInput(state, input) {
  const index = toInt(input.dataset.index);
  const value = input.value.trim();
  const field = input.dataset.massStock === 'gudang' ? 'stokGudang' : 'stokToko';

  if (state.massItems[index]) {
    state.massItems[index][field] = value === '' ? '' : Math.max(0, toInt(value, 0));
  }

  input.closest('.stock-group')?.classList.toggle('empty', value === '');
  validateMassStocks(state);
}

function validateMassStocks(state) {
  const validItems = state.massItems.filter((i) => i.valid);
  const gudangMissing = validItems.filter((i) => i.stokGudang === '').length;
  const tokoMissing = validItems.filter((i) => i.stokToko === '').length;
  const missing = gudangMissing + tokoMissing;
  const canSubmit = validItems.length > 0 && missing === 0;

  const warning = $('massWarning');
  const warningText = $('massWarningText');

  if (warning && warningText) {
    if (validItems.length > 0 && missing > 0) {
      warning.classList.add('show');
      warningText.textContent = `Wajib isi stok gudang (${gudangMissing} kosong) dan stok toko (${tokoMissing} kosong).`;
    } else {
      warning.classList.remove('show');
    }
  }

  const submitBtn = $('massSubmitButton');
  if (submitBtn) submitBtn.disabled = !canSubmit;

  return canSubmit;
}

// ─────────────────────────────────────────────────────────────────────────
// QTY ACTIONS
// ─────────────────────────────────────────────────────────────────────────

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
  syncMassInput(state);
  renderMassPreview(state);
  updateMassSummary(state);
}

function setMassItemQty(state, index, value) {
  if (!state.massItems[index]?.valid) return;

  state.massItems[index].qty = Math.max(1, toInt(value, 1));
  syncMassInput(state);
  renderMassPreview(state);
  updateMassSummary(state);
}

function deleteMassItem(state, index) {
  state.massItems.splice(index, 1);
  syncMassInput(state);
  renderMassPreview(state);
  updateMassSummary(state);
}

// ─────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────

function updateMassSummary(state) {
  const validItems = state.massItems.filter((i) => i.valid);
  const totalQty = validItems.reduce((s, i) => s + i.qty, 0);
  const totalPrice = validItems.reduce((s, i) => s + i.qty * i.harga, 0);

  const summary = $('massSummary');
  if (summary) summary.classList.toggle('show', validItems.length > 0);

  const summaryItems = $('massSummaryItems');
  if (summaryItems) {
    summaryItems.textContent = `${validItems.length} jenis · ${totalQty} unit`;
  }

  const summaryTotal = $('massSummaryTotal');
  if (summaryTotal) summaryTotal.textContent = formatRupiah(totalPrice);

  const submitBtn = $('massSubmitButton');
  if (submitBtn) {
    submitBtn.innerHTML = validItems.length
      ? `${icon('send', { size: 18 })} Kirim ${validItems.length} Barang ke Gudang`
      : `${icon('zap', { size: 18 })} Kirim Order Massal`;
  }

  validateMassStocks(state);
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMIT
// ─────────────────────────────────────────────────────────────────────────

async function confirmMassSubmit(state) {
  const validItems = state.massItems.filter((i) => i.valid);

  if (!validItems.length) {
    toast.error('Tidak ada barang valid.');
    return;
  }

  if (!validateMassStocks(state)) {
    toast.warning('Isi stok gudang dan stok toko semua barang.', {
      duration: 4000,
    });
    return;
  }

  const total = validItems.reduce((s, i) => s + i.qty * i.harga, 0);
  const summary = validItems.map((i) =>
    `• ${i.nama}: ${i.qty} ${i.satuan} (Gudang: ${i.stokGudang}, Toko: ${i.stokToko})`
  ).join('\n');

  const ok = await confirm({
    icon: '🚀',
    title: 'Kirim Order Massal?',
    message: `${validItems.length} barang · Total ${formatRupiah(total)}\n\n${summary}\n\nKirim untuk ${state.branchId}?`,
    okText: 'Ya, Kirim',
    okVariant: 'primary',
  });

  if (!ok) return;

  await submitMassOrder(state, validItems);
}

async function submitMassOrder(state, items) {
  if (state.isSubmitting) return;

  state.isSubmitting = true;

  const submitBtn = $('massSubmitButton');
  const originalText = submitBtn?.innerHTML;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner spinner-sm" style="color: #fff;"></span> Mengirim ${items.length} barang...`;
  }

  const userNote = $('massNoteInput')?.value.trim() || '';
  const stockNote = items.map((i) =>
    `${i.kode}: gudang ${i.stokGudang}, toko ${i.stokToko}`
  ).join(' | ');

  const catatan = `[MASSAL] ${userNote}${userNote ? '\n\n' : ''}[STOK AKTUAL] ${stockNote}`;

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
      state.massItems = [];
      const input = $('massInput');
      const note = $('massNoteInput');
      if (input) input.value = '';
      if (note) note.value = '';

      renderMassPreview(state);
      updateMassSummary(state);

      toast.success('Order massal berhasil dikirim!', { duration: 4000 });

      setTimeout(() => {
        const historyTab = document.querySelector('[data-tab="history"]');
        historyTab?.click();
      }, 1500);
    } else {
      toast.error(result.message || 'Gagal mengirim order.');
    }
  } catch (error) {
    toast.error(error.message || 'Terjadi kesalahan.');
  } finally {
    state.isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
    updateMassSummary(state);
  }
}