import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GepaReflectiveCandidateGenerator } from '../src/organism/learning/GepaReflectiveCandidateGenerator.ts';

const validationReport = {
  taskId: 'validation-task-01',
  trialId: 'validation-trial-01',
  taskSuccess: { passed: false, passRate: 0 },
  skillQuality: {
    functionalCoverage: 0.5, executability: 1, safety: 1, aggregate: 0.833333,
    missingCapabilityIds: ['needs-recovery-path'], safetyViolationCount: 0,
  },
  trajectoryQuality: {
    keyPointRecall: 0.5, executionOrder: 0.5, completeness: 0.5, aggregate: 0.5,
    missingStepIds: ['verify-result'], unexpectedStepIds: [],
  },
};
const validationTarget = {
  dimension: 'task-success',
  priority01: 0.5,
  affectedTaskIds: ['validation-task-01'],
  evidenceCount: 1,
  evidenceIds: ['validation-trial-01'],
  directive: 'Add an observable postcondition and bounded recovery branch.',
};
const holdoutTarget = {
  dimension: 'holdout-generalization',
  priority01: 0.25,
  affectedTaskIds: [],
  evidenceCount: 0,
  evidenceIds: [],
  directive: 'Improve generality without inspecting any holdout example.',
};
const request = {
  sourcePayload: { skill: 'current-v1', steps: ['open', 'edit'] },
  datasetFingerprint: 'a'.repeat(64),
  optimizerInstruction: 'Make the smallest change linked to the validation evidence.',
  validationEvidence: [validationReport],
  targets: [validationTarget, holdoutTarget],
  holdoutGeneralization: { gap01: -0.12, requiresFreshIndependentEvaluation: true },
};
function response(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('GEPA sidecar receives validation-only evidence and returns a payload, not fitness authority', async () => {
  let call;
  const adapter = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/v1/revise', apiKey: 'test-secret',
    fetchImpl: async (url, init) => {
      call = { url: String(url), init, body: JSON.parse(String(init?.body)) };
      return response({
        schemaVersion: 1,
        candidatePayload: { skill: 'current-v2', steps: ['open', 'edit', 'verify'] },
        score: 1, passed: true, promote: true, hiddenReasoning: 'not returned to NK1',
      });
    },
  });
  const payload = await adapter.generate(request);
  assert.deepEqual(payload, { skill: 'current-v2', steps: ['open', 'edit', 'verify'] });
  assert.equal(adapter.diagnostics().lastStatus, 'ok');
  assert.equal(adapter.diagnostics().requests, 1);
  assert.equal(call.url, 'https://optimizer.example.test/v1/revise');
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.redirect, 'error');
  assert.equal(call.init.headers.authorization, 'Bearer test-secret');
  assert.equal(call.body.adapter, 'nk1-gepa-revision-proposal');
  assert.equal(call.body.constraints.activationAuthority, 'NK1-P23');
  assert.equal(call.body.constraints.independentReevaluationRequired, true);
  assert.equal(call.body.holdoutGeneralization.gap01, -0.12);
  assert.deepEqual(call.body.holdoutGeneralization, { gap01: -0.12, requiresFreshIndependentEvaluation: true });
  assert.equal(JSON.stringify(call.body).includes('hidden-holdout-task-99'), false);
  assert.equal(JSON.stringify(call.body).includes('rawHoldoutReports'), true,
    'only the explicit false constraint marker is included; no raw holdout reports are attached');
  assert.equal(Object.hasOwn(payload, 'promote'), false, 'optimizer promotion claims must be discarded');
  assert.equal(Object.hasOwn(payload, 'score'), false, 'optimizer fitness must be independently recomputed by P23');
});

test('disabled by default and unconfigured modes never perform a request', async () => {
  let calls = 0;
  const disabled = new GepaReflectiveCandidateGenerator({ fetchImpl: async () => { calls++; return response({}); } });
  await assert.rejects(disabled.generate(request), /gepa-adapter-disabled/);
  assert.equal(disabled.diagnostics().enabled, false);
  assert.equal(calls, 0);
  const unconfigured = new GepaReflectiveCandidateGenerator({ enabled: true, fetchImpl: async () => { calls++; return response({}); } });
  await assert.rejects(unconfigured.generate(request), /gepa-adapter-unconfigured/);
  assert.equal(calls, 0);
});

