import { Icon } from '../components/ui/icon';
import { useCallback, useEffect, useState } from 'react';
import { toastError, toastSuccess } from '@/lib/toast';
import { cabang as cabangApi, users as usersApi } from '@/lib/api';
import { useDialog } from '@/lib/dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface UserRow {
  id: number;
  username: string;
  nama: string;
  role: string;
  idCabang: string | null;
  cabangAkses: string[];
  active: boolean;
}

interface CabangRow {
  id: string;
  nama: string;
  pic: string;
  telepon: string;
  alamat: string;
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', cabang: 'Cabang', picker: 'Picker' };

const USER_KOSONG = {
  id: 0, username: '', nama: '', role: 'cabang',
  idCabang: '', cabangAkses: [] as string[], active: true, password: '',
};
const CABANG_KOSONG = { id: '', nama: '', pic: '', telepon: '', alamat: '' };

export default function UserManagement() {
  const { confirm, dialog } = useDialog();
  const [daftar, setDaftar] = useState<UserRow[]>([]);
  const [cabangs, setCabangs] = useState<CabangRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uForm, setUForm] = useState<typeof USER_KOSONG | null>(null);
  const [cForm, setCForm] = useState<typeof CABANG_KOSONG | null>(null);
  const [passwordBaru, setPasswordBaru] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [u, c] = await Promise.all([usersApi.getAll(), cabangApi.getAll({ cache: false })]);
    if (u.status === 'ok') setDaftar((u.data as UserRow[]) || []);
    else toastError(u.message || 'Gagal memuat daftar user.');
    if (c.status === 'ok') setCabangs((c.data as CabangRow[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const simpanUser = async () => {
    if (!uForm) return;
    if (!uForm.username.trim() || !uForm.nama.trim()) {
      toastError('Username dan nama wajib diisi.');
      return;
    }
    if (uForm.role === 'picker' && uForm.cabangAkses.length === 0) {
      toastError('Pilih minimal satu cabang untuk picker.');
      return;
    }
    if (uForm.role === 'cabang' && !uForm.idCabang) {
      toastError('Pilih cabang untuk role ini.');
      return;
    }
    setSaving(true);
    const payload = {
      id: uForm.id || undefined,
      username: uForm.username.trim(),
      nama: uForm.nama.trim(),
      role: uForm.role,
      idCabang: uForm.role === 'admin' ? '' : uForm.idCabang,
      cabangAkses: uForm.role === 'picker' ? uForm.cabangAkses : [],
      active: uForm.active,
      password: uForm.password.trim() || undefined,
    };
    const r = uForm.id ? await usersApi.update(payload) : await usersApi.create(payload);
    setSaving(false);
    if (r.status !== 'ok') {
      toastError(r.message || 'Gagal menyimpan user.');
      return;
    }
    toastSuccess(r.message || 'User disimpan.');
    if (r.password) setPasswordBaru(String(r.password));
    setUForm(null);
    load();
  };

  const hapusUser = async (u: UserRow) => {
    const ok = await confirm({
      icon: '🗑️',
      title: 'Hapus user?',
      message: `Akun "${u.username}" (${u.nama}) akan dihapus permanen.`,
      okText: 'Ya, hapus',
      okVariant: 'destructive',
    });
    if (!ok) return;
    const r = await usersApi.remove(u.id);
    if (r.status !== 'ok') {
      toastError(r.message || 'Gagal menghapus user.');
      return;
    }
    toastSuccess(r.message || 'User dihapus.');
    load();
  };

  const resetPassword = async (u: UserRow) => {
    const ok = await confirm({
      icon: '🔑',
      title: 'Reset password?',
      message: `Password baru untuk "${u.username}" akan dibuat dan semua sesinya diputus.`,
      okText: 'Ya, reset',
    });
    if (!ok) return;
    const r = await usersApi.resetPassword(u.id);
    if (r.status !== 'ok' || !r.password) {
      toastError(r.message || 'Gagal reset password.');
      return;
    }
    setPasswordBaru(String(r.password));
    load();
  };

  const simpanCabang = async () => {
    if (!cForm) return;
    if (!cForm.id.trim() || !cForm.nama.trim()) {
      toastError('Kode dan nama cabang wajib diisi.');
      return;
    }
    setSaving(true);
    const baru = !cabangs.some((c) => c.id === cForm.id.toUpperCase());
    const r = baru ? await cabangApi.create(cForm) : await cabangApi.update(cForm);
    setSaving(false);
    if (r.status !== 'ok') {
      toastError(r.message || 'Gagal menyimpan cabang.');
      return;
    }
    toastSuccess(r.message || 'Cabang disimpan.');
    setCForm(null);
    load();
  };

  const hapusCabang = async (c: CabangRow) => {
    const ok = await confirm({
      icon: '🗑️',
      title: 'Hapus cabang?',
      message: `Cabang "${c.id} — ${c.nama}" akan dihapus. Hanya bisa kalau belum ada user/order yang menempel.`,
      okText: 'Ya, hapus',
      okVariant: 'destructive',
    });
    if (!ok) return;
    const r = await cabangApi.remove(c.id);
    if (r.status !== 'ok') {
      toastError(r.message || 'Gagal menghapus cabang.');
      return;
    }
    toastSuccess(r.message || 'Cabang dihapus.');
    load();
  };

  const salin = async (teks: string) => {
    try {
      await navigator.clipboard.writeText(teks);
      toastSuccess('Password disalin.');
    } catch {
      toastError('Gagal menyalin — salin manual.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Kelola User</h1>
          <p className="text-sm text-muted-foreground">
            Tambah, ubah, nonaktifkan, dan reset password akun — semua dari sini.
          </p>
        </div>
        <Button onClick={() => setUForm({ ...USER_KOSONG })}>
          <Icon name="plus" size={16} />
          <span className="ml-2">Tambah User</span>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Memuat…</div>
          ) : (
            <div className="divide-y divide-border">
              {daftar.map((u) => (
                <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{u.nama}</span>
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase">
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                      {u.idCabang && (
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold">
                          {u.idCabang}
                        </span>
                      )}
                      {!u.active && (
                        <span className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger">
                          NONAKTIF
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">@{u.username}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => resetPassword(u)}>
                      <Icon name="key" size={14} />
                      <span className="ml-1.5">Reset</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setUForm({ ...u, idCabang: u.idCabang || '', cabangAkses: u.cabangAkses || [], password: '' })}>
                      <Icon name="pencil" size={14} />
                      <span className="ml-1.5">Edit</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => hapusUser(u)}>
                      <Icon name="trash" size={14} className="text-danger" />
                    </Button>
                  </div>
                </div>
              ))}
              {!daftar.length && (
                <div className="p-6 text-sm text-muted-foreground">Belum ada user.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Kelola Cabang</h2>
          <p className="text-sm text-muted-foreground">Tambah cabang baru atau ubah data cabang.</p>
        </div>
        <Button variant="outline" onClick={() => setCForm({ ...CABANG_KOSONG })}>
          <Icon name="plus" size={16} />
          <span className="ml-2">Tambah Cabang</span>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {cabangs.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold">
                      {c.id}
                    </span>
                    <span className="truncate text-sm font-semibold">{c.nama}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    PIC: {c.pic || '-'} · {c.telepon || '-'} · {c.alamat || '-'}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setCForm({ ...c })}>
                    <Icon name="pencil" size={14} />
                    <span className="ml-1.5">Edit</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => hapusCabang(c)}>
                    <Icon name="trash" size={14} className="text-danger" />
                  </Button>
                </div>
              </div>
            ))}
            {!cabangs.length && <div className="p-6 text-sm text-muted-foreground">Belum ada cabang.</div>}
          </div>
        </CardContent>
      </Card>

      {/* Dialog user */}
      <Dialog open={!!uForm} onOpenChange={(v) => !v && setUForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{uForm?.id ? 'Edit User' : 'Tambah User'}</DialogTitle>
          </DialogHeader>
          {uForm && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input
                  value={uForm.username}
                  onChange={(e) => setUForm({ ...uForm, username: e.target.value })}
                  placeholder="mis. cb005"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nama</Label>
                <Input
                  value={uForm.nama}
                  onChange={(e) => setUForm({ ...uForm, nama: e.target.value })}
                  placeholder="mis. Toko Perabot Mama — Budi"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={uForm.role} onValueChange={(v) => setUForm({ ...uForm, role: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — lihat semua cabang</SelectItem>
                    <SelectItem value="cabang">Cabang — hanya cabangnya</SelectItem>
                    <SelectItem value="picker">Picker — hanya cabangnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {uForm.role === 'picker' ? (
                <div className="space-y-1.5">
                  <Label>Cabang yang bisa diakses</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {cabangs.map((c) => {
                      const on = uForm.cabangAkses.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setUForm({
                              ...uForm,
                              cabangAkses: on
                                ? uForm.cabangAkses.filter((x) => x !== c.id)
                                : [...uForm.cabangAkses, c.id],
                            })
                          }
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                            on ? 'border-brand bg-brand text-white' : 'border-border hover:border-brand/50',
                          )}
                        >
                          {c.id}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Picker hanya melihat order dari cabang yang dipilih.
                  </p>
                </div>
              ) : uForm.role === 'cabang' ? (
                <div className="space-y-1.5">
                  <Label>Cabang</Label>
                  <Select value={uForm.idCabang} onValueChange={(v) => setUForm({ ...uForm, idCabang: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih cabang" />
                    </SelectTrigger>
                    <SelectContent>
                      {cabangs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.id} — {c.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label>{uForm.id ? 'Password baru (opsional)' : 'Password (opsional)'}</Label>
                <Input
                  type="text"
                  value={uForm.password}
                  onChange={(e) => setUForm({ ...uForm, password: e.target.value })}
                  placeholder="Kosongkan = dibuatkan otomatis"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="text-sm font-semibold">Akses aktif</div>
                  <div className="text-xs text-muted-foreground">Matikan untuk menutup akses login akun ini.</div>
                </div>
                <Switch checked={uForm.active} onCheckedChange={(v) => setUForm({ ...uForm, active: v })} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setUForm(null)}>
                  Batal
                </Button>
                <Button onClick={simpanUser} disabled={saving}>
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog cabang */}
      <Dialog open={!!cForm} onOpenChange={(v) => !v && setCForm(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{cForm && cabangs.some((c) => c.id === cForm.id.toUpperCase()) ? 'Edit Cabang' : 'Tambah Cabang'}</DialogTitle>
          </DialogHeader>
          {cForm && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Kode cabang</Label>
                <Input
                  value={cForm.id}
                  disabled={cabangs.some((c) => c.id === cForm.id.toUpperCase())}
                  onChange={(e) => setCForm({ ...cForm, id: e.target.value.toUpperCase() })}
                  placeholder="mis. CB005"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nama cabang</Label>
                <Input value={cForm.nama} onChange={(e) => setCForm({ ...cForm, nama: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>PIC</Label>
                <Input value={cForm.pic} onChange={(e) => setCForm({ ...cForm, pic: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Telepon</Label>
                <Input value={cForm.telepon} onChange={(e) => setCForm({ ...cForm, telepon: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Alamat</Label>
                <Input value={cForm.alamat} onChange={(e) => setCForm({ ...cForm, alamat: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setCForm(null)}>
                  Batal
                </Button>
                <Button onClick={simpanCabang} disabled={saving}>
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Password hasil reset — tampil sekali */}
      <Dialog open={!!passwordBaru} onOpenChange={(v) => !v && setPasswordBaru(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Password Baru</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Catat sekarang dan serahkan ke pemilik akun. Setelah login, dia wajib menggantinya lewat menu
            <b> Ganti Password</b>.
          </p>
          <div className="rounded-lg bg-foreground px-4 py-3 text-center font-mono text-2xl font-bold tracking-widest text-background">
            {passwordBaru}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => passwordBaru && salin(passwordBaru)}>
              <Icon name="paste" size={14} />
              <span className="ml-1.5">Salin</span>
            </Button>
            <Button onClick={() => setPasswordBaru(null)}>Selesai</Button>
          </div>
        </DialogContent>
      </Dialog>

      {dialog}
    </div>
  );
}
