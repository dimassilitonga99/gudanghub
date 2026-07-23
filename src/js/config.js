/* ═══════════════════════════════════════════════════════════════════════
   CONFIG — GudangHub v3.0
   Konfigurasi terpusat untuk seluruh aplikasi
   ═══════════════════════════════════════════════════════════════════════ */

// ─────────────────────────────────────────────────────────────────────────
// API ENDPOINT
// ─────────────────────────────────────────────────────────────────────────

export const API_URL = 'https://script.google.com/macros/s/AKfycbwv0cOk6GaRvPTi_TOiuJ1RNDkPtIoTv5Ch-Ix40ofswtZIAwm1EuTxU5okAPUWcn3p/exec';

// ─────────────────────────────────────────────────────────────────────────
// APP METADATA
// ─────────────────────────────────────────────────────────────────────────

export const APP = {
  name: 'GudangHub',
  version: '3.0.0',
  company: 'PT Central Perabot Utama',
  location: 'NTT',
  timezone: 'WITA',
  timezoneOffset: 8, // GMT+8
  email: 'silitongadimas@gmail.com',
};

// ─────────────────────────────────────────────────────────────────────────
// SESSION
// ─────────────────────────────────────────────────────────────────────────

export const SESSION = {
  key: 'gudanghub_session',
  lastUserKey: 'gudanghub_lastuser',
  themeKey: 'gudanghub_theme',
  durationHours: 8,
};

// ─────────────────────────────────────────────────────────────────────────
// DATA CABANG
// ─────────────────────────────────────────────────────────────────────────

export const CABANG = {
  CB001: {
    id: 'CB001',
    nama: 'Toko Nasional Eltari',
    pic: 'Arfa',
    icon: '🏪',
    color: '#ff6b00',
    telepon: '081234567001',
    alamat: 'Jl. Eltari, Kupang',
  },
  CB002: {
    id: 'CB002',
    nama: 'Toko Perabot Mama Oesapa',
    pic: 'Akmal',
    icon: '🏪',
    color: '#22c55e',
    telepon: '081234567002',
    alamat: 'Jl. Oesapa, Kupang',
  },
  CB003: {
    id: 'CB003',
    nama: 'Toko Perabot Mama TDM',
    pic: 'Shally',
    icon: '🏪',
    color: '#3b82f6',
    telepon: '081234567003',
    alamat: 'Jl. TDM, Kupang',
  },
  CB004: {
    id: 'CB004',
    nama: 'Toko Perabot Mama Kefamenanu',
    pic: 'Fajar',
    icon: '🏪',
    color: '#f59e0b',
    telepon: '081234567004',
    alamat: 'Jl. Utama, Kefamenanu',
  },
};

export const CABANG_LIST = Object.values(CABANG);
export const CABANG_IDS = Object.keys(CABANG);

// ─────────────────────────────────────────────────────────────────────────
// KATEGORI BARANG
// ─────────────────────────────────────────────────────────────────────────

export const KATEGORI_ICONS = {
  Kursi: '🪑',
  Meja: '🍽️',
  Lemari: '🗄️',
  Sofa: '🛋️',
  Kasur: '🛏️',
  Rak: '📚',
  Bufet: '🪟',
  Dapur: '🍳',
  Elektronik: '📺',
  Dekorasi: '🎨',
  'Peralatan Dapur': '🍳',
  'Peralatan Makan': '🍴',
  'Peralatan Mandi': '🚿',
  Loker: '🗃️',
  'Rak Buku': '📚',
  default: '📦',
};

export function getKategoriIcon(kategori) {
  return KATEGORI_ICONS[kategori] || KATEGORI_ICONS.default;
}

// ─────────────────────────────────────────────────────────────────────────
// STATUS ORDER
// ─────────────────────────────────────────────────────────────────────────

export const STATUS = {
  PENDING: {
    label: 'Tertunda',
    icon: '⏳',
    color: 'warning',
    badge: 'badge-warning',
  },
  APPROVED: {
    label: 'Disetujui',
    icon: '✅',
    color: 'success',
    badge: 'badge-success',
  },
  REJECTED: {
    label: 'Ditolak',
    icon: '❌',
    color: 'danger',
    badge: 'badge-danger',
  },
};

export function getStatusInfo(status) {
  const key = String(status || 'PENDING').toUpperCase();
  return STATUS[key] || STATUS.PENDING;
}

// ─────────────────────────────────────────────────────────────────────────
// ITEM STATUS (per item dalam order)
// ─────────────────────────────────────────────────────────────────────────

export const ITEM_STATUS = {
  APPROVED: { label: 'Disetujui', icon: '✅', color: 'success' },
  REJECTED: { label: 'Ditolak', icon: '🚫', color: 'warning' },
  DELETED: { label: 'Dihapus', icon: '🗑️', color: 'danger' },
  EDITED: { label: 'Diedit', icon: '✏️', color: 'info' },
};

// ─────────────────────────────────────────────────────────────────────────
// ROUTES / URL MAPPING
// ─────────────────────────────────────────────────────────────────────────

export const ROUTES = {
  landing: 'index.html',
  login: 'login.html',
  dashboard: 'dashboard.html',
  order: 'order.html',
  gantiPassword: 'ganti-password.html',
  laporan: 'laporan.html',
  profil: 'profil.html',
  notifikasi: 'notifikasi.html',
  settings: 'settings.html',
};

/**
 * Ambil route berdasarkan role user
 */
export function getHomeRoute(role) {
  return role === 'admin' ? ROUTES.dashboard : ROUTES.order;
}

/**
 * Build URL order dengan cabang parameter
 */
export function getOrderUrl(idCabang = '') {
  return `${ROUTES.order}?cabang=${encodeURIComponent(idCabang)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// SETTINGS DEFAULT
// ─────────────────────────────────────────────────────────────────────────

export const SETTINGS = {
  // Katalog
  itemsPerPage: 40,
  maxOrderItems: 100,

  // API
  apiTimeout: 30000,       // 30 detik
  autoRefreshMs: 60000,    // 1 menit
  throttleMs: 3000,        // 3 detik antar refresh

  // UI
  toastDuration: 3000,
  toastDurationError: 5000,
  debounceMs: 200,

  // Notifikasi
  notifPollingMs: 30000,   // 30 detik

  // Cache
  cacheEnabled: true,
  cacheDuration: 60000,    // 1 menit
};

// ─────────────────────────────────────────────────────────────────────────
// FEATURE FLAGS
// ─────────────────────────────────────────────────────────────────────────

export const FEATURES = {
  darkMode: true,
  pwa: true,
  offline: true,
  notifications: true,
  printLaporan: true,
  exportPdf: false, // butuh library tambahan, next batch
  exportExcel: false,
};

// ─────────────────────────────────────────────────────────────────────────
// EXPORT DEFAULT
// ─────────────────────────────────────────────────────────────────────────

export default {
  API_URL,
  APP,
  SESSION,
  CABANG,
  CABANG_LIST,
  CABANG_IDS,
  KATEGORI_ICONS,
  STATUS,
  ITEM_STATUS,
  ROUTES,
  SETTINGS,
  FEATURES,
  getKategoriIcon,
  getStatusInfo,
  getHomeRoute,
  getOrderUrl,
};
