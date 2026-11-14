import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdentityContinuityGuard } from '../src/organism/system/IdentityContinuityGuard.ts';
import { P71SelfConsistencyModel } from '../src/organism/cognition/P71SelfConsistencyModel.ts';
import { P76IdentityLifeOS } from '../src/organism/system/P76IdentityLifeOS.ts';
import { P78AutobiographicalSelfContinuity } from '../src/organism/developmental/P78AutobiographicalSelfContinuity.ts';
import { P80UnifiedSelfState } from '../src/organism/cognition/P80UnifiedSelfState.ts';
import { P84AutobiographicalContinuityFabric } from '../src/organism/developmental/P84AutobiographicalContinuityFabric.ts';

const owners = [
  { name: 'identity continuity guard', create: () => new IdentityContinuityGuard(), key: 'checks' },
  { name: 'P71 self consistency', create: () => new P71SelfConsistencyModel(), key: 'cycles' },
  { name: 'P76 identity life OS', create: () => new P76IdentityLifeOS(), key: 'samples' },
  { name: 'P78 autobiographical continuity', create: () => new P78AutobiographicalSelfContinuity(), key: 'chapters' },
  { name: 'P80 unified self state', create: () => new P80UnifiedSelfState(), key: 'cycles' },
  { name: 'P84 autobiographical continuity fabric', create: () => new P84AutobiographicalContinuityFabric(), key: 'actionOutcomeProfiles' },
];

function accessorSnapshot(key) {
  return Object.defineProperty({}, key, {
    enumerable: true,
    get() { throw new Error('persisted-getter-must-not-execute'); },
  });
}

test('identity-state restore never executes persisted getters and falls back to owner defaults', () => {
  for (const owner of owners) {
    const model = owner.create();
    assert.doesNotThrow(
      () => model.restore(accessorSnapshot(owner.key)),
      owner.name + ' must reject accessor-backed snapshots without throwing',
    );
    assert.deepEqual(
      model.snapshot(),
      owner.create().snapshot(),
      owner.name + ' must not retain values from an accessor-backed snapshot',
    );
  }
});

test('identity-state restore rejects revoked proxies without leaving partially restored state', () => {
  for (const owner of owners) {
    const model = owner.create();
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    assert.doesNotThrow(
      () => model.restore(revoked.proxy),
      owner.name + ' must fail closed for a revoked persisted proxy',
    );
    assert.deepEqual(
      model.snapshot(),
      owner.create().snapshot(),
      owner.name + ' must retain defaults after a revoked proxy',
    );
  }
});

