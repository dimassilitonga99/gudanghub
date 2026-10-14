import { Icon } from '../components/ui/icon';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { toastSuccess } from '@/lib/toast';
import { katalog } from '@/lib/api';
import { BarangImage, setGambarCache } from '@/components/ItemPhoto';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/lib/dialog';
import { APP, type Barang } from '@/lib/config';
import { formatRupiah } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Item Management = tampilan read-only katalog iPos NK (kode & nama selalu
// sinkron dari Neon). Karena sinkron iPos tiap 60 detik menimpa kolom lain,
// satu-satunya aksi yang aman & persist = upload foto (R2 / gambar_key yang
// tidak disentuh sinkron), hanya untuk item yang belum punya foto.

const MAX_CELL = 42000;

// Browser modern semua bisa encode WebP — cek sekali saja
const WEBP_OK = (() => {
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
})();

async function fileToCompressedDataUrl(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('File bukan gambar valid'));
    image.src = dataUrl;
  });

  // Sumber PNG/WebP (ber-alpha) → simpan WebP transparan (jauh lebih ringan
  // dari PNG, tanpa latar hitam). JPG sumber → JPEG latar putih.
  const alpha = /image\/(png|webp)/i.test(file.type);
  const mime = alpha ? (WEBP_OK ? 'image/webp' : 'image/png') : 'image/jpeg';

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  let scale = Math.min(1, 520 / Math.max(img.naturalWidth, img.naturalHeight));
  let quality = 0.85;

  const draw = () => {
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL(mime, quality);
  };

  let out = draw();

  // WebP mengecil drastis tiap -12% skala → konvergen 1–2 iterasi saja
  while (out.length > MAX_CELL && scale > 0.14) {
    if (!alpha || !WEBP_OK) {
      if (quality > 0.5) quality -= 0.12;
      else scale *= 0.8;
    } else {
      scale *= 0.88;
    }
    out = draw();
  }

  return out;
}

type SortKey = 'nama-asc' | 'nama-desc' | 'kode-asc' | 'kode-desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'nama-asc', label: 'Nama A–Z' },
  { key: 'nama-desc', label: 'Nama Z–A' },
  { key: 'kode-asc', label: 'Kode A–Z' },
  { key: 'kode-desc', label: 'Kode Z–A' },
];

