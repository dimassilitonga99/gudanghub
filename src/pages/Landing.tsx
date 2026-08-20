import { Icon } from '../components/ui/icon';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { CABANG_LIST, ROUTES } from '@/lib/config';
import { useAuth } from '@/context/AuthContext';
import { GradientShimmer } from '@/components/ui/gradient-shimmer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const FEATURES = [
  { icon: 'shopping-cart', title: 'Order Cepat', desc: 'Pesan barang dari katalog dalam hitungan detik, kapan saja.' },
  { icon: 'bolt', title: 'Kinerja Tinggi', desc: 'Ditenagai cache proxy cloud untuk respons instan di jaringan 3G.' },
  { icon: 'dashboard', title: 'Kontrol Pusat', desc: 'Kelola semua order cabang dari satu layar terpusat.' },
  { icon: 'chart-histogram', title: 'Laporan Lengkap', desc: 'Rekap per cabang, status, dan nilai otomatis.' },
  { icon: 'stopwatch', title: 'Verifikasi Picker', desc: 'Cek stok barang sebelum order diproses.' },
  { icon: 'package', title: 'Katalog Terpusat', desc: 'Harga dan stok selalu sinkron dari satu sumber data.' },
];

const STATS = [
  { value: 4, suffix: '', label: 'Cabang aktif di NTT' },
  { value: 9, suffix: '', label: 'Kategori furnitur' },
  { value: 500, suffix: '+', label: 'Item dalam katalog' },
  { value: 24, suffix: '/7', label: 'Sistem selalu siap' },
];

const GALLERY = [
  { src: './images/display-1.jpg', tag: 'Showroom Utama', caption: 'Display Furniture Premium', big: true },
  { src: './images/display-2.jpg', tag: 'Rak Display', caption: 'Peralatan Rumah Tangga', big: false },
  { src: './images/display-3.jpg', tag: 'Koleksi Baru', caption: 'Elektronik & Kitchen', big: false },
  { src: './images/display-4.jpg', tag: 'Area Dapur', caption: 'Peralatan Masak Lengkap', big: false },
  { src: './images/display-5.jpg', tag: 'Cabang Terbaru', caption: 'Toko Siap Melayani', big: true },
];

const ABOUT_ITEMS = [
  {
    icon: 'file',
    title: 'Terdokumentasi Sempurna',
    desc: 'Setiap permintaan memiliki jejak audit — dari siapa, kapan, dan alasannya.',
  },
  {
    icon: 'bolt',
    title: 'Keputusan dalam Sekejap',
    desc: 'Tinjauan pusat menyetujui, menyesuaikan, atau menolak dari mana saja. Perubahan tersinkron instan.',
  },
  {
    icon: 'chart-histogram',
    title: 'Wawasan Berbasis Data',
    desc: 'Laporan cabang, rate persetujuan, dan pola order — semua dalam satu layar.',
  },
];

const KATEGORI_MARQUEE: { name: string; icon: string }[] = [
  { name: 'Kursi', icon: 'chair' },
  { name: 'Kasur', icon: 'bed' },
  { name: 'Meja', icon: 'utensils' },
  { name: 'Elektronik', icon: 'dashboard-monitor' },
  { name: 'Peralatan Dapur', icon: 'pot' },
  { name: 'Peralatan Makan', icon: 'utensils' },
  { name: 'Peralatan Mandi', icon: 'sparkles' },
  { name: 'Lemari', icon: 'boxes' },
  { name: 'Loker', icon: 'boxes' },
  { name: 'Sofa', icon: 'sofa' },
  { name: 'Rak Buku', icon: 'boxes' },
  { name: 'Dekorasi', icon: 'palette' },
];

const NAV_LINKS = [
  { label: 'Demo', href: '#demo' },
  { label: 'Katalog', href: '#katalog' },
  { label: 'Tentang', href: '#tentang' },
  { label: 'Cabang', href: '#cabang' },
];

