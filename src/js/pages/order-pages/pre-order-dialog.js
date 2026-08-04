/* ═══════════════════════════════════════════════════════════════════════
   PRE-ORDER DIALOG — Nomor Order Custom + Tanggal + Preview
   Muncul SEBELUM kirim order ke gudang
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, parseAnyDate, toNumber } from '../../utils.js';
import { CABANG } from '../../config.js';
import { icon } from '../../icons.js';

var ITEMS_PER_PAGE = 20;

var dialogState = {
  items: [],       // items yang akan di-order
  branchId: '',
  catatan: '',
  pages: [],
  nomorMode: 'auto',    // 'auto' atau 'manual'
  nomorManual: '',
  tanggalMode: 'today', // 'today' atau 'tomorrow'
  onConfirm: null,      // callback saat user klik "Kirim ke Gudang"
};

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

export function initPreOrderDialog() {

  if ($('preOrderDialogContainer')) return;

  var container = document.createElement('div');
  container.id = 'preOrderDialogContainer';
  document.body.appendChild(container);

  container.innerHTML = ''
    + '<div class="overlay pre-order-overlay" id="preOrderOverlay" role="dialog" aria-modal="true">'
    + '<div class="modal modal-xl pre-order-modal">'

    // Header
    + '<header class="modal-header pre-order-header">'
    + '<div class="modal-title" id="preOrderTitle">'
    + icon('file', { size: 20, color: 'var(--orange)' })
    + ' Preview Form Order'
    + '</div>'
    + '<div class="pre-order-actions">'

    + '<button class="btn-preorder-jpg" id="btnPreOrderJpg" type="button">'
    + icon('download', { size: 16 })
    + ' <span id="btnPreOrderJpgText">Download JPG</span>'
    + '</button>'

    + '<button class="btn-preorder-send" id="btnPreOrderSend" type="button">'
    + icon('send', { size: 16 })
    + ' Kirim ke Gudang'
    + '</button>'

    + '<button class="modal-close" id="preOrderClose" type="button" aria-label="Tutup">'
    + icon('close', { size: 16 })
    + '</button>'

    + '</div>'
    + '</header>'

    // Body
    + '<div class="modal-body pre-order-body">'

    // ══ SETTINGS PANEL (Nomor + Tanggal) ══
    + '<div class="preorder-settings">'

    + '<div class="preorder-setting-group">'
    + '<label class="preorder-label">'
    + icon('hash', { size: 14 })
    + ' Nomor Order Form'
    + '</label>'
    + '<div class="preorder-radio-group">'
    + '<label class="preorder-radio active" id="radioAutoLabel">'
    + '<input type="radio" name="nomorMode" value="auto" id="radioAuto" checked>'
    + '<span>Otomatis</span>'
    + '</label>'
    + '<label class="preorder-radio" id="radioManualLabel">'
    + '<input type="radio" name="nomorMode" value="manual" id="radioManual">'
    + '<span>Manual</span>'
    + '</label>'
    + '</div>'
    + '<input type="text" class="preorder-input" id="nomorManualInput" placeholder="Ketik nomor (contoh: 25)" style="display:none;">'
    + '<div class="preorder-hint" id="nomorHint">Nomor akan di-generate otomatis dari sistem</div>'
    + '</div>'

    + '<div class="preorder-setting-group">'
    + '<label class="preorder-label">'
    + icon('calendar', { size: 14 })
    + ' Tanggal Form'
    + '</label>'
    + '<div class="preorder-radio-group">'
    + '<label class="preorder-radio active" id="radioTodayLabel">'
    + '<input type="radio" name="tanggalMode" value="today" id="radioToday" checked>'
    + '<span>Hari Ini</span>'
    + '</label>'
    + '<label class="preorder-radio" id="radioTomorrowLabel">'
    + '<input type="radio" name="tanggalMode" value="tomorrow" id="radioTomorrow">'
    + '<span>Besok</span>'
    + '</label>'
    + '<label class="preorder-radio" id="radioCustomLabel">'
    + '<input type="radio" name="tanggalMode" value="custom" id="radioCustom">'
    + '<span>Pilih Tanggal</span>'
    + '</label>'
    + '</div>'
    + '<input type="date" class="preorder-input" id="tanggalCustomInput" style="display:none;">'
    + '<div class="preorder-hint" id="tanggalHint">Form akan menggunakan tanggal hari ini</div>'
    + '</div>'

    + '</div>'

    // ══ PREVIEW AREA ══
    + '<div class="preorder-preview" id="preOrderPreview"></div>'

    + '</div>'

    + '</div>'
    + '</div>';

  addPreOrderStyles();

  // Event listeners
  $('preOrderClose')?.addEventListener('click', closePreOrderDialog);
  $('btnPreOrderJpg')?.addEventListener('click', downloadJpg);
  $('btnPreOrderSend')?.addEventListener('click', confirmSend);

  $('preOrderOverlay')?.addEventListener('click', function (e) {
    if (e.target.id === 'preOrderOverlay') {
      closePreOrderDialog();
    }
  });

  // Radio nomor
  $('radioAuto')?.addEventListener('change', function () {
    dialogState.nomorMode = 'auto';
    $('nomorManualInput').style.display = 'none';
    $('nomorHint').textContent = 'Nomor akan di-generate otomatis dari sistem';
    $('radioAutoLabel').classList.add('active');
    $('radioManualLabel').classList.remove('active');
    updatePreview();
  });

  $('radioManual')?.addEventListener('change', function () {
    dialogState.nomorMode = 'manual';
    $('nomorManualInput').style.display = 'block';
    $('nomorHint').textContent = 'Ketik nomor sesuai keinginan (contoh: 25, 100A, dll)';
    $('radioAutoLabel').classList.remove('active');
    $('radioManualLabel').classList.add('active');
    setTimeout(function () { $('nomorManualInput')?.focus(); }, 100);
    updatePreview();
  });

  $('nomorManualInput')?.addEventListener('input', function (e) {
    dialogState.nomorManual = e.target.value.trim();
    updatePreview();
  });

  // Radio tanggal
  $('radioToday')?.addEventListener('change', function () {
    dialogState.tanggalMode = 'today';
    $('tanggalCustomInput').style.display = 'none';
    $('tanggalHint').textContent = 'Form akan menggunakan tanggal hari ini';
    $('radioTodayLabel').classList.add('active');
    $('radioTomorrowLabel').classList.remove('active');
    $('radioCustomLabel').classList.remove('active');
    updatePreview();
  });

  $('radioTomorrow')?.addEventListener('change', function () {
    dialogState.tanggalMode = 'tomorrow';
    $('tanggalCustomInput').style.display = 'none';
    $('tanggalHint').textContent = 'Form akan menggunakan tanggal besok';
    $('radioTodayLabel').classList.remove('active');
    $('radioTomorrowLabel').classList.add('active');
    $('radioCustomLabel').classList.remove('active');
    updatePreview();
  });

  $('radioCustom')?.addEventListener('change', function () {
    dialogState.tanggalMode = 'custom';
    $('tanggalCustomInput').style.display = 'block';
    $('tanggalHint').textContent = 'Pilih tanggal sesuai keinginan';
    $('radioTodayLabel').classList.remove('active');
    $('radioTomorrowLabel').classList.remove('active');
    $('radioCustomLabel').classList.add('active');

    // Default: today
    if (!$('tanggalCustomInput').value) {
      var today = new Date();
      $('tanggalCustomInput').value = today.toISOString().split('T')[0];
    }
    updatePreview();
  });

  $('tanggalCustomInput')?.addEventListener('change', updatePreview);

  document.addEventListener('keydown', function (e) {
    if (!$('preOrderOverlay')?.classList.contains('show')) return;
    if (e.key === 'Escape') closePreOrderDialog();
  });
}

// ─────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────

function addPreOrderStyles() {

  if (document.getElementById('preOrderStyles')) return;

  var style = document.createElement('style');
  style.id = 'preOrderStyles';
  style.textContent = ''
    + '.pre-order-overlay { background: rgba(0,0,0,0.85) !important; }'
    + '.pre-order-modal { max-width: 950px !important; background: #f0f0f0 !important; padding: 0 !important; max-height: calc(100dvh - 40px) !important; }'
    + '.pre-order-header { background: var(--ink-2) !important; color: var(--text) !important; padding: 12px 20px !important; display: flex; align-items: center; justify-content: space-between; gap: 8px; }'
    + '.pre-order-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }'

    + '.btn-preorder-jpg { background: linear-gradient(135deg, #16a34a, #15803d); color: #fff; border: 0; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; transition: transform 0.15s; }'
    + '.btn-preorder-jpg:hover { transform: translateY(-1px); }'
    + '.btn-preorder-jpg.loading { opacity: 0.7; pointer-events: none; }'

    + '.btn-preorder-send { background: linear-gradient(135deg, var(--orange), var(--orange-light)); color: #fff; border: 0; padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: inherit; transition: transform 0.15s; box-shadow: 0 4px 12px rgba(255,107,0,0.3); }'
    + '.btn-preorder-send:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(255,107,0,0.5); }'
    + '.btn-preorder-send:disabled { opacity: 0.6; cursor: not-allowed; }'

    + '.pre-order-body { background: #e0e0e0 !important; padding: 0 !important; overflow-y: auto; }'

    // Settings panel
    + '.preorder-settings { background: var(--ink-2); padding: 20px; border-bottom: 2px solid var(--orange); display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }'
    + '.preorder-setting-group { display: flex; flex-direction: column; gap: 8px; }'
    + '.preorder-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--orange); text-transform: uppercase; letter-spacing: 0.05em; }'
    + '.preorder-radio-group { display: flex; gap: 6px; flex-wrap: wrap; }'
    + '.preorder-radio { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--ink-3); border: 1px solid var(--line-soft); border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; color: var(--muted); transition: all 0.15s; }'
    + '.preorder-radio:hover { border-color: var(--orange); color: var(--text); }'
    + '.preorder-radio.active { background: var(--orange-dim); border-color: var(--orange); color: var(--orange); }'
    + '.preorder-radio input { display: none; }'
    + '.preorder-input { background: var(--ink-3); border: 1px solid var(--line-soft); border-radius: 8px; padding: 10px 14px; color: var(--text); font-family: inherit; font-size: 14px; outline: none; min-height: 42px; transition: border-color 0.15s; }'
    + '.preorder-input:focus { border-color: var(--orange); }'
    + '.preorder-hint { font-size: 11px; color: var(--muted); font-style: italic; }'

    // Preview area
    + '.preorder-preview { padding: 20px; }'
    + '.preorder-page { background: #fff; color: #000; padding: 28px 32px; max-width: 850px; margin: 0 auto 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); font-family: Arial, sans-serif; font-size: 14px; min-height: 500px; page-break-after: always; }'
    + '.preorder-page:last-child { page-break-after: auto; margin-bottom: 0; }'
    + '.preorder-page-badge { display: inline-block; padding: 3px 10px; background: #ff6b00; color: #fff; border-radius: 4px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }'

    + '@media (max-width: 768px) {'
    + '  .pre-order-modal { max-width: calc(100vw - 24px) !important; }'
    + '  .preorder-settings { grid-template-columns: 1fr; padding: 14px; }'
    + '  .preorder-preview { padding: 12px; }'
    + '  .preorder-page { padding: 18px 12px; font-size: 12px; }'
    + '}';

  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────
// SHOW DIALOG
// ─────────────────────────────────────────────────────────────────────────

export function showPreOrderDialog(config) {

  if (!config || !config.items || !config.items.length) {
    return;
  }

  dialogState.items = config.items;
  dialogState.branchId = config.branchId || '';
  dialogState.catatan = config.catatan || '';
  dialogState.onConfirm = config.onConfirm || null;

  // Reset settings
  dialogState.nomorMode = 'auto';
  dialogState.nomorManual = '';
  dialogState.tanggalMode = 'today';

  // Reset radio buttons
  var radioAuto = $('radioAuto');
  var radioToday = $('radioToday');
  if (radioAuto) radioAuto.checked = true;
  if (radioToday) radioToday.checked = true;

  $('radioAutoLabel')?.classList.add('active');
  $('radioManualLabel')?.classList.remove('active');
  $('radioTodayLabel')?.classList.add('active');
  $('radioTomorrowLabel')?.classList.remove('active');
  $('radioCustomLabel')?.classList.remove('active');

  $('nomorManualInput').style.display = 'none';
  $('nomorManualInput').value = '';
  $('tanggalCustomInput').style.display = 'none';
  $('tanggalCustomInput').value = '';

  $('nomorHint').textContent = 'Nomor akan di-generate otomatis dari sistem';
  $('tanggalHint').textContent = 'Form akan menggunakan tanggal hari ini';

  // Split items ke pages
  dialogState.pages = chunkArray(dialogState.items, ITEMS_PER_PAGE);

  // Update JPG button text
  var jpgText = $('btnPreOrderJpgText');
  if (jpgText) {
    if (dialogState.pages.length > 1) {
      jpgText.textContent = 'Download ' + dialogState.pages.length + ' JPG';
    } else {
      jpgText.textContent = 'Download JPG';
    }
  }

  updatePreview();

  $('preOrderOverlay')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closePreOrderDialog() {
  $('preOrderOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
  dialogState.items = [];
  dialogState.onConfirm = null;
}

function chunkArray(arr, size) {
  var chunks = [];
  for (var i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks.length === 0 ? [[]] : chunks;
}

// ─────────────────────────────────────────────────────────────────────────
// GET NOMOR ORDER (dari input atau auto)
// ─────────────────────────────────────────────────────────────────────────

function getNomorOrder() {

  if (dialogState.nomorMode === 'manual') {
    return dialogState.nomorManual || '01';
  }

  // Auto: dari cache atau default
  try {
    var cachedOrders = window.__cabangOrdersCache || [];

    // Filter bulan ini
    var now = new Date();
    var targetMonth = now.getMonth();
    var targetYear = now.getFullYear();

    var sameMonth = cachedOrders.filter(function (o) {
      var d = parseAnyDate(o.TANGGAL_ORDER);
      return d && d.getTime() !== 0
        && d.getMonth() === targetMonth
        && d.getFullYear() === targetYear;
    });

    var nomor = sameMonth.length + 1;
    return nomor < 10 ? '0' + nomor : String(nomor);
  } catch (e) {
    return '01';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// GET TANGGAL ORDER
// ─────────────────────────────────────────────────────────────────────────

function getTanggalOrder() {

  var date = new Date();

  if (dialogState.tanggalMode === 'tomorrow') {
    date.setDate(date.getDate() + 1);
  } else if (dialogState.tanggalMode === 'custom') {
    var customVal = $('tanggalCustomInput')?.value;
    if (customVal) {
      var parts = customVal.split('-');
      date = new Date(
        parseInt(parts[0]),
        parseInt(parts[1]) - 1,
        parseInt(parts[2])
      );
    }
  }

  return date;
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE PREVIEW
// ─────────────────────────────────────────────────────────────────────────

function updatePreview() {

  var preview = $('preOrderPreview');
  if (!preview) return;

  var branchId = dialogState.branchId;
  var cabang = CABANG[branchId] || { nama: '-', pic: '-' };
  var pic = String(cabang.pic || 'SUPERVISOR').toUpperCase();

  var nomorOrder = getNomorOrder();
  var date = getTanggalOrder();

  var hariID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  var hari = hariID[date.getDay()];
  var tgl = hari + ', '
    + String(date.getDate()).padStart(2, '0') + '/'
    + String(date.getMonth() + 1).padStart(2, '0') + '/'
    + date.getFullYear();

  var totalPages = dialogState.pages.length;

  var allPagesHtml = dialogState.pages.map(function (pageItems, pageIndex) {
    return buildPageHtml({
      pageItems: pageItems,
      pageIndex: pageIndex,
      totalPages: totalPages,
      pic: pic,
      nomorOrder: nomorOrder,
      tgl: tgl,
    });
  }).join('');

  preview.innerHTML = allPagesHtml;
}

// ─────────────────────────────────────────────────────────────────────────
// BUILD 1 HALAMAN
// ─────────────────────────────────────────────────────────────────────────

function buildPageHtml(params) {

  var pageItems = params.pageItems;
  var pageIndex = params.pageIndex;
  var totalPages = params.totalPages;
  var pic = params.pic;
  var nomorOrder = params.nomorOrder;
  var tgl = params.tgl;

  var pageNumber = pageIndex + 1;

  var pageInfoHtml = '';
  if (totalPages > 1) {
    pageInfoHtml = ''
      + '<span class="preorder-page-badge" style="margin-left: 8px;">'
      + 'HALAMAN ' + pageNumber + ' / ' + totalPages
      + '</span>';
  }

  var rows = pageItems.map(function (item) {

    var qty = toNumber(item.qty);
    var sat = String(item.satuan || 'PCS').toUpperCase();

    var stokS = '0';
    if (item.stokSistem !== undefined && item.stokSistem !== '') {
      stokS = String(item.stokSistem);
    }

    var stokG = '0';
    if (item.stokGudang !== undefined && item.stokGudang !== '') {
      stokG = String(item.stokGudang);
    }

    var stokR = '0';
    if (item.stokToko !== undefined && item.stokToko !== '') {
      stokR = String(item.stokToko);
    }

    var kode = escapeHtml(item.kode || '-');
    var nama = escapeHtml((item.nama || '').toUpperCase());
    var jenis = escapeHtml(String(item.kategori || 'ELEKTRONIK').toUpperCase());

    // Badge untuk barang manual
    var manualBadge = '';
    if (item.isManual) {
      manualBadge = ' <span style="display:inline-block; padding:2px 6px; background:#f59e0b; color:#fff; border-radius:3px; font-size:9px; font-weight:700;">MANUAL</span>';
    }

    return ''
      + '<tr>'
      + '<td style="padding:5px 4px; text-align:center; border:1px solid #000; font-size:15px; font-weight:700; vertical-align:middle; line-height:1.2;">' + stokS + '</td>'
      + '<td style="padding:5px 4px; text-align:center; border:1px solid #000; font-size:15px; font-weight:700; vertical-align:middle; line-height:1.2;">' + stokG + '</td>'
      + '<td style="padding:5px 4px; text-align:center; border:1px solid #000; font-size:15px; font-weight:700; vertical-align:middle; line-height:1.2;">' + stokR + '</td>'
      + '<td style="padding:5px 4px; text-align:center; border:1px solid #000; font-size:15px; vertical-align:middle; color:#00B050; font-weight:800; line-height:1.2;">' + qty + ' ' + sat + '</td>'
      + '<td style="padding:5px 8px; text-align:center; border:1px solid #000; font-size:13px; font-weight:700; vertical-align:middle; line-height:1.2;">' + kode + manualBadge + '</td>'
      + '<td style="padding:5px 8px; text-align:center; border:1px solid #000; font-size:13px; font-weight:700; vertical-align:middle; line-height:1.3;">' + nama + '</td>'
      + '<td style="padding:5px 6px; text-align:center; border:1px solid #000; font-size:13px; vertical-align:middle; font-weight:800; line-height:1.2;">' + jenis + '</td>'
      + '</tr>';

  }).join('');

  return ''
    + '<div class="preorder-page" data-page="' + pageNumber + '">'

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

    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:10px; font-size:14px; color:#000;">'
    + '<tr>'
    + '<td style="padding:2px 0; width:150px; font-weight:700; vertical-align:top;">DIBUAT OLEH</td>'
    + '<td style="padding:2px 0; vertical-align:top; font-weight:600;">: ' + pic + '</td>'
    + '<td style="padding:2px 0; width:1px;"></td>'
    + '</tr>'
    + '<tr>'
    + '<td style="padding:2px 0; font-weight:700; vertical-align:top;">NOMOR ORDER</td>'
    + '<td style="padding:2px 0; vertical-align:top; font-weight:600;">'
    + ': ' + escapeHtml(nomorOrder) + pageInfoHtml
    + '</td>'
    + '<td style="padding:2px 0; text-align:right; vertical-align:top; white-space:nowrap; font-weight:600;">'
    + '<span style="font-weight:700;">Hari/Tgl</span> : ' + tgl
    + '</td>'
    + '</tr>'
    + '</table>'

    + '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border:1px solid #000; margin-bottom:20px;">'
    + '<thead>'
    + '<tr style="background:#B4D6F0;">'
    + '<th style="padding:6px 4px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:75px; line-height:1.2;">STOCK<br>SISTEM</th>'
    + '<th style="padding:6px 4px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:75px; line-height:1.2;">STOCK<br>(Gudang)</th>'
    + '<th style="padding:6px 4px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:70px; line-height:1.2;">STOCK<br>(Rak)</th>'
    + '<th style="padding:6px 4px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:80px; line-height:1.2;">JMLH<br>ORDER</th>'
    + '<th style="padding:6px 8px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:110px;">KODE ITEM</th>'
    + '<th style="padding:6px 8px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center;">NAMA ITEM</th>'
    + '<th style="padding:6px 6px; border:1px solid #000; font-size:13px; font-weight:800; text-align:center; width:95px;">JENIS</th>'
    + '</tr>'
    + '</thead>'
    + '<tbody>' + rows + '</tbody>'
    + '</table>'

    + '<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #000; border-collapse:collapse;">'
    + '<tr>'
    + '<td style="text-align:left; font-family:Arial; vertical-align:top; padding:12px 20px 3px; width:33%; font-size:13px;">pengantar,</td>'
    + '<td style="text-align:center; font-family:Arial; vertical-align:top; padding:12px 10px 3px; width:34%; font-size:13px;">Persetujuan,</td>'
    + '<td style="text-align:right; font-family:Arial; vertical-align:top; padding:12px 20px 3px; width:33%; font-size:13px;">Penerima,</td>'
    + '</tr>'
    + '<tr><td colspan="3" style="padding:25px 0;">&nbsp;</td></tr>'
    + '<tr>'
    + '<td style="text-align:left; font-family:Arial; padding:0 20px 3px; font-size:13px; font-weight:600;">(_______________)</td>'
    + '<td style="text-align:center; font-family:Arial; padding:0 10px 3px; font-size:13px; font-weight:600;">(_______________)</td>'
    + '<td style="text-align:right; font-family:Arial; padding:0 20px 3px; font-size:13px; font-weight:600;">(_______________)</td>'
    + '</tr>'
    + '<tr>'
    + '<td style="text-align:left; font-family:Arial; padding:0 20px 12px 30px; font-size:14px; font-weight:900;">Driver</td>'
    + '<td style="text-align:center; font-family:Arial; padding:0 10px 12px; font-size:14px; font-weight:900;">SPV Gudang</td>'
    + '<td style="text-align:right; font-family:Arial; padding:0 30px 12px 20px; font-size:14px; font-weight:900;">SPV Cabang</td>'
    + '</tr>'
    + '</table>'

    + '</div>';
}

// ─────────────────────────────────────────────────────────────────────────
// DOWNLOAD JPG
// ─────────────────────────────────────────────────────────────────────────

async function downloadJpg() {

  var btn = $('btnPreOrderJpg');
  if (!btn) return;

  var originalHTML = btn.innerHTML;
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
      alert('Gagal memuat library html2canvas.');
      return;
    }

    var pages = document.querySelectorAll('.preorder-page');
    if (!pages.length) return;

    var totalPages = pages.length;
    var nomor = getNomorOrder();
    var branchId = dialogState.branchId || 'CB';

    for (var i = 0; i < totalPages; i++) {

      var page = pages[i];
      var pageNum = i + 1;

      btn.innerHTML = '<span class="spinner spinner-sm" style="color:#fff;"></span> '
        + 'Proses ' + pageNum + '/' + totalPages + '...';

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

      var filename = 'Form-Order-' + branchId + '-No' + nomor;
      if (totalPages > 1) {
        filename += '-Hal-' + pageNum;
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
    alert('Gagal download JPG: ' + err.message);
  } finally {
    if (btn) {
      btn.classList.remove('loading');
      btn.innerHTML = originalHTML;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CONFIRM SEND (kirim ke gudang)
// ─────────────────────────────────────────────────────────────────────────

async function confirmSend() {

  // Validasi nomor manual
  if (dialogState.nomorMode === 'manual' && !dialogState.nomorManual) {
    alert('Nomor order manual wajib diisi.');
    $('nomorManualInput')?.focus();
    return;
  }

  // Get final values
  var finalNomor = getNomorOrder();
  var finalTanggal = getTanggalOrder();

  // Callback ke pemanggil (cart.js atau mass-order-page.js)
  if (typeof dialogState.onConfirm === 'function') {

    var btn = $('btnPreOrderSend');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner spinner-sm" style="color:#fff;"></span> Mengirim...';
    }

    try {
      await dialogState.onConfirm({
        nomorOrder: finalNomor,
        tanggalOrder: finalTanggal,
        nomorMode: dialogState.nomorMode,
        tanggalMode: dialogState.tanggalMode,
      });

      // Sukses → close dialog
      closePreOrderDialog();

    } catch (err) {
      console.error('Send error:', err);
      alert('Gagal mengirim: ' + err.message);

      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg> Kirim ke Gudang';
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function waitForImages(container) {
  return new Promise(function (resolve) {
    var imgs = container.querySelectorAll('img');
    if (!imgs.length) { resolve(); return; }

    var loaded = 0;
    var total = imgs.length;

    function check() {
      loaded++;
      if (loaded >= total) resolve();
    }

    imgs.forEach(function (img) {
      if (img.complete) check();
      else {
        img.addEventListener('load', check, { once: true });
        img.addEventListener('error', check, { once: true });
      }
    });

    setTimeout(resolve, 3000);
  });
}

function loadHtml2CanvasCDN() {
  return new Promise(function (resolve, reject) {
    if (window.html2canvas) { resolve(window.html2canvas); return; }
    var script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = function () { resolve(window.html2canvas); };
    script.onerror = function () { reject(new Error('Gagal load html2canvas')); };
    document.head.appendChild(script);
  });
}
