import assert from 'node:assert/strict';
import { P23LearningEngine, defaultP23Learning } from '../src/organism/learning/P23LearningEngine.ts';

const engine=new P23LearningEngine();
const base=defaultP23Learning();
const experiences=[];
for(let tick=127;tick>=0;tick--){
  const recent=tick>=64;
  const predictedUtility=recent?0.5:0.1;
  const success=recent?0.6:0.9;
  experiences.push({
    id:`exp-trace-${tick}`,traceId:`trace-${tick}`,tick,at:1000+tick,
    contextKey:'e1|c1|u1|n1|g1|s1',nextContextKey:'e1|c1|u1|n1|g1|s1',
    action:'reflect',predictedUtility,predictedConfidence:0.8,success,reward:success,
    surprise:0.2,outcomeAt:2000+tick,
  });
}
const newest=experiences[0];
const validReplay={id:'replay-replay-1',traceId:'replay-1',contextKey:'ctx',nextContextKey:'next',
  action:'verify',reward:0.8,target:0.7,valueBefore:0.6,valueAfter:0.7,tdError:0.1,learningRate:0.03,at:2001};
const validShadow={traceId:'shadow-1',tick:10,contextKey:'ctx',actual:'verify',baseline:'reflect',
  agreed:false,actualSuccess:0.8,baselineWasBetterPrediction:false,baselineReason:'low pressure',at:2002};
const validSkill={id:'skill-1',contextKey:'ctx',action:'reflect',totalUses:4,trainUses:3,validationUses:1,
  trainSuccess01:0.7,validationSuccess01:0.8,confidence01:0.6,status:'candidate',createdAt:1000,updatedAt:2000,
  validationWindowStartTick:1,validationWindowEndTick:4};
const validAblation={traceId:'ablation-1',tick:10,module:'adaptive-policy',actual:'verify',ablated:'reflect',
  changed:true,scoreLoss01:0.2,reason:'ranking changed',at:2003};
const validDebt={id:'debt-ctx|verify',contextKey:'ctx',action:'verify',priority01:0.7,uncertainty01:0.6,
  estimatedVerificationCost01:0.4,informationGainPerCost01:0.8,reason:'verify disputed outcome',createdAt:1000,lastSeenAt:2000};
const polluted={
  ...base,version:1,
  processedTraceIds:['trace-newest',...Array.from({length:2050},(_,i)=>`trace-${i}`),'trace-newest',42],
  replayedTraceIds:['replay-newest',42,'replay-newest'],
  experiences:[{...newest,predictedUtility:Number.NaN},...experiences,{...newest},
    {id:'exp-forged',traceId:'forged',tick:Number.POSITIVE_INFINITY,at:1000,outcomeAt:2000,
      contextKey:'ctx',nextContextKey:'ctx',action:'reflect',predictedUtility:0.5,predictedConfidence:0.5,
      success:0.5,reward:0.5,surprise:0.2}],
  replayUpdates:[validReplay,{...validReplay,tdError:Number.NaN}],
  shadow:[validShadow,{...validShadow,actualSuccess:Number.NaN,traceId:'poisoned'}],
  skills:[validSkill,{...validSkill,status:'untrusted'}],
  ablations:[validAblation,{...validAblation,changed:false,traceId:'poisoned'}],
  evidenceDebt:[validDebt,{...validDebt,priority01:Number.POSITIVE_INFINITY,id:'poisoned'}],
  checksum:{digest:'not-a-sha256',at:-1,tick:Number.NaN,verifiedAt:Number.POSITIVE_INFINITY,verificationFailures:-3},
  metrics:{...base.metrics,outcomes:-5,skillPromotions:Number.POSITIVE_INFINITY,
    checksumFailures:Number.NaN,shadowAgreement01:Number.NaN,lastLearningAt:Number.NaN},
};
engine.restore(polluted);
const restored=engine.snapshot();
assert.equal(restored.version,1);
assert.equal(restored.experiences.length,128,'invalid/duplicate experiences must be removed');
assert.equal(restored.experiences[0]?.traceId,'trace-127','newest valid experience must stay first');
assert.equal(restored.replayUpdates.length,1);
assert.equal(restored.shadow.length,1);
assert.equal(restored.skills.length,1);
assert.equal(restored.ablations.length,1);
assert.equal(restored.evidenceDebt.length,1);
assert.equal(restored.processedTraceIds.length,2048);
assert.equal(restored.processedTraceIds[0],'trace-newest','retain newest trace IDs');
assert.deepEqual(restored.replayedTraceIds,['replay-newest','replay-1'], 'preserve the newest cached replay ID and reconstruct missing durable replay identities');
assert.equal(restored.checksum.digest,'');
assert.equal(restored.checksum.verificationFailures,0);
assert.equal(restored.metrics.outcomes,128,'outcome counter cannot be lower than persisted experience rows');
assert.equal(restored.metrics.skillPromotions,0);
assert.equal(restored.metrics.checksumFailures,0);
assert.equal(restored.metrics.lastLearningAt,0);
assert.ok(restored.metrics.learningDelta01>0.8&&restored.metrics.learningDelta01<0.9,
  'learningDelta01 must compare old high error with recent low error');
assert.ok(Object.values(restored.metrics).every(value=>typeof value==='number'&&Number.isFinite(value)));


const missingIdentityCaches=P23RestoreIdentityFixture();
missingIdentityCaches.processedTraceIds=[];
missingIdentityCaches.replayedTraceIds=[];
missingIdentityCaches.experiences=[experiences[0]];
missingIdentityCaches.replayUpdates=[validReplay];
const identityEngine=new P23LearningEngine();
identityEngine.restore(missingIdentityCaches);
const identityRestored=identityEngine.snapshot();
assert.ok(identityRestored.processedTraceIds.includes('trace-127'),'restored experience must remain deduplicated even when its ID cache is missing');
assert.ok(identityRestored.replayedTraceIds.includes('replay-1'),'restored replay row must remain deduplicated even when its ID cache is missing');
assert.equal(identityRestored.metrics.outcomes,1,'outcome metrics must cover durable experience rows');
function P23RestoreIdentityFixture(){
  return {...base,version:1,processedTraceIds:[],replayedTraceIds:[],experiences:[],replayUpdates:[],
    shadow:[],skills:[],ablations:[],evidenceDebt:[],checksum:{...base.checksum},metrics:{...base.metrics}};
}

const beforeUnsupported=engine.snapshot();
assert.throws(()=>engine.restore({...beforeUnsupported,version:2}),/version/);
assert.deepEqual(engine.snapshot(),beforeUnsupported,'unsupported version must not mutate the live learner');
assert.throws(()=>engine.restore([]),/plain object/);
assert.deepEqual(engine.snapshot(),beforeUnsupported,'non-object state must be rejected before mutation');

console.log('WORKPASS310_P23_RESTORE_INTEGRITY=PASS');
