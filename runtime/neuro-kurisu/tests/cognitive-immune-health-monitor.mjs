import assert from 'node:assert/strict';
import { CognitiveImmuneSystem } from '../src/organism/cognition/CognitiveImmuneSystem.ts';
import { ContradictionReservoir } from '../src/organism/cognition/ContradictionReservoir.ts';
import { P65EpistemicLedger } from '../src/organism/memory/P65EpistemicLedger.ts';
import { ProceduralSkillLibrary } from '../src/organism/learning/ProceduralSkillLibrary.ts';

function buildInputs({damaged=false}={}) {
  const p65=new P65EpistemicLedger();
  const beliefs=[];
  for(let i=0;i<8;i++){
    beliefs.push(p65.record({
      tick:i+1,at:1_000,kind:'belief',content:`belief-${i}`,
      confidence01:damaged ? .96 : .66,source:damaged?'model':'world'
    }));
  }
  for(let i=0;i<8;i++)p65.record({
    tick:20+i,at:1_000,kind:'inference',content:`inference-${i}`,
    confidence01:damaged ? .98 : .58,source:damaged?'model':'tool'
  });
  for(let i=0;i<8;i++){
    const id=p65.record({
      tick:40+i,at:1_000,kind:'prediction',content:`prediction-${i}`,
      confidence01:.92,predicted01:.92,source:'organism'
    });
    p65.resolvePrediction(id,damaged ? .05 : .9);
  }
  if(damaged)p65.expireBeliefs(70_001,60_000);
  else for(const id of beliefs){p65.supportBelief(id,2_000);p65.supportBelief(id,3_000);p65.supportBelief(id,4_000);}
  const contradictions=new ContradictionReservoir();
  if(damaged)for(let i=0;i<5;i++)contradictions.register(`conflict-${i}`,[],.8);
  const skills=new ProceduralSkillLibrary();
  for(const [action,context] of [['explore','context-a'],['verify','context-b']]){
    for(let i=0;i<12;i++)skills.observeOutcome(
      action,context,damaged?0:1,.1,damaged?'repeated-failure':undefined,
      {verified:true,independent:true,context}
    );
  }
  return {
    epistemic:p65.snapshot(),
    contradictions:contradictions.snapshot(),
    skills:skills.snapshot()
  };
}

const immune=new CognitiveImmuneSystem();
const healthy=buildInputs();
for(let tick=1;tick<=4;tick++)immune.inspectHealth({...healthy,tick,at:1_000+tick});
assert.equal(immune.healthSnapshot().signals.length,0,'healthy baseline must not create alerts');

const damaged=buildInputs({damaged:true});
const immutableBefore=JSON.stringify(damaged);
const first=immune.inspectHealth({...damaged,tick:5,at:1_005});
assert.equal(first.newSignals.length,0,'one abnormal sample must not page');
const second=immune.inspectHealth({...damaged,tick:6,at:1_006});
assert.ok(second.newSignals.length>=4,'persistent degradation across independent live ledgers must raise review signals');
assert.ok(second.metrics['belief-staleness'].value01>.9);
assert.ok(second.metrics['contradiction-pressure'].value01>.8);
assert.ok(second.metrics['prediction-calibration'].value01>.55);
assert.ok(second.metrics['procedural-skill-degradation'].value01>.7);
assert.equal(second.recommendedAction,'review-evidence');
assert.equal(JSON.stringify(damaged),immutableBefore,'the monitor must not mutate P65, contradiction or skill source state');

const before=immune.snapshot();
const signal=second.newSignals.find(s=>s.metric==='contradiction-pressure');
assert.ok(signal);
assert.equal(immune.reviewHealthSignal(signal.id,'false-positive','independent-reviewer','evidence:counterexample'),true);
const after=immune.snapshot();
assert.equal(after.health.signals.find(s=>s.id===signal.id)?.status,'dismissed');
assert.equal(after.health.signals.length,before.health.signals.length,'review should annotate, not erase signal history');