test('identity-state restore normalizes hostile counters, metrics, histories, and enum values', () => {
  const guard = new IdentityContinuityGuard();
  guard.restore({
    version: 1, checks: -4, stable: 900, rejected: -1, revisionWindows: 80,
    meanContinuity01: 4, meanBoundarySafety01: -3, lastReason: 'x'.repeat(500), lastAt: -1,
  });
  const g = guard.snapshot();
  assert.equal(g.checks, 0);
  assert.equal(g.stable, 0);
  assert.equal(g.rejected, 0);
  assert.equal(g.revisionWindows, 0);
  assert.equal(g.meanContinuity01, 1);
  assert.equal(g.meanBoundarySafety01, 0);
  assert.ok(g.lastReason.length <= 96);
  assert.equal(g.lastAt, 0);

  const p71 = new P71SelfConsistencyModel();
  p71.restore({
    version: 1, cycles: -1, meanConsistency01: 2, identityDrift01: -2,
    goalConflict01: 3, valueConflict01: 0.2, actionMismatch01: 0.4,
    repairPressure01: 8, lastReason: 'arbitrary-reason',
    history: [{ tick: -1, consistency01: 4, repairPressure01: 2, reason: 'invalid' }],
  });
  const p71State = p71.snapshot();
  assert.equal(p71State.cycles, 0);
  assert.equal(p71State.meanConsistency01, 1);
  assert.equal(p71State.identityDrift01, 0);
  assert.equal(p71State.goalConflict01, 1);
  assert.equal(p71State.repairPressure01, 1);
  assert.equal(p71State.lastReason, 'bootstrap');
  assert.deepEqual(p71State.history, []);

  const p76 = new P76IdentityLifeOS();
  p76.restore({
    version: 1, samples: -3, continuity01: 1.4, drift01: -1,
    conservation01: 2, narrativeContinuity01: 0.5, relationshipContinuity01: 0.5,
    goalContinuity01: 0.5, protectedViolations: -1,
    recentEvents: [{ tick: -2, kind: 'bad', delta01: 4 }],
  });
  const p76State = p76.snapshot();
  assert.equal(p76State.samples, 0);
  assert.equal(p76State.continuity01, 1);
  assert.equal(p76State.drift01, 0);
  assert.equal(p76State.conservation01, 1);
  assert.equal(p76State.protectedViolations, 0);
  assert.deepEqual(p76State.recentEvents, []);

  const p78 = new P78AutobiographicalSelfContinuity();
  p78.restore({
    version: 2, chapters: -2, samples: 4, continuity01: 2,
    narrativeCoherence01: -1, selfAuthorship01: 0.6, turningPoints: -7,
    recentSummary: 's'.repeat(1000),
    chaptersData: [{ id: 'bad', fromTick: 9, toTick: 2, summary: 'invalid', significance01: 5 }],
    lastObservationKey: 'k'.repeat(5000),
  });
  const p78State = p78.snapshot();
  assert.equal(p78State.chapters, 0);
  assert.equal(p78State.samples, 4);
  assert.equal(p78State.continuity01, 1);
  assert.equal(p78State.narrativeCoherence01, 0);
  assert.equal(p78State.turningPoints, 0);
  assert.ok(p78State.recentSummary.length <= 320);
  assert.deepEqual(p78State.chaptersData, []);
  assert.ok(p78State.lastObservationKey.length <= 4096);

  const p80 = new P80UnifiedSelfState();
  p80.restore({
    version: 1, cycles: -1, continuity01: 3, coherence01: -1, agency01: 0.5,
    realityAlignment01: 0.7, currentMode: 'unknown', recentModes: ['invalid', 'explore'],
    recentActions: [null, 'explore', 'x'.repeat(200)], modeStreak: -1,
    noveltyPressure01: 2, lastTick: -4, lastAction: 'a'.repeat(200), lastReason: 'r'.repeat(1000),
  });
  const p80State = p80.snapshot();
  assert.equal(p80State.cycles, 0);
  assert.equal(p80State.continuity01, 1);
  assert.equal(p80State.coherence01, 0);
  assert.equal(p80State.currentMode, 'wait');
  assert.deepEqual(p80State.recentModes, ['explore']);
  assert.deepEqual(p80State.recentActions, ['explore']);
  assert.equal(p80State.modeStreak, 0);
  assert.equal(p80State.noveltyPressure01, 1);
  assert.equal(p80State.lastTick, 0);
  assert.equal(p80State.lastAction.length, 64);
  assert.ok(p80State.lastReason.length <= 160);

  const p84 = new P84AutobiographicalContinuityFabric();
  p84.restore({
    version: 5, revision: -1, moments: [null, { id: 'broken' }],
    lifeContinuity01: 2, causalContinuity01: -2, autobiographicalIntegrity01: 4,
    lastTick: -1, lastRealityHash: 'h'.repeat(100), lastMomentId: 'm'.repeat(200),
    transitionCount: -1, identityChangeCount: -1, selfChangeLoad01: 3, memoryBinding01: -3,
    actionOutcomeProfiles: { explore: { samples: -2, verifiedSamples: 20, success01: 2, confidence01: -1, lastAt: -4, lastEvidence01: 7 } },
    contextualOutcomeProfiles: {}, beliefContinuity01: 2, socialBinding01: -1,
    carryoverRevision: -1, developmentalConsequences: [null, { tick: -2 }],
    processedIngestKeys: ['ok', '', 'x'.repeat(181)], processedOutcomeEvidenceIds: [null, 'valid'],
  });
  const p84State = p84.snapshot();
  assert.equal(p84State.revision, 0);
  assert.equal(p84State.lifeContinuity01, 1);
  assert.equal(p84State.causalContinuity01, 0);
  assert.equal(p84State.autobiographicalIntegrity01, 1);
  assert.equal(p84State.lastTick, 0);
  assert.ok(p84State.lastRealityHash.length <= 40);
  assert.ok(p84State.lastMomentId.length <= 96);
  assert.equal(p84State.transitionCount, 0);
  assert.equal(p84State.identityChangeCount, 0);
  assert.equal(p84State.selfChangeLoad01, 1);
  assert.equal(p84State.memoryBinding01, 0);
  assert.equal(p84State.actionOutcomeProfiles.explore.samples, 0);
  assert.equal(p84State.actionOutcomeProfiles.explore.verifiedSamples, 0);
  assert.equal(p84State.actionOutcomeProfiles.explore.success01, 1);
  assert.equal(p84State.actionOutcomeProfiles.explore.confidence01, 0);
  assert.equal(p84State.actionOutcomeProfiles.explore.lastAt, 0);
  assert.equal(p84State.actionOutcomeProfiles.explore.lastEvidence01, 1);
  assert.equal(p84State.beliefContinuity01, 1);
  assert.equal(p84State.socialBinding01, 0);
  assert.equal(p84State.carryoverRevision, 0);
  assert.deepEqual(p84State.moments, []);
  assert.deepEqual(p84State.developmentalConsequences, []);
  assert.deepEqual(p84State.processedIngestKeys, ['ok']);
  assert.deepEqual(p84State.processedOutcomeEvidenceIds, ['valid']);
});

