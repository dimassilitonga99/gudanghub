import { Icon } from '../components/ui/icon';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { toastError, toastSuccess } from '@/lib/toast';

import { useAuth } from '@/context/AuthContext';
import { CABANG, SESSION, APP } from '@/lib/config';
import { getInitials, isStandalone } from '@/lib/utils';
import { useDialog } from '@/lib/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

const PREFS_KEY = 'gudanghub_prefs';

const DEFAULT_PREFS = {
  darkMode: true,
  browserNotif: false,
  soundNotif: false,
  autoRefresh: true,
};

type Prefs = typeof DEFAULT_PREFS;

const USERS = [
  { username: 'admin', nama: 'Admin Gudang Pusat', role: 'admin', idCabang: '' },
  { username: 'cb001', nama: 'Toko Nasional Eltari – Arfa', role: 'cabang', idCabang: 'CB001' },
  { username: 'cb002', nama: 'Toko Perabot Mama Oesapa – Akmal', role: 'cabang', idCabang: 'CB002' },
  { username: 'cb003', nama: 'Toko Perabot Mama TDM – Shally', role: 'cabang', idCabang: 'CB003' },
  { username: 'cb004', nama: 'Toko Perabot Mama Kefamenanu – Fajar', role: 'cabang', idCabang: 'CB004' },
];

function loadPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage penuh */
  }
}

