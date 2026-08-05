/* ═══════════════════════════════════════════════════════════════════════
   ORDER PAGE — v3.7 Persistent Cart + Server Sync
   ═══════════════════════════════════════════════════════════════════════ */

import { $, getQueryParam } from '../utils.js';
import { katalog as katalogApi, prewarmAppScript } from '../api.js';
import {
  getSession,
  isSessionValid,
  redirectToLogin,
  logout as sessionLogout,
} from '../session.js';
import { CABANG } from '../config.js';
import { toast, confirm } from '../ui.js';
import { icon, injectIcons } from '../icons.js';

import { renderCatalogPage, initCatalog } from './order-pages/catalog-page.js';
import { renderMassOrderPage, initMassOrder } from './order-pages/mass-order-page.js';
import { renderHistoryPage, initHistory } from './order-pages/history-page.js';
import { initCart, updateCartUi, loadCartLocal, loadCartServer } from './order-pages/cart.js';
import { initPreOrderDialog } from './order-pages/pre-order-dialog.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

export var state = {
  session: null,
  branchId: '',
  branchName: '',
  branchPic: '',
  allProducts: [],
  productByCode: {},
  cart: {},
  massItems: [],
  manualItems: [],
  isSubmitting: false,
  currentTab: 'catalog',
};

// ─────────────────────────────────────────────────────────────────────────
// SESSION INIT
// ─────────────────────────────────────────────────────────────────────────

