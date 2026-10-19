import assert from 'node:assert/strict';
import { AdaptiveCausalMemoryPlanner } from '../src/organism/cognition/AdaptiveCausalMemoryPlanner.ts';

const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const utilities=Object.fromEntries(actions.map(a=>[a,.5]));
const ctxOld=Array.from({length:12},(_,i)=>.12+i*.021);
const ctxNear=ctxOld.map((v,i)=>v+(i%3===0?.008:-.006));
const ctxConflict=ctxOld.map((v,i)=>v+(i%2===0?.11:-.10));
const latent=ctxOld.slice(0,8);

function step(planner,tick,context,action,reward,runDream=false,deltaScale=null){
  planner.beforeDecision({tick,context,latent,actionUtilities:utilities,forecast:[latent,latent,latent],forecastConfidence01:.88,disagreement01:.08,epistemicValue01:.3,computeBudget01:.8,retrieved:[],novelty01:.12,uncertainty01:.08,predictionError01:Math.abs(reward-.8),goalPressure01:.3});
  const scale=deltaScale ?? (action==='respond'?.01:-.005);
  planner.afterOutcome({tick,context,latent,nextLatent:latent.map((v,i)=>v+scale*(i%2?1:-1)),action,reward01:reward,predictionError01:Math.abs(reward-.8),verified01:.9,retrievedMemoryIds:[],counterfactualReward:new Array(7).fill(.55),forecastConfidence01:.88,disagreement01:.08});
  if(runDream && tick%8===0) planner.dreamRehearse(6);
}

const dream=new AdaptiveCausalMemoryPlanner();
const plain=new AdaptiveCausalMemoryPlanner();

// Phase 1: establish a useful stable skill.
for(let t=1;t<=500;t++){
  step(dream,t,t%2?ctxOld:ctxNear,'respond',.92,true);
  step(plain,t,t%2?ctxOld:ctxNear,'respond',.92,false);
}

const preDream=dream.metrics();
assert.ok(preDream.ruleCount>0,'stable rules were not learned');
assert.ok(preDream.dreamRehearsalCount>0,'dream rehearsal never activated');

// Phase 2: long distractor stream shifts action values and introduces contradictions.
for(let t=501;t<=2100;t++){
  const c=t%5===0?ctxOld:ctxNear;
  const a=t%3===0?'explore':'verify';
  const r=a==='explore'?.82:.76;
  const phaseConflict=t%5===0 && a==='explore';
  const scale=phaseConflict ? ((t/5)%2===0?.40:-.40) : (a==='explore'?.018:-.011);
  step(dream,t,c,a,r,t%16===0,scale);
  step(plain,t,c,a,r,false,scale);
}

// Phase 3: ask the old context to recover its action preference.
for(let t=2101;t<=2240;t++){
  step(dream,t,ctxOld,'respond',.94,t%16===0);
  step(plain,t,ctxOld,'respond',.94,false);
}

const dm=dream.metrics();
const pm=plain.metrics();
const dSkill=dm.protectedActionSkill01[0]??0;
const pSkill=pm.protectedActionSkill01[0]??0;
const dRetention=dm.skillRetention01[0]??0;
const pRetention=pm.skillRetention01[0]??0;

assert.ok(dm.dreamUpdates>0,'dream rehearsal produced no updates');
assert.ok(dSkill>=pSkill-.02,'dream rehearsal lost protected action skill badly');
assert.ok(dRetention>=pRetention-.02,'dream rehearsal retention collapsed');
assert.ok(dm.conflictCount>0,'conflict detection did not activate');
assert.ok(dm.negativeTransfer01>0,'negative transfer metric did not activate');
assert.ok(dm.lastDreamQuality01>=0,'dream quality invalid');
assert.ok(dm.forgettingDebt01>=0 && dm.forgettingDebt01<=1,'forgetting debt invalid');

// Direct conflict probe: a contradictory rule should be penalized rather than silently promoted.
const conflictBefore=dm.conflictCount;
step(dream,2241,ctxOld,'respond',.08,false,-.42);
const dm2=dream.metrics();
assert.ok(dm2.conflictCount>conflictBefore,'contradictory rule was not registered');
assert.ok(dm2.negativeTransfer01>=dm.negativeTransfer01-.02,'negative-transfer signal regressed unexpectedly');

// Persistence of the new learning state.
const restored=new AdaptiveCausalMemoryPlanner();
restored.restore(dream.snapshot());
const rm=restored.metrics();
assert.equal(rm.dreamUpdates,dm2.dreamUpdates,'dream updates not persisted');
assert.equal(rm.conflictCount,dm2.conflictCount,'conflict count not persisted');
assert.equal(rm.modelTime01,dm2.modelTime01,'model time not persisted');
assert.ok(Math.abs((rm.skillRetention01[0]??0)-(dm2.skillRetention01[0]??0))<1e-9,'skill retention changed after restore');

console.log('B2575_2586_DREAM_REHEARSAL_CONTINUITY_PASS');
console.log(JSON.stringify({
  dream:{dreamRehearsalCount:dm2.dreamRehearsalCount,dreamUpdates:dm2.dreamUpdates,protectedSkill:dSkill,retention:dRetention,forgettingDebt01:dm2.forgettingDebt01,conflictCount:dm2.conflictCount,negativeTransfer01:dm2.negativeTransfer01,lastDreamQuality01:dm2.lastDreamQuality01},
  plain:{dreamUpdates:pm.dreamUpdates,protectedSkill:pSkill,retention:pRetention,conflictCount:pm.conflictCount,negativeTransfer01:pm.negativeTransfer01},
  delta:{protectedSkill01:dSkill-pSkill,retention01:dRetention-pRetention}
},null,2));
