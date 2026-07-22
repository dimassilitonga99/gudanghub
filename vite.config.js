import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Base path untuk GitHub Pages
  // GANTI 'gudanghub' dengan nama repository Anda di GitHub
  base: process.env.NODE_ENV === 'production' ? '/gudanghub/' : '/',

  root: '.',
  publicDir: 'public',

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    cssMinify: true,

    // Multi-page setup
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        order: resolve(__dirname, 'order.html'),
        gantiPassword: resolve(__dirname, 'ganti-password.html'),
        laporan: resolve(__dirname, 'laporan.html'),
        profil: resolve(__dirname, 'profil.html'),
        notifikasi: resolve(__dirname, 'notifikasi.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
      output: {
        // Konsisten filename tanpa hash untuk PWA cache
        entryFileNames: 'assets/js/[name]-[hash].js',
        chunkFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const ext = assetInfo.name.split('.').pop();
          if (/css/.test(ext)) return 'assets/css/[name]-[hash][extname]';
          if (/png|jpe?g|svg|gif|webp|ico/.test(ext)) return 'assets/img/[name]-[hash][extname]';
          if (/woff2?|ttf|otf/.test(ext)) return 'assets/fonts/[name]-[hash][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },

  server: {
    port: 5173,
    open: '/index.html',
    host: true, // Bisa akses dari HP di jaringan sama
  },

  preview: {
    port: 4173,
    open: true,
  },

  css: {
    devSourcemap: true,
  },
});
