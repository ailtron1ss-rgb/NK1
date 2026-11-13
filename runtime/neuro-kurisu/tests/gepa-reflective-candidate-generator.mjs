import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
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
    missingCapabilityIds: ['missing-recovery'], safetyViolationCount: 0,
  },
  trajectoryQuality: {
    keyPointRecall: 0.5, executionOrder: 0.5, completeness: 0.5, aggregate: 0.5,
    missingStepIds: ['verify-result'], unexpectedStepIds: [],
  },
};
const request = {
  datasetFingerprint: 'a'.repeat(64),
  sourcePayload: { name: 'source-skill', steps: ['open', 'edit'] },
  optimizerInstruction: 'Repair the evidenced validation trajectory gap.',
  validationEvidence: [validationReport],
  targets: [{
    dimension: 'trajectory',
    priority01: 0.8,
    affectedTaskIds: ['validation-task-01'],
    evidenceCount: 1,
    evidenceIds: ['validation-trial-01'],
    directive: 'This caller-controlled text must be replaced by the adapter fixed directive.',
  }],
  holdoutPolicy: { resultsWithheld: true, requiresFreshIndependentEvaluation: true },
};
const respond = (payload, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });

test('disabled by default and unconfigured modes never perform a request', async () => {
  let calls = 0;
  const disabled = new GepaReflectiveCandidateGenerator({
    fetchImpl: async () => { calls++; return respond({}); },
  });
  await assert.rejects(disabled.generate(request), /gepa-adapter-disabled/);
  assert.equal(disabled.diagnostics().enabled, false);
  assert.equal(calls, 0);

  const unconfigured = new GepaReflectiveCandidateGenerator({
    enabled: true,
    fetchImpl: async () => { calls++; return respond({}); },
  });
  await assert.rejects(unconfigured.generate(request), /gepa-adapter-unconfigured/);
  assert.equal(calls, 0);
});

test('HTTPS request contains only allowlisted validation evidence and fixed revision targets', async () => {
  let call;
  const adapter = new GepaReflectiveCandidateGenerator({
    enabled: true,
    endpoint: 'https://optimizer.example.test/v1/revise',
    apiKey: 'test-secret',
    fetchImpl: async (url, init) => {
      call = { url: String(url), init, body: JSON.parse(String(init.body)) };
      return respond({
        schemaVersion: 1,
        candidatePayload: { name: 'candidate-v2', steps: ['open', 'edit', 'verify'] },
        score: 1, passed: true, promote: true, fitness: { holdoutDelta: 0.9 },
      });
    },
  });
  const result = await adapter.asP23RevisionGenerator()(request);
  assert.deepEqual(result, { name: 'candidate-v2', steps: ['open', 'edit', 'verify'] });
  assert.equal(adapter.diagnostics().lastStatus, 'ok');
  assert.equal(adapter.diagnostics().requests, 1);
  assert.equal(call.url, 'https://optimizer.example.test/v1/revise');
  assert.equal(call.init.method, 'POST');
  assert.equal(call.init.redirect, 'error');
  assert.equal(call.init.headers.authorization, 'Bearer test-secret');
  assert.equal(call.body.adapter, 'nk1-gepa-validation-only');
  assert.equal(call.body.purpose, 'candidate-payload-only');
  assert.equal(call.body.constraints.holdoutResultsIncluded, false);
  assert.equal(call.body.constraints.holdoutCaseIdentifiersIncluded, false);
  assert.equal(call.body.constraints.activationAuthority, 'NK1-P23');
  assert.equal(call.body.constraints.independentReevaluationRequired, true);
  assert.deepEqual(call.body.revisionTargets[0].affectedTaskIds, ['validation-task-01']);
  assert.deepEqual(call.body.revisionTargets[0].evidenceIds, ['validation-trial-01']);
  assert.notEqual(call.body.revisionTargets[0].directive, request.targets[0].directive,
    'caller free text must not override the adapter fixed allowlisted directive');
  assert.equal(JSON.stringify(call.body).includes('holdoutDelta'), false);
  assert.equal(JSON.stringify(call.body).includes('holdoutGeneralization'), false);
  assert.equal(JSON.stringify(call.body).includes('fitness'), false);
  assert.equal(JSON.stringify(call.body).includes('optimizerInstruction'), false,
    'planner-generated prose is not sent as free text; structured evidence and fixed directives are sent instead');
  assert.equal(Object.hasOwn(result, 'promote'), false, 'optimizer activation claims must be discarded');
  assert.equal(Object.hasOwn(result, 'score'), false, 'optimizer fitness must be independently recomputed by P23');
});

test('rejects any attempted holdout side-channel before network I/O', async () => {
  let calls = 0;
  const adapter = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/revise', apiKey: 'secret',
    fetchImpl: async () => { calls++; return respond({ schemaVersion: 1, candidatePayload: {} }); },
  });
  await assert.rejects(
    adapter.generate({ ...request, holdoutGeneralization: { gap01: -0.2, requiresFreshIndependentEvaluation: true } }),
    /gepa-request-unsupported-field/,
  );
  await assert.rejects(
    adapter.generate({ ...request, targets: [{ ...request.targets[0], dimension: 'holdout-generalization' }] }),
    /gepa-invalid-revision-target/,
  );
  await assert.rejects(
    adapter.generate({ ...request, targets: [{ ...request.targets[0], affectedTaskIds: ['secret-holdout-task'] }] }),
    /gepa-target-not-bound-to-validation/,
  );
  await assert.rejects(
    adapter.generate({ ...request, targets: [{ ...request.targets[0], evidenceIds: ['secret-holdout-trial'] }] }),
    /gepa-target-not-bound-to-validation/,
  );
  assert.equal(calls, 0);
});

