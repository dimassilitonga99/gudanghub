import { Icon } from '../components/ui/icon';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { orders as ordersApi } from '@/lib/api';
import { CABANG, ROUTES, type Order } from '@/lib/config';
import {
  formatWita,
  formatTimeAgo,
  getInitials,
  parseAnyDate,
  cn,
} from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { getSessionRemainingMinutes, logout as doLogout } from '@/lib/session';
import { useDialog } from '@/lib/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function formatDateOnlyWita(value: string | undefined | null): string {
  return formatWita(value ?? '', false);
}

interface ActivityItem {
  ORDER_ID: string | number;
  ID_CABANG?: string;
  TANGGAL_ORDER?: string;
  STATUS?: string;
}

const STATUS_INFO: Record<string, { icon: string; color: string; label: string }> = {
  PENDING: { icon: 'clock', color: 'text-warning', label: 'menunggu persetujuan' },
  APPROVED: { icon: 'check-circle', color: 'text-success', label: 'disetujui' },
  REJECTED: { icon: 'circle-xmark', color: 'text-danger', label: 'ditolak' },
};

export default function Profil() {
  const { session } = useAuth();
  const { confirm, dialog } = useDialog();
  const [remaining, setRemaining] = useState(() => getSessionRemainingMinutes());
  const [activities, setActivities] = useState<ActivityItem[] | null>(null);
  const [activityError, setActivityError] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      const rem = getSessionRemainingMinutes();
      setRemaining(rem);
      if (rem <= 0) {
        setTimeout(() => doLogout(), 1000);
      }
    }, 60000);
    return () => clearInterval(t);
  }, []);

  const loadActivity = useCallback(async () => {
    try {
      const result = await ordersApi.getAll({ cache: true });
      if (result.status !== 'ok') {
        throw new Error(result.message || 'Gagal memuat aktivitas');
      }
      const allOrders = (result.data as Order[]) || [];
      const relevant =
        session?.role === 'admin'
          ? allOrders
          : allOrders.filter((o) => String(o.ID_CABANG || '').toUpperCase() === session?.idCabang);
      const sorted = [...relevant].sort((a, b) => {
        const ta = parseAnyDate(a.TANGGAL_ORDER ?? '')?.getTime() ?? 0;
        const tb = parseAnyDate(b.TANGGAL_ORDER ?? '')?.getTime() ?? 0;
        return tb - ta;
      });
      setActivities(sorted.slice(0, 15));
      setActivityError(false);
    } catch {
      setActivityError(true);
    }
  }, [session]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  const handleLogout = async () => {
    const ok = await confirm({
      icon: '🚪',
      title: 'Keluar dari GudangHub?',
      message: 'Anda akan diarahkan ke halaman login.',
      okText: 'Ya, Keluar',
      okVariant: 'destructive',
    });
    if (ok) {
      doLogout();
    }
  };

  if (!session) return null;

  const isAdmin = session.role === 'admin';
  const cabang = CABANG[String(session.idCabang)];
  const homeRoute = isAdmin ? ROUTES.dashboard : `${ROUTES.order}?cabang=${session.idCabang || ''}`;

  const roleLabel = isAdmin ? 'Admin Gudang Pusat' : `Cabang ${session.idCabang || ''}`;

  const remainingText =
    remaining <= 0
      ? 'Expired'
      : `${remaining >= 60 ? Math.floor(remaining / 60) + 'j ' : ''}${remaining % 60}m`;

  const remainingCls =
    remaining <= 0 ? 'text-danger' : remaining < 30 ? 'text-warning' : 'text-success';

  const token =
    session.token
      ? session.token.substring(0, 8) + '...' + session.token.substring(session.token.length - 4)
      : 'N/A';

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display flex items-center gap-2 text-2xl font-bold">
        <Icon name="circle-user" size={24} className="text-primary" />
        Profil <span className="text-primary">Pengguna</span>
      </h1>

      {/* Hero profil */}
      <Card className="flex flex-col items-center gap-2 p-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-lg font-extrabold text-white">
          {getInitials(session.nama || session.username)}
        </span>
        <h2 className="text-lg font-bold">{session.nama || session.username || '-'}</h2>
        <div className="text-sm text-muted-foreground">@{session.username || '-'}</div>
        <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold">
          {isAdmin ? <Icon name="warehouse-alt" size={14} /> : <Icon name="shop" size={14} />}
          {roleLabel}
        </div>
      </Card>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="shop" size={20} />
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cabang</div>
          <div className="mt-0.5 text-sm font-bold">
            {isAdmin ? 'Gudang Pusat' : cabang ? cabang.nama : session.idCabang || '-'}
          </div>
          <div className="text-xs text-muted-foreground">
            {isAdmin
              ? 'Admin — Semua Cabang'
              : cabang
                ? `${cabang.id} · PIC ${cabang.pic}`
                : 'Detail tidak tersedia'}
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="phone-call" size={20} />
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Kontak</div>
          <div className="mt-0.5 text-sm font-bold">
            {isAdmin ? 'silitongadimas@gmail.com' : cabang ? cabang.telepon : '-'}
          </div>
          <div className="text-xs text-muted-foreground">Telepon cabang</div>
        </Card>
        <Card className="p-4">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="map-marker" size={20} />
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Alamat</div>
          <div className="mt-0.5 text-[13px] font-bold">
            {isAdmin ? 'PT Central Perabot Utama, NTT' : cabang ? cabang.alamat : '-'}
          </div>
        </Card>
        <Card className="p-4">
          <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="calendar-clock" size={20} />
          </div>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Login Sejak</div>
          <div className="mt-0.5 text-[13px] font-bold">{session.loginAt ? formatWita(session.loginAt) : '-'}</div>
          <div className="text-xs text-muted-foreground">{session.loginAt ? formatTimeAgo(session.loginAt) : '-'}</div>
        </Card>
      </div>

      {/* Aksi cepat */}
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
          <Icon name="bolt" size={16} className="text-primary" />
          Aksi Cepat
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Link
            to={ROUTES.gantiPassword}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Icon name="key" size={20} className="text-primary" />
            Ganti Password
          </Link>
          <Link
            to={ROUTES.notifikasi}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Icon name="bell" size={20} className="text-primary" />
            Notifikasi
          </Link>
          <Link
            to={ROUTES.laporan}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Icon name="pulse" size={20} className="text-primary" />
            Laporan
          </Link>
          <Link
            to={homeRoute}
            className="flex items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm font-medium transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Icon name="home" size={20} className="text-primary" />
            Halaman Utama
          </Link>
          <Button
            variant="destructive"
            className="flex items-center gap-2 justify-start rounded-xl p-3 text-sm"
            onClick={() => void handleLogout()}
          >
            <Icon name="sign-out-alt" size={20} />
            Keluar
          </Button>
        </div>
      </Card>

      {/* Session info */}
      <Card className="p-4">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
          <Icon name="shield" size={16} className="text-primary" />
          Session Info
        </h2>
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="key" size={14} />
              Token
            </span>
            <span className="font-mono text-xs font-semibold">{token}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="calendar-clock" size={14} />
              Expires
            </span>
            <span className="text-sm font-semibold">{session.expires ? formatWita(session.expires) : '-'}</span>
          </div>
          <div className="flex items-center justify-between gap-3 py-2.5">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="stopwatch" size={14} />
              Sisa Waktu
            </span>
            <span className={cn('text-sm font-bold tabular-nums', remainingCls)}>{remainingText}</span>
          </div>
        </div>
      </Card>

      {/* Aktivitas terbaru */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <Icon name="pulse" size={16} className="text-primary" />
            Aktivitas Terbaru
          </h2>
          <span className="text-xs text-muted-foreground">
            {activities ? `${activities.length} aktivitas` : ''}
          </span>
        </div>
        <div>
          {activityError ? (
            <div className="py-10 text-center text-muted-foreground">
              <Icon name="triangle-warning" size={40} className="mx-auto mb-2 text-danger" />
              <p className="text-sm">Gagal memuat aktivitas.</p>
            </div>
          ) : activities === null ? (
            <div className="py-10 text-center text-muted-foreground">
              <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-primary" />
              <p className="text-sm">Memuat aktivitas...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Icon name="pulse" size={40} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Belum ada aktivitas.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activities.map((order, i) => {
                const status = String(order.STATUS || 'PENDING').toUpperCase();
                const info = STATUS_INFO[status] || STATUS_INFO.PENDING;
                const branch = CABANG[String(order.ID_CABANG)];
                const branchName = branch ? branch.pic : String(order.ID_CABANG || '-');
                return (
                  <div key={i} className="flex items-start gap-3 px-4 py-3">
                    <span className={cn('mt-0.5', info.color)}>
                      <Icon name={info.icon} size={18} />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm">
                        Order <strong>{String(order.ORDER_ID)}</strong> dari <b>{branchName}</b>{' '}
                        {info.label}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Icon name="clock" size={12} />
                        {formatTimeAgo(order.TANGGAL_ORDER)}
                        <span className="mx-0.5">·</span>
                        {formatDateOnlyWita(order.TANGGAL_ORDER)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {dialog}
    </div>
  );
}