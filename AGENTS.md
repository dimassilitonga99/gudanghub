# AGENTS.md — Aturan Kerja GudangHub

## Commit & Push
- **WAJIB minta izin dulu ke user sebelum commit dan push.**
- Jabarkan detail sebelum bertanya:
  - File apa saja yang berubah
  - Isi perubahan secara singkat
  - Pesan commit yang akan dipakai
- Setelah user menyetujui, baru jalankan `git add`, `git commit`, `git push`.
- Deploy otomatis via Cloudflare Pages (bukan GitHub Actions / gh-pages). Pastikan `base` di `vite.config.js` tetap `'/'` (Cloudflare serve di root).

## Aturan Teknis
- Jangan ubah `base` vite ke subpath — situs di-deploy di Cloudflare Pages root.
- Login wajib divalidasi ke server (Apps Script) — jangan tambahkan cache kredensial lokal.
- Timeout login 30 detik, retry wajar (2 attempt × 1 retry) — Apps Script bisa "tidur" setelah 6 menit idle.
- Build: `npm run build` — pastikan sukses sebelum commit.