import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Database,
  FileSpreadsheet,
  Globe,
  Info,
  MapPin,
  Monitor,
  Moon,
  Phone,
  RefreshCw,
  Smartphone,
  Store,
  Tag,
  Trash2,
  Users,
  Warehouse,
} from 'lucide-react';
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
    if (toastMsg) toast.success(toastMsg);
  };

  const handleBrowserNotif = async (checked: boolean) => {
    if (!checked) {
      setPref('browserNotif', false);
      return;
    }
    if (!('Notification' in window)) {
      toast.error('Browser tidak mendukung notifikasi.');
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
          icon: './public/icons/icon-192.png',
        });
      } catch {
        /* notifikasi tidak didukung */
      }
    } catch {
      setPref('browserNotif', false);
      toast.error('Gagal mengaktifkan notifikasi.');
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
      toast.success('Cache lokal berhasil dihapus.');
      setTimeout(() => window.location.reload(), 1000);
    } catch {
      toast.error('Gagal menghapus cache.');
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
    toast.success('Preferensi direset ke default.');
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
          <Moon className="h-4 w-4" />,
          prefs.darkMode,
          (v) => setPref('darkMode', v, `Mode ${v ? 'gelap' : 'terang'} diaktifkan.`),
        )}
        {prefRow(
          'Notifikasi Browser',
          'Tampilkan notifikasi sistem saat ada order baru',
          <Smartphone className="h-4 w-4" />,
          prefs.browserNotif,
          (v) => void handleBrowserNotif(v),
        )}
        {prefRow(
          'Suara Notifikasi',
          'Bunyi saat ada notifikasi baru',
          <AlertTriangle className="h-4 w-4" />,
          prefs.soundNotif,
          (v) => {
            setPref('soundNotif', v);
            if (v) {
              playTestSound();
              toast.success('Suara notifikasi aktif.');
            }
          },
        )}
        {prefRow(
          'Auto Refresh Dashboard',
          'Refresh data otomatis setiap 1 menit',
          <RefreshCw className="h-4 w-4" />,
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
              <Users className="h-[22px] w-[22px]" />
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
                      {user.role === 'admin' ? <Warehouse className="h-3 w-3" /> : <Store className="h-3 w-3" />}
                      {user.role === 'admin' ? 'Admin' : 'Cabang'}
                    </span>
                    {user.idCabang && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                        <Tag className="h-3 w-3" />
                        {user.idCabang}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-info/20 bg-info/10 p-3.5 text-xs leading-relaxed text-info">
            <Info className="mt-0.5 h-[18px] w-[18px] shrink-0" />
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
                  <FileSpreadsheet className="h-3.5 w-3.5" />
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
            <Store className="h-[22px] w-[22px]" />
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
                  <Store className="h-5 w-5" />
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
                  <Phone className="h-3 w-3" />
                  <b className="font-medium">{info.telepon || '-'}</b>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3" />
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
            <Info className="h-[22px] w-[22px]" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold">Informasi Sistem</h2>
            <p className="text-xs text-muted-foreground">Detail teknis aplikasi</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            { label: 'App Version', value: `v${APP.version}`, icon: <Tag className="h-3 w-3" />, accent: true },
            { label: 'Backend', value: 'Google Apps Script', icon: <Database className="h-3 w-3" /> },
            { label: 'Timezone', value: 'Asia/Makassar', icon: <Globe className="h-3 w-3" /> },
            { label: 'Storage Used', value: storageUsed, icon: <Database className="h-3 w-3" /> },
            { label: 'PWA Status', value: pwaStatus, icon: <Smartphone className="h-3 w-3" />, green: pwaStatus === 'Installed' },
            { label: 'Browser', value: browserInfo, icon: <Monitor className="h-3 w-3" /> },
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
            <AlertTriangle className="h-[22px] w-[22px]" />
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
                <Trash2 className="h-4 w-4" />
                Hapus Cache Lokal
              </div>
              <div className="text-xs text-muted-foreground">
                Hapus semua data yang tersimpan di browser (setting, notifikasi dibaca, dll)
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => void handleClearCache()}>
              <Trash2 className="h-4 w-4" />
              Hapus
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3.5 py-3">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <RefreshCw className="h-4 w-4" />
                Reset Preferensi
              </div>
              <div className="text-xs text-muted-foreground">Kembalikan semua setting ke default</div>
            </div>
            <Button variant="destructive" size="sm" onClick={() => void handleResetPrefs()}>
              <RefreshCw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </Card>

      {dialog}
    </div>
  );
}