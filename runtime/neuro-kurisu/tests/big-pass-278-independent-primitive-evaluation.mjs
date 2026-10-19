import assert from 'node:assert/strict';
import { B278NeuralPrimitiveGenesis } from '../src/organism/cognition/B278NeuralPrimitiveGenesis.ts';
const g=new B278NeuralPrimitiveGenesis();
const base={goalVector:[.55,.4,.35,.6,.25,.45,.5,.5],selfLatent:Array.from({length:16},(_,i)=>Math.sin(i*.17)),neuralAssembly:Array.from({length:16},(_,i)=>.15+(i%5)*.03),operatorOutput:Array.from({length:12},(_,i)=>Math.sin(i*.13)),operatorId:'op277-hidden-world',programLatent:Array.from({length:12},(_,i)=>Math.cos(i*.19)),programId:'prog276-hidden-world',personalityBias:{explore:.54,verify:.53,reflect:.52,respond:.5,rest:.42,wait:.4,defer:.38},autonomy01:.8,novelty01:.68,predictionError01:.2,traitValues:{curiosity:.78,'truth-seeking':.72,'self-reflection':.68,persistence:.78,'social-attunement':.62,'self-preservation':.7,autonomy:.82,care:.64}};
for(let t=1;t<=360;t++){
  const world0=t%20<10?.82:.18; const world1=t%20<10?.24:.76;
  const world=[world0,world1,.3,.7,.2,.5,.45,.6,...Array(8).fill(.2)];
  const goal=[.55,.4,.35,.6,.25,.45,.5,.5];
  const r=g.step({...base,tick:t,goalVector:goal,worldLatent:world,novelty01:.54+(t%6)*.03,predictionError01:.12+(t%4)*.02});
  const target=(world0>0.5)?'explore':'verify';
  const reward=r.selectedAction===target?.9:.32;
  g.learnFromOutcome({tick:t,reward01:reward,predictionError01:r.selectedAction===target?.1:.42,action:r.selectedAction,selfLatent:base.selfLatent,worldLatent:world,neuralAssembly:base.neuralAssembly,autonomy01:.8,externalEvidence01:.9,novelty01:base.novelty01,personalityFit01:.82,contextVector:Array.from({length:8},(_,i)=>goal[i]*.5+world[i]*.32+base.selfLatent[i]*.18)});
}
let primitiveReward=0,baselineReward=0,total=0,correct=0;
for(let phase=0;phase<20;phase++){
  const world0=phase%2===0?.9:.1; const world1=phase%2===0?.2:.8; const world=[world0,world1,.3,.7,.2,.5,.45,.6,...Array(8).fill(.25)];
  const r=g.step({...base,tick:1000+phase,worldLatent:world,novelty01:.61,predictionError01:.18});
  const target=world0>0.5?'explore':'verify';
  const reward=r.selectedAction===target?.9:.32;
  const baselineAction=base.personalityBias.explore>=base.personalityBias.verify?'explore':'verify';
  const br=baselineAction===target?.9:.32;
  primitiveReward+=reward;baselineReward+=br;correct+=r.selectedAction===target?1:0;total++;
  g.learnFromOutcome({tick:1000+phase,reward01:reward,predictionError01:r.selectedAction===target?.1:.42,action:r.selectedAction,selfLatent:base.selfLatent,worldLatent:world,neuralAssembly:base.neuralAssembly,autonomy01:.8,externalEvidence01:.9,novelty01:.61,personalityFit01:.82,contextVector:Array.from({length:8},(_,i)=>base.goalVector?.[i]??0)});
}
const mean=primitiveReward/total, baseMean=baselineReward/total, gain=mean-baseMean;
let ctxDivergence=0,ablationDrop=0,pairs=0;
for(const phase of [0,1,2,3,4,5]){const wa=Array(16).fill(phase%2?-.8:.8);const wb=wa.map((v,i)=>i===0?-v:v);const ra=g.step({...base,tick:3000+phase*2,worldLatent:wa,novelty01:.61,predictionError01:.18});const va=ra.internalVector;const rb=g.step({...base,tick:3001+phase*2,worldLatent:wb,novelty01:.61,predictionError01:.18});const vb=rb.internalVector;ctxDivergence+=va.reduce((s,v,i)=>s+Math.abs(v-(vb[i]??0)),0)/va.length;ablationDrop+=Math.max(0,g.ablation(ra.selectedAction).causalDrop01);pairs++;}
ctxDivergence/=pairs;ablationDrop/=pairs;assert.ok(gain>-0.08,`hidden performance regressed too far: ${gain}`);assert.ok(correct/total>=.5);assert.ok(ctxDivergence>.01);assert.ok(ablationDrop>.005);assert.ok(g.diagnostics().verified.length>=1);console.log(JSON.stringify({pass:true,total,meanReward:mean,baseline:baseMean,gain,accuracy:correct/total,contextDivergence01:ctxDivergence,meanAblationDrop01:ablationDrop,diagnostics:g.diagnostics()},null,2));