const TIM_CARDS = [
  {
    img: './images/tim/ceo.png',
    alt: 'CEO',
    placeholder: 'CEO',
    variant: 'tim-card-ceo' as const,
    row: 'top' as const,
    quote: 'Memimpin adalah menjadi contoh — bahkan saat tak ada yang melihat.',
    author: '— IBU HRD',
  },
  {
    img: './images/tim/manager-1.png',
    alt: 'Manager 1',
    placeholder: 'MGR',
    variant: 'tim-card-mid' as const,
    row: 'mid' as const,
    quote: 'Kerja keras tidak pernah mengkhianati hasil.',
    author: '— BAPAK ANAK SATU',
  },
  {
    img: './images/tim/manager-2.png',
    alt: 'Manager 2',
    placeholder: 'MGR',
    variant: 'tim-card-mid' as const,
    row: 'mid' as const,
    quote: 'Melayani dengan tulus, bekerja dengan jujur.',
    author: '— Garda Terdepan',
  },
  {
    img: './images/tim/staff-1.png',
    alt: 'Staff 1',
    placeholder: 'PIC',
    variant: 'tim-card-front' as const,
    row: 'front' as const,
    quote: 'Setiap barang membawa harapan keluarga.',
    author: '— HATI YANG TERLUKA',
  },
  {
    img: './images/tim/staff-2.png',
    alt: 'Staff 2',
    placeholder: 'PIC',
    variant: 'tim-card-front tim-card-center' as const,
    row: 'front' as const,
    quote: 'Senyum pelanggan adalah gaji terbaik.',
    author: '— JIWA PELAYAN',
  },
  {
    img: './images/tim/staff-3.png',
    alt: 'Staff 3',
    placeholder: 'PIC',
    variant: 'tim-card-front' as const,
    row: 'front' as const,
    quote: 'Mengirim janji — tepat waktu, tepat hati.',
    author: '— SALES BOKEP',
  },
];

function smoothScroll(href: string) {
  return (e: React.MouseEvent) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
}

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

