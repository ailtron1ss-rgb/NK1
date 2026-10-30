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

// Unresolved side effects cannot be deleted by a generic clear or by changing projects.
assert.equal(restored.clearStepOperation(first.checkpoint.operationKey), false, 'pending operation must remain locked until a receipt is reconciled');
assert.equal(restored.hasUnresolvedStepOperation(), true);
const attemptedSwitch = restored.ensure({ id: 'wp60-other-project', origin: 'identity' });
assert.equal(attemptedSwitch.projectId, 'wp60-project', 'ensure must not replace a project with an unresolved side effect');
assert.equal(restored.activeStepOperation()?.operationKey, first.checkpoint.operationKey);

// A stale snapshot without the checkpoint cannot erase the newer in-memory operation.
const staleSnapshot = restored.snapshot();
delete staleSnapshot.activeOperation;
restored.restore(staleSnapshot);
assert.equal(restored.activeStepOperation()?.operationKey, first.checkpoint.operationKey);

// Accessors in an untrusted snapshot are not evaluated and cannot remove the current lock.
const accessorSnapshot = restored.snapshot();
let rootGetterCalled = false;
Object.defineProperty(accessorSnapshot, 'activeOperation', {
  enumerable: true,
  configurable: true,
  get() { rootGetterCalled = true; return undefined; },
});
restored.restore(accessorSnapshot);
assert.equal(rootGetterCalled, false, 'root checkpoint getter must never execute');
assert.equal(restored.activeStepOperation()?.operationKey, first.checkpoint.operationKey);

const nestedAccessorSnapshot = restored.snapshot();
let nestedGetterCalled = false;
Object.defineProperty(nestedAccessorSnapshot.activeOperation, 'operationKey', {
  enumerable: true,
  configurable: true,
  get() { nestedGetterCalled = true; return 'forged'; },
});
restored.restore(nestedAccessorSnapshot);
assert.equal(nestedGetterCalled, false, 'nested checkpoint getter must never execute');
assert.equal(restored.activeStepOperation()?.operationKey, first.checkpoint.operationKey);

// Reconciliation must be completed before clearing or switching to another project.
restored.updateStepOperation({ operationKey: first.checkpoint.operationKey, stage: 'reconciliation-required' });
assert.equal(restored.clearStepOperation(first.checkpoint.operationKey), false, 'reconciliation-required checkpoint cannot be cleared');
assert.equal(restored.ensure({ id: 'wp60-other-project', origin: 'identity' }).projectId, 'wp60-project');
restored.updateStepOperation({ operationKey: first.checkpoint.operationKey, stage: 'receipt-recorded', executionId: 'exec-reconciled' });
assert.equal(restored.clearStepOperation(first.checkpoint.operationKey), true);
assert.equal(restored.hasUnresolvedStepOperation(), false);
assert.equal(restored.ensure({ id: 'wp60-other-project', origin: 'identity' }).projectId, 'wp60-other-project');

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

// Identity fields are rejected instead of silently truncated into collisions.
const strictIdentity = new AutonomousProjectExecutor();
strictIdentity.ensure({ id: 'strict-identity', origin: 'identity' });
const strictStep = strictIdentity.currentStep();
const strictFingerprint = sha256Stable({ strict: true });
assert.throws(() => strictIdentity.prepareStepOperation({
  projectId: 'p'.repeat(181), stepId: strictStep.id, toolId: 'fixture.read', requestFingerprint: strictFingerprint,
}), /project-step-checkpoint-invalid-identity/);
assert.throws(() => strictIdentity.prepareStepOperation({
  projectId: 'strict-identity', stepId: strictStep.id, toolId: 'fixture.read', requestFingerprint: strictFingerprint,
  idempotencyKey: 'k'.repeat(161),
}), /project-step-checkpoint-invalid-identity/);
assert.throws(() => strictIdentity.prepareStepOperation({
  projectId: 'strict-identity', stepId: strictStep.id, toolId: 'fixture.read', requestFingerprint: strictFingerprint,
  decisionId: 'd'.repeat(181),
}), /project-step-checkpoint-invalid-identity/);

const exhausted = new AutonomousProjectExecutor();
exhausted.ensure({ id: 'sequence-exhausted', origin: 'identity' });
const exhaustedSnapshot = exhausted.snapshot();
exhaustedSnapshot.operationSequence = Number.MAX_SAFE_INTEGER;
exhausted.restore(exhaustedSnapshot);
const exhaustedStep = exhausted.currentStep();
assert.throws(() => exhausted.prepareStepOperation({
  projectId: 'sequence-exhausted', stepId: exhaustedStep.id, toolId: 'fixture.read', requestFingerprint: strictFingerprint,
}), /project-step-checkpoint-sequence-exhausted/);

// Legacy version-6 snapshots remain readable and start without a fabricated operation.
const legacy = new AutonomousProjectExecutor();
legacy.restore({ version: 6, projectId: 'legacy-project', steps: [], cursor: 0, processedOutcomeIds: [] });
assert.equal(legacy.snapshot().version, 7);
assert.equal(legacy.activeStepOperation(), null);

console.log('WORKPASS60_PROJECT_STEP_CHECKPOINT=PASS durable-restore stable-ids conflicting-request-gate safe-prepared-replacement legacy-migration');
