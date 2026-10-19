import assert from 'node:assert/strict';
import { B2511ActiveEpistemicExperimentController } from '../src/organism/cognition/B2511ActiveEpistemicExperimentController.ts';
import { ActivePerceptionNeuralSubstrate } from '../src/organism/cognition/ActivePerceptionNeuralSubstrate.ts';

function runHoldout(enabled){
  const controller=new B2511ActiveEpistemicExperimentController();
  controller.setEnabled(enabled);
  let reward=0,verified=0,correct=0,uncertainty=.72,target='respond';
  for(let tick=0;tick<1200;tick++){
    if(tick%60===0){ target=target==='respond'?'explore':'respond'; uncertainty=.78; }
    const base={respond:.55,explore:.54,verify:.50,rest:.42,reflect:.46,wait:.40,defer:.39};
    const predicted={...base};
    predicted[target]=uncertainty>.50?.56:.86;
    predicted[target==='respond'?'explore':'respond']=uncertainty>.50?.55:.44;
    const uncertaintyByAction={respond:uncertainty,explore:uncertainty,verify:uncertainty*.85,rest:.25,reflect:.35,wait:.20,defer:.20};
    let selected='respond';
    let frame=null;
    if(enabled){
      frame=controller.beforeDecision({
        tick,baseUtilities:base,predictedUtilities:predicted,actionUncertainty:uncertaintyByAction,
        counterfactualSpread01:uncertainty,informationGain01:uncertainty*.65,hypothesisEntropy01:uncertainty,
        uncertainty01:uncertainty,predictionError01:uncertainty*.85,novelty01:tick%60===0?1:.15,
        goalPressure01:.70,energy01:.85,thermal01:.15,
        actionCosts:{verify:.32,explore:.45,respond:.10},personalityBias:{verify:.70,explore:.70,respond:.50},
      });
      selected=frame.selectedAction;
    } else {
      const scores=Object.keys(base).map(a=>({a,score:.60*base[a]+.40*predicted[a]}));
      selected=scores.sort((a,b)=>b.score-a.score)[0].a;
    }
    let r=0,nextU=uncertainty;
    if(selected==='verify'){r=.38;verified++;nextU=.20;}
    else if(selected===target){r=.94;correct++;nextU=Math.max(.12,uncertainty-.05);}
    else {r=.35;nextU=Math.min(.85,uncertainty+.03);}
    reward+=r;
    if(enabled) controller.afterOutcome({tick,action:selected,reward01:r,predicted01:frame.selectedScore01,verified01:selected==='verify'?1:0,previousUncertainty01:uncertainty,nextUncertainty01:nextU,predictionError01:Math.abs(r-frame.selectedScore01)});
    uncertainty=nextU;
  }
  return {reward,verified,correct,diagnostics:enabled?controller.diagnostics():null};
}

const baseline=runHoldout(false);
const active=runHoldout(true);
const relativeGain=(active.reward-baseline.reward)/baseline.reward;
assert.ok(relativeGain>0.20,`active holdout gain too small: ${relativeGain}`);
assert.ok(active.verified>=5);
assert.ok(active.correct>baseline.correct);
assert.ok(active.diagnostics.learningUpdates===1200);
assert.ok(active.diagnostics.informationActions>=5);
assert.ok(active.diagnostics.epistemicEfficiency01>.08);
assert.ok(active.diagnostics.sampleEfficiency01>.20);
assert.ok(active.diagnostics.causalEffect01>.05);

const lesionController=new B2511ActiveEpistemicExperimentController();
lesionController.beforeDecision({tick:1,baseUtilities:{respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5},predictedUtilities:{respond:.5,explore:.5,verify:.5,rest:.5,reflect:.5,wait:.5,defer:.5},actionUncertainty:{respond:.7,explore:.7,verify:.7,rest:.4,reflect:.4,wait:.3,defer:.3},counterfactualSpread01:.7,informationGain01:.7,hypothesisEntropy01:.7,uncertainty01:.7,predictionError01:.6,novelty01:.8,goalPressure01:.7,energy01:.8,thermal01:.1,actionCosts:{verify:.2,explore:.3},personalityBias:{verify:.7,explore:.7}});
const lesion=lesionController.lesion(.5); assert.ok(lesion.causalEffect01>.005);

const perception=new ActivePerceptionNeuralSubstrate();
for(let tick=0;tick<300;tick++){
  const ranked=perception.rank({modalityFeatures:[.82,.76,.10],uncertainty01:.60,novelty01:.40,actionability01:.70,budget01:.80,modalityReliability01:.80,modalityFreshness01:.80,modalityConflict01:.15,tick,at:tick});
  perception.choose([{modality:'vision',predictedGain01:ranked.predictedGain01,cost01:.20,priority01:.70,hidden:ranked.hidden}]);
  perception.observeGain(.82,.50);
}
const quality=perception.quality();
assert.ok(quality.samples===300);
assert.ok(quality.validated);
assert.ok(quality.advantage01>.15);

console.log(JSON.stringify({
  pass:true,status:'B2511_ACTIVE_EPISTEMIC_PASS',
  baselineReward:baseline.reward,activeReward:active.reward,relativeGain01:relativeGain,
  baselineCorrect:baseline.correct,activeCorrect:active.correct,verified:active.verified,
  controller:active.diagnostics,lesion,activePerceptionQuality:quality,
},null,2));
