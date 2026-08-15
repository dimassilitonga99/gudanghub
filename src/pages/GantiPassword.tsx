import { Icon } from '../components/ui/icon';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toastSuccess } from '@/lib/toast';

import { auth } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { clearSession, homeRouteForSession } from '@/lib/session';
import { ROUTES } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';

function calculateStrength(password: string): { score: number; label: string; level: 'weak' | 'medium' | 'strong' } {
  if (!password) return { score: 0, label: '-', level: 'weak' };

  let score = 0;

  if (password.length >= 6) score += 20;
  if (password.length >= 8) score += 15;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 10;

  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 10;

  let label: string;
  let level: 'weak' | 'medium' | 'strong';
  if (score < 40) {
    label = 'Lemah';
    level = 'weak';
  } else if (score < 70) {
    label = 'Sedang';
    level = 'medium';
  } else {
    label = 'Kuat';
    level = 'strong';
  }

  return { score: Math.min(100, score), label, level };
}

function validateForm(oldPass: string, newPass: string, confirmPass: string): string {
  if (!oldPass || !newPass || !confirmPass) {
    return 'Semua kolom wajib diisi.';
  }

  if (newPass.length < 6) {
    return 'Password baru minimal 6 karakter.';
  }

  if (newPass !== confirmPass) {
    return 'Ulangi password tidak sama dengan password baru.';
  }

  if (newPass === oldPass) {
    return 'Password baru harus berbeda dari password lama.';
  }

  const { score } = calculateStrength(newPass);
  if (score < 40) {
    return 'Password terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf, angka, dan simbol.';
  }

  return '';
}

const LEVEL_COLORS: Record<'weak' | 'medium' | 'strong', string> = {
  weak: 'bg-danger',
  medium: 'bg-warning',
  strong: 'bg-success',
};

export default function GantiPassword() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [shaking, setShaking] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oldInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => oldInputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimer.current) clearTimeout(errorTimer.current);
    };
  }, []);

  const showError = (message: string) => {
    setSuccess('');
    setError(message);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setError(''), 6000);
  };

  const showSuccess = (message: string) => {
    setError('');
    setSuccess(message);
  };

  const shakeCard = () => {
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
  };

  const strength = calculateStrength(newPassword);
  const levelColor = LEVEL_COLORS[strength.level];

  const submit = async () => {
    if (!session) {
      navigate(ROUTES.login);
      return;
    }

    const validationError = validateForm(oldPassword, newPassword, confirmPassword);

    if (validationError) {
      showError(validationError);
      shakeCard();
      return;
    }

    setSaving(true);

    try {
      const result = await auth.changePassword({
        username: session.username,
        passwordLama: oldPassword,
        passwordBaru: newPassword,
      });

      if (result.status !== 'ok') {
        showError(result.message || 'Gagal mengubah password.');
        setSaving(false);
        shakeCard();
        return;
      }

      showSuccess(result.message || 'Password berhasil diubah! Silakan login ulang.');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaving(false);

      toastSuccess('Password berhasil diubah!');

      await new Promise((r) => setTimeout(r, 2000));
      clearSession();
      navigate(ROUTES.login);
    } catch (e) {
      showError((e as Error).message || 'Terjadi kesalahan. Coba lagi.');
      setSaving(false);
      shakeCard();
    }
  };

  const eyeToggle = (
    show: boolean,
    setShow: (v: boolean) => void,
    labelShow: string,
    labelHide: string,
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 shrink-0 text-muted-foreground"
      aria-label={show ? labelHide : labelShow}
      onClick={() => setShow(!show)}
    >
      {show ? <Icon name="eye-crossed" size={18} /> : <Icon name="eye" size={18} />}
    </Button>
  );

  return (
    <div className="mx-auto max-w-md space-y-4">
      <button
        type="button"
        onClick={() => navigate(homeRouteForSession(session))}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <Icon name="arrow-left" size={16} />
        {session?.role === 'admin' ? 'Kembali ke Dashboard' : 'Kembali ke Order'}
      </button>

      <h1 className="font-display text-2xl font-bold">Ganti Password</h1>

      <Card className={cn('p-6', shaking && 'animate-shake')}>
        {/* Info user */}
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-lg font-extrabold text-white">
            {(session?.nama || session?.username || '?').charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-base font-bold">{session?.nama || session?.username || '-'}</div>
            <div className="text-sm text-muted-foreground">@{session?.username || '-'}</div>
          </div>
        </div>

        {/* Pesan error / sukses */}
        {error && (
          <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg border border-success/30 bg-success/10 px-3.5 py-2.5 text-sm text-success">
            {success}
          </div>
        )}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="oldPassword">Password Lama</Label>
            <div className="flex items-center gap-2">
              <Input
                id="oldPassword"
                ref={oldInputRef}
                type={showOld ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => {
                  setOldPassword(e.target.value);
                  setError('');
                }}
                placeholder="Password saat ini"
                autoComplete="current-password"
                className="flex-1"
              />
              {eyeToggle(showOld, setShowOld, 'Tampilkan password', 'Sembunyikan password')}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Password Baru</Label>
            <div className="flex items-center gap-2">
              <Input
                id="newPassword"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError('');
                }}
                placeholder="Minimal 6 karakter"
                autoComplete="new-password"
                className="flex-1"
              />
              {eyeToggle(showNew, setShowNew, 'Tampilkan password', 'Sembunyikan password')}
            </div>
            {/* Strength meter */}
            <div className="flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all duration-300', levelColor)}
                  style={{ width: `${strength.score}%` }}
                />
              </div>
              <span
                className={cn(
                  'w-14 text-right text-xs font-semibold',
                  strength.level === 'weak'
                    ? 'text-danger'
                    : strength.level === 'medium'
                      ? 'text-warning'
                      : 'text-success',
                )}
              >
                {strength.label}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Ulangi Password Baru</Label>
            <div className="flex items-center gap-2">
              <Input
                id="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                placeholder="Ulangi password baru"
                autoComplete="new-password"
                className="flex-1"
              />
              {eyeToggle(showConfirm, setShowConfirm, 'Tampilkan password', 'Sembunyikan password')}
            </div>
          </div>

          <Button className="w-full" type="submit" disabled={saving}>
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Menyimpan...
              </>
            ) : (
              <>
                <Icon name="floppy-disks" size={18} />
                Simpan Password Baru
              </>
            )}
          </Button>
        </form>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon name="key" size={14} />
        Gunakan minimal 8 karakter dengan kombinasi huruf, angka, dan simbol.
      </div>
    </div>
  );
}