test('valid identity snapshots survive the normal snapshot and restore round trip', () => {
  const guard = new IdentityContinuityGuard();
  guard.evaluate({ at: 10, identity01: .9, valueStability01: .8, narrative01: .7, projectContinuity01: .6, externalPressure01: .1, proposedRevision01: .7, verifiedEvidence01: .9 });
  const guardCopy = new IdentityContinuityGuard();
  guardCopy.restore(guard.snapshot());
  assert.deepEqual(guardCopy.snapshot(), guard.snapshot());

  const p71 = new P71SelfConsistencyModel();
  p71.evaluate({ tick: 1, identity01: .9, identityDrift01: .1, goalConflict01: .2, valueConflict01: .1, chosenAction: 'explore', mode: 'balanced', goalPressure01: .3, realityGap01: .1 });
  const p71Copy = new P71SelfConsistencyModel();
  p71Copy.restore(p71.snapshot());
  assert.deepEqual(p71Copy.snapshot(), p71.snapshot());

  const p76 = new P76IdentityLifeOS();
  p76.observe({ tick: 1, identity01: .9, drift01: .1, valueContinuity01: .8, memoryContinuity01: .8, authoredContinuity01: .7, relationshipContinuity01: .6, goalContinuity01: .7, contradiction01: .1 });
  const p76Copy = new P76IdentityLifeOS();
  p76Copy.restore(p76.snapshot());
  assert.deepEqual(p76Copy.snapshot(), p76.snapshot());

  const p78 = new P78AutobiographicalSelfContinuity();
  p78.observe([{ at: 1, tick: 1, action: 'explore', outcome: .8, text: 'observed-world', mode: 'active' }]);
  const p78Copy = new P78AutobiographicalSelfContinuity();
  p78Copy.restore(p78.snapshot());
  assert.deepEqual(p78Copy.snapshot(), p78.snapshot());

  const p80 = new P80UnifiedSelfState();
  p80.update({ tick: 1, mode: 'explore', identity01: .9, memoryContinuity01: .8, realityGap01: .1, predictionError01: .2, uncertainty01: .2, energy01: .8, cognitiveCapacity01: .8, goalPressure01: .3, grounding01: .8, causal01: .7, workspace01: .8, action: 'explore', actionScore01: .8, externalInput: false, novelty01: .4 });
  const p80Copy = new P80UnifiedSelfState();
  p80Copy.restore(p80.snapshot());
  assert.deepEqual(p80Copy.snapshot(), p80.snapshot());

  const p84 = new P84AutobiographicalContinuityFabric();
  p84.ingest({ tick: 1, at: 10, action: 'explore', outcome01: .8, realityHash: 'world-1', realityRevision: 1, identity01: .9, authorship01: .8, evidenceIds: ['ev-1'], observationIds: ['obs-1'], activeGoalIds: ['goal-1'] });
  const p84Copy = new P84AutobiographicalContinuityFabric();
  p84Copy.restore(p84.snapshot());
  assert.deepEqual(p84Copy.snapshot(), p84.snapshot());
});
