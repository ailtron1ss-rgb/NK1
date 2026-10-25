import assert from 'node:assert/strict';
import { AdaptiveExperienceConsolidator } from '../src/organism/memory/AdaptiveExperienceConsolidator.ts';

const consolidator=new AdaptiveExperienceConsolidator(16);
const base=(overrides={})=>({
  id:'experience-1',timestamp:100,novelty:.7,utility:.8,uncertainty:.2,tags:['memory','learning'],...overrides,
});
consolidator.ingest(base());
assert.equal(consolidator.size(),1);
const valid=base({id:'stable',timestamp:150});
const oldDuplicate=base({id:'duplicate',timestamp:160,utility:.2});
const newestDuplicate=base({id:'duplicate',timestamp:200,novelty:2,utility:1.4,uncertainty:-.5,tags:['latest','valid']});
consolidator.restore([
  valid,
  oldDuplicate,
  base({id:'poisoned-number',timestamp:170,utility:NaN}),
  base({id:'poisoned-time',timestamp:Infinity}),
  newestDuplicate,
  null,
  {id:'bad-tags',timestamp:180,novelty:.5,utility:.5,uncertainty:.5,tags:'not-an-array'},
]);
assert.deepEqual(consolidator.snapshot(),[
  {id:'stable',timestamp:150,novelty:.7,utility:.8,uncertainty:.2,tags:['memory','learning']},
  {id:'duplicate',timestamp:200,novelty:1,utility:1,uncertainty:0,tags:['latest','valid']},
],'restore keeps valid records, normalizes finite scores and chooses the newest duplicate identity');
const scores=consolidator.consolidate();
assert.ok(scores.length===2&&scores.every(row=>Number.isFinite(row.retentionScore)&&row.retentionScore>=0&&row.retentionScore<=1));
assert.equal(consolidator.snapshot()[0].id,'stable','consolidation must remain a read-only projection');

let getterCalls=0;
const hostile={timestamp:1,novelty:.5,utility:.5,uncertainty:.5,tags:[]};
Object.defineProperty(hostile,'id',{enumerable:true,get(){getterCalls++;return 'forged';}});
assert.throws(()=>consolidator.ingest(hostile),/invalid experience record/);
assert.equal(getterCalls,0,'ingest must reject accessor-backed records without executing getters');
assert.equal(consolidator.size(),2,'rejected input must not mutate the buffer');
const hostileArray=[];
Object.defineProperty(hostileArray,'0',{enumerable:true,get(){getterCalls++;return valid;}});
hostileArray.length=1;
consolidator.restore(hostileArray);
assert.equal(getterCalls,0,'restore must not execute accessor-backed array entries');
assert.equal(consolidator.size(),0,'accessor-backed restore arrays fail closed');
console.log('ADAPTIVE_EXPERIENCE_CONSOLIDATOR_RESTORE=PASS');