export default function ItemManagement() {
  const { session } = useAuth();
  const [items, setItems] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('nama-asc');
  const [uploadingKode, setUploadingKode] = useState<string | null>(null);
  const { confirm, dialog } = useDialog();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pendingKode = useRef('');

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    try {
      const res = await katalog.getAll();
      if (res.status === 'ok' && res.data) {
        setItems(res.data);
      }
    } catch (e) {
      console.error('Failed to load items:', e);
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    const searchLower = search.toLowerCase();
    const list = items.filter(
      (item) =>
        (item.NAMA_BARANG && item.NAMA_BARANG.toLowerCase().includes(searchLower)) ||
        (item.KODE_BARANG && item.KODE_BARANG.toLowerCase().includes(searchLower)) ||
        (item.KATEGORI && item.KATEGORI.toLowerCase().includes(searchLower))
    );
    const dir = sort.endsWith('desc') ? -1 : 1;
    const key = sort.startsWith('kode') ? 'KODE_BARANG' : 'NAMA_BARANG';
    return list.sort(
      (a, b) => dir * String(a[key] || '').localeCompare(String(b[key] || ''), 'id'),
    );
  }, [items, search, sort]);

  // Render bertahap — ribuan kartu sekaligus membuat browser macet
  const PAGE_SIZE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, sort]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount],
  );

  const remainingCount = filteredItems.length - visibleItems.length;

  const pickPhoto = (kode: string) => {
    pendingKode.current = kode;
    fileRef.current?.click();
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const kode = pendingKode.current;
    if (!file || !kode) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Ukuran file maksimal 8MB (otomatis dikompres)');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    setUploadingKode(kode);
    try {
      const dataUrl = await fileToCompressedDataUrl(file);
      // Hanya kirim { kode, gambar } → server update gambar_key saja,
      // kolom lain (nama/kategori/harga/stok) tidak disentuh.
      const res = await katalog.update({ kode, gambar: dataUrl });
      if (res?.status === 'ok') {
        setGambarCache(kode, dataUrl);
        setItems((prev) =>
          prev.map((it) => (it.KODE_BARANG === kode ? { ...it, GAMBAR: dataUrl } : it)),
        );
        toastSuccess('Foto item berhasil disimpan');
      } else {
        toast.error(res?.message || 'Gagal menyimpan foto');
      }
    } catch {
      toast.error('Gagal memproses / mengunggah gambar');
    } finally {
      setUploadingKode(null);
    }
  };

  const handleDeletePhoto = async (kode: string) => {
    const ok = await confirm({
      icon: '🗑️',
      title: 'Hapus Foto Item?',
      message: 'Foto item ini akan dihapus permanen. Data item (kode/nama/harga) tetap utuh.',
      okText: 'Ya, Hapus Foto',
      okVariant: 'destructive',
    });
    if (!ok) return;
    setUploadingKode(kode);
    try {
      // gambar: '' → server set gambar_key = null + hapus file R2 lama.
      const res = await katalog.update({ kode, gambar: '' });
      if (res?.status === 'ok') {
        setGambarCache(kode);
        setItems((prev) =>
          prev.map((it) => (it.KODE_BARANG === kode ? { ...it, GAMBAR: '' } : it)),
        );
        toastSuccess('Foto item berhasil dihapus');
      } else {
        toast.error(res?.message || 'Gagal menghapus foto');
      }
    } catch {
      toast.error('Gagal menghapus foto');
    } finally {
      setUploadingKode(null);
    }
  };

  if (!session || session.role !== 'admin') {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <Icon name="lock" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Akses Ditolak</h2>
          <p className="text-muted-foreground mt-2">Hanya admin yang dapat melihat item</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kelola Item</h1>
            <p className="text-muted-foreground mt-2">
              Katalog iPos NK · {APP.location} — data kode & nama selalu sinkron. Bisa diubah
              hanya foto item (upload/ganti/hapus).
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Input
            placeholder="Cari berdasarkan nama, kode, atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          <div className="flex items-center gap-1">
            <span className="mr-1 hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
              <Icon name="sort" size={14} /> Urutkan:
            </span>
            {SORT_OPTIONS.map((o) => (
              <Button
                key={o.key}
                size="sm"
                variant={sort === o.key ? 'default' : 'outline'}
                onClick={() => setSort(o.key)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhoto}
        />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6">
                <Skeleton className="h-32 w-full mb-4" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleItems.map((item) => {
              const hasPhoto = Boolean(item.GAMBAR);
              return (
                <Card key={item.KODE_BARANG} className="overflow-hidden transition-all hover:shadow-lg">
                  <div className="relative h-48 bg-muted overflow-hidden">
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Icon name="image" size={48} />
                    </div>
                    <BarangImage kode={item.KODE_BARANG} />
                  </div>
                  <CardContent className="p-6">
                    <h3 className="font-semibold truncate text-lg">{item.NAMA_BARANG}</h3>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <Icon name="tag" size={12} />
                      {item.KODE_BARANG}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                      <Icon name="price-tag" size={12} />
                      {formatRupiah(Number(item.HARGA) || 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.KATEGORI || '-'} • {item.SATUAN || '-'}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 text-xs">
                        <Icon name="package" size={12} className="text-success" />
                        <span className="font-medium">Stok: {item.STOK_SISTEM || item.STOK || 0}</span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" className="mt-4 w-full">
                          <Icon name="menu-dots" size={16} className="mr-2" />
                          Aksi
                          <Icon name="angle-small-down" size={14} className="ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          disabled={uploadingKode === item.KODE_BARANG}
                          onClick={() => pickPhoto(item.KODE_BARANG)}
                        >
                          <Icon name="upload" size={14} className="mr-2" />
                          {uploadingKode === item.KODE_BARANG
                            ? 'Mengunggah…'
                            : hasPhoto
                              ? 'Ganti Foto'
                              : 'Upload Foto'}
                        </DropdownMenuItem>
                        {hasPhoto && (
                          <DropdownMenuItem
                            disabled={uploadingKode === item.KODE_BARANG}
                            onClick={() => void handleDeletePhoto(item.KODE_BARANG)}
                            className="text-danger focus:text-danger"
                          >
                            <Icon name="trash" size={14} className="mr-2" />
                            Hapus Foto
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {remainingCount > 0 && !loading && (
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              onClick={() => setVisibleCount((c) => c + 48)}
            >
              Tampilkan lebih banyak — sisa {remainingCount} item
            </Button>
          </div>
        )}

        {filteredItems.length === 0 && !loading && (
          <div className="text-center py-20">
            <Icon name="search" size={48} className="mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Tidak ada item ditemukan</h3>
            <p className="text-muted-foreground mt-2">Coba ubah kata kunci pencarian</p>
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}
