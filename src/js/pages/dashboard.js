/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD ADMIN — Main Controller
   ═══════════════════════════════════════════════════════════════════════ */

import { $, getCurrentWitaTime, getInitials, debounce } from '../utils.js';
import { orders as ordersApi, katalog as katalogApi, loadAll } from '../api.js';
import { requireAdmin, logout } from '../session.js';
import { toast, confirm } from '../ui.js';
import { SETTINGS } from '../config.js';

// Import page renderers (akan dibuat di BATCH 6b)
import { renderDashboardPage, updateDashboardData } from './dashboard-pages/dashboard-page.js';
import { renderOrdersPage, updateOrdersData } from './dashboard-pages/orders-page.js';
import { renderKatalogPage, updateKatalogData } from './dashboard-pages/katalog-page.js';
import { renderCabangPage, updateCabangData } from './dashboard-pages/cabang-page.js';

// Import modal edit order (akan dibuat di BATCH 6c)
import { initEditModal } from './dashboard-pages/edit-modal.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

export const state = {
  session: null,
  allOrders: [],
  allKatalog: [],
  currentPage: 'dashboard',
  isLoading: false,
  lastLoadTime: 0,
  clockInterval: null,
  autoRefreshInterval: null,
};

// Page metadata
const PAGE_TITLES = {
  dashboard: '📊 Dashboard',
  orders: '📦 Semua Pesanan',
  katalog: '📚 Katalog Barang',
  cabang: '🏬 Status Cabang',
};

const PAGE_RENDERERS = {
  dashboard: renderDashboardPage,
  orders: renderOrdersPage,
  katalog: renderKatalogPage,
  cabang: renderCabangPage,
};

const PAGE_UPDATERS = {
  dashboard: updateDashboardData,
  orders: updateOrdersData,
  katalog: updateKatalogData,
  cabang: updateCabangData,
};

// ─────────────────────────────────────────────────────────────────────────
// USER INFO
// ─────────────────────────────────────────────────────────────────────────

function initUserInfo() {
  const nameEl = $('sidebarUserName');
  const avatarEl = $('sidebarUserAvatar');
  const roleEl = $('sidebarUserRole');

  if (nameEl) nameEl.textContent = state.session.nama || state.session.username || 'Admin';
  if (avatarEl) avatarEl.textContent = getInitials(state.session.nama || state.session.username || 'A');
  if (roleEl) roleEl.textContent = state.session.role === 'admin' ? 'Admin Gudang Pusat' : 'Cabang';
}

// ─────────────────────────────────────────────────────────────────────────
// SIDEBAR (mobile)
// ─────────────────────────────────────────────────────────────────────────

