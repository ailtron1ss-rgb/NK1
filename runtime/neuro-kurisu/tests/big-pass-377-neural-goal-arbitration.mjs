import assert from 'node:assert/strict';
import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const vec=(seed,scale=.42)=>Array.from({length:64},(_,i)=>Math.max(-1,Math.min(1,Math.sin((seed+i)*.11)*scale+Math.cos((seed*.07+i)*.19)*.18)));
const ctx=()=>Object.fromEntries(actions.map((a,i)=>[a,{worldUtility01:.52+(a==='verify'?.08:0)+(a==='rest'?.02:0),worldConfidence01:.80,worldUncertainty01:.20,needRelief01:a==='verify'?.62:.40,predictedCost01:a==='explore'?.32:.22}]));
const goal=(id,overrides={})=>({candidateId:id,vector:id==='goal-a'?[.88,.12,.70,-.10,.82,.24,.76,.52]:[.14,.84,-.42,.54,.28,.76,.22,-.58],source:'internal',novelty01:.58,confidence01:.81,internalPressure01:.79,homeostaticPressure01:.36,identityContinuity01:.90,autonomy01:.92,...overrides});

const on=new B365UnifiedNeuroCausalCore();
// Seed two legitimate internal goals once. Thereafter NO external goal reseeding is used.
on.step({tick:1,vector:vec(1),novelty01:.56,uncertainty01:.44,goalPressure01:.65,autonomy01:.92,goalAuthorship:goal('goal-a'),actionContext:ctx(),learningEnabled:false});
on.step({tick:2,vector:vec(2),novelty01:.66,uncertainty01:.58,goalPressure01:.71,autonomy01:.90,goalAuthorship:goal('goal-b'),actionContext:ctx(),learningEnabled:false});
let d=on.goalEcologyDiagnostics();
assert(d.memories.length>=2,'ecology must retain multiple candidate goals');
const initialCandidate=on.snapshot().goalAuthorship.candidateId;
assert.equal(initialCandidate,'goal-b');

// Make the current goal stale/costly through verified negative outcomes. The arbiter must switch
// to the already-known alternative without another goalAuthorship input.
for(let t=3;t<=9;t++){
  const s=on.step({tick:t,vector:vec(t),novelty01:.48,uncertainty01:.75,predictionError01:.78,goalPressure01:.66,autonomy01:.86,actionContext:ctx(),learningEnabled:true});
  on.learnFromOutcome({tick:t,action:s.selectedAction,reward01:.08,predictionError01:.78,verified01:1,externalEvidence01:.92,actualUtility01:.10,actualWorldConfidence01:.74,novelty01:.60,actualStateDelta01:.62});
}
d=on.goalEcologyDiagnostics();
const switchedId=on.snapshot().goalAuthorship.candidateId;
assert.notEqual(switchedId,initialCandidate,'goal ecology must autonomously switch away from a stale/failed current goal');
assert(d.totalSwitches>=1,'autonomous goal switch must be recorded');
assert(d.autonomousReplans>=1,'autonomous replan count must increase');
assert(d.totalSwitches>=1,'switch transition must be observable through transition counter');
assert(['paused-current','stagnant-or-conflicted','continue-current','insufficient-margin'].includes(d.lastDecisionReason),'arbitration reason must be observable');

// Good verified outcomes should increase life-course state rather than repeatedly reseeding the goal.
const beforeLife=d.lifeCourse01;
for(let t=10;t<=26;t++){
  const s=on.step({tick:t,vector:vec(t,.36),novelty01:.32,uncertainty01:.22,predictionError01:.08,goalPressure01:.44,autonomy01:.95,actionContext:ctx(),learningEnabled:true});
  on.learnFromOutcome({tick:t,action:s.selectedAction,reward01:.90,predictionError01:.08,verified01:1,externalEvidence01:.94,actualUtility01:.88,actualWorldConfidence01:.88,novelty01:.30,actualStateDelta01:.44});
}
d=on.goalEcologyDiagnostics();
assert(d.lifeCourse01>beforeLife,'life-course state must respond to successful verified goal pursuit');
assert(d.autonomousCycles>0 && d.selfContinuationCycles>0,'goal pursuit must remain self-directed');

// Unverified experience must not mutate goal ecology learning state.
const beforeUnverified=structuredClone(d);
const s=on.step({tick:27,vector:vec(27),novelty01:.30,uncertainty01:.26,predictionError01:.12,goalPressure01:.40,autonomy01:.94,actionContext:ctx(),learningEnabled:true});
on.learnFromOutcome({tick:27,action:s.selectedAction,reward01:.99,predictionError01:.01,verified01:0,externalEvidence01:0,actualUtility01:.99,actualWorldConfidence01:.99,novelty01:.30,actualStateDelta01:.88});
const afterUnverified=on.goalEcologyDiagnostics();
assert.equal(afterUnverified.totalSwitches,beforeUnverified.totalSwitches,'unverified evidence must not mutate switch count');
assert.equal(afterUnverified.completed,beforeUnverified.completed,'unverified evidence must not complete goals');
assert.equal(afterUnverified.successorCreations,beforeUnverified.successorCreations,'unverified evidence must not create successors');

// Restart persistence
const saved=on.snapshot(); const restored=new B365UnifiedNeuroCausalCore(); restored.restore(saved);
assert.deepEqual(restored.snapshot().goalEcology,saved.goalEcology,'goal ecology must persist exactly across restart');
assert.deepEqual(restored.snapshot().goalAuthorship,saved.goalAuthorship,'goal authorship must persist exactly across restart');

// OFF ablation: ecology must not autonomously switch or evolve lifecycle.
const off=new B365UnifiedNeuroCausalCore(); off.setGoalEcologyEnabled(false);
off.step({tick:1,vector:vec(1),novelty01:.56,uncertainty01:.44,goalPressure01:.65,autonomy01:.92,goalAuthorship:goal('goal-a'),actionContext:ctx(),learningEnabled:false});
off.step({tick:2,vector:vec(2),novelty01:.66,uncertainty01:.58,goalPressure01:.71,autonomy01:.90,goalAuthorship:goal('goal-b'),actionContext:ctx(),learningEnabled:false});
for(let t=3;t<=10;t++){
  const ss=off.step({tick:t,vector:vec(t),novelty01:.48,uncertainty01:.75,predictionError01:.78,goalPressure01:.66,autonomy01:.86,actionContext:ctx(),learningEnabled:true});
  off.learnFromOutcome({tick:t,action:ss.selectedAction,reward01:.08,predictionError01:.78,verified01:1,externalEvidence01:.92,actualUtility01:.10,actualWorldConfidence01:.74,novelty01:.60,actualStateDelta01:.62});
}
const offD=off.goalEcologyDiagnostics();
assert.equal(offD.totalSwitches,0,'OFF must eliminate autonomous goal switching');
assert.equal(offD.autonomousReplans,0,'OFF must eliminate autonomous replanning');

console.log(JSON.stringify({pass:true,initialCandidate,switchedId,totalSwitches:d.totalSwitches,autonomousReplans:d.autonomousReplans,lastDecisionReason:d.lastDecisionReason,lifeCourse01:d.lifeCourse01,competitionEntropy01:d.competitionEntropy01,currentProgress01:d.currentProgress01,memory:d.memories.map(m=>({id:m.id,status:m.status,progress01:m.progress01,resourceCost01:m.resourceCost01,stagnation01:m.stagnation01,priority01:m.priority01})),restartEqual:true,unverifiedBlocked:true,off:{totalSwitches:offD.totalSwitches,autonomousReplans:offD.autonomousReplans}}));
