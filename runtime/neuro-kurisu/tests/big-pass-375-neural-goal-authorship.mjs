import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const vector=t=>Array.from({length:64},(_,i)=>Math.max(-1,Math.min(1,Math.sin((t+i)*.17)*.32+Math.cos((t*.07+i)*.23)*.18)));
const makeContext=()=>Object.fromEntries(actions.map((a,i)=>[a,{worldUtility01:.52+(a==='explore'?.10:0),worldConfidence01:.72,worldUncertainty01:.28,needRelief01:a==='verify'?.64:.42,predictedCost01:a==='explore'?.35:.30}]));
const policyMap=f=>actions.reduce((o,a,i)=>(o[a]=f.actionProbabilities[a]??0,o),{});
const l1policy=(a,b)=>actions.reduce((s,k)=>s+Math.abs((a[k]??0)-(b[k]??0)),0);

const makeCandidate=(source='internal', id='goal-A')=>({
  candidateId:id, vector:[.82,.18,.54,-.08,.62,.26,.74,.48], source,
  novelty01:.72, confidence01:.78, internalPressure01:.76, homeostaticPressure01:.34,
  identityContinuity01:.88, autonomy01:.86,
});

const run=()=>{
  const on=new B365UnifiedNeuroCausalCore();
  const off=new B365UnifiedNeuroCausalCore(); off.setGoalAuthorshipEnabled(false);
  const before=on.snapshot();
  const staged=on.setGoalAuthorshipCandidate({tick:1,...makeCandidate()});
  assert.equal(staged.accepted,true,'strong internal candidate must be ownable');
  const external=on.setGoalAuthorshipCandidate({tick:2,...makeCandidate('external','goal-external')});
  assert.equal(external.accepted,false,'external candidate must not become owned merely by presentation');
  on.setGoalAuthorshipCandidate({tick:3,...makeCandidate()});
  const f1=on.step({tick:3,vector:vector(3),novelty01:.72,uncertainty01:.66,goalPressure01:.68,autonomy01:.86,goalAuthorship:makeCandidate(),actionContext:makeContext(),learningEnabled:false});
  const fOff=off.step({tick:3,vector:vector(3),novelty01:.72,uncertainty01:.66,goalPressure01:.68,autonomy01:.86,goalAuthorship:makeCandidate(),actionContext:makeContext(),learningEnabled:false});
  const p1=policyMap(f1), pOff=policyMap(fOff);
  const r0=structuredClone(on.snapshot().goalAuthorship.readout);
  on.learnFromOutcome({tick:4,action:'explore',reward01:.92,predictionError01:.08,verified01:1,externalEvidence01:1,novelty01:.72,actualUtility01:.92,actualStateDelta01:.42});
  const after=on.snapshot();
  const delta=after.goalAuthorship.readout.reduce((s,row,i)=>s+row.reduce((q,v,j)=>q+Math.abs(v-(r0[i]?.[j]??0)),0),0);
  assert(delta>0,'verified outcome must change neural goal-authorship readout');
  const f2=on.step({tick:5,vector:vector(5),novelty01:.72,uncertainty01:.66,goalPressure01:.68,autonomy01:.86,goalAuthorship:makeCandidate(),actionContext:makeContext(),learningEnabled:false});
  const divergence=l1policy(policyMap(f2),pOff);
  assert(divergence>.01,'goal authorship learning must causally diverge future policy from ownership-OFF');
  const beforeUnverified=structuredClone(on.snapshot().goalAuthorship.readout);
  on.learnFromOutcome({tick:6,action:'explore',reward01:.95,predictionError01:.05,verified01:0,externalEvidence01:0,novelty01:.72,actualUtility01:.95,actualStateDelta01:.5});
  const afterUnverified=on.snapshot().goalAuthorship.readout;
  const unverifiedDelta=afterUnverified.reduce((s,row,i)=>s+row.reduce((q,v,j)=>q+Math.abs(v-(beforeUnverified[i]?.[j]??0)),0),0);
  assert.equal(unverifiedDelta,0,'unverified outcome must not mutate goal-authorship readout');
  const persisted=on.snapshot();
  const resumed=new B365UnifiedNeuroCausalCore(); resumed.restore(persisted);
  assert.deepEqual(resumed.snapshot().goalAuthorship, persisted.goalAuthorship,'goal authorship must persist across restart');
  const diag=resumed.goalAuthorshipDiagnostics();
  assert(diag.verifiedOutcomes>=1,'verified outcome counter must persist');
  assert(diag.counterfactualChecks>=2,'counterfactual evidence must accumulate');
  assert(diag.acceptedGoals>=1,'internal goal must be accepted');
  assert(diag.rejectedGoals>=1,'external goal must be rejected by ownership gate');
  return {pass:true, causal:{initialPolicyOn:p1,policyOff:pOff,futurePolicy:policyMap(f2),onOffInitialL1:l1policy(p1,pOff),futureDivergenceFromOff:divergence,readoutDeltaL1:delta,unverifiedReadoutDeltaL1:unverifiedDelta}, authorship:{acceptedGoals:diag.acceptedGoals,rejectedGoals:diag.rejectedGoals,verifiedOutcomes:diag.verifiedOutcomes,counterfactualChecks:diag.counterfactualChecks,ownership01:diag.ownership01,commitment01:diag.commitment01,revisionPressure01:diag.revisionPressure01}, persistence:{equal:JSON.stringify(resumed.snapshot().goalAuthorship)===JSON.stringify(persisted.goalAuthorship)}};
};

const t0=performance.now();
const result=run();
result.elapsedMs=performance.now()-t0;
console.log(JSON.stringify(result));
