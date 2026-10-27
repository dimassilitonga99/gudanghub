# Desain: Background ASCII Animasi Sidebar

## Intent
Memasang video ASCII “Vignette Bloom” sebagai background sidebar desktop halaman internal/dashboard, tanpa menghapus atau mengganti logo, teks, menu, role badge, tombol collapse, dan logout.

## Goals
- Pakai video/poster yang diberikan melalui komponen reusable `AsciiArt` di `src/components/ui/vignette-bloom.tsx`.
- Video memenuhi sidebar, muted, autoplay, loop, playsInline.
- Lapisan gelap menjaga keterbacaan; seluruh konten sidebar tetap di atas background.
- Hentikan animasi untuk `prefers-reduced-motion`.
- Sidebar mobile/topbar tidak berubah.

## Non-goals
Tidak mengubah isi/struktur menu, halaman login/landing/konten utama; tidak menambah dependency atau mengganti video dengan `toko.jpg`.

## Approaches
- Ken Burns pada foto toko: ringan, tetapi bukan animasi ASCII yang dipilih user.
- Video ASCII 21st.dev: dipilih karena sesuai permintaan terakhir; video eksternal memiliki konsekuensi ketergantungan pada URL aset dan koneksi.
- Interaksi parallax: ditolak karena menambah JavaScript yang tidak dibutuhkan.

## Constraints and implementation
- Proyek sudah memakai React, TypeScript, Tailwind CSS v4, shadcn structure, dan alias `@`; komponen diletakkan pada `src/components/ui/`.
- Tambahkan `AsciiArt({ className }: { className?: string })` sesuai implementasi yang diberikan.
- Pasang komponen sebagai layer absolut paling belakang pada `<aside>` desktop di `src/components/layout/AppShell.tsx`; teks/menu dan aksi existing tetap utuh di atasnya.
- Gunakan overlay gelap terpisah. Untuk `prefers-reduced-motion: reduce`, sembunyikan video dan tampilkan poster statis.
- CSS aktif `src/index.css`; `vite.config.ts` `base` tetap `/`.
- Tidak menambah dependency/aset Unsplash; gunakan URL video/poster yang diminta.

## Verification
Jalankan `npm run build`; periksa diff untuk memastikan hanya komponen baru, integrasi sidebar, styling aktif, dan dokumen desain/plan yang berubah, tanpa penghapusan menu.
