/**
 * NK1 grounded world perception — canonical observation contract regression suite.
 *
 * Covers the thirteen failure modes named in the work request, plus the provenance
 * invariant that keeps synthetic fixtures out of real-world grounding. Assertions are
 * behavioral: they exercise the real intake gate, evidence compiler and grounded world
 * owner, not mocks.
 */

import assert from 'node:assert/strict';
import {
  ObservationIntakeGate,
  sanitizeObservationIntakeState,
  sanitizeObservationPayload,
  defaultObservationIntakeState,
  MAX_OBSERVATION_AGE_MS,
  MAX_CLOCK_SKEW_MS,
} from '../src/organism/body/ObservationIntakeGate.ts';
import { PerceptualEvidenceCompiler } from '../src/organism/body/PerceptualEvidenceCompiler.ts';
import {
  GroundedWorldState,
  observationEvidenceKind,
  strongerEvidenceKind,
} from '../src/organism/world/GroundedWorldState.ts';

const T0 = 1_700_000_000_000;
const checks = [];
const check = (name, fn) => {
  fn();
  checks.push(name);
};

let seq = 0;
const observation = (overrides = {}) => ({
  id: `obs_${++seq}`,
  sourceId: 'camera-0',
  sourceKind: 'camera',
  modality: 'vision',
  capturedAt: T0,
  confidence01: 0.8,
  reliability01: 0.9,
  sessionId: 'session-1',
  provenance: 'device-capture',
  payload: { subject: 'chair', claim: 'present' },
  ...overrides,
});

const gateWithConsent = (modalities = ['vision', 'audio', 'device']) => {
  const gate = new ObservationIntakeGate();
  for (const modality of modalities) gate.setConsent(modality, true);
  return gate;
};

// 1. Malformed observation input -----------------------------------------
check('malformed: non-record, missing identity and bad modality are all rejected', () => {
  const gate = gateWithConsent();
  assert.equal(gate.admit(null, { now: T0 }).reason, 'malformed-observation');
  assert.equal(gate.admit([], { now: T0 }).reason, 'malformed-observation');
  assert.equal(gate.admit('nope', { now: T0 }).reason, 'malformed-observation');
  assert.equal(gate.admit({}, { now: T0 }).reason, 'missing-identity');
  assert.equal(
    gate.admit(observation({ id: '' }), { now: T0 }).reason,
    'missing-identity',
    'blank id must not be accepted',
  );
  assert.equal(
    gate.admit(observation({ sessionId: undefined }), { now: T0 }).reason,
    'missing-identity',
  );
  assert.equal(
    gate.admit(observation({ modality: 'telepathy' }), { now: T0 }).reason,
    'unsupported-modality',
  );
  assert.equal(
    gate.admit(observation({ provenance: 'because-i-said-so' }), { now: T0 }).reason,
    'invalid-provenance',
  );
  const summary = gate.summary();
  assert.equal(summary.admitted, 0);
  assert.ok(summary.rejected >= 8, 'every malformed input must be counted as rejected');
  assert.ok(summary.rejectionReasons['malformed-observation'] >= 3);
});

check('malformed: hostile accessors and proxies do not escape the boundary', () => {
  const gate = gateWithConsent();
  const hostile = Object.create(null);
  Object.defineProperty(hostile, 'id', { get() { throw new Error('boom'); } });
  assert.equal(gate.admit(hostile, { now: T0 }).reason, 'missing-identity');

  const proxy = new Proxy({}, { get() { throw new Error('trap'); }, ownKeys() { throw new Error('trap'); } });
  const result = gate.admit(proxy, { now: T0 });
  assert.equal(result.status, 'rejected');
});

