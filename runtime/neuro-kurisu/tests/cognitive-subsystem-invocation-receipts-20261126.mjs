import assert from 'node:assert/strict';
import * as ReceiptContracts from '../src/organism/system/CognitiveStageReceipt.ts';
import { CognitiveEventFabric } from '../src/organism/system/CognitiveEventFabric.ts';

const validate = ReceiptContracts.validateCognitiveSubsystemInvocationReceipt;
assert.equal(typeof validate, 'function', 'seven-owner invocation receipt validator must be part of the canonical receipt contract');

const operations = {
  self: 'autonomousPersonhood.plan',
  governance: 'cognitiveDomainClosure.begin',
  memory: 'MemoryFabric.retrieveForCognition',
  world: 'WorldSubsystemRuntime.observeGroundedContext',
  embodiment: 'PerceptualEvidenceCompiler.compile',
  agency: 'AutonomousLearningMemoryGovernor.cycle',
  research: 'P77RealityExperimentOS.record',
};
const tick = 27;
const cycleId = 'nk1-cycle:' + tick;
const receipts = Object.entries(operations).map(([system, operation]) => ({
  id: cycleId + ':' + system,
  cycleId,
  tick,
  system,
  operation,
  status: 'completed',
  inputRefs: ['input-sha256:' + system.padEnd(64, '0').slice(0, 64)],
  outputRefs: ['output:' + system + ':' + tick],
  outputHash: 'a'.repeat(64),
  durationMs: 2,
}));

for (const receipt of receipts) {
  const result = validate(receipt, { tick, cycleId });
  assert.equal(result.ok, true, systemMessage(receipt.system));
  assert.equal(result.receipt.system, receipt.system);
  assert.equal(result.receipt.operation, receipt.operation);
  assert.equal(result.receipt.status, 'completed');
}

// Each system is bound to one real owner operation; callers cannot relabel another method.
assert.equal(validate({ ...receipts[0], operation: 'untrusted-method' }).ok, false);
assert.equal(validate({ ...receipts[1], system: 'memory' }).ok, false);
assert.equal(validate({ ...receipts[2], owner: 'unknown-owner' }).ok, false);
assert.equal(validate({ ...receipts[3], tick: tick + 1 }, { tick, cycleId }).ok, false);
assert.equal(validate({ ...receipts[4], cycleId: 'another-cycle' }, { tick, cycleId }).ok, false);
assert.equal(validate({ ...receipts[5], outputHash: 'not-a-hash' }).ok, false);
assert.equal(validate({ ...receipts[6], durationMs: -1 }).ok, false);

// Skips must be explicit and cannot claim a fabricated output.
assert.equal(validate({ ...receipts[3], status: 'skipped', outputRefs: [] }).ok, true);
assert.equal(validate({ ...receipts[3], status: 'skipped', outputRefs: ['output:claimed'] }).ok, false);
assert.equal(validate({ ...receipts[3], status: 'completed', outputRefs: [] }).ok, false);

// Hostile accessors and Proxies are rejected without invoking user-controlled code.
let getterInvoked = false;
const hostile = { ...receipts[0] };
Object.defineProperty(hostile, 'outputHash', {
  enumerable: true,
  get() { getterInvoked = true; throw new Error('must-not-run'); },
});
assert.equal(validate(hostile).ok, false);
assert.equal(getterInvoked, false);
assert.equal(validate(new Proxy(receipts[0], {})).ok, false);
assert.equal(validate(new Proxy(receipts, {})).ok, false);

console.log('COGNITIVE_SUBSYSTEM_INVOCATION_RECEIPTS=PASS', JSON.stringify({ owners: receipts.length, strictContracts: true, hostileInputs: true }));

function systemMessage(system) { return system + ' invocation receipt should validate'; }


const attentionReceipt = {
  id:cycleId+':attention',cycleId,tick,stage:'attention',owner:'OrganismCore.attend',
  status:'completed',inputRefs:[],outputRefs:['attention-state:'+tick],consumedStageReceipts:[],
  outputHash:'b'.repeat(64),
};
const memoryReceipt = {
  id:cycleId+':memory',cycleId,tick,stage:'memory',owner:'MemoryFabric.retrieveForCognition',
  status:'completed_empty',inputRefs:['query-sha256:'+'c'.repeat(64)],outputRefs:[],consumedStageReceipts:[],
  outputHash:'d'.repeat(64),
};
const fabric = new CognitiveEventFabric(128);
const ids = fabric.recordOperationalCycle({
  tick,
  observation:{source:'runtime'},
  prediction:{source:'reward-model'},
  appraisal:{source:'homeostatic-appraisal'},
  attention:{source:'OrganismCore.attend',receipt:attentionReceipt},
  memory:{source:'MemoryFabric.retrieveForCognition',receipt:memoryReceipt},
  goal:{source:'canonical-goal-selection'},
  plan:{source:'plan-engine'},
  action:{source:'organism-action-gate'},
  outcome:{source:'shadow-simulator'},
  learning:{source:'core.feedback'},
  selfUpdate:{source:'core.lifecycle'},
  subsystemReceipts:receipts,
});
const stageMap = {
  observation:ids.observation,prediction:ids.prediction,appraisal:ids.appraisal,
  attention:ids.attention,memory:ids.memory,goal:ids.goal,plan:ids.plan,
  action:ids.action,outcome:ids.outcome,learning:ids.learning,'self-update':ids.selfUpdate,
};
const verified = fabric.verifyOperationalCycle(stageMap,[attentionReceipt,memoryReceipt],undefined,receipts);
assert.equal(verified.subsystemInvocationVerification,'verified');
assert.equal(verified.subsystemInvocationComplete,true);
assert.equal(verified.missingSubsystemOwners.length,0);
assert.equal(verified.fullComplete,true);
assert.deepEqual(verified.skippedSubsystemOwners,[]);
const missingOwner = fabric.verifyOperationalCycle(stageMap,[attentionReceipt,memoryReceipt],undefined,receipts.slice(0,6));
assert.equal(missingOwner.subsystemInvocationComplete,false);
assert.ok(missingOwner.missingSubsystemOwners.includes('research'));
assert.equal(missingOwner.fullComplete,false);
const tampered = receipts.map((receipt,i)=>i===0?{...receipt,outputHash:'e'.repeat(64)}:receipt);
const mismatch = fabric.verifyOperationalCycle(stageMap,[attentionReceipt,memoryReceipt],undefined,tampered);
assert.equal(mismatch.subsystemInvocationComplete,false);
assert.ok(mismatch.invalidSubsystemOwnerEvidence.includes('self:cef-subsystem-receipt-mismatch'));

console.log('COGNITIVE_SUBSYSTEM_INVOCATION_RECEIPTS=PASS', JSON.stringify({owners:receipts.length,cefProjection:true,strictCycleGate:true}));