function TimCard({
  img,
  alt,
  placeholder,
  variant,
  quote,
  author,
}: {
  img: string;
  alt: string;
  placeholder: string;
  variant: string;
  quote: string;
  author: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cn('tim-card', variant, flipped && 'flipped')}
      onClick={() => setFlipped((f) => !f)}
    >
      <div className="tim-card-inner">
        <div className="tim-card-front-side">
          <div className="tim-card-frame">
            {failed ? (
              <div className="tim-card-placeholder">
                <span>{placeholder}</span>
              </div>
            ) : (
              <img src={img} alt={alt} loading="lazy" onError={() => setFailed(true)} />
            )}
          </div>
        </div>
        <div className="tim-card-back">
          <div className="tim-card-quote">
            <div className="tim-quote-mark">&quot;</div>
            <p>{quote}</p>
            <div className="tim-quote-author">{author}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamSection() {
  return (
    <section className="tim-section" id="tim" aria-labelledby="tim-title">
      <div className="tim-bg-decor" aria-hidden="true">
        <div className="tim-skyline tim-skyline-left" />
        <div className="tim-skyline tim-skyline-right" />
        <div className="tim-sparkle tim-sparkle-1" />
        <div className="tim-sparkle tim-sparkle-2" />
        <div className="tim-sparkle tim-sparkle-3" />
        <div className="tim-gold-block tim-gold-1" />
        <div className="tim-gold-block tim-gold-2" />
        <div className="tim-gold-block tim-gold-3" />
        <div className="tim-gold-block tim-gold-4" />
      </div>
      <div className="tim-ribbon" aria-hidden="true" />

      <div className="mx-auto max-w-5xl px-4">
        <Reveal>
          <div className="tim-brand">
            <div className="tim-brand-mark">
              <Icon name="warehouse-alt" size={24} />
            </div>
            <div className="tim-brand-name">
              GUDANG<span>HUB</span>
            </div>
          </div>
        </Reveal>

        <Reveal>
          <div className="tim-cards">
            {(['top', 'mid', 'front'] as const).map((row) => (
              <div key={row} className={cn('tim-row', `tim-row-${row}`)}>
                {TIM_CARDS.filter((c) => c.row === row).map((c) => (
                  <TimCard
                    key={c.alt}
                    img={c.img}
                    alt={c.alt}
                    placeholder={c.placeholder}
                    variant={c.variant}
                    quote={c.quote}
                    author={c.author}
                  />
                ))}
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay="1">
          <div className="tim-title-block">
            <h2 className="tim-title" id="tim-title">
              <span className="tim-title-line1">TIM</span>
              <span className="tim-title-line2">BALIK LAYAR</span>
            </h2>
            <p className="tim-subtitle">
              Di balik setiap order yang lancar, ada manusia-manusia luar biasa
              yang bekerja tanpa henti — memastikan setiap detail sempurna.
            </p>
            <p className="tim-quote">
              &quot;Bukan sekadar sistem. Kami adalah keluarga yang membangun
              kepercayaan satu order di satu waktu.&quot;
            </p>
          </div>
        </Reveal>

        <Reveal delay="2">
          <div className="tim-info-bar">
            <div className="tim-info-item">
              <span className="tim-info-label">Visi</span>
              <span className="tim-info-value">Satu Gudang, Empat Cabang, Satu Tujuan</span>
            </div>
            <div className="tim-info-divider" />
            <div className="tim-info-item">
              <span className="tim-info-label">Misi</span>
              <span className="tim-info-value">Melayani NTT dengan Sepenuh Hati</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StatNum({ value, suffix }: { value: number; suffix: string }) {
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

  const n = useCountUp(value, visible);

  return (
    <div ref={ref} className="stat-num">
      <span className="val">{n.toLocaleString('id-ID')}</span>
      {suffix && <span className="suf">{suffix}</span>}
    </div>
  );
}

const DEMO_CLIPS = [
  { num: '01', file: '01-masuk.mp4', poster: 'poster-01.jpg', title: 'Masuk', desc: 'Cabang login dengan akun toko masing-masing.' },
  { num: '02', file: '02-pilih-barang.mp4', poster: 'poster-02.jpg', title: 'Pilih Barang', desc: 'Tambah barang yang stoknya mulai menipis dari katalog.' },
  { num: '03', file: '03-stok-aktual.mp4', poster: 'poster-03.jpg', title: 'Stok Aktual', desc: 'Isi stok nyata gudang & toko untuk tiap item.' },
  { num: '04', file: '04-kirim-order.mp4', poster: 'poster-04.jpg', title: 'Kirim Order', desc: 'Order dikirim ke gudang — tercatat otomatis.' },
  { num: '05', file: '05-riwayat.mp4', poster: 'poster-05.jpg', title: 'Riwayat', desc: 'Status order langsung terpantau: menunggu verifikasi.' },
];

function DemoSection() {
  useEffect(() => {
    let timer;
    const tryPlay = () => {
      Array.from(document.querySelectorAll<HTMLVideoElement>('.demo-frame video')).forEach((v) => {
        v.muted = true;
        const p = v.play();
        if (p) p.catch(() => {});
      });
    };
    tryPlay();
    timer = setInterval(tryPlay, 1200);
    const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    const offs = evs.map((ev) => {
      const h = () => tryPlay();
      window.addEventListener(ev, h);
      return () => window.removeEventListener(ev, h);
    });
    return () => {
      clearInterval(timer);
      offs.forEach((f) => f());
    };
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-4 pb-16" id="demo" aria-labelledby="demo-title">
      <Reveal>
        <header className="section-head">
          <span className="section-kicker">Live Demo</span>
          <h2 id="demo-title">
            Lihat alurnya <em>langsung</em>.
          </h2>
          <p>
            Lima langkah pemakaian nyata — dari login, pilih barang, isi stok aktual toko & gudang,
            kirim order, hingga pantau statusnya di riwayat.
          </p>
        </header>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_CLIPS.map((c) => (
            <div key={c.num} className="demo-frame">
              <video
                className="demo-video"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                disablePictureInPicture
                poster={`./demo/${c.poster}`}
              >
                <source src={`./demo/${c.file}`} type="video/mp4" />
              </video>
              <div className="demo-caption">
                <b>{c.num} · {c.title}</b>
                <span>{c.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function GallerySection() {
  return (
    <section className="gallery-section mx-auto max-w-5xl px-4" id="katalog" aria-labelledby="gallery-title">
      <Reveal>
        <header className="section-head">
          <span className="section-kicker">Showroom Kami</span>
          <h2 id="gallery-title">
            Display toko yang <em>menginspirasi</em>.
          </h2>
          <p>
            Lihat langsung bagaimana produk furniture kami tertata rapi di setiap cabang — siap
            menyambut pelanggan setiap hari.
          </p>
        </header>
      </Reveal>

      <div className="gallery-grid">
        {GALLERY.map((g, i) => (
          <Reveal
            key={g.src}
            scale
            delay={i === 0 ? undefined : String(i === 4 ? 2 : (i % 3) + 1)}
            className={cn('gallery-item', g.big && 'gallery-big')}
          >
            <img src={g.src} alt={g.tag} loading="lazy" />
            <div className="gallery-overlay">
              <div className="gallery-label">
                <span className="gallery-tag">{g.tag}</span>
                <span className="gallery-caption">{g.caption}</span>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay="1">
        <div className="gallery-cta">
          <Link to="/login" className="gallery-cta-btn">
            <Icon name="shopping-bag" size={18} />
            Lihat Katalog Lengkap
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function AboutSection() {
  return (
    <section className="about" id="tentang" aria-labelledby="tentang-title">
      <div className="about-inner mx-auto max-w-5xl px-4">
        <Reveal className="about-media">
          <div className="about-media-main">
            <div className="about-media-icon">
              <Icon name="warehouse-alt" size={64} />
            </div>
            <img src="./images/filosofi.jpg" alt="Filosofi GudangHub" className="about-image" loading="lazy" />
          </div>
        </Reveal>

        <div>
          <Reveal>
            <span className="section-kicker">Filosofi Kami</span>
          </Reveal>
          <Reveal delay="1">
            <h2 id="tentang-title">
              Satu sumber, <em>banyak dampak</em>.
            </h2>
          </Reveal>
          <Reveal delay="1">
            <p className="about-lead">
              GudangHub bukan hanya alat — ia adalah cara baru berkolaborasi. Menghilangkan pesan
              yang tercecer, mempercepat keputusan, dan membuat setiap orang di garis depan bekerja
              dengan data yang sama.
            </p>
          </Reveal>

          <div className="about-list">
            {ABOUT_ITEMS.map((item, i) => (
              <Reveal key={item.title} delay={String(i + 1)}>
                <div className="about-item">
                  <span className="about-item-icon">
                    <Icon name={item.icon} size={22} />
                  </span>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay="1">
            <Link to="/login" className="btn-about">
              Masuk ke Aplikasi
              <Icon name="arrow-right" size={16} />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  return (
    <section className="stats mx-auto max-w-5xl px-4" aria-labelledby="stats-title">
      <Reveal>
        <header className="section-head">
          <span className="section-kicker">Skala Operasi</span>
          <h2 id="stats-title">
            Angka yang <em>berbicara</em>.
          </h2>
          <p>Jaringan yang tumbuh, kepercayaan yang terjaga, dan sistem yang tidak pernah tidur.</p>
        </header>
      </Reveal>

      <div className="stats-grid">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i ? String(i) : undefined}>
            <div className="stat">
              <StatNum value={s.value} suffix={s.suffix} />
              <div className="stat-lbl">{s.label}</div>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function FooterSection() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="mx-auto max-w-5xl px-4">
        <div className="footer-top">
          <div className="footer-about">
            <Link to="/" className="inline-flex items-center gap-2 font-display text-lg font-bold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-white">
                <Icon name="warehouse-alt" size={16} />
              </span>
              Gudang<em>Hub</em>
            </Link>
            <p>
              Platform kolaborasi cabang-gudang untuk PT Central Perabot Utama. Dibangun dari
              Kupang, untuk NTT.
            </p>
          </div>

          <div className="footer-col">
            <h5>Jelajahi</h5>
            <a href="#demo" onClick={smoothScroll('#demo')}>
              <Icon name="wrench-alt" size={14} /> Demo
            </a>
            <a href="#katalog" onClick={smoothScroll('#katalog')}>
              <Icon name="grid" size={14} /> Katalog
            </a>
            <a href="#tentang" onClick={smoothScroll('#tentang')}>
              <Icon name="info" size={14} /> Tentang
            </a>
            <a href="#cabang" onClick={smoothScroll('#cabang')}>
              <Icon name="shop" size={14} /> Cabang
            </a>
          </div>

          <div className="footer-col">
            <h5>Akses</h5>
            <Link to="/login">
              <Icon name="sign-in-alt" size={14} /> Masuk Aplikasi
            </Link>
            <Link to="/order">
              <Icon name="shopping-cart" size={14} /> Lacak Order
            </Link>
            <a href="#katalog" onClick={smoothScroll('#katalog')}>
              <Icon name="grid" size={14} /> Lihat Katalog
            </a>
          </div>

          <div className="footer-col">
            <h5>Terhubung</h5>
            <a href="#top" onClick={smoothScroll('#top')}>
              <Icon name="map-marker" size={14} /> PT Central Perabot Utama · NTT
            </a>
            <a href="tel:+6281234567890">
              <Icon name="phone-call" size={14} /> +62 812 3456 7890
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>
            <b>GudangHub v3.0</b> · PT Central Perabot Utama · Waktu WITA
          </span>
          <span>© 2025 GudangHub. Dibangun dengan hati.</span>
          <span>
            Icons by{' '}
            <a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">
              Uicons by Flaticon
            </a>
          </span>
        </div>
      </div>
    </footer>
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
          <Icon name="shop" size={56} />
          <span className="font-mono text-xs font-medium">{cabang.id}</span>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
        <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-1 backdrop-blur">
          <span className="bento-signal-dot" />
          <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-emerald-300">
            Aktif
          </span>
        </div>
      </div>

      <div className="relative p-4">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: cabang.color }}
          />
          Cabang {cabang.id}
        </div>
        <h3 className="mt-2 truncate text-lg font-semibold tracking-tight text-foreground">
          {cabang.nama}
        </h3>
        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
              style={{ backgroundColor: cabang.color }}
            >
              {cabang.pic.charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                PIC
              </div>
              <div className="truncate text-xs font-medium text-foreground/90">{cabang.pic}</div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 font-mono text-[10px] font-medium uppercase tracking-wider text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Kelola
            <Icon name="arrow-up-right" size={12} />
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
  const homeRoute = session
    ? session.role === 'admin'
      ? ROUTES.dashboard
      : session.role === 'picker'
        ? ROUTES.picker
        : ROUTES.order
    : ROUTES.login;
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
              <Icon name="warehouse-alt" size={48} className="text-white sm:h-14 sm:w-14" />
            </div>
            <div className="splash-brand">
              GUDANG<span className="text-cyan-400">HUB</span>
            </div>
            <div className="splash-tagline">Kolaborasi Cabang &amp; Gudang</div>
            <div className="relative mt-6 flex justify-center gap-3">
              {['sp-1', 'sp-2', 'sp-3', 'sp-4', 'sp-5'].map((s) => (
                <Icon key={s} name="sparkles" size={12} className={cn('splash-spark text-cyan-300', s)} />
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
              <Icon name="warehouse-alt" size={16} />
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
                <Link to={homeRoute}>
                  Buka Aplikasi
                  <Icon name="arrow-right" size={16} />
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
                    <Icon name="arrow-right" size={16} />
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
            <Icon name="menu-burger" size={20} />
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
              <Icon name="warehouse-alt" size={14} />
            </span>
            GudangHub
          </span>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground"
            aria-label="Tutup"
            onClick={() => setDrawerOpen(false)}
          >
            <Icon name="circle-xmark" size={16} />
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
              <Link to={homeRoute} onClick={() => setDrawerOpen(false)}>
                Buka Aplikasi
                <Icon name="arrow-right" size={16} />
              </Link>
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link to="/login" onClick={() => setDrawerOpen(false)}>
                Masuk ke Aplikasi
                <Icon name="arrow-right" size={16} />
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
        {/* Video hero (Seedance) — parallax scroll; fallback poster kalau video belum ada */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl">
          <video
            className="h-full w-full object-cover opacity-25"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/videos/hero-poster.jpg"
            style={{ transform: `translateY(${heroY * -0.12}px) scale(1.12)` }}
            onError={(e) => {
              (e.currentTarget as HTMLVideoElement).style.display = 'none';
            }}
          >
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/35 to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12),transparent_60%)]" />
        </div>
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
                <Icon name="arrow-right" size={20} />
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
            <Icon name="check-circle" size={16} className="text-success" />
            Optimasi jaringan 3G · Mode offline · Notifikasi real-time
          </div>
        </Reveal>
      </section>

      {/* LIVE DEMO */}
      <DemoSection />

      {/* MARQUEE KATEGORI */}
      <section className="mt-14 overflow-hidden border-y border-border/50 py-3">
        <div className="flex w-max animate-marquee gap-8">
          {[...KATEGORI_MARQUEE, ...KATEGORI_MARQUEE].map((k, i) => {
            return (
              <span key={k.name + i} className="flex items-center gap-3 whitespace-nowrap">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="text-primary">
                    <Icon name={k.icon} size={22} className="icon-fade" />
                  </span>
                  {k.name}
                </span>
                <span className="h-1 w-1 rounded-full bg-primary/40" />
              </span>
            );
          })}
        </div>
      </section>

      {/* GALERI — Katalog */}
      <GallerySection />

      {/* TIM */}
      <TeamSection />

      {/* TENTANG — Filosofi */}
      <AboutSection />

      {/* STATS — Skala Operasi */}
      <StatsSection />

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
                  <Icon name={f.icon} size={20} className="icon-beat" />
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
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
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
              PT Central Perabot Utama · NTT
            </p>
            <div className="mx-auto mt-6 grid max-w-lg grid-cols-1 gap-3 text-center text-sm sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <Icon name="shop" size={20} className="mx-auto mb-2 text-primary" />
                <div className="font-semibold">4 Cabang</div>
                <div className="text-xs text-muted-foreground">Tersebar di NTT</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <Icon name="bolt" size={20} className="mx-auto mb-2 text-primary" />
                <div className="font-semibold">Cache Cloud</div>
                <div className="text-xs text-muted-foreground">Respons instan</div>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <Icon name="package" size={20} className="mx-auto mb-2 text-primary" />
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
              <Button asChild size="lg" onClick={() => navigate(homeRoute)}>
                <Link to={homeRoute}>
                  {session ? 'Buka Aplikasi' : 'Mulai Sekarang'}
                  <Icon name="arrow-right" size={20} />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      <FooterSection />
    </div>
  );
}
