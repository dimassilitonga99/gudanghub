import { Icon } from '../components/ui/icon';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { auth, katalog, prewarmAppScript } from '@/lib/api';
import { API_URL, ROUTES } from '@/lib/config';
import { getLastUsername, isSessionValid } from '@/lib/session';
import { simpleHash, sleep } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { GradientShimmer } from '@/components/ui/gradient-shimmer';

export default function ItemLogin() {
  const { login, restoreSession } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Memverifikasi...');
  const [shaking, setShaking] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const lastPrewarm = useRef(0);

  const showError = (msg: string) => {
    setError(msg);
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    const errorTimer = setTimeout(() => setError(''), 5000);
  };

  useEffect(() => {
    const s = useAuth().getSession();
    if (isSessionValid(s) && s.role === 'admin') {
      navigate(ROUTES.itemManagement, { replace: true });
      return;
    }
    prewarm();
    const lastUser = getLastUsername();
    if (lastUser) {
      setUsername(lastUser);
    }
    setTimeout(() => usernameRef.current?.focus(), 300);
  }, [navigate]);

  const prewarm = () => {
    prewarmAppScript();
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

    try {
      const result = await login(u, password, true);
      
      if (result.role !== 'admin') {
        showError('Akses ini hanya untuk admin.');
        setLoading(false);
        return;
      }

      toast.success('Selamat datang, ' + (result.nama || result.username) + '!', { duration: 2000 });
      await sleep(300);
      navigate(ROUTES.itemManagement);
    } catch (err) {
      showError((err as Error).message || 'Login gagal. Coba lagi.');
      setLoading(false);
    }
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
          <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/60 text-white shadow-lg shadow-primary/30">
            <Icon name="boxes" size={28} />
          </span>
          <GradientShimmer
            gradient="sunrise"
            className="font-display text-3xl font-bold text-white"
          >
            Item Management
          </GradientShimmer>
          <p className="mt-1 text-sm text-white/60">
            PT Central Perabot Utama — Admin Only
          </p>
        </div>

        <div
          className={
            'rounded-2xl border border-white/10 bg-white p-6 text-ink-900 shadow-2xl sm:p-8' +
            (shaking ? ' animate-shake' : '')
          }
        >
          <h1 className="mb-1 text-xl font-bold text-ink-900">Admin Login</h1>
          <p className="mb-5 text-sm text-ink-900/60">
            Masukkan kredensial admin untuk mengelola item.
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="adminUser">Username Admin</Label>
              <div className="relative">
                <Icon name="user" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-900/40" />
                <Input
                  id="adminUser"
                  ref={usernameRef}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError('');
                    try {
                      fetch(API_URL + '?action=ping&t=' + Date.now(), { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {});
                    } catch {}
                  }}
                  placeholder="Masukkan username admin"
                  className="border-ink-900/15 bg-ink-900/5 pl-9 text-ink-900 placeholder:text-ink-900/40 focus-visible:ring-primary"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adminPass">Password Admin</Label>
              <div className="relative">
                <Icon name="lock" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-900/40" />
                <Input
                  id="adminPass"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Masukkan password admin"
                  className="border-ink-900/15 bg-ink-900/5 pl-9 pr-10 text-ink-900 placeholder:text-ink-900/40 focus-visible:ring-primary"
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

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  {loadingText}
                </>
              ) : (
                <>
                  <Icon name="sign-in-alt" size={16} />
                  Masuk ke Item Management
                </>
              )}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-ink-900/60">
            <Link to="/" className="font-semibold text-primary hover:underline">
              ← Kembali ke beranda
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
