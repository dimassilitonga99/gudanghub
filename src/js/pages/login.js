/* ═══════════════════════════════════════════════════════════════════════
   LOGIN PAGE — Logic
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
  eye.textContent = isPassword ? '🙈' : '👁';
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
// SHAKE ANIMATION
// ─────────────────────────────────────────────────────────────────────────

function shakeCard() {
  const card = $('loginCard');
  if (!card) return;

  card.classList.remove('shake');
  void card.offsetWidth; // Trigger reflow
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

  btnText.innerHTML = isLoading
    ? `<span class="spinner spinner-sm"></span> ${text}`
    : '<span>🔒</span> Masuk';
}

function setLoadingForgotBtn(isLoading, text = 'Mengirim...') {
  const btn = $('fBtn');
  const btnText = $('fBtnText');

  if (!btn || !btnText) return;

  btn.classList.toggle('loading', isLoading);
  btn.disabled = isLoading;

  btnText.innerHTML = isLoading
    ? `<span class="spinner spinner-sm"></span> ${text}`
    : '<span>📧</span> Kirim ke Admin';
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

  // Validasi
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

    // Validasi role
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

    // Simpan session
    setSession(user, result.token);

    // Remember me
    setLastUsername(rememberChecked ? user.username : '');

    // Success animation
    const btnText = $('btnText');
    if (btnText) {
      btnText.innerHTML = '<span>✅</span> Berhasil! Mengalihkan...';
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

  // Auto-fill dari input login
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
  // Role selector
  $('role-admin')?.addEventListener('click', () => setRole('admin'));
  $('role-cabang')?.addEventListener('click', () => setRole('cabang'));

  // Toggle password
  $('toggleBtn')?.addEventListener('click', togglePw);

  // Form submit
  $('loginForm')?.addEventListener('submit', handleLogin);

  // Forgot password
  $('forgotBtn')?.addEventListener('click', openForgot);
  $('fCancel')?.addEventListener('click', closeForgot);
  $('fBtn')?.addEventListener('click', submitForgot);

  // Close modal on backdrop click
  $('forgotOv')?.addEventListener('click', (e) => {
    if (e.target.id === 'forgotOv') closeForgot();
  });

  // Close on ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeForgot();
  });

  // Submit forgot on Enter in input
  $('fUser')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitForgot();
    }
  });

  // Clear error saat user typing
  ['inputUser', 'inputPass'].forEach((id) => {
    $(id)?.addEventListener('input', hideError);
  });
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

function init() {
  // Auto-redirect kalau sudah login
  if (redirectIfAuthenticated()) return;

  // Restore last username (remember me)
  const lastUser = getLastUsername();
  if (lastUser) {
    const input = $('inputUser');
    const remember = $('remember');
    if (input) input.value = lastUser;
    if (remember) remember.checked = true;
  }

  bindEvents();

  // Focus username field
  setTimeout(() => {
    const input = $('inputUser');
    if (input && !input.value) input.focus();
    else $('inputPass')?.focus();
  }, 300);
}

// Mobile viewport fix
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
