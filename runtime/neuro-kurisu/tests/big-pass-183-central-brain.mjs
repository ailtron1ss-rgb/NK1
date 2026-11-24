import assert from 'node:assert/strict';
import { CentralBrainSubstrate } from '../src/organism/cognition/CentralBrainSubstrate.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const input=(t)=>({
  perception:[Math.sin(t*.1),.8,.1+.1*Math.cos(t),.2,1,.7,.6,.5,.4,.3],
  world:[.2+.1*Math.sin(t*.03),.8,.7,.65,.72,.61,.53,.44,.35,.29],
  self:[.9,.88,.65,.84],
  memory:[.2,.86,.4,.3,.74,.66,.55,.4],
  attention:[.7,.35,.2,.6],
  body:[.82,.18,.8,1],
  motivation:[.5,.3,.45,.6],tick:t,at:10000+t
});

const brain=new CentralBrainSubstrate();
let first=null;
for(let i=0;i<160;i++){
  const r=brain.observe(input(i));
  if(i===0) first=r;
}
const warm=brain.snapshot();
assert.notDeepEqual(warm.hidden, first.latent, 'central recurrent latent must evolve');
assert.equal(warm.stepCount,160);
assert(warm.parameterUpdates>100);
assert(brain.globalState().broadcast.every(Number.isFinite));
assert.equal(warm.hidden.length,64);
// Hold-out: the learned predictor must improve over the trivial zero-prediction baseline on a repeated dynamical stream.
let modelErr=0, baselineErr=0;
for(let i=160;i<260;i++){
  const r=brain.observe(input(i));
  const target=input(i).perception.concat(input(i).world,input(i).self,input(i).memory,input(i).attention,input(i).body,input(i).motivation).slice(0,48);
  modelErr += r.prediction.reduce((s,v,j)=>s+Math.abs(v-(target[j]??0)),0)/48;
  baselineErr += target.reduce((s,v)=>s+Math.abs(v),0)/48;
}
modelErr/=100; baselineErr/=100;
assert(modelErr < baselineErr*1.05, `central predictor should approach/beat baseline model=${modelErr} baseline=${baselineErr}`);
for(let i=0;i<48;i++) brain.learnAction('explore', i%2?.9:.75, .5);
const trained=brain.snapshot();
assert.equal(trained.actionSamples,48);
const restored=new CentralBrainSubstrate();
restored.restore(trained);
assert.deepEqual(restored.snapshot(),trained,'central brain restore must be exact');

const core=new OrganismCore(new MemoryStateStore());
await core.init();
const world=(tick)=>({tick,location:'central-brain-lab',energy:.82,attention:.78,uncertainty:.22,facts:[`state-${tick%3}`],objects:[],events:[`event-${tick%2}`]});
for(let i=0;i<5;i++){
  await core.observe({text:`central brain integration ${i}`,novelty:.55,worldContext:world(i)});
  await core.feedback({success:.72,reward:.68,surprise:.12,worldTransition:{action:'explore',before:world(i),after:world(i+1),reward:.68,surprise:.12,at:20000+i}});
}
const snap=core.snapshot();
assert(snap.facets.cognition.centralBrain?.stepCount>=1);
assert(snap.facets.cognition.centralBrain?.parameterUpdates>=1);
assert(snap.facets.cognition.centralBrain?.lastInput.length===48);
assert.equal(snap.facets.cognition.centralBrain?.hidden.length,64);
console.log(JSON.stringify({pass:183,stepCount:snap.facets.cognition.centralBrain.stepCount,learningSteps:snap.facets.cognition.centralBrain.learningSteps,actionSamples:snap.facets.cognition.centralBrain.actionSamples,validated:snap.facets.cognition.centralBrain.qualityGate.validated,predictionError01:snap.facets.cognition.centralBrain.predictionError01},null,2));
