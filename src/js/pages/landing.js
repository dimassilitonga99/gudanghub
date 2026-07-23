/* ═══════════════════════════════════════════════════════════════════════
   LANDING PAGE — Logic & Animations (with Lucide Icons)
   ═══════════════════════════════════════════════════════════════════════ */

import { $, $$$, throttle } from '../utils.js';
import { CABANG_LIST } from '../config.js';
import { getSession, isSessionValid } from '../session.js';
import { icon, injectIcons } from '../icons.js';

// ─────────────────────────────────────────────────────────────────────────
// AUTO-REDIRECT jika sudah login
// ─────────────────────────────────────────────────────────────────────────

function checkExistingSession() {
  const s = getSession();
  if (s && isSessionValid(s)) {
    console.log('User sudah login sebagai:', s.username);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// INJECT ALL ICONS
// ─────────────────────────────────────────────────────────────────────────

function initIcons() {
  // Auto-inject semua element dengan data-icon
  injectIcons();
}

// ─────────────────────────────────────────────────────────────────────────
// MOBILE DRAWER
// ─────────────────────────────────────────────────────────────────────────

function initDrawer() {
  const drawer = $('mobileDrawer');
  const overlay = $('drawerOverlay');
  const burger = $('burgerBtn');
  const closeBtn = $('closeDrawer');

  if (!drawer || !overlay || !burger) return;

  const open = () => {
    drawer.classList.add('open');
    overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    drawer.classList.remove('open');
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  };

  burger.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);
  overlay.addEventListener('click', close);

  drawer.querySelectorAll('[data-drawer-link]').forEach((link) => {
    link.addEventListener('click', close);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

// ─────────────────────────────────────────────────────────────────────────
// CURSOR GLOW (desktop only)
// ─────────────────────────────────────────────────────────────────────────

function initCursorGlow() {
  const glow = $('cursorGlow');
  if (!glow) return;

  if (!window.matchMedia('(hover: hover)').matches) {
    glow.remove();
    return;
  }

  let cursorX = 0, cursorY = 0;
  let targetX = 0, targetY = 0;
  let visible = false;

  document.addEventListener('mousemove', (e) => {
    targetX = e.clientX;
    targetY = e.clientY;
    if (!visible) {
      glow.classList.remove('hide');
      visible = true;
    }
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    glow.classList.add('hide');
    visible = false;
  });

  function loop() {
    cursorX += (targetX - cursorX) * 0.15;
    cursorY += (targetY - cursorY) * 0.15;
    glow.style.transform = `translate(${cursorX}px, ${cursorY}px) translate(-50%, -50%)`;
    requestAnimationFrame(loop);
  }
  loop();
}

// ─────────────────────────────────────────────────────────────────────────
// SCROLL PROGRESS + NAV BLUR
// ─────────────────────────────────────────────────────────────────────────

function initScroll() {
  const nav = $('nav');
  const progress = $('scrollProgress');
  const hero = $('top');
  let ticking = false;

  function update() {
    const scrollY = window.scrollY;
    const winH = window.innerHeight;
    const docH = document.documentElement.scrollHeight - winH;
    const percent = docH > 0 ? (scrollY / docH) * 100 : 0;

    if (progress) progress.style.width = percent + '%';
    if (nav) nav.classList.toggle('scrolled', scrollY > 20);

    if (scrollY < winH && hero) {
      hero.style.setProperty('--scroll-y', `-${scrollY * 0.15}px`);
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }, { passive: true });

  update();
}

// ─────────────────────────────────────────────────────────────────────────
// REVEAL ON SCROLL
// ─────────────────────────────────────────────────────────────────────────

function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -8% 0px',
  });

  $$$('.reveal, .reveal-scale').forEach((el) => io.observe(el));
}

// ─────────────────────────────────────────────────────────────────────────
// COUNTER ANIMATION
// ─────────────────────────────────────────────────────────────────────────

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function runCounter(el) {
  const target = parseFloat(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  const valSpan = el.querySelector('.val');
  const dur = 1800;
  const start = performance.now();

  function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    const v = Math.round(easeOut(p) * target);
    if (valSpan) {
      valSpan.textContent = v;
    } else {
      el.textContent = v + (p === 1 ? suffix : '');
    }
    if (p < 1) requestAnimationFrame(tick);
    else if (!valSpan) el.textContent = target + suffix;
  }
  requestAnimationFrame(tick);
}

function initCounters() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        runCounter(entry.target);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  $$$('[data-count]').forEach((el) => {
    setTimeout(() => io.observe(el), 500);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// MARQUEE KATEGORI (dengan SVG icons)
// ─────────────────────────────────────────────────────────────────────────

const KATEGORI_MARQUEE = [
  { name: 'Kursi', iconName: 'armchair' },
  { name: 'Kasur', iconName: 'bed' },
  { name: 'Meja', iconName: 'utensils' },
  { name: 'Elektronik', iconName: 'monitor' },
  { name: 'Peralatan Dapur', iconName: 'cooking' },
  { name: 'Peralatan Makan', iconName: 'utensils' },
  { name: 'Peralatan Mandi', iconName: 'sparkles' },
  { name: 'Lemari', iconName: 'boxes' },
  { name: 'Loker', iconName: 'boxes' },
  { name: 'Sofa', iconName: 'sofa' },
  { name: 'Rak Buku', iconName: 'boxes' },
  { name: 'Dekorasi', iconName: 'palette' },
];

function buildMarqueeItem({ name, iconName }) {
  return `
    <span class="marquee-item">
      <span class="marquee-icon">
        ${icon(iconName, { size: 22, strokeWidth: 1.8 })}
      </span>
      ${name}
    </span>
    <span class="marquee-dot"></span>
  `;
}

function initMarquee() {
  const track = $('marqueeTrack');
  if (!track) return;

  const html = [...KATEGORI_MARQUEE, ...KATEGORI_MARQUEE]
    .map(buildMarqueeItem)
    .join('');

  track.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────
// CABANG LIST (dengan avatar SVG)
// ─────────────────────────────────────────────────────────────────────────

function initCabangList() {
  const container = $('cabangList');
  if (!container) return;

  container.innerHTML = CABANG_LIST.map((cabang, i) => `
    <a href="./login.html" class="cabang-row reveal" data-delay="${Math.min(i, 3)}">
      <div class="cabang-id">${cabang.id}</div>
      <div class="cabang-store">${cabang.nama}</div>
      <div class="cabang-pic">
        <span class="cabang-avatar">${cabang.pic.charAt(0)}</span>
        PIC · ${cabang.pic}
      </div>
      <span class="cabang-go">${icon('arrow-right', { size: 20 })}</span>
    </a>
  `).join('');
}

// ─────────────────────────────────────────────────────────────────────────
// BACKGROUND PARTICLES CANVAS
// ─────────────────────────────────────────────────────────────────────────

function initParticles() {
  const canvas = $('bgCanvas');
  if (!canvas) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.parentElement.style.display = 'none';
    return;
  }

  const ctx = canvas.getContext('2d');
  let particles = [];
  let W = 0, H = 0;
  let mouseX = -1000, mouseY = -1000;
  let animationId;

  function resize() {
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
  }

  function initParticles() {
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
  }

  function draw() {
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
  }

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  window.addEventListener('resize', throttle(resize, 200), { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationId);
    } else {
      draw();
    }
  });

  resize();
  draw();
}

// ─────────────────────────────────────────────────────────────────────────
// SMOOTH SCROLL
// ─────────────────────────────────────────────────────────────────────────

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#' || href.length < 2) return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// PWA REGISTER
// ─────────────────────────────────────────────────────────────────────────

function registerPwa() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('✅ Service Worker registered'))
      .catch((err) => console.warn('⚠️ SW registration failed:', err));
  });
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

function init() {
  checkExistingSession();
  initIcons(); // ← NEW: inject semua data-icon
  initDrawer();
  initCursorGlow();
  initScroll();
  initReveal();
  initCounters();
  initMarquee();
  initCabangList();
  initParticles();
  initSmoothScroll();
  registerPwa();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}