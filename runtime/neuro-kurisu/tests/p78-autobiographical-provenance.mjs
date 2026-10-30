import assert from 'node:assert/strict';
import { P78AutobiographicalSelfContinuity } from '../src/organism/developmental/P78AutobiographicalSelfContinuity.ts';

const p = new P78AutobiographicalSelfContinuity();
const empty = p.snapshot();
assert.equal(empty.samples, 0);
assert.equal(empty.verifiedOutcomeSamples, 0);
assert.equal(empty.selfAuthorship01, 0.5, 'no authorship evidence must remain neutral');

const legacy = p.observe([
  { tick: 1, at: 100, action: 'explore', outcome: 1, text: 'legacy outcome' },
  { tick: 2, at: 200, action: 'reflect', outcome: 0, text: 'legacy outcome' }
]);
assert.equal(legacy.verifiedOutcomeSamples, 0, 'legacy events cannot be silently promoted to verified evidence');
assert.equal(legacy.unverifiedOutcomeSamples, 2);
assert.equal(legacy.chapters, 0, 'unverified outcomes must not create autobiographical turning points');
assert.equal(legacy.selfAuthorship01, 0.5, 'unknown authorship must not inflate self-authorship');

const verifiedEvents = [
  { tick: 3, at: 300, action: 'explore', outcome: 0.1, evidenceStatus: 'verified-independent', evidenceRef: 'world-transition:episode-3', authorship: 'self-initiated', episodeId: 'episode-3' },
  { tick: 4, at: 400, action: 'verify', outcome: 0.9, evidenceStatus: 'verified-independent', evidenceRef: 'external-verification:episode-4', authorship: 'self-selected', episodeId: 'episode-4' },
  { tick: 5, at: 500, action: 'reflect', outcome: 0.5, evidenceStatus: 'verified-independent', evidenceRef: 'world-transition:episode-5', authorship: 'user-directed', episodeId: 'episode-5' }
];
const grounded = p.observe(verifiedEvents);
assert.equal(grounded.verifiedOutcomeSamples, 3);
assert.equal(grounded.authorshipEvidenceSamples, 3);
assert.ok(grounded.selfAuthorship01 > 0.5, 'explicit self-authored episodes may update self-authorship');
assert.ok(grounded.chapters >= 1, 'corroborated, provenance-bound episodes may form a turning point');

const afterDuplicate = p.observe(verifiedEvents);
assert.deepEqual(afterDuplicate, grounded, 'replaying the same observation window must be idempotent');

const modeOnlyChange = p.observe(verifiedEvents.map(e => ({ ...e, mode: 'reflective' })));
assert.equal(modeOnlyChange.samples, grounded.samples + verifiedEvents.length, 'mode changes must produce a distinct observation key');

const restored = new P78AutobiographicalSelfContinuity();
restored.restore(modeOnlyChange);
assert.deepEqual(restored.snapshot(), modeOnlyChange, 'autobiographical evidence counters must survive restore');
const nonAdjacentReplay = restored.observe([verifiedEvents[0]]);
assert.deepEqual(nonAdjacentReplay, modeOnlyChange, 'an older event replayed after newer events and a restart must remain idempotent');

const corrupted = new P78AutobiographicalSelfContinuity();
corrupted.restore({ ...modeOnlyChange, verifiedOutcomeSamples: -50, selfAuthorship01: 4 });
assert.equal(corrupted.snapshot().verifiedOutcomeSamples, 0);
assert.equal(corrupted.snapshot().selfAuthorship01, 1);

const normalized = new P78AutobiographicalSelfContinuity();
const normalizedFirst = normalized.observe([
  { tick: 40, at: 4000, action: 'reflect', text: 'alpha\t beta' }
]);
const normalizedReplay = normalized.observe([
  { tick: 40, at: 4000, action: 'reflect', text: 'alpha beta' }
]);
assert.deepEqual(normalizedReplay, normalizedFirst, 'whitespace normalization must make equivalent event keys idempotent');

const malformedEvidence = new P78AutobiographicalSelfContinuity().observe([
  { tick: 41, at: 4100, action: 'verify', outcome: 1, evidenceStatus: 'verified-independent', evidenceRef: 'world-transition:bad receipt' }
]);
assert.equal(malformedEvidence.verifiedOutcomeSamples, 0, 'evidence references containing whitespace are not bound receipts');
assert.equal(malformedEvidence.unverifiedOutcomeSamples, 1);
console.log('P78_AUTOBIOGRAPHICAL_PROVENANCE=PASS');