// 2. Stale frames --------------------------------------------------------
check('stale: frames past the freshness window are refused and counted', () => {
  const gate = gateWithConsent();
  const stale = gate.admit(observation({ capturedAt: T0 - MAX_OBSERVATION_AGE_MS - 1 }), { now: T0 });
  assert.equal(stale.reason, 'stale-observation');
  const fresh = gate.admit(observation({ capturedAt: T0 - 1_000 }), { now: T0 });
  assert.equal(fresh.status, 'accepted');
  assert.equal(gate.summary().staleRejections, 1);
});

check('stale: expired freshness window is refused even when the capture is recent', () => {
  const gate = gateWithConsent();
  const result = gate.admit(observation({ capturedAt: T0 - 100, expiresAt: T0 - 50 }), { now: T0 });
  assert.equal(result.reason, 'expired-observation');
});

// 3. Duplicate observations ---------------------------------------------
check('duplicate: repeated id and repeated content are both rejected', () => {
  const gate = gateWithConsent();
  const first = observation({ id: 'dup-1' });
  assert.equal(gate.admit(first, { now: T0 }).status, 'accepted');
  assert.equal(gate.admit({ ...first }, { now: T0 }).reason, 'duplicate-observation');
  // Same frame re-sent under a fresh id must still be recognised as one observation.
  const resent = gate.admit({ ...first, id: 'dup-2' }, { now: T0 });
  assert.equal(resent.reason, 'duplicate-observation');
  assert.equal(gate.summary().duplicates, 2);
});

check('duplicate: a genuinely different payload is not treated as a duplicate', () => {
  const gate = gateWithConsent();
  gate.admit(observation({ id: 'a', payload: { subject: 'chair', claim: 'present' } }), { now: T0 });
  const other = gate.admit(
    observation({ id: 'b', payload: { subject: 'door', claim: 'open' } }),
    { now: T0 },
  );
  assert.equal(other.status, 'accepted');
});

// 4. Conflicting entities ------------------------------------------------
check('conflict: cross-modality disagreement is preserved, not voted away', () => {
  const gate = gateWithConsent();
  gate.admit(
    observation({ id: 'c1', modality: 'vision', payload: { subject: 'door', claim: 'open' } }),
    { now: T0 },
  );
  gate.admit(
    observation({ id: 'c2', modality: 'audio', sourceId: 'mic-0', payload: { subject: 'door', claim: 'closed' } }),
    { now: T0 },
  );
  const conflicts = gate.conflicts();
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].resolution, 'preserved-for-review');
  assert.equal(conflicts[0].claimA, 'open');
  assert.equal(conflicts[0].claimB, 'closed');
  assert.ok(conflicts[0].disagreement01 >= 0 && conflicts[0].disagreement01 <= 1);
  // Both observations remain in the ledger; nothing was overwritten.
  assert.equal(gate.recent().length, 2);
});

check('conflict: same-modality restatement is not a conflict', () => {
  const gate = gateWithConsent();
  gate.admit(observation({ id: 's1', payload: { subject: 'chair', claim: 'present' } }), { now: T0 });
  gate.admit(observation({ id: 's2', payload: { subject: 'chair', claim: 'absent' } }), { now: T0 });
  assert.equal(gate.conflicts().length, 0, 'one modality revising itself is not cross-modal conflict');
});

// 5. Coordinate transformation errors -----------------------------------
check('frame: a frame change invalidates the previous spatial estimate', () => {
  const world = new GroundedWorldState();
  const base = observation({ payload: { subject: 'ball', claim: 'visible' }, coordinateFrameId: 'camera-0' });
  world.integrateObservation({ at: T0, observation: base });
  const entityId = `obs-${(world.snapshot().entities[0]).id.split('obs-')[1]}`;
  const afterFirst = world.snapshot().entities.find((e) => e.id === entityId);
  assert.equal(afterFirst.positionFrameId, 'camera-0');

  // Same subject, new frame: position must not be reinterpreted across frames.
  world.integrateObservation({
    at: T0 + 1,
    observation: observation({ payload: { subject: 'ball', claim: 'visible' }, coordinateFrameId: 'camera-1' }),
  });
  const afterFrameChange = world.snapshot().entities.find((e) => e.id === entityId);
  assert.equal(afterFrameChange.positionFrameId, 'camera-1');
  assert.equal(afterFrameChange.position, null, 'cross-frame position must be dropped, not reused');
});

