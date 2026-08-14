import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  Boxes,
  FileText,
  LayoutDashboard,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  User,
  Warehouse,
  ClipboardCheck,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/config';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, roles: ['admin'] },
  { to: ROUTES.order, label: 'Order', icon: <ShoppingCart className="h-4 w-4" />, roles: ['cabang', 'admin'] },
  { to: ROUTES.picker, label: 'Picker', icon: <ClipboardCheck className="h-4 w-4" />, roles: ['picker'] },
  { to: ROUTES.laporan, label: 'Laporan', icon: <FileText className="h-4 w-4" />, roles: ['admin', 'cabang'] },
  { to: ROUTES.notifikasi, label: 'Notifikasi', icon: <Bell className="h-4 w-4" />, roles: ['admin', 'cabang', 'picker'] },
  { to: ROUTES.profil, label: 'Profil', icon: <User className="h-4 w-4" />, roles: ['admin', 'cabang', 'picker'] },
  { to: ROUTES.settings, label: 'Pengaturan', icon: <Settings className="h-4 w-4" />, roles: ['admin', 'cabang', 'picker'] },
];

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, string> = {
    admin: 'bg-brand/15 text-brand border-brand/30',
    cabang: 'bg-info/15 text-info border-info/30',
    picker: 'bg-success/15 text-success border-success/30',
  };
  const label: Record<string, string> = { admin: 'Admin', cabang: 'Cabang', picker: 'Picker' };
  return (
    <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', map[role] || map.admin)}>
      {label[role] || role}
    </span>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { session, isAdmin, isPicker, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const role = isAdmin ? 'admin' : isPicker ? 'picker' : 'cabang';
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  const handleLogout = () => {
    logout();
    navigate(ROUTES.login);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-card md:flex">
        <Link to="/" className="flex items-center gap-2 border-b border-border px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
            <Boxes className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-base font-bold text-foreground">GudangHub</div>
            <div className="text-[11px] text-muted-foreground">PT Central Perabot Utama</div>
          </div>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
              {(session?.nama || session?.username || '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">{session?.nama || session?.username}</div>
              <RoleBadge role={role} />
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-danger hover:bg-danger/10"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="md:pl-60">
        {/* Topbar mobile */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <Warehouse className="h-4 w-4" />
            </span>
            <span className="font-display text-base font-bold">GudangHub</span>
          </Link>
          <div className="flex items-center gap-1">
            <NavLink to={ROUTES.notifikasi} className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
              <Bell className="h-5 w-5" />
            </NavLink>
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
              aria-label="Menu"
            >
              <Package className="h-5 w-5" />
            </button>
          </div>
        </header>

        {mobileNavOpen && (
          <div className="border-b border-border bg-card px-4 py-2 md:hidden">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive ? 'bg-brand text-white' : 'text-muted-foreground hover:bg-accent',
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger/10"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}