import { useCallback, useEffect, useMemo, useState } from 'react';
import { storeTakes } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';
import { SATUAN_OPTIONS, type Barang, type StoreTake } from '@/lib/config';
import { toInt } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Icon } from '@/components/ui/icon';

interface Draft {
  kode: string;
  nama: string;
  satuan: string;
  qty: number;
  stokToko: number | '';
}

/** Daftar batch ambil barang (dipakai cabang & admin). */
export function StoreTakeList({
  items,
  loading,
  showBranch,
}: {
  items: StoreTake[];
  loading?: boolean;
  showBranch?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!items.length)
    return <p className="py-8 text-center text-sm text-muted-foreground">Belum ada data ambil barang.</p>;

  return (
    <div className="space-y-3">
      {items.map((t) => {
        const open = openId === t.BATCH_ID;
        return (
          <Card key={t.BATCH_ID}>
            <CardContent className="p-4">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => setOpenId(open ? null : t.BATCH_ID)}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Icon name="package" size={14} className="text-brand" />
                    <span className="font-semibold">{t.PENGAMBIL}</span>
                    {showBranch && <Badge>{t.ID_CABANG}</Badge>}
                    <Badge variant="outline">{t.HARI}, {t.TANGGAL}</Badge>
                    <Badge variant="outline">{t.JAM}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.TOTAL_ITEM} jenis · {t.TOTAL_QTY} unit{t.TUJUAN ? ` · ${t.TUJUAN}` : ''}
                  </p>
                </div>
                <Icon
                  name="angle-small-right"
                  size={16}
                  className={open ? 'mt-1 shrink-0 rotate-90 transition-transform' : 'mt-1 shrink-0 transition-transform'}
                />
              </button>

              {open && (
                <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                  {(t.ITEMS || []).map((it) => (
                    <div key={it.KODE_BARANG} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {it.NAMA_BARANG}{' '}
                        <span className="text-muted-foreground">({it.KODE_BARANG})</span>
                      </span>
                      <span className="shrink-0 font-medium">{toInt(it.QTY)} {it.SATUAN}</span>
                    </div>
                  ))}
                  <div className="pt-2 text-xs text-muted-foreground">
                    Batch {t.BATCH_ID}
                    {t.DIBUAT_OLEH ? ` · dicatat oleh ${t.DIBUAT_OLEH}` : ''}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/** Form ambil barang + riwayat cabang. */
export function StoreTakeTab({
  katalogList,
  branchId,
  branchPic,
}: {
  katalogList: Barang[];
  branchId: string;
  branchPic: string;
}) {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<Draft[]>([]);
  const [pengambil, setPengambil] = useState(branchPic);
  const [tujuan, setTujuan] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<StoreTake[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await storeTakes.getAllFast((fresh) => setHistory((fresh.data as StoreTake[]) || []));
    if (r.status === 'ok') setHistory((r.data as StoreTake[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return katalogList
      .filter(
        (b) =>
          String(b.KODE_BARANG).toLowerCase().includes(q) ||
          String(b.NAMA_BARANG).toLowerCase().includes(q),
      )
      .slice(0, 20);
  }, [katalogList, search]);

  const add = (b: Barang) => {
    const kode = String(b.KODE_BARANG);
    setDraft((d) =>
      d.some((x) => x.kode === kode)
        ? d
        : [
            ...d,
            {
              kode,
              nama: String(b.NAMA_BARANG),
              satuan: String(b.SATUAN || 'PCS').toUpperCase(),
              qty: 1,
              stokToko: b.STOK_TOKO === undefined || b.STOK_TOKO === '' ? '' : toInt(b.STOK_TOKO),
            },
          ],
    );
    setSearch('');
  };

  const patch = (kode: string, p: Partial<Draft>) =>
    setDraft((d) => d.map((x) => (x.kode === kode ? { ...x, ...p } : x)));

  const submit = async () => {
    if (!draft.length) return toastError('Belum ada barang dipilih.');
    if (!pengambil.trim()) return toastError('Nama pengambil wajib diisi.');
    setSubmitting(true);
    const r = await storeTakes.submit({
      idCabang: branchId,
      pengambil: pengambil.trim(),
      tujuan: tujuan.trim(),
      items: draft.map((d) => ({ kode: d.kode, qty: d.qty, satuan: d.satuan, stokToko: d.stokToko })),
    });
    setSubmitting(false);
    if (r.status === 'ok') {
      toastSuccess('Barang berhasil dicatat!');
      setDraft([]);
      setTujuan('');
      void load();
    } else {
      toastError(String(r.message || 'Gagal menyimpan.'));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <h2 className="font-display text-lg font-bold">Ambil Barang</h2>
            <p className="text-sm text-muted-foreground">
              Catat barang yang diambil dari gudang toko {branchId}.
            </p>
          </div>

          <div className="relative">
            <Icon
              name="search"
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari kode atau nama barang..."
              type="search"
              className="pl-9"
            />
          </div>

          {results.length > 0 && (
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-1">
              {results.map((b) => (
                <button
                  key={String(b.KODE_BARANG)}
                  type="button"
                  onClick={() => add(b)}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  <span className="min-w-0 truncate">
                    {String(b.NAMA_BARANG)}{' '}
                    <span className="text-muted-foreground">({String(b.KODE_BARANG)})</span>
                  </span>
                  <Icon name="plus" size={14} className="shrink-0 text-brand" />
                </button>
              ))}
            </div>
          )}

          {draft.length > 0 && (
            <div className="space-y-2">
              {draft.map((d) => (
                <div key={d.kode} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {d.nama} <span className="text-muted-foreground">({d.kode})</span>
                  </span>
                  <Input
                    type="number"
                    min={1}
                    value={d.qty}
                    onChange={(e) => patch(d.kode, { qty: Math.max(1, toInt(e.target.value) || 1) })}
                    className="w-20"
                  />
                  <select
                    value={d.satuan}
                    onChange={(e) => patch(d.kode, { satuan: e.target.value })}
                    className="h-10 rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {SATUAN_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDraft((list) => list.filter((x) => x.kode !== d.kode))}
                    aria-label="Hapus"
                  >
                    <Icon name="trash" size={16} className="text-danger" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nama pengambil</span>
              <Input value={pengambil} onChange={(e) => setPengambil(e.target.value)} placeholder="Nama pengambil" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Tujuan / keterangan</span>
              <Input value={tujuan} onChange={(e) => setTujuan(e.target.value)} placeholder="Alasan barang diambil" />
            </label>
          </div>

          <Button onClick={() => void submit()} disabled={submitting} className="w-full sm:w-auto">
            <Icon name="floppy-disks" size={16} className="mr-2" />
            {submitting ? 'Menyimpan...' : 'Simpan Ambil Barang'}
          </Button>
        </CardContent>
      </Card>

      <div>
        <h3 className="mb-3 font-display text-lg font-bold">Riwayat Ambil Barang</h3>
        <StoreTakeList items={history} loading={loading} />
      </div>
    </div>
  );
}
