export const API_URL = 'https://gudanghub-api-proxy.silitongadimas.workers.dev';
export const APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbx-IG_C2KMFbAlXBlP5NVtfzO1FsZOCdFzoQiqTkUIl8Lh9ZhBDdsmuPY8hlqDfHhRerQ/exec';

export const APP = {
  name: 'GudangHub',
  version: '3.0.0',
  company: 'PT Central Perabot Utama',
  location: 'NTT',
  timezone: 'WITA',
  timezoneOffset: 8,
  email: 'silitongadimas@gmail.com',
};

export const SESSION = {
  key: 'gudanghub_session',
  lastUserKey: 'gudanghub_lastuser',
  themeKey: 'gudanghub_theme',
  durationHours: 8,
};

export interface CabangInfo {
  id: string;
  nama: string;
  pic: string;
  icon: string;
  color: string;
  telepon: string;
  alamat: string;
}

export const CABANG: Record<string, CabangInfo> = {
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

export const SATUAN_OPTIONS = ['PCS', 'DUS', 'KRG', 'SET', 'PACK', 'IKAT', 'GROSS'];

export const KATEGORI_MANUAL = [
  'PLASTIK',
  'ELEKTRONIK',
  'ALUMUNIUM',
  'STAINLESS',
  'KACA',
  'BATU',
  'KAYU',
  'BESI',
  'KAIN',
  'KERAMIK',
  'LAINNYA',
];

export const KATEGORI_MARQUEE: { name: string; iconName: string }[] = [
  { name: 'Kursi', iconName: 'armchair' },
  { name: 'Kasur', iconName: 'bed' },
  { name: 'Meja', iconName: 'utensils' },
  { name: 'Elektronik', iconName: 'monitor' },
  { name: 'Peralatan Dapur', iconName: 'cooking' },
  { name: 'Peralatan Makan', iconName: 'utensils' },
  { name: 'Peralatan Mandi', iconName: 'sparkles' },
  { name: 'Lemari', iconName: 'boxes' },
  { name: 'Loker', iconName: 'boxes' },
  { name: 'Sofa', iconName: 'sofa' },
  { name: 'Rak Buku', iconName: 'boxes' },
  { name: 'Dekorasi', iconName: 'palette' },
];

export const KATEGORI_ICONS: Record<string, string> = {
  Kursi: 'ðŸª‘',
  Meja: 'ðŸ½ï¸',
  Lemari: 'ðŸ—„ï¸',
  Sofa: 'ðŸ›‹ï¸',
  Kasur: 'ðŸ›ï¸',
  Rak: 'ðŸ“š',
  Bufet: 'ðŸªŸ',
  Dapur: 'ðŸ³',
  Elektronik: 'ðŸ“º',
  Dekorasi: 'ðŸŽ¨',
  'Peralatan Dapur': 'ðŸ³',
  'Peralatan Makan': 'ðŸ´',
  'Peralatan Mandi': 'ðŸš¿',
  Loker: 'ðŸ—ƒï¸',
  'Rak Buku': 'ðŸ“š',
  default: 'ðŸ“¦',
};

export const KATEGORI_ICON_NAMES: Record<string, string> = {
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

export function getKategoriIcon(kategori: string): string {
  return KATEGORI_ICONS[kategori] || KATEGORI_ICONS.default;
}

export function getKategoriIconName(kategori: string): string {
  return KATEGORI_ICON_NAMES[kategori] || KATEGORI_ICON_NAMES.default;
}

export type OrderStatus = 'PENDING' | 'PICKED' | 'APPROVED' | 'REJECTED';

export interface StatusInfo {
  label: string;
  icon: string;
  iconName: string;
  color: 'warning' | 'info' | 'success' | 'danger';
  badge: string;
}

export const STATUS: Record<OrderStatus, StatusInfo> = {
  PENDING: {
    label: 'Tertunda',
    icon: 'â³',
    iconName: 'clock',
    color: 'warning',
    badge: 'badge-warning',
  },
  PICKED: {
    label: 'Diverifikasi Picker',
    icon: 'ðŸ“‹',
    iconName: 'check-check',
    color: 'info',
    badge: 'badge-info',
  },
  APPROVED: {
    label: 'Disetujui',
    icon: 'âœ…',
    iconName: 'check-circle',
    color: 'success',
    badge: 'badge-success',
  },
  REJECTED: {
    label: 'Ditolak',
    icon: 'âŒ',
    iconName: 'x-circle',
    color: 'danger',
    badge: 'badge-danger',
  },
};

export function getStatusInfo(status: string): StatusInfo {
  const key = String(status || 'PENDING').toUpperCase() as OrderStatus;
  return STATUS[key] || STATUS.PENDING;
}

export const ITEM_STATUS: Record<string, { label: string; icon: string; iconName: string; color: string }> = {
  APPROVED: { label: 'Disetujui', icon: 'âœ…', iconName: 'check-circle', color: 'success' },
  REJECTED: { label: 'Ditolak', icon: 'ðŸš«', iconName: 'ban', color: 'warning' },
  DELETED: { label: 'Dihapus', icon: 'ðŸ—‘ï¸', iconName: 'trash', color: 'danger' },
  EDITED: { label: 'Diedit', icon: 'âœï¸', iconName: 'edit-2', color: 'info' },
};

export const ROUTES = {
  landing: '/',
  login: '/login',
  dashboard: '/dashboard',
  order: '/order',
  gantiPassword: '/ganti-password',
  laporan: '/laporan',
  profil: '/profil',
  notifikasi: '/notifikasi',
  settings: '/settings',
  picker: '/picker',
} as const;

export type Role = 'admin' | 'cabang' | 'picker';

export function getHomeRoute(role: string): string {
  if (role === 'picker') return ROUTES.picker;
  return role === 'admin' ? ROUTES.dashboard : ROUTES.order;
}

export function getOrderUrl(idCabang = ''): string {
  return `${ROUTES.order}?cabang=${encodeURIComponent(idCabang)}`;
}

export const SETTINGS = {
  itemsPerPage: 40,
  maxOrderItems: 100,
  apiTimeout: 30000,
  autoRefreshMs: 30000,
  throttleMs: 3000,
  toastDuration: 3000,
  toastDurationError: 5000,
  debounceMs: 200,
  notifPollingMs: 30000,
  cacheEnabled: true,
  cacheDuration: 60000,
};

export const FEATURES = {
  darkMode: true,
  pwa: true,
  offline: true,
  notifications: true,
  printLaporan: true,
  exportPdf: false,
  exportExcel: false,
};

export interface Barang {
  KODE_BARANG: string;
  NAMA_BARANG: string;
  KATEGORI?: string;
  SATUAN?: string;
  HARGA?: number | string;
  STOK?: number | string;
  STOK_GUDANG?: number | string;
  STOK_TOKO?: number | string;
  STOK_SISTEM?: number | string;
  [key: string]: unknown;
}

export interface DetailItem {
  KODE_BARANG?: string;
  NAMA_BARANG?: string;
  KATEGORI?: string;
  QTY?: number | string;
  ORIGINAL_QTY?: number | string;
  SATUAN?: string;
  HARGA_SATUAN?: number | string;
  ITEM_STATUS?: string;
  REASON?: string;
  STOK_GUDANG?: number | string;
  STOK_TOKO?: number | string;
  STOK_SISTEM?: number | string;
  STOK_PICKER?: number | string;
  CATATAN_ITEM?: string;
  [key: string]: unknown;
}

export interface Order {
  ORDER_ID: string;
  NOMOR_ORDER?: string;
  TANGGAL_ORDER?: string;
  ID_CABANG?: string;
  STATUS?: string;
  CATATAN?: string;
  CATATAN_ADMIN?: string;
  DIPROSES_OLEH?: string;
  TOTAL_BAYAR?: number | string;
  DETAIL?: DetailItem[];
  [key: string]: unknown;
}