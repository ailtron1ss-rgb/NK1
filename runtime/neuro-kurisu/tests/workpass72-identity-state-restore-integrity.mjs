import assert from 'node:assert/strict';
import { P80UnifiedSelfState, defaultP80 } from '../src/organism/cognition/P80UnifiedSelfState.ts';
import { P76IdentityLifeOS, defaultP76 } from '../src/organism/system/P76IdentityLifeOS.ts';
import { P78AutobiographicalSelfContinuity, defaultP78 } from '../src/organism/developmental/P78AutobiographicalSelfContinuity.ts';

/**
 * WorkPass72 — identity-state restore integrity for the autobiographical /
 * unified-self owners. Each previously spread the persisted snapshot straight
 * into live state; every one of them feeds at least one multiplicative EMA, so a
 * single NaN in a snapshot poisons the identity scalar permanently, and a hostile
 * accessor threw out of restore.
 */

const finite = (v, label) => assert.ok(Number.isFinite(v), `${label} must stay finite`);

// --- P80UnifiedSelfState ---------------------------------------------------
{
  const s = new P80UnifiedSelfState();
  const d = defaultP80();
  s.restore({
    version: 1, cycles: NaN, continuity01: NaN, coherence01: Infinity, agency01: -3,
    realityAlignment01: 42, currentMode: 'not-a-mode', recentModes: ['explore', 'bogus', 7, null],
    recentActions: ['respond', 5, null], modeStreak: -2, noveltyPressure01: NaN, lastTick: -1,
    lastAction: 9, lastReason: {},
  });
  const st = s.snapshot();
  finite(st.continuity01, 'P80.continuity01');
  assert.equal(st.continuity01, d.continuity01, 'P80 NaN continuity falls back to default');
  finite(st.coherence01, 'P80.coherence01');
  assert.ok(st.coherence01 <= 1, 'P80 coherence clamped');
  assert.equal(st.agency01, 0, 'P80 negative agency clamps to 0');
  assert.equal(st.currentMode, d.currentMode, 'P80 unknown mode falls back');
  assert.deepEqual(st.recentModes, ['explore'], 'P80 recentModes filters unknown/non-string');
  assert.deepEqual(st.recentActions, ['respond'], 'P80 recentActions filters non-strings');
  assert.equal(st.modeStreak, 0, 'P80 negative streak clamps to 0');
  finite(st.noveltyPressure01, 'P80.noveltyPressure01');
  // EMA stays finite after a poisoned restore + update.
  s.update({ tick: 1, mode: 'explore', identity01: .8, memoryContinuity01: .8, realityGap01: .2, predictionError01: .2, uncertainty01: .3, energy01: .8, cognitiveCapacity01: .8, goalPressure01: .4, grounding01: .7, causal01: .6, workspace01: .6, action: 'explore', actionScore01: .7, externalInput: false, novelty01: .5 });
  finite(s.snapshot().continuity01, 'P80 EMA after poisoned restore');
  // Hostile accessor must not throw.
  assert.doesNotThrow(() => s.restore({ get continuity01() { throw new Error('hostile'); } }));
  // Valid round-trip.
  const valid = { version: 1, cycles: 3, continuity01: .5, coherence01: .6, agency01: .7, realityAlignment01: .8, currentMode: 'verify', recentModes: ['verify', 'explore'], recentActions: ['verify'], modeStreak: 2, noveltyPressure01: .3, lastTick: 9, lastAction: 'verify', lastReason: 'ok' };
  s.restore(valid);
  assert.deepEqual(s.snapshot(), valid, 'P80 valid snapshot round-trips');
}

