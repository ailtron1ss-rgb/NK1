import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OrganismRuntime } from '../src/organism/core/OrganismRuntime.ts';

const root = process.cwd();
const runtimeSource = readFileSync(resolve(root, 'src/organism/core/OrganismRuntime.ts'), 'utf8');
const coordinatorSource = readFileSync(resolve(root, 'src/organism/learning/P23CompoundRepairRevisionCoordinator.ts'), 'utf8');
const candidateStoreSource = readFileSync(resolve(root, 'src/organism/learning/VersionedSkillCandidateStore.ts'), 'utf8');

assert.match(runtimeSource, /backgroundRevision\?:\s*\{\s*enabled:\s*boolean/);
assert.match(runtimeSource, /background-compound-repair-revision-requires-independent-evaluation-authority/,
  'background revisions must require independent execution, verification and safety authorities');
assert.match(runtimeSource, /this\.registerCompoundRepairRevisionClock\(\)/,
  'the P23 repair revision loop must be registered with the runtime clock');
assert.match(runtimeSource, /cognitiveBudget01 >= 0\.70/);
assert.match(runtimeSource, /battery01 > 0\.20/);
assert.match(runtimeSource, /ramPressure01 < 0\.82/);
assert.match(runtimeSource, /body\.thermalStrain01 < 0\.72/);
assert.match(runtimeSource, /unifiedLearningExternalHypotheses\(128\)/,
  'untrusted repair hypotheses may guide triage but cannot replace the runtime repair ledger');
assert.match(runtimeSource, /explicit promotion approval remain required/);
assert.match(coordinatorSource, /sourceEvidenceFingerprint: initialEvidenceDigest/,
  'the exact observed-repair digest must be carried to P23');
assert.match(candidateStoreSource, /sourceEvidenceFingerprint\?: string/,
  'candidate lineage must persist the repair evidence digest');

const events = [];
const registrations = [];
const evidence = [
  { skillId: 'skill-a', failureFingerprint: 'a'.repeat(64), revisionEligible: true, observedAt: 100 },
  { skillId: 'skill-b', failureFingerprint: 'b'.repeat(64), revisionEligible: true, observedAt: 90 },
];
const runtime = Object.create(OrganismRuntime.prototype);
runtime.config = {
  compoundRepairRevision: {
    backgroundRevision: { enabled: true, initialDelayMs: 300_000, intervalMs: 900_000 },
  },
};
runtime.compoundRepairRevisionCoordinator = { retryBackoffDiagnostics: () => [] };
runtime.compoundRepairRevisionCursor = 0;
runtime.compoundRepairRevisionMetrics = {
  version: 1,
  schedulerDecisions: 0,
  resourceGated: 0,
  noEvidence: 0,
  notReady: 0,
  attempts: 0,
  staged: 0,
  deduplicated: 0,
  backoffSkipped: 0,
  failures: 0,
  lastDecisionAt: 0,
  lastDecisionReason: 'test',
  lastAttemptAt: 0,
  lastSkillId: null,
  lastStatus: 'idle',
  lastCandidateId: null,
  lastFailureCategory: null,
};
runtime.clockScheduler = { register: task => registrations.push(task) };
runtime.embodiment = {
  snapshot: () => ({
    awake: true,
    thermalStrain01: 0.1,
    telemetry: { battery01: 0.9, ramPressure01: 0.2 },
  }),
};
runtime.runtimeDecision = () => ({ cognitiveBudget01: 0.9 });
runtime.runtimePerformance = { decision: () => ({ performancePressure01: 0.1 }) };
runtime.initialized = true;
runtime.stopping = false;
runtime.compoundSkillRepairEvidence = () => evidence;
runtime.journal = { write: async (...args) => { events.push(args); } };
runtime.core = {
  markRuntimeAnomaly: reason => { events.push(['anomaly', reason]); },
  unifiedLearningExternalHypotheses: () => [
    { claimedProvenance: 'skill-repair', taskId: 'skill-repair:skill-b:step-1', receivedAt: Date.now() },
    { claimedProvenance: 'skill-repair', taskId: 'skill-repair:untrusted-not-in-ledger:step-9', receivedAt: Date.now() },
    { claimedProvenance: 'external', taskId: 'skill-repair:skill-a:step-1', receivedAt: Date.now() },
  ],
};
const revisedSkillIds = [];
runtime.reviseCompoundSkillsFromObservedRepairs = async skillId => {
  revisedSkillIds.push(skillId);
  return { status: 'candidate-staged', skillId, candidateId: 'staged-only', repairEvidenceCount: 1 };
};

OrganismRuntime.prototype.registerCompoundRepairRevisionClock.call(runtime);
assert.equal(registrations.length, 1);
const task = registrations[0];
assert.equal(task.id, 'p23-compound-repair-revision');
assert.equal(task.initialDelayMs, 300_000);
assert.equal(task.decide().delayMs, 900_000);
assert.equal(task.decide().run, true, 'resource-ready runtime with verified repair evidence should schedule one revision');

runtime.embodiment.snapshot = () => ({
  awake: false,
  thermalStrain01: 0.1,
  telemetry: { battery01: 0.9, ramPressure01: 0.2 },
});
assert.equal(task.decide().run, false, 'the clock must not revise a sleeping organism');
runtime.embodiment.snapshot = () => ({
  awake: true,
  thermalStrain01: 0.9,
  telemetry: { battery01: 0.9, ramPressure01: 0.2 },
});
assert.equal(task.decide().run, false, 'thermal strain must gate background revision');
runtime.embodiment.snapshot = () => ({
  awake: true,
  thermalStrain01: 0.1,
  telemetry: { battery01: 0.9, ramPressure01: 0.2 },
});
runtime.runtimeDecision = () => ({ cognitiveBudget01: 0.3 });
assert.equal(task.decide().run, false, 'low cognitive budget must gate background revision');
runtime.runtimeDecision = () => ({ cognitiveBudget01: 0.9 });
runtime.compoundSkillRepairEvidence = () => [];
assert.equal(task.decide().run, false, 'no eligible repair evidence must not trigger generation');
runtime.compoundSkillRepairEvidence = () => evidence;

await task.task();
assert.deepEqual(revisedSkillIds, ['skill-b'], 'verified repair ledger bounds the candidate set while quarantined repair hypotheses may prioritize only existing skills');
assert.equal(events.at(-1)[1], 'runtime.p23.compound-repair-revision.background');

// Old or implausibly future-dated external hints must not bias P23's skill order.
runtime.compoundRepairRevisionCursor = 0;
runtime.core.unifiedLearningExternalHypotheses = () => [
  { claimedProvenance: 'skill-repair', taskId: 'skill-repair:skill-b:old', receivedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 },
];
assert.equal(OrganismRuntime.prototype.nextCompoundRepairSkillId.call(runtime), 'skill-a',
  'expired hypotheses are ignored and normal verified-ledger rotation is preserved');
runtime.compoundRepairRevisionCursor = 0;
runtime.core.unifiedLearningExternalHypotheses = () => [
  { claimedProvenance: 'skill-repair', taskId: 'skill-repair:skill-b:future', receivedAt: Date.now() + 60 * 60 * 1000 },
];
assert.equal(OrganismRuntime.prototype.nextCompoundRepairSkillId.call(runtime), 'skill-a',
  'future-dated hypotheses are ignored');
runtime.compoundRepairRevisionCursor = 0;
runtime.core.unifiedLearningExternalHypotheses = () => [
  { claimedProvenance: 'skill-repair', taskId: 'skill-repair:skill-b:step-1', receivedAt: Date.now() },
  { claimedProvenance: 'skill-repair', taskId: 'skill-repair:untrusted-not-in-ledger:step-9', receivedAt: Date.now() },
  { claimedProvenance: 'external', taskId: 'skill-repair:skill-a:step-1', receivedAt: Date.now() },
];
assert.equal(OrganismRuntime.prototype.nextCompoundRepairSkillId.call(runtime), 'skill-b',
  'fresh hypotheses may prioritize but never expand the verified repair ledger');

assert.equal(events.at(-1)[2].status, 'candidate-staged');
const diagnostics = OrganismRuntime.prototype.compoundRepairRevisionDiagnostics.call(runtime);
assert.equal(diagnostics.enabled, true);
assert.equal(diagnostics.attempts, 1);
assert.equal(diagnostics.staged, 1);
assert.equal(diagnostics.lastSkillId, 'skill-b');
assert.equal(diagnostics.lastCandidateId, 'staged-only');
assert.equal(diagnostics.schedule.intervalMs, 900_000);

// A staged status without a stable candidate ID must fail closed: it cannot
// increment the staged counter, must surface an anomaly, and is journaled as error.
const stagedBeforeMissingId = runtime.compoundRepairRevisionMetrics.staged;
const failuresBeforeMissingId = runtime.compoundRepairRevisionMetrics.failures;
runtime.reviseCompoundSkillsFromObservedRepairs = async skillId => ({
  status: 'candidate-staged', skillId, repairEvidenceCount: 1,
});
await task.task();
assert.equal(runtime.compoundRepairRevisionMetrics.staged, stagedBeforeMissingId,
  'candidate staging must not be counted without a non-empty candidate ID');
assert.equal(runtime.compoundRepairRevisionMetrics.failures, failuresBeforeMissingId + 1);
assert.equal(runtime.compoundRepairRevisionMetrics.lastStatus, 'error');
assert.equal(runtime.compoundRepairRevisionMetrics.lastFailureCategory, 'candidate-staged-without-candidate-id');
assert.equal(runtime.compoundRepairRevisionMetrics.lastCandidateId, null);
assert.ok(events.some(event => event[0] === 'anomaly' &&
  String(event[1]).includes('candidate-staged-without-candidate-id')));
assert.equal(events.at(-1)[2].status, 'error',
  'journal must not advertise a malformed staged response as successful');

const disabled = Object.create(OrganismRuntime.prototype);
disabled.config = { compoundRepairRevision: { backgroundRevision: { enabled: false } } };
disabled.compoundRepairRevisionCoordinator = {};
disabled.clockScheduler = { register: () => { throw new Error('disabled background scheduler must not register'); } };
OrganismRuntime.prototype.registerCompoundRepairRevisionClock.call(disabled);

console.log(JSON.stringify({
  ok: true,
  schedule: task.id,
  resourceGateCases: 4,
  stagedWithoutActivation: revisedSkillIds.length,
  evidenceDriven: true,
}));
