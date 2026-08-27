import { Icon } from '../components/ui/icon';
import { useGambar } from '@/components/ItemPhoto';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { toastError, toastSuccess } from '@/lib/toast';

import { katalog as katalogApi, orders as ordersApi, cart as cartApi, callApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  APP,
  CABANG,
  KATEGORI_MANUAL,
  SATUAN_OPTIONS,
  getKategoriIcon,
  getStatusInfo,
  type Barang,
  type Order,
  type DetailItem,
} from '@/lib/config';
import {
  cn,
  formatRupiah,
  formatWita,
  parseAnyDate,
  getSequentialNumber,
  toInt,
  cleanCatatan,
  chunkArray,
  formatTanggalCetak,
  downloadJpgPages,
} from '@/lib/utils';
import { useDialog } from '@/lib/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ParticlesBg } from '@/components/ui/particles-bg';
import PrintFormModal, { type PrintItem } from '@/components/print-form';

const ITEMS_PER_PAGE = 40;
const PRINT_ITEMS_PER_PAGE = 20;
const CART_STORAGE_KEY = 'gudanghub_cart';

interface CartItem {
  kode: string;
  nama: string;
  kategori: string;
  qty: number;
  satuan: string;
  harga: number;
  stokSistem: number | '';
  stokGudang: number | '';
  stokToko: number | '';
  isManual?: boolean;
  catatanItem?: string;
}

function cartStorageKey(username: string): string {
  const u = String(username || '').toLowerCase();
  return u ? `${CART_STORAGE_KEY}_${u}` : CART_STORAGE_KEY;
}

function loadCartLocal(username: string): Record<string, CartItem> {
  try {
    const raw = localStorage.getItem(cartStorageKey(username));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CartItem>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, CartItem> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!v || typeof v !== 'object') continue;
      out[k] = {
        kode: String(v.kode || k),
        nama: String(v.nama || ''),
        kategori: String(v.kategori || ''),
        qty: Math.max(1, toInt(v.qty) || 1),
        satuan: String(v.satuan || 'PCS'),
        harga: Number(v.harga) || 0,
        stokSistem: v.stokSistem !== undefined && v.stokSistem !== '' ? toInt(v.stokSistem) : '',
        stokGudang: v.stokGudang !== undefined && v.stokGudang !== '' ? toInt(v.stokGudang) : '',
        stokToko: v.stokToko !== undefined && v.stokToko !== '' ? toInt(v.stokToko) : '',
        isManual: Boolean(v.isManual),
        catatanItem: String(v.catatanItem || ''),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function saveCartLocal(username: string, cart: Record<string, CartItem>): void {
  try {
    localStorage.setItem(cartStorageKey(username), JSON.stringify(cart || {}));
  } catch {
    /* storage penuh */
  }
}

function isEmpty(value: number | ''): boolean {
  return value === '' || value === undefined || value === null;
}

function fmtStock(v: number | ''): string {
  return v === '' ? '' : String(v);
}

/* ═══════════════════════════════════════════════════════════════════
   PRODUCT CARD (dengan gambar + fallback + hover)
   ═══════════════════════════════════════════════════════════════════ */

function ProductImage({ kode, nama, kategori }: { kode: string; nama: string; kategori: string }) {
  const [failed, setFailed] = useState(false);
  const [hoverFailed, setHoverFailed] = useState(false);
  // Prioritas: gambar upload admin (Sheet) → fallback gambar statis images/produk
  const { src: sheetSrc, ref } = useGambar(String(kode).toUpperCase());

  if (sheetSrc) {
    return (
      <div ref={ref} className="relative h-full w-full overflow-hidden bg-muted/30">
        <img
          src={sheetSrc}
          alt={nama}
          className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    );
  }

  const src = `./images/produk/${String(kode).toUpperCase()}.webp`;
  const hoverSrc = src.replace('.webp', '_2.webp');

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/40 text-4xl">
        {getKategoriIcon(kategori)}
      </div>
    );
  }
  return (
    <div ref={ref} className="relative h-full w-full overflow-hidden bg-muted/30">
      <img
        src={src}
        alt={nama}
        loading="lazy"
        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
        onError={() => setFailed(true)}
      />
      {!hoverFailed && (
        <img
          src={hoverSrc}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-contain opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          onError={() => setHoverFailed(true)}
        />
      )}
    </div>
  );
}

