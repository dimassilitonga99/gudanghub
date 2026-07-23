/* ═══════════════════════════════════════════════════════════════════════
   LOGIN PAGE — Logic with Lucide Icons
   ═══════════════════════════════════════════════════════════════════════ */

import { $, sleep } from '../utils.js';
import { auth } from '../api.js';
import {
  setSession,
  getLastUsername,
  setLastUsername,
  redirectIfAuthenticated,
  redirectToHome,
} from '../session.js';
import { toast } from '../ui.js';
import { icon, injectIcons } from '../icons.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

let currentRole = 'admin';
let errorTimer = null;

// ─────────────────────────────────────────────────────────────────────────
// ROLE SELECTOR
// ─────────────────────────────────────────────────────────────────────────

function setRole(role) {
  currentRole = role;

  const adminBtn = $('role-admin');
  const cabangBtn = $('role-cabang');
  const userInput = $('inputUser');

  if (adminBtn) {
    adminBtn.classList.toggle('active', role === 'admin');
    adminBtn.setAttribute('aria-checked', role === 'admin');
  }
  if (cabangBtn) {
    cabangBtn.classList.toggle('active', role === 'cabang');
    cabangBtn.setAttribute('aria-checked', role === 'cabang');
  }
  if (userInput) {
    userInput.placeholder = role === 'admin'
      ? 'Masukkan username admin'
      : 'Masukkan username cabang';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TOGGLE PASSWORD
// ─────────────────────────────────────────────────────────────────────────

function togglePw() {
  const input = $('inputPass');
  const eye = $('eyeIcon');
  const btn = $('toggleBtn');

  if (!input || !eye) return;

  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  // Update icon
  eye.innerHTML = icon(isPassword ? 'eye-off' : 'eye', { size: 18 });

  btn?.setAttribute('aria-label', isPassword ? 'Sembunyikan password' : 'Tampilkan password');
}

// ─────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────

function showError(message) {
  const el = $('errorMsg');
  const txt = $('errorText');
  if (!el || !txt) return;

  txt.textContent = message;
  el.classList.add('show');

  clearTimeout(errorTimer);
  errorTimer = setTimeout(() => {
    el.classList.remove('show');
  }, 4500);
}

function hideError() {
  $('errorMsg')?.classList.remove('show');
}

// ─────────────────────────────────────────────────────────────────────────
// SHAKE
// ─────────────────────────────────────────────────────────────────────────

function shakeCard() {
  const card = $('loginCard');
  if (!card) return;

  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

// ─────────────────────────────────────────────────────────────────────────
// BUTTON LOADING STATE
// ─────────────────────────────────────────────────────────────────────────

function setLoadingBtn(isLoading, text = 'Memverifikasi...') {
  const btn = $('btnLogin');
  const btnText = $('btnText');

  if (!btn || !btnText) return;

  btn.classList.toggle('loading', isLoading);
  btn.disabled = isLoading;

  if (isLoading) {
    btnText.innerHTML = `<span class="spinner spinner-sm"></span> ${text}`;
  } else {
    btnText.innerHTML = `${icon('login', { size: 18 })} Masuk`;
  }
}

function setLoadingForgotBtn(isLoading, text = 'Mengirim...') {
  const btn = $('fBtn');
  const btnText = $('fBtnText');

  if (!btn || !btnText) return;

  btn.classList.toggle('loading', isLoading);
  btn.disabled = isLoading;

  if (isLoading) {
    btnText.innerHTML = `<span class="spinner spinner-sm"></span> ${text}`;
  } else {
    btnText.innerHTML = `${icon('send', { size: 16 })} Kirim ke Admin`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LOGIN HANDLER
// ─────────────────────────────────────────────────────────────────────────

async function handleLogin(event) {
  event.preventDefault();
  hideError();

  const username = $('inputUser').value.trim();
  const password = $('inputPass').value;
  const rememberChecked = $('remember').checked;

  if (!username || !password) {
    showError('Username dan password wajib diisi.');
    shakeCard();
    return;
  }

  setLoadingBtn(true);

  try {
    const result = await auth.login({ username, password });

    if (result.status !== 'ok') {
      showError(result.message || 'Username atau password salah.');
      setLoadingBtn(false);
      shakeCard();
      return;
    }

    const user = result.user || {};

    if (currentRole === 'admin' && user.role !== 'admin') {
      showError('Akun ini bukan Admin Gudang. Pilih peran "Cabang".');
      setLoadingBtn(false);
      shakeCard();
      return;
    }

    if (currentRole === 'cabang' && user.role !== 'cabang') {
      showError('Akun ini bukan Cabang. Pilih peran "Admin Gudang".');
      setLoadingBtn(false);
      shakeCard();
      return;
    }

    setSession(user, result.token);
    setLastUsername(rememberChecked ? user.username : '');

    // Success animation
    const btnText = $('btnText');
    if (btnText) {
      btnText.innerHTML = `${icon('check-circle', { size: 18 })} Berhasil! Mengalihkan...`;
    }

    toast.success(`Selamat datang, ${user.nama || user.username}!`);

    await sleep(600);
    redirectToHome({ role: user.role, idCabang: user.idCabang });

  } catch (error) {
    showError(error.message || 'Terjadi kesalahan. Coba lagi.');
    setLoadingBtn(false);
    shakeCard();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FORGOT PASSWORD MODAL
// ─────────────────────────────────────────────────────────────────────────

function openForgot() {
  const overlay = $('forgotOv');
  const fUser = $('fUser');
  const inputUser = $('inputUser');

  if (!overlay) return;

  if (fUser && inputUser) {
    fUser.value = inputUser.value.trim();
  }

  $('fErr')?.classList.remove('show');
  $('fOk')?.classList.remove('show');

  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  setTimeout(() => fUser?.focus(), 100);
}

function closeForgot() {
  $('forgotOv')?.classList.remove('show');
  document.body.style.overflow = '';
}

async function submitForgot() {
  const username = $('fUser').value.trim();
  const errEl = $('fErr');
  const okEl = $('fOk');
  const errText = $('fErrText');
  const okText = $('fOkText');

  errEl?.classList.remove('show');
  okEl?.classList.remove('show');

  if (!username) {
    if (errText) errText.textContent = 'Username wajib diisi.';
    errEl?.classList.add('show');
    return;
  }

  setLoadingForgotBtn(true);

  try {
    const result = await auth.forgotPassword({ username });

    if (result.status === 'ok') {
      if (okText) okText.textContent = result.message || 'Permintaan terkirim ke admin gudang.';
      okEl?.classList.add('show');
      setLoadingForgotBtn(false);
    } else {
      if (errText) errText.textContent = result.message || 'Gagal memproses permintaan.';
      errEl?.classList.add('show');
      setLoadingForgotBtn(false);
    }
  } catch (error) {
    if (errText) errText.textContent = error.message || 'Gagal terhubung ke server.';
    errEl?.classList.add('show');
    setLoadingForgotBtn(false);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {
  $('role-admin')?.addEventListener('click', () => setRole('admin'));
  $('role-cabang')?.addEventListener('click', () => setRole('cabang'));

  $('toggleBtn')?.addEventListener('click', togglePw);

  $('loginForm')?.addEventListener('submit', handleLogin);

  $('forgotBtn')?.addEventListener('click', openForgot);
  $('fCancel')?.addEventListener('click', closeForgot);
  $('fBtn')?.addEventListener('click', submitForgot);

  $('forgotOv')?.addEventListener('click', (e) => {
    if (e.target.id === 'forgotOv') closeForgot();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeForgot();
  });

  $('fUser')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitForgot();
    }
  });

  ['inputUser', 'inputPass'].forEach((id) => {
    $(id)?.addEventListener('input', hideError);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

function init() {
  if (redirectIfAuthenticated()) return;

  // Inject semua icons dari data-icon
  injectIcons();

  const lastUser = getLastUsername();
  if (lastUser) {
    const input = $('inputUser');
    const remember = $('remember');
    if (input) input.value = lastUser;
    if (remember) remember.checked = true;
  }

  bindEvents();

  setTimeout(() => {
    const input = $('inputUser');
    if (input && !input.value) input.focus();
    else $('inputPass')?.focus();
  }, 300);
}

function setVH() {
  document.documentElement.style.setProperty(
    '--vh',
    `${window.innerHeight * 0.01}px`
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