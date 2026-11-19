import assert from 'node:assert/strict';
import { SkillAcquisitionBenchmark } from '../src/organism/system/SkillAcquisitionBenchmark.ts';

const b = new SkillAcquisitionBenchmark();
assert.equal(b.summary().holdoutEligible, false, 'no holdout observations means no evidence of learning gain');
const implicit = b.observe({ action: 'a', contextKey: 'new task', outcome01: 1 });
assert.equal(implicit.phase, 'learning', 'implicit sample ordering must not fabricate a holdout split');
assert.equal(implicit.holdoutEvidenceAccepted, false);
b.observe({ action: 'a', contextKey: 'baseline-1', outcome01: 0.2, phase: 'baseline' });
const accepted1 = b.observe({ action: 'a', contextKey: 'holdout-1', outcome01: 0.9, phase: 'holdout' });
assert.equal(accepted1.holdoutEvidenceAccepted, true);
assert.equal(b.summary().holdoutEligible, false, 'one context is not an adequate independent holdout');
assert.equal(b.summary().gain01, 0, 'a provisional holdout must not produce a learning-gain score');
const accepted2 = b.observe({ action: 'a', contextKey: 'holdout-2', outcome01: 0.8, phase: 'holdout' });
const accepted3 = b.observe({ action: 'a', contextKey: 'holdout-3', outcome01: 0.7, phase: 'holdout' });
assert.equal(accepted2.holdoutEvidenceAccepted, true);
assert.equal(accepted3.holdoutEvidenceAccepted, true);
assert.equal(b.summary().holdoutEligible, true, 'eligibility requires three unique holdout contexts');
const beforeDuplicate = b.snapshot().holdoutMean01;
const duplicate = b.observe({ action: 'a', contextKey: 'holdout-3', outcome01: 0, phase: 'holdout' });
assert.equal(duplicate.holdoutEvidenceAccepted, false, 'repeated context is not independent holdout evidence');
assert.equal(b.snapshot().holdoutMean01, beforeDuplicate, 'duplicate holdout observations cannot alter the estimate');
assert.equal(b.summary().acceptedHoldoutSamples, 3, 'duplicate contexts must not inflate the independent sample count');
const before = b.snapshot().holdoutMean01;
const leaked = b.observe({ action: 'a', contextKey: 'baseline-1', outcome01: 1, phase: 'holdout' });
assert.equal(leaked.holdoutEvidenceAccepted, false, 'a training context cannot become holdout evidence');
assert.equal(b.snapshot().holdoutMean01, before, 'contaminated holdout must not update the holdout estimate');
assert.equal(b.summary().holdoutEligible, false);
assert.equal(b.summary().gain01, 0, 'contamination must erase the derived gain score');
const reused = b.observe({ action: 'a', contextKey: 'holdout-1', outcome01: 0.8, phase: 'learning' });
assert.equal(reused.holdoutEvidenceAccepted, false, 'holdout context cannot be reused as training evidence');
const restored = new SkillAcquisitionBenchmark();
restored.restore(b.snapshot());
assert.equal(restored.summary().holdoutEligible, false, 'contamination state must survive restore');
assert.equal(restored.summary().acceptedHoldoutSamples, 3);

const legacy = new SkillAcquisitionBenchmark();
legacy.restore({ version: 1, samples: 4, tasks: 2, baselineMean01: 0.4, holdoutMean01: 0.7, gain01: 0.2, novelContexts: 3, recent: [], lastAt: 1 });
assert.equal(legacy.observe({ action: 'legacy', contextKey: 'x', outcome01: 0.5 }).phase, 'learning', 'legacy snapshots remain readable');
assert.equal(legacy.summary().gain01, 0, 'legacy cached gain is cleared when independent context provenance is absent');

const hostile = new SkillAcquisitionBenchmark();
const proto = hostile.observe({ action: 'a', contextKey: '__proto__', outcome01: 0.9, phase: 'holdout' });
assert.equal(proto.holdoutEvidenceAccepted, true, 'prototype-named contexts are ordinary explicit keys');
assert.equal(Object.hasOwn(hostile.snapshot().contextPhaseByKey, '__proto__'), true, 'prototype-named context must be stored as an own property');
const empty = new SkillAcquisitionBenchmark();
assert.equal(empty.observe({ action: 'a', contextKey: '   ', outcome01: 1, phase: 'holdout' }).holdoutEvidenceAccepted, false, 'empty context cannot be independent holdout evidence');
assert.equal(empty.summary().holdoutEligible, false);

