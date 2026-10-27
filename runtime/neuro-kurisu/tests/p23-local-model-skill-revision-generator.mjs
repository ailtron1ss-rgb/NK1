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
  holdoutGeneralization: { gap01: -0.1, requiresFreshIndependentEvaluation: true },
};
const result = await generateLocalSkillRevision(provider, request);
assert.deepEqual(result, { name: 'revised-skill', steps: ['safe-step', 'improved-step'] });
assert.equal(calls.length, 1);
assert.ok(calls[0].user.includes('validation-task-1'));
assert.ok(calls[0].user.includes('VERIFIED_DATASET_FINGERPRINT:'));
assert.ok(calls[0].user.includes('a'.repeat(64)));
assert.ok(calls[0].user.includes('"gap01":-0.1'));
assert.ok(!calls[0].user.includes('holdout-task-secret'), 'holdout case identifiers must not be supplied');
assert.equal(calls[0].temperature, 0.2);
assert.equal(calls[0].maxTokens, 4096);

await assert.rejects(
  () => generateLocalSkillRevision({ ...provider, configured: () => false }, request),
  /p23-revision-local-model-not-configured/,
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
  () => generateLocalSkillRevision({
    configured: () => true,
    async generate() { return { text: JSON.stringify({ name: 'candidate-without-steps' }) }; },
  }, request),
  /p23-revision-generator-dropped-source-field/,
  'the model must not silently discard required fields from the source payload',
);
await assert.rejects(
  () => generateLocalSkillRevision({
    configured: () => true,
    async generate() { return { text: JSON.stringify({ name: 'candidate', steps: ['safe-step'] }) }; },
  }, { ...request, sourcePayload: 'legacy string payload' }),
  /p23-revision-generator-schema-mismatch/,
  'the model must not change the payload root type',
);

console.log('P23_LOCAL_MODEL_SKILL_REVISION_GENERATOR=PASS schemaPreserved=true');
