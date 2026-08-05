/* ═══════════════════════════════════════════════════════════════════════
   LOGIN PAGE — v3.9 Auto-Detect Role (No Role Selector)
   ═══════════════════════════════════════════════════════════════════════ */

import { $, sleep } from '../utils.js';
import { auth, prewarmAppScript } from '../api.js';
import { API_URL } from '../config.js';
import {
  setSession,
  getLastUsername,
  setLastUsername,
  redirectIfAuthenticated,
  redirectToHome,
} from '../session.js';
import { toast } from '../ui.js';
import { icon, injectIcons } from '../icons.js';

var errorTimer = null;
var isLoggingIn = false;

var CRED_CACHE_KEY = 'gudanghub_login_cache';

// ─────────────────────────────────────────────────────────────────────────
// CREDENTIAL CACHE
// ─────────────────────────────────────────────────────────────────────────

function getCachedLogin(username, password) {
  try {
    var raw = localStorage.getItem(CRED_CACHE_KEY);
    if (!raw) return null;

    var cache = JSON.parse(raw);
    if (!cache || !cache.hash || !cache.user || !cache.time) return null;

    if (Date.now() - cache.time > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CRED_CACHE_KEY);
      return null;
    }

    var hash = simpleHash(username.toLowerCase() + ':' + password);
    if (hash !== cache.hash) return null;

    return cache.user;
  } catch {
    return null;
  }
}

function setCachedLogin(username, password, user) {
  try {
    var hash = simpleHash(username.toLowerCase() + ':' + password);
    localStorage.setItem(CRED_CACHE_KEY, JSON.stringify({
      hash: hash,
      user: user,
      time: Date.now(),
    }));
  } catch {}
}

function simpleHash(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    var char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h' + Math.abs(hash).toString(36);
}

// ─────────────────────────────────────────────────────────────────────────
// PREWARM AGRESIF
// ─────────────────────────────────────────────────────────────────────────

function aggressivePrewarm() {
  prewarmAppScript();

  try {
    fetch(API_URL + '?action=ping&t=' + Date.now(), {
      method: 'GET',
      cache: 'no-store',
    }).catch(function () {});
  } catch {}

  setTimeout(function () {
    try {
      fetch(API_URL + '?action=ping&t=' + Date.now(), {
        method: 'GET',
        cache: 'no-store',
      }).catch(function () {});
    } catch {}
  }, 2000);
}

// ─────────────────────────────────────────────────────────────────────────
// TOGGLE PASSWORD
// ─────────────────────────────────────────────────────────────────────────

function togglePw() {
  var input = $('inputPass');
  var eye = $('eyeIcon');
  var btn = $('toggleBtn');

  if (!input || !eye) return;

  var isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  eye.innerHTML = icon(isPassword ? 'eye-off' : 'eye', { size: 18 });
  btn?.setAttribute('aria-label', isPassword ? 'Sembunyikan password' : 'Tampilkan password');
}

// ─────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────

function showError(message) {
  var el = $('errorMsg');
  var txt = $('errorText');
  if (!el || !txt) return;

  txt.textContent = message;
  el.classList.add('show');

  clearTimeout(errorTimer);
  errorTimer = setTimeout(function () {
    el.classList.remove('show');
  }, 5000);
}

function hideError() {
  $('errorMsg')?.classList.remove('show');
  clearTimeout(errorTimer);
}

