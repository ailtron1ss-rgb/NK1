import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const core = await readFile(new URL('../src/organism/core/OrganismCore.ts', import.meta.url), 'utf8');
const p23 = await readFile(new URL('../src/organism/learning/P23LearningEngine.ts', import.meta.url), 'utf8');
assert.match(core, /p23Learning\.recordExperience\(trace, state, \{ success: gatedSuccess01, reward: gatedReward01, surprise: gatedSurprise01, notes: outcome\.notes \}/,
  'the core feedback reason must flow into the same canonical P23 experience record');
assert.match(p23, /classifyLearningFailureReason\(outcome\.notes\)/,
  'P23 must classify bounded feedback notes before constructing the persisted learning experience');
assert.match(p23, /failureClass:e\.failureClass/,
  'the compact reason class must be projected into the reflection curriculum');
console.log('p23-reflection-reason-runtime-wiring: ok');