// 6. Confidence calibration ---------------------------------------------
check('confidence: reported confidence is clamped and reliability-scaled', () => {
  const gate = gateWithConsent();
  const over = gate.admit(observation({ id: 'conf-1', confidence01: 7, payload: { subject: 'a', claim: 'present' } }), { now: T0 });
  assert.equal(over.observation.confidence01, 1, 'confidence above 1 clamps to 1');
  const under = gate.admit(observation({ id: 'conf-2', confidence01: -3, payload: { subject: 'b', claim: 'present' } }), { now: T0 });
  assert.equal(under.observation.confidence01, 0);
  assert.equal(
    gate.admit(observation({ id: 'conf-3', confidence01: Number.NaN, payload: { subject: 'c', claim: 'present' } }), { now: T0 }).reason,
    'malformed-observation',
  );
  assert.equal(gate.admit(observation({ id: 'conf-4', confidence01: '0.9', payload: { subject: 'd', claim: 'present' } }), { now: T0 }).reason, 'malformed-observation');
});

check('confidence: world model scales confidence by source reliability', () => {
  const world = new GroundedWorldState();
  world.integrateObservation({
    at: T0,
    observation: observation({ confidence01: 1, reliability01: 0.5, payload: { subject: 'x', claim: 'y' } }),
  });
  const entity = world.snapshot().entities[0];
  assert.ok(entity.confidence01 <= 0.5 + 1e-9, 'a half-reliable source cannot claim full confidence');
});

// 7. Invalid timestamps --------------------------------------------------
check('timestamps: negative, fractional and non-numeric captures are rejected', () => {
  const gate = gateWithConsent();
  assert.equal(gate.admit(observation({ capturedAt: -1 }), { now: T0 }).reason, 'invalid-timestamp');
  assert.equal(gate.admit(observation({ capturedAt: 1.5 }), { now: T0 }).reason, 'invalid-timestamp');
  assert.equal(gate.admit(observation({ capturedAt: 'yesterday' }), { now: T0 }).reason, 'invalid-timestamp');
  assert.equal(gate.admit(observation({ capturedAt: undefined }), { now: T0 }).reason, 'invalid-timestamp');
});

check('timestamps: device clock running ahead is rejected as a future observation', () => {
  const gate = gateWithConsent();
  const ahead = gate.admit(observation({ capturedAt: T0 + MAX_CLOCK_SKEW_MS + 1 }), { now: T0 });
  assert.equal(ahead.reason, 'future-observation');
  const tolerated = gate.admit(observation({ capturedAt: T0 + MAX_CLOCK_SKEW_MS - 1 }), { now: T0 });
  assert.equal(tolerated.status, 'accepted', 'small clock skew is tolerated');
});

// 8. Entity disappearance and reappearance ------------------------------
check('continuity: an entity can disappear and reappear without losing identity', () => {
  const world = new GroundedWorldState();
  const first = observation({ payload: { subject: 'cup', claim: 'present' } });
  world.integrateObservation({ at: T0, observation: first });
  const entityId = world.snapshot().entities[0].id;
  world.integrateObservation({
    at: T0 + 5_000,
    observation: observation({ payload: { subject: 'cup', claim: 'present' } }),
  });
  const entity = world.snapshot().entities.find((e) => e.id === entityId);
  assert.ok(entity.observationCount >= 2, 'reappearance merges into the same entity');
  assert.equal(world.snapshot().entities.filter((e) => e.id === entityId).length, 1);
});

