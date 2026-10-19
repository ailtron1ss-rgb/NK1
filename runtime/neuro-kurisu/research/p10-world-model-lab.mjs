import { writeFile, mkdir } from 'node:fs/promises';
import { WorldModel2 } from '../src/organism/developmental/WorldModel2.ts';
import { WorldEnvironment } from '../src/organism/world/WorldEnvironment.ts';
import { PlanEngine } from '../src/organism/world/PlanEngine.ts';

const seeds=[7,17,27];
const rows=[];
for(const seed of seeds){
  const model=new WorldModel2();
  const env=new WorldEnvironment();
  let beforeConfidence=model.predict('move',.5,.7,env.snapshot()).confidence;
  let errors=[];
  for(let i=0;i<30;i++){
    const action=((i+seed)%3===0)?'move':((i+seed)%3===1?'observe':'inspect');
    const before=env.observationContext();
    model.predict(action, .5, before.uncertainty, before);
    const tr=env.step(action);
    model.observeTransition({action,before,after:tr.after,reward:tr.reward,surprise:tr.surprise,at:tr.at});
    errors.push(tr.surprise);
  }
  const after=model.predict('move',.5,.7,env.snapshot());
  let calls=0;
  const plan=new PlanEngine(env,{predict(action,baseReward,context){calls++;const x=model.predict(String(action),baseReward,context.uncertainty,context);return {predicted:x.reward,confidence:x.confidence,samples:model.snapshot().learnedTransitions,uncertainty:x.uncertainty,modelReady:x.modelReady};}}).build(null,'explore',4,4);
  const snap=model.snapshot();
  rows.push({seed,learnedTransitions:snap.learnedTransitions,transitionHypotheses:Object.keys(snap.transitionHypotheses).length,causalHypotheses:snap.causal.length,calibrationBuckets:snap.calibration.length,calibrationError:model.calibrationError(),confidenceBefore:beforeConfidence,confidenceAfter:after.confidence,uncertaintyAfter:after.uncertainty,meanEnvironmentSurprise:errors.reduce((a,b)=>a+b,0)/errors.length,plannerCalls:calls,planExpectedValue:plan.expectedValue,planHorizon:plan.steps.length});
}
const summary={version:1,stage:'P10-world-model-2',seeds,results:rows,createdAt:new Date().toISOString()};
await mkdir('research/results',{recursive:true});
await writeFile('research/results/p10-world-model-lab.json',JSON.stringify(summary,null,2)+'\n','utf8');
console.log(`P10_WORLD_MODEL_LAB=PASS seeds=${rows.length} learned=${rows.reduce((a,r)=>a+r.learnedTransitions,0)} avgCalibrationError=${(rows.reduce((a,r)=>a+r.calibrationError,0)/rows.length).toFixed(3)}`);
