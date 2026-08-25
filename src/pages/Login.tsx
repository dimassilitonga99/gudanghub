import { Icon } from '../components/ui/icon';
import { SmokeyBackground } from '@/components/ui/login-form';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, ArrowRight } from 'lucide-react';

import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { auth, katalog, orders, prewarmAppScript } from '@/lib/api';
import { API_URL, ROUTES } from '@/lib/config';
import {
  getLastUsername,
  getSession,
  homeRouteForSession,
  isSessionValid,
  setLastUsername,
} from '@/lib/session';
import { simpleHash, sleep } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GradientShimmer } from '@/components/ui/gradient-shimmer';

const CRED_CACHE_KEY = 'gudanghub_login_cache';

interface CachedUser {
  username?: string;
  nama?: string;
  role?: string;
  idCabang?: string | null;
}

function getCachedLogin(username: string, password: string): CachedUser | null {
  try {
    const raw = localStorage.getItem(CRED_CACHE_KEY);
    if (!raw) return null;
    const cache = JSON.parse(raw) as {
      hash?: string;
      user?: CachedUser;
      time?: number;
    };
    if (!cache || !cache.hash || !cache.user || !cache.time) return null;
    if (Date.now() - cache.time > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CRED_CACHE_KEY);
      return null;
    }
    if (simpleHash(username.toLowerCase() + ':' + password) !== cache.hash) return null;
    return cache.user;
  } catch {
    return null;
  }
}

function setCachedLogin(username: string, password: string, user: CachedUser): void {
  try {
    const hash = simpleHash(username.toLowerCase() + ':' + password);
    localStorage.setItem(
      CRED_CACHE_KEY,
      JSON.stringify({ hash, user, time: Date.now() }),
    );
  } catch {
    /* storage penuh */
  }
}

async function verifyInBackground(username: string, password: string): Promise<void> {
  try {
    const result = await auth.login({ username, password });
    if (result.status === 'ok' && result.user) {
      setCachedLogin(username, password, result.user as CachedUser);
    } else if (result.status === 'error') {
      localStorage.removeItem(CRED_CACHE_KEY);
    }
  } catch {
    /* offline — cache tetap dipakai */
  }
}

function prewarm() {
  prewarmAppScript();
  try {
    fetch(API_URL + '?action=ping&t=' + Date.now(), { method: 'GET', cache: 'no-store' }).catch(() => {});
  } catch {}
}

