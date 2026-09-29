import { Icon } from '../ui/icon';
import { Link, NavLink } from 'react-router-dom';

import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/lib/config';
import { FeedbackLogout } from '@/components/feedback-logout';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: <Icon name="dashboard" size={16} />, roles: ['admin'] },
  { to: ROUTES.itemManagement, label: 'Item Management', icon: <Icon name="boxes" size={16} />, roles: ['admin'] },
  { to: ROUTES.users, label: 'Kelola User', icon: <Icon name="users" size={16} />, roles: ['admin'] },
  { to: ROUTES.order, label: 'Order', icon: <Icon name="shopping-cart" size={16} />, roles: ['cabang', 'admin'] },
  { to: ROUTES.picker, label: 'Picker', icon: <Icon name="clipboard-check" size={16} />, roles: ['picker'] },
  { to: ROUTES.laporan, label: 'Laporan', icon: <Icon name="file" size={16} />, roles: ['admin', 'cabang'] },
  { to: ROUTES.notifikasi, label: 'Notifikasi', icon: <Icon name="bell" size={16} />, roles: ['admin', 'cabang', 'picker'] },
  { to: ROUTES.profil, label: 'Profil', icon: <Icon name="user" size={16} />, roles: ['admin', 'cabang', 'picker'] },
  { to: ROUTES.settings, label: 'Pengaturan', icon: <Icon name="settings" size={16} />, roles: ['admin', 'cabang', 'picker'] },
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
  const { session, isAdmin, isPicker } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Sidebar mini/normal (desktop) — tersimpan di localStorage
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('gudanghub_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem('gudanghub_sidebar_collapsed', next ? '1' : '0');
      } catch {
        /* storage penuh */
      }
      return next;
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const role = isAdmin ? 'admin' : isPicker ? 'picker' : 'cabang';
  const items = NAV_ITEMS.filter((i) => i.roles.includes(role));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar (desktop) — bisa dikecilkan (mini) / dibesarkan lagi */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card transition-[width] duration-200 md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <Link
          to="/"
          className={cn(
            'flex items-center gap-2 border-b border-border py-4',
            collapsed ? 'justify-center px-2' : 'px-5',
          )}
          title="GudangHub"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand text-white">
            <Icon name="boxes" size={20} />
          </span>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-display text-base font-bold text-foreground">GudangHub</div>
              <div className="text-[11px] text-muted-foreground">PT Central Perabot Utama</div>
            </div>
          )}
        </Link>

        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            className="mx-3 mt-2 flex items-center justify-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Kecilkan sidebar"
          >
            <Icon name="angle-left" size={12} />
            Kecilkan
          </button>
        )}
        {collapsed && (
          <button
            onClick={toggleCollapsed}
            className="mx-auto mt-2 flex items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Besarkan sidebar"
          >
            <Icon name="angle-right" size={14} />
          </button>
        )}

        <nav className={cn('flex-1 space-y-1 overflow-y-auto p-3', collapsed && 'px-2')}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              title={item.label}
              className={({ isActive }) =>
                cn(
                  'flex items-center rounded-lg py-2.5 text-sm font-medium transition-colors',
                  collapsed ? 'justify-center px-2' : 'gap-3 px-3',
                  isActive
                    ? 'bg-brand text-white'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              {item.icon}
              {!collapsed && item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div
            className={cn(
              'mb-2 flex items-center gap-2 px-1',
              collapsed && 'justify-center px-0',
            )}
            title={`${session?.nama || session?.username || ''} · ${role}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">
              {(session?.nama || session?.username || '?').charAt(0).toUpperCase()}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-sm font-semibold">{session?.nama || session?.username}</div>
                <RoleBadge role={role} />
              </div>
            )}
          </div>
          <FeedbackLogout>
            <button
              title="Keluar"
              className={cn(
                'flex w-full items-center rounded-lg py-2 text-sm font-medium text-danger hover:bg-danger/10',
                collapsed ? 'justify-center px-2' : 'gap-2 px-3',
              )}
            >
              <Icon name="sign-out-alt" size={16} />
              {!collapsed && 'Keluar'}
            </button>
          </FeedbackLogout>
        </div>
      </aside>

      {/* Main area */}
      <div className={cn('transition-[padding] duration-200', collapsed ? 'md:pl-16' : 'md:pl-60')}>
        {/* Topbar mobile */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/95 px-4 py-3 backdrop-blur md:hidden">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <Icon name="warehouse-alt" size={16} />
            </span>
            <span className="font-display text-base font-bold">GudangHub</span>
          </Link>
          <div className="flex items-center gap-1">
            <NavLink to={ROUTES.notifikasi} className="rounded-lg p-2 text-muted-foreground hover:bg-accent">
              <Icon name="bell" size={20} />
            </NavLink>
            <button
              onClick={() => setMobileNavOpen((v) => !v)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
              aria-label="Menu"
            >
              <Icon name="package" size={20} />
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
            <FeedbackLogout>
              <button
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger/10"
              >
                <Icon name="sign-out-alt" size={16} />
                Keluar
              </button>
            </FeedbackLogout>
          </div>
        )}

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}