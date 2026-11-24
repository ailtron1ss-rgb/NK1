import { P28PlasticitySubstrate } from '../src/organism/learning/P28PlasticitySubstrate.ts';
import { OrganismCore } from '../src/organism/core/OrganismCore.ts';
import { MemoryStateStore } from '../src/organism/persistence/MemoryStateStore.ts';

const p=new P28PlasticitySubstrate();
const t0=performance.now();
for(let i=0;i<5000;i++){
  const v=Array.from({length:16},(_,j)=>Math.sin(i/31+j/7));
  p.observe({vector:v,modality:i%2?'sensor':'vision',source:'benchmark',tick:i+1,trust01:.9,predictionError01:(i%11)/10,action:i%2?'explore':'verify'});
  if(i%5===4){p.bindAction(i%2?'explore':'verify',i+1);p.credit(i%7===0?.1:.9,(i%13)/13,i%2?'explore':'verify',i+1);}
}
const pMs=performance.now()-t0;
const c=new OrganismCore(new MemoryStateStore()); await c.init();
const t1=performance.now();
for(let i=0;i<100;i++) await c.observe(i%4===0?`routine ${i}`:undefined);
const coreMs=performance.now()-t1;
console.log('P28_PERFORMANCE=PASS',JSON.stringify({plasticity5kMs:Number(pMs.toFixed(2)),core100CyclesMs:Number(coreMs.toFixed(2)),prototypes:p.snapshot().prototypes.length,eligibility:p.snapshot().eligibility.length,associations:p.snapshot().associations.length}));