export default function Login() {
  const { login, restoreSession } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Memverifikasi...');
  const [shaking, setShaking] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUser, setForgotUser] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const lastPrewarm = useRef(0);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = (msg: string) => {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(''), 5000);
  };

  useEffect(() => {
    const s = getSession();
    if (isSessionValid(s)) {
      navigate(homeRouteForSession(s), { replace: true });
      return;
    }
    prewarm();
    const lastUser = getLastUsername();
    if (lastUser) {
      setUsername(lastUser);
      setRemember(true);
    }
    setTimeout(() => usernameRef.current?.focus(), 300);
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, [navigate]);

  const prewarmOnTyping = () => {
    const now = Date.now();
    if (now - lastPrewarm.current < 30000) return;
    lastPrewarm.current = now;
    try {
      fetch(API_URL + '?action=ping&t=' + Date.now(), { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {});
    } catch {}
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const u = username.trim();
    if (!u || !password) {
      showError('Username dan password wajib diisi.');
      return;
    }
    if (u.length < 3) {
      showError('Username minimal 3 karakter.');
      return;
    }

    setLoading(true);

    // ═══ STRATEGI 1: Cache kredensial (login instan) ═══
    const cachedUser = getCachedLogin(u, password);
    if (cachedUser) {
      setLoadingText('Masuk...');
      try {
        const s = await restoreSession(cachedUser, 'cached-' + Date.now());
        setLastUsername(remember ? s.username : '');
        toast.success('Selamat datang, ' + (s.nama || s.username) + '!', { duration: 2000 });
        await sleep(200);
        navigate(homeRouteForSession(s), { replace: true });
        void verifyInBackground(u, password);
        return;
      } catch (err) {
        setLoading(false);
        showError((err as Error).message || 'Login gagal. Coba lagi.');
        return;
      }
    }

    // ═══ STRATEGI 2: Server (retry agresif 3x) ═══
    let result: Awaited<ReturnType<typeof login>> | null = null;
    let lastErr: Error | null = null;
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      setLoadingText(`Memverifikasi... (${attempt}/${maxAttempts})`);
      try {
        result = await login(u, password, remember);
        break;
      } catch (err) {
        lastErr = err as Error;
        console.warn('[Login] Attempt ' + attempt + '/' + maxAttempts + ' failed:', (err as Error).message);
        if (attempt < maxAttempts) {
          setLoadingText('Mencoba lagi...');
          await sleep(500);
        }
      }
    }

    if (!result) {
      showError(lastErr?.message || 'Login gagal. Coba lagi.');
      setLoading(false);
      return;
    }

    if (result.role === 'cabang' && !result.idCabang) {
      showError('Akun cabang tidak punya ID cabang. Hubungi admin.');
      setLoading(false);
      return;
    }

    setCachedLogin(u, password, {
      username: result.username,
      nama: result.nama,
      role: result.role,
      idCabang: result.idCabang,
    });

    toast.success('Selamat datang, ' + (result.nama || result.username) + '!', { duration: 2000 });

    try {
      prewarmAppScript();
      if (result.role === 'admin') {
        // Hangatkan cache getOrders saat login → dashboard langsung render instan
        orders.getAll({ cache: true, timeout: 45000, maxRetries: 0 }).catch(() => {});
      } else {
        katalog.getAll({ cache: false, timeout: 45000, maxRetries: 0 }).catch(() => {});
      }
    } catch {}

    await sleep(200);
    const home =
      result.role === 'admin'
        ? ROUTES.dashboard
        : result.role === 'picker'
          ? ROUTES.picker
          : ROUTES.order;
    navigate(
      home +
        (result.role === 'cabang' && result.idCabang
          ? `?cabang=${encodeURIComponent(result.idCabang)}`
          : ''),
      { replace: true },
    );
  };

  const submitForgot = async () => {
    if (forgotLoading) return;
    setForgotMsg(null);
    if (!forgotUser.trim()) {
      setForgotMsg({ ok: false, text: 'Username wajib diisi.' });
      return;
    }
    setForgotLoading(true);
    try {
      const result = await auth.forgotPassword({ username: forgotUser.trim() });
      setForgotMsg(
        result.status === 'ok'
          ? { ok: true, text: String(result.message || 'Permintaan terkirim ke admin gudang.') }
          : { ok: false, text: String(result.message || 'Gagal memproses permintaan.') },
      );
    } catch (err) {
      setForgotMsg({ ok: false, text: (err as Error).message || 'Gagal terhubung ke server.' });
    }
    setForgotLoading(false);
  };

  const inputBase =
    'peer block w-full appearance-none border-0 border-b-2 border-white/30 bg-transparent px-0 py-2.5 text-sm text-white placeholder:text-transparent focus:border-orange-400 focus:outline-none focus:ring-0 [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[box-shadow:0_0_0px_1000px_rgba(8,21,28,0.85)_inset]';

  const labelBase =
    'pointer-events-none absolute left-0 top-3 z-0 origin-[0] -translate-y-6 scale-75 transform text-sm duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:left-0 peer-focus:-translate-y-6 peer-focus:scale-75';

  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-950">
      {/* WebGL smokey background (PRD) */}
      <SmokeyBackground backdropBlurAmount="md" color="#155E75" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Brand header */}
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-xl shadow-orange-500/40">
              <Icon name="shop" size={30} />
            </span>
            <GradientShimmer gradient="sunrise" className="font-display text-4xl font-bold text-white">
              GudangHub
            </GradientShimmer>
            <p className="mt-1.5 text-sm text-white/50">PT Central Perabot Utama — NTT</p>
          </div>

          {/* Glassmorphism card (PRD) */}
          <div
            className={
              'rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-xl sm:p-8' +
              (shaking ? ' animate-shake' : '')
            }
          >
            <div className="mb-6 text-center">
              <h1 className="text-3xl font-bold text-white">Selamat Datang</h1>
              <p className="mt-2 text-sm text-gray-300">Masuk untuk melanjutkan</p>
            </div>

            {error && (
              <div className="mb-5 rounded-lg border border-red-400/30 bg-red-500/15 px-3 py-2.5 text-sm font-medium text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-7">
              {/* Username dengan floating label */}
              <div className="relative z-0">
                <input
                  type="text"
                  id="inputUser"
                  ref={usernameRef}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                    prewarmOnTyping();
                  }}
                  className={inputBase}
                  placeholder=" "
                  autoComplete="username"
                  required
                />
                <label htmlFor="inputUser" className={`${labelBase} text-white/60 peer-focus:text-orange-400`}>
                  <User className="-mt-0.5 mr-2 inline-block" size={16} />
                  Username
                </label>
              </div>

              {/* Password dengan floating label */}
              <div className="relative z-0">
                <input
                  type={showPw ? 'text' : 'password'}
                  id="inputPass"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                    prewarmOnTyping();
                  }}
                  className={`${inputBase} pr-9`}
                  placeholder=" "
                  autoComplete="current-password"
                  required
                />
                <label htmlFor="inputPass" className={`${labelBase} text-white/60 peer-focus:text-orange-400`}>
                  <Lock className="-mt-0.5 mr-2 inline-block" size={16} />
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-1 text-white/50 transition-colors hover:text-white"
                  aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  <Icon name={showPw ? 'eye-crossed' : 'eye'} size={16} />
                </button>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(v) => setRemember(v === true)}
                    id="remember"
                  />
                  Ingat saya
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotUser(username);
                    setForgotMsg(null);
                    setForgotOpen(true);
                  }}
                  className="text-xs text-white/70 transition hover:text-white"
                >
                  Lupa password?
                </button>
              </div>

              {/* Submit dengan arrow animation (PRD) */}
              <Button type="submit" disabled={loading} className="group w-full gap-2 py-3">
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {loadingText}
                  </>
                ) : (
                  <>
                    Masuk
                    <ArrowRight className="h-5 w-5 transform transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          </div>

          <p className="mt-5 text-center text-xs text-white/50">
            <Link to="/" className="transition hover:text-white/80">
              ← Kembali ke beranda
            </Link>
          </p>
        </div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Lupa Password</DialogTitle>
            <DialogDescription>
              Masukkan username Anda. Permintaan reset akan dikirim ke admin gudang.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input
              value={forgotUser}
              onChange={(e) => {
                setForgotUser(e.target.value);
                setForgotMsg(null);
              }}
              placeholder="Username"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void submitForgot();
                }
              }}
            />
            {forgotMsg && (
              <div
                className={
                  forgotMsg.ok
                    ? 'rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success'
                    : 'rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger'
                }
              >
                {forgotMsg.text}
              </div>
            )}
            <Button onClick={submitForgot} disabled={forgotLoading} className="w-full">
              {forgotLoading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Mengirim...
                </>
              ) : (
                <>
                  <Icon name="paper-plane" size={16} />
                  Kirim ke Admin
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
