/* ═══════════════════════════════════════════════════════════════════════
   PRINT FORM CABANG — Download sebagai PDF atau JPG
   Stok sistem dari SNAPSHOT order (bukan live)
   Logo dari file: ./public/images/logo/logo-nk.png
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatWita, parseAnyDate, toNumber } from '../../utils.js';
import { CABANG } from '../../config.js';
import { icon } from '../../icons.js';

var printState = {
  order: null,
  items: [],
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
    + ' Download JPG'
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
    + '#printCabangPreview { background: #fff; color: #000; padding: 30px 35px; max-width: 850px; margin: 0 auto; box-shadow: 0 10px 40px rgba(0,0,0,0.3); font-family: Arial, sans-serif; font-size: 12px; min-height: 600px; }'

    + '@media print {'
    + '  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }'
    + '  body > *:not(#printCabangModalContainer) { display: none !important; }'
    + '  #printCabangModalContainer, .print-cabang-overlay, .print-cabang-modal { position: static !important; max-width: 100% !important; max-height: none !important; background: #fff !important; box-shadow: none !important; opacity: 1 !important; pointer-events: auto !important; transform: none !important; }'
    + '  .print-cabang-modal-header, .print-cabang-modal-actions { display: none !important; }'
    + '  .print-cabang-modal-body { background: #fff !important; padding: 0 !important; overflow: visible !important; }'
    + '  #printCabangPreview { box-shadow: none !important; padding: 15px 20px !important; }'
    + '  @page { size: A4; margin: 12mm; }'
    + '}'

    + '@media (max-width: 768px) {'
    + '  .print-cabang-modal { max-width: calc(100vw - 24px) !important; }'
    + '  #printCabangPreview { padding: 20px 15px; font-size: 11px; }'
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

  var preview = $('printCabangPreview');
  if (!preview) return;

  var order = printState.order;
  var items = printState.items;
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

  // Table rows - Stok sistem dari SNAPSHOT
  var rows = items.map(function (item) {

    var qty = toNumber(item.QTY);
    var sat = String(item.SATUAN || 'PCS').toUpperCase();

    // Ambil stok sistem dari SNAPSHOT (bukan live)
    var stokS = '0';
    if (item.STOK_SISTEM !== undefined && item.STOK_SISTEM !== '' && item.STOK_SISTEM !== null) {
      stokS = String(item.STOK_SISTEM);
    } else {
      // Fallback ke master untuk order lama
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
      + '<td style="padding:8px 6px; text-align:center; border:1px solid #000; font-size:12px; vertical-align:middle;">' + stokS + '</td>'
      + '<td style="padding:8px 6px; text-align:center; border:1px solid #000; font-size:12px; vertical-align:middle;">' + stokG + '</td>'
      + '<td style="padding:8px 6px; text-align:center; border:1px solid #000; font-size:12px; vertical-align:middle;">' + stokR + '</td>'
      + '<td style="padding:8px 6px; text-align:center; border:1px solid #000; font-size:12px; vertical-align:middle; color:#00B050; font-weight:600;">' + qty + ' ' + sat + '</td>'
      + '<td style="padding:8px 10px; text-align:center; border:1px solid #000; font-size:12px; vertical-align:middle;">' + escapeHtml(item.KODE_BARANG || '') + '</td>'
      + '<td style="padding:8px 10px; text-align:center; border:1px solid #000; font-size:12px; vertical-align:middle;">' + escapeHtml((item.NAMA_BARANG || '').toUpperCase()) + '</td>'
      + '<td style="padding:8px 8px; text-align:center; border:1px solid #000; font-size:12px; vertical-align:middle; font-weight:700;">' + escapeHtml(jenis) + '</td>'
      + '</tr>';

  }).join('');

  preview.innerHTML = ''

    // ══════ HEADER ══════
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:0;">'
    + '<tr>'

    + '<td style="vertical-align:top; padding-bottom:14px; padding-top:4px;">'
    + '<div style="font-size:42px; font-weight:900; line-height:1; letter-spacing:-1px;">'
    + '<span style="color:#E67E22;">FORM</span>'
    + '<span style="color:#1B4F94;"> ORDER BARANG</span>'
    + '</div>'
    + '</td>'

    + '<td style="vertical-align:top; text-align:right; width:180px; padding-bottom:14px;">'
    + '<img src="./public/images/logo/logo-nk.png"'
    + ' alt="Logo Nasional Kitchen"'
    + ' style="width:160px; height:auto; display:block; margin-left:auto;"'
    + ' crossorigin="anonymous"'
    + ' onerror="this.style.display=\'none\';"'
    + '>'
    + '</td>'

    + '</tr>'
    + '</table>'

    + '<div style="border-top:1px solid #000; margin-bottom:12px;"></div>'

    // ══════ INFO ══════
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:14px; font-size:13px; color:#000;">'

    + '<tr>'
    + '<td style="padding:3px 0; width:140px; font-weight:700; vertical-align:top;">DIBUAT OLEH</td>'
    + '<td style="padding:3px 0; vertical-align:top;">: ' + pic + '</td>'
    + '<td style="padding:3px 0; width:1px;"></td>'
    + '</tr>'

    + '<tr>'
    + '<td style="padding:3px 0; font-weight:700; vertical-align:top;">NOMOR ORDER</td>'
    + '<td style="padding:3px 0; vertical-align:top;">: ' + nomorOrder + '</td>'
    + '<td style="padding:3px 0; text-align:right; vertical-align:top; white-space:nowrap;">'
    + '<span style="font-weight:700;">Hari/Tgl</span> : ' + tgl
    + '</td>'
    + '</tr>'

    + '<tr>'
    + '<td style="padding:3px 0; font-weight:700; vertical-align:top;">STATUS ORDER</td>'
    + '<td style="padding:3px 0; vertical-align:top;" colspan="2">'
    + ': <span style="display:inline-block; padding:2px 10px; border-radius:4px; font-size:11px; font-weight:700; color:#fff; background:' + statusBg + ';">'
    + statusLabel
    + '</span>'
    + '</td>'
    + '</tr>'

    + '</table>'

    // ══════ TABLE DATA ══════
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border:1px solid #000; margin-bottom:30px;">'

    + '<thead>'
    + '<tr style="background:#B4D6F0;">'
    + '<th style="padding:8px 6px; border:1px solid #000; font-size:12px; font-weight:700; text-align:center; width:80px; line-height:1.2; vertical-align:middle;">STOCK<br>SISTEM</th>'
    + '<th style="padding:8px 6px; border:1px solid #000; font-size:12px; font-weight:700; text-align:center; width:80px; line-height:1.2; vertical-align:middle;">STOCK<br>(Gudang)</th>'
    + '<th style="padding:8px 6px; border:1px solid #000; font-size:12px; font-weight:700; text-align:center; width:75px; line-height:1.2; vertical-align:middle;">STOCK<br>(Rak)</th>'
    + '<th style="padding:8px 6px; border:1px solid #000; font-size:12px; font-weight:700; text-align:center; width:85px; line-height:1.2; vertical-align:middle;">JMLH<br>ORDER</th>'
    + '<th style="padding:8px 10px; border:1px solid #000; font-size:12px; font-weight:700; text-align:center; width:100px; vertical-align:middle;">KODE ITEM</th>'
    + '<th style="padding:8px 10px; border:1px solid #000; font-size:12px; font-weight:700; text-align:center; vertical-align:middle;">NAMA ITEM</th>'
    + '<th style="padding:8px 8px; border:1px solid #000; font-size:12px; font-weight:700; text-align:center; width:100px; vertical-align:middle;">Jenis</th>'
    + '</tr>'
    + '</thead>'

    + '<tbody>' + rows + '</tbody>'
    + '</table>'

    // ══════ SIGNATURE ══════
    + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #000; border-collapse:collapse;">'
    + '<tr>'
    + '<td style="padding:18px 25px 5px; width:33%; text-align:left; font-size:13px; vertical-align:top;">pengantar,</td>'
    + '<td style="padding:18px 10px 5px; width:34%; text-align:center; font-size:13px; vertical-align:top;">Persetujuan,</td>'
    + '<td style="padding:18px 25px 5px; width:33%; text-align:right; font-size:13px; vertical-align:top;">Penerima,</td>'
    + '</tr>'
    + '<tr><td colspan="3" style="padding:32px 0;">&nbsp;</td></tr>'
    + '<tr>'
    + '<td style="padding:0 25px 5px; text-align:left; font-size:13px;">(_______________)</td>'
    + '<td style="padding:0 10px 5px; text-align:center; font-size:13px;">(_______________)</td>'
    + '<td style="padding:0 25px 5px; text-align:right; font-size:13px;">(_______________)</td>'
    + '</tr>'
    + '<tr>'
    + '<td style="padding:0 25px 18px 35px; text-align:left; font-size:14px; font-weight:900;">Driver</td>'
    + '<td style="padding:0 10px 18px; text-align:center; font-size:14px; font-weight:900;">SPV Gudang</td>'
    + '<td style="padding:0 35px 18px 25px; text-align:right; font-size:14px; font-weight:900;">SPV Cabang</td>'
    + '</tr>'
    + '</table>';

  $('printCabangModalTitle').textContent = 'Preview Form Order — ' + order.ORDER_ID;
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

  var preview = $('printCabangPreview');
  var btn = $('btnDownloadJpg');

  if (!preview) return;

  var originalText = btn?.innerHTML;

  if (btn) {
    btn.classList.add('loading');
    btn.innerHTML = '<span class="spinner spinner-sm" style="color:#fff;"></span> Memproses...';
  }

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

    await waitForImages(preview);

    var canvas = await html2canvas(preview, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: preview.scrollWidth,
      height: preview.scrollHeight,
    });

    var jpgDataUrl = canvas.toDataURL('image/jpeg', 0.92);

    var link = document.createElement('a');
    link.href = jpgDataUrl;
    link.download = 'Form-Order-' + (printState.order?.ORDER_ID || 'unknown') + '.jpg';
    document.body.appendChild(link);
    link.click();

    setTimeout(function () {
      document.body.removeChild(link);
    }, 100);

  } catch (err) {
    console.error('Download JPG error:', err);
    alert('Gagal download JPG. Error: ' + err.message);
  } finally {
    if (btn) {
      btn.classList.remove('loading');
      btn.innerHTML = originalText || (icon('download', { size: 16 }) + ' Download JPG');
    }
  }
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

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

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
