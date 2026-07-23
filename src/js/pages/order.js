/* ═══════════════════════════════════════════════════════════════════════
   ORDER PAGE — Main Controller (Cabang)
   ═══════════════════════════════════════════════════════════════════════ */

import { $, getQueryParam } from '../utils.js';
import { katalog as katalogApi } from '../api.js';
import {
  getSession,
  isSessionValid,
  redirectToLogin,
  logout as sessionLogout,
} from '../session.js';
import { CABANG } from '../config.js';
import { toast, confirm } from '../ui.js';

// Import page renderers (BATCH 7b)
import { renderCatalogPage, initCatalog } from './order-pages/catalog-page.js';
import { renderMassOrderPage, initMassOrder } from './order-pages/mass-order-page.js';
import { renderHistoryPage, initHistory } from './order-pages/history-page.js';
import { initCart } from './order-pages/cart.js';

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
  cart: {},           // { code: item }
  massItems: [],      // parsed mass order items
  isSubmitting: false,
  currentTab: 'catalog',
};

// ─────────────────────────────────────────────────────────────────────────
// SESSION INIT
// ─────────────────────────────────────────────────────────────────────────

function initSession() {
  const s = getSession();
  const urlBranch = getQueryParam('cabang');

  // Cek session
  if (s && isSessionValid(s)) {
    // Admin tidak boleh akses order.html
    if (s.role === 'admin') {
      window.location.href = './dashboard.html';
      return false;
    }

    // Cabang → ambil idCabang dari session
    state.session = s;
    state.branchId = String(s.idCabang || urlBranch || '').toUpperCase();
    state.branchName = s.nama || CABANG[state.branchId]?.nama || state.branchId;
    state.branchPic = CABANG[state.branchId]?.pic || s.nama || '-';
  } else if (urlBranch) {
    // Fallback: pakai URL param (tanpa session valid)
    state.branchId = String(urlBranch).toUpperCase();
    state.branchName = CABANG[state.branchId]?.nama || state.branchId;
    state.branchPic = CABANG[state.branchId]?.pic || '-';
  } else {
    // Tidak ada session, tidak ada URL → login
    redirectToLogin();
    return false;
  }

  if (!state.branchId) {
    redirectToLogin();
    return false;
  }

  // Update UI
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

  // Update tabs
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  // Update pages
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

  // Scroll to top
  window.scrollTo(0, 0);

  // Trigger data load untuk history (fresh setiap kali dibuka)
  if (tabName === 'history') {
    import('./order-pages/history-page.js').then(({ loadHistory }) => {
      loadHistory(state);
    });
  }

  // Update URL hash
  window.location.hash = tabName;
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD CATALOG
// ─────────────────────────────────────────────────────────────────────────

export async function loadCatalog() {
  try {
    const result = await katalogApi.getAll({ cache: true });

    if (result.status !== 'ok') {
      throw new Error(result.message || 'Katalog gagal dimuat');
    }

    state.allProducts = result.data || [];
    state.productByCode = {};

    state.allProducts.forEach((product) => {
      const code = String(product.KODE_BARANG || '').trim().toUpperCase();
      if (code) state.productByCode[code] = product;
    });

    // Update katalog page
    const { updateCatalog } = await import('./order-pages/catalog-page.js');
    updateCatalog(state);

  } catch (error) {
    toast.error('Gagal memuat katalog: ' + error.message);

    // Show error state di catalog page
    const grid = document.querySelector('#catalogPage .catalog-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <p>Gagal memuat katalog.</p>
          <button class="secondary-button" id="retryCatalogBtn" type="button" style="margin-top: 16px;">
            🔄 Coba Lagi
          </button>
        </div>
      `;
      $('retryCatalogBtn')?.addEventListener('click', loadCatalog);
    }
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
  // Tab navigation
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  });

  // Logout
  $('logoutButton')?.addEventListener('click', handleLogout);

  // Hash change (browser back/forward)
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (['catalog', 'massOrder', 'history'].includes(hash) && hash !== state.currentTab) {
      showTab(hash);
    }
  });

  // Prevent iOS bounce scroll di bottom sheet
  const sheet = $('cartSheet');
  if (sheet) {
    sheet.addEventListener('touchmove', (e) => {
      // Allow scroll inside cart items
      if (e.target.closest('.cart-items')) return;
      e.preventDefault();
    }, { passive: false });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {
  // Session check
  if (!initSession()) return;

  // Render initial pages (empty state)
  $('catalogPage').innerHTML = renderCatalogPage(state);
  $('massOrderPage').innerHTML = renderMassOrderPage(state);
  $('historyPage').innerHTML = renderHistoryPage(state);

  // Init page-specific handlers
  initCatalog(state);
  initMassOrder(state);
  initHistory(state);
  initCart(state);

  // Bind events
  bindEvents();

  // Get initial tab from URL
  const initialTab = window.location.hash.replace('#', '') || 'catalog';
  const validTab = ['catalog', 'massOrder', 'history'].includes(initialTab)
    ? initialTab
    : 'catalog';

  if (validTab !== 'catalog') {
    showTab(validTab);
  }

  // Load initial data
  await loadCatalog();

  // Kalau initial tab adalah history, load data-nya
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

// Debug helper
window.__gudangHubOrder = { state, loadCatalog, showTab };
