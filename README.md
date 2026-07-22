# 🏪 GudangHub v3.0

Sistem operasional cerdas untuk order barang antar cabang **PT Central Perabot Utama** — NTT.

---

## ✨ Fitur

- 📊 **Dashboard Admin** — Kelola order, edit item, approve/reject
- 🛒 **Order Cabang** — Katalog + Cart + Order Massal
- 📱 **PWA** — Bisa di-install di HP seperti aplikasi native
- 📈 **Laporan** — Rekap per cabang, bisa print/export
- 🔔 **Notifikasi** — Update real-time
- 👤 **Profil** — Info user + activity log
- ⚙️ **Settings** — Kelola user, cabang, master barang

---

## 🚀 Cara Setup (Pertama Kali)

### 1. Install Node.js
Download dari: <https://nodejs.org> (pilih **LTS**)

Cek instalasi:
\`\`\`bash
node --version
npm --version
\`\`\`

### 2. Install Dependencies
Buka terminal di folder project, lalu:
\`\`\`bash
npm install
\`\`\`

### 3. Jalankan Development Server
\`\`\`bash
npm run dev
\`\`\`

Buka browser: <http://localhost:5173>

Anda juga bisa akses dari HP dengan IP komputer, misal:
`http://192.168.1.10:5173`

### 4. Build untuk Production
\`\`\`bash
npm run build
\`\`\`

File hasil build ada di folder `dist/`.

### 5. Deploy ke GitHub Pages
\`\`\`bash
npm run deploy
\`\`\`

Otomatis push ke branch `gh-pages`. Setelah itu di GitHub repo:
1. Buka **Settings > Pages**
2. Source: **Deploy from a branch**
3. Branch: **gh-pages** / root
4. Save

---

## 📂 Struktur Folder

\`\`\`
gudanghub/
├── index.html              # Landing page
├── login.html
├── dashboard.html          # Admin
├── order.html              # Cabang
├── ganti-password.html
├── laporan.html            # Laporan (bisa print)
├── profil.html             # Profil user
├── notifikasi.html         # Notifikasi
├── settings.html           # Settings admin
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
│
├── src/
│   ├── styles/             # CSS modular
│   │   ├── tokens.css      # Colors, fonts, spacing
│   │   ├── base.css        # Reset + typography
│   │   ├── components.css  # Reusable UI
│   │   ├── utilities.css   # Utility classes
│   │   └── main.css        # Entry CSS
│   │
│   └── js/
│       ├── config.js       # API URL, constants
│       ├── api.js          # API wrapper
│       ├── session.js      # Session management
│       ├── ui.js           # Toast, modal, confirm
│       ├── utils.js        # Helpers
│       ├── router.js       # Client router
│       ├── pwa.js          # PWA install
│       └── pages/          # Per-page logic
│
├── public/                 # Static assets
│   ├── favicon.ico
│   └── icons/              # PWA icons
│
└── AppScript.gs            # Backend (deploy ke Google)
\`\`\`

---

## 🔧 Konfigurasi

### Ganti API URL
Edit `src/js/config.js`:
\`\`\`javascript
export const API_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
\`\`\`

### Ganti Base Path (Github Pages)
Edit `vite.config.js`:
\`\`\`javascript
base: process.env.NODE_ENV === 'production' ? '/NAMA_REPO_ANDA/' : '/',
\`\`\`

---

## 👥 Default Login

| Username | Password    | Role   | Cabang |
|----------|-------------|--------|--------|
| admin    | gudang2025  | admin  | -      |
| cb001    | arfa2025    | cabang | CB001  |
| cb002    | akmal2025   | cabang | CB002  |
| cb003    | shally2025  | cabang | CB003  |
| cb004    | fajar2025   | cabang | CB004  |

**⚠️ Ganti password default setelah login pertama!**

---

## 📱 Install PWA di HP

1. Buka website di **Chrome / Safari HP**
2. Tap menu **⋮** (3 titik)
3. Pilih **"Add to Home Screen"** / **"Install App"**
4. Icon GudangHub muncul di home screen

---

## 🛠️ Development Workflow

\`\`\`bash
# Development (live reload)
npm run dev

# Build production
npm run build

# Preview build hasilnya
npm run preview

# Deploy ke GitHub Pages
npm run deploy
\`\`\`

---

## 📞 Support

- **Admin Gudang:** silitongadimas@gmail.com
- **Repo:** [GitHub Repository]

---

## 📄 License

© 2025 PT Central Perabot Utama — NTT