test('endpoint policy allows HTTPS and loopback HTTP but rejects remote cleartext and redirects', async () => {
  let calls = 0;
  const remoteCleartext = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'http://192.0.2.11:8090/revise', apiKey: 'secret',
    fetchImpl: async () => { calls++; return respond({ schemaVersion: 1, candidatePayload: {} }); },
  });
  await assert.rejects(remoteCleartext.generate(request), /gepa-adapter-unconfigured/);
  assert.equal(calls, 0);
  const redirected = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/revise', apiKey: 'secret',
    fetchImpl: async (_url, init) => {
      assert.equal(init.redirect, 'error');
      return new Response('', { status: 302, headers: { location: 'https://other.example.test/' } });
    },
  });
  await assert.rejects(redirected.generate(request), /gepa-adapter-http-302/);
});

test('rejects invalid or missing candidate payloads and oversized response bodies', async () => {
  const missing = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/revise', apiKey: 'secret',
    fetchImpl: async () => respond({ schemaVersion: 1, fitness: 1, passed: true }),
  });
  await assert.rejects(missing.generate(request), /gepa-adapter-candidate-payload-required/);

  const oversized = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/revise', apiKey: 'secret',
    maxResponseBytes: 4096,
    fetchImpl: async () => respond({ schemaVersion: 1, candidatePayload: { text: 'x'.repeat(8000) } }),
  });
  await assert.rejects(oversized.generate(request), /gepa-response-too-large/);
});

test('source and evidence bounds fail before network I/O', async () => {
  let calls = 0;
  const adapter = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/revise', apiKey: 'secret',
    fetchImpl: async () => { calls++; return respond({ schemaVersion: 1, candidatePayload: {} }); },
  });
  await assert.rejects(
    adapter.generate({ ...request, sourcePayload: { text: 'x'.repeat(256 * 1024 + 1) } }),
    /gepa-source-payload-too-large/,
  );
  await assert.rejects(
    adapter.generate({ ...request, datasetFingerprint: 'not-a-digest' }),
    /gepa-request-metadata-invalid/,
  );
  await assert.rejects(
    adapter.generate({ ...request, validationEvidence: [] }),
    /gepa-validation-evidence-required/,
  );
  assert.equal(calls, 0);
});

test('real loopback HTTP roundtrip reaches the P23 callback and drops optimizer authority', async () => {
  let received;
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    received = {
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      body: JSON.parse(raw),
    };
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify({
      schemaVersion: 1,
      candidatePayload: { name: 'through-real-http', steps: ['verify'] },
      score: 1, promote: true,
    }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  try {
    const adapter = new GepaReflectiveCandidateGenerator({
      enabled: true,
      endpoint: 'http://127.0.0.1:' + address.port + '/revise',
      apiKey: 'loopback-test-secret',
    });
    const candidate = await adapter.asP23RevisionGenerator()(request);
    assert.deepEqual(candidate, { name: 'through-real-http', steps: ['verify'] });
    assert.equal(received.method, 'POST');
    assert.equal(received.url, '/revise');
    assert.equal(received.authorization, 'Bearer loopback-test-secret');
    assert.equal(received.body.constraints.activationAuthority, 'NK1-P23');
    assert.equal(JSON.stringify(received.body).includes('SECRET_HOLDOUT'), false);
    assert.equal(adapter.diagnostics().lastStatus, 'ok');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('server composition exposes GEPA only when explicitly enabled and retains local fallback', async () => {
  const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const server = await readFile(path.join(runtimeRoot, 'src/server/server.mjs'), 'utf8');
  const adapter = await readFile(path.join(runtimeRoot, 'src/organism/learning/GepaReflectiveCandidateGenerator.ts'), 'utf8');
  assert.match(server, /GepaReflectiveCandidateGenerator\.fromEnvironment\(\)/);
  assert.match(adapter, /NK1_GEPA_ENABLED === '1'/);
  assert.match(server, /asP23RevisionGenerator\(\)/);
  assert.match(server, /generateLocalSkillRevision\(LLAMA_CPP_PROVIDER, request\)/);
  assert.match(server, /compound repair revision provider module/);
});

test('candidate payload cannot drop source fields before P23 receives it', async () => {
  const adapter = new GepaReflectiveCandidateGenerator({
    enabled: true, endpoint: 'https://optimizer.example.test/revise', apiKey: 'secret',
    fetchImpl: async () => respond({ schemaVersion: 1, candidatePayload: { name: 'missing-steps-field' } }),
  });
  await assert.rejects(adapter.generate(request), /gepa-candidate-dropped-source-field/);
});

console.log('GEPA_REFLECTIVE_CANDIDATE_GENERATOR=PASS');
