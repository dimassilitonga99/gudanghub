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
import { registerServiceWorker, initInstallPrompt, initConnectionStatus } from './lib/pwa';
import { SETTINGS } from './lib/config';
import './index.css';

prewarmAppScript();
startKeepAlive();

// Boot tema: default gelap (vanilla), baca preferensi tersimpan dari Settings
try {
  const prefs = JSON.parse(localStorage.getItem('gudanghub_prefs') || '{}');
  const darkMode = typeof prefs.darkMode === 'boolean' ? prefs.darkMode : true;
  document.documentElement.classList.toggle('dark', darkMode);
} catch {
  document.documentElement.classList.add('dark');
}

registerServiceWorker();
initInstallPrompt();
initConnectionStatus();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-center"
          richColors
          duration={SETTINGS.toastDuration}
          toastOptions={{
            style: { fontFamily: 'Geist Variable, Manrope, sans-serif' },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);