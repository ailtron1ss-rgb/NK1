import { NeuralExperienceBranch } from '../src/organism/cognition/NeuralExperienceBranch.ts';
const actions=['respond','explore','verify','rest','reflect','wait','defer'];
const baseUtilities=Object.fromEntries(actions.map(a=>[a,.5]));
const vec=(kind,noise=0)=>{const x=new Array(64).fill(0);x[kind]=1;for(let i=8;i<64;i++)x[i]=Math.sin(kind*0.7+i*0.13)*noise;return x;};
const blank=(seed)=>new Array(64).fill(0).map((_,i)=>Math.sin(seed*0.37+i*0.11)*.035);
const frame=(tick,input,novelty=.2,uncertainty=.25)=>({tick,input,baseUtilities,predictionError01:.18,novelty01:novelty,uncertainty01:uncertainty,homeostasis01:.2,identityGap01:.15,goalPressure01:.35,reward01:.5});

function train(branch,trials=420){
  for(let t=0;t<trials;t++){
    const kind=t%2;
    const action=kind===0?'respond':'explore';
    branch.beforeDecision(frame(t*5+1,vec(kind,.02),.25,.2));
    branch.commitAction(action,baseUtilities);
    branch.beforeDecision(frame(t*5+2,blank(t),.12,.22));
    branch.beforeDecision(frame(t*5+3,blank(t+1),.10,.24));
    branch.beforeDecision(frame(t*5+4,blank(t+2),.10,.24));
    branch.afterOutcome({tick:t*5+4,action,reward01:1,predictionError01:.08,verified01:1,nextInput:blank(t+3),holdout01:t%7===0?1:0,identityGap01:.12,goalPressure01:.3});
    if(t%12===0) branch.replay(6);
  }
}

function probe(branch,kind){
  const a=branch.beforeDecision(frame(10000+kind,vec(kind,0),.2,.2));
  return {respond:a.actionBias.respond,explore:a.actionBias.explore,prediction:a.prediction01,memory:branch.diagnostics().slowMemory.slice()};
}

const branch=new NeuralExperienceBranch();
const start=branch.diagnostics();
train(branch);
const d=branch.diagnostics();
const p0=probe(branch,0),p1=probe(branch,1),pb=branch.beforeDecision(frame(10002,blank(77),.1,.24));
const restored=new NeuralExperienceBranch();restored.restore(d);
const rp0=probe(restored,0),rp1=probe(restored,1);
const delayDiversity=new Set(d.edgeDelays.flat()).size;
const meanUncertainty=d.edgeUncertainty.flat().reduce((a,b)=>a+b,0)/d.edgeUncertainty.flat().length;
const sensoryDelta=d.inputProjection.flat().reduce((a,v,i)=>a+Math.abs(v-(start.inputProjection.flat()[i]??0)),0)/d.inputProjection.flat().length;
const memoryMagnitude=d.slowMemory.reduce((a,b)=>a+Math.abs(b),0)/d.slowMemory.length;
const passes=[
  d.learningUpdates>=420,
  d.eligibilityUpdates>0,
  d.sensoryLearningUpdates>0,
  d.delayLearningUpdates>0,
  d.memoryLearningUpdates>0,
  delayDiversity>=2,
  meanUncertainty>0,
  sensoryDelta>0.0001,
  memoryMagnitude>0.0001,
  d.cueTraceStrength01>0.0001,
  Math.abs(rp0.prediction-p0.prediction)<0.05,
  Math.abs(rp1.prediction-p1.prediction)<0.05,
];
if(!passes.every(Boolean)) throw new Error(JSON.stringify({passes,summary:{learningUpdates:d.learningUpdates,eligibilityUpdates:d.eligibilityUpdates,sensoryLearningUpdates:d.sensoryLearningUpdates,delayLearningUpdates:d.delayLearningUpdates,memoryLearningUpdates:d.memoryLearningUpdates,delayDiversity,meanUncertainty,sensoryDelta,memoryMagnitude,p0Prediction:p0.prediction,p1Prediction:p1.prediction,blankPrediction:pb.prediction}}));
console.log('B2525_2529_NEURAL_LEARNING_STACK_PASS',JSON.stringify({
  cycles:d.cycles,learningUpdates:d.learningUpdates,eligibilityUpdates:d.eligibilityUpdates,sensoryLearningUpdates:d.sensoryLearningUpdates,
  delayLearningUpdates:d.delayLearningUpdates,memoryLearningUpdates:d.memoryLearningUpdates,metaplasticityUpdates:d.metaplasticityUpdates,
  delayDiversity,meanUncertainty,sensoryDelta,memoryMagnitude,longMemoryStability01:d.longMemoryStability01,cueTraceStrength01:d.cueTraceStrength01,
  p0:{respond:p0.actionBias?.respond,explore:p0.actionBias?.explore,prediction:p0.prediction01},p1:{respond:p1.actionBias?.respond,explore:p1.actionBias?.explore,prediction:p1.prediction01},blank:{prediction:pb.prediction01},
  restartDelta:{p0:Math.abs(rp0.prediction-p0.prediction),p1:Math.abs(rp1.prediction-p1.prediction)}
}));
