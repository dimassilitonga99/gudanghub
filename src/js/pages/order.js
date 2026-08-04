/* ═══════════════════════════════════════════════════════════════════════
   ORDER PAGE — v3.5 Fast Load with Cache
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
import { initCart } from './order-pages/cart.js';
import { initPreOrderDialog } from './order-pages/pre-order-dialog.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

export const state = {
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
  const s = getSession();

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

  const sessionCabang = String(s.idCabang || '').trim().toUpperCase();

  if (!sessionCabang) {
    sessionLogout(true);
    return false;
  }

  const urlBranch = String(getQueryParam('cabang') || '').trim().toUpperCase();

  if (urlBranch && urlBranch !== sessionCabang) {
    sessionLogout(true);
    return false;
  }

  state.session = s;
  state.branchId = sessionCabang;
  state.branchName = s.nama || (CABANG[sessionCabang]?.nama) || sessionCabang;
  state.branchPic = (CABANG[sessionCabang]?.pic) || s.nama || '-';

  const expectedUrl = `?cabang=${sessionCabang}`;
  if (window.location.search !== expectedUrl) {
    window.history.replaceState({}, '', `./order.html${expectedUrl}${window.location.hash}`);
  }

  const label = $('branchLabel');
  if (label) {
    label.textContent = `${state.branchId} · ${state.branchPic}`;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────
// TAB NAVIGATION
// ─────────────────────────────────────────────────────────────────────────

function showTab(tabName) {
  if (state.currentTab === tabName) return;

  state.currentTab = tabName;

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  document.querySelectorAll('.page').forEach((page) => {
    page.classList.remove('active');
  });

  const pageMap = {
    catalog: 'catalogPage',
    massOrder: 'massOrderPage',
    history: 'historyPage',
  };

  const activePage = $(pageMap[tabName]);
  if (activePage) activePage.classList.add('active');

  requestAnimationFrame(() => injectIcons());
  window.scrollTo(0, 0);

  if (tabName === 'history') {
    import('./order-pages/history-page.js').then(({ loadHistory }) => {
      loadHistory(state);
    });
  }

  window.location.hash = tabName;
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD CATALOG — FAST dengan Stale-While-Revalidate
// ─────────────────────────────────────────────────────────────────────────

export async function loadCatalog() {

  try {
    // ★ FAST LOAD: langsung dari cache (INSTANT) + refresh di background
    const result = await katalogApi.getAllFast(function (freshResult) {
      // Callback saat data fresh datang → update state + UI
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

    // Info kalau dari cache
    if (result._fromCache) {
      console.log('[Catalog] Loaded from cache (age:', Math.round(result._cacheAge / 1000), 's)');
    }

  } catch (error) {
    console.error('[Catalog] Load error:', error);
    toast.error('Gagal memuat katalog: ' + error.message);

    const grid = document.querySelector('#catalogPage .catalog-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icon('alert-triangle', { size: 48, color: 'var(--danger)' })}</div>
          <p>Gagal memuat katalog.</p>
          <p style="font-size: 12px; color: var(--muted); margin-top: 8px;">${error.message}</p>
          <button class="secondary-button" id="retryCatalogBtn" type="button" style="margin-top: 16px;">
            ${icon('refresh', { size: 14 })}
            Coba Lagi
          </button>
        </div>
      `;
      $('retryCatalogBtn')?.addEventListener('click', function () {
        loadCatalog();
      });
    }
  }
}

function rebuildProductMap() {
  state.productByCode = {};
  state.allProducts.forEach((product) => {
    const code = String(product.KODE_BARANG || '').trim().toUpperCase();
    if (code) state.productByCode[code] = product;
  });
}

async function updateCatalogUI() {
  try {
    const { updateCatalog } = await import('./order-pages/catalog-page.js');
    updateCatalog(state);
  } catch (e) {
    console.warn('[Catalog] Update UI failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────

async function handleLogout() {
  const ok = await confirm({
    icon: '🚪',
    title: 'Keluar dari GudangHub?',
    message: 'Anda akan diarahkan ke halaman login.\n\nJika ada item di keranjang, akan hilang.',
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
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  });

  $('logoutButton')?.addEventListener('click', handleLogout);

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (['catalog', 'massOrder', 'history'].includes(hash) && hash !== state.currentTab) {
      showTab(hash);
    }
  });

  const sheet = $('cartSheet');
  if (sheet) {
    sheet.addEventListener('touchmove', (e) => {
      if (e.target.closest('.cart-items')) return;
      e.preventDefault();
    }, { passive: false });
  }

  // Prewarm on visibility change (saat user kembali)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      prewarmAppScript();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {

  // ★ PREWARM AppScript DULU (fire & forget) — bangunkan cold start
  prewarmAppScript();

  if (!initSession()) return;

  injectIcons();

  $('catalogPage').innerHTML = renderCatalogPage(state);
  $('massOrderPage').innerHTML = renderMassOrderPage(state);
  $('historyPage').innerHTML = renderHistoryPage(state);

  initCatalog(state);
  initMassOrder(state);
  initHistory(state);
  initCart(state);
  initPreOrderDialog();

  bindEvents();

  const initialTab = window.location.hash.replace('#', '') || 'catalog';
  const validTab = ['catalog', 'massOrder', 'history'].includes(initialTab)
    ? initialTab
    : 'catalog';

  if (validTab !== 'catalog') {
    showTab(validTab);
  } else {
    requestAnimationFrame(() => injectIcons());
  }

  // Load catalog (fast dari cache dulu)
  await loadCatalog();

  if (validTab === 'history') {
    const { loadHistory } = await import('./order-pages/history-page.js');
    loadHistory(state);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.__gudangHubOrder = { state, loadCatalog, showTab };
