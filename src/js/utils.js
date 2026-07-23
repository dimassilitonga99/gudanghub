/* ═══════════════════════════════════════════════════════════════════════
   UTILS — Helper Functions
   ═══════════════════════════════════════════════════════════════════════ */

import { APP } from './config.js';

// DOM shortcuts
export const $ = (id) => document.getElementById(id);
export const $$ = (selector, parent = document) => parent.querySelector(selector);
export const $$$ = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
export const raf = (cb) => requestAnimationFrame(cb);

export function createEl(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'className') el.className = value;
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    }
    else if (key === 'dataset' && typeof value === 'object') Object.assign(el.dataset, value);
    else if (typeof value === 'boolean') { if (value) el.setAttribute(key, ''); }
    else el.setAttribute(key, value);
  });
  children.flat().forEach((child) => {
    if (child == null) return;
    if (typeof child === 'string' || typeof child === 'number') {
      el.appendChild(document.createTextNode(String(child)));
    } else {
      el.appendChild(child);
    }
  });
  return el;
}

// String utils
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function capitalize(str) {
  const s = String(str || '');
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function truncate(str, maxLength = 50, suffix = '...') {
  const s = String(str || '');
  return s.length > maxLength ? s.slice(0, maxLength - suffix.length) + suffix : s;
}

export function getInitials(name, maxChar = 2) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxChar)
    .map((w) => w.charAt(0).toUpperCase())
    .join('') || '?';
}

export function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Number & currency
export function toNumber(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function toInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function formatRupiah(value, prefix = 'Rp ') {
  return prefix + toNumber(value).toLocaleString('id-ID');
}

export function formatRupiahShort(value) {
  const n = toNumber(value);
  if (n >= 1000000000) return `Rp ${(n / 1000000000).toFixed(1)} M`;
  if (n >= 1000000) return `Rp ${(n / 1000000).toFixed(1)} jt`;
  if (n >= 1000) return `Rp ${(n / 1000).toFixed(1)} rb`;
  return formatRupiah(n);
}

export function formatNumber(value) {
  return toNumber(value).toLocaleString('id-ID');
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Date & time
export function parseAnyDate(value) {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;

  const text = String(value).trim();

  if (/^\d{2}-\d{2}-\d{4}/.test(text)) {
    const [datePart, timePart = '00:00:00'] = text.split(' ');
    const [day, month, year] = datePart.split('-');
    return new Date(`${year}-${month}-${day}T${timePart}+08:00`);
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export function formatWita(value, includeSeconds = true) {
  if (!value) return '-';
  const date = parseAnyDate(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const wita = new Date(date.getTime() + APP.timezoneOffset * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');

  const dateStr = `${pad(wita.getUTCDate())}-${pad(wita.getUTCMonth() + 1)}-${wita.getUTCFullYear()}`;
  const timeStr = includeSeconds
    ? `${pad(wita.getUTCHours())}:${pad(wita.getUTCMinutes())}:${pad(wita.getUTCSeconds())}`
    : `${pad(wita.getUTCHours())}:${pad(wita.getUTCMinutes())}`;

  return `${dateStr} ${timeStr}`;
}

export function formatDateReadable(value) {
  const date = parseAnyDate(value);
  if (Number.isNaN(date.getTime())) return '-';

  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  const wita = new Date(date.getTime() + APP.timezoneOffset * 60 * 60 * 1000);
  const dayName = days[wita.getUTCDay()];
  const day = wita.getUTCDate();
  const month = months[wita.getUTCMonth()];
  const year = wita.getUTCFullYear();

  return `${dayName}, ${day} ${month} ${year}`;
}

export function formatTimeAgo(value) {
  const date = parseAnyDate(value);
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 0) return 'baru saja';
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} minggu lalu`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} bulan lalu`;
  return `${Math.floor(diff / 31536000)} tahun lalu`;
}

export function getCurrentWitaTime() {
  const now = new Date();
  const wita = new Date(now.getTime() + APP.timezoneOffset * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(wita.getUTCHours())}:${pad(wita.getUTCMinutes())}:${pad(wita.getUTCSeconds())}`;
}

// Function utils
export function debounce(callback, wait = 200) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

export function throttle(callback, wait = 200) {
  let lastCall = 0;
  let timer;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - lastCall);
    if (remaining <= 0) {
      clearTimeout(timer);
      lastCall = now;
      callback(...args);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lastCall = Date.now();
        callback(...args);
      }, remaining);
    }
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry(fn, { attempts = 3, delay = 1000, backoff = 2 } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await sleep(delay * Math.pow(backoff, i));
      }
    }
  }
  throw lastError;
}

// Array utils
export function groupBy(array, keyOrFn) {
  const getKey = typeof keyOrFn === 'function' ? keyOrFn : (item) => item[keyOrFn];
  return array.reduce((acc, item) => {
    const key = getKey(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}

export function sortBy(array, key, order = 'asc') {
  const multiplier = order === 'desc' ? -1 : 1;
  return [...array].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return -1 * multiplier;
    if (av > bv) return 1 * multiplier;
    return 0;
  });
}

export function unique(array) {
  return [...new Set(array)];
}

export function uniqueBy(array, key) {
  const seen = new Set();
  return array.filter((item) => {
    const val = item[key];
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

export function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function sum(array, key) {
  if (!key) return array.reduce((s, v) => s + toNumber(v), 0);
  return array.reduce((s, item) => s + toNumber(item[key]), 0);
}

// Object utils
export function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function pick(obj, keys) {
  return keys.reduce((result, key) => {
    if (key in obj) result[key] = obj[key];
    return result;
  }, {});
}

export function omit(obj, keys) {
  const keySet = new Set(keys);
  return Object.keys(obj).reduce((result, key) => {
    if (!keySet.has(key)) result[key] = obj[key];
    return result;
  }, {});
}

export function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

// URL / Query
export function getQueryParams() {
  const params = {};
  new URLSearchParams(window.location.search).forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export function getQueryParam(name, fallback = '') {
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

export function updateQueryParams(updates) {
  const url = new URL(window.location.href);
  Object.entries(updates).forEach(([key, value]) => {
    if (value == null || value === '') {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  });
  window.history.replaceState({}, '', url);
}

// Clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text));
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = String(text);
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      return false;
    }
  }
}

export async function pasteFromClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return '';
  }
}

// Device detection
export const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
export const isTouch = () => window.matchMedia('(hover: none)').matches;
export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);
export const isAndroid = () => /Android/.test(navigator.userAgent);
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

// Storage
export const storage = {
  get(key, fallback = null) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
  clear() {
    try {
      localStorage.clear();
      return true;
    } catch {
      return false;
    }
  },
};

export const session = {
  get(key, fallback = null) {
    try {
      const val = sessionStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key) {
    try {
      sessionStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};

export default {
  $, $$, $$$, raf, createEl,
  escapeHtml, capitalize, truncate, getInitials, slugify,
  toNumber, toInt, formatRupiah, formatRupiahShort, formatNumber, clamp, randomInt,
  parseAnyDate, formatWita, formatDateReadable, formatTimeAgo, getCurrentWitaTime,
  debounce, throttle, sleep, retry,
  groupBy, sortBy, unique, uniqueBy, chunk, sum,
  clone, pick, omit, isEmpty,
  getQueryParams, getQueryParam, updateQueryParams,
  copyToClipboard, pasteFromClipboard,
  isMobile, isTouch, isIOS, isAndroid, isStandalone,
  storage, session,
};
