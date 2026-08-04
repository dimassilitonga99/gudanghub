/* ═══════════════════════════════════════════════════════════════════════
   PRINT FORM ADMIN — Multi-page (max 20 items per page)
   - Preview: scroll multi-page
   - Print PDF: 1 file multiple pages
   - Stok sistem dari SNAPSHOT
   ═══════════════════════════════════════════════════════════════════════ */

import {
  $,
  escapeHtml,
  formatWita,
  parseAnyDate,
  toNumber,
} from '../../utils.js';

import { CABANG } from '../../config.js';
import { icon } from '../../icons.js';

var ITEMS_PER_PAGE = 20;

var printState = {
  order: null,
  items: [],
  pages: [],
};

var CELL_STYLE = ''
  + 'padding: 8px 6px;'
  + ' border: 1px solid #000;'
  + ' font-family: Arial, sans-serif;'
  + ' font-size: 12px;'
  + ' vertical-align: middle;'
  + ' text-align: center;';

var HEADER_CELL_STYLE = ''
  + 'padding: 8px 6px;'
  + ' border: 1px solid #000;'
  + ' font-family: Arial, sans-serif;'
  + ' font-size: 12px;'
  + ' font-weight: 700;'
  + ' text-align: center;'
  + ' vertical-align: middle;'
  + ' line-height: 1.2;';

