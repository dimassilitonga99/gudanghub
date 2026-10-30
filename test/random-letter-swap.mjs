// RED check: RandomLetterSwap component exists with required API + behavior.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const p = new URL('../src/components/ui/random-letter-swap.tsx', import.meta.url);
assert.ok(existsSync(p), 'random-letter-swap.tsx must exist');

const src = readFileSync(p, 'utf8');
assert.match(src, /export function RandomLetterSwap/, 'must export RandomLetterSwap');
assert.match(src, /label:\s*string/, 'must accept label prop');
assert.match(src, /staggerDuration/, 'must accept staggerDuration prop');
assert.match(src, /useReducedMotion|prefers-reduced-motion/, 'must respect reduced motion');
assert.match(src, /aria-label/, 'must expose accessible label');
assert.match(src, /onHoverStart|whileHover|onMouseEnter/, 'must react to hover');
assert.match(src, /motion/, 'must use motion for animation');
// Mask per-huruf harus setinggi 1 baris + geser setengah (1 baris):
// tanpa tinggi tetap kedua baris tampil ganda; y -100% dari inner 2-baris = hilang total.
assert.match(src, /1lh/, 'letter mask must be 1 line high');
assert.match(src, /'-50%'/, 'hover must shift exactly one line');
assert.doesNotMatch(src, /'-100%'/, 'must not shift full inner height');
// Baris inner harus setinggi line-height warisan (1lh), bukan leading-none:
// leading-none bikin baris 1em < mask 1lh → sisa baris kedua bocor/nyempil.
assert.doesNotMatch(src, /leading-none/, 'inner rows must not use leading-none');
console.log('random-letter-swap checks passed');