// Snapshot restore must not execute getters and must fail closed if evidence metadata is accessor-backed.
const qualified = new SkillAcquisitionBenchmark();
for (let i = 0; i < 3; i += 1) qualified.observe({ action: 'q', contextKey: 'qualified-' + i, outcome01: 0.8, phase: 'holdout' });
const qualifiedRoundTrip = new SkillAcquisitionBenchmark();
qualifiedRoundTrip.restore(qualified.snapshot());
assert.equal(qualifiedRoundTrip.summary().holdoutEligible, true, 'valid snapshots preserve the computed split state');
assert.equal(qualifiedRoundTrip.summary().acceptedHoldoutSamples, 3);
const getterSnapshot = qualified.snapshot();
let getterCalled = false;
Object.defineProperty(getterSnapshot, 'contaminatedHoldoutSamples', {
  enumerable: true,
  get() { getterCalled = true; return 0; },
});
const accessorRestore = new SkillAcquisitionBenchmark();
accessorRestore.restore(getterSnapshot);
assert.equal(getterCalled, false, 'root accessors must not execute during restore');
assert.equal(accessorRestore.summary().holdoutEligible, false, 'accessor-backed evidence metadata must fail closed');

const nestedSnapshot = qualified.snapshot();
let nestedGetterCalled = false;
Object.defineProperty(nestedSnapshot.contextPhaseByKey, 'forged-holdout', {
  enumerable: true,
  get() { nestedGetterCalled = true; return 'holdout'; },
});
const nestedRestore = new SkillAcquisitionBenchmark();
nestedRestore.restore(nestedSnapshot);
assert.equal(nestedGetterCalled, false, 'registry accessors must not execute during restore');
assert.equal(nestedRestore.summary().holdoutEligible, false, 'accessor-backed registry entries must fail closed');

// A truncated context key would merge different conversations. Reject it instead of truncating.
const collision = new SkillAcquisitionBenchmark();
const sharedPrefix = 'x'.repeat(160);
assert.equal(collision.observe({ action: 'a', contextKey: sharedPrefix + '-one', outcome01: 1, phase: 'holdout' }).holdoutEvidenceAccepted, false);
assert.equal(collision.observe({ action: 'a', contextKey: sharedPrefix + '-two', outcome01: 1, phase: 'holdout' }).holdoutEvidenceAccepted, false);
assert.equal(collision.summary().holdoutEligible, false);

// Normalization is deterministic and repeated normalized keys cannot inflate independence.
const normalized = new SkillAcquisitionBenchmark();
assert.equal(normalized.observe({ action: 'a', contextKey: 'Ａ', outcome01: 0.8, phase: 'holdout' }).holdoutEvidenceAccepted, true);
assert.equal(normalized.observe({ action: 'a', contextKey: 'a', outcome01: 0.1, phase: 'holdout' }).holdoutEvidenceAccepted, false);
assert.equal(normalized.summary().acceptedHoldoutSamples, 1);

// Novel-context accounting comes from the durable registry, not the lossy recent-128 window.
const novelty = new SkillAcquisitionBenchmark();
for (let i = 0; i < 140; i += 1) novelty.observe({ action: 'a', contextKey: 'context-' + i, outcome01: 0.5 });
const noveltyBeforeReplay = novelty.summary().novelContexts;
novelty.observe({ action: 'a', contextKey: 'context-0', outcome01: 0.5 });
assert.equal(novelty.summary().novelContexts, noveltyBeforeReplay, 'replay outside recent-128 must not be counted as novel');

// Malformed snapshot counters and claimed counts are not trusted as independent evidence.
const forged = qualified.snapshot();
forged.acceptedHoldoutSamples = 999;
forged.contaminatedHoldoutSamples = -1;
const forgedRestore = new SkillAcquisitionBenchmark();
forgedRestore.restore(forged);
assert.equal(forgedRestore.summary().acceptedHoldoutSamples, 3, 'accepted count is recomputed from unique registry entries');
assert.equal(forgedRestore.summary().holdoutEligible, false, 'malformed evidence counters disable eligibility');
assert.equal(forgedRestore.summary().gain01, 0);

// Registry overflow fails closed and cannot admit fresh holdout keys.
const saturated = new SkillAcquisitionBenchmark();
for (let i = 0; i < 4096; i += 1) saturated.observe({ action: 'a', contextKey: 'registry-' + i, outcome01: 0.5 });
const overflow = saturated.observe({ action: 'a', contextKey: 'registry-overflow', outcome01: 0.9, phase: 'holdout' });
assert.equal(overflow.holdoutEvidenceAccepted, false);
assert.equal(saturated.summary().contextRegistrySaturated, true);
assert.equal(saturated.summary().holdoutEligible, false);

console.log('SkillAcquisitionBenchmark learning-split integrity: PASS');