const restored=new CognitiveImmuneSystem();
restored.restore(after);
assert.equal(restored.healthSnapshot().signals.length,after.health.signals.length);
assert.equal(restored.healthSnapshot().inspections,after.health.inspections);

const legacy=new CognitiveImmuneSystem();
legacy.restore({trustedSources:{user:.8},quarantine:[],rejectedCount:0,validatedCount:0,reviewQueue:[],reviewedCount:0});
assert.equal(legacy.healthSnapshot().score01,1,'pre-monitor checkpoints must migrate to a neutral health baseline');

for(let tick=7;tick<100;tick++)immune.inspectHealth({...healthy,tick,at:1_000+tick});
assert.equal(immune.healthSnapshot().signals.filter(s=>s.status==='open').length,0,'sustained recovery must close active signals');
assert.ok(immune.healthSnapshot().signals.some(s=>s.status==='recovered'),'recovery must be retained in signal history');
assert.ok(immune.healthSnapshot().samples.length<=64,'health history must remain bounded');


// Temporal integrity: retries and out-of-order observations must not manufacture
// consecutive evidence or advance the monitor twice for one organism tick.
const replayImmune = new CognitiveImmuneSystem();
replayImmune.inspectHealth({...damaged,tick:200,at:2_200});
const beforeReplay = replayImmune.snapshot();
const replayResult = replayImmune.inspectHealth({...damaged,tick:200,at:2_201});
assert.equal(replayImmune.snapshot().health.inspections,beforeReplay.health.inspections,
  'a repeated tick must be idempotent');
assert.equal(replayResult.newSignals.length,0,
  'a replayed tick must not create a second consecutive observation');
replayImmune.inspectHealth({...damaged,tick:199,at:2_199});
assert.equal(replayImmune.snapshot().health.inspections,beforeReplay.health.inspections,
  'an out-of-order tick must not mutate health history');

// Missing evidence is unknown, not recovery. An active alarm must remain open
// until three eligible, healthy observations actually arrive.
const missingDataImmune = new CognitiveImmuneSystem();
missingDataImmune.inspectHealth({...damaged,tick:1,at:3_001});
missingDataImmune.inspectHealth({...damaged,tick:2,at:3_002});
for(let tick=3;tick<=6;tick++)missingDataImmune.inspectHealth({
  tick,at:3_000+tick,epistemic:{claimsData:[]},
  contradictions:{claims:[]},skills:{skills:[]}
});
assert.ok(missingDataImmune.healthSnapshot().signals.some(s=>s.status==='open'),
  'ineligible or missing data must never auto-close a health signal');

// A confirmed signal is still active and must be updated in place rather than
// spawning a duplicate signal on each subsequent high observation.
const acknowledgedImmune = new CognitiveImmuneSystem();
acknowledgedImmune.inspectHealth({...damaged,tick:1,at:4_001});
const acknowledgedFirst = acknowledgedImmune.inspectHealth({...damaged,tick:2,at:4_002});
const acknowledgedSignal = acknowledgedFirst.newSignals[0];
assert.ok(acknowledgedSignal);
assert.equal(acknowledgedImmune.reviewHealthSignal(
  acknowledgedSignal.id,'confirmed','reviewer-a','evidence:confirmed'
),true);
acknowledgedImmune.inspectHealth({...damaged,tick:3,at:4_003});
const sameMetricSignals = acknowledgedImmune.healthSnapshot().signals.filter(
  s=>s.metric===acknowledgedSignal.metric&&s.status!=='dismissed'&&s.status!=='recovered'
);
assert.equal(sameMetricSignals.length,1,
  'acknowledged active signals must be updated, not duplicated');
assert.equal(sameMetricSignals[0].id,acknowledgedSignal.id);

// Confidence instability is temporal drift, not ordinary diversity between
// unrelated claims. Alternating confidence values with equal recent/past means
// are diverse but not unstable.
const diverseClaims = Array.from({length:16},(_,i)=>({
  id:`diverse-${i}`,kind:'inference',status:'active',
  confidence01:i%2?1:0,supportCount:2
}));
const diverseResult = new CognitiveImmuneSystem().inspectHealth({
  tick:1,epistemic:{claimsData:diverseClaims}
});
assert.ok(diverseResult.metrics['confidence-instability'].value01<0.01,
  'cross-sectional confidence diversity must not be mistaken for temporal instability');
