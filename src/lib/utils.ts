import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { APP } from './config';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(n: number | string | undefined | null): string {
  const num = Number(n) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

// Port persis dari utils.js vanilla: string DD-MM-YYYY diinterpretasikan sebagai waktu WITA (+08:00)
export function formatWita(
  dateLike: string | number | Date | undefined | null,
  includeSeconds = true,
): string {
  if (!dateLike) return '-';
  const d = parseAnyDate(dateLike);
  if (!d) return '-';
  const wita = new Date(d.getTime() + APP.timezoneOffset * 60 * 60 * 1000);
  const pad = (x: number) => String(x).padStart(2, '0');
  const dateStr = `${pad(wita.getUTCDate())}-${pad(wita.getUTCMonth() + 1)}-${wita.getUTCFullYear()}`;
  const timeStr = includeSeconds
    ? `${pad(wita.getUTCHours())}:${pad(wita.getUTCMinutes())}:${pad(wita.getUTCSeconds())}`
    : `${pad(wita.getUTCHours())}:${pad(wita.getUTCMinutes())}`;
  return `${dateStr} ${timeStr}`;
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Port persis dari utils.js vanilla: DD-MM-YYYY dianggap waktu WITA (+08:00); invalid/null → null
export function parseAnyDate(value: string | number | Date | undefined | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d{2}-\d{2}-\d{4}/.test(text)) {
    const [datePart, timePart = '00:00:00'] = text.split(' ');
    const [day, month, year] = datePart.split('-');
    const d = new Date(`${year}-${month}-${day}T${timePart}+08:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(text);
  if (!isNaN(d.getTime())) return d;

  // Fallback DD/MM/YYYY atau DD.MM.YYYY (juga waktu WITA)
  const parts = text.split(/[\/\.]/).map((x) => parseInt(x, 10));
  if (parts.length === 3) {
    const [a, b, c] = parts;
    let iso: string;
    if (a > 31) iso = `${a}-${String(b).padStart(2, '0')}-${String(c).padStart(2, '0')}`;
    else if (c > 99) iso = `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    else iso = `${2000 + c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    const dd = new Date(`${iso}T00:00:00+08:00`);
    return isNaN(dd.getTime()) ? null : dd;
  }
  return null;
}

export function debounce<T extends (...args: never[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function throttle<T extends (...args: never[]) => void>(fn: T, wait = 300) {
  let lastCall = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = wait - (now - lastCall);
    if (remaining <= 0) {
      clearTimeout(timer);
      lastCall = now;
      fn(...args);
    } else {
      clearTimeout(timer);
      timer = setTimeout(() => {
        lastCall = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

// Port djb2 dari login.js vanilla (key cache kredensial)
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(36);
}

export function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─────────────────────────────────────────────────────────────────────────
// FORMAT BANTU (port dari utils.js vanilla)
// ─────────────────────────────────────────────────────────────────────────

export function toInt(v: unknown): number {
  const n = parseInt(String(v), 10);
  return isNaN(n) ? 0 : n;
}

export function getInitials(name: string): string {
  const clean = String(name || '').trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const HARI_ID = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

export function formatTanggalCetak(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, '0');
  const wita = new Date(d.getTime() + APP.timezoneOffset * 60 * 60 * 1000);
  return `${HARI_ID[wita.getUTCDay()]}, ${pad(wita.getUTCDate())}/${pad(wita.getUTCMonth() + 1)}/${wita.getUTCFullYear()}`;
}

export function formatDateId(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTimeAgo(dateLike: string | number | Date | null | undefined): string {
  const d = parseAnyDate(dateLike);
  if (!d) return '-';
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} minggu lalu`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} bulan lalu`;
  return `${Math.floor(diff / 31536000)} tahun lalu`;
}

// Port getSequentialNumber dari print-form.js vanilla (nomor urut per bulan, dimulai 01)
// Skala PER-CABANG: urutan mengikuti nomor yang tampil di form tiap cabang, bukan semua cabang.
export function getSequentialNumber(
  order: { TANGGAL_ORDER?: string | null; ORDER_ID: string | number; ID_CABANG?: string | null } | undefined | null,
  allOrders: { TANGGAL_ORDER?: string | null; ORDER_ID: string | number; ID_CABANG?: string | null }[] | undefined | null,
): string {
  try {
    if (!order || !allOrders) return '01';
    const orderDate = parseAnyDate(order.TANGGAL_ORDER ?? '');
    if (!orderDate) return '01';
    const targetMonth = orderDate.getMonth();
    const targetYear = orderDate.getFullYear();
    const cabang = String(order.ID_CABANG || '').toUpperCase();

    const sameMonth = allOrders
      .filter((o) => {
        const d = parseAnyDate(o.TANGGAL_ORDER ?? '');
        return (
          d !== null &&
          cabang === String(o.ID_CABANG || '').toUpperCase() &&
          d.getMonth() === targetMonth &&
          d.getFullYear() === targetYear
        );
      })
      .sort(
        (a, b) =>
          (parseAnyDate(a.TANGGAL_ORDER ?? '')?.getTime() ?? 0) -
          (parseAnyDate(b.TANGGAL_ORDER ?? '')?.getTime() ?? 0),
      );

    const idx = sameMonth.findIndex((o) => o.ORDER_ID === order.ORDER_ID);
    const nomor = idx >= 0 ? idx + 1 : sameMonth.length + 1;
    return nomor < 10 ? '0' + nomor : String(nomor);
  } catch {
    return '01';
  }
}

export function cleanCatatan(catatan: string | undefined | null): string {
  if (!catatan) return '';
  return String(catatan)
    .replace(/\[STOK AKTUAL\][\s\S]*/g, '')
    .replace(/\[MASSAL\]/g, '')
    .replace(/\[FORM\][^\n]*\n?/g, '')
    .trim();
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/OPR\//.test(ua) || /Opera/.test(ua)) return 'Opera';
  return 'Unknown';
}

export function estimateLocalStorageKB(): number {
  try {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) total += (localStorage.getItem(key) || '').length + key.length;
    }
    return Math.round((total * 2) / 1024);
  } catch {
    return 0;
  }
}

export function playTestSound(): void {
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    /* audio tidak tersedia */
  }
}

async function inlineImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(async (img) => {
      try {
        const res = await fetch(img.src);
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error('read error'));
          fr.readAsDataURL(blob);
        });
        img.removeAttribute('crossorigin');
        img.src = dataUrl;
      } catch {
        // Fallback: gambar sudah tampil di preview (crossOrigin=anonymous → canvas tak tainted).
        // Logo TIDAK PERNAH dibuang hanya karena fetch gagal — gambar langsung dari elemen hidup.
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth || 100;
          c.height = img.naturalHeight || 32;
          c.getContext('2d')!.drawImage(img, 0, 0);
          img.removeAttribute('crossorigin');
          img.src = c.toDataURL('image/png');
        } catch {
          img.remove();
        }
      }
    }),
  );
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal merender halaman gambar.'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

// Set densitas JFIF (dpi) pada data URL JPEG — canvas default 72 dpi membuat JPG
// dicetak "Actual size" menjadi 55 cm; 192 dpi (2× dari render 96 dpi) = tepat 21×15,1 cm.
function setJpegDpi(dataUrl: string, dpi: number): string {
  const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  if (bin.length < 16 || bin.charCodeAt(2) !== 0xff || bin.charCodeAt(3) !== 0xe0 || bin.charCodeAt(6) !== 0x4a) {
    return dataUrl; // bukan JFIF standar — biarkan apa adanya
  }
  const px = String.fromCharCode((dpi >> 8) & 0xff, dpi & 0xff);
  const out = bin.slice(0, 11) + '\x01' + px + px + bin.slice(15);
  return 'data:image/jpeg;base64,' + btoa(out);
}

export async function downloadJpgPages(
  pages: HTMLElement[],
  filePrefix: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  // WYSIWYG: JPG = clone .print-sheet persis tampilan preview (rotator, skala --fit,
  // logo, semua transform & layout ikut). SVG foreignObject me-render XHTML seperti
  // browser me-render layar → hasil identik preview, nol komposisi ulang.
  const W = 793.7; // 21 cm — lebar kertas, sama dengan .print-sheet
  const H = 570.7; // 15,1 cm
  const total = pages.length;
  for (let i = 0; i < total; i++) {
    onProgress?.(i + 1, total);
    await new Promise((r) => setTimeout(r, 60));
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0';
    const clone = pages[i].cloneNode(true) as HTMLElement;
    clone.style.setProperty('margin', '0', 'important');
    clone.style.setProperty('box-shadow', 'none', 'important');
    // Paritas dengan layar: foreignObject TIDAK membawa stylesheet app, hanya inline style.
    // Tailwind preflight memberi html{line-height:1.5} + *{box-sizing:border-box} di preview —
    // tanpa ini tinggi baris td tanpa lineHeight inline beda → komposisi bergeser.
    clone.style.setProperty('line-height', '1.5', 'important');
    holder.appendChild(clone);
    document.body.appendChild(holder);
    let canvas: HTMLCanvasElement;
    try {
      await inlineImages(clone);
      const xml = new XMLSerializer().serializeToString(clone);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H * 2}" viewBox="0 0 ${W} ${H}"><foreignObject x="0" y="0" width="${W}" height="${H}">${xml}</foreignObject></svg>`;
      const src = await loadSvgImage(svg);
      canvas = document.createElement('canvas');
      canvas.width = Math.round(W * 2);
      canvas.height = Math.round(H * 2);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    } finally {
      holder.remove();
    }
    const link = document.createElement('a');
    link.download = total > 1 ? `${filePrefix}-Hal-${i + 1}.jpg` : `${filePrefix}.jpg`;
    link.href = setJpegDpi(canvas.toDataURL('image/jpeg', 0.92), 192);
    link.click();
    if (i < total - 1) await new Promise((r) => setTimeout(r, 600));
  }
}