var SIGN_CELL_STYLE = ''
  + 'text-align: center;'
  + ' font-family: Arial, sans-serif;'
  + ' vertical-align: top;';

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initPrintForm() {

  if ($('printModalContainer')) return;

  var container = document.createElement('div');
  container.id = 'printModalContainer';
  document.body.appendChild(container);

  var modalHtml = ''
    + '<div class="overlay print-overlay" id="printOverlay" role="dialog" aria-modal="true">'
    + '<div class="modal modal-xl print-modal">'

    + '<header class="modal-header print-modal-header">'
    + '<div class="modal-title" id="printModalTitle">Preview Form Order</div>'
    + '<div class="print-modal-actions">'

    + '<button class="btn-print-action" id="btnDoPrint" type="button" title="Print / PDF">'
    + icon('download', { size: 16 })
    + ' Print / PDF'
    + '</button>'

    + '<button class="modal-close" id="printModalClose" type="button" aria-label="Tutup">'
    + icon('close', { size: 16 })
    + '</button>'

    + '</div>'
    + '</header>'

    + '<div class="modal-body print-modal-body" id="printModalBody">'
    + '<div id="printPreview"></div>'
    + '</div>'

    + '</div>'
    + '</div>';

  container.innerHTML = modalHtml;

  addPrintStyles();

  $('printModalClose')?.addEventListener('click', closePrintModal);
  $('btnDoPrint')?.addEventListener('click', doPrint);

  $('printOverlay')?.addEventListener('click', function (e) {
    if (e.target.id === 'printOverlay') {
      closePrintModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!$('printOverlay')?.classList.contains('show')) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      doPrint();
    }

    if (e.key === 'Escape') {
      closePrintModal();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────

function addPrintStyles() {

  if (document.getElementById('printFormStyles')) return;

  var style = document.createElement('style');
  style.id = 'printFormStyles';

  style.textContent = ''
    + '.print-overlay { background: rgba(0, 0, 0, 0.85) !important; }'
    + '.print-modal { max-width: 950px !important; background: #f0f0f0 !important; padding: 0 !important; max-height: calc(100dvh - 40px) !important; }'
    + '.print-modal-header { background: var(--ink-2) !important; color: var(--text) !important; padding: 12px 20px !important; display: flex; align-items: center; justify-content: space-between; gap: 12px; }'
    + '.print-modal-actions { display: flex; align-items: center; gap: 8px; }'
    + '.btn-print-action { background: linear-gradient(135deg, var(--orange), var(--orange-light)); color: #fff; border: 0; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; transition: transform 0.15s; }'
    + '.btn-print-action:hover { transform: translateY(-1px); }'
    + '.print-modal-body { background: #e0e0e0 !important; padding: 20px !important; overflow-y: auto; }'

    // Multi-page container
    + '.print-page-admin { background: #fff; color: #000; padding: 30px 35px; max-width: 850px; margin: 0 auto 24px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3); font-family: Arial, sans-serif; font-size: 12px; min-height: 600px; page-break-after: always; }'
    + '.print-page-admin:last-child { page-break-after: auto; margin-bottom: 0; }'

    // Badge halaman
    + '.page-badge-admin { display: inline-block; padding: 4px 12px; background: #ff6b00; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; }'

    + '@media print {'
    + '  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }'
    + '  body > *:not(#printModalContainer) { display: none !important; }'
    + '  #printModalContainer, .print-overlay, .print-modal { position: static !important; max-width: 100% !important; max-height: none !important; background: #fff !important; box-shadow: none !important; opacity: 1 !important; pointer-events: auto !important; transform: none !important; }'
    + '  .print-modal-header, .print-modal-actions { display: none !important; }'
    + '  .print-modal-body { background: #fff !important; padding: 0 !important; overflow: visible !important; }'
    + '  .print-page-admin { box-shadow: none !important; padding: 15px 20px !important; margin: 0 !important; page-break-after: always; }'
    + '  .print-page-admin:last-child { page-break-after: auto; }'
    + '  @page { size: A4; margin: 12mm; }'
    + '}'

    + '@media (max-width: 768px) {'
    + '  .print-modal { max-width: calc(100vw - 24px) !important; }'
    + '  .print-page-admin { padding: 20px 15px; font-size: 11px; }'
    + '}';

  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────
// SHOW MODAL
// ─────────────────────────────────────────────────────────────────────────

export function showPrintForm(order, items) {

  if (!order || !items) return;

  printState.order = order;

  // Filter items (skip DELETED)
  printState.items = items.filter(function (i) {
    return i.itemStatus !== 'DELETED';
  });

  // Split ke pages
  printState.pages = chunkArray(printState.items, ITEMS_PER_PAGE);

  renderPreview();
  openModal();
}

function openModal() {
  $('printOverlay')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closePrintModal() {
  $('printOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
}

// ─────────────────────────────────────────────────────────────────────────
// HELPER: Split array to chunks
// ─────────────────────────────────────────────────────────────────────────

function chunkArray(arr, size) {
  var chunks = [];
  for (var i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks.length === 0 ? [[]] : chunks;
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER PREVIEW — Multi-page
// ─────────────────────────────────────────────────────────────────────────

function renderPreview() {

  var preview = $('printPreview');
  if (!preview) return;

  var order = printState.order;
  var pages = printState.pages;
  var totalPages = pages.length;

  var cabang = CABANG[order.ID_CABANG] || { nama: '-', pic: '-' };
  var pic = String(cabang.pic || 'SUPERVISOR').toUpperCase();

  var nomorOrder = getSequentialNumber(order);

  var hariID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  var date = parseAnyDate(order.TANGGAL_ORDER) || new Date();
  var hari = hariID[date.getDay()];
  var tgl = hari + ', '
    + String(date.getDate()).padStart(2, '0') + '/'
    + String(date.getMonth() + 1).padStart(2, '0') + '/'
    + date.getFullYear();

  // Render setiap halaman
  var allPagesHtml = pages.map(function (pageItems, pageIndex) {
    return buildPageHtml({
      order: order,
      pageItems: pageItems,
      pageIndex: pageIndex,
      totalPages: totalPages,
      pic: pic,
      nomorOrder: nomorOrder,
      tgl: tgl,
    });
  }).join('');

  preview.innerHTML = allPagesHtml;

  var titleText = 'Preview Form Order — ' + order.ORDER_ID;
  if (totalPages > 1) {
    titleText += ' (' + totalPages + ' halaman)';
  }
  $('printModalTitle').textContent = titleText;
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD 1 HALAMAN FORM
// ─────────────────────────────────────────────────────────────────────────

function buildPageHtml(params) {

  var pageItems = params.pageItems;
  var pageIndex = params.pageIndex;
  var totalPages = params.totalPages;
  var pic = params.pic;
  var nomorOrder = params.nomorOrder;
  var tgl = params.tgl;

  var pageNumber = pageIndex + 1;

  // Info halaman
  var pageInfoHtml = '';
  if (totalPages > 1) {
    pageInfoHtml = ''
      + '<span class="page-badge-admin" style="margin-left: 8px;">'
      + 'HALAMAN ' + pageNumber + ' / ' + totalPages
      + '</span>';
  }

  var rows = buildTableRows(pageItems);

  var html = ''
    + '<div class="print-page-admin" data-page="' + pageNumber + '">'

    // HEADER
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 0;">'
    + '<tr>'
    + '<td style="vertical-align: top; padding-bottom: 14px; padding-top: 4px;">'
    + '<div style="font-family: Arial, sans-serif; font-size: 42px; font-weight: 900; line-height: 1; letter-spacing: -1px;">'
    + '<span style="color: #E67E22;">FORM</span>'
    + '<span style="color: #1B4F94;"> ORDER BARANG</span>'
    + '</div>'
    + '</td>'
    + '<td style="vertical-align: top; text-align: right; width: 180px; padding-bottom: 14px;">'
    + '<img src="./images/logo/logo-nk.png"'
    + ' alt="Logo Nasional Kitchen"'
    + ' style="width: 160px; height: auto; display: block; margin-left: auto;"'
    + ' crossorigin="anonymous"'
    + ' onerror="this.style.display=\'none\';"'
    + '>'
    + '</td>'
    + '</tr>'
    + '</table>'

    + '<div style="border-top: 1px solid #000; margin-bottom: 12px;"></div>'

    // INFO
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 14px; font-family: Arial, sans-serif; font-size: 13px; color: #000;">'
    + '<tr>'
    + '<td style="padding: 3px 0; width: 140px; font-weight: 700; vertical-align: top;">DIBUAT OLEH</td>'
    + '<td style="padding: 3px 0; vertical-align: top;">: ' + pic + '</td>'
    + '<td></td>'
    + '</tr>'
    + '<tr>'
    + '<td style="padding: 3px 0; font-weight: 700; vertical-align: top;">NOMOR ORDER</td>'
    + '<td style="padding: 3px 0; vertical-align: top;">'
    + ': ' + nomorOrder + pageInfoHtml
    + '</td>'
    + '<td style="padding: 3px 0; text-align: right; vertical-align: top; white-space: nowrap;">'
    + '<span style="font-weight: 700;">Hari/Tgl</span> : ' + tgl
    + '</td>'
    + '</tr>'
    + '</table>'

    // TABLE
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; border: 1px solid #000; margin-bottom: 30px;">'
    + buildTableHeader()
    + '<tbody>' + rows + '</tbody>'
    + '</table>'

    + buildSignatureTable()

    + '</div>';

  return html;
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD TABLE HEADER
// ─────────────────────────────────────────────────────────────────────────

function buildTableHeader() {

  var html = '';

  html += '<thead>';
  html += '<tr style="background: #B4D6F0;">';

  html += '<th style="' + HEADER_CELL_STYLE + ' width: 80px;">';
  html += 'STOCK<br>SISTEM';
  html += '</th>';

  html += '<th style="' + HEADER_CELL_STYLE + ' width: 80px;">';
  html += 'STOCK<br>(Gudang)';
  html += '</th>';

  html += '<th style="' + HEADER_CELL_STYLE + ' width: 75px;">';
  html += 'STOCK<br>(Rak)';
  html += '</th>';

  html += '<th style="' + HEADER_CELL_STYLE + ' width: 85px;">';
  html += 'JMLH<br>ORDER';
  html += '</th>';

  html += '<th style="' + HEADER_CELL_STYLE + ' width: 100px;">';
  html += 'KODE ITEM';
  html += '</th>';

  html += '<th style="' + HEADER_CELL_STYLE + '">';
  html += 'NAMA ITEM';
  html += '</th>';

  html += '<th style="' + HEADER_CELL_STYLE + ' width: 100px;">';
  html += 'Jenis';
  html += '</th>';

  html += '</tr>';
  html += '</thead>';

  return html;
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD TABLE ROWS
// ─────────────────────────────────────────────────────────────────────────

function buildTableRows(items) {

  var html = '';

  items.forEach(function (item) {

    var qty = toNumber(item.qty);
    var sat = String(item.satuan || 'PCS').toUpperCase();

    var stokSistem = '0';
    if (item.stokSistem !== undefined && item.stokSistem !== '' && item.stokSistem !== null) {
      stokSistem = String(item.stokSistem);
    } else if (item.STOK_SISTEM !== undefined && item.STOK_SISTEM !== '' && item.STOK_SISTEM !== null) {
      stokSistem = String(item.STOK_SISTEM);
    } else {
      stokSistem = getStokBarang(item.kode);
    }

    var stokGudang = '0';
    if (item.stokGudang !== undefined && item.stokGudang !== '') {
      stokGudang = String(item.stokGudang);
    }

    var stokRak = '0';
    if (item.stokToko !== undefined && item.stokToko !== '') {
      stokRak = String(item.stokToko);
    }

    var kode = escapeHtml(item.kode || '');
    var nama = escapeHtml((item.nama || '').toUpperCase());
    var jenis = escapeHtml(String(item.kategori || 'ELEKTRONIK').toUpperCase());

    html += '<tr>';

    html += '<td style="' + CELL_STYLE + '">';
    html += stokSistem;
    html += '</td>';

    html += '<td style="' + CELL_STYLE + '">';
    html += stokGudang;
    html += '</td>';

    html += '<td style="' + CELL_STYLE + '">';
    html += stokRak;
    html += '</td>';

    html += '<td style="' + CELL_STYLE + ' color: #00B050; font-weight: 600;">';
    html += qty + ' ' + sat;
    html += '</td>';

    html += '<td style="' + CELL_STYLE + '">';
    html += kode;
    html += '</td>';

    html += '<td style="' + CELL_STYLE + '">';
    html += nama;
    html += '</td>';

    html += '<td style="' + CELL_STYLE + ' font-weight: 700;">';
    html += jenis;
    html += '</td>';

    html += '</tr>';
  });

  return html;
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD SIGNATURE TABLE
// ─────────────────────────────────────────────────────────────────────────

function buildSignatureTable() {

  var html = '';

  html += '<table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #000; border-collapse: collapse; margin-top: 0;">';

  html += '<tr>';
  html += '<td style="' + SIGN_CELL_STYLE + ' padding: 18px 25px 5px 25px; width: 33%; font-size: 13px;">pengantar,</td>';
  html += '<td style="' + SIGN_CELL_STYLE + ' padding: 18px 25px 5px 25px; width: 34%; font-size: 13px;">Persetujuan,</td>';
  html += '<td style="' + SIGN_CELL_STYLE + ' padding: 18px 25px 5px 25px; width: 33%; font-size: 13px;">Penerima,</td>';
  html += '</tr>';

  html += '<tr>';
  html += '<td colspan="3" style="padding: 32px 0;">&nbsp;</td>';
  html += '</tr>';

  html += '<tr>';
  html += '<td style="' + SIGN_CELL_STYLE + ' padding: 0 25px 5px 25px; font-size: 13px;">(_______________)</td>';
  html += '<td style="' + SIGN_CELL_STYLE + ' padding: 0 25px 5px 25px; font-size: 13px;">(_______________)</td>';
  html += '<td style="' + SIGN_CELL_STYLE + ' padding: 0 25px 5px 25px; font-size: 13px;">(_______________)</td>';
  html += '</tr>';

  html += '<tr>';
  html += '<td style="' + SIGN_CELL_STYLE + ' padding: 0 25px 18px 25px; font-size: 14px; font-weight: 900;">Driver</td>';
  html += '<td style="' + SIGN_CELL_STYLE + ' padding: 0 25px 18px 25px; font-size: 14px; font-weight: 900;">SPV Gudang</td>';
  html += '<td style="' + SIGN_CELL_STYLE + ' padding: 0 25px 18px 25px; font-size: 14px; font-weight: 900;">SPV Cabang</td>';
  html += '</tr>';

  html += '</table>';

  return html;
}

// ─────────────────────────────────────────────────────────────────────────
// PRINT
// ─────────────────────────────────────────────────────────────────────────

function doPrint() {
  window.print();
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function getStokBarang(kode) {
  try {

    var dashboardState = window.__gudangHub?.state;

    if (!dashboardState || !dashboardState.allKatalog) {
      return '0';
    }

    var upperKode = String(kode).trim().toUpperCase();

    var item = dashboardState.allKatalog.find(function (b) {
      return String(b.KODE_BARANG).trim().toUpperCase() === upperKode;
    });

    return item
      ? String(parseInt(item.STOK) || 0)
      : '0';

  } catch (e) {
    return '0';
  }
}

function getSequentialNumber(order) {
  try {

    var dashboardState = window.__gudangHub?.state;

    if (!dashboardState || !dashboardState.allOrders) {
      return '01';
    }

    var orderDate = parseAnyDate(order.TANGGAL_ORDER);

    if (!orderDate || orderDate.getTime() === 0) {
      return '01';
    }

    var targetMonth = orderDate.getMonth();
    var targetYear = orderDate.getFullYear();

    var sameMonth = dashboardState.allOrders

      .filter(function (o) {

        var d = parseAnyDate(o.TANGGAL_ORDER);

        return d
          && d.getTime() !== 0
          && d.getMonth() === targetMonth
          && d.getFullYear() === targetYear;
      })

      .sort(function (a, b) {

        return parseAnyDate(a.TANGGAL_ORDER).getTime()
             - parseAnyDate(b.TANGGAL_ORDER).getTime();
      });

    var idx = sameMonth.findIndex(function (o) {
      return o.ORDER_ID === order.ORDER_ID;
    });

    var nomor = (idx >= 0) ? (idx + 1) : (sameMonth.length + 1);

    return nomor < 10
      ? '0' + nomor
      : String(nomor);

  } catch (e) {
    return '01';
  }
}
