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
  relations:[],events:[{id:'persisted-observation',label:'observed:camera-object',confidence01:.99,lastAt:5_000,
    persistence01:.9,evidenceKind:'observed',modalityEvidenceKinds:{vision:'observed',sensor:'derived'}}],
  facts:['observed:camera-object'],provenanceIds:['untrusted-restored-source'],lastHash:'attacker-controlled-hash',
});
const snapshot=world.snapshot();
assert.equal(snapshot.entities[0].modalityEvidenceKinds?.vision,'model-output');
assert.equal(snapshot.entities[0].modalityEvidenceKinds?.world,'model-output');
assert.equal(snapshot.entities[0].modalityEvidenceKinds?.sensor,'derived');
assert.equal(snapshot.entities[0].modalityEvidenceKinds?.text,'unresolved');
assert.equal(snapshot.events[0].evidenceKind,'model-output');
assert.equal(snapshot.events[0].modalityEvidenceKinds?.vision,'model-output');
assert.equal(snapshot.events[0].modalityEvidenceKinds?.sensor,'derived');
console.log('GROUNDED_WORLD_RESTORE_PROVENANCE=PASS');
