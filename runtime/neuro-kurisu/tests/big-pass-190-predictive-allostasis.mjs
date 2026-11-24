import assert from 'node:assert/strict';
import { PredictiveAllostasisSubstrate } from '../src/organism/cognition/PredictiveAllostasisSubstrate.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const makeInput=(t,stress=0)=>({tick:t,at:100000+t,energy01:Math.max(.15,.78-t*.001-stress*.05),thermal01:.22+stress*.5,capacity01:Math.max(.35,.78-stress*.3),load01:.28+stress*.45,awake:true,uncertainty01:.18+stress*.4,predictionError01:.14+stress*.3,novelty01:.35+stress*.1,pressure01:.2+stress*.6,recoveryDebt01:.1+stress*.4,mode:stress>.6?'protect':'balance'});
const m=new PredictiveAllostasisSubstrate();
const baseline=[]; for(let t=0;t<8;t++) baseline.push(m.observe(makeInput(t,.3)).fastPredictionError01);
for(let t=8;t<208;t++)m.observe(makeInput(t,(t%12)/24));
const q=m.quality(); assert.equal(q.samples,208); assert.equal(Number.isFinite(q.modelError01),true);
assert.equal(q.samples,208); assert.equal(Number.isFinite(q.baselineError01),true);
const snap=m.snapshot(), r=new PredictiveAllostasisSubstrate(); r.restore(snap); assert.deepEqual(r.snapshot(),snap);
const a=r.observe(makeInput(128,.8)); assert(a.interventionUrgency01>.25); assert(a.overload01>.3);
const core=new OrganismCore(new MemoryStateStore());
await core.init();
for(let t=0;t<6;t++){
  await core.observe({text:`allostasis ${t}`,novelty:.25+(t%3)*.1,worldContext:{tick:t,location:'allostasis-lab',energy:.76,attention:.7,uncertainty:.2,facts:['homeostasis'],objects:[],events:[]},embodiment:{bodyEnergy01:.76-t*.01,thermalStrain01:t>3?.5:.24,cognitiveCapacity01:.74,awake:true,battery01:.8,cpuLoad01:.22,ramPressure01:.25,sensoryFreshness01:.9}});
  await core.feedback({success:.7,reward:.65,surprise:.12,worldTransition:{action:'observe',before:{tick:t,location:'allostasis-lab',energy:.76,attention:.7,uncertainty:.2,facts:['homeostasis'],objects:[],events:[]},after:{tick:t+1,location:'allostasis-lab',energy:.75,attention:.68,uncertainty:.22,facts:['homeostasis','feedback'],objects:[],events:['observe']},reward:.65,surprise:.12,at:100500+t}});
}
const cs=core.snapshot(); const pa=cs.facets.advanced.predictiveAllostasis; assert(pa?.learningSteps>=6); assert(pa?.predictionError01>=0 && pa?.predictionError01<=1);
console.log(JSON.stringify({pass:190,quality:q,afterStress:a,baselineMean:baseline.reduce((s,v)=>s+v,0)/baseline.length,core:{samples:pa.learningSteps,predictionError01:pa.predictionError01,overload01:pa.overload01,readiness01:pa.readiness01}},null,2));
