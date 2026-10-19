import assert from 'node:assert/strict';
import { MetacognitiveNeuralSubstrate } from '../src/organism/cognition/MetacognitiveNeuralSubstrate.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const input = (t) => ({
  centralLatent:Array.from({length:12},(_,i)=>Math.sin(t*.03+i*.1)),
  workspace:Array.from({length:6},(_,i)=>Math.cos(t*.04+i*.2)),
  selfLatent:[.8,.7,.6,.75],predictionError01:.2+(t%7)*.02,
  confidence01:.55+(t%5)*.05,worldUncertainty01:.25+(t%4)*.03,
  identityDrift01:.08+(t%3)*.02,actionOutcome01:t%2?.8:.3,tick:t,at:100000+t,
});

const m=new MetacognitiveNeuralSubstrate();
for(let t=0;t<96;t++)m.observe(input(t));
const a=m.snapshot();
assert.equal(a.learningSteps,96);assert.equal(a.hidden.length,32);assert.equal(a.lastOutput.length,6);
for(let t=96;t<192;t++)m.observe(input(t));
assert.equal(m.snapshot().stepCount,192);
const r=new MetacognitiveNeuralSubstrate();r.restore(m.snapshot());
assert.deepEqual(r.snapshot(),m.snapshot());

const c=new OrganismCore(new MemoryStateStore());
await c.init();
for(let t=0;t<4;t++){
  await c.observe({text:`meta ${t}`,novelty:.4,worldContext:{tick:t,location:'meta-lab',energy:.8,attention:.7,uncertainty:.3,facts:['meta'],objects:[],events:[]}});
  await c.feedback({success:.7,reward:.65,surprise:.15,worldTransition:{
    action:'reflect',before:{tick:t,location:'meta-lab',energy:.8,attention:.7,uncertainty:.3,facts:['meta'],objects:[],events:[]},
    after:{tick:t+1,location:'meta-lab',energy:.79,attention:.7,uncertainty:.31,facts:['meta','reflect'],objects:[],events:['reflect']},
    reward:.65,surprise:.15,at:200000+t}});
}
const snap=c.snapshot();const n=snap.facets.cognition.metacognitiveNeural;
assert(n?.learningSteps>=4);assert(n?.lastAt>=200000);
console.log(JSON.stringify({pass:188,standalone:m.globalState(),core:{learningSteps:n.learningSteps,calibration:n.calibrationError01,revision:n.revisionReadiness01}},null,2));
