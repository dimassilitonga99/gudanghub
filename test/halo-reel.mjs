// RED check: HaloReel component exists with required API.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const p = new URL('../src/components/ui/halo-reel.tsx', import.meta.url);
assert.ok(existsSync(p), 'halo-reel.tsx must exist');

const src = readFileSync(p, 'utf8');
assert.match(src, /export function HaloReel/, 'must export HaloReel');
assert.match(src, /HaloReelItem/, 'must export HaloReelItem type');
assert.match(src, /items:\s*HaloReelItem\[\]/, 'must accept items prop');
assert.match(src, /autoPlay/, 'must support autoPlay prop');
assert.match(src, /draggable/, 'must support draggable prop');
assert.match(src, /centerLabel/, 'must support centerLabel prop');
assert.match(src, /from ["']framer-motion["']/, 'must use framer-motion');
assert.match(src, /useReducedMotion/, 'must respect reduced motion');
assert.match(src, /role="region"/, 'must expose carousel region role');
assert.match(src, /onFrontIndexChange/, 'must report front index to parent');
// Highlight must match the settled front card: report on animation settle
// (onComplete), not per-frame mid-spin, and scan all rendered slots.
assert.match(src, /onComplete/, 'must report front index on animation settle, not mid-spin');
assert.doesNotMatch(src, /rotation\.on\('change'/, 'must not report front index per animation frame');
console.log('halo-reel checks passed');
