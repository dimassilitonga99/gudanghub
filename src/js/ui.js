/* ═══════════════════════════════════════════════════════════════════════
   UI — Toast, Modal, Confirm, Prompt
   ═══════════════════════════════════════════════════════════════════════ */

import { SETTINGS } from './config.js';
import { $, escapeHtml, raf } from './utils.js';

// ─────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────

let toastContainer = null;

function ensureToastContainer() {
  if (toastContainer) return toastContainer;

  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-container';
  toastContainer.setAttribute('aria-live', 'polite');
  toastContainer.setAttribute('aria-atomic', 'true');
  document.body.appendChild(toastContainer);

  return toastContainer;
}

const TOAST_ICONS = {
  success: '✅',
  danger: '❌',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

/**
 * Tampilkan toast notification
 *
 * @example
 * toast('Berhasil disimpan!', 'success');
 * toast({ message: 'Error!', type: 'danger', duration: 5000 });
 */
export function toast(messageOrOptions, type = 'info', duration = SETTINGS.toastDuration) {
  const container = ensureToastContainer();

  // Support both signatures
  let opts;
  if (typeof messageOrOptions === 'object') {
    opts = messageOrOptions;
  } else {
    opts = { message: messageOrOptions, type, duration };
  }

  const finalType = opts.type === 'error' ? 'danger' : (opts.type || 'info');
  const icon = opts.icon || TOAST_ICONS[finalType] || TOAST_ICONS.info;
  const finalDuration = opts.duration ||
    (finalType === 'danger' ? SETTINGS.toastDurationError : SETTINGS.toastDuration);

  const el = document.createElement('div');
  el.className = `toast toast-${finalType}`;
  el.setAttribute('role', 'status');
  el.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <span class="toast-message">${escapeHtml(opts.message)}</span>
    <button class="toast-close" aria-label="Tutup notifikasi">✕</button>
  `;

  const closeBtn = el.querySelector('.toast-close');
  const dismiss = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  };

  closeBtn.addEventListener('click', dismiss);
  container.appendChild(el);

  // Animate in
  raf(() => raf(() => el.classList.add('show')));

  // Auto dismiss
  if (finalDuration > 0) {
    setTimeout(dismiss, finalDuration);
  }

  return { dismiss, element: el };
}

// Shortcut methods
toast.success = (msg, opts = {}) => toast({ message: msg, type: 'success', ...opts });
toast.danger  = (msg, opts = {}) => toast({ message: msg, type: 'danger', ...opts });
toast.error   = (msg, opts = {}) => toast({ message: msg, type: 'danger', ...opts });
toast.warning = (msg, opts = {}) => toast({ message: msg, type: 'warning', ...opts });
toast.info    = (msg, opts = {}) => toast({ message: msg, type: 'info', ...opts });

// ─────────────────────────────────────────────────────────────────────────
// CONFIRM DIALOG
// ─────────────────────────────────────────────────────────────────────────

let confirmOverlay = null;
let confirmResolve = null;

function ensureConfirmOverlay() {
  if (confirmOverlay) return confirmOverlay;

  confirmOverlay = document.createElement('div');
  confirmOverlay.className = 'overlay confirm-overlay';
  confirmOverlay.setAttribute('role', 'dialog');
  confirmOverlay.setAttribute('aria-modal', 'true');
  confirmOverlay.innerHTML = `
    <div class="modal modal-sm" role="document">
      <div class="modal-body" style="text-align: center; padding: 28px;">
        <div id="confirmIcon" style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
        <h3 id="confirmTitle" style="font-size: 18px; margin-bottom: 8px;">Konfirmasi</h3>
        <p id="confirmMessage" style="color: var(--muted); font-size: 13px; line-height: 1.6; margin-bottom: 24px; white-space: pre-line; text-align: left;">Yakin?</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="confirmCancel" class="btn btn-secondary" style="flex: 1; min-width: 100px;">Batal</button>
          <button id="confirmOk" class="btn btn-primary" style="flex: 1; min-width: 100px;">Ya, Lanjut</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(confirmOverlay);

  // Event handlers
  $('confirmCancel').addEventListener('click', () => resolveConfirm(false));
  $('confirmOk').addEventListener('click', () => resolveConfirm(true));

  confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) resolveConfirm(false);
  });

  return confirmOverlay;
}