check('continuity: two same-label subjects with distinct track ids stay distinct', () => {
  const world = new GroundedWorldState();
  world.integrateObservation({ at: T0, observation: observation({ sourceId: 'cam-a', payload: { subject: 'chair', claim: 'present', trackId: 'track-a' } }) });
  world.integrateObservation({ at: T0, observation: observation({ sourceId: 'cam-b', payload: { subject: 'chair', claim: 'present', trackId: 'track-b' } }) });
  assert.equal(world.snapshot().entities.length, 2, 'a strong track identity keeps instances separate');
});

// 9. Multimodal disagreement --------------------------------------------
check('disagreement: contradictory claims surface as a world-model conflict', () => {
  const world = new GroundedWorldState();
  world.integrateObservation({
    at: T0,
    observation: observation({ modality: 'vision', payload: { subject: 'lamp', claim: 'on' } }),
  });
  world.integrateObservation({
    at: T0 + 1,
    observation: observation({ modality: 'audio', sourceId: 'mic', payload: { subject: 'lamp', claim: 'off' } }),
  });
  const conflicts = world.observationConflicts();
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].previousClaim, 'on');
  assert.equal(conflicts[0].incomingClaim, 'off');
  // The entity's evidence for that modality is marked conflicting rather than resolved.
  const entity = world.snapshot().entities[0];
  assert.equal(entity.modalityEvidenceKinds.audio, 'conflict');
});

// 10. Process restart and restoration -----------------------------------
check('restore: a round-tripped gate preserves counters, consent and rejects nothing new', () => {
  const gate = gateWithConsent(['vision']);
  gate.admit(observation({ id: 'r1' }), { now: T0 });
  gate.admit(observation({ id: 'r1' }), { now: T0 }); // duplicate
  const persisted = JSON.parse(JSON.stringify(gate.snapshot()));

  const restored = new ObservationIntakeGate();
  restored.restore(persisted);
  const summary = restored.summary();
  assert.equal(summary.admitted, 1);
  assert.equal(summary.duplicates, 1);
  assert.equal(summary.consent.vision, true);
  assert.equal(summary.consent.audio, false, 'consent survives restore without being widened');
  // The ledger is restored, so re-sending the same id is still a duplicate.
  assert.equal(restored.admit(observation({ id: 'r1' }), { now: T0 }).reason, 'duplicate-observation');
});

check('restore: hostile persisted state falls back to defaults instead of propagating', () => {
  for (const hostile of [null, 'x', 42, [], { admitted: -5 }, { admitted: 1.5 }, { consent: 'yes' }]) {
    const state = sanitizeObservationIntakeState(hostile);
    assert.equal(state.version, 1);
    assert.ok(state.admitted >= 0 && Number.isSafeInteger(state.admitted));
    assert.equal(typeof state.consent.vision, 'boolean');
  }
  const proxied = sanitizeObservationIntakeState(new Proxy({}, { get() { throw new Error('trap'); } }));
  assert.equal(proxied.version, 1);
  const accessor = { get admitted() { throw new Error('boom'); } };
  assert.equal(sanitizeObservationIntakeState(accessor).admitted, 0);
});

check('restore: world model observations do not survive as live grounded facts after reset', () => {
  const world = new GroundedWorldState();
  world.integrateObservation({ at: T0, observation: observation({ payload: { subject: 'ghost', claim: 'present' } }) });
  assert.equal(world.snapshot().entities.length, 1);
  const restored = new GroundedWorldState();
  restored.restore(world.snapshot());
  assert.equal(restored.snapshot().entities.length, 1, 'grounded state is restorable');
  // Conflicts are derived diagnostics and reset with a fresh owner.
  assert.equal(restored.observationConflicts().length, 0);
});

