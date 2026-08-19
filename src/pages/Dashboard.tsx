import { Icon } from '../components/ui/icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { toastError, toastSuccess } from '@/lib/toast';

import { katalog, orders } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { APP, CABANG, SETTINGS, type Barang, type Order, type DetailItem } from '@/lib/config';
import {
  cn,
  formatRupiah,
  formatWita,
  getSequentialNumber,
  parseAnyDate,
  toInt,
} from '@/lib/utils';
import { useDialog } from '@/lib/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PrintFormModal, { type PrintItem } from '@/components/print-form';

function toNum(v: unknown): number {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

function StatusBadge({ status }: { status: string }) {
  const st = String(status || 'PENDING').toUpperCase();
  const map: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
    PENDING: {
      cls: 'bg-warning/15 text-warning border-warning/30',
      label: 'Tertunda',
      icon: <Icon name="clock" size={12} />,
    },
    PICKED: {
      cls: 'bg-info/15 text-info border-info/30',
      label: 'Diverifikasi Picker',
      icon: <Icon name="box-check" size={12} />,
    },
    APPROVED: {
      cls: 'bg-success/15 text-success border-success/30',
      label: 'Disetujui',
      icon: <Icon name="check-circle" size={12} />,
    },
    REJECTED: {
      cls: 'bg-danger/15 text-danger border-danger/30',
      label: 'Ditolak',
      icon: <Icon name="circle-xmark" size={12} />,
    },
  };
  const info = map[st] || map.PENDING;
  return (
    <Badge variant="outline" className={cn('gap-1', info.cls)}>
      {info.icon} {info.label}
    </Badge>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   DONUT CHART
   ───────────────────────────────────────────────────────────────────── */

const PALETTE = ['#ff6b00', '#8b5cf6', '#22c55e', '#f59e0b', '#0ea5e9', '#ef4444', '#14b8a6', '#ec4899'];

function witaDayUTC(d: Date): number {
  const s = new Date(d.getTime() + APP.timezoneOffset * 3600 * 1000);
  return Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
}

// Jam header tick per detik di komponen kecil — hindari re-render seluruh dashboard tiap detik
function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className={className}>{formatWita(now)}</span>;
}

function DonutChart({
  segments,
  total,
  centerLabel = 'Total',
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  centerLabel?: string;
}) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const t = Math.max(1, total);
  let offset = 0;
  const segs = segments.map((s) => {
    const dash = (s.value / t) * C;
    const seg = { ...s, dash, offset };
    offset += dash;
    return seg;
  });

  return (
    <div className="flex items-center gap-5">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#1e1e3a" strokeWidth="18" />
        {segs.map((s, i) =>
          s.dash > 0 ? (
            <circle
              key={i}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeLinecap="round"
              strokeDasharray={`${s.dash} ${C - s.dash}`}
              strokeDashoffset={-s.offset}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease' }}
            />
          ) : null,
        )}
        <text x="60" y="57" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="bold">
          {total}
        </text>
        <text x="60" y="72" textAnchor="middle" fill="#94a3b8" fontSize="10">
          {centerLabel}
        </text>
      </svg>
      <div className="space-y-1.5 text-sm">
        {segments.map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
            <span className="text-muted-foreground">{l.label}</span>
            <b className="ml-auto">{l.value}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function niceMax(v: number): number {
  if (v <= 1) return 1;
  const base = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / base;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * base;
}

function fmtDateInputWita(d: Date): string {
  const s = new Date(d.getTime() + APP.timezoneOffset * 3600 * 1000);
  return `${s.getUTCFullYear()}-${String(s.getUTCMonth() + 1).padStart(2, '0')}-${String(s.getUTCDate()).padStart(2, '0')}`;
}

function fmtRpCompact(v: number): string {
  if (v >= 1e6) return `Rp ${(v / 1e6).toFixed(1)}jt`;
  if (v >= 1e3) return `Rp ${Math.round(v / 1e3)}rb`;
  return `Rp ${Math.round(v)}`;
}

const MAX_DAYS = 180;

function buildDayBuckets(
  orders: Order[],
  from: string,
  to: string,
  classify: (o: Order) => { key: string; value: number }[],
): { day: number; label: string; values: Record<string, number> }[] {
  const nowDay = witaDayUTC(new Date());
  const endDay = to ? witaDayUTC(new Date(to + 'T00:00:00Z')) : nowDay;
  let minDay = from ? witaDayUTC(new Date(from + 'T00:00:00Z')) : null;
  if (!minDay) {
    const ds = orders
      .map((o) => {
        const d = parseAnyDate(o.TANGGAL_ORDER ?? '');
        return d ? witaDayUTC(d) : NaN;
      })
      .filter(Number.isFinite);
    minDay = ds.length ? Math.min(...ds) : endDay;
  }
  if (minDay > endDay) minDay = endDay;
  const spanDays = Math.round((endDay - minDay) / 86400000);
  if (spanDays > MAX_DAYS) minDay = endDay - MAX_DAYS * 86400000;
  const n = Math.round((endDay - minDay) / 86400000) + 1;
  const buckets: { day: number; label: string; values: Record<string, number> }[] = [];
  for (let i = 0; i < n; i++) {
    const day = minDay + i * 86400000;
    const d = new Date(day);
    buckets.push({ day, label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, values: {} });
  }
  const byDay = new Map(buckets.map((b) => [b.day, b]));
  for (const o of orders) {
    const d = parseAnyDate(o.TANGGAL_ORDER ?? '');
    if (!d) continue;
    const b = byDay.get(witaDayUTC(d));
    if (!b) continue;
    for (const c of classify(o)) b.values[c.key] = (b.values[c.key] ?? 0) + c.value;
  }
  return buckets;
}

const classifyByStatus = (o: Order) => {
  const st = String(o.STATUS || 'PENDING').toUpperCase();
  const key = st === 'APPROVED' ? 'approved' : st === 'PENDING' ? 'pending' : st === 'REJECTED' ? 'rejected' : 'other';
  return [
    { key, value: 1 },
    { key: 'total', value: 1 },
  ];
};

const classifyByCabang = (o: Order) => [{ key: String(o.ID_CABANG || '').toUpperCase(), value: 1 }];

const classifyNilai = (o: Order) => {
  const dets = (o.DETAIL as DetailItem[] | undefined) || [];
  const val = dets
    .filter((d) => String(d.ITEM_STATUS || 'APPROVED').toUpperCase() === 'APPROVED')
    .reduce((s, d) => s + (Number(d.QTY) || 0) * (Number(d.HARGA_SATUAN) || 0), 0);
  return val > 0 ? [{ key: 'nilai', value: val }] : [];
};

const classifyQty = (o: Order) => {
  const dets = (o.DETAIL as DetailItem[] | undefined) || [];
  const qty = dets
    .filter((d) => String(d.ITEM_STATUS || 'APPROVED').toUpperCase() !== 'DELETED')
    .reduce((s, d) => s + toInt(d.QTY), 0);
  return qty > 0 ? [{ key: 'qty', value: qty }] : [];
};

const ORDER_SERIES = [
  { key: 'total', label: 'Total', color: '#ff6b00' },
  { key: 'approved', label: 'Disetujui', color: '#22c55e' },
  { key: 'pending', label: 'Tertunda', color: '#f59e0b' },
  { key: 'rejected', label: 'Ditolak', color: '#ef4444' },
];

const CABANG_SERIES = Object.keys(CABANG).map((id, i) => ({
  key: id,
  label: CABANG[id].pic,
  color: CABANG[id].color || PALETTE[i % PALETTE.length],
}));

function ChartPeriod({
  from,
  to,
  quick,
  onFrom,
  onTo,
  onQuick,
}: {
  from: string;
  to: string;
  quick: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onQuick: (v: string) => void;
}) {
  const chips: [string, string][] = [
    ['7', '7 Hari'],
    ['30', '30 Hari'],
    ['90', '90 Hari'],
    ['month', 'Bulan Ini'],
    ['all', 'Semua'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {chips.map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => onQuick(val)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
              quick === val ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <input
          type="date"
          value={from}
          onChange={(e) => onFrom(e.target.value)}
          title="Dari tanggal"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs dark:[color-scheme:dark]"
        />
        <span className="text-muted-foreground">s/d</span>
        <input
          type="date"
          value={to}
          onChange={(e) => onTo(e.target.value)}
          title="Sampai tanggal"
          className="h-8 rounded-md border border-input bg-background px-2 text-xs dark:[color-scheme:dark]"
        />
      </div>
    </div>
  );
}

function LineChart({
  data,
  series,
  format = (v) => String(v),
  height = 230,
}: {
  data: { day: number; label: string; values: Record<string, number> }[];
  series: { key: string; label: string; color: string }[];
  format?: (v: number) => string;
  height?: number;
}) {
  const W = 720;
  const H = height;
  const P = { top: 18, right: 14, bottom: 26, left: 52 };
  const iw = W - P.left - P.right;
  const ih = H - P.top - P.bottom;
  const maxV = Math.max(1, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0)));
  const nice = niceMax(maxV);
  const x = (i: number) => P.left + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => P.top + ih - (v / nice) * ih;

  if (data.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Tidak ada data pada periode ini.</div>;
  }
  const step = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line
              x1={P.left}
              x2={W - P.right}
              y1={y(nice * f)}
              y2={y(nice * f)}
              stroke="currentColor"
              strokeOpacity="0.08"
            />
            <text x={P.left - 6} y={y(nice * f) + 3} textAnchor="end" fontSize="9" fill="currentColor" fillOpacity="0.5">
              {format(nice * f)}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <polyline
            key={s.key}
            points={data.map((d, i) => `${x(i)},${y(d.values[s.key] ?? 0)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {data.map((d, i) =>
          i % step === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.55">
              {d.label}
            </text>
          ) : null,
        )}
        {series.map((s) => {
          const i = data.length - 1;
          const v = data[i].values[s.key] ?? 0;
          return v > 0 ? (
            <g key={s.key + '-end'}>
              <circle cx={x(i)} cy={y(v)} r="3.5" fill={s.color} stroke="#fff" strokeWidth="1" />
              <text x={x(i) - 4} y={y(v) - 7} textAnchor="end" fontSize="9" fontWeight="bold" fill={s.color}>
                {format(v)}
              </text>
            </g>
          ) : null;
        })}
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} /> {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function LineChartCard({
  title,
  icon,
  series,
  classify,
  format,
  orders,
  loading,
}: {
  title: string;
  icon: string;
  series: { key: string; label: string; color: string }[];
  classify: (o: Order) => { key: string; value: number }[];
  format?: (v: number) => string;
  orders: Order[];
  loading: boolean;
}) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [quick, setQuick] = useState('30');
  const applyQuick = (type: string) => {
    const today = new Date();
    let f = '';
    let t = fmtDateInputWita(today);
    if (type === '7') f = fmtDateInputWita(new Date(today.getTime() - 6 * 86400000));
    else if (type === '30') f = fmtDateInputWita(new Date(today.getTime() - 29 * 86400000));
    else if (type === '90') f = fmtDateInputWita(new Date(today.getTime() - 89 * 86400000));
    else if (type === 'month') f = fmtDateInputWita(new Date(today.getFullYear(), today.getMonth(), 1));
    else if (type === 'all') {
      f = '';
      t = '';
    }
    setQuick(type);
    setFrom(f);
    setTo(t);
  };
  const buckets = useMemo(() => buildDayBuckets(orders, from, to, classify), [orders, from, to, classify]);

  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Icon name={icon} size={16} className="text-brand" />
          {title}
        </h3>
        <ChartPeriod from={from} to={to} quick={quick} onFrom={setFrom} onTo={setTo} onQuick={applyQuick} />
        <div className="mt-3">
          {loading ? <Skeleton className="h-56 w-full" /> : <LineChart data={buckets} series={series} format={format} />}
        </div>
      </CardContent>
    </Card>
  );
}

function StackedBarChart({
  data,
  max,
}: {
  data: { pic: string; pending: number; approved: number; rejected: number }[];
  max: number;
}) {
  return (
    <div className="flex h-44 items-end justify-around gap-3">
      {data.map((c) => {
        const total = c.pending + c.approved + c.rejected;
        const pct = (v: number) => (v / max) * 100;
        const layers = [
          { key: 'approved' as const, value: c.approved, cls: 'bg-success' },
          { key: 'pending' as const, value: c.pending, cls: 'bg-warning' },
          { key: 'rejected' as const, value: c.rejected, cls: 'bg-danger' },
        ];
        return (
          <div key={c.pic} className="flex h-full flex-1 flex-col items-center gap-1">
            <span className="text-xs font-bold">{total}</span>
            <div
              className="flex h-full w-full flex-col-reverse overflow-hidden rounded-t-md bg-muted/20"
              title={`${c.pic}: ${total} order`}
            >
              {layers.map((l) =>
                l.value > 0 ? (
                  <div key={l.key} style={{ height: `${pct(l.value)}%` }} className={cn('flex w-full items-center justify-center', l.cls)}>
                    {pct(l.value) >= 9 && (
                      <span className="text-[9px] font-bold leading-none text-white">{l.value}</span>
                    )}
                  </div>
                ) : null,
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">{c.pic}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   EDIT MODAL (lengkap: kelola item, tambah item, total, catatan, 4 tombol)
   ───────────────────────────────────────────────────────────────────── */

interface EditItemState {
  kode: string;
  nama: string;
  kategori: string;
  qty: number;
  originalQty: number;
  satuan: string;
  harga: number;
  itemStatus: string;
  reason: string;
  stokGudang: number | '';
  stokToko: number | '';
  stokSistem: number | '';
  stokPicker: string;
  catatanItem: string;
}

function EditModal({
  order,
  katalog,
  allOrders,
  sessionName,
  onClose,
  onSaved,
}: {
  order: Order | null;
  katalog: Barang[];
  allOrders: Order[];
  sessionName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { confirm, prompt, dialog } = useDialog();
  const [items, setItems] = useState<EditItemState[]>([]);
  const [catatan, setCatatan] = useState('');
  const [saving, setSaving] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [addKode, setAddKode] = useState('');
  const [addQty, setAddQty] = useState(1);
  const cabang = order ? CABANG[String(order.ID_CABANG || '')] : undefined;

  useEffect(() => {
    if (!order) return;
    setItems(
      ((order.DETAIL as DetailItem[] | undefined) || []).map((d) => ({
        kode: String(d.KODE_BARANG || ''),
        nama: String(d.NAMA_BARANG || ''),
        kategori: String(d.KATEGORI || ''),
        qty: toNum(d.QTY),
        originalQty: toNum(d.ORIGINAL_QTY) || toNum(d.QTY),
        satuan: String(d.SATUAN || 'PCS'),
        harga: toNum(d.HARGA_SATUAN),
        itemStatus: String(d.ITEM_STATUS || 'APPROVED').toUpperCase(),
        reason: String(d.REASON || ''),
        stokGudang: d.STOK_GUDANG === '' || d.STOK_GUDANG === undefined ? '' : toNum(d.STOK_GUDANG),
        stokToko: d.STOK_TOKO === '' || d.STOK_TOKO === undefined ? '' : toNum(d.STOK_TOKO),
        stokSistem:
          d.STOK_SISTEM === '' || d.STOK_SISTEM === undefined ? '' : toNum(d.STOK_SISTEM),
        stokPicker:
          d.STOK_PICKER !== undefined && d.STOK_PICKER !== '' && d.STOK_PICKER !== null
            ? String(d.STOK_PICKER)
            : '',
        catatanItem: String(d.CATATAN_ITEM || ''),
      })),
    );
    setCatatan(String((order as unknown as Record<string, unknown>).CATATAN_ADMIN || ''));
  }, [order]);

  if (!order) return null;

  const updateItem = (idx: number, patch: Partial<EditItemState>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const isEdited = (it: EditItemState) =>
    it.itemStatus === 'APPROVED' && it.originalQty > 0 && it.qty !== it.originalQty;

  const editQuantity = async (idx: number) => {
    const it = items[idx];
    const res = await prompt({
      icon: '✏️',
      title: 'Ubah Quantity',
      message: `${it.kode} — ${it.nama}\nQty asli: ${it.originalQty}\nQty saat ini: ${it.qty}`,
      placeholder: 'Keterangan perubahan (opsional)...',
      okText: 'Update',
      okVariant: 'secondary',
      defaultValue: it.reason,
      showNumber: true,
      numberValue: it.qty,
    });
    if (!res) return;
    const val = res as { text: string; number: number };
    updateItem(idx, {
      qty: Math.max(1, val.number),
      reason: val.text,
      itemStatus: 'APPROVED',
    });
  };

  const rejectItem = async (idx: number) => {
    const it = items[idx];
    if (it.itemStatus === 'REJECTED') {
      updateItem(idx, { itemStatus: 'APPROVED', reason: '' });
      return;
    }
    const res = await prompt({
      icon: '🚫',
      title: 'Tolak Item',
      message: `${it.kode} — ${it.nama}\nQty: ${it.qty}\nIsi alasan wajib:`,
      placeholder: 'Contoh: Stok tidak cukup...',
      okText: 'Ya, Tolak',
      okVariant: 'destructive',
      required: true,
      defaultValue: it.reason,
    });
    if (res === null) return;
    updateItem(idx, { itemStatus: 'REJECTED', reason: typeof res === 'string' ? res : '' });
  };

  const deleteItem = async (idx: number) => {
    const it = items[idx];
    if (it.itemStatus === 'DELETED') {
      updateItem(idx, { itemStatus: 'APPROVED', reason: '' });
      return;
    }
    const res = await prompt({
      icon: '🗑️',
      title: 'Hapus Item',
      message: `${it.kode} — ${it.nama}\nQty: ${it.qty}\nIsi alasan wajib:`,
      placeholder: 'Contoh: Barang tidak tersedia...',
      okText: 'Ya, Hapus',
      okVariant: 'destructive',
      required: true,
      defaultValue: it.reason,
    });
    if (res === null) return;
    updateItem(idx, { itemStatus: 'DELETED', reason: typeof res === 'string' ? res : '' });
  };

  const addNewItem = () => {
    if (!addKode) {
      toast.warning('Pilih barang dulu.');
      return;
    }
    const barang = katalog.find((b) => String(b.KODE_BARANG).toUpperCase() === addKode.toUpperCase());
    if (!barang) {
      toastError('Barang tidak ditemukan di katalog.');
      return;
    }
    const existingIdx = items.findIndex(
      (it) => it.itemStatus === 'APPROVED' && it.kode.toUpperCase() === addKode.toUpperCase(),
    );
    if (existingIdx >= 0) {
      const newQty = items[existingIdx].qty + addQty;
      updateItem(existingIdx, { qty: newQty });
      toast.info(`Qty ${addKode} bertambah jadi ${newQty}`);
    } else {
      const newItem: EditItemState = {
        kode: String(barang.KODE_BARANG),
        nama: String(barang.NAMA_BARANG || ''),
        kategori: String(barang.KATEGORI || ''),
        qty: addQty,
        originalQty: 0,
        satuan: String(barang.SATUAN || 'PCS'),
        harga: toNum(barang.HARGA),
        itemStatus: 'APPROVED',
        reason: 'Item baru ditambahkan admin',
        stokGudang: '',
        stokToko: '',
        stokSistem: toNum(barang.STOK),
        stokPicker: '',
        catatanItem: '',
      };
      setItems((prev) => [...prev, newItem]);
      toastSuccess(`${newItem.nama} ditambahkan`);
    }
    setAddKode('');
    setAddQty(1);
  };

  const validateItems = (): string[] => {
    const errors: string[] = [];
    items.forEach((it) => {
      if ((it.itemStatus === 'REJECTED' || it.itemStatus === 'DELETED') && !it.reason.trim()) {
        errors.push(`${it.kode} belum ada alasan`);
      }
    });
    return errors;
  };

  const handleSave = async (sendEmail: boolean) => {
    if (items.length === 0) {
      toast.warning('Pesanan kosong.');
      return;
    }
    const errors = validateItems();
    if (errors.length > 0) {
      toastError(`${errors.length} item wajib punya alasan.`, { duration: 5000 });
      return;
    }
    const approved = items.filter((i) => i.itemStatus === 'APPROVED').length;
    const rejected = items.filter((i) => i.itemStatus === 'REJECTED').length;
    const deleted = items.filter((i) => i.itemStatus === 'DELETED').length;
    const edited = items.filter(isEdited).length;
    const total = items
      .filter((i) => i.itemStatus === 'APPROVED')
      .reduce((s, i) => s + i.qty * i.harga, 0);
    const statusNow = approved === 0 ? 'REJECTED' : 'APPROVED';

    const ok = await confirm(
      sendEmail
        ? {
            icon: '📧',
            title: 'Approve & Kirim Email?',
            message: `Order ${order.ORDER_ID}\nStatus: ${statusNow}\nEmail dikirim ke cabang.\n\n${approved} disetujui (${edited} diedit)\n${rejected} ditolak\n${deleted} dihapus\nTotal: ${formatRupiah(total)}`,
            okText: 'Approve & Kirim',
            okVariant: 'secondary',
          }
        : {
            icon: '💾',
            title: 'Simpan Perubahan?',
            message: `Order ${order.ORDER_ID}\nStatus TETAP.\n\n${approved} disetujui (${edited} diedit)\n${rejected} ditolak\n${deleted} dihapus\nTotal: ${formatRupiah(total)}`,
            okText: 'Ya, Simpan',
            okVariant: 'secondary',
          },
    );
    if (!ok) return;

    setSaving(true);
    try {
      const result = await orders.edit({
        orderId: order.ORDER_ID,
        catatanAdmin: catatan,
        diprosesOleh: sessionName || 'Admin Dashboard',
        kirimEmail: sendEmail,
        items: items.map((it) => ({
          kode: it.kode,
          nama: it.nama,
          kategori: it.kategori,
          qty: it.qty,
          satuan: it.satuan,
          harga: it.harga,
          itemStatus: it.itemStatus,
          reason: it.reason,
          originalQty: it.originalQty,
          stokGudang: it.stokGudang === '' ? '' : it.stokGudang,
          stokToko: it.stokToko === '' ? '' : it.stokToko,
          stokSistem: it.stokSistem === '' ? 0 : it.stokSistem,
          stokPicker: it.stokPicker,
          catatanItem: it.catatanItem,
        })),
      });
      if (result.status === 'ok') {
        toastSuccess(sendEmail ? 'Tersimpan & email terkirim!' : 'Perubahan tersimpan!');
        onSaved();
        onClose();
      } else {
        toastError(String(result.message || 'Gagal menyimpan.'));
      }
    } catch (e) {
      toastError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrintForm = () => {
    if (items.length === 0) {
      toast.warning('Pesanan kosong.');
      return;
    }
    const active = items.filter((i) => i.itemStatus !== 'DELETED');
    if (active.length === 0) {
      toast.warning('Tidak ada item aktif.');
      return;
    }
    setPrintOpen(true);
  };

  const totalApproved = items
    .filter((i) => i.itemStatus === 'APPROVED')
    .reduce((s, i) => s + i.qty * i.harga, 0);

  const printItems: PrintItem[] = items.map((it) => ({
    kode: it.kode,
    nama: it.nama,
    kategori: it.kategori,
    qty: it.qty,
    satuan: it.satuan,
    harga: it.harga,
    itemStatus: it.itemStatus,
    reason: it.reason,
    originalQty: it.originalQty,
    stokGudang: it.stokGudang,
    stokToko: it.stokToko,
    stokSistem: it.stokSistem,
    stokPicker: it.stokPicker,
    catatanItem: it.catatanItem,
  }));

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && !saving && onClose()}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Icon name="package" size={16} className="text-brand" />
              {order.ORDER_ID}
            </DialogTitle>
          </DialogHeader>

          {/* Info rows */}
          <div className="grid grid-cols-1 gap-1.5 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Cabang</span>
              <b>
                {cabang ? `${cabang.nama} (${order.ID_CABANG})` : order.ID_CABANG}
              </b>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">PIC</span>
              <b>{cabang?.pic || '-'}</b>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Tanggal Order</span>
              <b className="text-right">{formatWita(order.TANGGAL_ORDER)}</b>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Status</span>
              <StatusBadge status={String(order.STATUS || 'PENDING')} />
            </div>
            {order.CATATAN && (
              <div className="flex items-start gap-2 sm:col-span-2">
                <Icon name="message-text" size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                <span className="text-sm">{order.CATATAN}</span>
              </div>
            )}
          </div>

          {/* Kelola item */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Kelola Item ({items.length})</h3>
          </div>

          <div className="hidden grid-cols-[1fr_4rem_3rem_5rem_6rem_8rem] gap-2 px-1 text-[11px] font-semibold uppercase text-muted-foreground md:grid">
            <span>Barang</span>
            <span className="text-center">Order</span>
            <span className="text-center">Picker</span>
            <span className="text-right">Subtotal</span>
            <span className="text-right">Aksi</span>
          </div>

          <div className="space-y-2">
            {items.map((it, idx) => {
              const edited = isEdited(it);
              const rejected = it.itemStatus === 'REJECTED';
              const deleted = it.itemStatus === 'DELETED';
              const disabled = rejected || deleted;
              const pickerVal = it.stokPicker;
              const pickerOk = pickerVal !== '' && toInt(pickerVal) >= it.qty;
              const st = deleted ? 'DELETED' : rejected ? 'REJECTED' : edited ? 'EDITED' : 'APPROVED';
              const badgeMap: Record<string, { label: string; cls: string }> = {
                DELETED: { label: 'DIHAPUS', cls: 'bg-danger/15 text-danger border-danger/30' },
                REJECTED: { label: 'DITOLAK', cls: 'bg-warning/15 text-warning border-warning/30' },
                EDITED: { label: 'DIEDIT', cls: 'bg-info/15 text-info border-info/30' },
                APPROVED: { label: '', cls: '' },
              };
              const badge = badgeMap[st];
              return (
                <div
                  key={idx}
                  className={cn(
                    'rounded-lg border p-3',
                    deleted && 'border-danger/40 bg-danger/5 opacity-65',
                    rejected && 'border-warning/40 bg-warning/5 opacity-75',
                    edited && 'border-info/40 bg-info/5',
                    !rejected && !deleted && !edited && 'border-border',
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-brand">{it.kode}</span>
                        {badge.label && (
                          <Badge variant="outline" className={cn('gap-1', badge.cls)}>
                            {badge.label}
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-sm font-medium">
                        {it.nama}
                        {it.catatanItem && (
                          <span className="ml-1 text-xs font-bold italic text-danger">({it.catatanItem})</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatRupiah(it.harga)} / {it.satuan}
                      </div>
                      {(it.stokSistem !== '' || it.stokGudang !== '' || it.stokToko !== '' || pickerVal !== '') && (
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                          {it.stokSistem !== '' && (
                            <span className="flex items-center gap-1">
                              <Icon name="package" size={12} /> Sistem: {it.stokSistem}
                            </span>
                          )}
                          {it.stokGudang !== '' && (
                            <span className="flex items-center gap-1">
                              <Icon name="warehouse-alt" size={12} /> Gudang: {it.stokGudang}
                            </span>
                          )}
                          {it.stokToko !== '' && (
                            <span className="flex items-center gap-1">
                              <Icon name="shop" size={12} /> Toko: {it.stokToko}
                            </span>
                          )}
                          {pickerVal !== '' && (
                            <span className="flex items-center gap-1 font-bold text-info">
                              <Icon name="box-check" size={12} /> Picker: {pickerVal}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <div className="text-[11px] text-muted-foreground">Qty</div>
                        <Input
                          type="number"
                          min={1}
                          value={it.qty}
                          disabled={disabled}
                          onChange={(e) =>
                            updateItem(idx, { qty: Math.max(1, toInt(e.target.value)) })
                          }
                          className="h-8 w-20 text-center"
                        />
                      </div>
                      <div className="text-center">
                        <div className="text-[11px] text-muted-foreground">Picker</div>
                        <div
                          className={cn(
                            'flex h-8 min-w-14 items-center justify-center rounded-md border px-2 text-sm font-bold',
                            pickerVal === ''
                              ? 'border-border text-muted-foreground'
                              : pickerOk
                                ? 'border-success/40 bg-success/10 text-success'
                                : 'border-danger/40 bg-danger/10 text-danger',
                          )}
                        >
                          {pickerVal === '' ? '—' : pickerVal}
                        </div>
                      </div>
                      <div className="w-20 text-right">
                        <div className="text-[11px] text-muted-foreground">Subtotal</div>
                        <div className="text-sm font-bold">
                          {disabled ? '-' : formatRupiah(it.qty * it.harga)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        {disabled ? (
                          <Button size="sm" variant="outline" onClick={() => rejectItem(idx)}>
                            <Icon name="refresh" size={14} />
                            Kembalikan
                          </Button>
                        ) : (
                          <>
                            <div className="flex gap-1">
                              <Button size="icon" variant="outline" className="h-7 w-7" title="Edit qty" onClick={() => void editQuantity(idx)}>
                                <Icon name="edit" size={14} />
                              </Button>
                              <Button size="icon" variant="outline" className="h-7 w-7 text-warning" title="Tolak" onClick={() => void rejectItem(idx)}>
                                <Icon name="ban" size={14} />
                              </Button>
                              <Button size="icon" variant="outline" className="h-7 w-7 text-danger" title="Hapus" onClick={() => void deleteItem(idx)}>
                                <Icon name="trash" size={14} />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {(rejected || deleted || edited) && (
                    <Textarea
                      value={it.reason}
                      onChange={(e) => updateItem(idx, { reason: e.target.value })}
                      placeholder={
                        rejected || deleted ? 'Wajib isi alasan...' : 'Tulis keterangan (opsional)...'
                      }
                      rows={2}
                      className={cn('mt-2 text-sm', rejected && it.reason.trim() === '' && 'border-danger')}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Tambah item */}
          <div className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-border p-3">
            <div className="min-w-52 flex-1">
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                Tambah Barang
              </label>
              <select
                value={addKode}
                onChange={(e) => setAddKode(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">+ Pilih barang untuk ditambah...</option>
                {katalog.map((b) => (
                  <option key={String(b.KODE_BARANG)} value={String(b.KODE_BARANG)}>
                    {b.KODE_BARANG} — {b.NAMA_BARANG}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Jumlah</label>
              <Input
                type="number"
                min={1}
                value={addQty}
                onChange={(e) => setAddQty(toInt(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addNewItem();
                  }
                }}
                className="h-9 w-20"
              />
            </div>
            <Button onClick={addNewItem}>
              <Icon name="plus" size={16} />
              Tambah
            </Button>
          </div>

          {/* Total & catatan */}
          <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
            <span className="text-sm font-medium">Total Disetujui</span>
            <span className="font-display text-lg font-bold">{formatRupiah(totalApproved)}</span>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Catatan Admin</label>
            <Textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Catatan admin (opsional)..."
              rows={2}
            />
          </div>

          {/* Footer 4 tombol */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              onClick={() => void handleSave(false)}
              disabled={saving}
              className="bg-success text-white hover:bg-success/90"
            >
              <Icon name="floppy-disks" size={16} />
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
            <Button
              onClick={() => void handleSave(true)}
              disabled={saving}
              className="bg-info text-white hover:bg-info/90"
            >
              <Icon name="paper-plane" size={16} />
              Kirim Email
            </Button>
            <Button
              variant="outline"
              onClick={handlePrintForm}
              disabled={saving}
            >
              <Icon name="file" size={16} />
              Print Form
            </Button>
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              <Icon name="circle-xmark" size={16} />
              Tutup
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PrintFormModal
        open={printOpen}
        title={`Preview Form Order — ${order.ORDER_ID}`}
        orderId={order.ORDER_ID}
        idCabang={String(order.ID_CABANG || '')}
        tanggalCetak={parseAnyDate(order.TANGGAL_ORDER ?? '') ?? new Date()}
        nomorOrder={String(order.NOMOR_ORDER || '') || getSequentialNumber(order, allOrders)}
        items={printItems}
        stokLookup={(kode) => {
          const b = katalog.find(
            (x) => String(x.KODE_BARANG).trim().toUpperCase() === String(kode).trim().toUpperCase(),
          );
          return b ? toInt(b.STOK) : undefined;
        }}
        onClose={() => setPrintOpen(false)}
      />

      {dialog}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────
   MAIN PAGE
   ───────────────────────────────────────────────────────────────────── */

type DashboardTab = 'dashboard' | 'orders' | 'katalog' | 'cabang';

export default function Dashboard() {
  const { session } = useAuth();
  const { confirm, prompt, dialog } = useDialog();
  const [tab, setTab] = useState<DashboardTab>('dashboard');
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [katalogList, setKatalogList] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('ALL');
  const [katalogSearch, setKatalogSearch] = useState('');
  const [katalogCategory, setKatalogCategory] = useState('');
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [dataNotice, setDataNotice] = useState('');
  const lastLoadRef = useRef(0);

  type ApiResultType = Awaited<ReturnType<typeof orders.getAll>>;
  const applyOrders = useCallback((r: ApiResultType) => {
    if (r.status === 'ok' && Array.isArray(r.data)) {
      setOrdersList(r.data as Order[]);
      setDataNotice('');
    } else if (r.status !== 'ok') {
      setDataNotice(String(r.message || 'Gagal memuat order.'));
    }
  }, []);
  const applyKatalog = useCallback((r: ApiResultType) => {
    if (r.status === 'ok' && Array.isArray(r.data)) setKatalogList(r.data as Barang[]);
  }, []);

  // Muat instan: pakai cache localStorage/mem dulu (stale-while-revalidate),
  // refresh background otomatis via getAllFast. Order render dulu, katalog menyusul.
  const loadFast = useCallback(async () => {
    if (Date.now() - lastLoadRef.current < SETTINGS.throttleMs) return;
    lastLoadRef.current = Date.now();
    try {
      const o = await orders.getAllFast(applyOrders);
      applyOrders(o);
      setLoading(false);
      const k = await katalog.getAllFast(applyKatalog);
      applyKatalog(k);
    } catch (e) {
      setLoading(false);
      // Simpan data lama tetap tampil; beri tahu user kalau refresh gagal
      setOrdersList((prev) => {
        if (prev.length === 0) setDataNotice('Gagal memuat data. Periksa koneksi, lalu tekan Muat Ulang.');
        return prev;
      });
      setDataNotice((cur) => (cur ? cur : 'Gagal memperbarui data. Menampilkan data tersimpan.'));
      console.warn('[Dashboard] loadFast error:', (e as Error).message);
    }
  }, [applyOrders, applyKatalog]);

  // Muat paksa dari server (tombol Muat Ulang / setelah aksi tulis)
  const loadFresh = useCallback(
    async (showToast = false) => {
      setRefreshing(true);
      try {
        const o = await orders.getAll({ cache: false });
        applyOrders(o);
        const k = await katalog.getAll({ cache: false });
        applyKatalog(k);
        if (showToast) toastSuccess('Data berhasil dimuat ulang.');
      } catch (e) {
        setDataNotice((cur) => cur || 'Gagal memperbarui data. Menampilkan data tersimpan.');
        toastError('Gagal memuat data: ' + (e as Error).message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyOrders, applyKatalog],
  );

  useEffect(() => {
    void loadFast();
  }, [loadFast]);

  // Auto refresh dengan visibility change
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (!document.hidden) void loadFast();
      }, SETTINGS.autoRefreshMs);
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } else {
        void loadFast();
        start();
      }
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (timer) clearInterval(timer);
    };
  }, [loadFast]);

  // Hash routing antar tab + back/forward
  useEffect(() => {
    const h0 = window.location.hash.replace('#', '');
    if (['dashboard', 'orders', 'katalog', 'cabang'].includes(h0)) {
      setTab(h0 as DashboardTab);
    }
    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      if (['dashboard', 'orders', 'katalog', 'cabang'].includes(h)) {
        setTab(h as DashboardTab);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const goTab = (t: DashboardTab) => {
    setTab(t);
    window.location.hash = t;
  };

  // Shortcut keyboard: Ctrl+R refresh, Ctrl+K search, Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r' && !e.shiftKey) {
        e.preventDefault();
        void loadFresh(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        document.getElementById('orderSearch')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loadFresh]);

  const pendingCount = useMemo(
    () => ordersList.filter((o) => String(o.STATUS || '').toUpperCase() === 'PENDING').length,
    [ordersList],
  );

  const pendingOrders = useMemo(
    () =>
      ordersList
        .filter((o) => String(o.STATUS || '').toUpperCase() === 'PENDING')
        .slice(0, 5),
    [ordersList],
  );

  const donut = useMemo(() => {
    const count = (s: string) =>
      ordersList.filter((o) => String(o.STATUS || '').toUpperCase() === s).length;
    return {
      total: ordersList.length,
      approved: count('APPROVED'),
      pending: count('PENDING'),
      rejected: count('REJECTED'),
    };
  }, [ordersList]);

  const perCabangStacked = useMemo(
    () =>
      Object.keys(CABANG).map((id) => {
        const o = ordersList.filter((x) => String(x.ID_CABANG || '').toUpperCase() === id);
        return {
          id,
          pic: CABANG[id].pic,
          pending: o.filter((x) => String(x.STATUS || '').toUpperCase() === 'PENDING').length,
          approved: o.filter((x) => String(x.STATUS || '').toUpperCase() === 'APPROVED').length,
          rejected: o.filter((x) => String(x.STATUS || '').toUpperCase() === 'REJECTED').length,
        };
      }),
    [ordersList],
  );
  const maxCabangStacked = Math.max(
    1,
    ...perCabangStacked.map((c) => c.pending + c.approved + c.rejected),
  );

  const activityFeed = useMemo(
    () =>
      [...ordersList]
        .map((o) => ({
          order: o,
          sortKey: parseAnyDate(o.TANGGAL_ORDER ?? '')?.getTime() ?? 0,
        }))
        .sort((a, b) => b.sortKey - a.sortKey)
        .slice(0, 6)
        .map((x) => x.order),
    [ordersList],
  );

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return ordersList.filter((o) => {
      const statusOk = orderFilter === 'ALL' || String(o.STATUS || '').toUpperCase() === orderFilter;
      if (!statusOk) return false;
      if (!q) return true;
      return (
        String(o.ORDER_ID || '').toLowerCase().includes(q) ||
        String(o.ID_CABANG || '').toLowerCase().includes(q)
      );
    });
  }, [ordersList, orderSearch, orderFilter]);

  const katalogCategories = useMemo(
    () =>
      [...new Set(katalogList.map((b) => String(b.KATEGORI || '').trim()).filter(Boolean))].sort(),
    [katalogList],
  );

  const filteredKatalog = useMemo(() => {
    const q = katalogSearch.trim().toLowerCase();
    return katalogList.filter((b) => {
      if (katalogCategory && String(b.KATEGORI || '').trim() !== katalogCategory) return false;
      if (!q) return true;
      return (
        String(b.KODE_BARANG || '').toLowerCase().includes(q) ||
        String(b.NAMA_BARANG || '').toLowerCase().includes(q)
      );
    });
  }, [katalogList, katalogSearch, katalogCategory]);

  const katalogStats = useMemo(() => {
    const empty = katalogList.filter((b) => toInt(b.STOK) === 0).length;
    const low = katalogList.filter((b) => toInt(b.STOK) > 0 && toInt(b.STOK) <= 5).length;
    return { total: katalogList.length, empty, low, ok: katalogList.length - empty - low };
  }, [katalogList]);

  // Quick approve/reject dengan optimistic update + rollback
  const doUpdateStatus = useCallback(
    async (order: Order, status: 'APPROVED' | 'REJECTED', alasan: string) => {
      const orderId = String(order.ORDER_ID);
      const prev = String(order.STATUS || 'PENDING');
      setOrdersList((list) =>
        list.map((o) => (String(o.ORDER_ID) === orderId ? { ...o, STATUS: status } : o)),
      );
      toast.info('Memproses...');
      try {
        const result = await orders.updateStatus({ orderId, status, alasan });
        if (result.status === 'ok') {
          toastSuccess(status === 'APPROVED' ? 'Order disetujui!' : 'Order ditolak.');
          void loadFresh();
        } else {
          setOrdersList((list) =>
            list.map((o) => (String(o.ORDER_ID) === orderId ? { ...o, STATUS: prev } : o)),
          );
          toastError(String(result.message || 'Gagal.'));
        }
      } catch (e) {
        setOrdersList((list) =>
          list.map((o) => (String(o.ORDER_ID) === orderId ? { ...o, STATUS: prev } : o)),
        );
        toastError((e as Error).message);
      }
    },
    [loadFresh],
  );

  const quickApprove = async (order: Order) => {
    const cabang = CABANG[String(order.ID_CABANG || '')];
    const ok = await confirm({
      icon: '✅',
      title: 'Setujui Pesanan?',
      message: `Order ${order.ORDER_ID}\nCabang: ${cabang ? `${cabang.nama} (${cabang.pic})` : order.ID_CABANG}\n\nSemua item akan disetujui. Email akan dikirim ke cabang.`,
      okText: 'Ya, Setujui',
      okVariant: 'secondary',
    });
    if (ok) void doUpdateStatus(order, 'APPROVED', '');
  };

  const quickReject = async (order: Order) => {
    const cabang = CABANG[String(order.ID_CABANG || '')];
    const alasan = await prompt({
      icon: '❌',
      title: 'Tolak Seluruh Pesanan',
      message: `Order ${order.ORDER_ID}\nCabang: ${cabang ? `${cabang.nama} (${cabang.pic})` : order.ID_CABANG}\n\nIsi alasan penolakan:`,
      placeholder: 'Contoh: Stok habis...',
      okText: 'Ya, Tolak',
      okVariant: 'destructive',
      required: true,
    });
    if (alasan === null) return;
    void doUpdateStatus(order, 'REJECTED', typeof alasan === 'string' ? alasan : '');
  };

  const stokTone = (stok: number) => {
    if (stok <= 0) return 'text-danger font-bold';
    if (stok <= 5) return 'text-warning font-bold';
    return 'text-success font-bold';
  };
  const stokLabel = (stok: number) => {
    if (stok <= 0) return 'Habis';
    if (stok <= 5) return `Sisa ${stok}`;
    return String(stok);
  };

  const statCards = [
    {
      label: 'Total Order',
      sub: 'Semua pesanan masuk',
      value: ordersList.length,
      icon: <Icon name="package" size={20} className="text-brand" />,
      tone: 'bg-brand/15 text-brand',
    },
    {
      label: 'Menunggu',
      sub: 'Perlu persetujuan',
      value: donut.pending,
      icon: <Icon name="clock" size={20} className="text-warning" />,
      tone: 'bg-warning/15 text-warning',
    },
    {
      label: 'Disetujui',
      sub: 'Pesanan berhasil',
      value: donut.approved,
      icon: <Icon name="check-circle" size={20} className="text-success" />,
      tone: 'bg-success/15 text-success',
    },
    {
      label: 'Ditolak',
      sub: 'Pesanan ditolak',
      value: donut.rejected,
      icon: <Icon name="circle-xmark" size={20} className="text-danger" />,
      tone: 'bg-danger/15 text-danger',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Icon name="sparkles" size={24} className="text-brand" />
            Selamat datang, {session?.nama || session?.username || 'Admin'}!
          </h1>
          <p className="text-sm text-muted-foreground">
            Ringkasan operasional PT Central Perabot Utama hari ini · <LiveClock />
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge className="gap-1 bg-warning text-white">
              <Icon name="clock" size={12} /> {pendingCount} pending
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => void loadFresh(true)} disabled={refreshing}>
            <Icon name="refresh" size={16} className={refreshing ? 'animate-spin' : undefined} />
            Muat Ulang
          </Button>
        </div>
      </div>

      {pendingCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
          <Icon name="triangle-warning" size={16} className="shrink-0" />
          {pendingCount} pesanan menunggu verifikasi.
        </div>
      )}

      {dataNotice && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
          <Icon name="triangle-warning" size={16} className="shrink-0" />
          {dataNotice}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(
          [
            ['dashboard', 'Dashboard', 'grid'],
            ['orders', 'Semua Pesanan', 'package'],
            ['katalog', 'Katalog Barang', 'boxes'],
            ['cabang', 'Status Cabang', 'store'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => goTab(id)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === id
                ? 'border-brand text-brand'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB: DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statCards.map((s) => (
              <button
                key={s.label}
                onClick={() => goTab('orders')}
                className="text-left transition-transform hover:-translate-y-0.5"
              >
                <Card className="h-full">
                  <CardContent className="flex items-center gap-3 p-4">
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', s.tone)}>
                      {s.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="text-2xl font-bold leading-none">
                        {loading ? '–' : s.value}
                      </div>
                      <div className="mt-1 truncate text-xs font-medium">{s.label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{s.sub}</div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            {/* Order menunggu */}
            <Card className="lg:col-span-3">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Icon name="clock" size={16} className="text-warning" />
                    Order Menunggu Persetujuan
                  </h2>
                  <button
                    onClick={() => goTab('orders')}
                    className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                  >
                    Lihat Semua <Icon name="arrow-right" size={14} />
                  </button>
                </div>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : pendingOrders.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Icon name="check-circle" size={40} className="text-success" />
                    Semua order sudah diproses!
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted-foreground">
                          <th className="pb-2">ID</th>
                          <th className="pb-2">Cabang</th>
                          <th className="pb-2 text-center">Item</th>
                          <th className="pb-2 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingOrders.map((o) => (
                          <tr key={String(o.ORDER_ID)} className="border-b border-border/60 last:border-0">
                            <td className="py-2.5 font-mono text-xs font-bold">{o.ORDER_ID}</td>
                            <td className="py-2.5">
                              <span className="flex items-center gap-1.5">
                                <Icon name="shop" size={14} className="text-brand" />
                                {CABANG[String(o.ID_CABANG)]?.pic || '-'}
                              </span>
                            </td>
                            <td className="py-2.5 text-center">{((o.DETAIL as unknown[]) || []).length}</td>
                            <td className="py-2.5">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="outline" className="h-8 w-8 text-success" title="Setujui" onClick={() => void quickApprove(o)}>
                                  <Icon name="check" size={16} />
                                </Button>
                                <Button size="icon" variant="outline" className="h-8 w-8 text-danger" title="Tolak" onClick={() => void quickReject(o)}>
                                  <Icon name="circle-xmark" size={16} />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditOrder(o)}>
                                  <Icon name="edit" size={14} />
                                  Kelola
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Donut */}
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <span className="text-brand">◔</span> Status Order
                </h2>
                <DonutChart
                  segments={[
                    { label: 'Disetujui', value: donut.approved, color: '#22c55e' },
                    { label: 'Tertunda', value: donut.pending, color: '#f59e0b' },
                    { label: 'Ditolak', value: donut.rejected, color: '#ef4444' },
                  ]}
                  total={donut.total}
                />
              </CardContent>
            </Card>

            {/* Stacked bar chart per cabang */}
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                  <Icon name="chart-histogram" size={16} className="text-brand" />
                  Pesanan per Cabang
                </h2>
                <StackedBarChart data={perCabangStacked} max={maxCabangStacked} />
                <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-3 rounded-sm bg-success" /> Disetujui
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-3 rounded-sm bg-warning" /> Tertunda
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-2 w-3 rounded-sm bg-danger" /> Ditolak
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Activity feed */}
            <Card className="lg:col-span-2">
              <CardContent className="p-4">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  Aktivitas Terbaru
                </h2>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : activityFeed.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">Belum ada aktivitas</div>
                ) : (
                  <div className="space-y-2">
                    {activityFeed.map((o) => {
                      const st = String(o.STATUS || 'PENDING').toUpperCase();
                      const dot = st === 'PENDING' ? 'bg-warning' : st === 'APPROVED' ? 'bg-success' : st === 'REJECTED' ? 'bg-danger' : 'bg-info';
                      return (
                        <div key={String(o.ORDER_ID)} className="flex items-start gap-2 text-sm">
                          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dot)} />
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-xs font-bold">{o.ORDER_ID}</span>{' '}
                            <span className="text-muted-foreground">
                              dari {CABANG[String(o.ID_CABANG)]?.pic || '-'} · {o.ID_CABANG}
                            </span>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatWita(o.TANGGAL_ORDER)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Laporan & Grafik (line chart + periode atur per chart) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Icon name="chart-line-up" size={18} className="text-brand" />
              <h2 className="font-display text-lg font-bold">Laporan & Grafik</h2>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <LineChartCard
                title="Tren Order"
                icon="chart-line-up"
                series={ORDER_SERIES}
                classify={classifyByStatus}
                orders={ordersList}
                loading={loading}
              />
              <LineChartCard
                title="Tren per Cabang"
                icon="chart-connected"
                series={CABANG_SERIES}
                classify={classifyByCabang}
                orders={ordersList}
                loading={loading}
              />
              <LineChartCard
                title="Tren Nilai Order"
                icon="chart-mixed"
                series={[{ key: 'nilai', label: 'Nilai (Rp)', color: '#22c55e' }]}
                classify={classifyNilai}
                format={fmtRpCompact}
                orders={ordersList}
                loading={loading}
              />
              <LineChartCard
                title="Tren Produk"
                icon="chart-scatter"
                series={[{ key: 'qty', label: 'Jumlah Barang', color: '#8b5cf6' }]}
                classify={classifyQty}
                orders={ordersList}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB: ORDERS */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-52 flex-1">
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="orderSearch"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Cari ID atau cabang..."
                className="pl-9"
              />
            </div>
            <div className="flex gap-1">
              {(
                [
                  ['ALL', 'Semua'],
                  ['PENDING', 'Tertunda'],
                  ['APPROVED', 'Disetujui'],
                  ['REJECTED', 'Ditolak'],
                ] as const
              ).map(([val, label]) => (
                <Button
                  key={val}
                  size="sm"
                  variant={orderFilter === val ? 'default' : 'outline'}
                  onClick={() => setOrderFilter(val)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada order yang cocok dengan filter.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="p-3">#</th>
                    <th className="p-3">ID</th>
                    <th className="p-3">Cabang</th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o, i) => {
                    const st = String(o.STATUS || 'PENDING').toUpperCase();
                    return (
                      <tr key={String(o.ORDER_ID)} className="border-b border-border/60 last:border-0">
                        <td className="p-3 text-muted-foreground">{i + 1}</td>
                        <td className="p-3 font-mono text-xs font-bold">{o.ORDER_ID}</td>
                        <td className="p-3">
                          <span className="flex items-center gap-1.5">
                            <Icon name="shop" size={14} className="text-brand" />
                            {CABANG[String(o.ID_CABANG)]?.pic || '-'}
                          </span>
                        </td>
                        <td className="whitespace-nowrap p-3">{formatWita(o.TANGGAL_ORDER)}</td>
                        <td className="p-3">
                          <StatusBadge status={st} />
                        </td>
                        <td className="p-3">
                          <div className="flex justify-end gap-1">
                            {st === 'PENDING' && (
                              <>
                                <Button size="icon" variant="outline" className="h-8 w-8 text-success" title="Setujui" onClick={() => void quickApprove(o)}>
                                  <Icon name="check" size={16} />
                                </Button>
                                <Button size="icon" variant="outline" className="h-8 w-8 text-danger" title="Tolak" onClick={() => void quickReject(o)}>
                                  <Icon name="circle-xmark" size={16} />
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="outline" onClick={() => setEditOrder(o)}>
                              <Icon name="edit" size={14} />
                              Kelola
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: KATALOG */}
      {tab === 'katalog' && (
        <div className="space-y-4">
          <div className="relative">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={katalogSearch}
              onChange={(e) => setKatalogSearch(e.target.value)}
              placeholder="Cari kode atau nama barang..."
              className="pl-9"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setKatalogCategory('')}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                katalogCategory === '' ? 'border-brand bg-brand text-white' : 'border-border hover:border-brand/50',
              )}
            >
              Semua Kategori
            </button>
            {katalogCategories.map((k) => (
              <button
                key={k}
                onClick={() => setKatalogCategory(k)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  katalogCategory === k ? 'border-brand bg-brand text-white' : 'border-border hover:border-brand/50',
                )}
              >
                {k}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Total Barang', value: katalogStats.total, icon: <Icon name="package" size={16} />, cls: 'bg-brand/15 text-brand' },
              { label: 'Stok Aman', value: katalogStats.ok, icon: <Icon name="check-circle" size={16} />, cls: 'bg-success/15 text-success' },
              { label: 'Stok Menipis', value: katalogStats.low, icon: <Icon name="triangle-warning" size={16} />, cls: 'bg-warning/15 text-warning' },
              { label: 'Stok Habis', value: katalogStats.empty, icon: <Icon name="circle-xmark" size={16} />, cls: 'bg-danger/15 text-danger' },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="flex items-center gap-2 p-3">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', s.cls)}>{s.icon}</span>
                  <div>
                    <div className="text-lg font-bold leading-none">{s.value}</div>
                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredKatalog.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Tidak ada barang yang cocok.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="p-3">#</th>
                    <th className="p-3">Kode</th>
                    <th className="p-3">Nama</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Satuan</th>
                    <th className="p-3 text-right">Harga</th>
                    <th className="p-3 text-right">Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKatalog.map((b, i) => (
                    <tr key={String(b.KODE_BARANG)} className="border-b border-border/60 last:border-0">
                      <td className="p-3 text-muted-foreground">{i + 1}</td>
                      <td className="p-3 font-mono text-xs font-bold">{b.KODE_BARANG}</td>
                      <td className="max-w-64 truncate p-3">{b.NAMA_BARANG}</td>
                      <td className="p-3">{b.KATEGORI || '-'}</td>
                      <td className="p-3">{b.SATUAN || '-'}</td>
                      <td className="p-3 text-right font-bold text-brand">{formatRupiah(toNum(b.HARGA))}</td>
                      <td className={cn('p-3 text-right', stokTone(toInt(b.STOK)))}>
                        {stokLabel(toInt(b.STOK))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: CABANG */}
      {tab === 'cabang' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Object.values(CABANG).map((cb) => {
            const branchOrders = ordersList.filter(
              (o) => String(o.ID_CABANG || '').toUpperCase() === cb.id,
            );
            const pending = branchOrders.filter(
              (o) => String(o.STATUS || '').toUpperCase() === 'PENDING',
            ).length;
            const approved = branchOrders.filter(
              (o) => String(o.STATUS || '').toUpperCase() === 'APPROVED',
            ).length;
            const rejected = branchOrders.filter(
              (o) => String(o.STATUS || '').toUpperCase() === 'REJECTED',
            ).length;
            return (
              <Card key={cb.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div
                    className="flex items-center gap-3 p-4"
                    style={{ background: `linear-gradient(135deg, ${cb.color}, ${cb.color}22)` }}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white">
                      <Icon name="shop" size={20} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold text-white">{cb.nama}</div>
                      <div className="text-xs text-white/80">
                        {cb.id} · PIC: {cb.pic}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-border p-3 text-center">
                    <div>
                      <div className="text-lg font-bold">{branchOrders.length}</div>
                      <div className="text-[11px] text-muted-foreground">Total</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-warning">{pending}</div>
                      <div className="text-[11px] text-muted-foreground">Tertunda</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-success">{approved}</div>
                      <div className="text-[11px] text-muted-foreground">Disetujui</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Icon name="phone-call" size={12} /> {cb.telepon || '-'}
                    </span>
                    <span className="flex items-center gap-1 text-danger">
                      <Icon name="circle-xmark" size={12} /> {rejected} ditolak
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <EditModal
        order={editOrder}
        katalog={katalogList}
        allOrders={ordersList}
        sessionName={session?.nama || session?.username || ''}
        onClose={() => setEditOrder(null)}
        onSaved={() => void loadFresh()}
      />

      {dialog}
    </div>
  );
}