function toggleSidebar() {
  const sidebar = $('sidebar');
  const overlay = $('sidebarOverlay');
  const isOpen = sidebar.classList.toggle('open');
  overlay.classList.toggle('show', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeSidebar() {
  $('sidebar')?.classList.remove('open');
  $('sidebarOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
}

// ─────────────────────────────────────────────────────────────────────────
// CLOCK
// ─────────────────────────────────────────────────────────────────────────

function updateClock() {
  const el = $('topbarTime');
  if (el) {
    el.textContent = getCurrentWitaTime() + ' WITA';
  }
}

function startClock() {
  updateClock();
  state.clockInterval = setInterval(updateClock, 1000);
}

// ─────────────────────────────────────────────────────────────────────────
// PAGE ROUTING
// ─────────────────────────────────────────────────────────────────────────

export function showPage(pageId) {
  const renderer = PAGE_RENDERERS[pageId];
  if (!renderer) return;

  state.currentPage = pageId;

  // Update nav active state
  document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });

  // Update title
  const titleEl = $('topbarTitle');
  if (titleEl) titleEl.textContent = PAGE_TITLES[pageId] || pageId;

  // Render page
  const contentWrap = $('contentWrap');
  if (contentWrap) {
    contentWrap.innerHTML = `<div class="page-wrap">${renderer(state)}</div>`;
  }

  // Close sidebar (mobile)
  closeSidebar();

  // Update data (jika sudah ada data)
  requestAnimationFrame(() => {
    const updater = PAGE_UPDATERS[pageId];
    if (updater) updater(state);
  });

  // Update URL hash
  window.location.hash = pageId;
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD DATA
// ─────────────────────────────────────────────────────────────────────────

export async function loadData(force = false) {
  if (state.isLoading) return;

  // Throttle (jangan reload terlalu sering)
  if (!force && Date.now() - state.lastLoadTime < SETTINGS.throttleMs) {
    return;
  }

  state.isLoading = true;
  $('btnRefresh')?.classList.add('spinning');

  try {
    const { orders, katalog, errors } = await loadAll({ cache: !force });

    if (errors.length > 0) {
      console.warn('Load errors:', errors);
    }

    state.allOrders = orders || [];
    state.allKatalog = katalog || [];
    state.lastLoadTime = Date.now();

    // Update badges
    updatePendingBadge();

    // Re-render current page
    const updater = PAGE_UPDATERS[state.currentPage];
    if (updater) updater(state);

    if (force) {
      toast.success('Data berhasil dimuat ulang.');
    }
  } catch (error) {
    toast.error('Gagal memuat data: ' + error.message);
  } finally {
    state.isLoading = false;
    $('btnRefresh')?.classList.remove('spinning');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PENDING BADGE
// ─────────────────────────────────────────────────────────────────────────

export function updatePendingBadge() {
  const count = state.allOrders.filter(
    (order) => String(order.STATUS || '').toUpperCase() === 'PENDING'
  ).length;

  const badge = $('pendingBadge');
  if (badge) {
    badge.textContent = count > 0 ? count : '';
    badge.style.display = count > 0 ? '' : 'none';
  }

  // Update notification dot
  const notifDot = $('notifDot');
  if (notifDot) {
    notifDot.style.display = count > 0 ? '' : 'none';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────

async function handleLogout() {
  const ok = await confirm({
    icon: '🚪',
    title: 'Keluar dari Dashboard?',
    message: 'Anda akan diarahkan ke halaman login.',
    okText: 'Ya, Keluar',
    okVariant: 'danger',
  });

  if (ok) {
    // Cleanup
    if (state.clockInterval) clearInterval(state.clockInterval);
    if (state.autoRefreshInterval) clearInterval(state.autoRefreshInterval);

    logout(true);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {

  // Sidebar nav
  document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      showPage(item.dataset.page);
    });
  });

  // Sidebar mobile toggle
  $('topbarMenu')?.addEventListener('click', toggleSidebar);
  $('sidebarOverlay')?.addEventListener('click', closeSidebar);

  // Refresh
  $('btnRefresh')?.addEventListener('click', () => loadData(true));

  // Notification bell → redirect
  $('btnNotif')?.addEventListener('click', () => {
    window.location.href = './notifikasi.html';
  });

  // Logout
  $('btnLogout')?.addEventListener('click', handleLogout);

  // Google Sheets link
  const gsLink = $('navGoogleSheets');
  if (gsLink) {
    gsLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.open('https://docs.google.com/spreadsheets', '_blank');
    });
  }

  // Handle URL hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && PAGE_RENDERERS[hash] && hash !== state.currentPage) {
      showPage(hash);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + R = refresh data
    if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
      e.preventDefault();
      loadData(true);
    }

    // Ctrl/Cmd + K = focus search (jika ada)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      $('orderSearch')?.focus() || $('katalogSearch')?.focus();
    }

    // ESC = close sidebar
    if (e.key === 'Escape') {
      closeSidebar();
    }
  });

  // Pause auto-refresh when tab hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.autoRefreshInterval) {
        clearInterval(state.autoRefreshInterval);
        state.autoRefreshInterval = null;
      }
    } else {
      startAutoRefresh();
      loadData(false); // Refresh saat kembali ke tab
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// AUTO REFRESH
// ─────────────────────────────────────────────────────────────────────────

function startAutoRefresh() {
  if (state.autoRefreshInterval) clearInterval(state.autoRefreshInterval);

  state.autoRefreshInterval = setInterval(() => {
    if (!document.hidden && !state.isLoading) {
      loadData(false);
    }
  }, SETTINGS.autoRefreshMs);
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

async function init() {
  // Guard: hanya admin
  state.session = requireAdmin();
  if (!state.session) return;

  // Initialize UI
  initUserInfo();
  startClock();
  bindEvents();

  // Init modal edit order (dari BATCH 6c)
  initEditModal(state);

  // Get initial page from URL hash
  const initialPage = window.location.hash.replace('#', '') || 'dashboard';
  const validPage = PAGE_RENDERERS[initialPage] ? initialPage : 'dashboard';

  showPage(validPage);

  // Load initial data
  await loadData(true);

  // Start auto-refresh
  startAutoRefresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Export untuk debugging
window.__gudangHub = { state, loadData, showPage };