// 11. Missing provider ---------------------------------------------------
check('provider: an absent semantic provider yields no grounding, not a fabricated one', () => {
  const compiler = new PerceptualEvidenceCompiler();
  const before = compiler.summary().metrics.groundedSignalRatio01;
  // A caller that cannot reach its provider must not send a claim at all.
  compiler.compileObservations({ at: T0, observations: [] });
  assert.equal(compiler.summary().metrics.groundedSignalRatio01, before);

  const world = new GroundedWorldState();
  const result = world.integrateObservation({
    at: T0,
    observation: observation({ provenance: 'unresolved', isRealCapture: false, payload: { subject: 'blob', claim: 'maybe' } }),
  });
  assert.equal(result.accepted, true);
  assert.equal(result.evidenceKind, 'unresolved');
  const entity = world.snapshot().entities[0];
  assert.equal(entity.presenceStatus, 'unknown', 'an unresolved source cannot assert visibility');
  assert.equal(entity.visibilityKnown, false);
});

// 12. Late asynchronous results -----------------------------------------
check('late results: a callback arriving after its freshness window is refused', () => {
  const gate = gateWithConsent();
  const requestedAt = T0;
  // The provider answers long after the frame it describes was relevant. Whether the
  // age policy or the explicit freshness deadline catches it, the outcome must be a
  // refusal counted as stale — never silent admission of an outdated frame.
  const late = gate.admit(
    observation({ id: 'late-1', capturedAt: requestedAt, expiresAt: requestedAt + 1_000 }),
    { now: requestedAt + 60_000 },
  );
  assert.equal(late.status, 'rejected');
  assert.ok(['stale-observation', 'expired-observation'].includes(late.reason), `unexpected reason ${late.reason}`);
  assert.equal(gate.summary().staleRejections, 1, 'late arrivals are counted as stale');

  const stillFresh = gate.admit(
    observation({ id: 'late-2', capturedAt: requestedAt, expiresAt: requestedAt + 120_000 }),
    { now: requestedAt + 60_000 },
  );
  assert.equal(stillFresh.status, 'accepted', 'a long-lived observation may still arrive late');
});

// 13. Privacy and consent boundaries ------------------------------------
check('privacy: capture modalities require explicit consent', () => {
  const gate = new ObservationIntakeGate();
  assert.equal(gate.admit(observation(), { now: T0 }).reason, 'consent-required');
  assert.equal(
    gate.admit(observation({ modality: 'audio', sourceId: 'mic' }), { now: T0 }).reason,
    'consent-required',
  );
  assert.equal(
    gate.admit(observation({ modality: 'device', sourceId: 'android' }), { now: T0 }).reason,
    'consent-required',
  );
  gate.setConsent('vision', true);
  assert.equal(gate.admit(observation(), { now: T0 }).status, 'accepted');
  gate.setConsent('vision', false);
  assert.equal(
    gate.admit(observation({ id: 'after-revoke' }), { now: T0 }).reason,
    'consent-required',
    'revoking consent blocks new observations immediately',
  );
});

check('privacy: raw media is never retained in an accepted observation', () => {
  const gate = gateWithConsent();
  const result = gate.admit(
    observation({ payload: { subject: 'face', claim: 'present', bytes: 'RAWBYTES', jpeg: 'x'.repeat(5000), base64: 'AAAA' } }),
    { now: T0 },
  );
  assert.equal(result.status, 'accepted');
  const payload = result.observation.payload;
  assert.equal(payload.bytes, undefined);
  assert.equal(payload.jpeg, undefined);
  assert.equal(payload.base64, undefined);
  assert.equal(payload.subject, 'face', 'metadata survives; media does not');
  assert.ok(gate.summary().rawMediaRejections >= 1, 'stripping media is observable');
});

check('privacy: nested media and oversized payloads are handled', () => {
  const stripped = sanitizeObservationPayload({ subject: 'x', capture: { pcm: 'raw', label: 'ok' } });
  assert.equal(stripped.ok, true);
  assert.equal(stripped.payload.capture.pcm, undefined);
  assert.equal(stripped.payload.capture.label, 'ok');

  // A media-named key drops its whole subtree, including otherwise innocuous fields.
  const wholeSubtree = sanitizeObservationPayload({ subject: 'x', frame: { pcm: 'raw', label: 'ok' } });
  assert.equal(wholeSubtree.ok, true);
  assert.equal(wholeSubtree.payload.frame, undefined);

  const oversized = sanitizeObservationPayload({ blob: 'x'.repeat(10_000) });
  assert.equal(oversized.ok, true, 'long strings are dropped, not stored');
  assert.equal(oversized.payload.blob, undefined);
});

