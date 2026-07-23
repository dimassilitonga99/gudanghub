/* ═══════════════════════════════════════════════════════════════════════
   DASHBOARD ADMIN — Main Controller with Lucide Icons
   ═══════════════════════════════════════════════════════════════════════ */

import { $, getCurrentWitaTime, getInitials } from '../utils.js';
import { loadAll } from '../api.js';
import { requireAdmin, logout } from '../session.js';
import { toast, confirm } from '../ui.js';
import { SETTINGS } from '../config.js';
import { icon, injectIcons } from '../icons.js';

import { renderDashboardPage, updateDashboardData } from './dashboard-pages/dashboard-page.js';
import { renderOrdersPage, updateOrdersData } from './dashboard-pages/orders-page.js';
import { renderKatalogPage, updateKatalogData } from './dashboard-pages/katalog-page.js';
import { renderCabangPage, updateCabangData } from './dashboard-pages/cabang-page.js';
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

const PAGE_TITLES = {
  dashboard: { text: 'Dashboard', iconName: 'dashboard' },
  orders: { text: 'Semua Pesanan', iconName: 'package' },
  katalog: { text: 'Katalog Barang', iconName: 'boxes' },
  cabang: { text: 'Status Cabang', iconName: 'store' },
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
// SIDEBAR
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
  const el = $('topbarTimeText');
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

  document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });

  // Update topbar title dengan icon
  const titleEl = $('topbarTitle');
  const titleInfo = PAGE_TITLES[pageId];
  if (titleEl && titleInfo) {
    titleEl.innerHTML = `
      ${icon(titleInfo.iconName, { size: 20, color: 'var(--orange)' })}
      ${titleInfo.text}
    `;
  }

  const contentWrap = $('contentWrap');
  if (contentWrap) {
    contentWrap.innerHTML = `<div class="page-wrap">${renderer(state)}</div>`;
  }

  closeSidebar();

  requestAnimationFrame(() => {
    // Inject icons setelah render page baru
    injectIcons();

    const updater = PAGE_UPDATERS[pageId];
    if (updater) updater(state);
  });

  window.location.hash = pageId;
}

// ─────────────────────────────────────────────────────────────────────────
// LOAD DATA
// ─────────────────────────────────────────────────────────────────────────

export async function loadData(force = false) {
  if (state.isLoading) return;

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

    updatePendingBadge();

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
    if (state.clockInterval) clearInterval(state.clockInterval);
    if (state.autoRefreshInterval) clearInterval(state.autoRefreshInterval);

    logout(true);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {
  document.querySelectorAll('.nav-item[data-page]').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      showPage(item.dataset.page);
    });
  });

  $('topbarMenu')?.addEventListener('click', toggleSidebar);
  $('sidebarOverlay')?.addEventListener('click', closeSidebar);

  $('btnRefresh')?.addEventListener('click', () => loadData(true));

  $('btnNotif')?.addEventListener('click', () => {
    window.location.href = './notifikasi.html';
  });

  $('btnLogout')?.addEventListener('click', handleLogout);

  const gsLink = $('navGoogleSheets');
  if (gsLink) {
    gsLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.open('https://docs.google.com/spreadsheets', '_blank');
    });
  }

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && PAGE_RENDERERS[hash] && hash !== state.currentPage) {
      showPage(hash);
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
      e.preventDefault();
      loadData(true);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      $('orderSearch')?.focus() || $('katalogSearch')?.focus();
    }
    if (e.key === 'Escape') {
      closeSidebar();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (state.autoRefreshInterval) {
        clearInterval(state.autoRefreshInterval);
        state.autoRefreshInterval = null;
      }
    } else {
      startAutoRefresh();
      loadData(false);
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
  state.session = requireAdmin();
  if (!state.session) return;

  // Inject icons dulu untuk sidebar & topbar
  injectIcons();

  initUserInfo();
  startClock();
  bindEvents();

  initEditModal(state);

  const initialPage = window.location.hash.replace('#', '') || 'dashboard';
  const validPage = PAGE_RENDERERS[initialPage] ? initialPage : 'dashboard';

  showPage(validPage);

  await loadData(true);

  startAutoRefresh();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.__gudangHub = { state, loadData, showPage };