function shakeCard() {
  var card = $('loginCard');
  if (!card) return;

  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

// ─────────────────────────────────────────────────────────────────────────
// LOADING STATE
// ─────────────────────────────────────────────────────────────────────────

function setLoadingBtn(isLoading, text) {
  var btn = $('btnLogin');
  var btnText = $('btnText');

  if (!btn || !btnText) return;

  btn.classList.toggle('loading', isLoading);
  btn.disabled = isLoading;

  if (isLoading) {
    btnText.innerHTML = '<span class="spinner spinner-sm"></span> ' + (text || 'Memverifikasi...');
  } else {
    btnText.innerHTML = icon('login', { size: 18 }) + ' Masuk';
  }
}

function setLoadingForgotBtn(isLoading) {
  var btn = $('fBtn');
  var btnText = $('fBtnText');

  if (!btn || !btnText) return;

  btn.classList.toggle('loading', isLoading);
  btn.disabled = isLoading;

  if (isLoading) {
    btnText.innerHTML = '<span class="spinner spinner-sm"></span> Mengirim...';
  } else {
    btnText.innerHTML = icon('send', { size: 16 }) + ' Kirim ke Admin';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// ★ LOGIN HANDLER — AUTO DETECT ROLE
// ─────────────────────────────────────────────────────────────────────────

async function handleLogin(event) {
  event.preventDefault();

  if (isLoggingIn) return;

  hideError();

  var username = $('inputUser').value.trim();
  var password = $('inputPass').value;
  var rememberChecked = $('remember').checked;

  if (!username || !password) {
    showError('Username dan password wajib diisi.');
    shakeCard();
    return;
  }

  if (username.length < 3) {
    showError('Username minimal 3 karakter.');
    shakeCard();
    return;
  }

  isLoggingIn = true;
  setLoadingBtn(true, 'Memverifikasi...');

  // ═══ STRATEGY 1: Cache (INSTANT) ═══

  var cachedUser = getCachedLogin(username, password);

  if (cachedUser) {
    console.log('[Login] Using cached credentials (instant)');

    setLoadingBtn(true, 'Masuk...');

    setSession(cachedUser, 'cached-' + Date.now());
    setLastUsername(rememberChecked ? cachedUser.username : '');

    var btnText = $('btnText');
    if (btnText) {
      btnText.innerHTML = icon('check-circle', { size: 18 }) + ' Berhasil!';
    }

    toast.success('Selamat datang, ' + (cachedUser.nama || cachedUser.username) + '!', { duration: 2000 });

    await sleep(200);
    redirectToHome({ role: cachedUser.role, idCabang: cachedUser.idCabang });

    verifyInBackground(username, password);
    return;
  }

  // ═══ STRATEGY 2: Server (retry agresif) ═══

  var result = null;
  var lastError = null;
  var maxAttempts = 3;

  for (var attempt = 1; attempt <= maxAttempts; attempt++) {

    setLoadingBtn(true, 'Memverifikasi... (' + attempt + '/' + maxAttempts + ')');

    try {
      result = await auth.login({ username: username, password: password });

      if (result && result.status) {
        break;
      }
    } catch (err) {
      lastError = err;
      console.warn('[Login] Attempt ' + attempt + '/' + maxAttempts + ' failed:', err.message);
    }

    if (attempt < maxAttempts) {
      setLoadingBtn(true, 'Mencoba lagi...');
      await sleep(500);
    }
  }

  // ═══ HANDLE RESULT ═══

  if (!result || result.status !== 'ok') {
    var msg = (result && result.message) ? result.message : (lastError ? lastError.message : 'Login gagal. Coba lagi.');
    showError(msg);
    setLoadingBtn(false);
    shakeCard();
    isLoggingIn = false;
    return;
  }

  var user = result.user || {};

  // ★ AUTO-DETECT: Tidak perlu validasi role — server sudah return role yang benar
  // Admin atau cabang otomatis dikenali dari username di USERS sheet

  if (user.role === 'cabang' && !user.idCabang) {
    showError('Akun cabang tidak punya ID cabang. Hubungi admin.');
    setLoadingBtn(false);
    shakeCard();
    isLoggingIn = false;
    return;
  }

  // ═══ SUKSES ═══

  setCachedLogin(username, password, user);

  setSession(user, result.token);
  setLastUsername(rememberChecked ? user.username : '');

  var btnTextEl = $('btnText');
  if (btnTextEl) {
    btnTextEl.innerHTML = icon('check-circle', { size: 18 }) + ' Berhasil!';
  }

  toast.success('Selamat datang, ' + (user.nama || user.username) + '!', { duration: 2000 });

  await sleep(200);
  redirectToHome({ role: user.role, idCabang: user.idCabang });
}

async function verifyInBackground(username, password) {
  try {
    var result = await auth.login({ username: username, password: password });
    if (result && result.status === 'ok' && result.user) {
      setCachedLogin(username, password, result.user);
      console.log('[Login] Background verify OK');
    } else if (result && result.status === 'error') {
      localStorage.removeItem(CRED_CACHE_KEY);
      console.log('[Login] Background verify FAILED — cache cleared');
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD
// ─────────────────────────────────────────────────────────────────────────

function openForgot() {
  var overlay = $('forgotOv');
  var fUser = $('fUser');
  var inputUser = $('inputUser');

  if (!overlay) return;

  if (fUser && inputUser) {
    fUser.value = inputUser.value.trim();
  }

  $('fErr')?.classList.remove('show');
  $('fOk')?.classList.remove('show');

  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  setTimeout(function () { fUser?.focus(); }, 100);
}

function closeForgot() {
  $('forgotOv')?.classList.remove('show');
  document.body.style.overflow = '';
}

async function submitForgot() {
  var username = $('fUser').value.trim();
  var errEl = $('fErr');
  var okEl = $('fOk');
  var errText = $('fErrText');
  var okText = $('fOkText');

  errEl?.classList.remove('show');
  okEl?.classList.remove('show');

  if (!username) {
    if (errText) errText.textContent = 'Username wajib diisi.';
    errEl?.classList.add('show');
    return;
  }

  setLoadingForgotBtn(true);

  try {
    var result = await auth.forgotPassword({ username: username });

    if (result.status === 'ok') {
      if (okText) okText.textContent = result.message || 'Permintaan terkirim ke admin gudang.';
      okEl?.classList.add('show');
    } else {
      if (errText) errText.textContent = result.message || 'Gagal memproses permintaan.';
      errEl?.classList.add('show');
    }
  } catch (error) {
    if (errText) errText.textContent = error.message || 'Gagal terhubung ke server.';
    errEl?.classList.add('show');
  }

  setLoadingForgotBtn(false);
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {
  $('toggleBtn')?.addEventListener('click', togglePw);

  $('loginForm')?.addEventListener('submit', handleLogin);

  $('forgotBtn')?.addEventListener('click', openForgot);
  $('fCancel')?.addEventListener('click', closeForgot);
  $('fBtn')?.addEventListener('click', submitForgot);

  $('forgotOv')?.addEventListener('click', function (e) {
    if (e.target.id === 'forgotOv') closeForgot();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeForgot();
  });

  $('fUser')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitForgot();
    }
  });

  ['inputUser', 'inputPass'].forEach(function (id) {
    $(id)?.addEventListener('input', hideError);
  });

  $('inputPass')?.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !isLoggingIn) {
      e.preventDefault();
      $('loginForm')?.dispatchEvent(new Event('submit'));
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

function init() {
  if (redirectIfAuthenticated()) return;

  aggressivePrewarm();

  injectIcons();

  // ★ SEMBUNYIKAN role selector
  var rolesDiv = document.querySelector('.roles');
  if (rolesDiv) rolesDiv.style.display = 'none';

  // ★ Update welcome text (hapus mention "pilih peran")
  var welcomeSub = document.querySelector('.welcome-sub');
  if (welcomeSub) {
    welcomeSub.textContent = 'Masukkan username dan password untuk mulai mengelola order.';
  }

  // ★ Update placeholder (generic, bukan "admin" atau "cabang")
  var inputUser = $('inputUser');
  if (inputUser) {
    inputUser.placeholder = 'Masukkan username Anda';
  }

  var lastUser = getLastUsername();
  if (lastUser) {
    var input = $('inputUser');
    var remember = $('remember');
    if (input) input.value = lastUser;
    if (remember) remember.checked = true;
  }

  bindEvents();

  setTimeout(function () {
    var input = $('inputUser');
    if (input && !input.value) input.focus();
    else $('inputPass')?.focus();
  }, 300);
}

function setVH() {
  document.documentElement.style.setProperty(
    '--vh',
    window.innerHeight * 0.01 + 'px'
  );
}

setVH();
window.addEventListener('resize', setVH, { passive: true });
window.addEventListener('orientationchange', setVH, { passive: true });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
