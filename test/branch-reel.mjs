// RED check: BranchReel wrapper exists with branch data + login links.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const p = new URL('../src/components/landing/branch-reel.tsx', import.meta.url);
assert.ok(existsSync(p), 'branch-reel.tsx must exist');

const src = readFileSync(p, 'utf8');
assert.match(src, /export function BranchReel/, 'must export BranchReel');
assert.match(src, /CABANG_LIST/, 'must use CABANG_LIST branch data');
assert.match(src, /HaloReel/, 'must use HaloReel');
assert.match(src, /\/login\?branch=/, 'must link to login with branch param');
assert.match(src, /pic/i, 'must show branch PIC');
assert.match(src, /prefers-reduced-motion|useReducedMotion|reduceMotion/, 'must handle reduced motion statically');
console.log('branch-reel checks passed');
