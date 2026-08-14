import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(n: number | string | undefined | null): string {
  const num = Number(n) || 0;
  return 'Rp ' + num.toLocaleString('id-ID');
}

export function formatWita(dateLike: string | number | Date | undefined | null): string {
  if (!dateLike) return '-';
  const d = new Date(dateLike);
  if (isNaN(d.getTime())) return '-';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())} WITA`;
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function parseAnyDate(value: string | number | Date): Date | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const n = Number(value);
  if (!isNaN(n) && typeof value === 'number') {
    const d = new Date(n);
    return isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (!s) return null;
  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  const parts = s.split(/[\/\-\.]/).map((x) => parseInt(x, 10));
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a > 31) d = new Date(a, b - 1, c);
    else if (c > 99) d = new Date(c, b - 1, a);
    else d = new Date(2000 + c, b - 1, a);
    return isNaN(d.getTime()) ? null : d;
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
  return `${HARI_ID[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateId(d: Date): string {
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatTimeAgo(dateLike: string | number | Date | null | undefined): string {
  const d = dateLike ? new Date(dateLike) : null;
  if (!d || isNaN(d.getTime())) return '-';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return formatDateId(d);
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

export async function downloadJpgPages(
  pages: HTMLElement[],
  filePrefix: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let html2canvas: ((el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>) | null =
    null;
  try {
    const mod = await import('html2canvas');
    html2canvas = mod.default as unknown as typeof html2canvas;
  } catch {
    /* fallback CDN */
  }
  if (!html2canvas) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    await new Promise<void>((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Gagal memuat library.'));
      document.head.appendChild(script);
    });
    html2canvas = (window as unknown as { html2canvas: typeof html2canvas }).html2canvas;
  }

  const total = pages.length;
  for (let i = 0; i < total; i++) {
    onProgress?.(i + 1, total);
    await new Promise((r) => setTimeout(r, 60));
    const canvas = await html2canvas!(pages[i], {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#fff',
      width: pages[i].scrollWidth,
      height: pages[i].scrollHeight,
    });
    const link = document.createElement('a');
    link.download = total > 1 ? `${filePrefix}-Hal-${i + 1}.jpg` : `${filePrefix}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
    if (i < total - 1) await new Promise((r) => setTimeout(r, 600));
  }
}