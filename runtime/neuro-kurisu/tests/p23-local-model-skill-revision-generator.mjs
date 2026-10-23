import assert from 'node:assert/strict';
import { generateLocalSkillRevision } from '../src/organism/learning/P23LocalModelSkillRevisionGenerator.ts';

const calls = [];
const provider = {
  configured: () => true,
  async generate(request) {
    calls.push(request);
    return { text: JSON.stringify({ name: 'revised-skill', steps: ['safe-step', 'improved-step'] }), backend: 'test', model: 'fixture', latencyMs: 1 };
  },
};
const request = {
  datasetFingerprint: 'a'.repeat(64),
  sourcePayload: { name: 'source-skill', steps: ['safe-step'] },
  optimizerInstruction: 'Improve only the evidenced trajectory gap.',
  validationEvidence: [{ taskId: 'validation-task-1', trialId: 'validation-trial-1', pass: false }],
  targets: [{ dimension: 'trajectory', priority01: 0.8, affectedTaskIds: ['validation-task-1'], evidenceCount: 1, evidenceIds: ['validation-trial-1'], directive: 'Improve order.' }],
  holdoutPolicy: { resultsWithheld: true, requiresFreshIndependentEvaluation: true },
};
const result = await generateLocalSkillRevision(provider, request);
assert.deepEqual(result, { name: 'revised-skill', steps: ['safe-step', 'improved-step'] });
assert.equal(calls.length, 1);
assert.ok(calls[0].user.includes('validation-task-1'));
assert.ok(calls[0].user.includes('VERIFIED_DATASET_FINGERPRINT:'));
assert.ok(calls[0].user.includes('a'.repeat(64)));
assert.ok(calls[0].user.includes('HOLDOUT_RESULTS_WITHHELD:'));
assert.ok(!calls[0].user.includes('"gap01"'), 'numeric holdout metrics must never reach the generator');
assert.ok(!calls[0].user.includes('AGGREGATE_HOLDOUT_SIGNAL'), 'legacy aggregate score channel must remain absent');
assert.ok(!calls[0].user.includes('holdout-task-secret'), 'holdout case identifiers must not be supplied');
assert.equal(calls[0].temperature, 0.2);
assert.equal(calls[0].maxTokens, 4096);

const inheritedProvider=Object.create({
  configured(){return true;},
  async generate(){
    return {text:JSON.stringify({name:'inherited-provider-skill',steps:['verified-step']}),backend:'test',model:'fixture',latencyMs:1};
  },
});
assert.deepEqual(await generateLocalSkillRevision(inheritedProvider,request),
  {name:'inherited-provider-skill',steps:['verified-step']},
  'descriptor-based capability lookup must preserve class/prototype-backed host providers');

await assert.rejects(
  () => generateLocalSkillRevision({ ...provider, configured: () => false }, request),
  /p23-revision-local-model-not-configured/,
);
await assert.rejects(
  () => generateLocalSkillRevision(null, request),
  /p23-revision-local-model-not-configured/,
  'missing host provider keeps the established not-configured error contract',
);
await assert.rejects(
  () => generateLocalSkillRevision({ configured: () => true, async generate() { return { text: 'not JSON' }; } }, request),
  /p23-revision-generator-must-return-valid-json/,
);
await assert.rejects(
  () => generateLocalSkillRevision(provider, { ...request, targets: [] }),
  /p23-revision-evidence-backed-targets-required/,
);
await assert.rejects(
  () => generateLocalSkillRevision(provider, { ...request, datasetFingerprint: 'not-a-digest' }),
  /p23-revision-verified-dataset-fingerprint-required/,
);
await assert.rejects(
  () => generateLocalSkillRevision(provider, { ...request, holdoutPolicy: undefined, holdoutGeneralization: { gap01: -0.1, requiresFreshIndependentEvaluation: true } }),
  /p23-revision-holdout-results-must-remain-withheld/,
  'legacy numeric holdout feedback must not be accepted by the generator',
);
let requestGetterCalls=0;
const accessorRequest={...request};
Object.defineProperty(accessorRequest,'sourcePayload',{
  enumerable:true,get(){requestGetterCalls++;return {name:'forged-source'};},
});
await assert.rejects(
  ()=>generateLocalSkillRevision(provider,accessorRequest),
  /p23-revision-request-data-boundary-rejected/,
  'public generator entry must snapshot request fields without executing caller getters',
);
assert.equal(requestGetterCalls,0);

let responseGetterCalls=0;
const accessorResponseProvider={
  configured:()=>true,
  async generate(){
    const response={backend:'test',model:'fixture',latencyMs:1};
    Object.defineProperty(response,'text',{
      enumerable:true,get(){responseGetterCalls++;return JSON.stringify({name:'should-not-be-read'});},
    });
    return response;
  },
};
await assert.rejects(
  ()=>generateLocalSkillRevision(accessorResponseProvider,request),
  /p23-revision-generator-response-data-boundary-rejected/,
  'provider response text must be detached before access or JSON parsing',
);
assert.equal(responseGetterCalls,0);

let providerGetterCalls=0;
const accessorProvider={
  generate:async()=>({text:JSON.stringify({name:'unused'})}),
};
Object.defineProperty(accessorProvider,'configured',{
  enumerable:true,get(){providerGetterCalls++;return ()=>true;},
});
await assert.rejects(
  ()=>generateLocalSkillRevision(accessorProvider,request),
  /p23-revision-local-provider-capability-invalid/,
  'provider methods are capabilities and cannot be accessor-backed',
);
assert.equal(providerGetterCalls,0);
console.log('P23_LOCAL_MODEL_SKILL_REVISION_GENERATOR=PASS');
