import assert from 'node:assert/strict';
import { CanonicalTemporalCreditAuthority } from '../src/organism/learning/CanonicalTemporalCreditAuthority.ts';

const authority=new CanonicalTemporalCreditAuthority({gamma01:.88,lambda01:.82,maxHorizonTicks:8});
for(let i=0;i<64;i++) authority.registerDecision({decisionId:`seed-${i}`,tick:i,action:['respond','explore','verify','rest','reflect','wait','defer'][i%7],contextKey:`ctx-${i}`,predicted01:.5,at:i});
const start=process.hrtime.bigint();
let assignments=0;
for(let i=64;i<10064;i++){
  authority.registerDecision({decisionId:`d-${i}`,tick:i,action:'explore',contextKey:`ctx-${i%16}`,predicted01:.45,at:i});
  assignments+=authority.resolveOutcome({decisionId:`d-${i}`,tick:i,reward01:(i%5)/4,verified01:1,independent01:1,autonomous01:1,at:i}).assignments.length;
}
const elapsedMs=Number(process.hrtime.bigint()-start)/1e6;
const snap=authority.snapshot();
assert.equal(snap.pending.length<=64,true);
assert.equal(snap.recentAssignments.length<=128,true);
assert(assignments>9000);
assert(elapsedMs<5000);
console.log('R4_TEMPORAL_CREDIT_PERFORMANCE_PASS',JSON.stringify({iterations:10000,assignments,elapsedMs:Number(elapsedMs.toFixed(3)),pending:snap.pending.length,recentAssignments:snap.recentAssignments.length,stateBytes:Buffer.byteLength(JSON.stringify(snap))}));