const driftingClaims = [
  ...Array.from({length:8},(_,i)=>({id:`recent-${i}`,kind:'inference',status:'active',confidence01:.95,supportCount:2})),
  ...Array.from({length:8},(_,i)=>({id:`older-${i}`,kind:'inference',status:'active',confidence01:.05,supportCount:2}))
];
const driftingResult = new CognitiveImmuneSystem().inspectHealth({
  tick:1,epistemic:{claimsData:driftingClaims}
});
assert.ok(driftingResult.metrics['confidence-instability'].value01>.8,
  'large recent confidence drift must be visible');

// Checkpoint input is untrusted: all restored samples and signal metadata must
// be normalized before they can influence future decisions.
const corruptedCheckpoint = {
  ...after,
  health:{
    ...after.health,
    samples:[{
      tick:'not-a-tick',at:'not-a-time',score01:NaN,
      metrics:{'contradiction-pressure':{eligible:true,value01:NaN,threshold01:NaN,sampleCount:-1}}
    }],
    highStreaks:{'belief-staleness':-9,'contradiction-pressure':'Infinity'}
  }
};
const hardenedRestore = new CognitiveImmuneSystem();
hardenedRestore.restore(corruptedCheckpoint);
const hardenedSample = hardenedRestore.healthSnapshot().samples[0];
assert.ok(Number.isFinite(hardenedSample.tick)&&Number.isFinite(hardenedSample.at)&&
  Number.isFinite(hardenedSample.score01),
  'restored health sample coordinates and score must be finite');
for(const key of Object.keys(diverseResult.metrics)){
  const metric=hardenedSample.metrics[key];
  assert.ok(metric&&Number.isFinite(metric.value01)&&Number.isFinite(metric.threshold01)&&
    Number.isFinite(metric.sampleCount)&&Number.isFinite(metric.baseline01)&&
    Number.isFinite(metric.deviation01),
    `restored metric ${key} must be normalized`);
}
assert.equal(hardenedRestore.healthSnapshot().highStreaks['belief-staleness'],0,
  'negative streak counters must be reset');

// Critical cognitive health must stop promotion, not observation. The gate is
// checkpointed so a restart cannot silently re-enable risky skill promotion.
const promotionGateLibrary = new ProceduralSkillLibrary();
promotionGateLibrary.setPromotionPaused(true,'cognitive-immune:critical');
for(let i=0;i<6;i++)promotionGateLibrary.observeOutcome(
  'verify','general',1,.1,undefined,{verified:true,independent:true,context:'general'}
);
assert.equal(promotionGateLibrary.snapshot().skills[0]?.status,'candidate',
  'healthy outcome collection continues but promotion is paused');
const restoredPromotionGate = new ProceduralSkillLibrary();
restoredPromotionGate.restore(promotionGateLibrary.snapshot());
restoredPromotionGate.observeOutcome(
  'verify','general',1,.1,undefined,{verified:true,independent:true,context:'general'}
);
assert.equal(restoredPromotionGate.snapshot().skills[0]?.status,'candidate',
  'promotion pause must survive checkpoint restore');
restoredPromotionGate.setPromotionPaused(false);
restoredPromotionGate.observeOutcome(
  'verify','general',1,.1,undefined,{verified:true,independent:true,context:'general'}
);
assert.equal(restoredPromotionGate.snapshot().skills[0]?.status,'habit',
  'promotion should resume after the critical health gate is released');



// Health must distinguish a perfect score computed from no observations from
// a genuinely observed healthy system. Coverage describes measured dimensions.
const unknownHealth = new CognitiveImmuneSystem().inspectHealth({
  tick:1,epistemic:{claimsData:[]},contradictions:{claims:[]},skills:{skills:[]}
});
assert.equal(unknownHealth.coverage01,0,
  'no eligible evidence must produce zero health coverage');
