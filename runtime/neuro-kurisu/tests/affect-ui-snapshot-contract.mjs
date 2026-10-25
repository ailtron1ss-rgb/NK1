import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rootPath = new URL('../../../', import.meta.url);
const read = (relative) => readFile(new URL(relative, rootPath), 'utf8');
const [server, apiTypes, normalize, avatar, embodiment] = await Promise.all([
  read('runtime/neuro-kurisu/src/server/server.mjs'),
  read('app/src/neuro-kurisu/types.ts'),
  read('app/src/neuro-kurisu/normalize.ts'),
  read('app/src/components/AvatarStage.tsx'),
  read('app/src/components/avatar/embodimentTimeline.ts'),
]);

assert.match(server, /emotionAppraisalSnapshot\?\.\(\)/,
  'UI snapshot must read the persisted canonical affect engine');
assert.match(server, /affect:\s*\{\s*mood:/s,
  'UI response must expose the compact mood projection');
assert.match(server, /latestFeeling:\s*latestFeeling\s*\?/,
  'UI response must expose the latest feeling-access episode');
assert.match(apiTypes, /affect\?: EmotionAffectSnapshot/,
  'backend UI contract must preserve affect data without breaking old snapshots');
assert.match(normalize, /const rawMood = remote\.affect\?\.mood/,
  'normalization must read the canonical mood payload');
assert.match(normalize, /const rawFeeling = remote\.affect\?\.latestFeeling/,
  'normalization must read the canonical feeling payload');
assert.match(normalize, /^\s+affect,$/m,
  'normalized organism snapshot must retain affect data');
assert.match(avatar, /const mood = snap\.affect\?\.mood/,
  'avatar presentation must consume persistent mood through its shared signal projection');
assert.match(avatar, /feelingFreshness01,/,
  'avatar presentation must time-bound feeling influence');
assert.match(embodiment, /const feelingFreshness = input\.feeling/,
  'embodiment mapper must gate feeling influence by freshness');
assert.match(embodiment, /feelingMismatch \* 0\.35/,
  'interoceptive mismatch must attenuate feeling-driven presentation');

console.log('Affect UI snapshot contract: PASS');

// Keep this contract focused on observable data flow, not a single JSX/object-literal spelling.
