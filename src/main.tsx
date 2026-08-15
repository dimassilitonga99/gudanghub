import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '@flaticon/flaticon-uicons/css/solid/rounded.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { prewarmAppScript, startKeepAlive } from './lib/api';
import './index.css';

prewarmAppScript();
startKeepAlive();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* SW gagal register — aplikasi tetap berjalan */
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: { fontFamily: 'Geist Variable, Manrope, sans-serif' },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);