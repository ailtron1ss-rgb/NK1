import assert from 'node:assert/strict';
import { CognitiveResearchBattery } from '../src/organism/learning/CognitiveResearchBattery.ts';

function build(){
  const b=new CognitiveResearchBattery();
  const p=b.createProtocol({
    id:'  repro 180  ',
    hypothesisKey:'memory   consistency',
    taskIds:['t1','t2'],
    contextKeys:['ctx a','ctx b','ctx c'],
    delaysMs:[1000,2000,3000],
    requiredMatchedPairs:6,
    requiredHoldout:2,
    randomized:true,
    balanced:true,
    blinded:true,
    evaluatorVersion:'eval 180',
    seed:180123,
    release:'35.6.1',
    stateSchema:117,
    at:1800000000000,
  });
  const s=b.createSession(p.id,'session-180',1800000001000);
  return {b,p,s};
}
const a=build(), b=build();
assert.equal(a.p.id,'repro 180');
assert.equal(a.p.hypothesisKey,'memory consistency','whitespace normalization failed');
assert.deepEqual(a.s.schedule,b.s.schedule,'same protocol/seed must be deterministic');
assert.equal(a.s.scheduleHash,b.s.scheduleHash);
assert.equal(a.p.preregistrationHash,b.p.preregistrationHash);
const c=new CognitiveResearchBattery();
c.restore(a.b.snapshot());
assert.deepEqual(c.snapshot().schedules,a.b.snapshot().schedules);
assert.equal(c.snapshot().protocols[0].capsule.protocolHash,a.p.preregistrationHash);
console.log(JSON.stringify({pass:180,checks:{whitespaceNormalization:true,sameSeedSameSchedule:true,sameProtocolHash:true,restoreStable:true},scheduleHash:a.s.scheduleHash,protocolHash:a.p.preregistrationHash},null,2));
