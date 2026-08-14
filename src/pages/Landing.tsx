import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Armchair,
  BarChart3,
  Bed,
  Boxes,
  CheckCircle2,
  CookingPot,
  LayoutDashboard,
  MapPin,
  Menu,
  Monitor,
  Package,
  Palette,
  ShoppingCart,
  Sofa,
  Sparkles,
  Store,
  Timer,
  Utensils,
  Warehouse,
  X,
  Zap,
} from 'lucide-react';
import { CABANG_LIST } from '@/lib/config';
import { useAuth } from '@/context/AuthContext';
import { GradientShimmer } from '@/components/ui/gradient-shimmer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FEATURES = [
  { icon: ShoppingCart, title: 'Order Cepat', desc: 'Pesan barang dari katalog dalam hitungan detik, kapan saja.' },
  { icon: Zap, title: 'Kinerja Tinggi', desc: 'Ditenagai cache proxy cloud untuk respons instan di jaringan 3G.' },
  { icon: LayoutDashboard, title: 'Dashboard Admin', desc: 'Kelola semua order cabang dari satu layar terpusat.' },
  { icon: BarChart3, title: 'Laporan Lengkap', desc: 'Rekap per cabang, status, dan nilai otomatis.' },
  { icon: Timer, title: 'Verifikasi Picker', desc: 'Cek stok barang sebelum order diproses admin.' },
  { icon: Package, title: 'Katalog Terpusat', desc: 'Harga dan stok selalu sinkron dari satu sumber data.' },
];

const STATS = [
  { label: 'Barang Aktif', value: 4764 },
  { label: 'Cabang Terhubung', value: CABANG_LIST.length },
  { label: 'Pesan/hari', value: 40 },
  { label: 'Akses API', value: 98 },
];

const KATEGORI_MARQUEE: { name: string; icon: typeof Armchair }[] = [
  { name: 'Kursi', icon: Armchair },
  { name: 'Kasur', icon: Bed },
  { name: 'Meja', icon: Utensils },
  { name: 'Elektronik', icon: Monitor },
  { name: 'Peralatan Dapur', icon: CookingPot },
  { name: 'Peralatan Makan', icon: Utensils },
  { name: 'Peralatan Mandi', icon: Sparkles },
  { name: 'Lemari', icon: Boxes },
  { name: 'Loker', icon: Boxes },
  { name: 'Sofa', icon: Sofa },
  { name: 'Rak Buku', icon: Boxes },
  { name: 'Dekorasi', icon: Palette },
];

const NAV_LINKS = [
  { label: 'Fitur', href: '#fitur' },
  { label: 'Cabang', href: '#cabang' },
  { label: 'Kontak', href: '#kontak' },
];

function useCountUp(target: number, start: boolean, duration = 1800) {
  const [value, setValue] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (!start) return;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [target, start, duration]);

  return value;
}

function useReveal() {
  const [revealed, setRevealed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            el.classList.add('in');
            setRevealed(true);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, revealed };
}

function Reveal({
  children,
  className,
  delay,
  scale,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: string;
  scale?: boolean;
}) {
  const { ref } = useReveal();
  return (
    <div
      ref={ref}
      data-delay={delay}
      className={cn(scale ? 'reveal-scale' : 'reveal', className)}
    >
      {children}
    </div>
  );
}

function StatBox({ label, target }: { label: string; target: number }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const t = setTimeout(() => {
      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        },
        { threshold: 0.5 },
      );
      io.observe(el);
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const value = useCountUp(target, visible);

  return (
    <div ref={ref} className="rounded-xl border border-border p-4 text-center">
      <div className="font-display text-2xl font-bold text-primary tabular-nums">
        {value.toLocaleString('id-ID')}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function BentoCard({ index }: { index: number }) {
  const cabang = CABANG_LIST[index];
  const cardRef = useRef<HTMLAnchorElement>(null);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -5;
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 5;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    card.style.setProperty('--mx', `${x}px`);
    card.style.setProperty('--my', `${y}px`);
  }, []);

  const onMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (card) card.style.transform = '';
  }, []);

  return (
    <Link
      ref={cardRef}
      to="/login"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="bento-card group"
      style={{ '--card-color': cabang.color || '#ff6b00' } as React.CSSProperties}
    >
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={`./images/cabang/${cabang.id.toLowerCase()}.jpg`}
          alt={cabang.nama}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted/40 text-muted-foreground">
          <Store className="h-14 w-14" strokeWidth={1.2} />
          <span className="text-xs font-bold">{cabang.id}</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur">
          <MapPin className="h-2.5 w-2.5" />
          {cabang.id}
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-1 backdrop-blur">
          <span className="bento-signal-dot" />
          <span className="text-[10px] font-semibold text-emerald-300">Aktif</span>
        </div>
      </div>

      <div className="relative p-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
            style={{ backgroundColor: cabang.color }}
          >
            {cabang.pic.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">PIC</div>
            <div className="truncate text-sm font-semibold">{cabang.pic}</div>
          </div>
        </div>
        <h3 className="mt-3 truncate font-display text-base font-bold">{cabang.nama}</h3>
        <div className="mt-3 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Aktif
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Kelola
            <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      <div className="bento-glow" />
    </Link>
  );
}

