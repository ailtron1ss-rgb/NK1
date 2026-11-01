import assert from 'node:assert/strict';
import { EmotionAppraisalEngine } from '../src/organism/system/EmotionAppraisalEngine.ts';
import { affectWorkspaceActionBias } from '../src/organism/cognition/CognitiveNetworkBus.ts';

const ACTIONS=['respond','explore','verify','rest','reflect','wait','defer'];
const make=(input,interoception=[])=>{
  const engine=new EmotionAppraisalEngine();
  for(const frame of interoception)engine.observeInteroception(frame);
  const episode=engine.appraise({tick:1,at:1001,...input});
  return {engine,episode};
};
const base={goalPressure01:.2,goalCongruence01:.8,controllability01:.8,novelty01:.2,selfRelevance01:.7,socialMeaning01:.1,uncertainty01:.2,predictionError01:.1,homeostaticPressure01:.1,energy01:.8,success01:.8};

const curiosity=make({...base,novelty01:.9,uncertainty01:.55,goalPressure01:.25,predictionError01:.1});
assert.equal(curiosity.episode.label,'curiosity');
assert.ok(curiosity.engine.actionBias('explore')>0,'curiosity should support explore');

const anxiety=make({...base,goalPressure01:.9,controllability01:.15,novelty01:.2,uncertainty01:.9,predictionError01:.9,homeostaticPressure01:.95,success01:.1,goalCongruence01:.1});
assert.equal(anxiety.episode.label,'anxiety');
assert.ok(anxiety.engine.actionBias('verify')>0,'anxiety should support verify');
assert.ok(anxiety.engine.actionBias('explore')<0,'anxiety should suppress unsupported exploration');

const frustration=make({...base,goalPressure01:.2,controllability01:.42,novelty01:.2,uncertainty01:.4,predictionError01:.85,homeostaticPressure01:.1,success01:.4});
assert.equal(frustration.episode.label,'frustration');
assert.ok(frustration.engine.actionBias('reflect')>0,'frustration should support reflective recovery');

const protective=make({...base,goalPressure01:.5,controllability01:.6,novelty01:.2,uncertainty01:.4,predictionError01:.99,homeostaticPressure01:.9,success01:.5});
assert.equal(protective.episode.label,'protective');
assert.ok(protective.engine.actionBias('rest')>0,'protective appraisal should support rest');
assert.ok(protective.engine.actionBias('verify')>0,'protective appraisal should support verification');
assert.ok(protective.engine.actionBias('explore')<0,'protective appraisal should suppress exploration');

const joy=make({...base,goalPressure01:.2,goalCongruence01:.95,controllability01:.8,novelty01:.1,socialMeaning01:.9,uncertainty01:.1,predictionError01:.05,homeostaticPressure01:.05,success01:.95});
assert.equal(joy.episode.label,'joy');
assert.ok(joy.engine.actionBias('respond')>0,'approach/joy must map to canonical respond');

const sadness=make({...base,goalPressure01:0,goalCongruence01:0,controllability01:.45,novelty01:.1,socialMeaning01:.9,uncertainty01:.55,predictionError01:0,homeostaticPressure01:0,success01:0});
assert.equal(sadness.episode.label,'sadness');
assert.ok(sadness.engine.actionBias('wait')>0,'withdraw must map to canonical wait');
assert.ok(sadness.engine.actionBias('defer')>0,'withdraw must map to canonical defer');
assert.ok(sadness.engine.actionBias('respond')<0,'withdraw must suppress canonical respond');

const lowConfidence=make({
  goalPressure01:0,goalCongruence01:.5,controllability01:0,novelty01:.35,
  selfRelevance01:0,socialMeaning01:0,uncertainty01:.5,predictionError01:0,
  homeostaticPressure01:0,energy01:.8,success01:.5,
});
assert.equal(lowConfidence.episode.confidence01,.45);
assert.equal(lowConfidence.engine.actionBias('respond'),0,'low-confidence appraisal must produce no direct action prior');
assert.equal(lowConfidence.engine.actionBias('explore'),0);
assert.equal(lowConfidence.engine.actionBias('not-a-canonical-action'),0,'unknown actions must be inert');

const severeBody={energy01:.1,thermal01:.9,capacity01:.2,load01:.9,homeostaticPressure01:.95};
const stableBody={energy01:.68,thermal01:.2,capacity01:.72,load01:.38,homeostaticPressure01:0};
const highRegulation=make({...base,novelty01:.9,uncertainty01:.55,goalPressure01:.25},Array.from({length:12},()=>severeBody));
const lowRegulation=make({...base,novelty01:.9,uncertainty01:.55,goalPressure01:.25},Array.from({length:12},()=>stableBody));
assert.ok(highRegulation.engine.regulationPressure01()>lowRegulation.engine.regulationPressure01());
assert.ok(highRegulation.engine.actionBias('explore')<lowRegulation.engine.actionBias('explore'),'regulatory pressure must decay exploration priority relative to stable interoception');

const learnedGood=make({...base,goalCongruence01:.95,success01:.95});
const learnedBad=make({...base,goalCongruence01:.95,success01:.95});
for(let i=0;i<12;i++){
  learnedGood.engine.recordOutcome({action:'respond',success01:.95,surprise01:.05,regulationCost01:.05});
  learnedBad.engine.recordOutcome({action:'respond',success01:.05,surprise01:.95,regulationCost01:.95});
}
assert.ok(learnedGood.engine.actionBias('respond')>learnedBad.engine.actionBias('respond'),'calibrated verified benefit must increase and poor outcomes must reduce the matching action prior');

for(const candidate of [curiosity,anxiety,frustration,protective,joy,sadness,lowConfidence,highRegulation,lowRegulation,learnedGood,learnedBad]){
  for(const action of ACTIONS){
    const bias=candidate.engine.actionBias(action);
    assert.ok(Number.isFinite(bias)&&bias>=-.045&&bias<=.045,'direct action prior out of cap: '+action+'='+bias);
  }
}
const workspace={broadcastGain:1,selected:[{
  specialist:'affect',score:1,confidence:1,target:'withdraw',evidence:[],energyCost:0,
}]};
const workspaceWait=affectWorkspaceActionBias(workspace,'withdraw','wait');
const workspaceWithoutAffect=affectWorkspaceActionBias({...workspace,selected:[]},'withdraw','wait');
assert.ok(workspaceWait>0&&workspaceWait<=.035,'selected affect workspace prior must remain capped');
assert.equal(workspaceWithoutAffect,0,'non-selected affect must not influence action ranking');
assert.equal(affectWorkspaceActionBias(null,'withdraw','wait'),0,'absent workspace signal must preserve the baseline');
assert.ok(Math.abs(sadness.engine.actionBias('wait')+workspaceWait)<=.08,'direct and workspace affect paths must remain jointly bounded');

console.log(JSON.stringify({
  pass:634,
  status:'PASS',
  scenarios:{
    curiosity:curiosity.episode.actionTendency,
    anxiety:anxiety.episode.actionTendency,
    frustration:frustration.episode.actionTendency,
    protective:protective.episode.actionTendency,
    joy:joy.episode.actionTendency,
    sadness:sadness.episode.actionTendency,
  },
  regulation:{high:highRegulation.engine.regulationPressure01(),low:lowRegulation.engine.regulationPressure01()},
  calibration:{good:learnedGood.engine.outcomeCalibration('respond'),poor:learnedBad.engine.outcomeCalibration('respond')},
  bounds:{direct:0.045,workspace:0.035,combined:0.08},
  actions:ACTIONS,
},null,2));
