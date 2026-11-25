import assert from 'node:assert/strict';
import { P53DevelopmentalSelfModificationLab } from '../src/organism/developmental/P53DevelopmentalSelfModificationLab.ts';
import { migratePersistedOrganism, ORGANISM_STATE_SCHEMA } from '../src/organism/persistence/StateMigrations.ts';

const proposalInput = {
  tick: 12, at: 100, predictionError01: 0.78, selfPredictionError01: 0.7,
  uncertainty01: 0.8, novelty01: 0.5, attention01: 0.4, identityContinuity01: 0.92,
};
const testInput = {
  predictionError01: 0.3, selfPredictionError01: 0.2, uncertainty01: 0.2,
  identityContinuity01: 0.94, grounding01: 0.9, causalAlignment01: 0.9,
  // An agent-controlled scalar must never masquerade as independent holdout evidence.
  holdoutFactor01: 1,
};

{
  const lab = new P53DevelopmentalSelfModificationLab();
  const candidate = lab.propose(proposalInput);
  assert.ok(candidate, 'the test must create a bounded proposal');
  const preview = lab.test(candidate.id, testInput);
  assert.equal(preview?.status, 'preview-only', 'model-derived shadow scores are preview-only');
  assert.equal(preview?.holdout01, 0, 'no independent holdout evidence means holdout score stays zero');
  assert.equal(preview?.transfer01, 0, 'no independent transfer evidence means transfer score stays zero');
  assert.equal(preview?.improvement01, 0, 'no verified holdout means no confirmed improvement');
  const before = lab.snapshot().activeKnobProfile;
  const result = lab.promote(candidate.id, 101);
  assert.equal(result?.status, 'preview-only', 'preview-only candidates cannot be promoted');
  assert.deepEqual(lab.snapshot().activeKnobProfile, before, 'promotion rejection must not change any knob');
  assert.equal(lab.snapshot().promotions, 0);
}

{
  const lab = new P53DevelopmentalSelfModificationLab();
  const candidate = lab.propose(proposalInput);
  assert.ok(candidate);
  lab.reject(candidate.id, 'operator-rejected', 102);
  assert.equal(lab.promote(candidate.id, 103)?.status, 'rejected', 'promotion attempts must not erase a terminal rejection');
}

{
  const lab = new P53DevelopmentalSelfModificationLab();
  lab.periodic({ ...proposalInput, tick: 12, at: 100, grounding01: 1, causalAlignment01: 1 });
  for (let tick = 13; tick <= 60; tick += 1) {
    lab.periodic({ ...proposalInput, tick, at: 100 + tick, grounding01: 1, causalAlignment01: 1, identityContinuity01: 1 });
  }
  assert.equal(lab.snapshot().promotions, 0, 'repeated automatic cycles cannot self-authorize promotion');
  assert.deepEqual(lab.snapshot().activeKnobProfile, {
    exploration: 0.5, verification: 0.5, reflection: 0.5, attention: 0.5, prediction: 0.5,
  });
}

{
  const lab = new P53DevelopmentalSelfModificationLab();
  lab.restore({
    version: 2,
    promotions: 2,
    activeKnobProfile: { exploration: 0.9, verification: 0.1, reflection: 0.5, attention: 0.5, prediction: 0.5 },
    candidates: [{
      id: 'legacy-promotable', createdAt: 1, tick: 1, knob: 'exploration', delta: 0.08,
      reason: 'legacy', baseline01: 0.5, shadow01: 0.8, holdout01: 0.9,
      identityPreservation01: 0.95, stability01: 0.9, transfer01: 0.9,
      improvement01: 0.8, risk01: 0.01, evidenceCount: 2, status: 'promotable', lastAt: 2,
    }],
  });
  const restored = lab.snapshot();
  assert.equal(restored.candidates[0].status, 'preview-only');
  assert.deepEqual(restored.activeKnobProfile, {
    exploration: 0.5, verification: 0.5, reflection: 0.5, attention: 0.5, prediction: 0.5,
  });
  assert.equal(restored.promotions, 0);
  assert.equal(restored.quarantinedLegacyPromotions, 2);
  assert.equal(lab.promote('legacy-promotable', 3)?.status, 'preview-only');
}

{
  const migrated = migratePersistedOrganism({
    schemaVersion: ORGANISM_STATE_SCHEMA,
    state: {},
    facets: { advanced: { p53DevelopmentalSelfModification: {
      version: 2, promotions: 3,
      activeKnobProfile: { exploration: 0.95 },
      candidates: [{
        id: 'migration-promotable', createdAt: 1, tick: 1, knob: 'exploration', delta: 0.08,
        reason: 'legacy', baseline01: 0.5, shadow01: 0.8, holdout01: 0.9,
        identityPreservation01: 0.95, stability01: 0.9, transfer01: 0.9,
        improvement01: 0.8, risk01: 0.01, evidenceCount: 2, status: 'promotable', lastAt: 2,
      }],
    } } },
  });
  const migratedP53 = migrated.facets.advanced.p53DevelopmentalSelfModification;
  assert.equal(migratedP53.version, 3);
  assert.equal(migratedP53.promotions, 0);
  assert.equal(migratedP53.quarantinedLegacyPromotions, 3);
  assert.equal(migratedP53.candidates[0].status, 'preview-only');
  assert.equal(migratedP53.candidates[0].holdout01, 0);
  assert.equal(migratedP53.activeKnobProfile.exploration, 0.5);
}

console.log('P53 self-improvement fail-closed PASS');
