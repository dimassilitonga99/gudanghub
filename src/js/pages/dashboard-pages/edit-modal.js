/* ═══════════════════════════════════════════════════════════════════════
   EDIT MODAL — with Lucide Icons + Print Form Feature
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah, formatWita, toNumber, toInt } from '../../utils.js';
import { CABANG } from '../../config.js';
import { orders as ordersApi } from '../../api.js';
import { toast, confirm, prompt } from '../../ui.js';
import { icon, injectIcons } from '../../icons.js';
import { showPrintForm, initPrintForm } from './print-form.js';

let modalState = {
  orderId: '',
  order: null,
  items: [],
  originalItems: [],
  dashboardState: null,
};

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initEditModal(dashboardState) {
  modalState.dashboardState = dashboardState;

  // Init print form modal
  initPrintForm();

  const container = $('editModalContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="overlay" id="editOverlay" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
      <div class="modal modal-lg">
        <header class="modal-header">
          <div class="modal-title" id="editModalTitle">Detail Pesanan</div>
          <button class="modal-close" id="editModalClose" type="button" aria-label="Tutup">
            <span data-icon="close" data-icon-size="16"></span>
          </button>
        </header>
        <div class="modal-body" id="editModalBody"></div>
      </div>
    </div>
  `;

  addEditModalStyles();

  $('editModalClose')?.addEventListener('click', closeEditModal);
  $('editOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'editOverlay') closeEditModal();
  });
}

// ─────────────────────────────────────────────────────────────────────────
// CSS INJECTION
// ─────────────────────────────────────────────────────────────────────────

function addEditModalStyles() {
  if (document.getElementById('editModalStyles')) return;

  const style = document.createElement('style');
  style.id = 'editModalStyles';
  style.textContent = `
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--line-soft);
      font-size: 12px;
      gap: 12px;
      flex-wrap: wrap;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label {
      color: var(--muted);
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .info-value {
      font-weight: 600;
      text-align: right;
      word-break: break-word;
      min-width: 0;
    }

    .edit-section-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--muted);
      margin: 18px 0 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .edit-section-count {
      background: var(--ink-3);
      color: var(--orange);
      padding: 2px 8px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
    }

    .edit-row {
      padding: 12px;
      border: 1px solid var(--line-soft);
      border-radius: 12px;
      margin-bottom: 8px;
      background: var(--ink-3);
      transition: border-color 0.2s, background 0.2s;
    }

    .edit-row.approved { border-color: rgba(34, 197, 94, 0.3); }
    .edit-row.edited { border-color: rgba(59, 130, 246, 0.4); background: rgba(59, 130, 246, 0.06); }
    .edit-row.rejected {
      opacity: 0.75;
      border-color: rgba(245, 158, 11, 0.4);
      background: rgba(245, 158, 11, 0.06);
    }
    .edit-row.rejected .er-nama,
    .edit-row.rejected .er-kode {
      text-decoration: line-through;
      color: var(--warning);
    }
    .edit-row.deleted {
      opacity: 0.65;
      border-color: rgba(239, 68, 68, 0.4);
      background: rgba(239, 68, 68, 0.06);
    }
    .edit-row.deleted .er-nama,
    .edit-row.deleted .er-kode {
      text-decoration: line-through;
      color: var(--danger);
    }

    .er-top {
      display: grid;
      grid-template-columns: 1fr 60px 90px auto;
      gap: 8px;
      align-items: center;
    }

    .er-kode {
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--orange);
      font-weight: 700;
      word-break: break-all;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .er-nama {
      font-size: 12px;
      font-weight: 700;
      line-height: 1.3;
      overflow-wrap: break-word;
    }

    .er-harga {
      font-size: 10px;
      color: var(--muted);
    }

    .er-qty {
      width: 100%;
      text-align: center;
      background: var(--card);
      border: 1px solid var(--line-soft);
      border-radius: 7px;
      padding: 7px 4px;
      color: var(--text);
      font-size: 13px;
      font-weight: 700;
      outline: none;
      transition: border-color 0.15s;
      font-variant-numeric: tabular-nums;
      font-family: inherit;
      min-height: 34px;
      -webkit-appearance: none;
      appearance: none;
    }

    .er-qty:focus { border-color: var(--orange); }
    .er-qty:disabled { opacity: 0.4; cursor: not-allowed; }

    .er-sub {
      font-size: 12px;
      font-weight: 800;
      color: var(--orange);
      text-align: right;
      font-variant-numeric: tabular-nums;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .er-acts {
      display: flex;
      gap: 4px;
    }

    .er-btn {
      width: 32px;
      height: 32px;
      border-radius: 7px;
      border: 1px solid var(--line-soft);
      background: var(--card);
      cursor: pointer;
      display: grid;
      place-items: center;
      transition: background 0.15s, border-color 0.15s, transform 0.15s;
      font-family: inherit;
      flex-shrink: 0;
    }

    .er-btn:hover { transform: scale(1.05); }
    .er-btn.edit { color: var(--info); }
    .er-btn.edit:hover { background: rgba(59, 130, 246, 0.15); border-color: var(--info); }
    .er-btn.rej { color: var(--warning); }
    .er-btn.rej:hover { background: rgba(245, 158, 11, 0.15); border-color: var(--warning); }
    .er-btn.del { color: var(--danger); }
    .er-btn.del:hover { background: rgba(239, 68, 68, 0.15); border-color: var(--danger); }
    .er-btn.restore { color: var(--success); }
    .er-btn.restore:hover { background: rgba(34, 197, 94, 0.15); border-color: var(--success); }

    .er-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: 6px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .er-badge.del-badge { background: rgba(239, 68, 68, 0.2); color: var(--danger); }
    .er-badge.rej-badge { background: rgba(245, 158, 11, 0.2); color: var(--warning); }
    .er-badge.edit-badge { background: rgba(59, 130, 246, 0.2); color: var(--info); }

    .er-reason {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--line-soft);
    }

    .er-reason-label {
      font-size: 10px;
      color: var(--muted);
      margin-bottom: 4px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .er-reason textarea {
      width: 100%;
      background: var(--card);
      border: 1px solid var(--line-soft);
      border-radius: 8px;
      padding: 8px 10px;
      color: var(--text);
      font-size: 12px;
      font-family: inherit;
      resize: vertical;
      min-height: 36px;
      outline: none;
      transition: border-color 0.15s;
    }

    .er-reason textarea:focus { border-color: var(--orange); }
    .er-reason textarea.required-empty { border-color: var(--danger); }

    .er-stok-info {
      font-size: 10px;
      color: var(--muted);
      margin-top: 4px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .er-stok-info span { display: inline-flex; gap: 3px; align-items: center; }

    .add-row {
      display: grid;
      grid-template-columns: 1fr 66px auto;
      gap: 8px;
      align-items: center;
      margin-top: 12px;
      padding-top: 14px;
      border-top: 1px dashed var(--line-soft);
    }

    .add-row select,
    .add-row input {
      background: var(--ink-3);
      border: 1px solid var(--line-soft);
      border-radius: 8px;
      padding: 9px 10px;
      color: var(--text);
      font-size: 13px;
      outline: none;
      font-family: inherit;
      transition: border-color 0.15s;
      min-height: 36px;
      -webkit-appearance: none;
      appearance: none;
    }

    .add-row select:focus,
    .add-row input:focus { border-color: var(--orange); }

    .btn-add-item {
      background: var(--orange-dim);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 9px 12px;
      color: var(--orange);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
      font-family: inherit;
      min-height: 36px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-add-item:hover { background: rgba(255, 107, 0, 0.2); }

    .edit-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--border);
      font-size: 14px;
      font-weight: 800;
      gap: 8px;
      flex-wrap: wrap;
    }

    .edit-total span:last-child {
      color: var(--orange);
      font-variant-numeric: tabular-nums;
    }

    .edit-catatan {
      width: 100%;
      background: var(--ink-3);
      border: 1px solid var(--line-soft);
      border-radius: 10px;
      padding: 10px 14px;
      color: var(--text);
      font-size: 13px;
      font-family: inherit;
      resize: vertical;
      outline: none;
      margin-top: 14px;
      transition: border-color 0.15s;
      min-height: 60px;
    }

    .edit-catatan:focus { border-color: var(--orange); }

    .modal-foot {
      display: flex;
      gap: 10px;
      margin-top: 20px;
      flex-wrap: wrap;
    }

    .mf-btn {
      padding: 13px 18px;
      border-radius: 11px;
      border: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: transform 0.15s, box-shadow 0.15s;
      font-family: inherit;
      min-height: 48px;
    }

    .mf-save {
      background: linear-gradient(135deg, var(--success), #16a34a);
      color: #fff;
      flex: 1;
      min-width: 140px;
    }

    .mf-save:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(34, 197, 94, 0.3);
    }

    .mf-email {
      background: linear-gradient(135deg, var(--info), #2563eb);
      color: #fff;
      flex: 1;
      min-width: 140px;
    }

    .mf-email:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.3);
    }

    .mf-print {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      flex: 1;
      min-width: 140px;
    }

    .mf-print:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(99, 102, 241, 0.3);
    }

    .mf-cancel {
      background: var(--ink-3);
      color: var(--muted);
      border: 1px solid var(--line-soft);
      padding: 13px 20px;
      min-width: 100px;
    }

    .mf-cancel:hover { color: var(--text); }

    .mf-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
      pointer-events: none;
    }

    @media (max-width: 600px) {
      .er-top {
        grid-template-columns: 1fr auto;
        gap: 8px;
      }
      .er-qty, .er-sub {
        grid-column: 1 / -1;
      }
      .er-qty { text-align: center; }
      .er-sub { text-align: right; padding-top: 4px; }
      .mf-save, .mf-email, .mf-print, .mf-cancel { min-width: 100%; }
      .add-row { grid-template-columns: 1fr; gap: 6px; }
      .btn-add-item { width: 100%; justify-content: center; }
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────
// SHOW MODAL
// ─────────────────────────────────────────────────────────────────────────

export function showEditModal(orderId, dashboardState) {
  const order = dashboardState.allOrders.find((o) => o.ORDER_ID === orderId);

  if (!order) {
    toast.error('Order tidak ditemukan.');
    return;
  }

  modalState.orderId = orderId;
  modalState.order = order;
  modalState.dashboardState = dashboardState;

  modalState.items = (order.DETAIL || []).map((d) => ({
    kode: String(d.KODE_BARANG || ''),
    nama: String(d.NAMA_BARANG || ''),
    kategori: String(d.KATEGORI || ''),
    qty: toNumber(d.QTY),
    originalQty: toNumber(d.ORIGINAL_QTY) || toNumber(d.QTY),
    satuan: String(d.SATUAN || 'PCS'),
    harga: toNumber(d.HARGA_SATUAN),
    itemStatus: String(d.ITEM_STATUS || 'APPROVED').toUpperCase(),
    reason: String(d.REASON || ''),
    stokGudang: d.STOK_GUDANG ?? '',
    stokToko: d.STOK_TOKO ?? '',
  }));

  modalState.originalItems = JSON.parse(JSON.stringify(modalState.items));

  renderModalContent();
  openModal();
}

function openModal() {
  $('editOverlay')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

export function closeEditModal() {
  $('editOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
  modalState.orderId = '';
  modalState.order = null;
  modalState.items = [];
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER MODAL
// ─────────────────────────────────────────────────────────────────────────

function renderModalContent() {
  const { order } = modalState;
  const branch = CABANG[order.ID_CABANG] || { nama: '-', pic: '-' };

  $('editModalTitle').innerHTML = `${icon('package', { size: 18 })} ${order.ORDER_ID}`;

  const body = $('editModalBody');
  if (!body) return;

  body.innerHTML = `
    <div class="info-row">
      <span class="info-label">${icon('store', { size: 14 })} Cabang</span>
      <span class="info-value">${escapeHtml(branch.nama)} (${escapeHtml(order.ID_CABANG)})</span>
    </div>
    <div class="info-row">
      <span class="info-label">${icon('user', { size: 14 })} PIC</span>
      <span class="info-value">${escapeHtml(branch.pic)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${icon('calendar-clock', { size: 14 })} Tanggal Order</span>
      <span class="info-value">${escapeHtml(formatWita(order.TANGGAL_ORDER))}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${icon('info', { size: 14 })} Status</span>
      <span class="info-value">${escapeHtml(order.STATUS)}</span>
    </div>
    ${order.CATATAN ? `
      <div class="info-row">
        <span class="info-label">${icon('message', { size: 14 })} Catatan Cabang</span>
        <span class="info-value">${escapeHtml(order.CATATAN)}</span>
      </div>
    ` : ''}

    <div class="edit-section-title">
      ${icon('edit', { size: 16, color: 'var(--orange)' })}
      Kelola Item
      <span class="edit-section-count" id="editSectionCount">${modalState.items.length} item</span>
    </div>

    <div id="editRows"></div>

    <div class="add-row">
      <select id="addKode">
        <option value="">+ Pilih barang untuk ditambah...</option>
        ${modalState.dashboardState.allKatalog.map((item) => `
          <option value="${escapeHtml(item.KODE_BARANG)}">
            ${escapeHtml(item.KODE_BARANG)} — ${escapeHtml(item.NAMA_BARANG)}
          </option>
        `).join('')}
      </select>
      <input id="addQty" type="number" min="1" value="1" placeholder="Jml">
      <button class="btn-add-item" id="btnTambahItem" type="button">
        ${icon('plus', { size: 14 })}
        Tambah
      </button>
    </div>

    <div class="edit-total">
      <span>Total Disetujui:</span>
      <span id="editTotal">Rp 0</span>
    </div>

    <textarea
      class="edit-catatan"
      id="editCatatan"
      rows="2"
      placeholder="Catatan admin (opsional)..."
    ></textarea>

    <div class="modal-foot">
      <button class="mf-btn mf-save" id="btnSaveEdit" type="button">
        ${icon('save', { size: 16 })}
        Simpan Perubahan
      </button>
      <button class="mf-btn mf-email" id="btnSendEmail" type="button">
        ${icon('send', { size: 16 })}
        Kirim Email ke Cabang
      </button>
      <button class="mf-btn mf-print" id="btnPrintForm" type="button">
        ${icon('download', { size: 16 })}
        Print Form
      </button>
      <button class="mf-btn mf-cancel" id="btnCloseModal" type="button">
        ${icon('close', { size: 16 })}
        Tutup
      </button>
    </div>
  `;

  renderEditRows();
  bindModalEvents();

  // Re-inject icons di modal
  injectIcons(body);
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER EDIT ROWS
// ─────────────────────────────────────────────────────────────────────────

function renderEditRows() {
  const wrapper = $('editRows');
  if (!wrapper) return;

  if (!modalState.items.length) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon('package-x', { size: 48, color: 'var(--muted)' })}</div>
        <p>Tidak ada item. Tambahkan barang di bawah.</p>
      </div>
    `;
    updateEditTotal();
    return;
  }

  wrapper.innerHTML = modalState.items.map((item, index) => {
    const deleted = item.itemStatus === 'DELETED';
    const rejected = item.itemStatus === 'REJECTED';
    const edited = !deleted && !rejected && item.originalQty && item.originalQty !== item.qty;
    const className = deleted ? 'deleted'
                    : rejected ? 'rejected'
                    : edited ? 'edited'
                    : 'approved';

    const badge = deleted ? `<span class="er-badge del-badge">${icon('trash', { size: 10 })} DIHAPUS</span>`
                : rejected ? `<span class="er-badge rej-badge">${icon('ban', { size: 10 })} DITOLAK</span>`
                : edited ? `<span class="er-badge edit-badge">${icon('edit-2', { size: 10 })} DIEDIT</span>`
                : '';

    const reasonRequired = deleted || rejected;

    const stokInfo = (item.stokGudang !== '' || item.stokToko !== '') ? `
      <div class="er-stok-info">
        ${item.stokGudang !== '' ? `<span>${icon('warehouse', { size: 12 })} Gudang: <b>${item.stokGudang}</b></span>` : ''}
        ${item.stokToko !== '' ? `<span>${icon('store', { size: 12 })} Toko: <b>${item.stokToko}</b></span>` : ''}
      </div>
    ` : '';

    const actionButtons = (deleted || rejected)
      ? `<button class="er-btn restore" type="button" data-restore-index="${index}" title="Kembalikan">
          ${icon('refresh', { size: 14 })}
        </button>`
      : `
        <button class="er-btn edit" type="button" data-edit-index="${index}" title="Edit qty">
          ${icon('edit-2', { size: 14 })}
        </button>
        <button class="er-btn rej" type="button" data-reject-index="${index}" title="Tolak">
          ${icon('ban', { size: 14 })}
        </button>
        <button class="er-btn del" type="button" data-delete-index="${index}" title="Hapus">
          ${icon('trash', { size: 14 })}
        </button>
      `;

    return `
      <div class="edit-row ${className}">
        <div class="er-top">
          <div>
            <div class="er-kode">${escapeHtml(item.kode)}${badge}</div>
            <div class="er-nama">${escapeHtml(item.nama || '(tanpa nama)')}</div>
            <div class="er-harga">${formatRupiah(item.harga)} / ${escapeHtml(item.satuan)}</div>
            ${stokInfo}
          </div>

          <input
            class="er-qty"
            type="number"
            min="1"
            value="${item.qty}"
            data-qty-index="${index}"
            ${deleted || rejected ? 'disabled' : ''}
          >

          <div class="er-sub">
            ${deleted || rejected ? '-' : formatRupiah(item.qty * item.harga)}
          </div>

          <div class="er-acts">
            ${actionButtons}
          </div>
        </div>

        ${reasonRequired || edited ? `
          <div class="er-reason">
            <div class="er-reason-label">
              ${icon(reasonRequired ? 'alert-circle' : 'edit-3', { size: 12 })}
              ${reasonRequired ? 'Keterangan wajib' : 'Keterangan perubahan'}
            </div>
            <textarea
              data-reason-index="${index}"
              class="${reasonRequired && !item.reason ? 'required-empty' : ''}"
              placeholder="${reasonRequired ? 'Wajib isi alasan...' : 'Tulis keterangan (opsional)...'}"
            >${escapeHtml(item.reason)}</textarea>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const countEl = $('editSectionCount');
  if (countEl) countEl.textContent = `${modalState.items.length} item`;

  bindEditRowEvents();
  updateEditTotal();
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE TOTAL
// ─────────────────────────────────────────────────────────────────────────

function updateEditTotal() {
  const total = modalState.items
    .filter((i) => i.itemStatus === 'APPROVED')
    .reduce((s, i) => s + i.qty * i.harga, 0);

  const el = $('editTotal');
  if (el) el.textContent = formatRupiah(total);
}

// ─────────────────────────────────────────────────────────────────────────
// EDIT ROW ACTIONS
// ─────────────────────────────────────────────────────────────────────────

function bindEditRowEvents() {
  document.querySelectorAll('[data-qty-index]').forEach((input) => {
    input.addEventListener('change', () => {
      const index = toInt(input.dataset.qtyIndex);
      modalState.items[index].qty = Math.max(1, toInt(input.value, 1));
      renderEditRows();
    });
  });

  document.querySelectorAll('[data-reason-index]').forEach((textarea) => {
    textarea.addEventListener('input', () => {
      const index = toInt(textarea.dataset.reasonIndex);
      modalState.items[index].reason = textarea.value;
      if (textarea.value.trim()) {
        textarea.classList.remove('required-empty');
      }
    });
  });

  document.querySelectorAll('[data-edit-index]').forEach((btn) => {
    btn.addEventListener('click', () => editQuantity(toInt(btn.dataset.editIndex)));
  });

  document.querySelectorAll('[data-reject-index]').forEach((btn) => {
    btn.addEventListener('click', () => rejectItem(toInt(btn.dataset.rejectIndex)));
  });

  document.querySelectorAll('[data-delete-index]').forEach((btn) => {
    btn.addEventListener('click', () => deleteItem(toInt(btn.dataset.deleteIndex)));
  });

  document.querySelectorAll('[data-restore-index]').forEach((btn) => {
    btn.addEventListener('click', () => restoreItem(toInt(btn.dataset.restoreIndex)));
  });
}

async function editQuantity(index) {
  const item = modalState.items[index];

  const result = await prompt({
    icon: '✏️',
    title: 'Ubah Quantity',
    message: `${item.kode} — ${item.nama}\nQty asli: ${item.originalQty}\nQty saat ini: ${item.qty}`,
    placeholder: 'Keterangan perubahan (opsional)...',
    okText: 'Update',
    okVariant: 'info',
    required: false,
    defaultValue: item.reason,
    showNumber: true,
    numberValue: item.qty,
  });

  if (!result) return;

  const { text, number } = result;
  item.qty = Math.max(1, toInt(number, 1));
  item.reason = text || '';
  item.itemStatus = 'APPROVED';
  renderEditRows();
}

async function rejectItem(index) {
  const item = modalState.items[index];

  if (item.itemStatus === 'REJECTED') {
    restoreItem(index);
    return;
  }

  const reason = await prompt({
    icon: '🚫',
    title: 'Tolak Item',
    message: `${item.kode} — ${item.nama}\nQty: ${item.qty}\n\nIsi alasan wajib:`,
    placeholder: 'Contoh: Stok tidak cukup...',
    okText: 'Ya, Tolak',
    okVariant: 'danger',
    required: true,
    defaultValue: item.reason,
  });

  if (!reason) return;

  item.itemStatus = 'REJECTED';
  item.reason = reason;
  renderEditRows();
}

async function deleteItem(index) {
  const item = modalState.items[index];

  if (item.itemStatus === 'DELETED') {
    restoreItem(index);
    return;
  }

  const reason = await prompt({
    icon: '🗑️',
    title: 'Hapus Item',
    message: `${item.kode} — ${item.nama}\nQty: ${item.qty}\n\nIsi alasan wajib:`,
    placeholder: 'Contoh: Barang tidak tersedia...',
    okText: 'Ya, Hapus',
    okVariant: 'danger',
    required: true,
    defaultValue: item.reason,
  });

  if (!reason) return;

  item.itemStatus = 'DELETED';
  item.reason = reason;
  renderEditRows();
}

function restoreItem(index) {
  modalState.items[index].itemStatus = 'APPROVED';
  modalState.items[index].reason = '';
  renderEditRows();
}

// ─────────────────────────────────────────────────────────────────────────
// ADD NEW ITEM
// ─────────────────────────────────────────────────────────────────────────

function addNewItem() {
  const kodeSelect = $('addKode');
  const qtyInput = $('addQty');

  if (!kodeSelect || !qtyInput) return;

  const code = kodeSelect.value.trim();
  const quantity = Math.max(1, toInt(qtyInput.value, 1));

  if (!code) {
    toast.warning('Pilih barang dulu.');
    return;
  }

  const product = modalState.dashboardState.allKatalog.find(
    (item) => String(item.KODE_BARANG).toUpperCase() === code.toUpperCase()
  );

  if (!product) {
    toast.error('Barang tidak ditemukan di katalog.');
    return;
  }

  const existing = modalState.items.find(
    (item) =>
      item.kode.toUpperCase() === code.toUpperCase() &&
      item.itemStatus === 'APPROVED'
  );

  if (existing) {
    existing.qty += quantity;
    toast.info(`Qty ${existing.kode} bertambah jadi ${existing.qty}`);
  } else {
    modalState.items.push({
      kode: String(product.KODE_BARANG),
      nama: String(product.NAMA_BARANG || ''),
      kategori: String(product.KATEGORI || ''),
      qty: quantity,
      originalQty: 0,
      satuan: String(product.SATUAN || 'PCS'),
      harga: toNumber(product.HARGA),
      itemStatus: 'APPROVED',
      reason: 'Item baru ditambahkan admin',
      stokGudang: '',
      stokToko: '',
    });
    toast.success(`${product.NAMA_BARANG} ditambahkan`);
  }

  kodeSelect.value = '';
  qtyInput.value = 1;
  renderEditRows();
}

// ─────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────

function validateItems() {
  const errors = [];

  modalState.items.forEach((item, index) => {
    if (item.itemStatus === 'REJECTED' || item.itemStatus === 'DELETED') {
      if (!item.reason || !item.reason.trim()) {
        errors.push(`${item.kode} (${item.itemStatus === 'REJECTED' ? 'ditolak' : 'dihapus'}) belum ada alasan`);

        const textarea = document.querySelector(`[data-reason-index="${index}"]`);
        if (textarea) textarea.classList.add('required-empty');
      }
    }
  });

  return errors;
}

// ─────────────────────────────────────────────────────────────────────────
// SAVE / SEND EMAIL
// ─────────────────────────────────────────────────────────────────────────

async function handleSave(sendEmail) {
  if (!modalState.items.length) {
    toast.warning('Pesanan kosong. Tambahkan minimal 1 item.');
    return;
  }

  const errors = validateItems();
  if (errors.length > 0) {
    toast.error(`${errors.length} item ditolak/dihapus wajib punya alasan.`, {
      duration: 5000,
    });
    return;
  }

  const approved = modalState.items.filter((i) => i.itemStatus === 'APPROVED');
  const rejected = modalState.items.filter((i) => i.itemStatus === 'REJECTED');
  const deleted = modalState.items.filter((i) => i.itemStatus === 'DELETED');
  const edited = approved.filter((i) => i.originalQty && i.originalQty !== i.qty);
  const total = approved.reduce((s, i) => s + i.qty * i.harga, 0);

  const confirmMsg = sendEmail
    ? `Order ${modalState.orderId}\n\nStatus akan menjadi ${approved.length === 0 ? 'REJECTED' : 'APPROVED'}.\nEmail akan dikirim ke cabang.\n\n${approved.length} disetujui (${edited.length} diedit)\n${rejected.length} ditolak\n${deleted.length} dihapus\n\nTotal: ${formatRupiah(total)}`
    : `Order ${modalState.orderId}\n\nStatus order TETAP (tidak berubah).\nEmail belum dikirim.\n\n${approved.length} disetujui (${edited.length} diedit)\n${rejected.length} ditolak\n${deleted.length} dihapus\n\nTotal: ${formatRupiah(total)}`;

  const ok = await confirm({
    icon: sendEmail ? '📧' : '💾',
    title: sendEmail ? 'Approve & Kirim Email?' : 'Simpan Perubahan?',
    message: confirmMsg,
    okText: sendEmail ? 'Approve & Kirim' : 'Ya, Simpan',
    okVariant: sendEmail ? 'info' : 'success',
  });

  if (!ok) return;

  await submitEdit(sendEmail);
}

async function submitEdit(sendEmail) {
  const saveBtn = $('btnSaveEdit');
  const emailBtn = $('btnSendEmail');
  const printBtn = $('btnPrintForm');
  const cancelBtn = $('btnCloseModal');

  if (saveBtn) saveBtn.disabled = true;
  if (emailBtn) emailBtn.disabled = true;
  if (printBtn) printBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;

  const targetBtn = sendEmail ? emailBtn : saveBtn;
  const originalText = targetBtn?.innerHTML;
  if (targetBtn) {
    targetBtn.innerHTML = '<span class="spinner spinner-sm" style="color: #fff;"></span> Menyimpan...';
  }

  const catatanAdmin = $('editCatatan')?.value.trim() || '';

  const payload = {
    orderId: modalState.orderId,
    catatanAdmin,
    diprosesOleh: modalState.dashboardState.session?.nama || 'Admin Dashboard',
    kirimEmail: sendEmail,
    items: modalState.items.map((item) => ({
      kode: item.kode,
      nama: item.nama,
      kategori: item.kategori,
      qty: item.qty,
      satuan: item.satuan,
      harga: item.harga,
      itemStatus: item.itemStatus,
      reason: item.reason || '',
      originalQty: item.originalQty,
      stokGudang: item.stokGudang,
      stokToko: item.stokToko,
    })),
  };

  try {
    const result = await ordersApi.edit(payload);

    if (result.status !== 'ok') {
      toast.error(result.message || 'Gagal menyimpan perubahan.');

      if (saveBtn) saveBtn.disabled = false;
      if (emailBtn) emailBtn.disabled = false;
      if (printBtn) printBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      if (targetBtn) targetBtn.innerHTML = originalText;
      return;
    }

    toast.success(sendEmail
      ? 'Perubahan tersimpan & email terkirim!'
      : 'Perubahan tersimpan!'
    );

    closeEditModal();

    const { loadData } = await import('../dashboard.js');
    await loadData(true);

  } catch (error) {
    toast.error(error.message || 'Terjadi kesalahan.');

    if (saveBtn) saveBtn.disabled = false;
    if (emailBtn) emailBtn.disabled = false;
    if (printBtn) printBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    if (targetBtn) targetBtn.innerHTML = originalText;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PRINT FORM
// ─────────────────────────────────────────────────────────────────────────

function handlePrintForm() {
  if (!modalState.items.length) {
    toast.warning('Pesanan kosong. Tambahkan minimal 1 item.');
    return;
  }

  // Filter items yang tidak DELETED
  const activeItems = modalState.items.filter((i) => i.itemStatus !== 'DELETED');

  if (!activeItems.length) {
    toast.warning('Tidak ada item aktif untuk di-print.');
    return;
  }

  showPrintForm(modalState.order, modalState.items);
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindModalEvents() {
  $('btnTambahItem')?.addEventListener('click', addNewItem);
  $('btnSaveEdit')?.addEventListener('click', () => handleSave(false));
  $('btnSendEmail')?.addEventListener('click', () => handleSave(true));
  $('btnPrintForm')?.addEventListener('click', handlePrintForm);
  $('btnCloseModal')?.addEventListener('click', closeEditModal);

  $('addQty')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addNewItem();
    }
  });
}
