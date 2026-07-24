/* ═══════════════════════════════════════════════════════════════════════
   PRINT FORM — Form Order Barang printable (NK Style)
   Hanya untuk dashboard admin
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, parseAnyDate, toNumber } from '../../utils.js';
import { CABANG } from '../../config.js';
import { icon } from '../../icons.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

let printState = {
  order: null,
  items: [],
};

// ─────────────────────────────────────────────────────────────────────────
// INIT PRINT MODAL
// ─────────────────────────────────────────────────────────────────────────

export function initPrintForm() {
  // Buat modal container di body
  if ($('printModalContainer')) return;

  const container = document.createElement('div');
  container.id = 'printModalContainer';
  document.body.appendChild(container);

  container.innerHTML = `
    <div class="overlay print-overlay" id="printOverlay" role="dialog" aria-modal="true">
      <div class="modal modal-xl print-modal">

        <!-- MODAL HEADER -->
        <header class="modal-header print-modal-header">
          <div class="modal-title" id="printModalTitle">Preview Form Order</div>
          <div class="print-modal-actions">
            <button class="btn-print-action" id="btnDoPrint" type="button" title="Print">
              ${icon('download', { size: 16 })}
              Print / PDF
            </button>
            <button class="modal-close" id="printModalClose" type="button" aria-label="Tutup">
              ${icon('close', { size: 16 })}
            </button>
          </div>
        </header>

        <!-- PREVIEW CONTENT -->
        <div class="modal-body print-modal-body" id="printModalBody">
          <div id="printPreview"></div>
        </div>
      </div>
    </div>
  `;

  addPrintStyles();

  $('printModalClose')?.addEventListener('click', closePrintModal);
  $('btnDoPrint')?.addEventListener('click', doPrint);
  $('printOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'printOverlay') closePrintModal();
  });

  // Keyboard: Ctrl+P saat modal open
  document.addEventListener('keydown', (e) => {
    if ($('printOverlay')?.classList.contains('show')) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        doPrint();
      }
      if (e.key === 'Escape') {
        closePrintModal();
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────

function addPrintStyles() {
  if (document.getElementById('printFormStyles')) return;

  const style = document.createElement('style');
  style.id = 'printFormStyles';
  style.textContent = `
    /* ═══ MODAL WRAPPER ═══ */
    .print-overlay {
      background: rgba(0,0,0,0.85) !important;
    }

    .print-modal {
      max-width: 950px !important;
      background: #f0f0f0 !important;
      padding: 0 !important;
      max-height: calc(100dvh - 40px) !important;
    }

    .print-modal-header {
      background: var(--ink-2) !important;
      color: var(--text) !important;
      padding: 12px 20px !important;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .print-modal-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-print-action {
      background: linear-gradient(135deg, var(--orange), var(--orange-light));
      color: #fff;
      border: 0;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
      transition: transform 0.15s;
    }

    .btn-print-action:hover {
      transform: translateY(-1px);
    }

    .print-modal-body {
      background: #e0e0e0 !important;
      padding: 20px !important;
      overflow-y: auto;
    }

    /* ═══ PREVIEW PAPER (A4 Style) ═══ */
    #printPreview {
      background: #fff;
      color: #000;
      padding: 30px 35px;
      max-width: 850px;
      margin: 0 auto;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
      font-family: Arial, sans-serif;
      font-size: 12px;
      min-height: 1100px;
    }

    /* Header form */
    .pf-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 1px solid #000;
      margin-bottom: 12px;
    }

    .pf-title {
      font-size: 44px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -1px;
    }

    .pf-title-form { color: #E67E22; }
    .pf-title-order { color: #1B4F94; }

    .pf-logo {
      text-align: center;
    }

    .pf-logo-nk {
      font-size: 62px;
      font-weight: 900;
      line-height: 0.9;
      letter-spacing: -5px;
      font-family: 'Arial Black', Arial, sans-serif;
    }

    .pf-logo-nk .n { color: #000; }
    .pf-logo-nk .k { color: #E63329; }

    .pf-logo-text {
      background: #1B2C5C;
      padding: 5px 14px;
      margin-top: 2px;
    }

    .pf-logo-text-1 {
      color: #fff;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 2px;
      line-height: 1;
    }

    .pf-logo-text-2 {
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 3px;
      line-height: 1;
      margin-top: 2px;
    }

    .pf-logo-tagline {
      margin-top: 3px;
      font-size: 8px;
      font-weight: 700;
      color: #1B2C5C;
      letter-spacing: 0.3px;
    }

    /* Info section */
    .pf-info {
      margin-bottom: 12px;
    }

    .pf-info-row {
      display: flex;
      gap: 20px;
      padding: 3px 0;
      font-size: 13px;
    }

    .pf-info-label {
      font-weight: 700;
      min-width: 130px;
    }

    /* Table */
    .pf-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-bottom: 30px;
    }

    .pf-table thead {
      background: #B4D6F0;
    }

    .pf-table th {
      padding: 8px 4px;
      border: 1px solid #000;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
      color: #000;
    }

    .pf-table td {
      padding: 5px 4px;
      border: 1px solid #000;
      font-size: 12px;
      text-align: center;
      color: #000;
    }

    .pf-table td.jml-order {
      color: #00B050;
      font-weight: 600;
    }

    .pf-table td.text-left {
      text-align: left;
      padding-left: 10px;
    }

    .pf-table td.jenis {
      font-weight: 700;
    }

    /* Column widths */
    .pf-th-stock-sistem { width: 80px; }
    .pf-th-stock-gudang { width: 80px; }
    .pf-th-stock-rak { width: 75px; }
    .pf-th-jml-order { width: 85px; }
    .pf-th-kode { width: 100px; }
    .pf-th-jenis { width: 100px; }

    /* Signature section */
    .pf-signature {
      border: 1px solid #000;
      margin-top: 20px;
    }

    .pf-signature-row {
      display: flex;
    }

    .pf-signature-cell {
      flex: 1;
      padding: 18px 25px;
      text-align: center;
    }

    .pf-signature-cell:first-child { text-align: left; }
    .pf-signature-cell:last-child { text-align: right; }

    .pf-signature-label {
      font-size: 13px;
      color: #000;
    }

    .pf-signature-space {
      padding: 32px 0;
    }

    .pf-signature-line {
      font-size: 13px;
      color: #000;
      margin-bottom: 4px;
    }

    .pf-signature-role {
      font-size: 14px;
      font-weight: 900;
      color: #000;
    }

        /* ═══ PRINT MEDIA QUERY ═══ */
    @media print {
      /* FORCE PRINT COLORS (Chrome, Safari, Edge, Firefox) */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      html, body {
        background: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* Hide semua kecuali print preview */
      body > *:not(#printModalContainer) {
        display: none !important;
      }

      #printModalContainer,
      .print-overlay,
      .print-modal {
        position: static !important;
        max-width: 100% !important;
        max-height: none !important;
        background: #fff !important;
        box-shadow: none !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        transform: none !important;
      }

      .print-modal-header,
      .print-modal-actions {
        display: none !important;
      }

      .print-modal-body {
        background: #fff !important;
        padding: 0 !important;
        overflow: visible !important;
      }

      #printPreview {
        box-shadow: none !important;
        padding: 15px 20px !important;
        max-width: 100% !important;
        margin: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* FORCE COLORS untuk semua elemen preview */
      .pf-title-form { color: #E67E22 !important; }
      .pf-title-order { color: #1B4F94 !important; }
      .pf-logo-nk .n { color: #000 !important; }
      .pf-logo-nk .k { color: #E63329 !important; }
      .pf-logo-text {
        background: #1B2C5C !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .pf-logo-text-1,
      .pf-logo-text-2 { color: #fff !important; }
      .pf-logo-tagline { color: #1B2C5C !important; }

      .pf-table thead {
        background: #B4D6F0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .pf-table th,
      .pf-table td {
        border: 1px solid #000 !important;
        color: #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .pf-table td.jml-order {
        color: #00B050 !important;
        font-weight: 600 !important;
      }

      .pf-signature,
      .pf-signature-cell {
        border-color: #000 !important;
        color: #000 !important;
      }

      @page {
        size: A4;
        margin: 12mm;
      }
    }

     
    /* ═══ RESPONSIVE ═══ */
    @media (max-width: 768px) {
      .print-modal {
        max-width: calc(100vw - 24px) !important;
      }

      #printPreview {
        padding: 20px 15px;
        font-size: 11px;
      }

      .pf-title {
        font-size: 26px;
      }

      .pf-logo-nk {
        font-size: 40px;
      }

      .pf-info-row {
        flex-direction: column;
        gap: 4px;
      }

      .pf-table {
        font-size: 10px;
      }

      .pf-table th,
      .pf-table td {
        padding: 4px 2px;
        font-size: 10px;
      }
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────
// SHOW PRINT MODAL
// ─────────────────────────────────────────────────────────────────────────

export function showPrintForm(order, items) {
  if (!order || !items) return;

  printState.order = order;
  printState.items = items.filter((i) => i.itemStatus !== 'DELETED');

  renderPreview();

  $('printOverlay')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closePrintModal() {
  $('printOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER PREVIEW
// ─────────────────────────────────────────────────────────────────────────

function renderPreview() {
  const preview = $('printPreview');
  if (!preview) return;

  const { order, items } = printState;
  const cabang = CABANG[order.ID_CABANG] || { nama: '-', pic: '-' };
  const pic = String(cabang.pic || 'SUPERVISOR').toUpperCase();

  // Nomor order dari ORDER_ID (ambil detik dari timestamp)
  let nomorOrder = '1';
  try {
    const parts = String(order.ORDER_ID).split('-');
    const timeStr = parts[2] || '';
    if (timeStr.length >= 6) {
      nomorOrder = String(parseInt(timeStr.substring(4, 6)) || 1);
    }
  } catch(e) {}

  // Format tanggal
  const hariID = ['MINGGU','SENIN','SELASA','RABU','KAMIS','JUMAT','SABTU'];
  const date = parseAnyDate(order.TANGGAL_ORDER) || new Date();
  const hari = hariID[date.getDay()];
  const tglFormatted = `${hari}, ${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;

  const rows = items.map((item) => {
    const qty = toNumber(item.qty);
    const satuan = String(item.satuan || 'PCS').toUpperCase();
    const stokSistem = getStokBarang(item.kode);
    const stokGudang = item.stokGudang !== undefined && item.stokGudang !== '' ? String(item.stokGudang) : '0';
    const stokRak = item.stokToko !== undefined && item.stokToko !== '' ? String(item.stokToko) : '0';
    const jenis = String(item.kategori || 'ELEKTRONIK').toUpperCase();

    return `
      <tr>
        <td>${stokSistem}</td>
        <td>${stokGudang}</td>
        <td>${stokRak}</td>
        <td class="jml-order">${qty} ${satuan}</td>
        <td class="text-left">${escapeHtml(item.kode || '')}</td>
        <td class="text-left">${escapeHtml((item.nama || '').toUpperCase())}</td>
        <td class="jenis">${escapeHtml(jenis)}</td>
      </tr>
    `;
  }).join('');

  preview.innerHTML = `
    <!-- HEADER -->
    <div class="pf-header">
      <div class="pf-title">
        <span class="pf-title-form">FORM</span>
        <span class="pf-title-order"> ORDER BARANG</span>
      </div>

      <div class="pf-logo">
        <div class="pf-logo-nk">
          <span class="n">N</span><span class="k">K</span>
        </div>
        <div class="pf-logo-text">
          <div class="pf-logo-text-1">NASIONAL</div>
          <div class="pf-logo-text-2">KITCHEN</div>
        </div>
        <div class="pf-logo-tagline">PILIHAN BIJAK, HARGA TERBAIK</div>
      </div>
    </div>

    <!-- INFO -->
    <div class="pf-info">
      <div class="pf-info-row">
        <span class="pf-info-label">DIBUAT OLEH</span>
        <span>: ${pic}</span>
      </div>
      <div class="pf-info-row">
        <span class="pf-info-label">NOMOR ORDER</span>
        <span style="flex: 1;">: ${nomorOrder}</span>
        <span><b>Hari/Tgl</b> &nbsp;: ${tglFormatted}</span>
      </div>
    </div>

    <!-- TABLE -->
    <table class="pf-table">
      <thead>
        <tr>
          <th class="pf-th-stock-sistem">STOCK<br>SISTEM</th>
          <th class="pf-th-stock-gudang">STOCK<br>(Gudang)</th>
          <th class="pf-th-stock-rak">STOCK<br>(Rak)</th>
          <th class="pf-th-jml-order">JMLH<br>ORDER</th>
          <th class="pf-th-kode">KODE ITEM</th>
          <th>NAMA ITEM</th>
          <th class="pf-th-jenis">Jenis</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <!-- SIGNATURE -->
    <div class="pf-signature">
      <div class="pf-signature-row">
        <div class="pf-signature-cell">
          <div class="pf-signature-label">pengantar,</div>
        </div>
        <div class="pf-signature-cell">
          <div class="pf-signature-label">Persetujuan,</div>
        </div>
        <div class="pf-signature-cell">
          <div class="pf-signature-label">Penerima,</div>
        </div>
      </div>

      <div class="pf-signature-row">
        <div class="pf-signature-cell pf-signature-space"></div>
        <div class="pf-signature-cell pf-signature-space"></div>
        <div class="pf-signature-cell pf-signature-space"></div>
      </div>

      <div class="pf-signature-row">
        <div class="pf-signature-cell">
          <div class="pf-signature-line">(_______________)</div>
          <div class="pf-signature-role">Driver</div>
        </div>
        <div class="pf-signature-cell">
          <div class="pf-signature-line">(_______________)</div>
          <div class="pf-signature-role">SPV Gudang</div>
        </div>
        <div class="pf-signature-cell">
          <div class="pf-signature-line">(_______________)</div>
          <div class="pf-signature-role">SPV Cabang</div>
        </div>
      </div>
    </div>
  `;

  // Update title
  $('printModalTitle').textContent = `Preview Form Order — ${order.ORDER_ID}`;
}

// ─────────────────────────────────────────────────────────────────────────
// GET STOK BARANG (dari state dashboard)
// ─────────────────────────────────────────────────────────────────────────

function getStokBarang(kode) {
  try {
    const dashboardState = window.__gudangHub?.state;
    if (!dashboardState || !dashboardState.allKatalog) return '0';

    const upperKode = String(kode).trim().toUpperCase();
    const item = dashboardState.allKatalog.find(
      (b) => String(b.KODE_BARANG).trim().toUpperCase() === upperKode
    );

    return item ? String(parseInt(item.STOK) || 0) : '0';
  } catch (e) {
    return '0';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DO PRINT
// ─────────────────────────────────────────────────────────────────────────

function doPrint() {
  window.print();
}