function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: { x: number; y: number; vx: number; vy: number; size: number; opacity: number; life: number }[] = [];
    let W = 0;
    let H = 0;
    let mouseX = -1000;
    let mouseY = -1000;
    let animationId = 0;

    const initParticles = () => {
      particles = [];
      const isMobile = W < 640;
      const count = isMobile ? 30 : 60;
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35 - 0.15,
          size: Math.random() * 2.2 + 0.4,
          opacity: Math.random() * 0.5 + 0.15,
          life: Math.random() * 100,
        });
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      initParticles();
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life += 0.4;

        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        const twinkle = Math.sin(p.life * 0.04) * 0.3 + 0.7;
        const alpha = p.opacity * twinkle;

        const dx = p.x - mouseX;
        const dy = p.y - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const boost = Math.max(0, 1 - dist / 250);

        const glowSize = p.size * (2 + boost * 5);
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
        gradient.addColorStop(0, `rgba(255, 180, 80, ${alpha * (0.7 + boost * 0.6)})`);
        gradient.addColorStop(0.4, `rgba(255, 140, 56, ${alpha * 0.3})`);
        gradient.addColorStop(1, 'rgba(255, 107, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255, 220, 150, ${alpha * (0.85 + boost * 0.5)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 200);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationId);
      } else {
        draw();
      }
    };

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    resize();
    draw();

    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  return <canvas ref={canvasRef} />;
}

