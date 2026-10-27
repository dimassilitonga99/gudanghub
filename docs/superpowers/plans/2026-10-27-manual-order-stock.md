# Manual Order Stock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow manual order items with blank warehouse/store stock while keeping catalog stock validation intact.

**Architecture:** Normalize blank manual stock to `0` when adding or editing cart items. Exclude only `isManual` items from cart stock-required validation. Keep manual name, order quantity, and order unit required; blank item code remains `-`.

**Tech Stack:** React, TypeScript, Vite, Node assert source regression test.

**Spec:** `docs/superpowers/specs/2026-10-27-manual-order-stock-design.md`

## Global Constraints

- Manual blank stock is `0` and is not required.
- Manual name, order quantity, and order unit are required.
- Blank optional manual code is `-`.
- Catalog items still require warehouse and store stock.

## Review Focus

- Manual stock blank vs explicit zero; both persist as zero.
- Catalog stock missing; submit remains blocked.
- Manual required fields remain validated.
- Empty code keeps `-` display/payload.
- Existing scan-created manual items already supply zero stock.

---

### Task 1: Manual stock and cart validation

**Files:**
- Modify: `src/pages/Order.tsx`
- Modify: `test/ascii-sidebar-background.mjs` (existing source regression checks)

**Interfaces:** Consumes `CartItem.isManual`; preserve existing `addManualToCart` and `updateManualItem` callers and payload shape.

- [ ] Add regression assertions for blank manual stock normalization, manual-aware validation, required manual fields, and optional code fallback.
- [ ] Run `node test/ascii-sidebar-background.mjs`; confirm it fails on missing behavior.
- [ ] Implement: empty manual stock => `0`; required-stock validation counts only non-manual items; retain `-` fallback for empty code; keep name, positive quantity, and unit required.
- [ ] Run `node test/ascii-sidebar-background.mjs` and `npm run build`; confirm both pass.
