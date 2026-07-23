/* ═══════════════════════════════════════════════════════════════════════
   CABANG PAGE — Status per Cabang
   ═══════════════════════════════════════════════════════════════════════ */

import { $, escapeHtml, formatRupiah } from '../../utils.js';
import { CABANG } from '../../config.js';

// ─────────────────────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────────────────────

export function renderCabangPage(state) {
  return `
    <header class="page-header">
      <h1>🏬 Status Cabang</h1>
      <p>Pantau aktivitas pesanan dari setiap cabang</p>
    </header>

    <div class="cabang-grid" id="cabangGrid">
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="spinner spinner-lg" style="color: var(--orange); margin-bottom: 12px;"></div>
        <p>Memuat data cabang...</p>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────
// UPDATE DATA
// ─────────────────────────────────────────────────────────────────────────

export function updateCabangData(state) {
  const container = $('cabangGrid');
  if (!container) return;

  container.innerHTML = Object.entries(CABANG).map(([id, info]) => {
    const branchOrders = state.allOrders.filter((o) => o.ID_CABANG === id);
    const pending = branchOrders.filter((o) => String(o.STATUS).toUpperCase() === 'PENDING').length;
    const approved = branchOrders.filter((o) => String(o.STATUS).toUpperCase() === 'APPROVED').length;
    const rejected = branchOrders.filter((o) => String(o.STATUS).toUpperCase() === 'REJECTED').length;

    return `
      <article class="cabang-card" data-cabang="${id}">
        <div class="cabang-card-header">
          <div class="cabang-avatar" style="background: linear-gradient(135deg, ${info.color}, ${info.color}dd);">
            ${info.icon}
          </div>
          <div style="min-width: 0; flex: 1;">
            <div class="cabang-name">${escapeHtml(info.nama)}</div>
            <div class="cabang-id">${id} · PIC: ${escapeHtml(info.pic)}</div>
          </div>
        </div>

        <div class="cabang-stats">
          <div class="cabang-stat">
            <div class="cabang-stat-val">${branchOrders.length}</div>
            <div class="cabang-stat-lbl">Total</div>
          </div>
          <div class="cabang-stat">
            <div class="cabang-stat-val" style="color: var(--warning);">${pending}</div>
            <div class="cabang-stat-lbl">Tertunda</div>
          </div>
          <div class="cabang-stat">
            <div class="cabang-stat-val" style="color: var(--success);">${approved}</div>
            <div class="cabang-stat-lbl">Disetujui</div>
          </div>
        </div>

        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line-soft); font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <span>📞 ${escapeHtml(info.telepon || '-')}</span>
          <span>❌ ${rejected} ditolak</span>
        </div>
      </article>
    `;
  }).join('');
}