// --- P76IdentityLifeOS -----------------------------------------------------
{
  const s = new P76IdentityLifeOS();
  const d = defaultP76();
  s.restore({ version: 1, samples: NaN, continuity01: NaN, drift01: Infinity, conservation01: -1, narrativeContinuity01: 5, relationshipContinuity01: NaN, goalContinuity01: NaN, protectedViolations: -4, recentEvents: [{ tick: -1, kind: 'stable', delta01: NaN }, 'x', { kind: 5 }] });
  const st = s.snapshot();
  finite(st.continuity01, 'P76.continuity01');
  assert.equal(st.continuity01, d.continuity01, 'P76 NaN continuity falls back');
  finite(st.drift01, 'P76.drift01');
  assert.equal(st.conservation01, 0, 'P76 negative conservation clamps');
  assert.equal(st.samples, 0, 'P76 NaN samples falls back to 0');
  assert.equal(st.protectedViolations, 0, 'P76 negative violations clamps');
  assert.equal(st.recentEvents.length, 1, 'P76 filters non-object events');
  assert.equal(st.recentEvents[0].tick, 0, 'P76 negative event tick clamps');
  finite(st.recentEvents[0].delta01, 'P76 event delta');
  assert.doesNotThrow(() => s.restore({ get continuity01() { throw new Error('hostile'); } }));
  const valid = { version: 1, samples: 4, continuity01: .7, drift01: .1, conservation01: .8, narrativeContinuity01: .6, relationshipContinuity01: .6, goalContinuity01: .5, protectedViolations: 1, recentEvents: [{ tick: 2, kind: 'stable', delta01: .1 }] };
  s.restore(valid);
  assert.deepEqual(s.snapshot(), valid, 'P76 valid snapshot round-trips');
}

// --- P78AutobiographicalSelfContinuity -------------------------------------
{
  const s = new P78AutobiographicalSelfContinuity();
  const d = defaultP78();
  s.restore({ version: 2, chapters: NaN, samples: NaN, continuity01: NaN, narrativeCoherence01: Infinity, selfAuthorship01: -2, turningPoints: -1, recentSummary: 5, chaptersData: [{ id: 'c1', fromTick: -5, toTick: NaN, summary: 'ok', significance01: NaN }, { noId: true }, 'x'], lastObservationKey: 7 });
  const st = s.snapshot();
  finite(st.continuity01, 'P78.continuity01');
  assert.equal(st.continuity01, d.continuity01, 'P78 NaN continuity falls back');
  finite(st.narrativeCoherence01, 'P78.narrativeCoherence01');
  assert.equal(st.selfAuthorship01, 0, 'P78 negative authorship clamps');
  assert.equal(st.chapters, 0, 'P78 NaN chapters falls back');
  assert.equal(st.turningPoints, 0, 'P78 negative turning points clamps');
  assert.equal(st.recentSummary, d.recentSummary, 'P78 non-string summary falls back');
  assert.equal(st.chaptersData.length, 1, 'P78 filters chapter rows without an id');
  assert.equal(st.chaptersData[0].fromTick, 0, 'P78 negative fromTick clamps');
  assert.equal(st.chaptersData[0].toTick, 0, 'P78 NaN toTick falls back');
  finite(st.chaptersData[0].significance01, 'P78 significance');
  assert.equal(st.lastObservationKey, '', 'P78 non-string observation key falls back');
  assert.doesNotThrow(() => s.restore({ get continuity01() { throw new Error('hostile'); } }));
  const valid = { version: 2, chapters: 1, samples: 10, continuity01: .6, narrativeCoherence01: .7, selfAuthorship01: .4, turningPoints: 1, recentSummary: 'Период 1–2', chaptersData: [{ id: 'c1', fromTick: 1, toTick: 2, summary: 'Период 1–2', significance01: .7 }], lastObservationKey: 'k' };
  s.restore(valid);
  assert.deepEqual(s.snapshot(), valid, 'P78 valid snapshot round-trips');
}

console.log('WORKPASS72_IDENTITY_STATE_RESTORE_INTEGRITY=PASS');
console.log(JSON.stringify({ pass: true, owners: ['P80UnifiedSelfState', 'P76IdentityLifeOS', 'P78AutobiographicalSelfContinuity'] }));
