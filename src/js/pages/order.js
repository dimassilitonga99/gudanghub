/* ═══════════════════════════════════════════════════════════════════════
   ORDER PAGE — Main Controller with Lucide Icons
   v3.3 — STRICT AUTH: Wajib login, tidak bisa bypass via URL
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
import { icon, injectIcons } from '../icons.js';

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
  cart: {},
  massItems: [],
  isSubmitting: false,
  currentTab: 'catalog',
};

// ─────────────────────────────────────────────────────────────────────────
// SESSION INIT — STRICT AUTH ONLY (tidak boleh bypass URL)
// ─────────────────────────────────────────────────────────────────────────

function initSession() {
  const s = getSession();

  // ══════ WAJIB LOGIN ══════
  if (!s || !isSessionValid(s)) {
    // TIDAK ADA session valid → redirect ke login
    redirectToLogin();
    return false;
  }

  // ══════ ADMIN redirect ke dashboard ══════
  if (s.role === 'admin') {
    window.location.href = './dashboard.html';
    return false;
  }

  // ══════ HANYA CABANG yang lolos ══════
  if (s.role !== 'cabang') {
    // Role tidak valid → logout
    sessionLogout(true);
    return false;
  }

  // ══════ CABANG ID WAJIB ada di session ══════
  const sessionCabang = String(s.idCabang || '').trim().toUpperCase();

  if (!sessionCabang) {
    // Cabang tanpa idCabang → logout
    sessionLogout(true);
    return false;
  }

  // ══════ VALIDASI URL: harus SAMA dengan session ══════
  const urlBranch = String(getQueryParam('cabang') || '').trim().toUpperCase();

  if (urlBranch && urlBranch !== sessionCabang) {
    // User coba akses cabang lain via URL → block!
    console.warn('[SECURITY] URL cabang mismatch:', urlBranch, 'vs session:', sessionCabang);
    sessionLogout(true);
    return false;
  }

  // ══════ Set state (SELALU dari session, bukan URL) ══════
  state.session = s;
  state.branchId = sessionCabang;
  state.branchName = s.nama || (CABANG[sessionCabang]?.nama) || sessionCabang;
  state.branchPic = (CABANG[sessionCabang]?.pic) || s.nama || '-';

  // Update URL agar konsisten dengan session
  const expectedUrl = `?cabang=${sessionCabang}`;
  if (window.location.search !== expectedUrl) {
    window.history.replaceState({}, '', `./order.html${expectedUrl}${window.location.hash}`);
  }

  // Update label
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

    const { updateCatalog } = await import('./order-pages/catalog-page.js');
    updateCatalog(state);

  } catch (error) {
    toast.error('Gagal memuat katalog: ' + error.message);

    const grid = document.querySelector('#catalogPage .catalog-grid');
    if (grid) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icon('alert-triangle', { size: 48, color: 'var(--danger)' })}</div>
          <p>Gagal memuat katalog.</p>
          <button class="secondary-button" id="retryCatalogBtn" type="button" style="margin-top: 16px;">
            ${icon('refresh', { size: 14 })}
            Coba Lagi
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
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {
  if (!initSession()) return;

  injectIcons();

  $('catalogPage').innerHTML = renderCatalogPage(state);
  $('massOrderPage').innerHTML = renderMassOrderPage(state);
  $('historyPage').innerHTML = renderHistoryPage(state);

  initCatalog(state);
  initMassOrder(state);
  initHistory(state);
  initCart(state);

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