function playTestSound() {
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

export default function Settings() {
  const { session } = useAuth();
  const { confirm, dialog } = useDialog();
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());
  const [storageUsed, setStorageUsed] = useState('-');
  const [pwaStatus, setPwaStatus] = useState('-');
  const [browserInfo, setBrowserInfo] = useState('Unknown');

  useEffect(() => {
    try {
      let total = 0;
      for (const key in localStorage) {
        if (Object.prototype.hasOwnProperty.call(localStorage, key)) {
          total += ((localStorage.getItem(key) || '').length + key.length) * 2;
        }
      }
      setStorageUsed((total / 1024).toFixed(1) + ' KB');
    } catch {
      setStorageUsed('N/A');
    }

    const isPwa = isStandalone();
    const swSupported = 'serviceWorker' in navigator;
    setPwaStatus(isPwa ? 'Installed' : swSupported ? 'Ready' : 'Not Supported');

    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (/chrome/i.test(ua) && !/edg/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/edg/i.test(ua)) browser = 'Edge';
    else if (/opera|opr/i.test(ua)) browser = 'Opera';
    setBrowserInfo(browser);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', prefs.darkMode);
  }, [prefs.darkMode]);

  const setPref = (key: keyof Prefs, value: boolean, toastMsg?: string) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePrefs(next);
    if (toastMsg) toastSuccess(toastMsg);
  };

  const handleBrowserNotif = async (checked: boolean) => {
    if (!checked) {
      setPref('browserNotif', false);
      return;
    }
    if (!('Notification' in window)) {
      toastError('Browser tidak mendukung notifikasi.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        toast.warning('Izin notifikasi ditolak oleh browser.');
        setPref('browserNotif', false);
        return;
      }
      setPref('browserNotif', true, 'Notifikasi browser aktif!');
      try {
        new Notification('GudangHub', {
          body: 'Notifikasi berhasil diaktifkan!',
          icon: 'icons/icon-192.png',
        });
      } catch {
        /* notifikasi tidak didukung */
      }
    } catch {
      setPref('browserNotif', false);
      toastError('Gagal mengaktifkan notifikasi.');
    }
  };

  const handleClearCache = async () => {
    const ok = await confirm({
      icon: '🗑️',
      title: 'Hapus Cache Lokal?',
      message:
        'Semua data lokal akan dihapus:\n• Preferensi\n• Riwayat notifikasi\n• Cache API\n\nAnda TIDAK akan logout.',
      okText: 'Ya, Hapus',
      okVariant: 'destructive',
    });
    if (!ok) return;

    try {
      const session = sessionStorage.getItem(SESSION.key);
      localStorage.clear();
      sessionStorage.clear();
      if (session) sessionStorage.setItem(SESSION.key, session);
      toastSuccess('Cache lokal berhasil dihapus.');
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toastError('Gagal menghapus cache.');
    }
  };

  const handleResetPrefs = async () => {
    const ok = await confirm({
      icon: '🔄',
      title: 'Reset ke Default?',
      message: 'Semua preferensi akan dikembalikan ke pengaturan default.',
      okText: 'Ya, Reset',
    });
    if (!ok) return;
    setPrefs({ ...DEFAULT_PREFS });
    savePrefs({ ...DEFAULT_PREFS });
    toastSuccess('Preferensi direset ke default.');
  };

  const isAdmin = session?.role === 'admin';

  const prefRow = (label: string, help: string, icon: React.ReactNode, checked: boolean, onToggle: (v: boolean) => void) => (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-muted-foreground">{help}</div>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-display text-2xl font-bold">Pengaturan</h1>

      {/* Preferensi */}
      <Card className="divide-y divide-border px-5">
        {prefRow(
          'Mode Gelap',
          'Gunakan tema gelap di seluruh aplikasi',
          <Icon name="moon" size={16} />,
          prefs.darkMode,
          (v) => setPref('darkMode', v, `Mode ${v ? 'gelap' : 'terang'} diaktifkan.`),
        )}
        {prefRow(
          'Notifikasi Browser',
          'Tampilkan notifikasi sistem saat ada order baru',
          <Icon name="smartphone" size={16} />,
          prefs.browserNotif,
          (v) => void handleBrowserNotif(v),
        )}
        {prefRow(
          'Suara Notifikasi',
          'Bunyi saat ada notifikasi baru',
          <Icon name="triangle-warning" size={16} />,
          prefs.soundNotif,
          (v) => {
            setPref('soundNotif', v);
            if (v) {
              playTestSound();
              toastSuccess('Suara notifikasi aktif.');
            }
          },
        )}
        {prefRow(
          'Auto Refresh Dashboard',
          'Refresh data otomatis setiap 1 menit',
          <Icon name="refresh" size={16} />,
          prefs.autoRefresh,
          (v) => {
            setPref('autoRefresh', v);
            toast.info(v ? 'Auto-refresh aktif (setiap 1 menit)' : 'Auto-refresh dimatikan');
          },
        )}
      </Card>

      {/* Kelola User (admin) */}
      {isAdmin && (
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name="users" size={22} />
            </span>
            <div>
              <h2 className="font-display text-base font-bold">Kelola User</h2>
              <p className="text-xs text-muted-foreground">Daftar akun yang terdaftar di sistem</p>
            </div>
          </div>
          <div className="space-y-2">
            {USERS.map((user) => (
              <div key={user.username} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {getInitials(user.nama)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{user.nama}</div>
                  <div className="text-xs text-muted-foreground">@{user.username}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                      {user.role === 'admin' ? <Icon name="warehouse-alt" size={12} /> : <Icon name="shop" size={12} />}
                      {user.role === 'admin' ? 'Admin' : 'Cabang'}
                    </span>
                    {user.idCabang && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                        <Icon name="tags" size={12} />
                        {user.idCabang}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-info/20 bg-info/10 p-3.5 text-xs leading-relaxed text-info">
            <Icon name="info" size={18} className="mt-0.5 shrink-0" />
            <div>
              <b>Info:</b> User dikelola melalui Google Sheet (sheet <code>USERS</code>). Buka
              Google Sheets untuk menambah/mengedit akun.
              <div className="mt-2">
                <a
                  href="https://docs.google.com/spreadsheets"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-info/30 px-2.5 py-1.5 font-semibold transition-colors hover:bg-info/15"
                >
                  <Icon name="file-spreadsheet" size={14} />
                  Buka Google Sheets
                </a>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Daftar Cabang */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="shop" size={22} />
          </span>
          <div>
            <h2 className="font-display text-base font-bold">Daftar Cabang</h2>
            <p className="text-xs text-muted-foreground">Cabang aktif di sistem</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.entries(CABANG).map(([id, info]) => (
            <div key={id} className="rounded-lg border border-border bg-muted/20 p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name="shop" size={20} />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{info.nama}</div>
                  <div className="text-xs text-muted-foreground">
                    {id} · PIC: {info.pic}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Icon name="phone-call" size={12} />
                  <b className="font-medium">{info.telepon || '-'}</b>
                </div>
                <div className="flex items-center gap-1.5">
                  <Icon name="map-marker" size={12} />
                  {info.alamat || '-'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Informasi Sistem */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon name="info" size={22} />
          </span>
          <div>
            <h2 className="font-display text-base font-bold">Informasi Sistem</h2>
            <p className="text-xs text-muted-foreground">Detail teknis aplikasi</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { label: 'App Version', value: `v${APP.version}`, icon: <Icon name="tags" size={12} />, accent: true },
            { label: 'Backend', value: 'Google Apps Script', icon: <Icon name="database" size={12} /> },
            { label: 'Timezone', value: 'Asia/Makassar', icon: <Icon name="globe" size={12} /> },
            { label: 'Storage Used', value: storageUsed, icon: <Icon name="database" size={12} /> },
            { label: 'PWA Status', value: pwaStatus, icon: <Icon name="smartphone" size={12} />, green: pwaStatus === 'Installed' },
            { label: 'Browser', value: browserInfo, icon: <Icon name="dashboard-monitor" size={12} /> },
          ].map((tile) => (
            <div key={tile.label} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {tile.icon}
                {tile.label}
              </div>
              <div className={tile.accent ? 'mt-1 text-sm font-bold text-primary' : tile.green ? 'mt-1 text-sm font-bold text-success' : 'mt-1 text-sm font-bold'}>
                {tile.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="border-danger/30 p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-danger/10 text-danger">
            <Icon name="triangle-warning" size={22} />
          </span>
          <div>
            <h2 className="font-display text-base font-bold text-danger">Danger Zone</h2>
            <p className="text-xs text-muted-foreground">Aksi yang bersifat destruktif — hati-hati!</p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3.5 py-3">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Icon name="trash" size={16} />
                Hapus Cache Lokal
              </div>
              <div className="text-xs text-muted-foreground">
                Hapus semua data yang tersimpan di browser (setting, notifikasi dibaca, dll)
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => void handleClearCache()}>
              <Icon name="trash" size={16} />
              Hapus
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3.5 py-3">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <Icon name="refresh" size={16} />
                Reset Preferensi
              </div>
              <div className="text-xs text-muted-foreground">Kembalikan semua setting ke default</div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => void handleResetPrefs()}>
              <Icon name="refresh" size={16} />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {dialog}
    </div>
  );
}