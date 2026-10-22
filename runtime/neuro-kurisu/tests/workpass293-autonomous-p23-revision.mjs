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
runtime.compoundRepairRevisionCoordinator = {};
runtime.compoundRepairRevisionCursor = 0;
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
runtime.core = { markRuntimeAnomaly: reason => { events.push(['anomaly', reason]); } };
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
assert.deepEqual(revisedSkillIds, ['skill-a'], 'a scheduler cycle should handle at most one skill');
assert.equal(events.at(-1)[1], 'runtime.p23.compound-repair-revision.background');
assert.equal(events.at(-1)[2].status, 'candidate-staged');

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