assert.equal(unknownHealth.healthStatus,'unknown',
  'unobserved dimensions must not be reported as healthy');
const observedHealth = new CognitiveImmuneSystem().inspectHealth({
  ...healthy,tick:1
});
assert.ok(observedHealth.coverage01>0,
  'eligible evidence must contribute to health coverage');
assert.equal(observedHealth.healthStatus,'healthy',
  'measured healthy evidence must produce a healthy status');

// Prediction health uses the recent resolved-prediction cohort, rather than
// an all-time average that can hide recent calibration collapse.
const predictionCohort = [
  ...Array.from({length:8},(_,i)=>({
    id:`recent-prediction-${i}`,kind:'prediction',resolved:true,status:'resolved',error01:.92
  })),
  ...Array.from({length:8},(_,i)=>({
    id:`old-prediction-${i}`,kind:'prediction',resolved:true,status:'resolved',error01:.08
  }))
];
const predictionCohortResult = new CognitiveImmuneSystem().inspectHealth({
  tick:1,
  epistemic:{claimsData:predictionCohort,resolvedPredictions:900,meanPredictionError01:.12}
});
assert.ok(predictionCohortResult.metrics['prediction-calibration'].value01>.9,
  'recent prediction errors must override an optimistic all-time aggregate');
assert.equal(predictionCohortResult.metrics['prediction-calibration'].sampleCount,16,
  'prediction sample count must represent the retained resolved cohort');

// The safety pause must cover compound-skill promotion and the variant
// activation boundary, not only the primitive-skill habit path.
const compoundGateLibrary = new ProceduralSkillLibrary();
const gatedCompound = compoundGateLibrary.compileCompoundSkill({
  projectId:'cognitive-immune-test',name:'gated-compound',origin:'test',
  steps:[
    {id:'step-a',action:'verify',toolId:'tool-a',fallbackToolIds:['tool-a2']},
    {id:'step-b',action:'reflect',toolId:'tool-b'}
  ]
});
assert.ok(gatedCompound);
compoundGateLibrary.setPromotionPaused(true,'cognitive-immune:critical');
for(let i=0;i<5;i++)compoundGateLibrary.recordCompoundExecution(
  gatedCompound.id,{success01:1,verified:true,independent:true,holdout:false,context:`independent-context-${i}`}
);
assert.equal(compoundGateLibrary.compoundSkills()[0]?.status,'candidate',
  'critical health must block compound-skill reusable promotion');
const gatedVariant=compoundGateLibrary.createRepairVariant(
  gatedCompound.id,{stepId:'step-a',toTool:'tool-a2',reason:'verified-repair-test'}
);
assert.ok(gatedVariant);
for(let i=0;i<4;i++)compoundGateLibrary.recordVariantExecution(
  gatedCompound.id,gatedVariant.id,
  {success01:1,verified:true,independent:true,holdout:false,context:`variant-context-${i}`}
);
assert.equal(compoundGateLibrary.compoundSkills()[0]?.variants.find(v=>v.id===gatedVariant.id)?.status,'candidate',
  'critical health must block automatic variant activation');
assert.equal(compoundGateLibrary.promoteVariant(gatedCompound.id,gatedVariant.id),null,
  'public promotion API must not bypass the critical health gate');
const restoredCompoundGate = new ProceduralSkillLibrary();
restoredCompoundGate.restore(compoundGateLibrary.snapshot());
assert.equal(restoredCompoundGate.summary().promotionPaused,true,
  'compound promotion pause must survive checkpoint restore');
restoredCompoundGate.setPromotionPaused(false);
const activatedVariant=restoredCompoundGate.promoteVariant(gatedCompound.id,gatedVariant.id);
assert.equal(activatedVariant?.status,'active',
  'verified candidate variant may be promoted after health recovery');

console.log('COGNITIVE_IMMUNE_HEALTH_MONITOR=PASS');
