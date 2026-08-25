import { Icon } from '../components/ui/icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { toastSuccess } from '@/lib/toast';
import { katalog } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { APP, type Barang } from '@/lib/config';
import { cn, formatRupiah, formatWita } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ItemForm {
  KODE_BARANG: string;
  NAMA_BARANG: string;
  KATEGORI: string;
  SATUAN: string;
  HARGA: number | '';
  STOK: number | '';
  STOK_GUDANG: number | '';
  STOK_TOKO: number | '';
  CATATAN?: string;
  GAMBAR?: string;
}

const driveThumb = (fileId?: string | null) =>
  fileId ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(String(fileId))}&sz=w400` : '';

const DEFAULT_CATEGORIES = [
  'Kursi', 'Meja', 'Lemari', 'Sofa', 'Kasur', 'Rak', 'Bufet', 'Dapur',
  'Elektronik', 'Dekorasi', 'Peralatan Dapur', 'Peralatan Makan',
  'Peralatan Mandi', 'Loker', 'Rak Buku'
];

const DEFAULT_UNITS = ['Piece', 'Box', 'Pack', 'Set', 'Unit', 'Bungkus', 'Lembar'];

export default function ItemManagement() {
  const { session } = useAuth();
  const [items, setItems] = useState<Barang[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<Barang | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState<ItemForm>({
    KODE_BARANG: '',
    NAMA_BARANG: '',
    KATEGORI: 'Kursi',
    SATUAN: 'Piece',
    HARGA: '',
    STOK: '',
    STOK_GUDANG: '',
    STOK_TOKO: '',
    CATATAN: '',
  });

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
    return items.filter(
      (item) =>
        (item.NAMA_BARANG && item.NAMA_BARANG.toLowerCase().includes(searchLower)) ||
        (item.KODE_BARANG && item.KODE_BARANG.toLowerCase().includes(searchLower)) ||
        (item.KATEGORI && item.KATEGORI.toLowerCase().includes(searchLower))
    );
  }, [items, search]);

  const handleEdit = (item: Barang) => {
    setSelectedItem(item);
    setForm({
      KODE_BARANG: item.KODE_BARANG || '',
      NAMA_BARANG: item.NAMA_BARANG || '',
      KATEGORI: item.KATEGORI || 'Kursi',
      SATUAN: item.SATUAN || 'Piece',
      HARGA: item.HARGA ? Number(item.HARGA) : '',
      STOK: item.STOK ? Number(item.STOK) : '',
      STOK_GUDANG: item.STOK_GUDANG ? Number(item.STOK_GUDANG) : '',
      STOK_TOKO: item.STOK_TOKO ? Number(item.STOK_TOKO) : '',
      CATATAN: item.DESKRIPSI ? String(item.DESKRIPSI) : '',
    });
    setShowModal(true);
  };

  const handleDelete = async (kodeBarang: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus item ini?')) return;
    try {
      const res = await katalog.remove(kodeBarang);
      if (res?.status === 'ok') {
        toastSuccess('Item berhasil dihapus');
        await katalog.refresh().catch(() => undefined);
        loadItems();
      } else {
        toast.error(res?.message || 'Gagal menghapus item');
      }
    } catch (e) {
      toast.error('Error menghapus item');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.NAMA_BARANG || !form.KODE_BARANG) {
      toast.error('Kode dan nama barang wajib diisi');
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        kode: form.KODE_BARANG,
        nama: form.NAMA_BARANG,
        kategori: form.KATEGORI,
        satuan: form.SATUAN,
        harga: form.HARGA || 0,
        stok: form.STOK || 0,
        stokGudang: form.STOK_GUDANG === '' ? undefined : form.STOK_GUDANG,
        stokToko: form.STOK_TOKO === '' ? undefined : form.STOK_TOKO,
        deskripsi: form.CATATAN || '',
      };
      if (typeof form.GAMBAR === 'string') {
        payload.gambar = form.GAMBAR;
      }
      let res;
      if (selectedItem?.KODE_BARANG) {
        res = await katalog.update(payload);
        if (res?.status === 'ok') {
          toastSuccess('Item berhasil diupdate');
        }
      } else {
        res = await katalog.create(payload);
        if (res?.status === 'ok') {
          toastSuccess('Item baru berhasil ditambahkan');
        }
      }
      if (res?.status !== 'ok') {
        toast.error(res?.message || 'Gagal menyimpan item');
        return;
      }
      setShowModal(false);
      await katalog.refresh().catch(() => undefined);
      loadItems();
    } catch (e) {
      toast.error('Error menyimpan item');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setForm({
      KODE_BARANG: '',
      NAMA_BARANG: '',
      KATEGORI: 'Kursi',
      SATUAN: 'Piece',
      HARGA: '',
      STOK: '',
      STOK_GUDANG: '',
      STOK_TOKO: '',
      CATATAN: '',
    });
    setSelectedItem(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 2MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setForm((prev) => ({ ...prev, GAMBAR: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  if (!session || session.role !== 'admin') {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="text-center">
          <Icon name="lock" size={48} className="mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Akses Ditolak</h2>
          <p className="text-muted-foreground mt-2">Hanya admin yang dapat mengelola item</p>
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
            <p className="text-muted-foreground mt-2">Manajemen item/barang, harga, stok, dan gambar</p>
          </div>
          <Button onClick={() => { resetForm(); setShowModal(true); }}>
            <Icon name="plus-circle" size={18} className="mr-2" />
            Tambah Item Baru
          </Button>
        </div>

        <div className="mb-6 flex gap-3">
          <Input
            placeholder="Cari berdasarkan nama, kode, atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </div>

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
            {filteredItems.map((item) => (
              <Card key={item.KODE_BARANG} className="overflow-hidden group transition-all hover:shadow-lg">
                <div className="relative h-48 bg-muted overflow-hidden">
                  {item.GAMBAR ? (
                    <img
                      src={driveThumb(item.GAMBAR as string)}
                      alt={item.NAMA_BARANG}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Icon name="image" size={48} />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleEdit(item)}
                      className="h-8 w-8 rounded-full bg-white/90 shadow-sm hover:bg-white"
                    >
                      <Icon name="pencil" size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(item.KODE_BARANG)}
                      className="h-8 w-8 rounded-full shadow-sm hover:opacity-90"
                    >
                      <Icon name="trash" size={14} />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate text-lg">{item.NAMA_BARANG}</h3>
                      <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                        <Icon name="tag" size={12} />
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="box" size={24} />
              {selectedItem ? 'Edit Item' : 'Tambah Item Baru'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="kodeBarang">Kode Barang <span className="text-destructive">*</span></Label>
                <Input
                  id="kodeBarang"
                  value={form.KODE_BARANG}
                  onChange={(e) => setForm({ ...form, KODE_BARANG: e.target.value })}
                  placeholder="Contoh: BRG-001"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="namaBarang">Nama Barang <span className="text-destructive">*</span></Label>
                <Input
                  id="namaBarang"
                  value={form.NAMA_BARANG}
                  onChange={(e) => setForm({ ...form, NAMA_BARANG: e.target.value })}
                  placeholder="Contoh: Kursi Tamu Premium"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="kategori">Kategori</Label>
                <Select value={form.KATEGORI} onValueChange={(v) => setForm({ ...form, KATEGORI: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="satuan">Satuan</Label>
                <Select value={form.SATUAN} onValueChange={(v) => setForm({ ...form, SATUAN: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih satuan" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="harga">Harga <span className="text-destructive">*</span></Label>
                <Input
                  id="harga"
                  type="number"
                  value={form.HARGA}
                  onChange={(e) => setForm({ ...form, HARGA: e.target.value ? Number(e.target.value) : '' })}
                  placeholder="Contoh: 500000"
                  required
                  min="0"
                />
                <p className="text-xs text-muted-foreground">Harga dalam Rupiah (tanpa titik/koma)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stok">Stok Sistem</Label>
                <Input
                  id="stok"
                  type="number"
                  value={form.STOK}
                  onChange={(e) => setForm({ ...form, STOK: e.target.value ? Number(e.target.value) : '' })}
                  placeholder="Contoh: 50"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stokGudang">Stok Gudang</Label>
                <Input
                  id="stokGudang"
                  type="number"
                  value={form.STOK_GUDANG}
                  onChange={(e) => setForm({ ...form, STOK_GUDANG: e.target.value ? Number(e.target.value) : '' })}
                  placeholder="Contoh: 30"
                  min="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="stokToko">Stok Toko</Label>
                <Input
                  id="stokToko"
                  type="number"
                  value={form.STOK_TOKO}
                  onChange={(e) => setForm({ ...form, STOK_TOKO: e.target.value ? Number(e.target.value) : '' })}
                  placeholder="Contoh: 20"
                  min="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="gambar">Gambar Item</Label>
              <div className="flex flex-col gap-3">
                {(() => {
                  const previewSrc = form.GAMBAR === undefined
                    ? driveThumb(selectedItem?.GAMBAR as string | undefined)
                    : form.GAMBAR;
                  return previewSrc ? (
                    <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-border">
                      <img
                        src={previewSrc}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, GAMBAR: '' })}
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90"
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
                      <div className="text-center">
                        <Icon name="image" size={32} className="mx-auto text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground">No image selected</p>
                      </div>
                    </div>
                  );
                })()}
                <div className="flex gap-3">
                  <label className="cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                    <Icon name="upload" size={16} />
                    Upload Gambar
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">Rekomendasi: JPG/PNG, maksimal 2MB</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="catatan">Catatan/Tambahan</Label>
              <Textarea
                id="catatan"
                value={form.CATATAN}
                onChange={(e) => setForm({ ...form, CATATAN: e.target.value })}
                placeholder="Informasi tambahan tentang item..."
                className="min-h-[80px]"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Icon name="loader" size={18} className="animate-spin mr-2" />}
                {selectedItem ? 'Simpan Perubahan' : 'Tambah Item'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
