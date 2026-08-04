/* ═══════════════════════════════════════════════════════════════════════
   PRINT FORM CABANG — Multi-page + Font Besar + Row Kompak
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, parseAnyDate, toNumber } from '../../utils.js';
import { CABANG } from '../../config.js';
import { icon } from '../../icons.js';

var ITEMS_PER_PAGE = 20;

var printState = {
  order: null,
  items: [],
  pages: [],
};

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initPrintFormCabang() {

  if ($('printCabangModalContainer')) return;

  var container = document.createElement('div');
  container.id = 'printCabangModalContainer';
  document.body.appendChild(container);

  container.innerHTML = ''
    + '<div class="overlay print-cabang-overlay" id="printCabangOverlay" role="dialog" aria-modal="true">'
    + '<div class="modal modal-xl print-cabang-modal">'

    + '<header class="modal-header print-cabang-modal-header">'
    + '<div class="modal-title" id="printCabangModalTitle">Preview Form Order</div>'
    + '<div class="print-cabang-modal-actions">'

    + '<button class="btn-download-jpg" id="btnDownloadJpg" type="button" title="Download JPG">'
    + icon('download', { size: 16 })
    + ' <span id="btnJpgText">Download JPG</span>'
    + '</button>'

    + '<button class="btn-download-action" id="btnDoDownloadCabang" type="button" title="Download PDF">'
    + icon('download', { size: 16 })
    + ' Download PDF'
    + '</button>'

    + '<button class="modal-close" id="printCabangModalClose" type="button" aria-label="Tutup">'
    + icon('close', { size: 16 })
    + '</button>'

    + '</div>'
    + '</header>'

    + '<div class="modal-body print-cabang-modal-body" id="printCabangModalBody">'
    + '<div id="printCabangPreview"></div>'
    + '</div>'

    + '</div>'
    + '</div>';

  addPrintCabangStyles();

  $('printCabangModalClose')?.addEventListener('click', closePrintCabangModal);
  $('btnDoDownloadCabang')?.addEventListener('click', doDownloadPdf);
  $('btnDownloadJpg')?.addEventListener('click', doDownloadJpg);

  $('printCabangOverlay')?.addEventListener('click', function (e) {
    if (e.target.id === 'printCabangOverlay') {
      closePrintCabangModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (!$('printCabangOverlay')?.classList.contains('show')) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      doDownloadPdf();
    }

    if (e.key === 'Escape') {
      closePrintCabangModal();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────

function addPrintCabangStyles() {

  if (document.getElementById('printCabangStyles')) return;

  var style = document.createElement('style');
  style.id = 'printCabangStyles';
  style.textContent = ''
    + '.print-cabang-overlay { background: rgba(0,0,0,0.85) !important; }'
    + '.print-cabang-modal { max-width: 950px !important; background: #f0f0f0 !important; padding: 0 !important; max-height: calc(100dvh - 40px) !important; }'
    + '.print-cabang-modal-header { background: var(--ink-2) !important; color: var(--text) !important; padding: 12px 20px !important; display: flex; align-items: center; justify-content: space-between; gap: 8px; }'
    + '.print-cabang-modal-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }'
    + '.btn-download-action { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; border: 0; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; transition: transform 0.15s; }'
    + '.btn-download-action:hover { transform: translateY(-1px); }'
    + '.btn-download-jpg { background: linear-gradient(135deg, #16a34a, #15803d); color: #fff; border: 0; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; transition: transform 0.15s; }'
    + '.btn-download-jpg:hover { transform: translateY(-1px); }'
    + '.btn-download-jpg.loading, .btn-download-action.loading { opacity: 0.7; pointer-events: none; }'
    + '.print-cabang-modal-body { background: #e0e0e0 !important; padding: 20px !important; overflow-y: auto; }'
    + '.print-page { background: #fff; color: #000; padding: 28px 32px; max-width: 850px; margin: 0 auto 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); font-family: Arial, sans-serif; font-size: 14px; min-height: 500px; page-break-after: always; }'
    + '.print-page:last-child { page-break-after: auto; margin-bottom: 0; }'
    + '.page-badge { display: inline-block; padding: 3px 10px; background: #ff6b00; color: #fff; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }'

    + '@media print {'
    + '  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }'
    + '  body > *:not(#printCabangModalContainer) { display: none !important; }'
    + '  #printCabangModalContainer, .print-cabang-overlay, .print-cabang-modal { position: static !important; max-width: 100% !important; max-height: none !important; background: #fff !important; box-shadow: none !important; opacity: 1 !important; pointer-events: auto !important; transform: none !important; }'
    + '  .print-cabang-modal-header, .print-cabang-modal-actions { display: none !important; }'
    + '  .print-cabang-modal-body { background: #fff !important; padding: 0 !important; overflow: visible !important; }'
    + '  .print-page { box-shadow: none !important; padding: 12px 18px !important; margin: 0 !important; page-break-after: always; }'
    + '  .print-page:last-child { page-break-after: auto; }'
    + '  @page { size: A4; margin: 10mm; }'
    + '}'

    + '@media (max-width: 768px) {'
    + '  .print-cabang-modal { max-width: calc(100vw - 24px) !important; }'
    + '  .print-page { padding: 18px 12px; font-size: 12px; }'
    + '}';

  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────
// SHOW / CLOSE
// ─────────────────────────────────────────────────────────────────────────

export function showPrintFormCabang(order) {

  if (!order) return;

  printState.order = order;

  printState.items = (order.DETAIL || []).filter(function (i) {
    var status = String(i.ITEM_STATUS || 'APPROVED').toUpperCase();
    return status !== 'DELETED';
  });

  printState.pages = chunkArray(printState.items, ITEMS_PER_PAGE);

  var jpgText = $('btnJpgText');
  if (jpgText) {
    if (printState.pages.length > 1) {
      jpgText.textContent = 'Download ' + printState.pages.length + ' JPG';
    } else {
      jpgText.textContent = 'Download JPG';
    }
  }

  renderPreview();

  $('printCabangOverlay')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closePrintCabangModal() {
  $('printCabangOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
}

function chunkArray(arr, size) {
  var chunks = [];
  for (var i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks.length === 0 ? [[]] : chunks;
}

// ─────────────────────────────────────────────────────────────────────────
// RENDER PREVIEW
// ─────────────────────────────────────────────────────────────────────────

function renderPreview() {

  var preview = $('printCabangPreview');
  if (!preview) return;

  var order = printState.order;
  var pages = printState.pages;
  var totalPages = pages.length;

  var cabang = CABANG[order.ID_CABANG] || { nama: '-', pic: '-' };
  var pic = String(cabang.pic || 'SUPERVISOR').toUpperCase();

  var nomorOrder = getSequentialNumberCabang(order);

  var hariID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  var date = parseAnyDate(order.TANGGAL_ORDER) || new Date();
  var hari = hariID[date.getDay()];
  var tgl = hari + ', '
    + String(date.getDate()).padStart(2, '0') + '/'
    + String(date.getMonth() + 1).padStart(2, '0') + '/'
    + date.getFullYear();

  var status = String(order.STATUS || 'PENDING').toUpperCase();

  var statusBg = '#f59e0b';
  if (status === 'APPROVED') statusBg = '#16a34a';
  if (status === 'REJECTED') statusBg = '#dc2626';

  var statusLabel = 'MENUNGGU';
  if (status === 'APPROVED') statusLabel = 'DISETUJUI';
  if (status === 'REJECTED') statusLabel = 'DITOLAK';

  var allPagesHtml = pages.map(function (pageItems, pageIndex) {
    return buildPageHtml({
      order: order,
      pageItems: pageItems,
      pageIndex: pageIndex,
      totalPages: totalPages,
      pic: pic,
      nomorOrder: nomorOrder,
      tgl: tgl,
      statusBg: statusBg,
      statusLabel: statusLabel,
    });
  }).join('');

  preview.innerHTML = allPagesHtml;

  var titleText = 'Preview Form Order — ' + order.ORDER_ID;
  if (totalPages > 1) {
    titleText += ' (' + totalPages + ' halaman)';
  }
  $('printCabangModalTitle').textContent = titleText;
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD 1 HALAMAN — Row Kompak
// ─────────────────────────────────────────────────────────────────────────

function buildPageHtml(params) {

  var pageItems = params.pageItems;
  var pageIndex = params.pageIndex;
  var totalPages = params.totalPages;
  var pic = params.pic;
  var nomorOrder = params.nomorOrder;
  var tgl = params.tgl;
  var statusBg = params.statusBg;
  var statusLabel = params.statusLabel;

  var pageNumber = pageIndex + 1;

  var pageInfoHtml = '';
  if (totalPages > 1) {
    pageInfoHtml = ''
      + '<span class="page-badge" style="margin-left: 8px;">'
      + 'HALAMAN ' + pageNumber + ' / ' + totalPages
      + '</span>';
  }

  // TABLE ROWS — Padding kecil, font tetap besar
  var rows = pageItems.map(function (item, idx) {

    var qty = toNumber(item.QTY);
    var sat = String(item.SATUAN || 'PCS').toUpperCase();

    var stokS = '0';
    if (item.STOK_SISTEM !== undefined && item.STOK_SISTEM !== '' && item.STOK_SISTEM !== null) {
      stokS = String(item.STOK_SISTEM);
    } else {
      stokS = getStokBarangCabang(item.KODE_BARANG);
    }

    var stokG = '0';
    if (item.STOK_GUDANG !== undefined && item.STOK_GUDANG !== '') {
      stokG = String(item.STOK_GUDANG);
    }

    var stokR = '0';
    if (item.STOK_TOKO !== undefined && item.STOK_TOKO !== '') {
      stokR = String(item.STOK_TOKO);
    }

    var jenis = String(item.KATEGORI || 'ELEKTRONIK').toUpperCase();

    return ''
      + '<tr>'
      // Stok Sistem — 15px BOLD, padding 5px 4px
      + '<td style="padding:5px 4px; text-align:center; border:1px solid #000; font-size:15px; font-weight:700; vertical-align:middle; line-height:1.2;">' + stokS + '</td>'
      // Stok Gudang
      + '<td style="padding:5px 4px; text-align:center; border:1px solid #000; font-size:15px; font-weight:700; vertical-align:middle; line-height:1.2;">' + stokG + '</td>'
      // Stok Rak
      + '<td style="padding:5px 4px; text-align:center; border:1px solid #000; font-size:15px; font-weight:700; vertical-align:middle; line-height:1.2;">' + stokR + '</td>'
      // Jumlah Order — 15px BOLD HIJAU
      + '<td style="padding:5px 4px; text-align:center; border:1px solid #000; font-size:15px; vertical-align:middle; color:#00B050; font-weight:800; line-height:1.2;">' + qty + ' ' + sat + '</td>'
      // Kode Item — 13px BOLD
      + '<td style="padding:5px 8px; text-align:center; border:1px solid #000; font-size:13px; font-weight:700; vertical-align:middle; line-height:1.2;">' + escapeHtml(item.KODE_BARANG || '') + '</td>'
      // Nama Item — 13px BOLD
      + '<td style="padding:5px 8px; text-align:center; border:1px solid #000; font-size:13px; font-weight:700; vertical-align:middle; line-height:1.3;">' + escapeHtml((item.NAMA_BARANG || '').toUpperCase()) + '</td>'
      // Jenis — 13px BOLD
      + '<td style="padding:5px 6px; text-align:center; border:1px solid #000; font-size:13px; vertical-align:middle; font-weight:800; line-height:1.2;">' + escapeHtml(jenis) + '</td>'
      + '</tr>';

  }).join('');

  var html = ''
    + '<div class="print-page" data-page="' + pageNumber + '">'

    // HEADER
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:0;">'
    + '<tr>'
    + '<td style="vertical-align:top; padding-bottom:10px; padding-top:2px;">'
    + '<div style="font-size:38px; font-weight:900; line-height:1; letter-spacing:-1px;">'
    + '<span style="color:#E67E22;">FORM</span>'
    + '<span style="color:#1B4F94;"> ORDER BARANG</span>'
    + '</div>'
    + '</td>'
    + '<td style="vertical-align:top; text-align:right; width:170px; padding-bottom:10px;">'
    + '<img src="./images/logo/logo-nk.png"'
    + ' alt="Logo Nasional Kitchen"'
    + ' style="width:140px; height:auto; display:block; margin-left:auto;"'
    + ' crossorigin="anonymous"'
    + ' onerror="this.style.display=\'none\';"'
    + '>'
    + '</td>'
    + '</tr>'
    + '</table>'

    + '<div style="border-top:1px solid #000; margin-bottom:8px;"></div>'

    // INFO — Font 14px, padding minim
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:10px; font-size:14px; color:#000;">'

    + '<tr>'
    + '<td style="padding:2px 0; width:150px; font-weight:700; vertical-align:top;">DIBUAT OLEH</td>'
    + '<td style="padding:2px 0; vertical-align:top; font-weight:600;">: ' + pic + '</td>'
    + '<td style="padding:2px 0; width:1px;"></td>'
    + '</tr>'

    + '<tr>'
    + '<td style="padding:2px 0; font-weight:700; vertical-align:top;">NOMOR ORDER</td>'
    + '<td style="padding:2px 0; vertical-align:top; font-weight:600;">'
    + ': ' + nomorOrder + pageInfoHtml
    + '</td>'
    + '<td style="padding:2px 0; text-align:right; vertical-align:top; white-space:nowrap; font-weight:600;">'
    + '<span style="font-weight:700;">Hari/Tgl</span> : ' + tgl
    + '</td>'
    + '</tr>'

    + '<tr>'
    + '<td style="padding:2px 0; font-weight:700; vertical-align:top;">STATUS ORDER</td>'
    + '<td style="padding:2px 0; vertical-align:top;" colspan="2">'
    + ': <span style="display:inline-block; padding:2px 10px; border-radius:4px; font-size:12px; font-weight:700; color:#fff; background:' + statusBg + ';">'
    + statusLabel
    + '</span>'
    + '</td>'
    + '</tr>'

    + '</table>'

    // TABLE DATA — HEADER 13px BOLD 800, padding 6px 4px
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border:1px solid #000; margin-bottom:20px;">'

    + '<thead>'
    + '<tr style="background:#B4D6F0;">'
    + '<th style="padding:6px 4px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:75px; line-height:1.2; vertical-align:middle;">STOCK<br>SISTEM</th>'
    + '<th style="padding:6px 4px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:75px; line-height:1.2; vertical-align:middle;">STOCK<br>(Gudang)</th>'
    + '<th style="padding:6px 4px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:70px; line-height:1.2; vertical-align:middle;">STOCK<br>(Rak)</th>'
    + '<th style="padding:6px 4px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:80px; line-height:1.2; vertical-align:middle;">JMLH<br>ORDER</th>'
    + '<th style="padding:6px 8px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:95px; line-height:1.2; vertical-align:middle;">KODE ITEM</th>'
    + '<th style="padding:6px 8px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; line-height:1.2; vertical-align:middle;">NAMA ITEM</th>'
    + '<th style="padding:6px 6px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:95px; line-height:1.2; vertical-align:middle;">JENIS</th>'
    + '</tr>'
    + '</thead>'

    + '<tbody>' + rows + '</tbody>'
    + '</table>'

    // SIGNATURE — Padding kompak
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #000; border-collapse:collapse;">'
    + '<tr>'
    + '<td style="padding:12px 20px 3px; width:33%; text-align:left; font-size:13px; vertical-align:top;">pengantar,</td>'
    + '<td style="padding:12px 10px 3px; width:34%; text-align:center; font-size:13px; vertical-align:top;">Persetujuan,</td>'
    + '<td style="padding:12px 20px 3px; width:33%; text-align:right; font-size:13px; vertical-align:top;">Penerima,</td>'
    + '</tr>'
    + '<tr><td colspan="3" style="padding:25px 0;">&nbsp;</td></tr>'
    + '<tr>'
    + '<td style="padding:0 20px 3px; text-align:left; font-size:13px; font-weight:600;">(_______________)</td>'
    + '<td style="padding:0 10px 3px; text-align:center; font-size:13px; font-weight:600;">(_______________)</td>'
    + '<td style="padding:0 20px 3px; text-align:right; font-size:13px; font-weight:600;">(_______________)</td>'
    + '</tr>'
    + '<tr>'
    + '<td style="padding:0 20px 12px 30px; text-align:left; font-size:14px; font-weight:900;">Driver</td>'
    + '<td style="padding:0 10px 12px; text-align:center; font-size:14px; font-weight:900;">SPV Gudang</td>'
    + '<td style="padding:0 30px 12px 20px; text-align:right; font-size:14px; font-weight:900;">SPV Cabang</td>'
    + '</tr>'
    + '</table>'

    + '</div>';

  return html;
}

// ─────────────────────────────────────────────────────────────────────────
// DOWNLOAD PDF
// ─────────────────────────────────────────────────────────────────────────

function doDownloadPdf() {
  window.print();
}

// ─────────────────────────────────────────────────────────────────────────
// DOWNLOAD JPG
// ─────────────────────────────────────────────────────────────────────────

async function doDownloadJpg() {

  var btn = $('btnDownloadJpg');
  if (!btn) return;

  var originalText = btn.innerHTML;
  var originalHTML = originalText;

  btn.classList.add('loading');

  try {

    var html2canvas;

    try {
      var module = await import('html2canvas');
      html2canvas = module.default || module;
    } catch (importErr) {
      html2canvas = await loadHtml2CanvasCDN();
    }

    if (!html2canvas) {
      alert('Gagal memuat library. Gunakan Download PDF saja.');
      return;
    }

    var pages = document.querySelectorAll('.print-page');

    if (!pages.length) {
      alert('Tidak ada halaman untuk di-download.');
      return;
    }

    var totalPages = pages.length;
    var orderId = printState.order?.ORDER_ID || 'unknown';

    for (var i = 0; i < totalPages; i++) {

      var page = pages[i];
      var pageNum = i + 1;

      btn.innerHTML = '<span class="spinner spinner-sm" style="color:#fff;"></span> '
        + 'Proses halaman ' + pageNum + '/' + totalPages + '...';

      await waitForImages(page);

      var canvas = await html2canvas(page, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: page.scrollWidth,
        height: page.scrollHeight,
      });

      var jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);

      var filename = 'Form-Order-' + orderId;
      if (totalPages > 1) {
        filename += '-Halaman-' + pageNum + '-dari-' + totalPages;
      }
      filename += '.jpg';

      var link = document.createElement('a');
      link.href = jpgDataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();

      setTimeout((function (l) {
        return function () {
          document.body.removeChild(l);
        };
      })(link), 100);

      if (i < totalPages - 1) {
        await sleep(600);
      }
    }

  } catch (err) {
    console.error('Download JPG error:', err);
    alert('Gagal download JPG. Error: ' + err.message);
  } finally {
    if (btn) {
      btn.classList.remove('loading');
      btn.innerHTML = originalHTML;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function waitForImages(container) {

  return new Promise(function (resolve) {

    var imgs = container.querySelectorAll('img');

    if (!imgs.length) {
      resolve();
      return;
    }

    var loaded = 0;
    var total = imgs.length;

    function check() {
      loaded++;
      if (loaded >= total) {
        resolve();
      }
    }

    imgs.forEach(function (img) {
      if (img.complete) {
        check();
      } else {
        img.addEventListener('load', check, { once: true });
        img.addEventListener('error', check, { once: true });
      }
    });

    setTimeout(resolve, 3000);
  });
}

function loadHtml2CanvasCDN() {

  return new Promise(function (resolve, reject) {

    if (window.html2canvas) {
      resolve(window.html2canvas);
      return;
    }

    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

    script.onload = function () {
      resolve(window.html2canvas);
    };

    script.onerror = function () {
      reject(new Error('Gagal load html2canvas dari CDN'));
    };

    document.head.appendChild(script);
  });
}

function getStokBarangCabang(kode) {
  try {
    var orderState = window.__gudangHubOrder?.state;
    if (!orderState || !orderState.productByCode) return '0';
    var product = orderState.productByCode[String(kode).trim().toUpperCase()];
    return product ? String(parseInt(product.STOK) || 0) : '0';
  } catch (e) {
    return '0';
  }
}

function getSequentialNumberCabang(order) {
  try {
    var cachedOrders = window.__cabangOrdersCache || [];
    if (!cachedOrders.length) return '01';

    var orderDate = parseAnyDate(order.TANGGAL_ORDER);
    if (!orderDate || orderDate.getTime() === 0) return '01';

    var targetMonth = orderDate.getMonth();
    var targetYear = orderDate.getFullYear();

    var sameMonth = cachedOrders
      .filter(function (o) {
        var d = parseAnyDate(o.TANGGAL_ORDER);
        return d && d.getTime() !== 0
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

    var nomor = idx >= 0 ? idx + 1 : sameMonth.length + 1;
    return nomor < 10 ? '0' + nomor : String(nomor);
  } catch (e) {
    return '01';
  }
}
