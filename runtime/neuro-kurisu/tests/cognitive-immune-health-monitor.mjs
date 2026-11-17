import assert from 'node:assert/strict';
import { CognitiveImmuneSystem } from '../src/organism/cognition/CognitiveImmuneSystem.ts';

const immune=new CognitiveImmuneSystem();
const healthy={
  epistemic:{
    resolvedPredictions:8,meanPredictionError01:.12,
    claimsData:[
      ...Array.from({length:8},(_,i)=>({id:`b${i}`,kind:'belief',status:'active',confidence01:.66,supportCount:4,source:'world'})),
      ...Array.from({length:8},(_,i)=>({id:`i${i}`,kind:'inference',status:'active',confidence01:.58,supportCount:3,source:'tool'}))
    ]
  },
  contradictions:{unresolvedCount:0,claims:[{status:'resolved'},{status:'resolved'},{status:'resolved'}]},
  skills:{skills:[
    {id:'s1',uses:12,successes:11,failures:1,successRate:.92,status:'habit'},
    {id:'s2',uses:10,successes:9,failures:1,successRate:.9,status:'habit'}
  ]}
};
for(let tick=1;tick<=4;tick++)immune.inspectHealth({...healthy,tick,at:1_000+tick});
assert.equal(immune.healthSnapshot().signals.length,0,'healthy baseline must not create alerts');

const damaged={
  epistemic:{
    resolvedPredictions:12,meanPredictionError01:.92,
    claimsData:[
      ...Array.from({length:8},(_,i)=>({id:`stale${i}`,kind:'belief',status:'stale',confidence01:.96,supportCount:1,source:'model'})),
      ...Array.from({length:8},(_,i)=>({id:`uncertain${i}`,kind:'inference',status:'active',confidence01:.98,supportCount:1,source:'model'}))
    ]
  },
  contradictions:{unresolvedCount:5,claims:Array.from({length:5},()=>({status:'open'}))},
  skills:{skills:[
    {id:'s1',uses:12,successes:2,failures:10,successRate:.17,status:'habit'},
    {id:'s2',uses:12,successes:3,failures:9,successRate:.25,status:'habit'}
  ]}
};
const first=immune.inspectHealth({...damaged,tick:5,at:1_005});
assert.equal(first.newSignals.length,0,'one abnormal sample must not page');
const second=immune.inspectHealth({...damaged,tick:6,at:1_006});
assert.ok(second.newSignals.length>=4,'persistent independent degradation dimensions must raise review signals');
assert.ok(second.metrics['belief-staleness'].value01>.9);
assert.ok(second.metrics['contradiction-pressure'].value01>.8);
assert.ok(second.metrics['prediction-calibration'].value01>.8);
assert.ok(second.metrics['procedural-skill-degradation'].value01>.7);
assert.equal(second.recommendedAction,'review-evidence');

const before=immune.snapshot();
const signal=second.newSignals.find(s=>s.metric==='contradiction-pressure');
assert.ok(signal);
assert.equal(immune.reviewHealthSignal(signal.id,'false-positive','independent-reviewer','evidence:counterexample'),true);
const after=immune.snapshot();
assert.equal(after.health.signals.find(s=>s.id===signal.id)?.status,'dismissed');
assert.equal(after.health.signals.length,before.health.signals.length,'review should annotate, not erase signal history');
assert.equal(damaged.epistemic.claimsData[0].status,'stale','health inspection must not mutate source ledgers');

const restored=new CognitiveImmuneSystem();
restored.restore(after);
assert.equal(restored.healthSnapshot().signals.length,after.health.signals.length);
assert.equal(restored.healthSnapshot().inspections,after.health.inspections);

const legacy=new CognitiveImmuneSystem();
legacy.restore({trustedSources:{user:.8},quarantine:[],rejectedCount:0,validatedCount:0,reviewQueue:[],reviewedCount:0});
assert.equal(legacy.healthSnapshot().score01,1,'pre-monitor checkpoints must migrate to a neutral health baseline');

for(let tick=7;tick<100;tick++)immune.inspectHealth({...healthy,tick,at:1_000+tick});
assert.ok(immune.healthSnapshot().samples.length<=64,'health history must remain bounded');
console.log('COGNITIVE_IMMUNE_HEALTH_MONITOR=PASS');
