/* ═══════════════════════════════════════════════════════════════════════
   PRINT FORM CABANG — Form Order Barang printable (NK Style)
   Untuk halaman cabang (download & print)
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

export function initPrintFormCabang() {
  if ($('printCabangModalContainer')) return;

  const container = document.createElement('div');
  container.id = 'printCabangModalContainer';
  document.body.appendChild(container);

  container.innerHTML = `
    <div class="overlay print-cabang-overlay" id="printCabangOverlay" role="dialog" aria-modal="true">
      <div class="modal modal-xl print-cabang-modal">

        <!-- MODAL HEADER -->
        <header class="modal-header print-cabang-modal-header">
          <div class="modal-title" id="printCabangModalTitle">Preview Form Order</div>
          <div class="print-cabang-modal-actions">
            <button class="btn-download-action" id="btnDoDownloadCabang" type="button" title="Download PDF">
              ${icon('download', { size: 16 })}
              Download PDF
            </button>
            <button class="modal-close" id="printCabangModalClose" type="button" aria-label="Tutup">
              ${icon('close', { size: 16 })}
            </button>
          </div>
        </header>

        <!-- PREVIEW CONTENT -->
        <div class="modal-body print-cabang-modal-body" id="printCabangModalBody">
          <div id="printCabangPreview"></div>
        </div>
      </div>
    </div>
  `;

  addPrintCabangStyles();

  $('printCabangModalClose')?.addEventListener('click', closePrintCabangModal);
  $('btnDoDownloadCabang')?.addEventListener('click', doDownload);
  $('printCabangOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'printCabangOverlay') closePrintCabangModal();
  });

  document.addEventListener('keydown', (e) => {
    if ($('printCabangOverlay')?.classList.contains('show')) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        doDownload();
      }
      if (e.key === 'Escape') {
        closePrintCabangModal();
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────

function addPrintCabangStyles() {
  if (document.getElementById('printCabangStyles')) return;

  const style = document.createElement('style');
  style.id = 'printCabangStyles';
  style.textContent = `
    /* ═══ MODAL WRAPPER ═══ */
    .print-cabang-overlay {
      background: rgba(0,0,0,0.85) !important;
    }

    .print-cabang-modal {
      max-width: 950px !important;
      background: #f0f0f0 !important;
      padding: 0 !important;
      max-height: calc(100dvh - 40px) !important;
    }

    .print-cabang-modal-header {
      background: var(--ink-2) !important;
      color: var(--text) !important;
      padding: 12px 20px !important;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .print-cabang-modal-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .btn-download-action {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
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

    .btn-download-action:hover {
      transform: translateY(-1px);
    }

    .print-cabang-modal-body {
      background: #e0e0e0 !important;
      padding: 20px !important;
      overflow-y: auto;
    }

    /* ═══ PREVIEW PAPER (A4 Style) ═══ */
    #printCabangPreview {
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
    .pfc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 1px solid #000;
      margin-bottom: 12px;
    }

    .pfc-title {
      font-size: 44px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -1px;
    }

    .pfc-title-form { color: #E67E22; }
    .pfc-title-order { color: #1B4F94; }

    .pfc-logo {
      text-align: center;
    }

    .pfc-logo-nk {
      font-size: 62px;
      font-weight: 900;
      line-height: 0.9;
      letter-spacing: -5px;
      font-family: 'Arial Black', Arial, sans-serif;
    }

    .pfc-logo-nk .n { color: #000; }
    .pfc-logo-nk .k { color: #E63329; }

    .pfc-logo-text {
      background: #1B2C5C;
      padding: 5px 14px;
      margin-top: 2px;
    }

    .pfc-logo-text-1 {
      color: #fff;
      font-size: 14px;
      font-weight: 900;
      letter-spacing: 2px;
      line-height: 1;
    }

    .pfc-logo-text-2 {
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 3px;
      line-height: 1;
      margin-top: 2px;
    }

    .pfc-logo-tagline {
      margin-top: 3px;
      font-size: 8px;
      font-weight: 700;
      color: #1B2C5C;
      letter-spacing: 0.3px;
    }

    /* Info section */
    .pfc-info {
      margin-bottom: 12px;
    }

    .pfc-info-row {
      display: flex;
      gap: 20px;
      padding: 3px 0;
      font-size: 13px;
    }

    .pfc-info-label {
      font-weight: 700;
      min-width: 130px;
    }

    /* Status badge di info */
    .pfc-status-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      color: #fff;
    }

    .pfc-status-pending { background: #f59e0b; }
    .pfc-status-approved { background: #16a34a; }
    .pfc-status-rejected { background: #dc2626; }

    /* Table */
    .pfc-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000;
      margin-bottom: 30px;
    }

    .pfc-table thead {
      background: #B4D6F0;
    }

    .pfc-table th {
      padding: 8px 4px;
      border: 1px solid #000;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      line-height: 1.2;
      color: #000;
    }

    .pfc-table td {
      padding: 5px 4px;
      border: 1px solid #000;
      font-size: 12px;
      text-align: center;
      color: #000;
    }

    .pfc-table td.jml-order {
      color: #00B050;
      font-weight: 600;
    }

    .pfc-table td.text-left {
      text-align: left;
      padding-left: 10px;
    }

    .pfc-table td.jenis {
      font-weight: 700;
    }

    /* Column widths */
    .pfc-th-stock-sistem { width: 80px; }
    .pfc-th-stock-gudang { width: 80px; }
    .pfc-th-stock-rak { width: 75px; }
    .pfc-th-jml-order { width: 85px; }
    .pfc-th-kode { width: 100px; }
    .pfc-th-jenis { width: 100px; }

    /* Signature section */
    .pfc-signature {
      border: 1px solid #000;
      margin-top: 20px;
    }

    .pfc-signature-row {
      display: flex;
    }

    .pfc-signature-cell {
      flex: 1;
      padding: 18px 25px;
      text-align: center;
    }

    .pfc-signature-cell:first-child { text-align: left; }
    .pfc-signature-cell:last-child { text-align: right; }

    .pfc-signature-label {
      font-size: 13px;
      color: #000;
    }

    .pfc-signature-space {
      padding: 32px 0;
    }

    .pfc-signature-line {
      font-size: 13px;
      color: #000;
      margin-bottom: 4px;
    }

    .pfc-signature-role {
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
      body > *:not(#printCabangModalContainer) {
        display: none !important;
      }

      #printCabangModalContainer,
      .print-cabang-overlay,
      .print-cabang-modal {
        position: static !important;
        max-width: 100% !important;
        max-height: none !important;
        background: #fff !important;
        box-shadow: none !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        transform: none !important;
      }

      .print-cabang-modal-header,
      .print-cabang-modal-actions {
        display: none !important;
      }

      .print-cabang-modal-body {
        background: #fff !important;
        padding: 0 !important;
        overflow: visible !important;
      }

      #printCabangPreview {
        box-shadow: none !important;
        padding: 15px 20px !important;
        max-width: 100% !important;
        margin: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* FORCE COLORS untuk semua elemen preview */
      .pfc-title-form { color: #E67E22 !important; }
      .pfc-title-order { color: #1B4F94 !important; }
      .pfc-logo-nk .n { color: #000 !important; }
      .pfc-logo-nk .k { color: #E63329 !important; }
      .pfc-logo-text {
        background: #1B2C5C !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .pfc-logo-text-1,
      .pfc-logo-text-2 { color: #fff !important; }
      .pfc-logo-tagline { color: #1B2C5C !important; }

      /* Status badges */
      .pfc-status-badge {
        color: #fff !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .pfc-status-pending {
        background: #f59e0b !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .pfc-status-approved {
        background: #16a34a !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .pfc-status-rejected {
        background: #dc2626 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .pfc-table thead {
        background: #B4D6F0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .pfc-table th,
      .pfc-table td {
        border: 1px solid #000 !important;
        color: #000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .pfc-table td.jml-order {
        color: #00B050 !important;
        font-weight: 600 !important;
      }

      .pfc-signature,
      .pfc-signature-cell {
        border-color: #000 !important;
        color: #000 !important;
      }

      @page {
        size: A4;
        margin: 12mm;
      }
    }

      #printCabangModalContainer,
      .print-cabang-overlay,
      .print-cabang-modal {
        position: static !important;
        max-width: 100% !important;
        max-height: none !important;
        background: #fff !important;
        box-shadow: none !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        transform: none !important;
      }

      .print-cabang-modal-header,
      .print-cabang-modal-actions {
        display: none !important;
      }

      .print-cabang-modal-body {
        background: #fff !important;
        padding: 0 !important;
        overflow: visible !important;
      }

      #printCabangPreview {
        box-shadow: none !important;
        padding: 15px 20px !important;
        max-width: 100% !important;
        margin: 0 !important;
      }

      @page {
        size: A4;
        margin: 12mm;
      }
    }

    /* ═══ RESPONSIVE ═══ */
    @media (max-width: 768px) {
      .print-cabang-modal {
        max-width: calc(100vw - 24px) !important;
      }

      #printCabangPreview {
        padding: 20px 15px;
        font-size: 11px;
      }

      .pfc-title {
        font-size: 26px;
      }

      .pfc-logo-nk {
        font-size: 40px;
      }

      .pfc-info-row {
        flex-direction: column;
        gap: 4px;
      }

      .pfc-table {
        font-size: 10px;
      }

      .pfc-table th,
      .pfc-table td {
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

export function showPrintFormCabang(order) {
  if (!order) return;

  printState.order = order;
  printState.items = (order.DETAIL || []).filter((i) => {
    const status = String(i.ITEM_STATUS || 'APPROVED').toUpperCase();
    return status !== 'DELETED';
  });

  renderPreview();

  $('printCabangOverlay')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closePrintCabangModal() {
  $('printCabangOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER PREVIEW
// ─────────────────────────────────────────────────────────────────────────

function renderPreview() {
  const preview = $('printCabangPreview');
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

  // Status badge
  const status = String(order.STATUS || 'PENDING').toUpperCase();
  const statusClass = status === 'APPROVED' ? 'pfc-status-approved'
                    : status === 'REJECTED' ? 'pfc-status-rejected'
                    : 'pfc-status-pending';
  const statusLabel = status === 'APPROVED' ? 'DISETUJUI'
                    : status === 'REJECTED' ? 'DITOLAK'
                    : 'MENUNGGU';

  const rows = items.map((item) => {
    const qty = toNumber(item.QTY);
    const satuan = String(item.SATUAN || 'PCS').toUpperCase();
    const stokSistem = getStokBarangCabang(item.KODE_BARANG);
    const stokGudang = item.STOK_GUDANG !== undefined && item.STOK_GUDANG !== '' ? String(item.STOK_GUDANG) : '0';
    const stokRak = item.STOK_TOKO !== undefined && item.STOK_TOKO !== '' ? String(item.STOK_TOKO) : '0';
    const jenis = String(item.KATEGORI || 'ELEKTRONIK').toUpperCase();

    return `
      <tr>
        <td>${stokSistem}</td>
        <td>${stokGudang}</td>
        <td>${stokRak}</td>
        <td class="jml-order">${qty} ${satuan}</td>
        <td class="text-left">${escapeHtml(item.KODE_BARANG || '')}</td>
        <td class="text-left">${escapeHtml((item.NAMA_BARANG || '').toUpperCase())}</td>
        <td class="jenis">${escapeHtml(jenis)}</td>
      </tr>
    `;
  }).join('');

  preview.innerHTML = `
    <!-- HEADER -->
    <div class="pfc-header">
      <div class="pfc-title">
        <span class="pfc-title-form">FORM</span>
        <span class="pfc-title-order"> ORDER BARANG</span>
      </div>

      <div class="pfc-logo">
        <div class="pfc-logo-nk">
          <span class="n">N</span><span class="k">K</span>
        </div>
        <div class="pfc-logo-text">
          <div class="pfc-logo-text-1">NASIONAL</div>
          <div class="pfc-logo-text-2">KITCHEN</div>
        </div>
        <div class="pfc-logo-tagline">PILIHAN BIJAK, HARGA TERBAIK</div>
      </div>
    </div>

    <!-- INFO -->
    <div class="pfc-info">
      <div class="pfc-info-row">
        <span class="pfc-info-label">DIBUAT OLEH</span>
        <span>: ${pic}</span>
      </div>
      <div class="pfc-info-row">
        <span class="pfc-info-label">NOMOR ORDER</span>
        <span style="flex: 1;">: ${nomorOrder}</span>
        <span><b>Hari/Tgl</b> &nbsp;: ${tglFormatted}</span>
      </div>
      <div class="pfc-info-row">
        <span class="pfc-info-label">STATUS ORDER</span>
        <span>: <span class="pfc-status-badge ${statusClass}">${statusLabel}</span></span>
      </div>
    </div>

    <!-- TABLE -->
    <table class="pfc-table">
      <thead>
        <tr>
          <th class="pfc-th-stock-sistem">STOCK<br>SISTEM</th>
          <th class="pfc-th-stock-gudang">STOCK<br>(Gudang)</th>
          <th class="pfc-th-stock-rak">STOCK<br>(Rak)</th>
          <th class="pfc-th-jml-order">JMLH<br>ORDER</th>
          <th class="pfc-th-kode">KODE ITEM</th>
          <th>NAMA ITEM</th>
          <th class="pfc-th-jenis">Jenis</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <!-- SIGNATURE -->
    <div class="pfc-signature">
      <div class="pfc-signature-row">
        <div class="pfc-signature-cell">
          <div class="pfc-signature-label">pengantar,</div>
        </div>
        <div class="pfc-signature-cell">
          <div class="pfc-signature-label">Persetujuan,</div>
        </div>
        <div class="pfc-signature-cell">
          <div class="pfc-signature-label">Penerima,</div>
        </div>
      </div>

      <div class="pfc-signature-row">
        <div class="pfc-signature-cell pfc-signature-space"></div>
        <div class="pfc-signature-cell pfc-signature-space"></div>
        <div class="pfc-signature-cell pfc-signature-space"></div>
      </div>

      <div class="pfc-signature-row">
        <div class="pfc-signature-cell">
          <div class="pfc-signature-line">(_______________)</div>
          <div class="pfc-signature-role">Driver</div>
        </div>
        <div class="pfc-signature-cell">
          <div class="pfc-signature-line">(_______________)</div>
          <div class="pfc-signature-role">SPV Gudang</div>
        </div>
        <div class="pfc-signature-cell">
          <div class="pfc-signature-line">(_______________)</div>
          <div class="pfc-signature-role">SPV Cabang</div>
        </div>
      </div>
    </div>
  `;

  // Update title
  $('printCabangModalTitle').textContent = `Preview Form Order — ${order.ORDER_ID}`;
}

// ─────────────────────────────────────────────────────────────────────────
// GET STOK BARANG (dari state order cabang)
// ─────────────────────────────────────────────────────────────────────────

function getStokBarangCabang(kode) {
  try {
    const orderState = window.__gudangHubOrder?.state;
    if (!orderState || !orderState.productByCode) return '0';

    const upperKode = String(kode).trim().toUpperCase();
    const product = orderState.productByCode[upperKode];

    return product ? String(parseInt(product.STOK) || 0) : '0';
  } catch (e) {
    return '0';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DO DOWNLOAD (Print / Save as PDF)
// ─────────────────────────────────────────────────────────────────────────

function doDownload() {
  window.print();
}
