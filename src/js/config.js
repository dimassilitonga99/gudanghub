/* ═══════════════════════════════════════════════════════════════════════
   CONFIG — GudangHub v3.0
   ═══════════════════════════════════════════════════════════════════════ */

// ─── API ENDPOINT ───
export const API_URL = 'https://script.google.com/macros/s/AKfycbwv0cOk6GaRvPTi_TOiuJ1RNDkPtIoTv5Ch-Ix40ofswtZIAwm1EuTxU5okAPUWcn3p/exec';

// ─── APP METADATA ───
export const APP = {
  name: 'GudangHub',
  version: '3.0.0',
  company: 'PT Central Perabot Utama',
  location: 'NTT',
  timezone: 'WITA',
  timezoneOffset: 8,
  email: 'silitongadimas@gmail.com',
};

// ─── SESSION ───
export const SESSION = {
  key: 'gudanghub_session',
  lastUserKey: 'gudanghub_lastuser',
  themeKey: 'gudanghub_theme',
  durationHours: 8,
};

// ─── DATA CABANG ───
export const CABANG = {
  CB001: {
    id: 'CB001',
    nama: 'Toko Nasional Eltari',
    pic: 'Arfa',
    icon: 'store',
    color: '#ff6b00',
    telepon: '081234567001',
    alamat: 'Jl. Eltari, Kupang',
  },
  CB002: {
    id: 'CB002',
    nama: 'Toko Perabot Mama Oesapa',
    pic: 'Akmal',
    icon: 'store',
    color: '#22c55e',
    telepon: '081234567002',
    alamat: 'Jl. Oesapa, Kupang',
  },
  CB003: {
    id: 'CB003',
    nama: 'Toko Perabot Mama TDM',
    pic: 'Shally',
    icon: 'store',
    color: '#3b82f6',
    telepon: '081234567003',
    alamat: 'Jl. TDM, Kupang',
  },
  CB004: {
    id: 'CB004',
    nama: 'Toko Perabot Mama Kefamenanu',
    pic: 'Fajar',
    icon: 'store',
    color: '#f59e0b',
    telepon: '081234567004',
    alamat: 'Jl. Utama, Kefamenanu',
  },
};

export const CABANG_LIST = Object.values(CABANG);
export const CABANG_IDS = Object.keys(CABANG);

// ─── KATEGORI BARANG (Emoji fallback + SVG icon name) ───

// Emoji fallback (untuk backward compatibility)
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

// SVG icon name mapping (untuk Lucide)
export const KATEGORI_ICON_NAMES = {
  Kursi: 'armchair',
  Meja: 'utensils',
  Lemari: 'boxes',
  Sofa: 'sofa',
  Kasur: 'bed',
  Rak: 'boxes',
  Bufet: 'boxes',
  Dapur: 'chef-hat',
  Elektronik: 'monitor',
  Dekorasi: 'palette',
  'Peralatan Dapur': 'cooking',
  'Peralatan Makan': 'utensils',
  'Peralatan Mandi': 'sparkles',
  Loker: 'boxes',
  'Rak Buku': 'boxes',
  default: 'package',
};

/**
 * Get emoji untuk kategori (backward compatibility)
 */
export function getKategoriIcon(kategori) {
  return KATEGORI_ICONS[kategori] || KATEGORI_ICONS.default;
}

/**
 * Get SVG icon name untuk kategori
 */
export function getKategoriIconName(kategori) {
  return KATEGORI_ICON_NAMES[kategori] || KATEGORI_ICON_NAMES.default;
}

// ─── STATUS ORDER ───
export const STATUS = {
  PENDING: {
    label: 'Tertunda',
    icon: '⏳',
    iconName: 'clock',
    color: 'warning',
    badge: 'badge-warning',
  },
  APPROVED: {
    label: 'Disetujui',
    icon: '✅',
    iconName: 'check-circle',
    color: 'success',
    badge: 'badge-success',
  },
  REJECTED: {
    label: 'Ditolak',
    icon: '❌',
    iconName: 'x-circle',
    color: 'danger',
    badge: 'badge-danger',
  },
};

export function getStatusInfo(status) {
  const key = String(status || 'PENDING').toUpperCase();
  return STATUS[key] || STATUS.PENDING;
}

// ─── ITEM STATUS ───
export const ITEM_STATUS = {
  APPROVED: { label: 'Disetujui', icon: '✅', iconName: 'check-circle', color: 'success' },
  REJECTED: { label: 'Ditolak', icon: '🚫', iconName: 'ban', color: 'warning' },
  DELETED: { label: 'Dihapus', icon: '🗑️', iconName: 'trash', color: 'danger' },
  EDITED: { label: 'Diedit', icon: '✏️', iconName: 'edit-2', color: 'info' },
};

// ─── ROUTES ───
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

export function getHomeRoute(role) {
  return role === 'admin' ? ROUTES.dashboard : ROUTES.order;
}

export function getOrderUrl(idCabang = '') {
  return `${ROUTES.order}?cabang=${encodeURIComponent(idCabang)}`;
}

// ─── SETTINGS ───
export const SETTINGS = {
  itemsPerPage: 40,
  maxOrderItems: 100,
  apiTimeout: 30000,
  autoRefreshMs: 60000,
  throttleMs: 3000,
  toastDuration: 3000,
  toastDurationError: 5000,
  debounceMs: 200,
  notifPollingMs: 30000,
  cacheEnabled: true,
  cacheDuration: 60000,
};

// ─── FEATURE FLAGS ───
export const FEATURES = {
  darkMode: true,
  pwa: true,
  offline: true,
  notifications: true,
  printLaporan: true,
  exportPdf: false,
  exportExcel: false,
};

// ─── EXPORT DEFAULT ───
export default {
  API_URL,
  APP,
  SESSION,
  CABANG,
  CABANG_LIST,
  CABANG_IDS,
  KATEGORI_ICONS,
  KATEGORI_ICON_NAMES,
  STATUS,
  ITEM_STATUS,
  ROUTES,
  SETTINGS,
  FEATURES,
  getKategoriIcon,
  getKategoriIconName,
  getStatusInfo,
  getHomeRoute,
  getOrderUrl,
};