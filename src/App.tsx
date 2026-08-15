import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ROUTES } from './lib/config';
import Landing from './pages/Landing';
import Login from './pages/Login';
import AppShell from './components/layout/AppShell';
import Dashboard from './pages/Dashboard';
import Order from './pages/Order';
import Picker from './pages/Picker';
import Laporan from './pages/Laporan';
import Profil from './pages/Profil';
import Notifikasi from './pages/Notifikasi';
import SettingsPage from './pages/Settings';
import GantiPassword from './pages/GantiPassword';

function Protected({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { valid, session, homeRoute } = useAuth();
  if (!valid || !session) {
    return <Navigate to={ROUTES.login} replace />;
  }
  if (roles && !roles.includes(session.role)) {
    return <Navigate to={homeRoute} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path={ROUTES.landing} element={<Landing />} />
      <Route path={ROUTES.login} element={<Login />} />
      <Route
        path={ROUTES.dashboard}
        element={
          <Protected roles={['admin']}>
            <AppShell>
              <Dashboard />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path={ROUTES.order}
        element={
          <Protected roles={['admin', 'cabang']}>
            <AppShell>
              <Order />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path={ROUTES.picker}
        element={
          <Protected roles={['picker']}>
            <AppShell>
              <Picker />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path={ROUTES.laporan}
        element={
          <Protected roles={['admin', 'cabang', 'picker']}>
            <AppShell>
              <Laporan />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path={ROUTES.profil}
        element={
          <Protected roles={['admin', 'cabang', 'picker']}>
            <AppShell>
              <Profil />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path={ROUTES.notifikasi}
        element={
          <Protected roles={['admin', 'cabang', 'picker']}>
            <AppShell>
              <Notifikasi />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path={ROUTES.settings}
        element={
          <Protected roles={['admin', 'cabang', 'picker']}>
            <AppShell>
              <SettingsPage />
            </AppShell>
          </Protected>
        }
      />
      <Route
        path={ROUTES.gantiPassword}
        element={
          <Protected roles={['admin', 'cabang', 'picker']}>
            <AppShell>
              <GantiPassword />
            </AppShell>
          </Protected>
        }
      />
      <Route path="*" element={<Navigate to={ROUTES.landing} replace />} />
    </Routes>
  );
}