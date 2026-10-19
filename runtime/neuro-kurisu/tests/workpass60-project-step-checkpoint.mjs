import assert from 'node:assert/strict';
import { AutonomousProjectExecutor } from '../src/organism/system/AutonomousProjectExecutor.ts';
import { sha256Stable } from '../src/organism/core/StableSerialization.ts';

const executor = new AutonomousProjectExecutor();
executor.ensure({ id: 'wp60-project', origin: 'identity' });
const initialStep = executor.currentStep();
assert.ok(initialStep, 'fixture has a planned project step');

const fingerprintA = sha256Stable({ projectId: 'wp60-project', stepId: initialStep.id, toolId: 'fixture.write', input: { value: 1 } });
const first = executor.prepareStepOperation({
  projectId: 'wp60-project', stepId: initialStep.id, toolId: 'fixture.write',
  requestFingerprint: fingerprintA,
});
assert.equal(first.ok, true);
assert.equal(first.reused, false);
assert.equal(first.checkpoint.stage, 'prepared');
assert.match(first.checkpoint.operationKey, /^project-step:/);
assert.match(first.checkpoint.decisionId, /^decision:project-step:/);

// The snapshot/restore path must retain operation identity and must never mint a
// second key for the same unresolved request.
executor.updateStepOperation({ operationKey: first.checkpoint.operationKey, stage: 'pending' });
const restored = new AutonomousProjectExecutor();
restored.restore(executor.snapshot());
const active = restored.activeStepOperation();
assert.ok(active);
assert.equal(active.operationKey, first.checkpoint.operationKey);
assert.equal(active.decisionId, first.checkpoint.decisionId);
assert.equal(active.stage, 'pending');

const replay = restored.prepareStepOperation({
  projectId: 'wp60-project', stepId: initialStep.id, toolId: 'fixture.write',
  requestFingerprint: fingerprintA,
});
assert.equal(replay.ok, true);
assert.equal(replay.reused, true);
assert.equal(replay.checkpoint.operationKey, first.checkpoint.operationKey);

// A different payload may not replace a pending side effect: reconciliation first.
const fingerprintB = sha256Stable({ projectId: 'wp60-project', stepId: initialStep.id, toolId: 'fixture.write', input: { value: 2 } });
const conflict = restored.prepareStepOperation({
  projectId: 'wp60-project', stepId: initialStep.id, toolId: 'fixture.write',
  requestFingerprint: fingerprintB,
});
assert.equal(conflict.ok, false);
assert.equal(conflict.error, 'project-step-reconciliation-required');
assert.equal(conflict.checkpoint.operationKey, first.checkpoint.operationKey);

// Prepared intent is the only stage that can be superseded safely before Gateway
// entry; after a resolution is cleared, the next operation gets a fresh generation.
const fresh = new AutonomousProjectExecutor();
fresh.ensure({ id: 'wp60-fresh', origin: 'identity' });
const st = fresh.currentStep();
const f1 = sha256Stable({ a: 1 });
const f2 = sha256Stable({ a: 2 });
const pendingPrepared = fresh.prepareStepOperation({ projectId: 'wp60-fresh', stepId: st.id, toolId: 'fixture.read', requestFingerprint: f1 });
const superseded = fresh.prepareStepOperation({ projectId: 'wp60-fresh', stepId: st.id, toolId: 'fixture.read', requestFingerprint: f2 });
assert.equal(superseded.ok, true);
assert.notEqual(superseded.checkpoint.operationKey, pendingPrepared.checkpoint.operationKey);
fresh.updateStepOperation({ operationKey: superseded.checkpoint.operationKey, stage: 'receipt-recorded', outcomeClass: 'executed-verified', executionId: 'exec-wp60' });
assert.equal(fresh.clearStepOperation(superseded.checkpoint.operationKey), true);
const nextGeneration = fresh.prepareStepOperation({ projectId: 'wp60-fresh', stepId: st.id, toolId: 'fixture.read', requestFingerprint: f2 });
assert.equal(nextGeneration.ok, true);
assert.notEqual(nextGeneration.checkpoint.operationKey, superseded.checkpoint.operationKey);

// Legacy version-6 snapshots remain readable and start without a fabricated operation.
const legacy = new AutonomousProjectExecutor();
legacy.restore({ version: 6, projectId: 'legacy-project', steps: [], cursor: 0, processedOutcomeIds: [] });
assert.equal(legacy.snapshot().version, 7);
assert.equal(legacy.activeStepOperation(), null);

console.log('WORKPASS60_PROJECT_STEP_CHECKPOINT=PASS durable-restore stable-ids conflicting-request-gate safe-prepared-replacement legacy-migration');
