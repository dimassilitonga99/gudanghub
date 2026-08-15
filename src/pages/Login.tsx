import { Icon } from '../components/ui/icon';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { katalog, prewarmAppScript } from '@/lib/api';
import { API_URL, ROUTES } from '@/lib/config';
import { getLastUsername } from '@/lib/session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { auth } from '@/lib/api';
import { GradientShimmer } from '@/components/ui/gradient-shimmer';

function prewarm() {
  prewarmAppScript();
  try {
    fetch(API_URL + '?action=ping&t=' + Date.now(), { method: 'GET', cache: 'no-store' }).catch(() => {});
  } catch {}
}

export default function Login() {
  const { login, session } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotUser, setForgotUser] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const lastPrewarm = useRef(0);

  useEffect(() => {
    prewarm();
    const lastUser = getLastUsername();
    if (lastUser) {
      setUsername(lastUser);
      setRemember(true);
    }
    setTimeout(() => usernameRef.current?.focus(), 300);
  }, []);

  const prewarmOnTyping = () => {
    const now = Date.now();
    if (now - lastPrewarm.current < 30000) return;
    lastPrewarm.current = now;
    try {
      fetch(API_URL + '?action=ping&t=' + Date.now(), { method: 'GET', cache: 'no-store' }).catch(() => {});
    } catch {}
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const u = username.trim();
    if (!u || !password) {
      setError('Username dan password wajib diisi.');
      return;
    }
    if (u.length < 3) {
      setError('Username minimal 3 karakter.');
      return;
    }

    setLoading(true);
    let result: Awaited<ReturnType<typeof login>> | null = null;
    let lastErr: Error | null = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        result = await login(u, password);
        break;
      } catch (err) {
        lastErr = err as Error;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
      }
    }

    if (!result) {
      setError(lastErr?.message || 'Login gagal. Coba lagi.');
      setLoading(false);
      return;
    }

    const role = result?.role;
    const idCabang = result?.idCabang;

    if (role === 'cabang' && !idCabang) {
      setError('Akun cabang tidak punya ID cabang. Hubungi admin.');
      setLoading(false);
      return;
    }

    toast.success('Selamat datang, ' + (session?.nama || session?.username) + '!', { duration: 2000 });

    try {
      prewarmAppScript();
      if (role !== 'admin') {
        katalog.getAll({ cache: false, timeout: 45000, maxRetries: 0 }).catch(() => {});
      }
    } catch {}

    const home = role === 'admin' ? ROUTES.dashboard : role === 'picker' ? ROUTES.picker : ROUTES.order;
    navigate(home + (role === 'cabang' && idCabang ? `?cabang=${encodeURIComponent(idCabang)}` : ''), { replace: true });
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

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 60% 60% at 50% 50%, #1B4B5A 0%, #123B4A 40%, #0A1F2E 70%, #08151C 100%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30">
            <Icon name="shop" size={28} />
          </span>
          <GradientShimmer
            gradient="sunrise"
            className="font-display text-3xl font-bold text-white"
          >
            GudangHub
          </GradientShimmer>
          <p className="mt-1 text-sm text-white/60">
            PT Central Perabot Utama — NTT
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-6 text-ink-900 shadow-2xl sm:p-8">
          <h1 className="mb-1 text-xl font-bold text-ink-900">Masuk</h1>
          <p className="mb-5 text-sm text-ink-900/60">
            Masukkan username dan password untuk mulai mengelola order.
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="inputUser">Username</Label>
              <div className="relative">
                <Icon name="user" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-900/40" />
                <Input
                  id="inputUser"
                  ref={usernameRef}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                    prewarmOnTyping();
                  }}
                  placeholder="Masukkan username Anda"
                  className="border-ink-900/15 bg-ink-900/5 pl-9 text-ink-900 placeholder:text-ink-900/40 focus-visible:ring-brand"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="inputPass">Password</Label>
              <div className="relative">
                <Icon name="lock" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-900/40" />
                <Input
                  id="inputPass"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                    prewarmOnTyping();
                  }}
                  placeholder="Masukkan password"
                  className="border-ink-900/15 bg-ink-900/5 pl-9 pr-10 text-ink-900 placeholder:text-ink-900/40 focus-visible:ring-brand"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-900/50 hover:text-ink-900"
                  aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPw ? <Icon name="eye-crossed" size={16} /> : <Icon name="eye" size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-900/70">
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
                className="text-sm font-semibold text-brand hover:underline"
              >
                Lupa password?
              </button>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Memverifikasi...
                </>
              ) : (
                <>
                  <Icon name="sign-in-alt" size={16} />
                  Masuk
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-white/50">
          <Link to="/" className="hover:text-white/80">
            Kembali ke beranda
          </Link>
        </p>
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
            <Input
              value={forgotUser}
              onChange={(e) => {
                setForgotUser(e.target.value);
                setForgotMsg(null);
              }}
              placeholder="Username"
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