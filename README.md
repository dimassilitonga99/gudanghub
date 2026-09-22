# GudangHub

Aplikasi operasional **PT Central Perabot Utama (Toko Nasional Kitchen — NTT)** untuk mengelola
order barang antar cabang: katalog, keranjang, pengajuan order, persetujuan admin, pengambilan
barang di gudang, sampai laporan.

Dipakai oleh **1 admin pusat**, **4 cabang** (CB001–CB004), dan **picker gudang**.

---

## Peran & hak akses

| Peran | Bisa apa | Cakupan data |
|---|---|---|
| `admin` | Setujui/tolak order, edit item order, kelola master barang (tambah/edit/hapus/impor XLSX), lihat & requeue email, reset order | Semua cabang |
| `cabang` | Lihat katalog, susun keranjang, kirim order, isi stok otomatis, catat ambil barang dari gudang, lihat riwayat & laporan | **Hanya cabangnya sendiri** |
| `picker` | Verifikasi/tandai order sudah diambil | **Hanya cabangnya sendiri** |

Reset order (menghapus order satu cabang) hanya bisa dilakukan dengan **password admin**, dan
untuk peran `cabang` hanya menghapus order cabangnya sendiri.

---

## Fitur

- **Katalog barang** — ±5.000 item, pencarian & filter kategori, paginasi.
- **Order cabang** — keranjang, isi stok otomatis dari stok sistem, order massal, cetak form order.
- **Dashboard admin** — daftar order masuk, setujui/tolak, edit item (ubah qty/harga, hapus item).
- **Picker gudang** — tandai order sudah diambil.
- **Ambil barang dari gudang** (`store takes`) — catat pengambilan per batch, per cabang.
- **Master barang** — CRUD + **impor massal dari XLSX** (upsert berdasarkan `kode`) + unduh template.
- **Laporan** — rekap order per cabang, siap cetak.
- **Notifikasi email** — order baru ke admin, perubahan status ke cabang.
- **PWA** — bisa dipasang di HP, dengan dukungan offline untuk aset statis.

---

## Arsitektur

```
Browser (React PWA)
   │  Cloudflare Pages  →  https://gudanghub.pages.dev
   │
   ├─► Cloudflare Worker (adapter)  →  gudanghub-api-proxy.silitongadimas.workers.dev
   │        · menerjemahkan action lama → REST v5
   │        · cache KV, gzip, simpan gambar ke R2 (/img/<key>)
   │
   └─► Vercel API (Hono)  →  gudanghub-api.vercel.app/api
            · autentikasi JWT, otorisasi per peran, validasi
            · Neon Postgres (barang, orders, order_items, users, cabang, store_takes, emails)
```

- **Frontend** (repo ini): React 19 + TypeScript + Vite + Tailwind, PWA.
- **Backend**: Hono di Vercel Functions, Postgres (Neon), email lewat Resend.
  Repo terpisah dan **privat**.
- **Gambar barang**: Cloudflare R2, disajikan lewat worker.

---

## Struktur folder

```
gudanghub/
├── src/
│   ├── pages/           # Halaman: Landing, Login, Order, Dashboard, ItemManagement, Picker, ...
│   ├── components/      # Komponen UI + komponen bersama (print-form, store-take, ItemPhoto)
│   │   └── ui/          # Primitif UI (button, dialog, sheet, table, ...)
│   ├── lib/             # api.ts (klien API), session.ts, config.ts, dialog, toast, pwa
│   ├── context/         # AuthContext
│   ├── styles/          # tokens.css, base.css, components.css
│   └── js/              # Kode aplikasi versi lama (v3, vanilla JS) — dipertahankan sebagai arsip
├── public/              # Aset statis yang ikut ter-deploy (favicon, ikon PWA, gambar, demo)
├── tools/               # Perkakas internal, TIDAK ikut ter-deploy
├── test/                # Skrip uji manual (Playwright / fetch) — kredensial dari environment
├── sw.js                # Service worker (disalin ke dist saat build)
└── vite.config.ts
```

> Apa pun yang ada di `public/` akan **terbaca publik di internet**. Jangan pernah menaruh
> catatan internal, dokumen, atau berkas sensitif di sana.

---

## Menjalankan lokal

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # hasil di dist/
npm run preview      # cek hasil build
```

Butuh Node.js LTS.

---

## Deploy

Frontend memakai **Cloudflare Pages** (bukan GitHub Pages):

```bash
npm run build
npx wrangler pages deploy dist --project-name=gudanghub --commit-dirty=true
```

`base` di `vite.config.ts` tetap `'/'` karena di-serve dari root domain.

---

## Uji otomatis

Skrip di `test/` tidak menyimpan kredensial apa pun. Isi lewat environment variable:

```powershell
$env:TEST_USER = "admin"
$env:TEST_PASSWORD = "<password akun uji>"
node test/smoke-v5.mjs
```

---

## Keamanan

- Kredensial **tidak boleh** ditulis di dalam kode atau dokumen. `.env` sudah di-`.gitignore`.
- Setiap kali password pernah bocor (mis. ter-commit), **wajib dirotasi** — mengganti isi file
  saja tidak menghapusnya dari riwayat Git.
- Password disimpan sebagai hash `scrypt` (bukan teks biasa), dan login dibatasi percobaannya.
- Data cabang difilter di backend berdasarkan cabang milik token — bukan hanya disembunyikan di UI.

---

## Kontak

- **Admin Gudang:** silitongadimas@gmail.com
- **Repositori:** privat

© 2025 PT Central Perabot Utama — NTT
