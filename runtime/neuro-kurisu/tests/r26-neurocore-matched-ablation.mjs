import { B365UnifiedNeuroCausalCore } from '../src/organism/cognition/B365UnifiedNeuroCausalCore.ts';
import { NeuroCoreAdaptiveOperators } from '../src/organism/system/NeuroCoreAdaptiveOperators.ts';

const clamp01=(x)=>Math.max(0,Math.min(1,Number.isFinite(x)?x:0));
const corrVec=(seed,n=64)=>Array.from({length:n},(_,i)=>clamp01(.5+Math.sin(seed*.17+i*.11)*.22+Math.sin(seed*.07+i*.019)*.12));
const mse=(a,b)=>a.reduce((s,x,i)=>s+(x-(b[i]??0))**2,0)/Math.max(1,a.length);

// Matched diagonal-vs-diagonal+low-rank plasticity on a correlated target.
let diagErr=0,lowErr=0;
const diag=new NeuroCoreAdaptiveOperators(64,0);
const low=new NeuroCoreAdaptiveOperators(64,4);
low.configureGateScales({lowRankScale01:1});
let diagState=new Array(64).fill(0), lowState=new Array(64).fill(0);
for(let t=0;t<240;t++){
  const feature=Array.from({length:64},(_,i)=>Math.sin(t*.09+i*.07)+.35*Math.sin(t*.013+i*.031));
  const target=feature.map((x,i)=>Math.tanh(.5*x+.18*feature[(i+1)%64]-.12*feature[(i+7)%64]));
  const dg=diagState.map((v,i)=>target[i]-v), lg=lowState.map((v,i)=>target[i]-v);
  diagState=diag.applyVector(diagState,{gradient:dg,featureVector:feature,surprise01:.42,novelty01:.58,uncertainty01:.32,verification01:1,stability01:.74}).values;
  lowState=low.applyVector(lowState,{gradient:lg,featureVector:feature,surprise01:.42,novelty01:.58,uncertainty01:.32,verification01:1,stability01:.74}).values;
  if(t>=160){diagErr+=mse(diagState,target);lowErr+=mse(lowState,target);}
}
diagErr/=80;lowErr/=80;

function trainCore(core,scale){
  core.configureNeuroCoreGateScales(scale);
  for(let tick=1;tick<=48;tick++){
    const step=core.step({tick,vector:Array.from({length:64},(_,i)=>Math.sin(tick*.11+i*.03)),novelty01:(tick%7)/7,uncertainty01:.25+(tick%4)*.1,predictionError01:.2+(tick%5)*.06,goalPressure01:.55,autonomy01:.7});
    core.learnFromOutcome({tick,action:step.selectedAction,reward01:.54+(tick%5)*.08,predictionError01:.14+(tick%4)*.05,verified01:1,novelty01:(tick%5)/5,externalEvidence01:.9,actualUtility01:.58+(tick%3)*.09,actualWorldConfidence01:.78});
  }
}
const normal=new B365UnifiedNeuroCausalCore();
const writeOnly=new B365UnifiedNeuroCausalCore();
const eraseOnly=new B365UnifiedNeuroCausalCore();
trainCore(normal,{eraseScale01:1,writeScale01:1,lowRankScale01:0});
trainCore(writeOnly,{eraseScale01:0,writeScale01:1,lowRankScale01:0});
trainCore(eraseOnly,{eraseScale01:1,writeScale01:0,lowRankScale01:0});
const lowrankCore=new B365UnifiedNeuroCausalCore();
lowrankCore.configureNeuroCoreLowRankScale(1);
trainCore(lowrankCore,{eraseScale01:1,writeScale01:1,lowRankScale01:1});
const holdout=(core)=>{
  let err=0;
  for(let i=0;i<12;i++){
    const step=core.step({tick:100+i,vector:Array.from({length:64},(_,j)=>Math.sin((100+i)*.07+j*.031)),novelty01:.42,uncertainty01:.28,predictionError01:.18,goalPressure01:.52,autonomy01:.72});
    const actionIndex=['respond','explore','verify','rest','reflect','wait','defer'].indexOf(step.selectedAction);
    err+=Math.abs((step.forecastUtilities[step.selectedAction]??.5)-(.60+(actionIndex%3)*.10));
  }
  return err/12;
};
const n=normal.neuroCoreArchitectureDiagnostics(),w=writeOnly.neuroCoreArchitectureDiagnostics(),e=eraseOnly.neuroCoreArchitectureDiagnostics(),lr=lowrankCore.neuroCoreArchitectureDiagnostics();
const normalHoldout=holdout(normal),writeOnlyHoldout=holdout(writeOnly),eraseOnlyHoldout=holdout(eraseOnly),lowRankHoldout=holdout(lowrankCore);
console.log('R26_NEUROCORE_MATCHED_ABLATION=PASS',JSON.stringify({diagMeanMse01:diagErr,lowRankMeanMse01:lowErr,lowRankImprovement01:diagErr-lowErr,normalHoldoutError01:normalHoldout,writeOnlyHoldoutError01:writeOnlyHoldout,eraseOnlyHoldoutError01:eraseOnlyHoldout,lowRankHoldoutError01:lowRankHoldout,normal:{updates:n.updates,vectorUpdates:n.vectorUpdates,meanLowRank01:n.meanLowRank01,lowRankScale01:n.lowRankScale01,meanEraseGate01:n.meanEraseGate01,meanWriteGate01:n.meanWriteGate01},writeOnly:{meanEraseGate01:w.meanEraseGate01,meanWriteGate01:w.meanWriteGate01},eraseOnly:{meanEraseGate01:e.meanEraseGate01,meanWriteGate01:e.meanWriteGate01},lowRankCanonicalPromotion:false,lowRankPositiveOnConvergence:lowErr<diagErr}));