function initSession() {
  var s = getSession();

  if (!s || !isSessionValid(s)) {
    redirectToLogin();
    return false;
  }

  if (s.role === 'admin') {
    window.location.href = './dashboard.html';
    return false;
  }

  if (s.role !== 'cabang') {
    sessionLogout(true);
    return false;
  }

  var sessionCabang = String(s.idCabang || '').trim().toUpperCase();

  if (!sessionCabang) {
    sessionLogout(true);
    return false;
  }

  var urlBranch = String(getQueryParam('cabang') || '').trim().toUpperCase();

  if (urlBranch && urlBranch !== sessionCabang) {
    console.warn('[SECURITY] URL cabang mismatch:', urlBranch, 'vs session:', sessionCabang);
    sessionLogout(true);
    return false;
  }

  state.session = s;
  state.branchId = sessionCabang;
  state.branchName = s.nama || (CABANG[sessionCabang] ? CABANG[sessionCabang].nama : sessionCabang);
  state.branchPic = (CABANG[sessionCabang] ? CABANG[sessionCabang].pic : '') || s.nama || '-';

  var expectedUrl = '?cabang=' + sessionCabang;
  if (window.location.search !== expectedUrl) {
    window.history.replaceState({}, '', './order.html' + expectedUrl + window.location.hash);
  }

  var label = $('branchLabel');
  if (label) {
    label.textContent = state.branchId + ' · ' + state.branchPic;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// TAB NAVIGATION
// ─────────────────────────────────────────────────────────────────────────

function showTab(tabName) {
  if (state.currentTab === tabName) return;

  state.currentTab = tabName;

  document.querySelectorAll('.nav-tab').forEach(function (tab) {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  document.querySelectorAll('.page').forEach(function (page) {
    page.classList.remove('active');
  });

  var pageMap = {
    catalog: 'catalogPage',
    massOrder: 'massOrderPage',
    history: 'historyPage',
  };

  var activePage = $(pageMap[tabName]);
  if (activePage) activePage.classList.add('active');

  requestAnimationFrame(function () { injectIcons(); });
  window.scrollTo(0, 0);

  if (tabName === 'history') {
    import('./order-pages/history-page.js').then(function (mod) {
      mod.loadHistory(state);
    });
  }

  window.location.hash = tabName;
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD CATALOG
// ─────────────────────────────────────────────────────────────────────────

export async function loadCatalog() {
  try {
    var result = await katalogApi.getAllFast(function (freshResult) {
      if (freshResult && freshResult.status === 'ok') {
        console.log('[Catalog] Fresh data received in background');
        state.allProducts = freshResult.data || [];
        rebuildProductMap();
        updateCatalogUI();
      }
    });

    if (result.status !== 'ok' && !result._fromCache) {
      throw new Error(result.message || 'Katalog gagal dimuat');
    }

    state.allProducts = result.data || [];
    rebuildProductMap();
    updateCatalogUI();

    if (result._fromCache) {
      console.log('[Catalog] Loaded from cache (age:', Math.round(result._cacheAge / 1000), 's)');
    }

  } catch (error) {
    console.error('[Catalog] Load error:', error);
    toast.error('Gagal memuat katalog: ' + error.message);

    var grid = document.querySelector('#catalogPage .catalog-grid');
    if (grid) {
      grid.innerHTML = ''
        + '<div class="empty-state">'
        + '<div class="empty-icon">' + icon('alert-triangle', { size: 48, color: 'var(--danger)' }) + '</div>'
        + '<p>Gagal memuat katalog.</p>'
        + '<p style="font-size: 12px; color: var(--muted); margin-top: 8px;">' + error.message + '</p>'
        + '<button class="secondary-button" id="retryCatalogBtn" type="button" style="margin-top: 16px;">'
        + icon('refresh', { size: 14 })
        + ' Coba Lagi'
        + '</button>'
        + '</div>';
      $('retryCatalogBtn')?.addEventListener('click', function () {
        loadCatalog();
      });
    }
  }
}

function rebuildProductMap() {
  state.productByCode = {};
  state.allProducts.forEach(function (product) {
    var code = String(product.KODE_BARANG || '').trim().toUpperCase();
    if (code) state.productByCode[code] = product;
  });
}

async function updateCatalogUI() {
  try {
    var mod = await import('./order-pages/catalog-page.js');
    mod.updateCatalog(state);
  } catch (e) {
    console.warn('[Catalog] Update UI failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────

async function handleLogout() {
  var ok = await confirm({
    icon: '🚪',
    title: 'Keluar dari GudangHub?',
    message: 'Anda akan diarahkan ke halaman login.\n\nKeranjang tetap tersimpan.',
    okText: 'Ya, Keluar',
    okVariant: 'danger',
  });

  if (ok) {
    sessionLogout(true);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {
  document.querySelectorAll('.nav-tab').forEach(function (tab) {
    tab.addEventListener('click', function () { showTab(tab.dataset.tab); });
  });

  $('logoutButton')?.addEventListener('click', handleLogout);

  window.addEventListener('hashchange', function () {
    var hash = window.location.hash.replace('#', '');
    if (['catalog', 'massOrder', 'history'].indexOf(hash) !== -1 && hash !== state.currentTab) {
      showTab(hash);
    }
  });

  var sheet = $('cartSheet');
  if (sheet) {
    sheet.addEventListener('touchmove', function (e) {
      if (e.target.closest('.cart-items')) return;
      e.preventDefault();
    }, { passive: false });
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      prewarmAppScript();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {

  prewarmAppScript();

  if (!initSession()) return;

  injectIcons();

  // ★ RESTORE CART: localStorage dulu (instant)
  var savedCart = loadCartLocal();
  if (savedCart && Object.keys(savedCart).length > 0) {
    state.cart = savedCart;
    console.log('[Cart] Restored', Object.keys(savedCart).length, 'items from local');
  }

  // Render pages
  $('catalogPage').innerHTML = renderCatalogPage(state);
  $('massOrderPage').innerHTML = renderMassOrderPage(state);
  $('historyPage').innerHTML = renderHistoryPage(state);

  initCatalog(state);
  initMassOrder(state);
  initHistory(state);
  initCart(state);
  initPreOrderDialog();

  bindEvents();

  var initialTab = window.location.hash.replace('#', '') || 'catalog';
  var validTab = ['catalog', 'massOrder', 'history'].indexOf(initialTab) !== -1
    ? initialTab
    : 'catalog';

  if (validTab !== 'catalog') {
    showTab(validTab);
  } else {
    requestAnimationFrame(function () { injectIcons(); });
  }

  // Load catalog
  await loadCatalog();

  // ★ BACKGROUND: Load cart dari server (sync antar device)
  loadCartServer().then(function (serverCart) {
    if (!serverCart || Object.keys(serverCart).length === 0) return;

    var localCount = Object.keys(state.cart).length;
    var serverCount = Object.keys(serverCart).length;

    var needUpdate = false;

    if (localCount === 0 && serverCount > 0) {
      // Local kosong, pakai server
      state.cart = serverCart;
      needUpdate = true;
      console.log('[Cart] Using server cart (' + serverCount + ' items)');
    } else if (serverCount > localCount) {
      // Server lebih banyak → merge (tambah yang belum ada)
      Object.keys(serverCart).forEach(function (key) {
        if (!state.cart[key]) {
          state.cart[key] = serverCart[key];
        }
      });
      needUpdate = true;
      console.log('[Cart] Merged server cart (total: ' + Object.keys(state.cart).length + ')');
    }

    if (needUpdate) {
      updateCartUi(state);

      import('./order-pages/catalog-page.js').then(function (catMod) {
        catMod.updateCatalog(state);
      }).catch(function () {});
    }
  }).catch(function () {});

  // Load history kalau tab aktif
  if (validTab === 'history') {
    import('./order-pages/history-page.js').then(function (mod) {
      mod.loadHistory(state);
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.__gudangHubOrder = { state: state, loadCatalog: loadCatalog, showTab: showTab };
