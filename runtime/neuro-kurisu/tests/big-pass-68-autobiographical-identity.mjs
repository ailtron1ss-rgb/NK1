import assert from 'node:assert/strict';
import { P84AutobiographicalContinuityFabric } from '../src/organism/developmental/P84AutobiographicalContinuityFabric.ts';
const f=new P84AutobiographicalContinuityFabric(48);
const base={tick:1,at:1000,action:'verify',outcome01:1,realityHash:'aaaa',realityRevision:1,realityConfidence01:.8,decisionId:'d1',predictionIds:['p1'],observationIds:['o1'],memoryIds:['m1','m2'],evidenceIds:['e1'],activeGoalIds:['g1'],identity01:.9,authorship01:.8,p78Continuity01:.8,p78Coherence01:.8,narrativeContinuity01:.8,causalLinks01:.9,sourceEventIds:['ev1','ev2'],significance01:.8,changeSummary:'verified outcome'};
let s=f.ingest(base); assert.equal(s.moments.length,1); assert.ok(s.moments[0].sourceEventIds.includes('ev1'));
s=f.ingest({...base,tick:2,at:2000,realityHash:'bbbb',realityRevision:2,identity01:.66,outcome01:0,observationIds:['o2'],sourceEventIds:['ev3']});
assert.equal(s.moments.length,2); const m=s.moments.at(-1); assert.ok(m.identityDelta01>=.2); assert.ok(m.realityDelta01>0); assert.ok(m.learningSignal01>.5); assert.ok(m.identityChangeReasons.includes('identity-drift')); assert.ok(s.identityChangeCount>=1);
const restored=new P84AutobiographicalContinuityFabric(48); restored.restore(s); const r=restored.summary(); assert.equal(r.identityChangeCount,s.identityChangeCount); assert.equal(restored.recent(1)[0].sourceEventIds[0],'ev3');
console.log(`BIG_PASS_68_AUTOBIOGRAPHICAL_IDENTITY=PASS revisions=${r.revision} identityChanges=${r.identityChangeCount} selfChangeLoad=${r.selfChangeLoad01.toFixed(3)} memoryBinding=${r.memoryBinding01.toFixed(3)}`);
