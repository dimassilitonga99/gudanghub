import { Icon } from '../components/ui/icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { orders as ordersApi } from '@/lib/api';
import { CABANG, SETTINGS, type Order } from '@/lib/config';
import { formatTimeAgo, formatWita, parseAnyDate, cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/lib/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const READ_KEY = 'gudanghub_notif_read';

function loadReadIds(): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(READ_KEY) || '[]');
    return new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-200)));
  } catch {
    /* storage penuh */
  }
}

function formatDateOnlyWita(value: string | undefined | null): string {
  const d = parseAnyDate(value ?? '');
  if (!d) return '-';
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

interface NotifOrder extends Order {
  TANGGAL_PROSES?: string;
}

const FILTERS: { key: string; label: string; icon: string }[] = [
  { key: 'all', label: 'Semua', icon: 'list' },
  { key: 'unread', label: 'Belum Dibaca', icon: 'envelope' },
  { key: 'PENDING', label: 'Menunggu', icon: 'clock' },
  { key: 'APPROVED', label: 'Disetujui', icon: 'check-circle' },
  { key: 'REJECTED', label: 'Ditolak', icon: 'circle-xmark' },
];

export default function Notifikasi() {
  const { session } = useAuth();
  const { confirm, dialog } = useDialog();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<NotifOrder[]>([]);
  const [filter, setFilter] = useState('all');
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadIds());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const ordersRef = useRef<NotifOrder[]>([]);
  ordersRef.current = orders;

  const markRead = useCallback((id: string | number) => {
    const key = String(id);
    setReadIds((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      saveReadIds(next);
      return next;
    });
  }, []);

  const sendBrowserNotification = useCallback((message: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification('GudangHub', {
          body: message,
          icon: './public/icons/icon-192.png',
          badge: './public/icons/icon-192.png',
          tag: 'gudanghub-notif',
        });
      } catch {
        /* notifikasi tidak didukung */
      }
    }
  }, []);

  const detectNewNotifications = useCallback(
    (oldOrders: NotifOrder[], newOrders: NotifOrder[]) => {
      const oldIds = new Set(oldOrders.map((o) => String(o.ORDER_ID)));
      const newlyAdded = newOrders.filter((o) => !oldIds.has(String(o.ORDER_ID)));

      if (newlyAdded.length === 0) return;

      const first = newlyAdded[0];
      const status = String(first.STATUS || 'PENDING').toUpperCase();
      const cabang = CABANG[String(first.ID_CABANG)];
      const branchName = cabang ? cabang.pic : String(first.ID_CABANG || '-');

      let message = '';
      if (session?.role === 'admin') {
        if (status === 'PENDING') {
          message = `Order baru dari ${branchName}!`;
        } else {
          message = `Update: ${first.ORDER_ID}`;
        }
      } else {
        if (status === 'APPROVED') {
          message = `Order ${first.ORDER_ID} disetujui!`;
        } else if (status === 'REJECTED') {
          message = `Order ${first.ORDER_ID} ditolak.`;
        }
      }

      if (message) {
        const full = message + (newlyAdded.length > 1 ? ` (+${newlyAdded.length - 1} lainnya)` : '');
        if (status === 'APPROVED') toast.success(full, { duration: 5000 });
        else if (status === 'REJECTED') toast.error(full, { duration: 5000 });
        else toast.info(full, { duration: 5000 });
        sendBrowserNotification(full);
      }
    },
    [session, sendBrowserNotification],
  );

  const loadNotifications = useCallback(
    async (silent = false) => {
      try {
        const result = await ordersApi.getAll({ cache: false });
        if (result.status !== 'ok') {
          throw new Error(result.message || 'Gagal memuat');
        }
        const allOrders = (result.data as NotifOrder[]) || [];

        const relevant =
          session?.role === 'admin'
            ? allOrders
            : allOrders.filter(
                (o) => String(o.ID_CABANG || '').toUpperCase() === session?.idCabang,
              );

        const sorted = [...relevant].sort((a, b) => {
          const ta = parseAnyDate(a.TANGGAL_ORDER ?? '')?.getTime() ?? 0;
          const tb = parseAnyDate(b.TANGGAL_ORDER ?? '')?.getTime() ?? 0;
          return tb - ta;
        });

        if (ordersRef.current.length > 0 && silent) {
          detectNewNotifications(ordersRef.current, sorted);
        }

        setOrders(sorted);
        setLastRefresh(new Date());
        setLoading(false);
        setLoadError(false);
      } catch {
        setLoading(false);
        if (ordersRef.current.length === 0) {
          setLoadError(true);
        }
      }
    },
    [session, detectNewNotifications],
  );

  useEffect(() => {
    void loadNotifications(false);
  }, [loadNotifications]);

  // Polling live + visibility
  useEffect(() => {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let refreshTimer: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        if (!document.hidden) {
          void loadNotifications(true);
        }
      }, SETTINGS.notifPollingMs);
      if (refreshTimer) clearInterval(refreshTimer);
      refreshTimer = setInterval(() => setLastRefresh(new Date()), 15000);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
      } else {
        startPolling();
        void loadNotifications(true);
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (pollTimer) clearInterval(pollTimer);
      if (refreshTimer) clearInterval(refreshTimer);
    };
  }, [loadNotifications]);

  // Minta izin notifikasi browser
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      try {
        void Notification.requestPermission();
      } catch {
        /* ditolak */
      }
    }
  }, []);

  const counts = useMemo(() => {
    const total = orders.length;
    const unread = orders.filter((o) => !readIds.has(String(o.ORDER_ID))).length;
    const pending = orders.filter((o) => String(o.STATUS || '').toUpperCase() === 'PENDING').length;
    const approved = orders.filter((o) => String(o.STATUS || '').toUpperCase() === 'APPROVED').length;
    const rejected = orders.filter((o) => String(o.STATUS || '').toUpperCase() === 'REJECTED').length;
    return { total, unread, pending, approved, rejected };
  }, [orders, readIds]);

  const filtered = useMemo(() => {
    if (filter === 'unread') {
      return orders.filter((o) => !readIds.has(String(o.ORDER_ID)));
    }
    if (filter !== 'all') {
      return orders.filter((o) => String(o.STATUS || '').toUpperCase() === filter);
    }
    return orders;
  }, [orders, filter, readIds]);

  const handleNotifClick = (orderId: string | number) => {
    markRead(orderId);
    if (session?.role === 'admin') {
      navigate('/dashboard#orders');
    } else {
      navigate(`/order#history`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!orders.length) return;
    const ok = await confirm({
      icon: '✓',
      title: 'Tandai Semua Dibaca?',
      message: `${orders.length} notifikasi akan ditandai sebagai sudah dibaca.`,
      okText: 'Ya, Tandai',
    });
    if (!ok) return;

    setReadIds((prev) => {
      const next = new Set(prev);
      orders.forEach((o) => next.add(String(o.ORDER_ID)));
      saveReadIds(next);
      return next;
    });
    toast.success('Semua notifikasi ditandai dibaca.');
  };

  const emptyIcon = filter === 'unread' ? 'check-double' : 'bell';
  const emptyMsg =
    filter === 'all'
      ? 'Belum ada notifikasi'
      : filter === 'unread'
        ? 'Semua notifikasi sudah dibaca!'
        : `Tidak ada notifikasi dengan status "${filter}"`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold">
          <Icon name="bell-ring" size={24} className="text-primary" />
          Notifikasi <span className="text-primary">Live</span>
          {counts.unread > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white tabular-nums">
              {counts.unread}
            </span>
          )}
        </h1>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void handleMarkAllRead()}
          disabled={!orders.length}
        >
          <Icon name="check-double" size={16} />
          Tandai Dibaca
        </Button>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon name="wifi" size={12} />
          Notifikasi live · Auto-refresh setiap {Math.round(SETTINGS.notifPollingMs / 1000)} detik
        </span>
        <span className="ml-auto font-medium">
          {lastRefresh ? 'Update: ' + formatTimeAgo(lastRefresh.toISOString()) : 'Baru saja'}
        </span>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f.key === 'all'
              ? counts.total
              : f.key === 'unread'
                ? counts.unread
                : f.key === 'PENDING'
                  ? counts.pending
                  : f.key === 'APPROVED'
                    ? counts.approved
                    : counts.rejected;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                filter === f.key
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              <Icon name={f.icon} size={14} />
              {f.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[10px] tabular-nums',
                  filter === f.key ? 'bg-white/20' : 'bg-muted',
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Daftar notifikasi */}
      <Card className="overflow-hidden">
        {loading && orders.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-primary" />
            <p className="text-sm">Memuat notifikasi...</p>
          </div>
        ) : loadError ? (
          <div className="py-12 text-center text-muted-foreground">
            <Icon name="triangle-warning" size={48} className="mx-auto mb-3 text-danger" />
            <p className="mb-3 text-sm">Gagal memuat notifikasi.</p>
            <Button size="sm" variant="outline" onClick={() => void loadNotifications(false)}>
              <Icon name="refresh" size={16} />
              Coba Lagi
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Icon name={emptyIcon} size={56} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">{emptyMsg}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((order) => {
              const status = String(order.STATUS || 'PENDING').toUpperCase();
              const branch = CABANG[String(order.ID_CABANG)] || { pic: '-' };
              const unread = !readIds.has(String(order.ORDER_ID));

              const iconCls =
                status === 'PENDING'
                  ? 'bg-warning/15 text-warning'
                  : status === 'APPROVED'
                    ? 'bg-success/15 text-success'
                    : 'bg-danger/15 text-danger';

              const statusIcon =
                status === 'APPROVED' ? (
                  <Icon name="check-circle" size={22} />
                ) : status === 'REJECTED' ? (
                  <Icon name="circle-xmark" size={22} />
                ) : (
                  <Icon name="clock" size={22} />
                );

              let title: string;
              let desc: React.ReactNode;
              let titleIcon: React.ReactNode;
              if (session?.role === 'admin') {
                if (status === 'PENDING') {
                  titleIcon = <Icon name="package" size={16} />;
                  title = `Order Baru dari ${branch.pic}`;
                  desc = (
                    <>
                      Cabang <strong>{order.ID_CABANG}</strong> mengirim order{' '}
                      <strong>{order.ORDER_ID}</strong> dengan {(order.DETAIL || []).length} item.
                      Menunggu persetujuan Anda.
                    </>
                  );
                } else if (status === 'APPROVED') {
                  titleIcon = <Icon name="check-circle" size={16} />;
                  title = 'Order Disetujui';
                  desc = (
                    <>
                      Order <strong>{order.ORDER_ID}</strong> dari {branch.pic} telah Anda setujui.
                    </>
                  );
                } else {
                  titleIcon = <Icon name="circle-xmark" size={16} />;
                  title = 'Order Ditolak';
                  desc = (
                    <>
                      Order <strong>{order.ORDER_ID}</strong> dari {branch.pic} ditolak.
                    </>
                  );
                }
              } else {
                if (status === 'PENDING') {
                  titleIcon = <Icon name="clock" size={16} />;
                  title = 'Order Menunggu Persetujuan';
                  desc = (
                    <>
                      Order <strong>{order.ORDER_ID}</strong> sedang menunggu review dari admin
                      gudang.
                    </>
                  );
                } else if (status === 'APPROVED') {
                  titleIcon = <Icon name="check-circle" size={16} />;
                  title = 'Order Anda Disetujui!';
                  desc = (
                    <>
                      Admin gudang telah menyetujui order <strong>{order.ORDER_ID}</strong>. Segera
                      cek email untuk detail.
                    </>
                  );
                } else {
                  titleIcon = <Icon name="circle-xmark" size={16} />;
                  title = 'Order Anda Ditolak';
                  desc = (
                    <>
                      Order <strong>{order.ORDER_ID}</strong> ditolak. Cek email untuk alasannya.
                    </>
                  );
                }
              }

              return (
                <button
                  key={String(order.ORDER_ID)}
                  type="button"
                  onClick={() => handleNotifClick(order.ORDER_ID)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40',
                    unread && 'bg-primary/[0.04]',
                  )}
                >
                  <span className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconCls)}>
                    {statusIcon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-bold">
                        {titleIcon}
                        {title}
                        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                      </span>
                      <span
                        className="shrink-0 text-xs text-muted-foreground"
                        title={formatWita(order.TANGGAL_ORDER)}
                      >
                        {formatTimeAgo(order.TANGGAL_ORDER)}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted-foreground">{desc}</span>
                    <span className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
                        <Icon name="shop" size={12} />
                        {order.ID_CABANG}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          status === 'PENDING'
                            ? 'bg-warning/15 text-warning'
                            : status === 'APPROVED'
                              ? 'bg-success/15 text-success'
                              : 'bg-danger/15 text-danger',
                        )}
                      >
                        {statusIcon}
                        {status}
                      </span>
                      {order.TANGGAL_PROSES && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold opacity-60">
                          <Icon name="clock" size={12} />
                          {formatDateOnlyWita(order.TANGGAL_PROSES)}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {dialog}
    </div>
  );
}