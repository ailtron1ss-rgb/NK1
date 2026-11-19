import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';
import { ingestSignedOutcomeArtifact, signOutcomePayloadForFixture } from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { proposeVerifiedSkillPromotion } from '../src/organism/learning/VerifiedSkillPromotion.ts';
import { P23LearningEngine } from '../src/organism/learning/P23LearningEngine.ts';
import { VersionedSkillCandidateStore, InMemorySkillStorePersistence } from '../src/organism/learning/VersionedSkillCandidateStore.ts';
import { evaluateSkillLearnBenchTrial } from '../src/organism/learning/SkillLearnBenchAdapter.ts';

const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const verifierId='p23-revision-boundary-verifier';
const publicPem=publicKey.export({type:'spki',format:'pem'}).toString();
const privatePem=privateKey.export({type:'pkcs8',format:'pem'}).toString();
const trustedKeys=new Map([[verifierId,publicPem]]);
const manifest=Array.from({length:10},(_,index)=>({
  taskId:`proposal-task-${index}`,family:index<5?'memory':'tool-use',split:'holdout',
  promptFingerprint:VerifiedOutcomeLedger.fingerprintPrompt(`unique revision proposal prompt ${index}`),
  verifierId,version:'v1',
}));
const ledger=new VerifiedOutcomeLedger(manifest);
for(let seed=1;seed<=5;seed++) {
  for(let index=0;index<manifest.length;index++) {
    const task=manifest[index];
    for(const [method,passed] of [['baseline',index<6],['candidate',index<8]]) {
      const payload={
        schemaVersion:1,
        artifactId:`p23-revision-${task.taskId}-${method}-${seed}`,
        runId:`p23-revision-run-${method}-${seed}`,
        manifestFingerprint:ledger.manifestFingerprint(),
        taskId:task.taskId,taskVersion:task.version,method,seed,attempt:1,passed,
        verifierId,observedAt:Date.now(),
      };
      const artifact=signOutcomePayloadForFixture(payload,privatePem);
      assert.equal(ingestSignedOutcomeArtifact(ledger,manifest,artifact,trustedKeys).accepted,true);
    }
  }
}
const proposal=proposeVerifiedSkillPromotion(ledger,'baseline','candidate',{
  minPairedTasks:8,minAbsoluteGain:.1,minCompleteSeeds:3,
});
assert.equal(proposal.gate.accepted,true,'fixture must use a genuine evidence-backed proposal');

const store=new VersionedSkillCandidateStore(new InMemorySkillStorePersistence());
const skillId='p23-revision-boundary-skill';
const sourcePayload={name:'source-skill',steps:['safe-step']};
const source=store.stageCandidate(proposal,skillId,sourcePayload);
const engine=new P23LearningEngine();
engine.configureVerifiedSkillLifecycle(store);

function report(taskId,trialId,quality) {
  const partial=quality==='partial';
  const required=['read','reason','verify'];
  return evaluateSkillLearnBenchTrial({
    taskId,trialId,verifierPassed:partial,
    skill:{
      requiredCapabilityIds:required,
      coveredCapabilityIds:partial?['read','reason']:['read'],
      executable:true,safetyViolationCount:0,
    },
    trajectory:{
      expectedStepIds:['read','reason','verify'],
      observedStepIds:partial?['read','verify']:['verify','read'],
    },
  });
}
const baseline={
  validation:[report('validation-a','v-a','weak'),report('validation-b','v-b','weak')],
  holdout:[report('holdout-a','h-a','weak'),report('holdout-b','h-b','weak')],
};
const previousEvaluation={
  validation:[report('validation-a','v-a','partial'),report('validation-b','v-b','partial')],
  holdout:[report('holdout-a','h-a','weak'),report('holdout-b','h-b','weak')],
};

let generatorGetterCalls=0, evaluatorGetterCalls=0, evaluatorCalls=0;
const hostileGenerated=Object.defineProperty({name:'hostile-revision',steps:['safe-step']},'hidden',{
  enumerable:true,get(){generatorGetterCalls++;return 'must-not-be-read';},
});
await assert.rejects(()=>engine.generateAndStageReflectiveSkillRevision(
  proposal,skillId,source.candidateId,baseline,previousEvaluation,
  ()=>hostileGenerated,
  async()=>{throw new Error('independent evaluator must not receive a hostile generated payload');},
),/skill revision generator returned data outside the plain-data boundary/);
assert.equal(generatorGetterCalls,0,'P23 must reject generator accessors without invoking them');
assert.equal(store.snapshot().candidates.length,1,'hostile generated payload cannot stage a candidate');

const revisedPayload={name:'source-skill',steps:['safe-step','independently-verified-step']};
await assert.rejects(()=>engine.generateAndStageReflectiveSkillRevision(
  proposal,skillId,source.candidateId,baseline,previousEvaluation,
  ()=>revisedPayload,
  async input=>{
    evaluatorCalls++;
    const hostile= {payloadFingerprint:input.payloadFingerprint,evaluationFingerprint:'a'.repeat(64)};
    Object.defineProperty(hostile,'evaluation',{
      enumerable:true,get(){evaluatorGetterCalls++;return previousEvaluation;},
    });
    return hostile;
  },
),/independent evaluator returned data outside the plain-data boundary/);
assert.equal(evaluatorCalls,1);
assert.equal(evaluatorGetterCalls,0,'P23 must reject evaluator accessors before reading evaluation fields');
assert.equal(store.snapshot().candidates.length,1,'hostile evaluator report cannot stage a candidate');

function canonical(value) {
  if(value===undefined)return 'null';
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  return '{'+Object.keys(value).filter(key=>value[key]!==undefined).sort()
    .map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
}
let noOpEvaluatorCalls=0;
await assert.rejects(()=>engine.generateAndStageReflectiveSkillRevision(
  proposal,skillId,source.candidateId,baseline,previousEvaluation,
  ()=>sourcePayload,
  async()=>{noOpEvaluatorCalls++;throw new Error('no-op payload must not reach the evaluator');},
),/reflective revision payload is unchanged from its source candidate/);
assert.equal(noOpEvaluatorCalls,0,'unchanged generated payload must be rejected before expensive independent execution');
assert.equal(store.snapshot().candidates.length,1,'no-op revisions cannot add a candidate version');

const staged=await engine.generateAndStageReflectiveSkillRevision(
  proposal,skillId,source.candidateId,baseline,previousEvaluation,
  ()=>revisedPayload,
  async input=>{
    const evaluation=structuredClone(previousEvaluation);
    return {
      payloadFingerprint:input.payloadFingerprint,
      evaluationFingerprint:createHash('sha256').update(canonical(evaluation)).digest('hex'),
      evaluation,
    };
  },
);
assert.equal(staged.candidate.status,'staged');
assert.equal(staged.candidate.skillId,skillId);
assert.notEqual(staged.candidate.payloadFingerprint,source.payloadFingerprint);
assert.deepEqual(staged.candidate.payload,revisedPayload,
  'the exact revised payload that was independently evaluated must be durably staged, not discarded or replaced with source text');
assert.equal(store.snapshot().candidates.length,2,'only the detached, independently evaluated revision should stage');
assert.deepEqual(store.snapshot().active,[],
  'a successful evaluation can stage a candidate but cannot activate it without the separate approval path');
assert.ok(staged.plan.targets.length>0);
console.log('WORKPASS383_P23_REVISION_GENERATOR_BOUNDARY=PASS genuineProposal=true detachedPayload=true independentEvaluation=true stagedOnlyAfterGate=true');
