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
console.log('print-scene checks passed');
