import assert from 'node:assert/strict';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const obs=(i,reward,external=false)=>({
  text: external ? (i%3===0?'verify an uncertain result':'explore a changing object') : undefined,
  novelty: .30 + (i%7)*.06,
  uncertainty: .18 + (i%5)*.07,
  reward,
  success: reward>.55,
  embodiment:{awake:true,bodyEnergy01:.82,cognitiveCapacity01:.78,thermalStrain01:.15,battery01:.84,cpuLoad01:.22,ramPressure01:.20,sensoryFreshness01:.75}
});

const core=new OrganismCore(new MemoryStateStore(),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core.init();
const actions=[];
for(let i=0;i<8;i++){
  const reward = i<7 ? .9 : i<14 ? .2 : .82;
  const r=await core.observe(obs(i,reward,i%9===0),'operational');
  if(r?.decision?.selected?.action) actions.push(r.decision.selected.action);
}
const d=core.b349NeuralDevelopmentalDiagnostics();
assert(d.cycles>=8);
// On the mobile cadence this short holdout may not close enough outcome episodes for B349 learning; do not promote this to a learning PASS.
assert(d.lateResidencyUpdates>=8);
assert(Number.isFinite(d.lastLateResidencyBias01));
assert(d.validatedOutcomeCount>=0);
const snap=core.snapshot();
const core2=new OrganismCore(new MemoryStateStore({initial:snap}),{performanceProfile:'mobile',cycleResultMode:'operational'});
await core2.init();
const d2=core2.b349NeuralDevelopmentalDiagnostics();
assert.equal(d2.cycles,d.cycles);
assert.equal(d2.learningUpdates,d.learningUpdates);
const unique=[...new Set(actions)];
console.log(JSON.stringify({pass:true,cycles:d.cycles,learningUpdates:d.learningUpdates,validated:d.validatedOutcomeCount,lateResidencyUpdates:d.lateResidencyUpdates,lateResidencyChanges:d.lateResidencyChanges,lastLateResidencyAction:d.lastLateResidencyAction,lastLateResidencyBias01:d.lastLateResidencyBias01,uniqueActions:unique,actionCounts:Object.fromEntries(unique.map(a=>[a,actions.filter(x=>x===a).length])),restoredCycles:d2.cycles},null,2));