export default function Landing() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [splash, setSplash] = useState(true);
  const [splashHidden, setSplashHidden] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [heroY, setHeroY] = useState(0);
  const glowRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);

  const reduceMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );

  // Splash screen
  useEffect(() => {
    if (reduceMotion) {
      setSplash(false);
      return;
    }
    const isMobile = window.innerWidth <= 768;
    const duration = isMobile ? 3500 : 5000;
    const t1 = setTimeout(() => setSplashHidden(true), duration);
    const t2 = setTimeout(() => setSplash(false), duration + 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [reduceMotion]);

  const skipSplash = () => {
    setSplashHidden(true);
    setTimeout(() => setSplash(false), 900);
  };

  // Drawer + Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // Scroll progress + nav blur + hero parallax
  useEffect(() => {
    let ticking = false;
    const update = () => {
      const scrollY = window.scrollY;
      const winH = window.innerHeight;
      const docH = document.documentElement.scrollHeight - winH;
      const percent = docH > 0 ? (scrollY / docH) * 100 : 0;
      setProgress(percent);
      setScrolled(scrollY > 20);
      if (scrollY < winH) {
        setHeroY(scrollY * 0.15);
      }
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cursor glow (desktop only)
  useEffect(() => {
    if (!window.matchMedia('(hover: hover)').matches) return;
    const glow = glowRef.current;
    if (!glow) return;

    let cursorX = 0;
    let cursorY = 0;
    let targetX = 0;
    let targetY = 0;
    let visible = false;
    let rafId = 0;

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!visible) {
        glow.classList.remove('hide');
        visible = true;
      }
    };
    const onLeave = () => {
      glow.classList.add('hide');
      visible = false;
    };
    const loop = () => {
      cursorX += (targetX - cursorX) * 0.15;
      cursorY += (targetY - cursorY) * 0.15;
      glow.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
      rafId = requestAnimationFrame(loop);
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    loop();

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const smoothScroll = (href: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="relative min-h-dvh">
      {/* Splash screen */}
      {splash && (
        <div
          className={cn('splash-overlay', splashHidden && 'hide')}
          onClick={skipSplash}
          aria-hidden="true"
        >
          <div className="relative z-10 text-center">
            <div className="splash-logo mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500 to-teal-400 sm:h-28 sm:w-28">
              <Warehouse className="h-12 w-12 text-white sm:h-14 sm:w-14" strokeWidth={1.5} />
            </div>
            <div className="splash-brand">
              GUDANG<span className="text-cyan-400">HUB</span>
            </div>
            <div className="splash-tagline">Kolaborasi Cabang &amp; Gudang</div>
            <div className="relative mt-6 flex justify-center gap-3">
              {['sp-1', 'sp-2', 'sp-3', 'sp-4', 'sp-5'].map((s, i) => (
                <Sparkles
                  key={s}
                  className={cn('splash-spark h-3 w-3 text-cyan-300', s)}
                  style={{ animation: `splashSparkle 1.5s ease ${3.5 + i * 0.2}s infinite` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scroll progress */}
      <div className="scroll-progress" style={{ width: `${progress}%` }} />

      {/* Cursor glow */}
      <div ref={glowRef} className="cursor-glow hide" aria-hidden="true" />

      {/* Background particles */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-60" aria-hidden="true">
        <ParticlesCanvas />
      </div>

      {/* NAV */}
      <header
        className={cn(
          'sticky top-0 z-40 transition-all duration-300',
          scrolled ? 'border-b border-border/50 bg-background/90 backdrop-blur-md' : 'border-b border-transparent',
        )}
      >
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-white">
              <Warehouse className="h-4 w-4" />
            </span>
            GudangHub
          </Link>

          <nav className="hidden items-center gap-6 text-sm md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={smoothScroll(l.href)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {session ? (
              <Button asChild size="sm">
                <Link to="/dashboard">
                  Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">
                  Masuk
                </Link>
                <Button asChild size="sm">
                  <Link to="/login">
                    Mulai
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground md:hidden"
            aria-label="Menu"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn('drawer-overlay md:hidden', drawerOpen && 'show')}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-[95] flex w-72 flex-col gap-1 border-l border-border bg-background p-5 transition-transform duration-300 md:hidden',
          drawerOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="flex items-center gap-2 font-display text-base font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-white">
              <Warehouse className="h-3.5 w-3.5" />
            </span>
            GudangHub
          </span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground"
            aria-label="Tutup"
            onClick={() => setDrawerOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {NAV_LINKS.map((l) => (
          <a
            key={l.href}
            href={l.href}
            onClick={(e) => {
              smoothScroll(l.href)(e);
              setDrawerOpen(false);
            }}
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {l.label}
          </a>
        ))}
        <div className="mt-4 flex flex-col gap-2">
          {session ? (
            <Button asChild className="w-full">
              <Link to="/dashboard" onClick={() => setDrawerOpen(false)}>
                Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link to="/login" onClick={() => setDrawerOpen(false)}>
                Masuk ke Aplikasi
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </aside>

      {/* HERO */}
      <section
        id="top"
        ref={heroRef}
        className="relative mx-auto max-w-5xl px-4 pt-16 text-center sm:pt-24"
        style={{ transform: `translateY(-${heroY}px)` }}
      >
        <Reveal>
          <h1 className="text-4xl font-black tracking-tight sm:text-6xl">
            <GradientShimmer gradient="sunrise" className="block">
              Pesanan Toko.
            </GradientShimmer>
            <GradientShimmer gradient="sunrise" className="block">
              Lebih Cepat.
            </GradientShimmer>
          </h1>
        </Reveal>
        <Reveal delay="1">
          <p className="mx-auto mt-5 max-w-xl text-muted-foreground sm:text-lg">
            Sistem pemesanan barang untuk jaringan toko — dari cabang ke pusat, dengan verifikasi stok
            picker dan laporan otomatis. Kini lebih kencang berkat cache cloud.
          </p>
        </Reveal>
        <Reveal delay="2">
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/login">
                Masuk ke Aplikasi
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="#fitur" onClick={smoothScroll('#fitur')}>
                Lihat Fitur
              </a>
            </Button>
          </div>
        </Reveal>

        <Reveal delay="3">
          <div className="mt-10 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success" />
            Optimasi jaringan 3G · Mode offline · Notifikasi real-time
          </div>
        </Reveal>
      </section>

      {/* STATS */}
      <section className="mx-auto mt-14 max-w-5xl px-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((s) => (
            <StatBox key={s.label} label={s.label} target={s.value} />
          ))}
        </div>
      </section>

      {/* MARQUEE KATEGORI */}
      <section className="mt-14 overflow-hidden border-y border-border/50 py-3">
        <div className="flex w-max animate-marquee gap-8">
          {[...KATEGORI_MARQUEE, ...KATEGORI_MARQUEE].map((k, i) => {
            const Icon = k.icon;
            return (
              <span key={k.name + i} className="flex items-center gap-3 whitespace-nowrap">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">
                    <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
                  </span>
                  {k.name}
                </span>
                <span className="h-1 w-1 rounded-full bg-primary/40" />
              </span>
            );
          })}
        </div>
      </section>

      {/* FITUR */}
      <section id="fitur" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-16">
        <Reveal>
          <h2 className="font-display text-center text-2xl font-bold sm:text-3xl">
            Semua yang Anda butuhkan
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Satu platform untuk order, verifikasi, dan laporan.
          </p>
        </Reveal>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={String((i % 3) + 1)}>
              <div className="group h-full rounded-xl border border-border p-5 transition-colors hover:border-primary/40">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CABANG — bento */}
      <section id="cabang" className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-16">
        <Reveal>
          <h2 className="font-display text-center text-2xl font-bold sm:text-3xl">
            Jaringan Cabang
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Terhubung ke semua cabang melalui satu aplikasi.
          </p>
        </Reveal>

        <Reveal scale className="mt-10">
          <div className="relative">
            {/* SVG connection lines */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 1200 700"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="bentoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff6b00" stopOpacity="0" />
                  <stop offset="50%" stopColor="#ff8c38" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#ff6b00" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="bento-line" d="M 250 180 Q 600 80 950 180" stroke="url(#bentoGrad)" strokeWidth="1.5" fill="none" />
              <path className="bento-line" d="M 950 180 Q 1050 350 950 520" stroke="url(#bentoGrad)" strokeWidth="1.5" fill="none" />
              <path className="bento-line" d="M 950 520 Q 600 620 250 520" stroke="url(#bentoGrad)" strokeWidth="1.5" fill="none" />
              <path className="bento-line" d="M 250 520 Q 150 350 250 180" stroke="url(#bentoGrad)" strokeWidth="1.5" fill="none" />
              <path className="bento-line" d="M 250 180 Q 600 350 950 520" stroke="url(#bentoGrad)" strokeWidth="1" fill="none" opacity="0.5" />
              <path className="bento-line" d="M 950 180 Q 600 350 250 520" stroke="url(#bentoGrad)" strokeWidth="1" fill="none" opacity="0.5" />
            </svg>

            <div className="relative grid grid-cols-1 gap-4 sm:grid-cols-12">
              <div className="sm:col-span-7" style={{ animationDelay: '0s' }}>
                <BentoCard index={0} />
              </div>
              <div className="sm:col-span-5" style={{ animationDelay: '0.15s' }}>
                <BentoCard index={1} />
              </div>
              <div className="sm:col-span-5" style={{ animationDelay: '0.3s' }}>
                <BentoCard index={2} />
              </div>
              <div className="sm:col-span-7" style={{ animationDelay: '0.45s' }}>
                <BentoCard index={3} />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* KONTAK */}
      <section id="kontak" className="mx-auto max-w-5xl scroll-mt-16 px-4 pb-16">
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h2 className="font-display text-center text-2xl font-bold sm:text-3xl">Hubungi Kami</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              PT Central Perabot Utama · NTT · silitongadimas@gmail.com
            </p>
            <div className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-3 text-center text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <Store className="mx-auto mb-2 h-5 w-5 text-primary" />
                <div className="font-semibold">4 Cabang</div>
                <div className="text-xs text-muted-foreground">Tersebar di NTT</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <Zap className="mx-auto mb-2 h-5 w-5 text-primary" />
                <div className="font-semibold">Cache Cloud</div>
                <div className="text-xs text-muted-foreground">Respons instan</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <Package className="mx-auto mb-2 h-5 w-5 text-primary" />
                <div className="font-semibold">4.700+ Barang</div>
                <div className="text-xs text-muted-foreground">Katalog terpusat</div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="border-t border-border/50">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-14 text-center">
          <Reveal>
            <GradientShimmer gradient="peach" className="text-2xl font-bold sm:text-3xl">
              Siap beroperasi lebih cepat?
            </GradientShimmer>
            <div className="mt-4">
              <Button asChild size="lg" onClick={() => (session ? navigate('/dashboard') : navigate('/login'))}>
                <Link to={session ? '/dashboard' : '/login'}>
                  {session ? 'Buka Dashboard' : 'Mulai Sekarang'}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground">
        GudangHub v5 (React) · Silitonga Dimas · API cache-proxy
      </footer>
    </div>
  );
}