function ProductCard({
  product,
  inCart,
  cartQty,
  cartSatuan,
  onAdd,
  onIncrease,
  onDecrease,
  onSetQty,
  onSetSatuan,
}: {
  product: Barang;
  inCart: boolean;
  cartQty: number;
  cartSatuan: string;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
  onSetQty: (qty: number) => void;
  onSetSatuan: (satuan: string) => void;
}) {
  const kode = String(product.KODE_BARANG || '');
  const nama = String(product.NAMA_BARANG || '');
  const kategori = String(product.KATEGORI || '');
  const unit = String(product.SATUAN || 'PCS').toUpperCase();
  const harga = Number(product.HARGA) || 0;
  const stock = toInt(product.STOK);
  const [qtyInput, setQtyInput] = useState(inCart ? cartQty : 1);

  useEffect(() => {
    setQtyInput(inCart ? cartQty : 1);
  }, [inCart, cartQty, kode]);

  const stockCls = stock === 0 ? 'bg-danger/15 text-danger' : stock <= 5 ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success';
  const stockText = stock === 0 ? 'Habis' : stock <= 5 ? `Sisa ${stock}` : `Stok: ${stock}`;

  return (
    <article
      className={cn(
        'group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-shadow hover:shadow-md',
        inCart && 'border-brand/60 ring-1 ring-brand/30',
      )}
    >
      <span className={cn('absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold', stockCls)}>
        {stockText}
      </span>
      <div className="h-24 w-full">
        <ProductImage kode={kode} nama={nama} kategori={kategori} />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[11px] font-bold tracking-wide text-muted-foreground">{kode}</div>
        <div className="line-clamp-2 min-h-10 text-sm font-semibold leading-tight">{nama}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">{kategori}</div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-brand">{formatRupiah(harga)}</span>
        <span className="text-[11px] text-muted-foreground">per {unit}</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={onDecrease}
          aria-label="Kurangi"
        >
          <Icon name="minus" size={14} />
        </Button>
        <Input
          type="number"
          min={1}
          value={qtyInput}
          onChange={(e) => {
            const v = Math.max(1, toInt(e.target.value) || 1);
            setQtyInput(v);
            onSetQty(v);
          }}
          className="h-7 w-12 px-1 text-center text-sm"
        />
        <Button variant="outline" size="icon" className="h-7 w-7" onClick={onIncrease} aria-label="Tambah qty">
          <Icon name="plus" size={14} />
        </Button>
      </div>

      <div className="flex items-center gap-1 text-[11px]">
        <span className="text-muted-foreground">Satuan:</span>
        <select
          value={cartSatuan}
          onChange={(e) => onSetSatuan(e.target.value)}
          className="h-7 flex-1 rounded-md border border-input bg-background px-1 text-xs"
        >
          {SATUAN_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <Button size="sm" variant={inCart ? 'secondary' : 'default'} onClick={onAdd} disabled={!inCart && stock <= 0}>
        {inCart ? (
          <>
            <Icon name="check" size={16} /> Di Keranjang
          </>
        ) : (
          <>
            <Icon name="plus" size={16} /> Tambah
          </>
        )}
      </Button>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MANUAL BARANG FORM (tambah / edit / daftar)
   ═══════════════════════════════════════════════════════════════════ */

function ManualForm({
  editingKey,
  cart,
  onAdd,
  onUpdate,
  onDelete,
  onStartEdit,
  onCancelEdit,
}: {
  editingKey: string | null;
  cart: Record<string, CartItem>;
  onAdd: (data: { nama: string; kode: string; kategori: string; qty: number; satuan: string; stokGudang: number | ''; stokToko: number | '' }) => void;
  onUpdate: (key: string, data: { nama: string; kategori: string; qty: number; satuan: string; stokGudang: number | ''; stokToko: number | '' }) => void;
  onDelete: (key: string) => void;
  onStartEdit: (key: string) => void;
  onCancelEdit: () => void;
}) {
  const isEditing = editingKey !== null;
  const editItem = isEditing ? cart[editingKey] : null;

  const [nama, setNama] = useState(editItem?.nama || '');
  const [kode, setKode] = useState(editItem ? editItem.kode === '-' ? '' : editItem.kode : '');
  const [kategori, setKategori] = useState(editItem?.kategori || KATEGORI_MANUAL[0]);
  const [qty, setQty] = useState(editItem?.qty || 1);
  const [satuan, setSatuan] = useState(editItem?.satuan || 'PCS');
  const [stokGudang, setStokGudang] = useState<string>(editItem ? fmtStock(editItem.stokGudang) : '');
  const [stokToko, setStokToko] = useState<string>(editItem ? fmtStock(editItem.stokToko) : '');

  useEffect(() => {
    setNama(editItem?.nama || '');
    setKode(editItem ? (editItem.kode === '-' ? '' : editItem.kode) : '');
    setKategori(editItem?.kategori || KATEGORI_MANUAL[0]);
    setQty(editItem?.qty || 1);
    setSatuan(editItem?.satuan || 'PCS');
    setStokGudang(editItem ? fmtStock(editItem.stokGudang) : '');
    setStokToko(editItem ? fmtStock(editItem.stokToko) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingKey]);

  const manualItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, v]) => v.isManual)
        .map(([k, v]) => ({ key: k, item: v })),
    [cart],
  );

  const submit = () => {
    const n = nama.trim();
    if (!n) {
      toastError('Nama barang wajib diisi.');
      return;
    }
    if (stokGudang.trim() === '' || stokToko.trim() === '') {
      toastError('Stok gudang dan stok toko wajib diisi.');
      return;
    }
    const sg = Math.max(0, toInt(stokGudang));
    const st = Math.max(0, toInt(stokToko));
    if (isEditing && editingKey) {
      onUpdate(editingKey, { nama: n, kategori, qty: Math.max(1, toInt(qty) || 1), satuan, stokGudang: sg, stokToko: st });
    } else {
      onAdd({ nama: n, kode: kode.trim(), kategori, qty: Math.max(1, toInt(qty) || 1), satuan, stokGudang: sg, stokToko: st });
      setNama('');
      setKode('');
      setQty(1);
      setStokGudang('');
      setStokToko('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
        <Icon name="triangle-warning" size={16} className="mt-0.5 shrink-0" />
        <div>
          <b>Barang Manual</b> — untuk barang baru yang belum ada di katalog. Harga otomatis Rp 0.
        </div>
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold">{isEditing ? '✏️ Edit Barang Manual' : '➕ Tambah Barang Manual'}</div>
            {isEditing && (
              <Button variant="ghost" size="sm" onClick={onCancelEdit}>
                <Icon name="circle-xmark" size={16} /> Batal Edit
              </Button>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium">
              Nama Barang <span className="text-danger">*</span>
            </label>
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Contoh: Wajan Anti Lengket 30cm" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">Kode Barang (opsional)</label>
              <Input
                value={kode}
                onChange={(e) => setKode(e.target.value)}
                placeholder="Kosongkan atau isi - atau 0"
                disabled={isEditing}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Kategori</label>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {KATEGORI_MANUAL.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">
                Jumlah <span className="text-danger">*</span>
              </label>
              <Input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, toInt(e.target.value) || 1))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Satuan</label>
              <select
                value={satuan}
                onChange={(e) => setSatuan(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {SATUAN_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium">
                <Icon name="warehouse-alt" size={12} className="mr-1 inline" /> Stok Gudang <span className="text-danger">*</span>
              </label>
              <Input type="number" min={0} value={stokGudang} onChange={(e) => setStokGudang(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">
                <Icon name="shop" size={12} className="mr-1 inline" /> Stok Toko <span className="text-danger">*</span>
              </label>
              <Input
                type="number"
                min={0}
                value={stokToko}
                onChange={(e) => setStokToko(e.target.value)}
                placeholder="0"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            </div>
          </div>

          <Button onClick={submit} className="w-full">
            {isEditing ? <SaveIcon /> : <Icon name="plus" size={16} />}
            {isEditing ? 'Simpan Perubahan' : 'Tambah ke Keranjang'}
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-sm font-bold">
        <Icon name="list" size={16} className="text-brand" /> Barang Manual di Keranjang
        {manualItems.length > 0 && (
          <Badge variant="outline" className="bg-warning/15 text-warning">
            {manualItems.length} barang manual
          </Badge>
        )}
      </div>

      {manualItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Belum ada barang manual di keranjang.
        </div>
      ) : (
        <div className="space-y-2">
          {manualItems.map(({ key, item }) => (
            <div
              key={key}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3',
                editingKey === key && 'border-warning/60 bg-warning/5',
              )}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
                  <Icon name="edit" size={16} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{item.nama}</div>
                  <div className="text-xs text-muted-foreground">
                    Kode: {item.kode} · {item.kategori} · {item.qty} {item.satuan}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    <Icon name="warehouse-alt" size={12} className="mr-0.5 inline" /> Gudang: <b>{item.stokGudang}</b> ·{' '}
                    <Icon name="shop" size={12} className="mr-0.5 inline" /> Toko: <b>{item.stokToko}</b>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onStartEdit(key)} title="Edit">
                  <Icon name="edit" size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-danger"
                  onClick={() => onDelete(key)}
                  title="Hapus"
                >
                  <Icon name="trash" size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SaveIcon() {
  return <Icon name="floppy-disks" size={16} />;
}

/* ═══════════════════════════════════════════════════════════════════
   CART SHEET (bottom sheet)
   ═══════════════════════════════════════════════════════════════════ */

function CartSheet({
  open,
  cart,
  onClose,
  onQty,
  onSetQty,
  onSetSatuan,
  onSetNote,
  onSetStock,
  onDelete,
  onSubmit,
  submitting,
}: {
  open: boolean;
  cart: Record<string, CartItem>;
  onClose: () => void;
  onQty: (key: string, delta: number) => void;
  onSetQty: (key: string, value: number) => void;
  onSetSatuan: (key: string, satuan: string) => void;
  onSetNote: (key: string, note: string) => void;
  onSetStock: (key: string, type: 'gudang' | 'toko', value: number | '') => void;
  onDelete: (key: string) => void;
  onSubmit: (note: string) => void;
  submitting: boolean;
}) {
  const items = useMemo(() => Object.values(cart), [cart]);
  const [cartNote, setCartNote] = useState('');
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (items.length === 0) setCartNote('');
  }, [items.length]);

  const gudangMissing = items.filter((i) => isEmpty(i.stokGudang)).length;
  const tokoMissing = items.filter((i) => isEmpty(i.stokToko)).length;
  const valid = items.length > 0 && gudangMissing === 0 && tokoMissing === 0;

  const total = items.reduce((s, i) => s + i.qty * i.harga, 0);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleNote = (key: string) => {
    setNoteOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <section
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col rounded-t-2xl border-t border-border bg-background shadow-2xl"
        aria-label="Keranjang order"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted" />
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Icon name="shopping-cart" size={16} className="text-brand" /> Keranjang Order
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Tutup">
            <Icon name="circle-xmark" size={16} />
          </Button>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Icon name="shopping-cart" size={40} className="mx-auto mb-2 text-muted" />
              <div>Keranjang kosong.</div>
              <div className="mt-1 text-xs">Tambahkan barang dari katalog dulu ya!</div>
            </div>
          ) : (
            items.map((item) => {
              const key = item.kode;
              const noteVisible = noteOpen[key] || Boolean(item.catatanItem);
              const stokSistem = item.stokSistem;
              const stokSistemCls =
                stokSistem === '' || stokSistem === 0
                  ? 'bg-danger/15 text-danger'
                  : stokSistem <= 5
                    ? 'bg-warning/15 text-warning'
                    : 'bg-success/15 text-success';
              return (
                <article key={key} className="rounded-xl border border-border bg-card p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {item.nama}
                      {item.catatanItem && (
                        <span className="ml-1 text-xs italic text-danger">({item.catatanItem})</span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {item.kode}
                      {!item.isManual && (
                        <span className={cn('rounded-full px-1.5 py-0.5 font-bold', stokSistemCls)}>
                          {stokSistem === '' || stokSistem === 0 ? 'Habis' : `Stok Sistem: ${stokSistem}`}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onQty(key, -1)}>
                          <Icon name="minus" size={12} />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => onSetQty(key, Math.max(1, toInt(e.target.value) || 1))}
                          className="h-7 w-14 px-1 text-center text-sm"
                        />
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onQty(key, 1)}>
                          <Icon name="plus" size={12} />
                        </Button>
                      </div>
                      <select
                        value={item.satuan}
                        onChange={(e) => onSetSatuan(key, e.target.value)}
                        className="h-7 rounded-md border border-input bg-background px-1 text-xs"
                      >
                        {SATUAN_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">× {formatRupiah(item.harga)}</span>
                      <span className="text-xs">=</span>
                      <span className="text-sm font-bold">{formatRupiah(item.qty * item.harga)}</span>
                    </div>

                    {noteVisible && (
                      <div className="mt-2 rounded-lg bg-muted/40 p-2">
                        <label className="mb-1 flex items-center gap-1 text-xs font-medium">
                          <Icon name="message-text" size={12} /> Catatan untuk barang ini:
                        </label>
                        <Input
                          value={item.catatanItem || ''}
                          onChange={(e) => onSetNote(key, e.target.value.slice(0, 80))}
                          placeholder="contoh: pesan warna merah"
                          maxLength={80}
                          autoFocus={noteOpen[key]}
                          className="h-8 text-sm"
                        />
                        <div className="mt-1 text-[10px] text-muted-foreground">
                          Max 80 karakter — akan muncul di form order ({item.catatanItem?.length || 0}/80)
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[10px] font-bold tracking-wide text-muted-foreground">ISI STOK AKTUAL</div>
                      <label
                        className={cn(
                          'flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1',
                          isEmpty(item.stokGudang) && 'border-danger/50',
                        )}
                        title="Stok Gudang"
                      >
                        <Icon name="warehouse-alt" size={12} className="text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Gudang"
                          value={fmtStock(item.stokGudang)}
                          onChange={(e) =>
                            onSetStock(key, 'gudang', e.target.value.trim() === '' ? '' : Math.max(0, toInt(e.target.value)))
                          }
                          className="h-7 w-20 px-1 text-sm"
                        />
                      </label>
                      <label
                        className={cn(
                          'flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1',
                          isEmpty(item.stokToko) && 'border-danger/50',
                        )}
                        title="Stok Toko"
                      >
                        <Icon name="shop" size={12} className="text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Toko"
                          value={fmtStock(item.stokToko)}
                          onChange={(e) =>
                            onSetStock(key, 'toko', e.target.value.trim() === '' ? '' : Math.max(0, toInt(e.target.value)))
                          }
                          className="h-7 w-20 px-1 text-sm"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn('h-8 w-8', noteVisible && 'text-brand')}
                        onClick={() => toggleNote(key)}
                        title="Tambah catatan"
                      >
                        <Icon name="message-text" size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-danger"
                        onClick={() => onDelete(key)}
                        title="Hapus"
                      >
                        <Icon name="trash" size={16} />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <div className="space-y-2 border-t border-border p-4">
          {!valid && items.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
              <Icon name="triangle-warning" size={14} className="mt-0.5 shrink-0" />
              <span>
                Wajib isi stok gudang ({gudangMissing} kosong) dan stok toko ({tokoMissing} kosong).
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Jumlah Item</span>
            <span className="font-semibold">{totalQty} item</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Order</span>
            <span className="text-lg font-bold text-brand">{formatRupiah(total)}</span>
          </div>
          <Textarea
            value={cartNote}
            onChange={(e) => setCartNote(e.target.value)}
            rows={2}
            placeholder="Catatan untuk admin (opsional)..."
          />
          <Button className="w-full" onClick={() => onSubmit(cartNote)} disabled={!valid || submitting}>
            <Icon name="paper-plane" size={16} />
            {submitting ? 'Mengirim...' : 'Kirim Order ke Gudang'}
          </Button>
        </div>
      </section>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PRE-ORDER DIALOG (nomor, tanggal, preview, JPG, kirim)
   ═══════════════════════════════════════════════════════════════════ */

interface PreOrderConfig {
  nomorOrder: string;
  tanggalOrder: Date;
}

function PreOrderDialog({
  open,
  items,
  branchId,
  ordersCache,
  onClose,
  onConfirm,
}: {
  open: boolean;
  items: CartItem[];
  branchId: string;
  ordersCache: Order[];
  onClose: () => void;
  onConfirm: (config: PreOrderConfig) => Promise<void>;
}) {
  const [nomorMode, setNomorMode] = useState<'auto' | 'manual'>('auto');
  const [nomorManual, setNomorManual] = useState('');
  const [tanggalMode, setTanggalMode] = useState<'today' | 'tomorrow' | 'custom'>('today');
  const [tanggalCustom, setTanggalCustom] = useState('');
  const [sending, setSending] = useState(false);
  const [jpgBusy, setJpgBusy] = useState(false);
  const [jpgProgress, setJpgProgress] = useState('');
  const previewRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const pages = useMemo(() => {
    const chunks = chunkArray(items, PRINT_ITEMS_PER_PAGE);
    return chunks.length ? chunks : [[]];
  }, [items]);

  useEffect(() => {
    if (!open) return;
    setNomorMode('auto');
    setNomorManual('');
    setTanggalMode('today');
    setTanggalCustom('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // Hanya reset saat dialog DIBUKA. JANGAN ikutkan onClose: parent melempar
    // arrow baru tiap render (saat submitting/optimistic), yang akan me-reset
    // nomor/tanggal manual yang sedang diisi saat klik "Kirim ke Gudang".
  }, [open]);

  const getNomorOrder = useCallback((): string => {
    if (nomorMode === 'manual') return nomorManual || '01';
    return getNextNomor(ordersCache);
  }, [nomorMode, nomorManual, ordersCache]);

  const getTanggalOrder = useCallback((): Date => {
    const date = new Date();
    if (tanggalMode === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    } else if (tanggalMode === 'custom' && tanggalCustom) {
      const parts = tanggalCustom.split('-');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return date;
  }, [tanggalMode, tanggalCustom]);

  const nomorOrder = getNomorOrder();
  const tanggalOrder = getTanggalOrder();

  const downloadJpg = async () => {
    if (!previewRef.current) return;
    setJpgBusy(true);
    try {
      const pageEls = Array.from(previewRef.current.querySelectorAll<HTMLElement>('.preorder-page'));
      if (!pageEls.length) return;
      const cabangId = branchId || 'CB';
      await downloadJpgPages(pageEls, `Form-Order-${cabangId}-No${nomorOrder}`, (done, total) => {
        setJpgProgress(`Proses ${done}/${total}...`);
      });
      toastSuccess('JPG berhasil diunduh.');
    } catch (err) {
      toastError('Gagal download JPG: ' + (err as Error).message);
    } finally {
      setJpgBusy(false);
      setJpgProgress('');
    }
  };

  const send = async () => {
    if (nomorMode === 'manual' && !nomorManual) {
      toastError('Nomor order manual wajib diisi.');
      return;
    }
    setSending(true);
    try {
      await onConfirm({ nomorOrder: getNomorOrder(), tanggalOrder: getTanggalOrder() });
      onClose();
    } catch (err) {
      toastError('Gagal mengirim: ' + (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const cabang = CABANG[branchId] || { nama: '-', pic: '-' };
  const pic = String(cabang.pic || 'SUPERVISOR').toUpperCase();
  const tgl = formatTanggalCetak(tanggalOrder);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !sending && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-[950px] overflow-y-auto bg-muted/40 p-0">
        <DialogHeader className="sticky top-0 z-10 flex flex-row items-center justify-between gap-2 rounded-t-lg border-b border-border bg-background px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Icon name="file" size={16} className="text-brand" /> Preview Form Order
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-success text-white hover:bg-success/90" onClick={() => void downloadJpg()} disabled={jpgBusy}>
              <Icon name="download" size={16} />
              {jpgProgress || (pages.length > 1 ? `Download ${pages.length} JPG` : 'Download JPG')}
            </Button>
            <Button size="sm" onClick={() => void send()} disabled={sending}>
              <Icon name="paper-plane" size={16} />
              {sending ? 'Mengirim...' : 'Kirim ke Gudang'}
            </Button>
          </div>
        </DialogHeader>

        <div className="p-4">
          <div className="mb-4 grid grid-cols-1 gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-brand">
                <span className="text-sm">#</span> Nomor Order Form
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(['auto', 'manual'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNomorMode(m)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold',
                      nomorMode === m ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground',
                    )}
                  >
                    {m === 'auto' ? 'Otomatis' : 'Manual'}
                  </button>
                ))}
              </div>
              {nomorMode === 'manual' ? (
                <Input
                  value={nomorManual}
                  onChange={(e) => setNomorManual(e.target.value)}
                  placeholder="Ketik nomor (contoh: 25)"
                  autoFocus
                />
              ) : (
                <div className="text-xs italic text-muted-foreground">Nomor akan di-generate otomatis dari sistem</div>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-brand">
                <Icon name="calendar" size={14} /> Tanggal Form
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(['today', 'tomorrow', 'custom'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setTanggalMode(m)}
                    className={cn(
                      'rounded-lg border px-3 py-1.5 text-xs font-semibold',
                      tanggalMode === m ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground',
                    )}
                  >
                    {m === 'today' ? 'Hari Ini' : m === 'tomorrow' ? 'Besok' : 'Pilih Tanggal'}
                  </button>
                ))}
              </div>
              {tanggalMode === 'custom' ? (
                <Input
                  type="date"
                  value={tanggalCustom}
                  onChange={(e) => setTanggalCustom(e.target.value)}
                  className="dark:[color-scheme:dark]"
                />
              ) : (
                <div className="text-xs italic text-muted-foreground">
                  Form akan menggunakan tanggal {tanggalMode === 'tomorrow' ? 'besok' : 'hari ini'}
                </div>
              )}
            </div>
          </div>

          <div ref={previewRef} className="space-y-6">
            {pages.map((pageItems, pageIndex) => {
              const pageNumber = pageIndex + 1;
              return (
                <div
                  key={pageNumber}
                  className="preorder-page mx-auto max-w-[850px] bg-white p-7 text-black shadow-xl"
                  style={{ fontFamily: 'Arial, sans-serif', fontSize: 14 }}
                >
                  <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', marginBottom: 0 }}>
                    <tbody>
                      <tr>
                        <td style={{ verticalAlign: 'top', paddingBottom: 10, paddingTop: 2 }}>
                          <div style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>
                            <span style={{ color: '#E67E22' }}>FORM</span>
                            <span style={{ color: '#1B4F94' }}> ORDER BARANG</span>
                          </div>
                        </td>
                        <td style={{ verticalAlign: 'top', textAlign: 'right', width: 170, paddingBottom: 10 }}>
                          <img
                            src="./images/logo/logo-nk.png"
                            alt="Logo Nasional Kitchen"
                            style={{ width: 140, height: 'auto', display: 'block', marginLeft: 'auto' }}
                            crossOrigin="anonymous"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ borderTop: '1px solid #000', marginBottom: 8 }} />

                  <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', marginBottom: 10, fontSize: 14, color: '#000' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '2px 0', width: 150, fontWeight: 700, verticalAlign: 'top' }}>DIBUAT OLEH</td>
                        <td style={{ padding: '2px 0', verticalAlign: 'top', fontWeight: 600 }}>: {pic}</td>
                        <td style={{ padding: '2px 0', width: 1 }} />
                      </tr>
                      <tr>
                        <td style={{ padding: '2px 0', fontWeight: 700, verticalAlign: 'top' }}>NOMOR ORDER</td>
                        <td style={{ padding: '2px 0', verticalAlign: 'top', fontWeight: 600 }}>
                          : {nomorOrder}
                          {pages.length > 1 && (
                            <span style={{ marginLeft: 8, padding: '3px 10px', background: '#ff6b00', color: '#fff', borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>
                              HALAMAN {pageNumber} / {pages.length}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '2px 0', textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          <span style={{ fontWeight: 700 }}>Hari/Tgl</span> : {tgl}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <table width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: 'collapse', border: '1px solid #000', marginBottom: 20 }}>
                    <thead>
                      <tr style={{ background: '#B4D6F0' }}>
                        {[
                          ['STOCK', 'SISTEM', 75],
                          ['STOCK', '(Gudang)', 75],
                          ['STOCK', '(Rak)', 70],
                          ['JMLH', 'ORDER', 80],
                          ['KODE', 'ITEM', 110],
                          ['NAMA', 'ITEM', undefined],
                          ['JENIS', '', 95],
                        ].map(([l1, l2, w], i) => (
                          <th
                            key={i}
                            style={{
                              padding: '6px 4px',
                              border: '1px solid #000',
                              fontSize: 13,
                              fontWeight: 800,
                              textAlign: 'center',
                              width: w,
                              lineHeight: 1.2,
                              verticalAlign: 'middle',
                            }}
                          >
                            {l1}
                            <br />
                            {l2}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.map((item, idx) => {
                        const qty = item.qty;
                        const sat = String(item.satuan || 'PCS').toUpperCase();
                        const stokS = item.stokSistem === '' ? '0' : String(item.stokSistem);
                        const stokG = item.stokGudang === '' ? '0' : String(item.stokGudang);
                        const stokR = item.stokToko === '' ? '0' : String(item.stokToko);
                        const jenis = String(item.kategori || 'ELEKTRONIK').toUpperCase();
                        const cell = {
                          padding: '5px 4px',
                          textAlign: 'center',
                          border: '1px solid #000',
                          fontSize: 15,
                          fontWeight: 700,
                          verticalAlign: 'middle',
                          lineHeight: 1.2,
                        } as const;
                        return (
                          <tr key={`${item.kode}-${idx}`}>
                            <td style={cell}>{stokS}</td>
                            <td style={cell}>{stokG}</td>
                            <td style={cell}>{stokR}</td>
                            <td style={{ ...cell, color: '#00B050', fontWeight: 800 }}>
                              {qty} {sat}
                            </td>
                            <td style={{ ...cell, fontSize: 13, padding: '5px 8px' }}>{item.kode || '-'}</td>
                            <td style={{ ...cell, fontSize: 13, padding: '5px 8px', textAlign: 'center', fontWeight: 700 }}>
                              {String(item.nama || '').toUpperCase()}
                              {item.catatanItem && (
                                <span style={{ color: '#DC2626', fontWeight: 800, fontStyle: 'italic' }}>
                                  {' '}
                                  ({item.catatanItem})
                                </span>
                              )}
                            </td>
                            <td style={{ ...cell, fontSize: 13, padding: '5px 6px', fontWeight: 800 }}>{jenis}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <table width="100%" cellPadding={0} cellSpacing={0} style={{ border: '1px solid #000', borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ textAlign: 'left', verticalAlign: 'top', padding: '12px 20px 3px', width: '33%', fontSize: 13, fontFamily: 'Arial' }}>
                          pengantar,
                        </td>
                        <td style={{ textAlign: 'center', verticalAlign: 'top', padding: '12px 10px 3px', width: '34%', fontSize: 13, fontFamily: 'Arial' }}>
                          Persetujuan,
                        </td>
                        <td style={{ textAlign: 'right', verticalAlign: 'top', padding: '12px 20px 3px', width: '33%', fontSize: 13, fontFamily: 'Arial' }}>
                          Penerima,
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={3} style={{ padding: '25px 0' }}>
                          &nbsp;
                        </td>
                      </tr>
                      <tr>
                        <td style={{ textAlign: 'left', fontFamily: 'Arial', padding: '0 20px 3px', fontSize: 13, fontWeight: 600 }}>(_______________)</td>
                        <td style={{ textAlign: 'center', fontFamily: 'Arial', padding: '0 10px 3px', fontSize: 13, fontWeight: 600 }}>(_______________)</td>
                        <td style={{ textAlign: 'right', fontFamily: 'Arial', padding: '0 20px 3px', fontSize: 13, fontWeight: 600 }}>(_______________)</td>
                      </tr>
                      <tr>
                        <td style={{ textAlign: 'left', fontFamily: 'Arial', padding: '0 20px 12px 30px', fontSize: 14, fontWeight: 900 }}>Driver</td>
                        <td style={{ textAlign: 'center', fontFamily: 'Arial', padding: '0 10px 12px', fontSize: 14, fontWeight: 900 }}>SPV Gudang</td>
                        <td style={{ textAlign: 'right', fontFamily: 'Arial', padding: '0 30px 12px 20px', fontSize: 14, fontWeight: 900 }}>SPV Cabang</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HISTORY TAB
   ═══════════════════════════════════════════════════════════════════ */

function formatDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Format tanggal (WITA) utk payload backend: DD-MM-YYYY
function fmtWITADateInput(d: Date): string {
  const s = new Date(d.getTime() + APP.timezoneOffset * 3600 * 1000);
  return `${String(s.getUTCDate()).padStart(2, '0')}-${String(s.getUTCMonth() + 1).padStart(2, '0')}-${s.getUTCFullYear()}`;
}

// WITA datetime utk tampilan riwayat optimistik: DD-MM-YYYY HH:MM:SS
function fmtWITADateTime(d: Date): string {
  const pad = (x: number) => String(x).padStart(2, '0');
  const s = new Date(d.getTime() + APP.timezoneOffset * 3600 * 1000);
  const t = new Date(Date.now() + APP.timezoneOffset * 3600 * 1000);
  return `${pad(s.getUTCDate())}-${pad(s.getUTCMonth() + 1)}-${s.getUTCFullYear()} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}`;
}

// Bangun order lokal utk tampil INSTAN di riwayat sebelum sinkron server
function buildOptimisticOrder(
  items: CartItem[],
  config: { nomorOrder: string; tanggalOrder: Date },
  branchId: string,
  catatan: string,
  orderId: string,
): Order {
  return {
    ORDER_ID: orderId,
    NOMOR_ORDER: config.nomorOrder,
    TANGGAL_ORDER: fmtWITADateTime(config.tanggalOrder),
    ID_CABANG: branchId,
    STATUS: 'PENDING',
    CATATAN: catatan,
    DETAIL: items.map((i) => ({
      KODE_BARANG: i.kode,
      NAMA_BARANG: i.nama,
      KATEGORI: i.kategori,
      QTY: i.qty,
      SATUAN: i.satuan,
      HARGA_SATUAN: i.harga,
      ITEM_STATUS: 'APPROVED',
      ORIGINAL_QTY: i.qty,
      STOK_GUDANG: i.stokGudang,
      STOK_TOKO: i.stokToko,
      STOK_SISTEM: i.stokSistem,
    })),
  };
}

// Nomor order berikutnya — patokan nomor TERAKHIR di form order (bulan berjalan).
// Contoh: form terakhir bernomor 2 → berikutnya 3. Fallback hitung bila data kosong.
function getNextNomor(orders: Order[]): string {
  try {
    const now = new Date();
    const sameMonth = orders.filter((o) => {
      const d = parseAnyDate(String(o.TANGGAL_ORDER || ''));
      return d && d.getTime() !== 0 && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const used = sameMonth
      .map((o) => parseInt(String((o as unknown as Record<string, unknown>).NOMOR_ORDER), 10))
      .filter((n) => !isNaN(n));
    const last = used.length ? Math.max(...used) : 0;
    const nomor = last > 0 ? last + 1 : sameMonth.length + 1;
    return nomor < 10 ? '0' + nomor : String(nomor);
  } catch {
    return '01';
  }
}

function HistoryTab({
  orders,
  loading,
  branchId,
  onDownload,
  onReset,
}: {
  orders: Order[];
  loading: boolean;
  branchId: string;
  onDownload: (order: Order) => void;
  onReset: () => void;
}) {
  const [filter, setFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState(() =>
    formatDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [dateTo, setDateTo] = useState(() => formatDateInput(new Date()));
  const [quickDate, setQuickDate] = useState('');

  const nextOrderNumber = useMemo(() => getNextNomor(orders), [orders]);

  const applyQuickDate = (type: string) => {
    const today = new Date();
    let from = '';
    let to = formatDateInput(today);
    switch (type) {
      case 'today':
        from = formatDateInput(today);
        break;
      case 'yesterday': {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        from = formatDateInput(y);
        to = formatDateInput(y);
        break;
      }
      case 'week': {
        const w = new Date(today);
        w.setDate(w.getDate() - 7);
        from = formatDateInput(w);
        break;
      }
      case 'month': {
        const m = new Date(today.getFullYear(), today.getMonth(), 1);
        from = formatDateInput(m);
        break;
      }
      case 'all':
        from = '';
        to = '';
        break;
    }
    setDateFrom(from);
    setDateTo(to);
    setQuickDate(type);
  };

  const filtered = useMemo(() => {
    let list = orders;
    if (filter !== 'ALL') {
      list = list.filter((o) => String(o.STATUS || '').toUpperCase() === filter);
    }
    if (dateFrom || dateTo) {
      list = list.filter((o) => {
        const orderDate = parseAnyDate(String(o.TANGGAL_ORDER || ''));
        if (!orderDate || orderDate.getTime() === 0) return false;
        const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
        if (dateFrom) {
          const [y, m, d] = dateFrom.split('-').map(Number);
          if (orderDateOnly < new Date(y, m - 1, d)) return false;
        }
        if (dateTo) {
          const [y, m, d] = dateTo.split('-').map(Number);
          if (orderDateOnly > new Date(y, m - 1, d)) return false;
        }
        return true;
      });
    }
    return list;
  }, [orders, filter, dateFrom, dateTo]);

  const hasDateFilter = Boolean(dateFrom || dateTo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">Riwayat Order</h2>
          <p className="text-sm text-muted-foreground">
            Semua order dari cabang <b className="text-brand">{branchId}</b> ·{' '}
            <span className="text-xs">Nomor order berikutnya: {nextOrderNumber}</span>
          </p>
        </div>
        <Button variant="destructive" size="sm" onClick={onReset} title="Reset semua order">
          <Icon name="trash" size={16} /> Reset
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['ALL', 'Semua'],
            ['PENDING', 'Tertunda'],
            ['APPROVED', 'Disetujui'],
            ['REJECTED', 'Ditolak'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold',
              filter === value ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground',
            )}
          >
            {value === 'ALL' ? <Icon name="list" size={14} /> : value === 'PENDING' ? <Icon name="clock" size={14} /> : value === 'APPROVED' ? <Icon name="check-circle" size={14} /> : <Icon name="circle-xmark" size={14} />}
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold">
              <Icon name="calendar" size={14} /> Tanggal:
            </span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              title="Dari tanggal"
              className="h-8 w-36 text-xs dark:[color-scheme:dark]"
            />
            <span className="text-xs text-muted-foreground">s/d</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              title="Sampai tanggal"
              className="h-8 w-36 text-xs dark:[color-scheme:dark]"
            />
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuickDate('');
                }}
              >
                <Icon name="filter" size={14} /> Terapkan
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setQuickDate('all');
                }}
              >
                <Icon name="refresh" size={14} /> Reset
              </Button>
            </div>
            {hasDateFilter && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icon name="calendar-clock" size={12} />
                {dateFrom ? new Date(dateFrom).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Awal'} —{' '}
                {dateTo ? new Date(dateTo).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sekarang'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['today', 'Hari Ini'],
                ['yesterday', 'Kemarin'],
                ['week', '7 Hari'],
                ['month', 'Bulan Ini'],
                ['all', 'Semua'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyQuickDate(value)}
                className={cn(
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  quickDate === value ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground',
                )}
              >
                <Icon name="calendar" size={12} /> {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Icon name="file" size={40} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted-foreground">
              Tidak ada order{filter !== 'ALL' ? ` dengan status "${filter}"` : ''}
              {hasDateFilter ? ' pada rentang tanggal yang dipilih' : ''}.
            </p>
            {hasDateFilter && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setQuickDate('all');
                }}
              >
                <Icon name="refresh" size={16} /> Tampilkan Semua
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
            <Icon name="package" size={12} />
            {filtered.length} order{hasDateFilter ? ' (difilter)' : ''}
          </div>
          {filtered.map((o) => {
            const st = String(o.STATUS || 'PENDING').toUpperCase();
            const info = getStatusInfo(st);
            const details: DetailItem[] = (o.DETAIL as DetailItem[] | undefined) || [];
            const approved = details.filter((d) => String(d.ITEM_STATUS || 'APPROVED').toUpperCase() === 'APPROVED');
            const totalHarga = approved.reduce((s, d) => s + (Number(d.QTY) || 0) * (Number(d.HARGA_SATUAN) || 0), 0);
            const catatanClean = cleanCatatan(o.CATATAN);
            return (
              <Card key={String(o.ORDER_ID)}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <Icon name="file" size={16} className="text-muted-foreground" />
                      {o.ORDER_ID}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1',
                        st === 'PENDING' && 'border-warning/40 bg-warning/15 text-warning',
                        st === 'APPROVED' && 'border-success/40 bg-success/15 text-success',
                        (st === 'REJECTED' || st === 'PICKED') && 'border-danger/40 bg-danger/15 text-danger',
                      )}
                    >
                      {st === 'PENDING' ? '⏳' : st === 'APPROVED' ? '✅' : st === 'REJECTED' ? '❌' : '📋'} {info.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon name="calendar-clock" size={12} /> {formatWita(o.TANGGAL_ORDER)}
                  </div>
                  <div className="flex items-start gap-1 text-xs">
                    <Icon name="package" size={12} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <span className="text-foreground/80">
                      {details.length
                        ? details.slice(0, 3).map((d) => (
                            <span key={String(d.KODE_BARANG)}>
                              {d.KODE_BARANG} × {d.QTY}
                              {d.CATATAN_ITEM && (
                                <span className="italic text-danger"> ({d.CATATAN_ITEM})</span>
                              )}
                              {', '}
                            </span>
                          ))
                        : 'detail tidak tersedia'}
                      {details.length > 3 && <span className="text-muted-foreground">+{details.length - 3} lagi</span>}
                    </span>
                  </div>
                  {totalHarga > 0 && (
                    <div className="text-sm font-bold text-brand">Total: {formatRupiah(totalHarga)}</div>
                  )}
                  {catatanClean && (
                    <div className="flex items-start gap-1 rounded bg-muted/50 px-2 py-1 text-xs">
                      <Icon name="message-text" size={12} className="mt-0.5 shrink-0 text-muted-foreground" /> {catatanClean}
                    </div>
                  )}
                  <div className="pt-1">
                    <Button variant="outline" size="sm" onClick={() => onDownload(o)}>
                      <Icon name="download" size={16} /> Download Form
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MASS ORDER TAB
   ═══════════════════════════════════════════════════════════════════ */

interface MassItem {
  kode: string;
  nama: string;
  kategori: string;
  harga: number;
  satuan: string;
  qty: number;
  stock: number;
  valid: boolean;
  error?: string;
  warning?: string;
  stokGudang: number | '';
  stokToko: number | '';
}

function MassOrderTab({
  productByCode,
  onOpenPreOrder,
  resetKey,
}: {
  productByCode: Record<string, Barang>;
  onOpenPreOrder: (items: CartItem[], catatan: string) => void;
  resetKey: number;
}) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<MassItem[]>([]);
  const [note, setNote] = useState('');
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (resetKey <= 0) return;
    setText('');
    setItems([]);
    setNote('');
    setPreviewing(false);
  }, [resetKey]);

  const parseMassInput = useCallback(
    (value: string): MassItem[] => {
      const lines = value.split('\n').map((l) => l.trim()).filter(Boolean);
      return lines.map((line) => {
        const parts = line.split(/[;,\t]/).map((p) => p.trim());
        if (parts.length < 2) return { kode: line, nama: '', kategori: '', harga: 0, satuan: 'PCS', qty: 0, stock: 0, valid: false, error: 'Format harus KODE;JUMLAH', stokGudang: '', stokToko: '' };
        const code = String(parts[0]).toUpperCase();
        const quantity = toInt(parts[1]);
        const product = productByCode[code];
        if (!code) return { kode: '', nama: '', kategori: '', harga: 0, satuan: 'PCS', qty: 0, stock: 0, valid: false, error: 'Kode kosong', stokGudang: '', stokToko: '' };
        if (quantity <= 0) return { kode: code, nama: '', kategori: '', harga: 0, satuan: 'PCS', qty: 0, stock: 0, valid: false, error: 'Jumlah harus > 0', stokGudang: '', stokToko: '' };
        if (!product) return { kode: code, nama: '', kategori: '', harga: 0, satuan: 'PCS', qty: 0, stock: 0, valid: false, error: `Barang ${code} tidak ditemukan`, stokGudang: '', stokToko: '' };
        const stock = toInt(product.STOK);
        return {
          kode: code,
          nama: String(product.NAMA_BARANG || ''),
          kategori: String(product.KATEGORI || ''),
          harga: Number(product.HARGA) || 0,
          satuan: String(product.SATUAN || 'PCS'),
          qty: quantity,
          stock,
          valid: true,
          warning: quantity > stock ? `Melebihi stok sistem (${stock})` : '',
          stokGudang: '',
          stokToko: '',
        };
      });
    },
    [productByCode],
  );

  const syncText = useCallback((list: MassItem[]) => {
    setText(list.map((i) => (i.valid ? `${i.kode};${i.qty}` : i.kode)).join('\n'));
  }, []);

  const updateItem = (index: number, patch: Partial<MassItem>, sync = true) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      if (sync) syncText(next);
      return next;
    });
  };

  const handleInput = (value: string) => {
    setText(value);
    setItems(parseMassInput(value));
  };

  const pasteFromClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t) {
        toast.info('Paste manual dengan Ctrl+V.');
        return;
      }
      handleInput(t);
      toastSuccess('Berhasil paste.');
    } catch {
      toast.info('Paste manual dengan Ctrl+V.');
    }
  };

  const validItems = items.filter((i) => i.valid);
  const invalidCount = items.length - validItems.length;
  const gudangMissing = validItems.filter((i) => i.stokGudang === '').length;
  const tokoMissing = validItems.filter((i) => i.stokToko === '').length;
  const canSubmit = validItems.length > 0 && gudangMissing === 0 && tokoMissing === 0;
  const totalQty = validItems.reduce((s, i) => s + i.qty, 0);
  const totalPrice = validItems.reduce((s, i) => s + i.qty * i.harga, 0);

  const submit = () => {
    if (!validItems.length) {
      toastError('Tidak ada barang valid.');
      return;
    }
    if (gudangMissing > 0 || tokoMissing > 0) {
      toast.warning('Isi stok gudang dan stok toko semua barang.', { duration: 4000 });
      return;
    }
    const cartItems: CartItem[] = validItems.map((i) => ({
      kode: i.kode,
      nama: i.nama,
      kategori: i.kategori,
      qty: i.qty,
      satuan: i.satuan,
      harga: i.harga,
      stokSistem: i.stock,
      stokGudang: i.stokGudang,
      stokToko: i.stokToko,
      catatanItem: '',
    }));
    onOpenPreOrder(cartItems, note);
    setPreviewing(true);
  };

  useEffect(() => {
    if (!previewing) return;
    const t = setTimeout(() => setPreviewing(false), 400);
    return () => clearTimeout(t);
  }, [previewing]);

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h2 className="font-display text-xl font-bold">Order Massal</h2>
        <p className="text-sm text-muted-foreground">Copy-paste kode dan jumlah barang sekaligus untuk order banyak barang.</p>
      </div>

      <Card>
        <CardContent className="space-y-2 p-4">
          <div className="text-sm font-bold">
            Format: <code className="rounded bg-muted px-1.5 py-0.5 font-mono">KODE;JUMLAH</code>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 font-mono text-xs">
            NN00001;5
            <br />
            NN00002;10
            <br />
            NN00003;3
          </div>
          <div className="flex items-start gap-1 text-xs text-muted-foreground">
            <Icon name="triangle-warning" size={12} className="mt-0.5 shrink-0" /> Separator bisa ; , atau Tab. Isi juga stok gudang dan stok toko sebelum kirim.
          </div>
          <div className="flex items-start gap-1 text-xs text-warning">
            <Icon name="edit" size={12} className="mt-0.5 shrink-0" /> Untuk barang baru (belum di katalog), gunakan tab <b>Katalog → Barang Manual</b>.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <Textarea
            value={text}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={'CONTOH:\nNN00001;5\nNN00002;10'}
            rows={6}
            className="font-mono text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void pasteFromClipboard()}>
              <Icon name="paste" size={16} /> Paste dari Clipboard
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setText('');
                setItems([]);
              }}
            >
              <Icon name="trash" size={16} /> Hapus
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-2 text-sm font-bold">Preview Barang</div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <Icon name="bolt" size={40} className="mx-auto mb-2 text-muted" />
            Mulai ketik atau paste kode di atas.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="bg-success/15 text-success">
                <Icon name="check-circle" size={12} /> {validItems.length} valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="outline" className="bg-danger/15 text-danger">
                  <Icon name="circle-xmark" size={12} /> {invalidCount} error
                </Badge>
              )}
            </div>
            {items.map((item, index) =>
              !item.valid ? (
                <div key={index} className="flex items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3">
                  <div className="flex items-center gap-2">
                    <Icon name="circle-xmark" size={20} className="text-danger" />
                    <div>
                      <div className="font-mono text-sm font-bold">{item.kode || '?'}</div>
                      <div className="text-xs text-danger">{item.error}</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-danger"
                    onClick={() => {
                      setItems((prev) => {
                        const next = [...prev];
                        next.splice(index, 1);
                        syncText(next);
                        return next;
                      });
                    }}
                  >
                    <Icon name="trash" size={16} />
                  </Button>
                </div>
              ) : (
                <div key={index} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-start gap-2">
                      {item.warning ? (
                        <Icon name="triangle-warning" size={20} className="mt-0.5 shrink-0 text-warning" />
                      ) : (
                        <Icon name="check-circle" size={20} className="mt-0.5 shrink-0 text-success" />
                      )}
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-bold">{item.kode}</div>
                        <div className="truncate text-sm">{item.nama}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatRupiah(item.harga)} / {item.satuan} · Stok sistem: {item.stock}
                        </div>
                        {item.warning && (
                          <div className="text-xs text-warning">
                            <Icon name="triangle-warning" size={12} className="mr-1 inline" />
                            {item.warning}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <div className="text-sm font-bold">{formatRupiah(item.qty * item.harga)}</div>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItem(index, { qty: Math.max(1, item.qty - 1) })}>
                          <Icon name="minus" size={12} />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => updateItem(index, { qty: Math.max(1, toInt(e.target.value) || 1) })}
                          className="h-6 w-14 px-1 text-center text-xs"
                        />
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateItem(index, { qty: item.qty + 1 })}>
                          <Icon name="plus" size={12} />
                        </Button>
                      </div>
                      <label className={cn('flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1', item.stokGudang === '' && 'border-danger/50')} title="Stok Gudang">
                        <Icon name="warehouse-alt" size={12} className="text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Gudang"
                          value={item.stokGudang === '' ? '' : String(item.stokGudang)}
                          onChange={(e) =>
                            updateItem(index, { stokGudang: e.target.value.trim() === '' ? '' : Math.max(0, toInt(e.target.value)) }, false)
                          }
                          className="h-6 w-16 px-1 text-xs"
                        />
                      </label>
                      <label className={cn('flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1', item.stokToko === '' && 'border-danger/50')} title="Stok Toko">
                        <Icon name="shop" size={12} className="text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Toko"
                          value={item.stokToko === '' ? '' : String(item.stokToko)}
                          onChange={(e) =>
                            updateItem(index, { stokToko: e.target.value.trim() === '' ? '' : Math.max(0, toInt(e.target.value)) }, false)
                          }
                          className="h-6 w-16 px-1 text-xs"
                        />
                      </label>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-danger"
                        onClick={() => {
                          setItems((prev) => {
                            const next = [...prev];
                            next.splice(index, 1);
                            syncText(next);
                            return next;
                          });
                        }}
                      >
                        <Icon name="trash" size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        {validItems.length > 0 && (gudangMissing > 0 || tokoMissing > 0) && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
            <Icon name="triangle-warning" size={14} className="mt-0.5 shrink-0" />
            <span>
              Wajib isi stok gudang ({gudangMissing} kosong) dan stok toko ({tokoMissing} kosong).
            </span>
          </div>
        )}
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Catatan untuk admin (opsional)..."
        />
        <Button onClick={submit} disabled={!canSubmit} className="w-full">
          <Icon name="file" size={16} />
          Preview Form Order ({validItems.length} item)
        </Button>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            {validItems.length} jenis · {totalQty} unit
          </span>
          <span className="font-bold">{formatRupiah(totalPrice)}</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */

type OrderTab = 'katalog' | 'mass' | 'history';

export default function Order() {
  const { session } = useAuth();
  const { confirm, prompt, dialog } = useDialog();
  const username = session?.username || '';
  const branchId = String(session?.idCabang || '').trim().toUpperCase();
  const branchPic = session?.nama || (CABANG[branchId] ? CABANG[branchId].pic : '') || '-';

  const [tab, setTab] = useState<OrderTab>(() => {
    const h = window.location.hash.replace('#', '');
    return h === 'history' || h === 'mass' ? h : 'katalog';
  });
  const [katalogList, setKatalogList] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, CartItem>>(() => loadCartLocal(username));
  const [cartOpen, setCartOpen] = useState(false);
  const [preOrder, setPreOrder] = useState<{ items: CartItem[]; catatan: string } | null>(null);
  const [history, setHistory] = useState<Order[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyRef = useRef<Order[]>([]);
  historyRef.current = history;
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [massResetKey, setMassResetKey] = useState(0);
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productByCode = useMemo(() => {
    const map: Record<string, Barang> = {};
    for (const b of katalogList) {
      const code = String(b.KODE_BARANG || '').trim().toUpperCase();
      if (code) map[code] = b;
    }
    return map;
  }, [katalogList]);

  const persistCart = useCallback(
    (next: Record<string, CartItem>) => {
      setCart(next);
      saveCartLocal(username, next);
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => {
        void cartApi.sync({ username: String(username).toLowerCase(), cart: JSON.stringify(next || {}) }).catch(() => {
          /* sync gagal, abaikan */
        });
      }, 2000);
    },
    [username],
  );

  const loadData = useCallback(async () => {
    try {
      const k = await katalogApi.getAll();
      setKatalogList(k.status === 'ok' ? ((k.data as Barang[]) || []) : []);
    } catch (e) {
      toastError('Gagal memuat katalog: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    // Skeleton hanya saat load PERTAMA; refresh berikutnya biarkan list tampil
    // agar order optimistik tetap terlihat selama menunggu server (4-12s).
    if (historyRef.current.length === 0) setHistoryLoading(true);
    try {
      const h = await ordersApi.getAll({ cache: false });
      const all = h.status === 'ok' ? ((h.data as Order[]) || []) : [];
      const branchOrders = all
        .filter((o) => String(o.ID_CABANG || '').toUpperCase() === branchId)
        .sort((a, b) => {
          const da = parseAnyDate(String(a.TANGGAL_ORDER || ''));
          const db = parseAnyDate(String(b.TANGGAL_ORDER || ''));
          return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
        });
      setHistory(branchOrders);
    } catch (e) {
      toastError('Gagal memuat riwayat: ' + (e as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void loadData();
    void loadHistory();
  }, [loadData, loadHistory]);

  useEffect(() => {
    void cartApi
      .get(username)
      .then((result) => {
        if (result.status !== 'ok' || !result.cart) return;
        let serverCart: Record<string, CartItem> = {};
        try {
          const parsed = JSON.parse(String(result.cart)) as Record<string, CartItem>;
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) serverCart = parsed;
        } catch {
          return;
        }
        const serverKeys = Object.keys(serverCart);
        if (!serverKeys.length) return;
        const localKeys = Object.keys(cartRef.current);
        let needUpdate = false;
        if (localKeys.length === 0) {
          cartRef.current = serverCart;
          needUpdate = true;
        } else if (serverKeys.length > localKeys.length) {
          for (const key of serverKeys) {
            if (!cartRef.current[key]) cartRef.current[key] = serverCart[key];
          }
          needUpdate = true;
        }
        if (needUpdate) persistCart(cartRef.current);
      })
      .catch(() => {
        /* abaikan */
      });
  }, [username, persistCart]);

  useEffect(() => {
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cartItems.reduce((s, i) => s + i.qty * i.harga, 0);

  /* ── KATALOG ACTIONS ─────────────────────────────────────────────── */

  const addToCart = (b: Barang, qty: number, satuan: string) => {
    const kode = String(b.KODE_BARANG || '');
    const existing = cartRef.current[kode];
    persistCart({
      ...cartRef.current,
      [kode]: {
        kode,
        nama: String(b.NAMA_BARANG || ''),
        kategori: String(b.KATEGORI || ''),
        qty: existing ? Math.max(1, qty) : Math.max(1, qty),
        satuan,
        harga: Number(b.HARGA) || 0,
        stokSistem: toInt(b.STOK),
        stokGudang: existing ? existing.stokGudang : '',
        stokToko: existing ? existing.stokToko : '',
        catatanItem: existing?.catatanItem || '',
      },
    });
    if (!existing) toastSuccess('Ditambah ke keranjang.', { duration: 1500 });
  };

  const setCartQty = (key: string, qty: number) => {
    const next = { ...cartRef.current };
    if (!next[key]) return;
    next[key] = { ...next[key], qty: Math.max(1, qty) };
    persistCart(next);
  };

  const changeCartQty = (key: string, delta: number) => {
    const next = { ...cartRef.current };
    const item = next[key];
    if (!item) return;
    next[key] = { ...item, qty: Math.max(1, item.qty + delta) };
    persistCart(next);
  };

  const setCartSatuan = (key: string, satuan: string) => {
    const next = { ...cartRef.current };
    if (!next[key]) return;
    next[key] = { ...next[key], satuan };
    persistCart(next);
  };

  const setCartStock = (key: string, type: 'gudang' | 'toko', value: number | '') => {
    const next = { ...cartRef.current };
    if (!next[key]) return;
    next[key] = { ...next[key], [type === 'gudang' ? 'stokGudang' : 'stokToko']: value };
    persistCart(next);
  };

  const setCartNote = (key: string, note: string) => {
    const next = { ...cartRef.current };
    if (!next[key]) return;
    next[key] = { ...next[key], catatanItem: note };
    persistCart(next);
  };

  const removeFromCart = (key: string) => {
    const next = { ...cartRef.current };
    delete next[key];
    persistCart(next);
    toast.info('Dihapus dari keranjang.', { duration: 1500 });
  };

  const addManualToCart = (data: {
    nama: string;
    kode: string;
    kategori: string;
    qty: number;
    satuan: string;
    stokGudang: number | '';
    stokToko: number | '';
  }) => {
    const displayKode = data.kode || '-';
    let cartKey = data.kode;
    if (!cartKey || cartKey === '-' || cartKey === '0') {
      cartKey = '_manual_' + Date.now().toString().slice(-8) + '_' + Math.random().toString(36).slice(2, 6);
    }
    if (data.kode && data.kode !== '-' && data.kode !== '0' && cartRef.current[cartKey]) {
      toast.warning(`Kode "${data.kode}" sudah ada di keranjang.`);
      return;
    }
    persistCart({
      ...cartRef.current,
      [cartKey]: {
        kode: displayKode,
        nama: data.nama,
        kategori: data.kategori,
        qty: data.qty,
        satuan: data.satuan,
        harga: 0,
        stokSistem: '',
        stokGudang: data.stokGudang,
        stokToko: data.stokToko,
        isManual: true,
        catatanItem: '',
      },
    });
    toastSuccess(`"${data.nama}" ditambahkan ke keranjang.`, { duration: 2000 });
  };

  const updateManualItem = (
    key: string,
    data: { nama: string; kategori: string; qty: number; satuan: string; stokGudang: number | ''; stokToko: number | '' },
  ) => {
    const next = { ...cartRef.current };
    if (!next[key]) return;
    next[key] = { ...next[key], ...data };
    persistCart(next);
    toastSuccess(`"${data.nama}" berhasil diperbarui.`, { duration: 2000 });
  };

  /* ── SUBMIT (dari pre-order dialog) ──────────────────────────────── */

  const submitOrder = async (items: CartItem[], catatan: string, config: { nomorOrder: string; tanggalOrder: Date }) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const stockNote = items.map((i) => `${i.kode}: gudang ${i.stokGudang}, toko ${i.stokToko}`).join(' | ');
      const formInfo = `[FORM] No.${config.nomorOrder} Tgl.${config.tanggalOrder.toLocaleDateString('id-ID')}`;
      const fullCatatan = catatan
        ? `${catatan}\n\n${formInfo}\n\n[STOK AKTUAL] ${stockNote}`
        : `${formInfo}\n\n[STOK AKTUAL] ${stockNote}`;
      const result = await ordersApi.submit({
        idCabang: branchId,
        nomorOrder: config.nomorOrder,
        tanggalOrder: fmtWITADateInput(config.tanggalOrder),
        catatan: fullCatatan,
        items: items.map((i) => ({
          kode: i.kode,
          nama: i.nama,
          kategori: i.kategori,
          qty: i.qty,
          satuan: i.satuan,
          harga: i.harga,
          stokGudang: i.stokGudang === '' ? '' : Number(i.stokGudang),
          stokToko: i.stokToko === '' ? '' : Number(i.stokToko),
          stokSistem: i.stokSistem === '' ? 0 : Number(i.stokSistem),
          isManual: Boolean(i.isManual),
          catatanItem: i.catatanItem || '',
        })),
      });
      if (result.status !== 'ok') {
        throw new Error(String(result.message || 'Gagal mengirim order.'));
      }
      // Tampilkan INSTAN di riwayat (optimistik), lalu reconcile dengan server
      const oid = String((result as unknown as { orderId?: string }).orderId || `ORD-LOCAL-${Date.now()}`);
      setHistory((prev) => [buildOptimisticOrder(items, config, branchId, fullCatatan, oid), ...prev]);
      persistCart({});
      toastSuccess('Order berhasil dikirim!', { duration: 4000 });
      setPreOrder(null);
      setTimeout(() => {
        setTab('history');
        void loadHistory();
      }, 1000);
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const submitMass = async (items: CartItem[], catatan: string, config: { nomorOrder: string; tanggalOrder: Date }) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const stockNote = items.map((i) => `${i.kode}: gudang ${i.stokGudang}, toko ${i.stokToko}`).join(' | ');
      const formInfo = `[FORM] No.${config.nomorOrder} Tgl.${config.tanggalOrder.toLocaleDateString('id-ID')}`;
      const fullCatatan = `[MASSAL] ${catatan}${catatan ? '\n\n' : ''}${formInfo}\n\n[STOK AKTUAL] ${stockNote}`;
      const result = await ordersApi.submit({
        idCabang: branchId,
        nomorOrder: config.nomorOrder,
        tanggalOrder: fmtWITADateInput(config.tanggalOrder),
        catatan: fullCatatan,
        items: items.map((i) => ({
          kode: i.kode,
          nama: i.nama,
          kategori: i.kategori,
          qty: i.qty,
          satuan: i.satuan,
          harga: i.harga,
          stokGudang: i.stokGudang === '' ? '' : Number(i.stokGudang),
          stokToko: i.stokToko === '' ? '' : Number(i.stokToko),
          stokSistem: i.stokSistem === '' ? 0 : Number(i.stokSistem),
          isManual: false,
          catatanItem: i.catatanItem || '',
        })),
      });
      if (result.status !== 'ok') {
        throw new Error(String(result.message || 'Gagal mengirim order.'));
      }
      const oidMass = String((result as unknown as { orderId?: string }).orderId || `ORD-LOCAL-${Date.now()}`);
      setHistory((prev) => [buildOptimisticOrder(items, config, branchId, fullCatatan, oidMass), ...prev]);
      toastSuccess('Order massal berhasil dikirim!', { duration: 4000 });
      setPreOrder(null);
      setMassResetKey((k) => k + 1);
      setTimeout(() => {
        setTab('history');
        void loadHistory();
      }, 1500);
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  /* ── RESET ORDERS ────────────────────────────────────────────────── */

  const handleResetOrders = async () => {
    const ok = await confirm({
      icon: '⚠️',
      title: 'Reset Semua Order?',
      message:
        'PERHATIAN! Tindakan ini akan:\n\n• Menghapus SEMUA order dari sistem\n• Nomor order kembali ke 01\n• Data tidak bisa dikembalikan\n\nApakah Anda yakin ingin mereset total?\n\n🔒 Dibutuhkan PASSWORD ADMIN untuk melanjutkan.',
      okText: 'Ya, Lanjutkan',
      okVariant: 'destructive',
    });
    if (!ok) return;
    const password = await prompt({
      icon: '🔒',
      title: 'Masukkan Password Admin',
      message: 'Ketik password admin gudang untuk mengkonfirmasi reset.\n\nPassword ini WAJIB benar untuk melanjutkan.',
      placeholder: 'Password admin...',
      okText: 'Konfirmasi Reset',
      okVariant: 'destructive',
      required: true,
    });
    if (!password) return;
    try {
      toast.info('Memproses reset...', { duration: 10000 });
      const result = await callApi('resetAllOrders', {
        password: typeof password === 'string' ? password : '',
        idCabang: branchId,
      }, { dedupe: false, timeout: 60000 });
      if (result.status !== 'ok') {
        toastError(String(result.message || 'Reset gagal. Password salah?'));
        return;
      }
      toastSuccess(String(result.message || 'Semua order berhasil direset! Nomor order kembali ke 01.'), { duration: 5000 });
      setHistory([]);
      await loadHistory();
    } catch (error) {
      toastError('Gagal reset: ' + (error as Error).message);
    }
  };

  /* ── DOWNLOAD FORM (history) ─────────────────────────────────────── */

  const downloadForm = (order: Order) => {
    setPrintOrder(order);
  };

  const printItems = useMemo<PrintItem[]>(() => {
    if (!printOrder) return [];
    const details: DetailItem[] = (printOrder.DETAIL as DetailItem[] | undefined) || [];
    return details
      .filter((d) => String(d.ITEM_STATUS || 'APPROVED').toUpperCase() !== 'DELETED')
      .map((d) => ({
        kode: String(d.KODE_BARANG || ''),
        nama: String(d.NAMA_BARANG || ''),
        kategori: String(d.KATEGORI || ''),
        qty: toInt(d.QTY),
        satuan: String(d.SATUAN || 'PCS'),
        harga: Number(d.HARGA_SATUAN) || 0,
        itemStatus: String(d.ITEM_STATUS || 'APPROVED').toUpperCase(),
        reason: String(d.REASON || ''),
        originalQty: toInt(d.ORIGINAL_QTY) || toInt(d.QTY),
        stokGudang: d.STOK_GUDANG !== undefined && d.STOK_GUDANG !== '' ? toInt(d.STOK_GUDANG) : '',
        stokToko: d.STOK_TOKO !== undefined && d.STOK_TOKO !== '' ? toInt(d.STOK_TOKO) : '',
        stokSistem: d.STOK_SISTEM !== undefined && d.STOK_SISTEM !== '' ? toInt(d.STOK_SISTEM) : '',
        stokPicker: d.STOK_PICKER,
        catatanItem: String(d.CATATAN_ITEM || ''),
      }));
  }, [printOrder]);

  /* ── RENDER ──────────────────────────────────────────────────────── */

  const kategoriList = useMemo(
    () => [...new Set(katalogList.map((b) => String(b.KATEGORI || '').trim()).filter(Boolean))].sort(),
    [katalogList],
  );

  return (
    <div className="relative min-h-screen">
      <ParticlesBg />
      <div className="space-y-6 pb-24 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Order</h1>
          <p className="text-sm text-muted-foreground">
            {branchId} · {branchPic}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadData()}>
          <Icon name="refresh" size={16} /> Muat Ulang
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => {
        setTab(v as OrderTab);
        window.location.hash = v;
      }}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="katalog">Katalog</TabsTrigger>
          <TabsTrigger value="mass">Order Massal</TabsTrigger>
          <TabsTrigger value="history">Riwayat</TabsTrigger>
        </TabsList>

        <TabsContent value="katalog" className="space-y-4">
          <CatalogTabBody
            katalogList={katalogList}
            kategoriList={kategoriList}
            loading={loading}
            cart={cart}
            productByCode={productByCode}
            onAdd={(b, qty, satuan) => addToCart(b, qty, satuan)}
            onIncrease={(b) => {
              const kode = String(b.KODE_BARANG);
              if (cartRef.current[kode]) {
                const item = cartRef.current[kode];
                setCartQty(kode, item.qty + 1);
              }
            }}
            onDecrease={(b) => {
              const kode = String(b.KODE_BARANG);
              if (cartRef.current[kode]) setCartQty(kode, cartRef.current[kode].qty - 1);
            }}
            onSetQty={(b, qty) => {
              const kode = String(b.KODE_BARANG);
              if (cartRef.current[kode]) setCartQty(kode, qty);
            }}
            onSetSatuan={(b, satuan) => {
              const kode = String(b.KODE_BARANG);
              if (cartRef.current[kode]) setCartSatuan(kode, satuan);
            }}
            onManualAdd={addManualToCart}
            onManualUpdate={updateManualItem}
            onManualDelete={removeFromCart}
          />
        </TabsContent>

        <TabsContent value="mass" className="space-y-4">
          <MassOrderTab
            productByCode={productByCode}
            resetKey={massResetKey}
            onOpenPreOrder={(items, catatan) => setPreOrder({ items, catatan })}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <HistoryTab
            orders={history}
            loading={historyLoading}
            branchId={branchId}
            onDownload={downloadForm}
            onReset={() => void handleResetOrders()}
          />
        </TabsContent>
      </Tabs>

      {/* CART BAR */}
      {cartItems.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
            <Button onClick={() => setCartOpen(true)} className="flex-1 justify-between sm:flex-none">
              <span className="flex items-center gap-2">
                <Icon name="shopping-cart" size={16} /> Lihat Keranjang
              </span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
                {cartCount} item · {formatRupiah(cartTotal)}
              </span>
            </Button>
          </div>
        </div>
      )}

      <CartSheet
        open={cartOpen}
        cart={cart}
        onClose={() => setCartOpen(false)}
        onQty={changeCartQty}
        onSetQty={setCartQty}
        onSetSatuan={setCartSatuan}
        onSetNote={setCartNote}
        onSetStock={setCartStock}
        onDelete={removeFromCart}
        onSubmit={(note) => {
          const missing = cartItems.filter((i) => isEmpty(i.stokGudang) || isEmpty(i.stokToko)).length;
          if (missing > 0) {
            toast.warning('Isi stok gudang dan stok toko untuk semua barang.', { duration: 4000 });
            return;
          }
          setCartOpen(false);
          setPreOrder({ items: cartItems, catatan: note });
        }}
        submitting={submitting}
      />

      <PreOrderDialog
        open={preOrder !== null}
        items={preOrder?.items || []}
        branchId={branchId}
        ordersCache={history}
        onClose={() => setPreOrder(null)}
        onConfirm={async (config) => {
          if (!preOrder) return;
          if (tab === 'mass') {
            await submitMass(preOrder.items, preOrder.catatan, config);
          } else {
            await submitOrder(preOrder.items, preOrder.catatan, config);
          }
        }}
      />

      <PrintFormModal
        open={printOrder !== null}
        title={`Preview Form Order — ${printOrder?.ORDER_ID || ''}`}
        orderId={printOrder?.ORDER_ID || ''}
        idCabang={String(printOrder?.ID_CABANG || '')}
        tanggalCetak={parseAnyDate(printOrder?.TANGGAL_ORDER ?? '') ?? new Date()}
        nomorOrder={String(printOrder?.NOMOR_ORDER || '') || getSequentialNumber(printOrder, history)}
        statusOrder={String(printOrder?.STATUS || 'PENDING')}
        items={printItems}
        stokLookup={(kode) => {
          const p = productByCode[String(kode).trim().toUpperCase()];
          return p ? toInt(p.STOK) : undefined;
        }}
        showStatus
        onClose={() => setPrintOrder(null)}
      />

      {dialog}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KATALOG TAB BODY (search, filter chips, grid, load-more, manual)
   ═══════════════════════════════════════════════════════════════════ */

function CatalogTabBody({
  katalogList,
  kategoriList,
  loading,
  cart,
  productByCode,
  onAdd,
  onIncrease,
  onDecrease,
  onSetQty,
  onSetSatuan,
  onManualAdd,
  onManualUpdate,
  onManualDelete,
}: {
  katalogList: Barang[];
  kategoriList: string[];
  loading: boolean;
  cart: Record<string, CartItem>;
  productByCode: Record<string, Barang>;
  onAdd: (b: Barang, qty: number, satuan: string) => void;
  onIncrease: (b: Barang) => void;
  onDecrease: (b: Barang) => void;
  onSetQty: (b: Barang, qty: number) => void;
  onSetSatuan: (b: Barang, satuan: string) => void;
  onManualAdd: (data: { nama: string; kode: string; kategori: string; qty: number; satuan: string; stokGudang: number | ''; stokToko: number | '' }) => void;
  onManualUpdate: (key: string, data: { nama: string; kategori: string; qty: number; satuan: string; stokGudang: number | ''; stokToko: number | '' }) => void;
  onManualDelete: (key: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({});

  const isManual = category === '__MANUAL__';

  const filtered = useMemo(() => {
    if (isManual) return [];
    const q = search.trim().toLowerCase();
    const list = katalogList.filter((b) => {
      if (category && String(b.KATEGORI || '').trim() !== category) return false;
      if (!q) return true;
      return (
        String(b.KODE_BARANG || '').toLowerCase().includes(q) ||
        String(b.NAMA_BARANG || '').toLowerCase().includes(q) ||
        String(b.KATEGORI || '').toLowerCase().includes(q)
      );
    });
    return list;
  }, [katalogList, search, category, isManual]);

  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;

  const resetFilter = () => {
    setSearch('');
    setCategory('');
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    if (category === '__MANUAL__') {
      setCategory('');
      setEditingKey(null);
    }
    setVisibleCount(ITEMS_PER_PAGE);
  };

  const getQty = (kode: string) => {
    const cartItem = cart[kode];
    if (cartItem) return cartItem.qty;
    return qtyMap[kode] || 1;
  };

  const setQtyLocal = (kode: string, qty: number) => {
    setQtyMap((prev) => ({ ...prev, [kode]: qty }));
    const item = cart[kode];
    if (item) onSetQty(productByCode[String(kode).toUpperCase()], qty);
  };

  const getSatuan = (b: Barang) => {
    const kode = String(b.KODE_BARANG);
    const item = cart[kode];
    if (item) return item.satuan;
    return String(b.SATUAN || 'PCS').toUpperCase();
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Cari kode atau nama barang..."
          type="search"
          className="pl-9"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => {
            setCategory('');
            setEditingKey(null);
            setVisibleCount(ITEMS_PER_PAGE);
          }}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold',
            category === '' ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground',
          )}
        >
          <Icon name="list" size={14} /> Semua
        </button>
        <button
          type="button"
          onClick={() => {
            setCategory('__MANUAL__');
            setEditingKey(null);
          }}
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold',
            category === '__MANUAL__' ? 'border-warning bg-warning/10 text-warning' : 'border-border text-muted-foreground',
          )}
        >
          <Icon name="edit" size={14} /> Barang Manual
        </button>
        {kategoriList.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setCategory(k);
              setVisibleCount(ITEMS_PER_PAGE);
            }}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold',
              category === k ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground',
            )}
          >
            {getKategoriIcon(k)} {k}
          </button>
        ))}
      </div>

      {isManual ? (
        <ManualForm
          editingKey={editingKey}
          cart={cart}
          onAdd={onManualAdd}
          onUpdate={(key, data) => {
            onManualUpdate(key, data);
            setEditingKey(null);
          }}
          onDelete={(key) => {
            if (editingKey === key) setEditingKey(null);
            onManualDelete(key);
          }}
          onStartEdit={setEditingKey}
          onCancelEdit={() => setEditingKey(null)}
        />
      ) : (
        <>
          <div className="text-sm font-semibold text-muted-foreground">
            Katalog Barang · {filtered.length} item
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-border p-10 text-center">
              <Icon name="search" size={40} className="mx-auto mb-2 text-muted" />
              <p className="text-sm text-muted-foreground">Barang tidak ditemukan.</p>
              {(search || category) && (
                <Button variant="outline" size="sm" className="mt-3" onClick={resetFilter}>
                  <Icon name="refresh" size={16} /> Reset Filter
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((b) => {
                const kode = String(b.KODE_BARANG);
                const inCart = Boolean(cart[kode]);
                return (
                  <ProductCard
                    key={kode}
                    product={b}
                    inCart={inCart}
                    cartQty={cart[kode]?.qty || 1}
                    cartSatuan={getSatuan(b)}
                    onAdd={() => onAdd(b, getQty(kode), getSatuan(b))}
                    onIncrease={() => {
                      setQtyLocal(kode, getQty(kode) + 1);
                      onIncrease(b);
                    }}
                    onDecrease={() => {
                      setQtyLocal(kode, Math.max(1, getQty(kode) - 1));
                      onDecrease(b);
                    }}
                    onSetQty={(qty) => setQtyLocal(kode, qty)}
                    onSetSatuan={(satuan) => onSetSatuan(b, satuan)}
                  />
                );
              })}
            </div>
          )}

          {remaining > 0 && (
            <div className="py-4 text-center">
              <Button variant="outline" size="sm" onClick={() => setVisibleCount((c) => c + ITEMS_PER_PAGE)}>
                <Icon name="angle-small-down" size={16} /> Tampilkan {remaining} lainnya
              </Button>
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
}