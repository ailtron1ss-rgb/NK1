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
console.log('COGNITIVE_IMMUNE_HEALTH_MONITOR=PASS');
