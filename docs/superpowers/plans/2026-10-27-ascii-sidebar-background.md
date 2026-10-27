# ASCII Sidebar Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the provided looping ASCII video behind the existing desktop dashboard sidebar content.

**Architecture:** Add a dependency-free reusable video component in the shadcn UI directory, then mount it as the first absolute layer inside the existing sidebar. Add a contrast overlay and reduced-motion poster fallback; preserve all sidebar content and behavior.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, CSS in `src/index.css`.

**Spec:** `docs/superpowers/specs/2026-10-27-sidebar-animated-background-design.md`

## Global Constraints
- Do not change Vite `base` from `/`.
- Preserve all existing sidebar menus, text, role badge, collapse controls, and logout.
- Use only the provided video/poster URLs; add no dependency or unrelated assets.
- Desktop sidebar only; mobile navigation unchanged.
- Respect `prefers-reduced-motion` by showing a static poster instead of animated video.

## Review Focus
- Video stays behind all existing sidebar controls and does not capture pointer input: assert component layer class includes `pointer-events-none` and sidebar content stays `relative z-10`.
- Reduced-motion users receive a static visual: assert CSS media rule hides video and shows poster layer.
- Existing menu/content survives: assert nav and existing labels remain in `AppShell.tsx`.
- Responsive scope stays desktop only: assert animated layer lives only inside the desktop `<aside>` and existing mobile header/nav is untouched.
- Build resolves strict TypeScript and URL component: `npm run build`.

---

### Task 1: Add reusable ASCII video component and mount it in sidebar

**Files:**
- Create: `src/components/ui/vignette-bloom.tsx`
- Modify: `src/components/layout/AppShell.tsx`
- Modify: `src/index.css`
- Verify: `npm run build`

**Interfaces:**
- Produces `AsciiArt({ className }: { className?: string }): JSX.Element` from `@/components/ui/vignette-bloom`.
- Consumes the existing desktop `<aside>` in `AppShell`.

- [ ] Add a focused assert-based source check that confirms the provided URLs and video props, accessibility label, pointer-safe class, poster reduced-motion fallback, and unchanged key sidebar labels/menu structure.
- [ ] Run the check; expect failure because component/integration do not yet exist.
- [ ] Implement the component with exact video and poster URLs, autoplay/loop/muted/playsInline, aria-label, and caller className. Provide a poster `<img>` fallback for reduced motion.
- [ ] Add an absolute inset background wrapper as the first child of desktop `<aside>`; add a dark overlay and keep existing sidebar content above it without moving/removing menu items.
- [ ] Add CSS reduced-motion rule to hide the video and show poster.
- [ ] Re-run source check; expect PASS.
- [ ] Run `npm run build`; expect successful Vite build and service-worker copy.
