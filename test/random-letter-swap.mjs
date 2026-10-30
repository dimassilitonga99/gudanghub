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
console.log('random-letter-swap checks passed');
