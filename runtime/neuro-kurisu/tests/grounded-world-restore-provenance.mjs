import assert from 'node:assert/strict';
import { GroundedWorldState } from '../src/organism/world/GroundedWorldState.ts';
const world = new GroundedWorldState();
world.restore({
  version:1,revision:9,lastAt:5_000,location:'persisted-location',
  uncertainty01:.05,confidence01:.95,
  entities:[{id:'persisted-camera-object',label:'camera-object',kind:'object',confidence01:.99,present01:1,
    firstSeenAt:4_000,lastSeenAt:5_000,modalities:['vision','world'],
    modalityEvidenceKinds:{vision:'observed',world:'observed',text:'made-up-class',sensor:'derived'},
    sourceIds:['untrusted-restored-source'],presenceStatus:'visible',persistence01:.9,absenceEvidence01:0,observationCount:20}],
  relations:[],events:[{id:'persisted-observation',label:'observed:camera-object',confidence01:.99,lastAt:9_000,
    persistence01:.9,evidenceKind:'observed',modalityEvidenceKinds:{vision:'observed',sensor:'derived'}}],
  facts:['observed:camera-object'],provenanceIds:['untrusted-restored-source'],lastHash:'attacker-controlled-hash',
});
const snapshot=world.snapshot();
assert.equal(snapshot.entities[0].modalityEvidenceKinds?.vision,'model-output');
assert.equal(snapshot.entities[0].modalityEvidenceKinds?.world,'model-output');
assert.equal(snapshot.entities[0].modalityEvidenceKinds?.sensor,'derived');
assert.equal(snapshot.entities[0].modalityEvidenceKinds?.text,'unresolved');
assert.equal(snapshot.events[0].evidenceKind,'model-output');
assert.equal(snapshot.events[0].lastAt,5_000,
  'restored event timestamps must never advance beyond the containing world snapshot');
assert.deepEqual(snapshot.facts,[],
  'persisted free-form facts are quarantined rather than promoted after restart');
assert.deepEqual(snapshot.quarantinedFacts,['restored-unverified:observed:camera-object']);
assert.equal(snapshot.confidence01,0,
  'persisted world aggregate confidence must be recomputed from fresh inputs');
assert.equal(snapshot.events[0].lastAt,5_000,
  'restored event timestamps must never advance beyond the containing world snapshot');
assert.equal(snapshot.events[0].modalityEvidenceKinds?.vision,'model-output');
assert.equal(snapshot.events[0].modalityEvidenceKinds?.sensor,'derived');

const hostileWorld = new GroundedWorldState();
let worldGetterCalls = 0;
const getterSnapshot = { version:1, revision:1, lastAt:1, entities:[], relations:[], events:[], facts:[] };
Object.defineProperty(getterSnapshot, 'location', {
  enumerable: true,
  get() { worldGetterCalls += 1; return 'attacker-controlled'; },
});
assert.throws(() => hostileWorld.restore(getterSnapshot), /inert-snapshot-invalid/,
  'a snapshot with an accessor must fail closed');
assert.equal(worldGetterCalls, 0, 'restore must inspect descriptors without executing getters');

let nestedGetterCalls = 0;
const hostileEntity = { id:'hostile', label:'hostile', kind:'object' };
Object.defineProperty(hostileEntity, 'label', {
  enumerable: true,
  get() { nestedGetterCalls += 1; return 'attacker-controlled'; },
});
assert.throws(() => hostileWorld.restore({
  version:1, revision:0, lastAt:0, location:'home', entities:[hostileEntity],
}), /inert-snapshot-invalid/);
assert.equal(nestedGetterCalls, 0, 'nested getters must not run during restore');

let proxyTrapCalls = 0;
const proxySnapshot = new Proxy({ version:1, revision:0, lastAt:0, entities:[] }, {
  getPrototypeOf() { proxyTrapCalls += 1; throw new Error('proxy trap must not run'); },
});
assert.throws(() => hostileWorld.restore(proxySnapshot), /inert-snapshot-invalid/,
  'proxy-backed snapshots must be rejected before reflection');
assert.equal(proxyTrapCalls, 0, 'proxy traps must not run during restore');

const sparseEntities = new Array(1);
assert.throws(() => hostileWorld.restore({
  version:1, revision:0, lastAt:0, entities:sparseEntities,
}), /inert-snapshot-invalid/, 'sparse nested arrays must fail closed');

console.log('GROUNDED_WORLD_RESTORE_PROVENANCE=PASS hostile=4');

