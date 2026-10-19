import assert from 'node:assert/strict';
import { BrainSubstrate } from '../src/organism/cognition/BrainSubstrate.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const brain=new BrainSubstrate();
const mk=(phase)=>Array.from({length:16},(_,i)=>Math.sin(i*.17+phase)*.55+Math.cos(i*.07+phase*.3)*.2);
let first=null;
for(let i=0;i<96;i++){
  const r=brain.observe(mk(i*.08),i,1000+i);
  if(i===0) first=brain.snapshot();
}
const snap=brain.snapshot();
assert.equal(snap.version,1);
assert.equal(snap.hidden.length,24);
assert.equal(snap.passiveSamples,96);
assert(snap.parameterUpdates>0);
assert.notDeepEqual(snap.hidden,first.hidden,'recurrent state must evolve from observations');
for(let i=0;i<32;i++) brain.learnAction('explore',.9,snap.predictionError01);
const learned=brain.snapshot();
assert.equal(learned.actionSamples,32);
assert(learned.actionRewardWeights.flat().some(v=>Math.abs(v)>0));
const restored=new BrainSubstrate(); restored.restore(learned);
assert.deepEqual(restored.snapshot(),learned,'brain substrate restore must be exact');

const core=new OrganismCore(new MemoryStateStore());
await core.init();
const world=(tick,uncertainty,fact)=>({tick,location:'brain-lab',energy:.8,attention:.82,uncertainty,facts:[fact],objects:[],events:[fact]});
for(let i=0;i<3;i++){
  await core.observe({text:`brain transition ${i}`,novelty:.7,worldContext:world(i,.5-(i%3)*.04,`f${i%2}`)});
  await core.feedback({success:.75,reward:.65,surprise:.12,worldTransition:{action:'explore',before:world(i,.5-(i%3)*.04,`f${i%2}`),after:world(i+1,.42-(i%2)*.03,`f${(i+1)%2}`),reward:.65,surprise:.12,at:2000+i}});
}
const state=core.snapshot();
assert(state.facets.cognition.brainSubstrate);
assert(state.facets.cognition.brainSubstrate.passiveSamples>0);
assert(state.facets.cognition.brainSubstrate.actionSamples>0);
console.log(JSON.stringify({pass:182,brain:{passiveSamples:state.facets.cognition.brainSubstrate.passiveSamples,actionSamples:state.facets.cognition.brainSubstrate.actionSamples,parameterUpdates:state.facets.cognition.brainSubstrate.parameterUpdates,quality:state.facets.cognition.brainSubstrate.qualityGate},recurrentNorm:Number(Math.sqrt(state.facets.cognition.brainSubstrate.hidden.reduce((s,x)=>s+x*x,0)).toFixed(5))},null,2));
