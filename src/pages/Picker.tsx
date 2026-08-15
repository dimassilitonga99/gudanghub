import { Icon } from '../components/ui/icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { orders as ordersApi, callApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { CABANG, type Order, type DetailItem } from '@/lib/config';
import { cn, formatWita, parseAnyDate } from '@/lib/utils';
import { useDialog } from '@/lib/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

const PICKER_DATA_KEY = 'gudanghub_picker_data';

interface PickerItemData {
  value: string;
  locked: boolean;
  history: { value: string; time: string; action: string }[];
}

function loadPickerData(): Record<string, PickerItemData> {
  try {
    const raw = localStorage.getItem(PICKER_DATA_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PickerItemData>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function padZ(n: number): string {
  return String(n).padStart(2, '0');
}

function formatDateInput(d: Date): string {
  return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`;
}

export default function Picker() {
  const { session } = useAuth();
  const { confirm, dialog } = useDialog();

  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [filterToko, setFilterToko] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterQuick, setFilterQuick] = useState('month');
  const [pickerData, setPickerData] = useState<Record<string, PickerItemData>>(() => loadPickerData());
  const [pickerNote, setPickerNote] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const pickerDataRef = useRef(pickerData);
  pickerDataRef.current = pickerData;

  const assignedCabang = useMemo(() => {
    const raw = String(session?.idCabang || '').trim().toUpperCase();
    if (raw) return raw.split(',').map((c) => c.trim()).filter(Boolean);
    return Object.keys(CABANG);
  }, [session?.idCabang]);

  const savePickerData = useCallback((data: Record<string, PickerItemData>) => {
    setPickerData(data);
    try {
      localStorage.setItem(PICKER_DATA_KEY, JSON.stringify(data));
    } catch {
      /* storage penuh */
    }
  }, []);

  const getItemData = useCallback(
    (orderId: string, idx: number): PickerItemData => {
      const key = `${orderId}_${idx}`;
      const data = pickerDataRef.current[key];
      if (data) return data;
      const fresh: PickerItemData = { value: '', locked: false, history: [] };
      const next = { ...pickerDataRef.current, [key]: fresh };
      pickerDataRef.current = next;
      return fresh;
    },
    [],
  );

  const setItemValue = useCallback(
    (orderId: string, idx: number, value: string) => {
      const key = `${orderId}_${idx}`;
      const data = pickerDataRef.current[key] || { value: '', locked: false, history: [] };
      const now = new Date();
      const timeStr = `${padZ(now.getHours())}:${padZ(now.getMinutes())}:${padZ(now.getSeconds())}`;
      const dateStr = `${padZ(now.getDate())}/${padZ(now.getMonth() + 1)}`;
      const action = data.history.length === 0 ? 'Diisi pertama' : `Diedit ke-${data.history.length}`;
      const next = {
        ...pickerDataRef.current,
        [key]: {
          value,
          locked: true,
          history: [...data.history, { value, time: `${dateStr} ${timeStr}`, action }],
        },
      };
      savePickerData(next);
    },
    [savePickerData],
  );

  const unlockItem = useCallback(
    (orderId: string, idx: number) => {
      const key = `${orderId}_${idx}`;
      const data = pickerDataRef.current[key];
      if (!data) return;
      savePickerData({ ...pickerDataRef.current, [key]: { ...data, locked: false } });
    },
    [savePickerData],
  );

  const loadOrders = useCallback(async () => {
    try {
      const result = await ordersApi.getAll({ cache: false });
      if (result.status !== 'ok') throw new Error(String(result.message || 'Gagal memuat'));
      const all = (result.data as Order[] | undefined) || [];
      const branchOrders = all
        .filter((o) => assignedCabang.indexOf(String(o.ID_CABANG || '').toUpperCase()) !== -1)
        .sort((a, b) => {
          const da = parseAnyDate(String(a.TANGGAL_ORDER || ''));
          const db = parseAnyDate(String(b.TANGGAL_ORDER || ''));
          return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
        });
      setAllOrders(branchOrders);
      setLoading(false);
    } catch (error) {
      toast.error('Gagal: ' + (error as Error).message);
      setLoading(false);
    }
  }, [assignedCabang]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const applyQuickDate = useCallback((type: string) => {
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
    setFilterDateFrom(from);
    setFilterDateTo(to);
    setFilterQuick(type);
  }, []);

  useEffect(() => {
    applyQuickDate(filterQuick || 'month');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getFilteredOrders = useCallback(
    (orders: Order[]) => {
      let filtered = orders;
      if (filter !== 'ALL') {
        filtered = filtered.filter((o) => String(o.STATUS || '').toUpperCase() === filter);
      }
      if (filterToko) {
        filtered = filtered.filter((o) => String(o.ID_CABANG || '').toUpperCase() === filterToko);
      }
      if (filterDateFrom || filterDateTo) {
        filtered = filtered.filter((o) => {
          const orderDate = parseAnyDate(String(o.TANGGAL_ORDER || ''));
          if (!orderDate || orderDate.getTime() === 0) return false;
          const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
          if (filterDateFrom) {
            const [y, m, d] = filterDateFrom.split('-').map(Number);
            if (orderDateOnly < new Date(y, m - 1, d)) return false;
          }
          if (filterDateTo) {
            const [y, m, d] = filterDateTo.split('-').map(Number);
            if (orderDateOnly > new Date(y, m - 1, d)) return false;
          }
          return true;
        });
      }
      return filtered;
    },
    [filter, filterToko, filterDateFrom, filterDateTo],
  );

  const filtered = useMemo(() => getFilteredOrders(allOrders), [allOrders, getFilteredOrders]);

  const stats = useMemo(() => {
    let pending = 0;
    let picked = 0;
    let approved = 0;
    let rejected = 0;
    for (const o of filtered) {
      const s = String(o.STATUS || '').toUpperCase();
      if (s === 'PENDING') pending++;
      else if (s === 'PICKED') picked++;
      else if (s === 'APPROVED') approved++;
      else if (s === 'REJECTED') rejected++;
    }
    return { pending, picked, approved, rejected, total: filtered.length };
  }, [filtered]);

  const tokoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of allOrders) {
      const id = String(o.ID_CABANG || '').toUpperCase();
      counts[id] = (counts[id] || 0) + 1;
    }
    return counts;
  }, [allOrders]);

  const itemsOf = useCallback((order: Order): DetailItem[] => {
    return ((order.DETAIL as DetailItem[] | undefined) || []).filter(
      (d) => String(d.ITEM_STATUS || 'APPROVED').toUpperCase() !== 'DELETED',
    );
  }, []);

  const getItemRow = useCallback(
    (orderId: string, item: DetailItem, idx: number) => {
      const itemData = getItemData(orderId, idx);
      const qtyOrder = toIntNum(item.QTY);
      const serverPicker =
        item.STOK_PICKER !== undefined && item.STOK_PICKER !== '' ? String(item.STOK_PICKER) : '';
      let currentValue = itemData.value !== '' ? itemData.value : serverPicker;
      let isLocked = itemData.locked || (serverPicker !== '' && itemData.value === '');

      if (itemData.value === '' && serverPicker !== '') {
        const key = `${orderId}_${idx}`;
        const history =
          itemData.history.length === 0
            ? [{ value: serverPicker, time: 'dari server', action: 'Sinkron' }]
            : itemData.history;
        savePickerData({
          ...pickerDataRef.current,
          [key]: { value: serverPicker, locked: true, history },
        });
        currentValue = serverPicker;
        isLocked = true;
      }

      const isFilled = currentValue !== '';
      const editCount = itemData.history.length;
      const pickerInt = parseInt(currentValue) || 0;
      const qtyColor = isFilled && pickerInt < qtyOrder ? 'text-danger' : isFilled ? 'text-success' : 'text-brand';
      const lastEntry = itemData.history[itemData.history.length - 1];

      return { itemData, currentValue, isLocked, isFilled, editCount, lastEntry, qtyOrder, qtyColor };
    },
    [getItemData, savePickerData],
  );

  const getPickerNote = useCallback((order: Order): string => {
    const details = itemsOf(order);
    for (const d of details) {
      const reason = String(d.REASON || '');
      const match = reason.match(/\[PICKER\]\s*(.*)/);
      if (match) return match[1].trim();
    }
    return '';
  }, [itemsOf]);

  const submitPicked = async (order: Order) => {
    const orderId = String(order.ORDER_ID);
    const details = itemsOf(order);
    const stokData = details.map((_item, idx) => {
      const data = pickerDataRef.current[`${orderId}_${idx}`] || { value: '', locked: false, history: [] };
      return {
        index: idx,
        stokPicker: data.value,
        editCount: data.history.length,
        lastEdit: data.history.length > 0 ? data.history[data.history.length - 1].time : '',
      };
    });
    const filledCount = stokData.filter((s) => s.stokPicker !== '').length;

    if (filledCount === 0) {
      toast.warning('Isi minimal 1 stok barang.', { duration: 4000 });
      return;
    }

    const unlockedCount = details.filter((_item, idx) => {
      const data = pickerDataRef.current[`${orderId}_${idx}`];
      return data && data.value !== '' && !data.locked;
    }).length;
    if (unlockedCount > 0) {
      toast.warning(`${unlockedCount} item belum dikunci. Kunci semua sebelum submit.`, { duration: 4000 });
      return;
    }

    const pickerNoteText = pickerNote[orderId] ?? getPickerNote(order);
    const isResubmit = String(order.STATUS || '').toUpperCase() === 'PICKED';

    const ok = await confirm({
      icon: isResubmit ? '🔄' : '📋',
      title: isResubmit ? 'Update Verifikasi?' : 'Kirim Verifikasi?',
      message: `Order ${orderId}\n\n${filledCount} dari ${details.length} item sudah diisi.\n\n${
        isResubmit ? 'Perubahan akan langsung terkirim ke Admin.' : 'Status akan berubah menjadi PICKED.'
      }`,
      okText: isResubmit ? 'Ya, Update' : 'Ya, Kirim',
    });
    if (!ok) return;

    setSendingId(orderId);
    try {
      toast.info('Mengirim...', { duration: 10000 });
      const result = await callApi(
        'pickerVerify',
        {
          orderId,
          pickerUsername: session?.username || '',
          pickerNama: session?.nama || session?.username || '',
          stokData,
          pickerNote: pickerNoteText,
        },
        { dedupe: false, timeout: 30000 },
      );
      if (result.status !== 'ok') {
        toast.error(String(result.message || 'Gagal.'));
        return;
      }
      toast.success(isResubmit ? 'Verifikasi diupdate!' : 'Verifikasi dikirim!', { duration: 4000 });
      await loadOrders();
    } catch (error) {
      toast.error('Gagal: ' + (error as Error).message);
    } finally {
      setSendingId(null);
    }
  };

  const emptyMsg = useMemo(() => {
    let msg = 'Tidak ada order';
    if (filter !== 'ALL') msg += ` status "${filter}"`;
    if (filterToko) {
      const tokoInfo = CABANG[filterToko];
      msg += ` dari ${tokoInfo ? tokoInfo.nama : filterToko}`;
    }
    if (filterDateFrom || filterDateTo) msg += ' pada periode terpilih';
    return msg + '.';
  }, [filter, filterToko, filterDateFrom, filterDateTo]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Picker</h1>
          <p className="text-sm text-muted-foreground">
            {session?.nama || session?.username} · Verifikasi stok barang sebelum pesanan diproses admin.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void loadOrders()}>
          <Icon name="refresh" size={16} /> Muat Ulang
        </Button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ['Menunggu', stats.pending, 'text-warning', 'clock'],
            ['Sudah Dicek', stats.picked, 'text-info', 'check-double'],
            ['Disetujui', stats.approved, 'text-success', 'check-circle'],
            ['Total', stats.total, 'text-foreground', 'package'],
          ] as const
        ).map(([label, value, color, name]) => (
          <Card key={label}>
            <CardContent className="p-3">
              <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <Icon name={name} size={12} /> {label}
              </div>
              <div className={cn('mt-1 text-2xl font-bold', color)}>{loading ? '-' : value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* FILTER TOKO */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold">
          <Icon name="shop" size={14} /> Toko:
        </span>
        <select
          value={filterToko}
          onChange={(e) => setFilterToko(e.target.value)}
          className="h-9 min-w-52 flex-1 rounded-md border border-input bg-background px-3 text-sm sm:flex-none"
        >
          <option value="">
            Semua Toko ({assignedCabang.length} cabang, {allOrders.length} order)
          </option>
          {assignedCabang.map((cabangId) => {
            const info = CABANG[cabangId] || { nama: cabangId };
            return (
              <option key={cabangId} value={cabangId}>
                {cabangId} — {info.nama} ({tokoCounts[cabangId] || 0} order)
              </option>
            );
          })}
        </select>
      </div>

      {/* FILTER TANGGAL */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs font-semibold">
          <Icon name="calendar" size={14} /> Tanggal:
        </span>
        <Input
          type="date"
          value={filterDateFrom}
          onChange={(e) => {
            setFilterDateFrom(e.target.value);
            setFilterQuick('');
          }}
          className="h-8 w-36 text-xs dark:[color-scheme:dark]"
          title="Dari"
        />
        <span className="text-xs text-muted-foreground">s/d</span>
        <Input
          type="date"
          value={filterDateTo}
          onChange={(e) => {
            setFilterDateTo(e.target.value);
            setFilterQuick('');
          }}
          className="h-8 w-36 text-xs dark:[color-scheme:dark]"
          title="Sampai"
        />
        <div className="flex flex-wrap gap-1">
          {(
            [
              ['month', 'Bulan Ini'],
              ['week', '7 Hari'],
              ['today', 'Hari Ini'],
              ['all', 'Semua'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => applyQuickDate(value)}
              className={cn(
                'flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                filterQuick === value ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground',
              )}
            >
              <Icon name="calendar" size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* FILTER STATUS */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['ALL', 'Semua', 'list'],
            ['PENDING', 'Menunggu', 'clock'],
            ['PICKED', 'Sudah Dicek', 'check-double'],
            ['APPROVED', 'Disetujui', 'check-circle'],
          ] as const
        ).map(([value, label, name]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              'flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold',
              filter === value ? 'border-brand bg-brand/10 text-brand' : 'border-border text-muted-foreground',
            )}
          >
            <Icon name={name} size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ORDER LIST */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Icon name="package" size={40} className="mx-auto mb-2 text-muted" />
            <p className="text-sm text-muted-foreground">{emptyMsg}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
            <Icon name="package" size={12} />
            {filtered.length} order{filterToko || filterDateFrom || filterDateTo || filter !== 'ALL' ? ' (difilter)' : ''}
          </div>
          {filtered.map((order) => {
            const status = String(order.STATUS || 'PENDING').toUpperCase();
            const branch = CABANG[String(order.ID_CABANG || '')] || { nama: '-', pic: '-' };
            const details = itemsOf(order);
            const canEdit = status === 'PENDING' || status === 'PICKED';

            const filledItems = details.filter((item, idx) => {
              const data = pickerDataRef.current[`${order.ORDER_ID}_${idx}`];
              const serverPicker =
                item.STOK_PICKER !== undefined && item.STOK_PICKER !== '' ? String(item.STOK_PICKER) : '';
              return (data?.value ?? '') !== '' || serverPicker !== '';
            }).length;
            const progressPct = details.length > 0 ? Math.round((filledItems / details.length) * 100) : 0;
            const progressColor =
              progressPct === 100 ? 'bg-success' : progressPct > 0 ? 'bg-info' : 'bg-muted';

            const statusColor =
              status === 'PENDING'
                ? 'border-warning/40 bg-warning/15 text-warning'
                : status === 'PICKED'
                  ? 'border-info/40 bg-info/15 text-info'
                  : status === 'APPROVED'
                    ? 'border-success/40 bg-success/15 text-success'
                    : 'border-danger/40 bg-danger/15 text-danger';
            const statusLabel =
              status === 'PENDING'
                ? 'Menunggu'
                : status === 'PICKED'
                  ? 'Sudah Diverifikasi'
                  : status === 'APPROVED'
                    ? 'Disetujui'
                    : 'Ditolak';

            return (
              <Card key={String(order.ORDER_ID)}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{order.ORDER_ID}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Icon name="shop" size={12} /> {branch.nama || order.ID_CABANG}
                        </span>
                        <span>· PIC: {branch.pic || '-'}</span>
                        <span className="flex items-center gap-1">
                          <Icon name="calendar-clock" size={12} /> {formatWita(order.TANGGAL_ORDER)}
                        </span>
                        <span>· {details.length} item</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full transition-all', progressColor)}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <div className={cn('mt-1 text-[11px] font-semibold', progressPct === 100 ? 'text-success' : progressPct > 0 ? 'text-info' : 'text-muted-foreground')}>
                        {filledItems}/{details.length} diisi ({progressPct}%)
                      </div>
                    </div>
                    <Badge variant="outline" className={cn('gap-1', statusColor)}>
                      {status === 'PENDING' ? <Icon name="clock" size={12} /> : status === 'PICKED' ? <Icon name="check-double" size={12} /> : status === 'APPROVED' ? <Icon name="check-circle" size={12} /> : <Icon name="circle-xmark" size={12} />}
                      {statusLabel}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded-lg bg-muted/40 px-3 py-1.5 text-[10px] font-bold tracking-wide text-muted-foreground">
                    <div>STATUS</div>
                    <div>BARANG</div>
                    <div className="text-center">ORDER</div>
                    <div className="text-center">DISIAPKAN</div>
                    <div className="text-center">RIWAYAT</div>
                  </div>

                  <div className="space-y-1.5">
                    {details.map((item, idx) => {
                      const row = getItemRow(String(order.ORDER_ID), item, idx);
                      const isLocked = row.isLocked;
                      const isFilled = row.isFilled;
                      return (
                        <div
                          key={`${String(item.KODE_BARANG)}-${idx}`}
                          className={cn(
                            'grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded-lg border border-border bg-card px-3 py-2',
                            isLocked && 'border-success/30 bg-success/5',
                            isFilled && !isLocked && 'border-warning/30 bg-warning/5',
                          )}
                        >
                          <div className="flex items-center">
                            {isFilled && isLocked ? (
                              <span title="Terkunci">
                                <Icon name="check-circle" size={16} className="text-success" />
                              </span>
                            ) : isFilled && !isLocked ? (
                              <span title="Sedang diedit">
                                <Icon name="edit" size={16} className="text-warning" />
                              </span>
                            ) : (
                              <span title="Belum diisi">
                                <Icon name="circle" size={16} className="text-muted-foreground/50" />
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold">
                              {item.NAMA_BARANG || '-'}
                              {item.CATATAN_ITEM && (
                                <span className="italic text-danger"> ({item.CATATAN_ITEM})</span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {item.KODE_BARANG || '-'} · {item.SATUAN || 'PCS'}
                            </div>
                          </div>

                          <div className={cn('w-10 text-center text-sm font-bold', row.qtyColor)}>{row.qtyOrder}</div>

                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              placeholder="0"
                              value={row.currentValue}
                              readOnly={isLocked && canEdit}
                              disabled={!canEdit}
                              onChange={(e) => {
                                const key = `${order.ORDER_ID}_${idx}`;
                                const data = pickerDataRef.current[key];
                                if (data) {
                                  savePickerData({
                                    ...pickerDataRef.current,
                                    [key]: { ...data, value: e.target.value },
                                  });
                                }
                              }}
                              onBlur={(e) => {
                                if (isLocked || !canEdit) return;
                                const v = e.target.value.trim();
                                if (v !== '') {
                                  setItemValue(String(order.ORDER_ID), idx, v);
                                  toast.success('Item dikunci ✓', { duration: 1000 });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  (e.target as HTMLInputElement).blur();
                                }
                              }}
                              className={cn('h-8 w-20 px-1 text-center text-sm font-bold', isFilled && 'text-success')}
                            />
                            {isLocked && canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Edit kembali"
                                onClick={() => {
                                  void (async () => {
                                    const key = `${order.ORDER_ID}_${idx}`;
                                    const data = pickerDataRef.current[key];
                                    const ok = await confirm({
                                      icon: '🔓',
                                      title: 'Edit Kembali?',
                                      message: `Item ini sudah dikunci dengan nilai: ${data?.value ?? ''}\n\nRiwayat edit: ${data?.history.length ?? 0} kali\n\nApakah Anda yakin ingin mengedit kembali?`,
                                      okText: 'Ya, Edit',
                                    });
                                    if (ok) {
                                      unlockItem(String(order.ORDER_ID), idx);
                                      toast.info('Input terbuka — silakan edit.', { duration: 2000 });
                                    }
                                  })();
                                }}
                              >
                                <Icon name="lock" size={14} className="text-muted-foreground" />
                              </Button>
                            )}
                            {!isLocked && canEdit && isFilled && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Kunci"
                                onClick={() => {
                                  const key = `${order.ORDER_ID}_${idx}`;
                                  const data = pickerDataRef.current[key];
                                  if (data && data.value.trim() !== '') {
                                    setItemValue(String(order.ORDER_ID), idx, data.value.trim());
                                    toast.success('Item dikunci ✓', { duration: 1000 });
                                  }
                                }}
                              >
                                <Icon name="check" size={14} className="text-success" />
                              </Button>
                            )}
                          </div>

                          <div className="w-14 text-center">
                            {row.editCount > 0 && row.lastEntry ? (
                              <div
                                className="mx-auto inline-block rounded-lg bg-info/15 px-1.5 py-0.5 text-[10px] font-bold text-info"
                                title={row.itemData.history
                                  .map((h, i) => `${i + 1}. ${h.action}: ${h.value} (${h.time})`)
                                  .join('\n')}
                              >
                                {row.editCount === 1 ? '1x' : `${row.editCount}x`}
                                <br />
                                <span className="text-[9px] font-normal opacity-80">{row.lastEntry.time}</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground/50">-</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {canEdit && (
                    <>
                      <div>
                        <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <Icon name="message-text" size={12} /> Catatan Picker
                        </div>
                        <Textarea
                          value={pickerNote[String(order.ORDER_ID)] ?? getPickerNote(order)}
                          onChange={(e) =>
                            setPickerNote((prev) => ({ ...prev, [String(order.ORDER_ID)]: e.target.value }))
                          }
                          rows={2}
                          placeholder="Tulis catatan untuk admin..."
                        />
                      </div>
                      <Button
                        className="w-full"
                        disabled={sendingId === String(order.ORDER_ID)}
                        onClick={() => void submitPicked(order)}
                      >
                        {status === 'PICKED' ? <Icon name="refresh" size={16} /> : <Icon name="paper-plane" size={16} />}
                        {sendingId === String(order.ORDER_ID)
                          ? 'Mengirim...'
                          : status === 'PICKED'
                            ? 'Update Verifikasi'
                            : 'Kirim Verifikasi ke Admin'}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {dialog}
    </div>
  );
}

function toIntNum(v: unknown): number {
  const n = parseInt(String(v), 10);
  return isNaN(n) ? 0 : n;
}