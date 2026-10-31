import assert from 'node:assert/strict';
import test from 'node:test';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';
import { buildNK1InspectEvidenceRecord, toNK1InspectEvidenceJsonLine } from '../src/organism/integration/inspectAi/NK1InspectEvidenceExporter.ts';

const fullCycle = (fabric, tick = 42) => fabric.recordOperationalCycle({
  tick,
  observation: { source: 'runtime', confidence01: 0.9 },
  prediction: { source: 'predictor', confidence01: 0.8 },
  appraisal: { source: 'appraisal', confidence01: 0.8 },
  attention: { source: 'workspace', confidence01: 0.8 },
  memory: { source: 'memory', confidence01: 0.8 },
  goal: { source: 'goals', confidence01: 0.8 },
  plan: { source: 'planner', confidence01: 0.8 },
  action: { source: 'action', confidence01: 0.8 },
  outcome: { source: 'outcome', external: true, confidence01: 0.9 },
  learning: { source: 'learning', confidence01: 0.8 },
  selfUpdate: { source: 'self', confidence01: 0.8 },
  at: 1_800_000_000_000 + tick,
});

test('exports the newest strict 11-stage cycle and strips cognitive payload content', () => {
  const fabric = new CognitiveEventFabric();
  fullCycle(fabric);
  const snapshot = fabric.snapshot();
  const record = buildNK1InspectEvidenceRecord(snapshot, { exportedAt: 1_800_000_000_100, sourceCommit: 'a'.repeat(40) });
  assert.equal(record.schemaVersion, 'nk1.inspect-evidence/v1');
  assert.equal(record.tick, 42);
  assert.equal(record.cycle.verdict.fullComplete, true);
  assert.equal(record.cycle.events.length, 11);
  assert.equal(record.snapshot.total, 11);
  assert.equal('payload' in record.cycle.events[0], true);
  assert.deepEqual(record.cycle.events[0].payload, {});
  assert.equal(toNK1InspectEvidenceJsonLine(record).endsWith('\n'), true);
});

test('does not promote a six-stage/core cycle to full completion', () => {
  const fabric = new CognitiveEventFabric();
  fabric.recordOperationalCycle({
    tick: 43,
    observation: {}, prediction: {}, action: {}, outcome: {}, learning: {}, selfUpdate: {},
  });
  const record = buildNK1InspectEvidenceRecord(fabric.snapshot());
  assert.equal(record.cycle.verdict.coreComplete, true);
  assert.equal(record.cycle.verdict.fullComplete, false);
  assert.equal(record.cycle.verdict.fullMissingStages.length, 5);
});

test('ambiguous same-stage events fail closed instead of selecting an arbitrary event', () => {
  const fabric = new CognitiveEventFabric();
  fullCycle(fabric, 44);
  fabric.append({ tick: 44, stage: 'appraisal', source: 'duplicate-appraisal', parentIds: [], confidence01: 0.4 });
  const record = buildNK1InspectEvidenceRecord(fabric.snapshot());
  assert.deepEqual(record.cycle.ambiguousStages, ['appraisal']);
  assert.equal(record.cycle.verdict.fullComplete, false);
});

test('external postcondition receipt requires a linked corroborating external observation', () => {
  const fabric = new CognitiveEventFabric();
  const ids = fullCycle(fabric, 45);
  fabric.appendToolReceiptTrace({
    tick: 45,
    executionId: 'exec-12345678-1234-1234-1234-123456789abc',
    toolId: 'device.camera.observe',
    decisionId: ids.action,
    ok: true,
    verified: true,
    outcomeClass: 'verified',
    confidence01: 0.98,
    verificationBasis: 'external-postcondition',
    externalObservation: true,
    observationId: 'obs-45',
    expectedPostcondition: 'camera-state=front-ready',
    observedPostcondition: 'camera-state=front-ready',
    observationIntegrated: true,
    at: 1_800_000_000_200,
  });
  fabric.appendToolExternalObservation({
    tick: 45,
    executionId: 'exec-12345678-1234-1234-1234-123456789abc',
    toolId: 'device.camera.observe',
    observationId: 'obs-45',
    verified: true,
    confidence01: 0.98,
    sourceId: 'android-camera',
    sourceClass: 'device',
    channel: 'camera',
    independenceKey: 'device:camera:front',
    expectedPostcondition: 'camera-state=front-ready',
    observedPostcondition: 'camera-state=front-ready',
    at: 1_800_000_000_201,
  });

  const record = buildNK1InspectEvidenceRecord(fabric.snapshot());
  assert.equal(record.receiptAudit.receiptCount, 1);
  assert.equal(record.receiptAudit.intactReceiptCount, 1);
  assert.equal(record.receiptAudit.externalPostconditionClaimCount, 1);
  assert.equal(record.receiptAudit.externallyCorroboratedCount, 1);
  assert.deepEqual(record.receiptAudit.receipts[0].issues, []);
  // The adapter must not leak the raw postcondition text into the evaluation export.
  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes('camera-state=front-ready'), false);
});

test('contradictory or malformed external observation is reported, not upgraded', () => {
  const fabric = new CognitiveEventFabric();
  const ids = fullCycle(fabric, 46);
  fabric.appendToolReceiptTrace({
    tick: 46,
    executionId: 'exec-12345678-1234-1234-1234-123456789abc',
    toolId: 'device.camera.observe', decisionId: ids.action,
    ok: true, verified: true, outcomeClass: 'verified', confidence01: 0.98,
    verificationBasis: 'external-postcondition', externalObservation: true,
    observationId: 'obs-46', expectedPostcondition: 'camera=front', observedPostcondition: 'camera=front',
    observationIntegrated: true, at: 1_800_000_000_300,
  });
  fabric.appendToolExternalObservation({
    tick: 46,
    executionId: 'exec-12345678-1234-1234-1234-123456789abc',
    toolId: 'device.camera.observe', observationId: 'obs-46', verified: true,
    confidence01: 0.98, sourceId: 'android-camera', sourceClass: 'device', channel: 'camera',
    independenceKey: 'device:camera:front', expectedPostcondition: 'camera=front',
    observedPostcondition: 'camera=back', at: 1_800_000_000_301,
  });
  const record = buildNK1InspectEvidenceRecord(fabric.snapshot());
  assert.equal(record.receiptAudit.externalPostconditionClaimCount, 1);
  assert.equal(record.receiptAudit.externallyCorroboratedCount, 0);
  assert.equal(record.receiptAudit.invalidReceiptCount, 1);
});

test('rejects absent ticks and malformed source commit identifiers', () => {
  const fabric = new CognitiveEventFabric();
  fullCycle(fabric, 47);
  assert.throws(() => buildNK1InspectEvidenceRecord(fabric.snapshot(), { tick: 999 }), /tick-not-present/);
  assert.throws(() => buildNK1InspectEvidenceRecord(fabric.snapshot(), { sourceCommit: 'not-a-sha' }), /source-commit-invalid/);
});
