/* ═══════════════════════════════════════════════════════════════════════
   GANTI PASSWORD PAGE — Logic
   ═══════════════════════════════════════════════════════════════════════ */

import { $, sleep } from '../utils.js';
import { auth } from '../api.js';
import { requireAuth, getSession, clearSession } from '../session.js';
import { getOrderUrl } from '../config.js';
import { toast } from '../ui.js';

// ─────────────────────────────────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────────────────────────────────

let session = null;
let errorTimer = null;

// ─────────────────────────────────────────────────────────────────────────
// INIT USER INFO
// ─────────────────────────────────────────────────────────────────────────

function initUserInfo() {
  const nameEl = $('userName');
  const usernameEl = $('userUsername');
  const avatarEl = $('userAvatar');
  const backLink = $('backLink');

  if (nameEl) nameEl.textContent = session.nama || session.username || '-';
  if (usernameEl) usernameEl.textContent = `@${session.username || '-'}`;
  if (avatarEl) {
    avatarEl.textContent = (session.nama || session.username || '?')
      .charAt(0).toUpperCase();
  }

  // Back link sesuai role
  if (backLink) {
    if (session.role === 'admin') {
      backLink.href = './dashboard.html';
    } else {
      backLink.href = getOrderUrl(session.idCabang);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────
// TOGGLE PASSWORD VISIBILITY
// ─────────────────────────────────────────────────────────────────────────

function togglePassword(button) {
  const targetId = button.dataset.target;
  const input = $(targetId);
  if (!input) return;

  const shouldShow = input.type === 'password';
  input.type = shouldShow ? 'text' : 'password';
  button.textContent = shouldShow ? '🙈' : '👁';
  button.setAttribute(
    'aria-label',
    shouldShow ? 'Sembunyikan password' : 'Tampilkan password'
  );
}

// ─────────────────────────────────────────────────────────────────────────
// PASSWORD STRENGTH INDICATOR
// ─────────────────────────────────────────────────────────────────────────

/**
 * Calculate password strength (0-100)
 */
function calculateStrength(password) {
  if (!password) return { score: 0, label: '-', level: 'weak' };

  let score = 0;

  // Length
  if (password.length >= 6) score += 20;
  if (password.length >= 8) score += 15;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 10;

  // Character types
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 10;

  // Determine level
  let label, level;
  if (score < 40) {
    label = 'Lemah';
    level = 'weak';
  } else if (score < 70) {
    label = 'Sedang';
    level = 'medium';
  } else {
    label = 'Kuat';
    level = 'strong';
  }

  return { score: Math.min(100, score), label, level };
}

function updateStrength() {
  const password = $('newPassword')?.value || '';
  const bar = $('strengthBar');
  const label = $('strengthLabel');

  if (!bar || !label) return;

  const { score, label: labelText, level } = calculateStrength(password);

  bar.style.width = `${score}%`;
  label.textContent = labelText;
  label.className = `strength-${level}`;

  // Warna bar
  const colors = {
    weak: 'var(--danger)',
    medium: 'var(--warning)',
    strong: 'var(--success)',
  };
  bar.style.background = colors[level];
}

// ─────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────

function hideMessages() {
  $('errorMessage')?.classList.remove('show');
  $('successMessage')?.classList.remove('show');
}

function showMessage(type, message) {
  hideMessages();

  if (type === 'error') {
    $('errorText').textContent = message;
    $('errorMessage')?.classList.add('show');
    clearTimeout(errorTimer);
    errorTimer = setTimeout(() => {
      $('errorMessage')?.classList.remove('show');
    }, 6000);
  } else {
    $('successText').textContent = message;
    $('successMessage')?.classList.add('show');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// SHAKE
// ─────────────────────────────────────────────────────────────────────────

function shakeCard() {
  const card = $('passwordCard');
  if (!card) return;

  card.classList.remove('shake');
  void card.offsetWidth;
  card.classList.add('shake');
}

// ─────────────────────────────────────────────────────────────────────────
// LOADING STATE
// ─────────────────────────────────────────────────────────────────────────

function setLoadingState(isLoading) {
  const btn = $('submitButton');
  const btnText = $('submitButtonText');

  if (!btn || !btnText) return;

  btn.classList.toggle('loading', isLoading);
  btn.disabled = isLoading;

  btnText.innerHTML = isLoading
    ? '<span class="spinner spinner-sm"></span> Menyimpan...'
    : '💾 Simpan Password Baru';
}

// ─────────────────────────────────────────────────────────────────────────
// VALIDASI
// ─────────────────────────────────────────────────────────────────────────

function validateForm(oldPass, newPass, confirmPass) {
  if (!oldPass || !newPass || !confirmPass) {
    return 'Semua kolom wajib diisi.';
  }

  if (newPass.length < 6) {
    return 'Password baru minimal 6 karakter.';
  }

  if (newPass !== confirmPass) {
    return 'Ulangi password tidak sama dengan password baru.';
  }

  if (newPass === oldPass) {
    return 'Password baru harus berbeda dari password lama.';
  }

  // Warning kalau password lemah
  const { score } = calculateStrength(newPass);
  if (score < 40) {
    return 'Password terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf, angka, dan simbol.';
  }

  return '';
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMIT HANDLER
// ─────────────────────────────────────────────────────────────────────────

async function handleSubmit(event) {
  event.preventDefault();

  if (!session) {
    window.location.href = './login.html';
    return;
  }

  const oldPassword = $('oldPassword').value;
  const newPassword = $('newPassword').value;
  const confirmPassword = $('confirmPassword').value;

  const validationError = validateForm(oldPassword, newPassword, confirmPassword);

  if (validationError) {
    showMessage('error', validationError);
    shakeCard();
    return;
  }

  setLoadingState(true);

  try {
    const result = await auth.changePassword({
      username: session.username,
      passwordLama: oldPassword,
      passwordBaru: newPassword,
    });

    if (result.status !== 'ok') {
      showMessage('error', result.message || 'Gagal mengubah password.');
      setLoadingState(false);
      shakeCard();
      return;
    }

    showMessage('success', result.message || 'Password berhasil diubah! Silakan login ulang.');
    $('passwordForm').reset();
    updateStrength();
    setLoadingState(false);

    toast.success('Password berhasil diubah!');

    // Auto logout & redirect setelah 2 detik (security best practice)
    await sleep(2000);
    clearSession();
    window.location.href = './login.html';

  } catch (error) {
    showMessage('error', error.message || 'Terjadi kesalahan. Coba lagi.');
    setLoadingState(false);
    shakeCard();
  }
}

// ─────────────────────────────────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────────────────────────────────

function bindEvents() {
  // Toggle password buttons
  document.querySelectorAll('[data-target]').forEach((btn) => {
    btn.addEventListener('click', () => togglePassword(btn));
  });

  // Form submit
  $('passwordForm')?.addEventListener('submit', handleSubmit);

  // Strength indicator
  $('newPassword')?.addEventListener('input', updateStrength);

  // Clear messages on input
  ['oldPassword', 'newPassword', 'confirmPassword'].forEach((id) => {
    $(id)?.addEventListener('input', () => {
      hideMessages();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────────────────────────────────

function init() {
  session = requireAuth();
  if (!session) return;

  initUserInfo();
  bindEvents();
  updateStrength();

  setTimeout(() => $('oldPassword')?.focus(), 300);
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
