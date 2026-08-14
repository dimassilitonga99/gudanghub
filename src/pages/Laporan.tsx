import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  List,
  Package,
  PieChart,
  Store,
  User,
  XCircle,
} from 'lucide-react';
import { orders as ordersApi } from '@/lib/api';
import { CABANG, type Order } from '@/lib/config';
import { formatRupiah, formatWita, parseAnyDate, cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DetailItem {
  NAMA_BARANG?: string;
  KODE_BARANG?: string;
  QTY?: number | string;
  SATUAN?: string;
  HARGA_SATUAN?: number | string;
  ITEM_STATUS?: string;
  REASON?: string;
}

const PERIODS: Record<string, string> = {
  all: 'Semua Periode',
  today: 'Hari Ini',
  week: '7 Hari Terakhir',
  month: '30 Hari Terakhir',
  quarter: '3 Bulan Terakhir',
  year: '1 Tahun Terakhir',
};

function countByStatus(orders: Order[], status: string): number {
  return orders.filter((o) => String(o.STATUS || '').toUpperCase() === status).length;
}

function calcTotal(order: Order): number {
  const details = (order.DETAIL as DetailItem[] | undefined) || [];
  return details
    .filter((d) => String(d.ITEM_STATUS || 'APPROVED').toUpperCase() === 'APPROVED')
    .reduce((s, d) => s + (Number(d.QTY) || 0) * (Number(d.HARGA_SATUAN) || 0), 0);
}

function formatDateOnly(value: string | undefined | null): string {
  const d = parseAnyDate(value ?? '');
  if (!d) return '-';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default function Laporan() {
  const { session } = useAuth();
  const [ordersList, setOrdersList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCabang, setFilterCabang] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [filterStatus, setFilterStatus] = useState('');
  const [printedAt, setPrintedAt] = useState(() => new Date());

  const loadData = useCallback(async () => {
    try {
      const o = await ordersApi.getAll({ cache: false });
      setOrdersList(o.status === 'ok' ? ((o.data as Order[]) || []) : []);
    } catch (e) {
      toast.error('Gagal memuat laporan: ' + (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    let list = ordersList;
    if (filterCabang) {
      list = list.filter((o) => String(o.ID_CABANG || '').toUpperCase() === filterCabang);
    }
    if (filterStatus) {
      list = list.filter((o) => String(o.STATUS || '').toUpperCase() === filterStatus);
    }
    if (filterPeriod !== 'all') {
      const now = new Date();
      const cutoff = new Date();
      switch (filterPeriod) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setDate(now.getDate() - 30);
          break;
        case 'quarter':
          cutoff.setMonth(now.getMonth() - 3);
          break;
        case 'year':
          cutoff.setFullYear(now.getFullYear() - 1);
          break;
      }
      list = list.filter((o) => {
        const orderDate = parseAnyDate(o.TANGGAL_ORDER ?? '');
        return orderDate !== null && orderDate >= cutoff;
      });
    }
    return list;
  }, [ordersList, filterCabang, filterStatus, filterPeriod]);

  const stats = useMemo(() => {
    const approved = countByStatus(filtered, 'APPROVED');
    const pending = countByStatus(filtered, 'PENDING');
    const rejected = countByStatus(filtered, 'REJECTED');
    return {
      total: filtered.length,
      approved,
      pending,
      rejected,
      approvalRate: filtered.length > 0 ? Math.round((approved / filtered.length) * 100) : 0,
      rejectRate: filtered.length > 0 ? Math.round((rejected / filtered.length) * 100) : 0,
    };
  }, [filtered]);

  const perCabang = useMemo(() => {
    let grandTotal = 0;
    let grandPending = 0;
    let grandApproved = 0;
    let grandRejected = 0;
    const rows = Object.entries(CABANG).map(([id, info]) => {
      const branchOrders = filtered.filter((o) => String(o.ID_CABANG || '').toUpperCase() === id);
      const total = branchOrders.length;
      const pending = countByStatus(branchOrders, 'PENDING');
      const approved = countByStatus(branchOrders, 'APPROVED');
      const rejected = countByStatus(branchOrders, 'REJECTED');
      const rate = total > 0 ? Math.round((approved / total) * 100) : 0;
      grandTotal += total;
      grandPending += pending;
      grandApproved += approved;
      grandRejected += rejected;
      return { id, info, total, pending, approved, rejected, rate };
    });
    const grandRate = grandTotal > 0 ? Math.round((grandApproved / grandTotal) * 100) : 0;
    return { rows, grandTotal, grandPending, grandApproved, grandRejected, grandRate };
  }, [filtered]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ta = parseAnyDate(a.TANGGAL_ORDER ?? '')?.getTime() ?? 0;
      const tb = parseAnyDate(b.TANGGAL_ORDER ?? '')?.getTime() ?? 0;
      return tb - ta;
    });
  }, [filtered]);

  const printReport = () => {
    setPrintedAt(new Date());
    setTimeout(() => window.print(), 100);
  };

  const metaCreatedBy = session?.nama || session?.username || '-';

  return (
    <div className="space-y-4 print:space-y-2">
      {/* Header laporan */}
      <Card className="p-5 sm:p-6 print:border print:border-gray-300 print:bg-white">
        <h1 className="font-display flex items-center gap-2 text-xl font-bold sm:text-2xl print:text-black">
          <BarChart3 className="h-6 w-6 text-primary print:hidden" />
          Laporan Order — <span>{PERIODS[filterPeriod] || 'Semua Periode'}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground print:text-gray-600">
          PT Central Perabot Utama · Waktu WITA
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border pt-4 text-xs sm:grid-cols-2 lg:grid-cols-4 print:border-gray-300 print:pt-2">
          <div>
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground print:text-gray-500">
              <User className="h-3 w-3" />
              Dibuat oleh
            </div>
            <div className="mt-0.5 font-bold">{metaCreatedBy}</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground print:text-gray-500">
              <Clock className="h-3 w-3" />
              Waktu cetak
            </div>
            <div className="mt-0.5 font-bold">{formatWita(printedAt)}</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground print:text-gray-500">
              <Package className="h-3 w-3" />
              Total order
            </div>
            <div className="mt-0.5 font-bold">{stats.total} order</div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground print:text-gray-500">
              <CheckCircle2 className="h-3 w-3" />
              Rate persetujuan
            </div>
            <div className="mt-0.5 font-bold">{stats.approvalRate}%</div>
          </div>
        </div>
      </Card>

      {/* Filter */}
      <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-card p-4 print:hidden sm:grid-cols-3">
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Store className="h-3 w-3" />
            Cabang
          </label>
          <Select value={filterCabang} onValueChange={setFilterCabang}>
            <SelectTrigger>
              <SelectValue placeholder="Semua Cabang" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua Cabang</SelectItem>
              {Object.entries(CABANG).map(([id, info]) => (
                <SelectItem key={id} value={id}>
                  {id} — {info.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Clock className="h-3 w-3" />
            Periode
          </label>
          <Select value={filterPeriod} onValueChange={setFilterPeriod}>
            <SelectTrigger>
              <SelectValue placeholder="Semua waktu" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIODS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <List className="h-3 w-3" />
            Status
          </label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Semua status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua status</SelectItem>
              <SelectItem value="PENDING">Tertunda</SelectItem>
              <SelectItem value="APPROVED">Disetujui</SelectItem>
              <SelectItem value="REJECTED">Ditolak</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : (
        <>
          {/* Statistik */}
          <div className="grid grid-cols-2 gap-3 print:grid-cols-4 lg:grid-cols-4">
            <Card className="p-4 print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground print:text-gray-500">
                <Package className="h-3 w-3" />
                Total Order
              </div>
              <div className="mt-2 text-[26px] font-extrabold leading-none text-primary tabular-nums print:text-black">
                {stats.total}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground print:text-gray-500">Semua pesanan</div>
            </Card>
            <Card className="p-4 print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground print:text-gray-500">
                <CheckCircle2 className="h-3 w-3" />
                Disetujui
              </div>
              <div className="mt-2 text-[26px] font-extrabold leading-none text-success tabular-nums print:text-black">
                {stats.approved}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground print:text-gray-500">
                {stats.approvalRate}% dari total
              </div>
            </Card>
            <Card className="p-4 print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground print:text-gray-500">
                <Clock className="h-3 w-3" />
                Tertunda
              </div>
              <div className="mt-2 text-[26px] font-extrabold leading-none text-warning tabular-nums print:text-black">
                {stats.pending}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground print:text-gray-500">
                {stats.pending > 0 ? 'Perlu diproses' : 'Semua terproses'}
              </div>
            </Card>
            <Card className="p-4 print:border print:border-gray-300 print:bg-white">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground print:text-gray-500">
                <XCircle className="h-3 w-3" />
                Ditolak
              </div>
              <div className="mt-2 text-[26px] font-extrabold leading-none text-danger tabular-nums print:text-black">
                {stats.rejected}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground print:text-gray-500">
                {stats.total > 0 ? `${stats.rejectRate}% ditolak` : '-'}
              </div>
            </Card>
          </div>

          {/* Rekap per Cabang */}
          <Card className="overflow-hidden print:border print:border-gray-300 print:bg-white">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3.5 print:border-gray-300">
              <PieChart className="h-4 w-4 text-primary print:hidden" />
              <h2 className="font-display text-[15px] font-bold">Rekap per Cabang</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="whitespace-nowrap px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Cabang</th>
                    <th className="whitespace-nowrap px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Nama Toko</th>
                    <th className="whitespace-nowrap px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">PIC</th>
                    <th className="whitespace-nowrap px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Total</th>
                    <th className="whitespace-nowrap px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Pending</th>
                    <th className="whitespace-nowrap px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Approved</th>
                    <th className="whitespace-nowrap px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Rejected</th>
                    <th className="whitespace-nowrap px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {perCabang.rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="px-3.5 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
                          <Store className="h-3 w-3" />
                          {r.id}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">{r.info.nama}</td>
                      <td className="px-3.5 py-3 text-muted-foreground">{r.info.pic}</td>
                      <td className="px-3.5 py-3 text-right font-bold tabular-nums">{r.total}</td>
                      <td className="px-3.5 py-3 text-right text-warning tabular-nums">{r.pending}</td>
                      <td className="px-3.5 py-3 text-right font-bold text-success tabular-nums">{r.approved}</td>
                      <td className="px-3.5 py-3 text-right text-danger tabular-nums">{r.rejected}</td>
                      <td className="px-3.5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-success to-primary transition-all duration-500"
                              style={{ width: `${r.rate}%` }}
                            />
                          </div>
                          <span className="min-w-[40px] text-right text-xs font-bold text-success tabular-nums">{r.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/50 font-extrabold">
                    <td colSpan={3} className="px-3.5 py-3 text-primary">
                      TOTAL
                    </td>
                    <td className="px-3.5 py-3 text-right text-primary tabular-nums">{perCabang.grandTotal}</td>
                    <td className="px-3.5 py-3 text-right text-primary tabular-nums">{perCabang.grandPending}</td>
                    <td className="px-3.5 py-3 text-right text-primary tabular-nums">{perCabang.grandApproved}</td>
                    <td className="px-3.5 py-3 text-right text-primary tabular-nums">{perCabang.grandRejected}</td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 min-w-[60px] flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-success to-primary"
                            style={{ width: `${perCabang.grandRate}%` }}
                          />
                        </div>
                        <span className="min-w-[40px] text-right text-xs font-bold text-primary tabular-nums">{perCabang.grandRate}%</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Detail Order */}
          <Card className="overflow-hidden print:border print:border-gray-300 print:bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3.5 print:border-gray-300">
              <div className="flex items-center gap-2">
                <List className="h-4 w-4 text-primary print:hidden" />
                <h2 className="font-display text-[15px] font-bold">Detail Order</h2>
              </div>
              <span className="text-xs text-muted-foreground">{stats.total} order</span>
            </div>
            {sorted.length === 0 ? (
              <div className="py-14 text-center text-muted-foreground">
                <FileText className="mx-auto mb-3 h-12 w-12 opacity-50" />
                <p className="text-sm">Tidak ada data yang cocok dengan filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="w-10 px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">#</th>
                      <th className="whitespace-nowrap px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Order ID</th>
                      <th className="whitespace-nowrap px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Cabang</th>
                      <th className="whitespace-nowrap px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Tanggal</th>
                      <th className="whitespace-nowrap px-3.5 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Status</th>
                      <th className="whitespace-nowrap px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Item</th>
                      <th className="whitespace-nowrap px-3.5 py-3 text-right text-[11px] font-bold uppercase tracking-wide text-muted-foreground print:text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((order, i) => {
                      const status = String(order.STATUS || 'PENDING').toUpperCase();
                      const branch = CABANG[String(order.ID_CABANG)] || { pic: '-' };
                      const itemCount = (order.DETAIL as DetailItem[] | undefined)?.length || 0;
                      const total = calcTotal(order);
                      const statusIcon =
                        status === 'APPROVED' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : status === 'REJECTED' ? (
                          <XCircle className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        );
                      const statusCls =
                        status === 'APPROVED'
                          ? 'text-success'
                          : status === 'REJECTED'
                            ? 'text-danger'
                            : 'text-warning';
                      return (
                        <tr key={String(order.ORDER_ID)} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="px-3.5 py-3 text-muted-foreground tabular-nums">{i + 1}</td>
                          <td className="px-3.5 py-3">
                            <span className="font-mono text-[11px] font-bold text-primary">
                              {order.ORDER_ID}
                            </span>
                          </td>
                          <td className="px-3.5 py-3">
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-bold">
                              <Store className="h-3 w-3" />
                              {order.ID_CABANG}
                            </span>
                            <div className="mt-0.5 text-[11px] text-muted-foreground">{branch.pic}</div>
                          </td>
                          <td className="px-3.5 py-3 text-xs">{formatDateOnly(order.TANGGAL_ORDER)}</td>
                          <td className="px-3.5 py-3">
                            <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold', statusCls)}>
                              {statusIcon}
                              {status}
                            </span>
                          </td>
                          <td className="px-3.5 py-3 text-right tabular-nums">{itemCount}</td>
                          <td className="px-3.5 py-3 text-right font-bold text-primary tabular-nums">
                            {formatRupiah(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="flex justify-end print:hidden">
            <Button size="sm" onClick={printReport}>
              <Download className="h-4 w-4" />
              Print / PDF
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