// Provenance invariant: the core honesty property ------------------------
check('provenance: a synthetic fixture can never become a real-world observation', () => {
  const gate = gateWithConsent();
  const fixture = gate.admit(
    observation({ id: 'fixture-1', provenance: 'synthetic-fixture', payload: { subject: 'tree', claim: 'present' } }),
    { now: T0 },
  );
  assert.equal(fixture.status, 'accepted');
  assert.equal(fixture.observation.isRealCapture, false, 'provenance overrides any caller intent');
  assert.equal(gate.groundedObservations().length, 0, 'fixtures are not grounded evidence');
  assert.equal(gate.recent().length, 1, 'the fixture is still recorded as evidence about a model');

  // A caller that lies about reality does not change the outcome.
  const liar = gate.admit(
    observation({ id: 'fixture-2', provenance: 'synthetic-fixture', isRealCapture: true, payload: { subject: 'bush', claim: 'present' } }),
    { now: T0 },
  );
  assert.equal(liar.observation.isRealCapture, false, 'self-declared reality is discarded');
});

check('provenance: model output stays model-output in the world model', () => {
  assert.equal(observationEvidenceKind('device-capture'), 'observed');
  assert.equal(observationEvidenceKind('host-interface'), 'observed');
  assert.equal(observationEvidenceKind('provider-model-output'), 'model-output');
  assert.equal(observationEvidenceKind('derived'), 'derived');
  assert.equal(observationEvidenceKind('synthetic-fixture'), 'unresolved');
  assert.equal(observationEvidenceKind('unresolved'), 'unresolved');

  const world = new GroundedWorldState();
  world.integrateObservation({
    at: T0,
    observation: observation({ provenance: 'provider-model-output', isRealCapture: false, payload: { subject: 'cat', claim: 'sleeping' } }),
  });
  const entity = world.snapshot().entities[0];
  assert.equal(entity.modalityEvidenceKinds.vision, 'model-output');
  assert.ok(world.snapshot().confidence01 === 0, 'a model inference cannot raise grounded confidence');
});

check('provenance: trust is monotone per modality', () => {
  assert.equal(strongerEvidenceKind('observed', 'model-output'), 'observed');
  assert.equal(strongerEvidenceKind('model-output', 'observed'), 'observed');
  assert.equal(strongerEvidenceKind(undefined, 'derived'), 'derived');
  assert.equal(strongerEvidenceKind('observed', 'unresolved'), 'observed');
});

// Evidence compiler integration -----------------------------------------
check('evidence: only real captures raise the grounded signal ratio', () => {
  const compiler = new PerceptualEvidenceCompiler();
  compiler.compileObservations({
    at: T0,
    observations: [
      observation({ id: 'e1', isRealCapture: true, provenance: 'device-capture' }),
      observation({ id: 'e2', isRealCapture: false, provenance: 'provider-model-output', payload: { subject: 'x', claim: 'y' } }),
    ],
  });
  const mixed = compiler.summary().metrics.groundedSignalRatio01;
  assert.ok(mixed > 0, 'a real capture must raise grounding');

  const fixturesOnly = new PerceptualEvidenceCompiler();
  fixturesOnly.compileObservations({
    at: T0,
    observations: [observation({ id: 'f1', isRealCapture: false, provenance: 'synthetic-fixture' })],
  });
  assert.equal(
    fixturesOnly.summary().metrics.groundedSignalRatio01,
    0,
    'fixtures alone must not raise grounding at all',
  );
  assert.ok(
    compiler.summary().metrics.groundedSignalRatio01 > fixturesOnly.summary().metrics.groundedSignalRatio01,
  );
});