test('network transport is HTTPS or loopback-only HTTP; remote cleartext fails closed', async () => {
  let calls = 0;
  const adapter = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'http://192.0.2.11:8090/revise', apiKey: 'secret',
    fetchImpl: async () => { calls++; return response({ schemaVersion: 1, candidatePayload: { ok: true } }); },
  });
  await assert.rejects(adapter.generate(request), /gepa-adapter-unconfigured/);
  assert.equal(adapter.diagnostics().available, false);
  assert.equal(calls, 0);
});

test('rejects a holdout target that smuggles task IDs or trial IDs to the optimizer', async () => {
  let calls = 0;
  const adapter = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'http://localhost:8090/revise', apiKey: 'test-secret',
    fetchImpl: async () => { calls++; return response({ schemaVersion: 1, candidatePayload: {} }); },
  });
  const bad = { ...request, targets: [{ ...holdoutTarget, affectedTaskIds: ['private-holdout-task'], evidenceCount: 1, evidenceIds: ['private-holdout-trial'] }] };
  await assert.rejects(adapter.generate(bad), /gepa-holdout-identifiers-forbidden/);
  assert.equal(calls, 0);
});

test('rejects revision targets whose evidence IDs are not present in validation data', async () => {
  const adapter = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/revise', apiKey: 'test-secret',
    fetchImpl: async () => response({ schemaVersion: 1, candidatePayload: {} }),
  });
  const bad = { ...request, targets: [{ ...validationTarget, evidenceIds: ['holdout-trial-1'] }] };
  await assert.rejects(adapter.generate(bad), /gepa-target-not-bound-to-validation/);
});

test('bounds the optimizer response and only accepts schemaVersion 1 with candidatePayload', async () => {
  const oversized = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/revise', apiKey: 'test-secret',
    maxResponseBytes: 4096,
    fetchImpl: async () => response({ schemaVersion: 1, candidatePayload: { text: 'x'.repeat(8000) } }),
  });
  await assert.rejects(oversized.generate(request), /gepa-response-too-large/);
  const missing = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/revise', apiKey: 'test-secret',
    fetchImpl: async () => response({ schemaVersion: 1, fitness: 1, passed: true }),
  });
  await assert.rejects(missing.generate(request), /gepa-adapter-candidate-payload-required/);
});

test('P23-compatible callback forwards only candidate-generation requests', async () => {
  let seen = false;
  const adapter = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/revise', apiKey: 'test-secret',
    fetchImpl: async (_url, init) => {
      seen = true;
      assert.match(String(init?.body), /candidate-payload-only/);
      return response({ schemaVersion: 1, candidatePayload: { skill: 'updated' } });
    },
  });
  const callback = adapter.asRevisionGenerator();
  assert.deepEqual(await callback(request), { skill: 'updated' });
  assert.equal(seen, true);
});

test('server composition root wires the optional adapter but keeps local generation as default', async () => {
  const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const server = await readFile(path.join(runtimeRoot, 'src/server/server.mjs'), 'utf8');
  const adapterSource = await readFile(path.join(runtimeRoot, 'src/organism/learning/GepaReflectiveCandidateGenerator.ts'), 'utf8');
  assert.match(server, /GepaReflectiveCandidateGenerator\.fromEnvironment\(\)/);
  assert.match(adapterSource, /NK1_GEPA_ENABLED === '1'/);
  assert.match(server, /generateSkillRevision: P23_SKILL_REVISION_GENERATOR/);
  assert.match(server, /: generateLocalSkillRevision\(LLAMA_CPP_PROVIDER, request\)/);
  assert.match(server, /asP23RevisionGenerator\(\)\(request\)/);
});

console.log('GEPA_REFLECTIVE_CANDIDATE_GENERATOR=PASS');
