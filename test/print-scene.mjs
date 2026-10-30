// RED check: PrintScene overlay component exists with required API.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const p = new URL('../src/components/ui/print-scene.tsx', import.meta.url);
assert.ok(existsSync(p), 'print-scene.tsx must exist');

const src = readFileSync(p, 'utf8');
assert.match(src, /export function PrintScene/, 'must export PrintScene');
assert.match(src, /nomorOrder/, 'must accept nomorOrder prop');
assert.match(src, /tanggalText/, 'must accept tanggalText prop');
assert.match(src, /cabangText/, 'must accept cabangText prop');
assert.match(src, /onDone/, 'must accept onDone callback');
assert.match(src, /useReducedMotion|prefers-reduced-motion/, 'must respect reduced motion');
assert.match(src, /role="dialog"|aria-label/, 'must expose accessible label');
assert.match(src, /createPortal/, 'must portal overlay to document.body (outside dialog stacking)');
assert.match(src, /document\.body/, 'must portal overlay to document.body (outside dialog stacking)');
// Manual close: tombol X panggil onDone, tidak ada auto-onDone setelah animasi.
assert.doesNotMatch(src, /onAnimationComplete/, 'must not auto-close after animation (manual close only)');
assert.match(src, /aria-label="Tutup"|onClick=\{[^}]*onDone/, 'must have close button calling onDone');
assert.match(src, /Escape/, 'must close on Escape key');
console.log('print-scene checks passed');