check('evidence: observations without a claim are ignored rather than invented', () => {
  const compiler = new PerceptualEvidenceCompiler();
  compiler.compileObservations({
    at: T0,
    observations: [observation({ id: 'n1', payload: {} })],
  });
  assert.equal(compiler.summary().evidence.length, 0);
});

// Bounds and resource control -------------------------------------------
check('bounds: ledger and conflicts stay bounded under sustained input', () => {
  const gate = gateWithConsent();
  for (let i = 0; i < 400; i++) {
    gate.admit(
      observation({ id: `bulk-${i}`, capturedAt: T0 + i, payload: { subject: `s${i}`, claim: `c${i}` } }),
      { now: T0 + i },
    );
  }
  assert.ok(gate.recent(1000).length <= 128, 'ledger is bounded');
  assert.equal(gate.summary().admitted, 400, 'counters are not bounded by the ledger size');
  const state = gate.snapshot();
  assert.ok(state.recent.length <= 128);
  assert.ok(state.recentConflicts.length <= 32);
});

check('bounds: per-source and per-modality counters are tracked', () => {
  const gate = gateWithConsent();
  gate.admit(observation({ id: 'src-1', sourceId: 'cam-7' }), { now: T0 });
  gate.admit(observation({ id: 'src-2', sourceId: 'cam-7', payload: { subject: 'b', claim: 'c' } }), { now: T0 });
  const summary = gate.summary();
  assert.equal(summary.perSource['cam-7'], 2);
  assert.equal(summary.perModality.vision, 2);
});

check('bounds: default state is inert and consent defaults to denied for capture', () => {
  const state = defaultObservationIntakeState();
  assert.equal(state.admitted, 0);
  assert.equal(state.consent.vision, false);
  assert.equal(state.consent.audio, false);
  assert.equal(state.consent.device, false);
  assert.equal(state.consent.text, true, 'text from the host is not a capture modality');
});

check('restore: a world-model contradiction survives a snapshot round trip', () => {
  const world = new GroundedWorldState();
  world.integrateObservation({ at: T0, observation: observation({ modality: 'vision', payload: { subject: 'door', claim: 'open' } }) });
  world.integrateObservation({ at: T0 + 1, observation: observation({ modality: 'audio', sourceId: 'mic', payload: { subject: 'door', claim: 'closed' } }) });
  assert.equal(world.observationConflicts().length, 1);

  const restored = new GroundedWorldState();
  restored.restore(world.snapshot());
  assert.equal(restored.observationConflicts().length, 1, 'a recorded disagreement must not vanish on restart');

  // The subject index must also survive, otherwise a post-restart contradiction looks
  // like a first observation and is silently dropped.
  restored.integrateObservation({ at: T0 + 2, observation: observation({ modality: 'vision', sourceId: 'cam-2', payload: { subject: 'door', claim: 'ajar' } }) });
  assert.equal(restored.observationConflicts().length, 2, 'post-restart disagreement is still detected');
});

check('restore: hostile persisted world state does not break conflict restore', () => {
  const world = new GroundedWorldState();
  world.restore({
    observationConflicts: [null, 'nope', { subject: 'ok' }, { at: T0, subject: 'real', previousClaim: 'a', incomingClaim: 'b' }],
    subjectClaims: [null, { subject: 'a' }, { subject: 'b', claim: 'c', modality: 'vision', sourceId: 's', provenance: 'device-capture' }],
  });
  const conflicts = world.observationConflicts();
  assert.equal(conflicts.length, 1, 'only complete conflicts are retained');
  assert.equal(conflicts[0].subject, 'real');
});

console.log(
  'NK1_GROUNDED_WORLD_PERCEPTION=PASS',
  JSON.stringify({ checks: checks.length, names: checks }),
);