function resolveConfirm(value) {
  if (confirmResolve) {
    confirmResolve(value);
    confirmResolve = null;
  }
  confirmOverlay?.classList.remove('show');
  document.body.style.overflow = '';
}

/**
 * Tampilkan confirm dialog
 *
 * @example
 * const ok = await confirm({
 *   title: 'Hapus?',
 *   message: 'Data akan hilang permanen.',
 *   okText: 'Ya, Hapus',
 *   okVariant: 'danger'
 * });
 */
export function confirm(options = {}) {
  const {
    icon = '⚠️',
    title = 'Konfirmasi',
    message = 'Apakah Anda yakin?',
    okText = 'Ya, Lanjut',
    cancelText = 'Batal',
    okVariant = 'primary', // primary, danger, success, info
  } = options;

  ensureConfirmOverlay();

  $('confirmIcon').textContent = icon;
  $('confirmTitle').textContent = title;
  $('confirmMessage').textContent = message;
  $('confirmOk').textContent = okText;
  $('confirmCancel').textContent = cancelText;

  // Reset & set button variant
  $('confirmOk').className = `btn btn-${okVariant}`;
  $('confirmOk').style.flex = '1';
  $('confirmOk').style.minWidth = '100px';

  confirmOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  return new Promise((resolve) => {
    confirmResolve = resolve;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// PROMPT DIALOG (input dari user)
// ─────────────────────────────────────────────────────────────────────────

let promptOverlay = null;
let promptResolve = null;

function ensurePromptOverlay() {
  if (promptOverlay) return promptOverlay;

  promptOverlay = document.createElement('div');
  promptOverlay.className = 'overlay confirm-overlay';
  promptOverlay.setAttribute('role', 'dialog');
  promptOverlay.setAttribute('aria-modal', 'true');
  promptOverlay.innerHTML = `
    <div class="modal modal-sm" role="document">
      <div class="modal-body" style="padding: 28px;">
        <div style="text-align: center;">
          <div id="promptIcon" style="font-size: 40px; margin-bottom: 10px;">📝</div>
          <h3 id="promptTitle" style="font-size: 16px; font-weight: 800; margin-bottom: 8px;">Input</h3>
          <p id="promptMessage" style="color: var(--muted); font-size: 13px; line-height: 1.6; margin-bottom: 16px; white-space: pre-line; text-align: left;"></p>
        </div>
        <input id="promptNumber" type="number" min="1" value="1" class="input" style="display:none; text-align: center; font-weight: 700; margin-bottom: 12px;" />
        <textarea id="promptInput" class="textarea" placeholder="Ketik di sini..." style="margin-bottom: 16px;"></textarea>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="promptCancel" class="btn btn-secondary" style="flex: 1; min-width: 100px;">Batal</button>
          <button id="promptOk" class="btn btn-primary" style="flex: 1; min-width: 100px;">Konfirmasi</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(promptOverlay);

  $('promptCancel').addEventListener('click', () => resolvePrompt(null));
  $('promptOk').addEventListener('click', () => resolvePromptOk());

  promptOverlay.addEventListener('click', (e) => {
    if (e.target === promptOverlay) resolvePrompt(null);
  });

  return promptOverlay;
}

let promptOptions = {};

function resolvePromptOk() {
  const text = $('promptInput').value.trim();
  const number = parseInt($('promptNumber').value, 10) || 1;

  if (promptOptions.required && !text) {
    toast.warning('Isian wajib diisi.');
    return;
  }

  const result = promptOptions.showNumber ? { text, number } : text;
  resolvePrompt(result);
}

function resolvePrompt(value) {
  if (promptResolve) {
    promptResolve(value);
    promptResolve = null;
  }
  promptOverlay?.classList.remove('show');
  document.body.style.overflow = '';
}

/**
 * Tampilkan prompt dialog untuk input
 *
 * @example
 * const reason = await prompt({
 *   title: 'Alasan Penolakan',
 *   placeholder: 'Contoh: Stok habis',
 *   required: true
 * });
 * if (reason) console.log(reason);
 */
export function prompt(options = {}) {
  const {
    icon = '📝',
    title = 'Input',
    message = '',
    placeholder = 'Ketik di sini...',
    okText = 'Konfirmasi',
    cancelText = 'Batal',
    okVariant = 'primary',
    required = false,
    defaultValue = '',
    showNumber = false,
    numberValue = 1,
  } = options;

  promptOptions = { required, showNumber };
  ensurePromptOverlay();

  $('promptIcon').textContent = icon;
  $('promptTitle').textContent = title;
  $('promptMessage').textContent = message;
  $('promptInput').placeholder = placeholder;
  $('promptInput').value = defaultValue;
  $('promptNumber').value = numberValue;
  $('promptNumber').style.display = showNumber ? 'block' : 'none';

  $('promptOk').textContent = okText;
  $('promptOk').className = `btn btn-${okVariant}`;
  $('promptOk').style.flex = '1';
  $('promptOk').style.minWidth = '100px';
  $('promptCancel').textContent = cancelText;

  promptOverlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  setTimeout(() => {
    (showNumber ? $('promptNumber') : $('promptInput')).focus();
  }, 100);

  return new Promise((resolve) => {
    promptResolve = resolve;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// ALERT (info notification)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Tampilkan alert sederhana (blocking)
 */
export async function alert(options = {}) {
  const {
    icon = 'ℹ️',
    title = 'Informasi',
    message = '',
    okText = 'OK',
    okVariant = 'primary',
  } = typeof options === 'string' ? { message: options } : options;

  return confirm({
    icon,
    title,
    message,
    okText,
    cancelText: '',
    okVariant,
  }).then(() => {
    // Hide cancel button after render
    const cancelBtn = $('confirmCancel');
    if (cancelBtn) cancelBtn.style.display = 'none';
  });
}

// ─────────────────────────────────────────────────────────────────────────
// MODAL HELPER (untuk modal custom)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Show/hide modal by ID
 */
export const modal = {
  show(id) {
    const el = $(id);
    if (!el) return;
    el.classList.add('show');
    document.body.style.overflow = 'hidden';
  },

  hide(id) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('show');
    document.body.style.overflow = '';
  },

  toggle(id) {
    const el = $(id);
    if (!el) return;
    const willShow = !el.classList.contains('show');
    el.classList.toggle('show', willShow);
    document.body.style.overflow = willShow ? 'hidden' : '';
  },

  isOpen(id) {
    const el = $(id);
    return el?.classList.contains('show') || false;
  },
};

// ─────────────────────────────────────────────────────────────────────────
// LOADING OVERLAY (global loader)
// ─────────────────────────────────────────────────────────────────────────

let loaderEl = null;

export const loader = {
  show(message = 'Memuat...') {
    if (!loaderEl) {
      loaderEl = document.createElement('div');
      loaderEl.className = 'overlay';
      loaderEl.style.zIndex = 'var(--z-toast)';
      loaderEl.innerHTML = `
        <div style="text-align: center; color: var(--text);">
          <div class="spinner spinner-xl" style="color: var(--orange); margin: 0 auto 16px;"></div>
          <p class="loader-message" style="font-size: 14px; color: var(--muted);">Memuat...</p>
        </div>
      `;
      document.body.appendChild(loaderEl);
    }
    loaderEl.querySelector('.loader-message').textContent = message;
    loaderEl.classList.add('show');
  },

  hide() {
    loaderEl?.classList.remove('show');
  },

  update(message) {
    if (loaderEl) {
      loaderEl.querySelector('.loader-message').textContent = message;
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────
// GLOBAL KEYBOARD HANDLERS (ESC untuk close)
// ─────────────────────────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;

  // Priority: prompt > confirm > loader
  if (promptOverlay?.classList.contains('show')) {
    resolvePrompt(null);
    return;
  }

  if (confirmOverlay?.classList.contains('show')) {
    resolveConfirm(false);
    return;
  }

  if (loaderEl?.classList.contains('show')) {
    // Loader tidak bisa di-close via ESC (by design)
    return;
  }

  // Close any open modal
  document.querySelectorAll('.overlay.show, .sheet.show').forEach((el) => {
    if (el === loaderEl) return;
    el.classList.remove('show');
    document.body.style.overflow = '';
  });
});

// ─────────────────────────────────────────────────────────────────────────
// EXPORT DEFAULT
// ─────────────────────────────────────────────────────────────────────────

export default {
  toast,
  confirm,
  prompt,
  alert,
  modal,
  loader,
};
