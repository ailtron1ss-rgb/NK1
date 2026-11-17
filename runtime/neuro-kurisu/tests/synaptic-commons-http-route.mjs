import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  synapticArtifactFingerprint,
  synapticAttestationSigningPayload,
} from '../src/organism/learning/SynapticCommons.ts';

const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateDir = await mkdtemp(path.join(tmpdir(), 'neurocore-synaptic-http-'));
const deadlineAt = Date.now() + 120_000;
const token = 'nk1-synaptic-http-test-token';
const publisher = generateKeyPairSync('ed25519');
const attestor = generateKeyPairSync('ed25519');
const publicPem = pair => pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const privatePem = pair => pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const environmentFingerprint = 'e'.repeat(64);
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const address = probe.address();
assert.ok(address && typeof address === 'object');
const port = address.port;
await new Promise(resolve => probe.close(resolve));

const child = spawn(process.execPath, ['--experimental-strip-types', 'src/server/server.mjs'], {
  cwd: runtimeRoot,
  env: {
    ...process.env,
    HOST: '0.0.0.0',
    PORT: String(port),
    STATE_DIR: stateDir,
    NEURO_API_TOKEN: token,
    NK_MEM0_ENABLED: '0',
    LLM_TIMEOUT_MS: '5000',
    NEURO_REQUEST_TIMEOUT_MS: '20000',
    NEURO_SYNAPTIC_COMMONS_PUBLISHER_KEYS_JSON: JSON.stringify({ 'http-publisher': publicPem(publisher) }),
    NEURO_SYNAPTIC_COMMONS_ATTESTOR_KEYS_JSON: JSON.stringify({ 'http-evaluator': publicPem(attestor) }),
    NEURO_SYNAPTIC_COMMONS_LICENSE_REVIEW_FINGERPRINTS_JSON: JSON.stringify(['b'.repeat(64)]),
    NEURO_SYNAPTIC_COMMONS_RUNTIME_VERSION: '1.2.0',
    NEURO_SYNAPTIC_COMMONS_ENVIRONMENT_FINGERPRINT: environmentFingerprint,
    NEURO_SYNAPTIC_COMMONS_SUPPORTED_CAPABILITIES_JSON: JSON.stringify(['documents.read', 'documents.summarize']),
    NEURO_SYNAPTIC_COMMONS_PERMITTED_TOOLS_JSON: JSON.stringify(['documents.fetch']),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let childExit = null;
const append = chunk => { output = (output + String(chunk)).slice(-12000); };
child.stdout.on('data', append);
child.stderr.on('data', append);
child.once('exit', (code, signal) => { childExit = { code, signal }; });

async function waitReady() {
  while (Date.now() < deadlineAt) {
    if (childExit) throw new Error('server exited before readiness: ' + JSON.stringify(childExit) + ' ' + output);
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/api/health', { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.json()).ready === true) return;
    } catch { /* server is still starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('server startup timed out: ' + output);
}
async function request(pathname, method = 'GET', payload = undefined, authorized = true) {
  const headers = {};
  if (payload !== undefined) headers['content-type'] = 'application/json';
  if (authorized) headers.authorization = 'Bearer ' + token;
  const response = await fetch('http://127.0.0.1:' + port + pathname, {
    method, headers, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    signal: AbortSignal.timeout(15000),
  });
  return { response, body: await response.json() };
}
function makeArtifact() {
  const artifact = {
    schemaVersion: 1,
    skill: {
      skillId: 'http-portable-summary',
      name: 'HTTP portable summary',
      version: '1.0.0',
      summary: 'A test-only declarative read-only skill package.',
      kind: 'procedure',
    },
    contract: {
      capability: 'documents.summarize',
      requiredCapabilities: ['documents.read'],
      requiredTools: ['documents.fetch'],
      permissionClass: 'assisted',
      allowedModes: ['assisted'],
      minimumRuntimeVersion: '1.0.0',
      environmentFingerprint,
    },
    definition: {
      format: 'declarative-json-v1',
      payload: { steps: [{ operation: 'invoke-capability', capability: 'documents.fetch' }] },
    },
    provenance: {
      sourceInstanceId: 'nk1-http-source',
      sourceRuntimeVersion: '1.2.0',
      sourceArtifactFingerprint: 'a'.repeat(64),
      createdAt: Date.now(),
    },
    license: {
      identifier: 'Apache-2.0',
      redistributionAllowed: true,
      reviewFingerprint: 'b'.repeat(64),
    },
    signature: { keyId: 'http-publisher', algorithm: 'Ed25519', value: 'A'.repeat(88) },
  };
  const fingerprint = synapticArtifactFingerprint(artifact);
  artifact.signature.value = sign(null, Buffer.from(fingerprint), privatePem(publisher)).toString('base64');
  return { artifact, fingerprint };
}
function makeAttestation(fingerprint) {
  const now = Date.now();
  const receipt = {
    schemaVersion: 1,
    artifactFingerprint: fingerprint,
    attestorId: 'http-evaluator',
    runtimeVersion: '1.2.0',
    environmentFingerprint,
    testSuiteFingerprint: 'c'.repeat(64),
    holdoutFingerprint: 'd'.repeat(64),
    independentSeedCount: 5,
    holdoutSamples: 5,
    baselinePasses: 3,
    candidatePasses: 4,
    issuedAt: now,
    expiresAt: now + 7 * 24 * 60 * 60_000,
    signature: { algorithm: 'Ed25519', value: 'A'.repeat(88) },
  };
  receipt.signature.value = sign(null, Buffer.from(synapticAttestationSigningPayload(receipt)),
    privatePem(attestor)).toString('base64');
  return receipt;
}

try {
  await waitReady();

  const unauthorized = await request('/api/organism/synaptic-commons');
  assert.equal(unauthorized.response.status, 200);
  const unauthorizedWithoutToken = await request('/api/organism/synaptic-commons', 'GET', undefined, false);
  assert.equal(unauthorizedWithoutToken.response.status, 401);

  const initial = await request('/api/organism/synaptic-commons');
  assert.equal(initial.body.diagnostics.total, 0);
  assert.equal(initial.body.diagnostics.executableCount, 0);

  const { artifact, fingerprint } = makeArtifact();
  const unconfirmed = await request('/api/organism/synaptic-commons/import', 'POST', {
    confirmed: false, artifact,
  });
  assert.equal(unconfirmed.response.status, 400);
  assert.equal(unconfirmed.body.error, 'explicit-synaptic-import-confirmation-required');

  const imported = await request('/api/organism/synaptic-commons/import', 'POST', {
    confirmed: true, artifact,
  });
  assert.equal(imported.response.status, 201, JSON.stringify(imported.body));
  assert.equal(imported.body.status, 'quarantined');
  assert.equal(imported.body.artifactFingerprint, fingerprint);

  const duplicate = await request('/api/organism/synaptic-commons/import', 'POST', {
    confirmed: true, artifact,
  });
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.body.duplicate, true);

  const unconfirmedCompatibility = await request(
    '/api/organism/synaptic-commons/' + fingerprint + '/compatibility',
    'POST', { confirmed: false },
  );
  assert.equal(unconfirmedCompatibility.response.status, 400);

  const compatibility = await request(
    '/api/organism/synaptic-commons/' + fingerprint + '/compatibility',
    'POST', { confirmed: true },
  );
  assert.equal(compatibility.response.status, 200, JSON.stringify(compatibility.body));
  assert.equal(compatibility.body.status, 'compatible');
  assert.equal(compatibility.body.executable, false);

  const attestation = makeAttestation(fingerprint);
  const attest = await request(
    '/api/organism/synaptic-commons/' + fingerprint + '/attestation',
    'POST', { confirmed: true, attestation },
  );
  assert.equal(attest.response.status, 200, JSON.stringify(attest.body));
  assert.equal(attest.body.status, 'attested');
  assert.equal(attest.body.executable, false);

  const listed = await request('/api/organism/synaptic-commons');
  assert.equal(listed.body.diagnostics.attested, 1);
  assert.equal(listed.body.diagnostics.executableCount, 0);
  assert.equal(listed.body.records[0].skill.skillId, 'http-portable-summary');

  const exported = await request('/api/organism/synaptic-commons/' + fingerprint + '/export');
  assert.equal(exported.response.status, 200, JSON.stringify(exported.body));
  assert.equal(exported.body.artifactFingerprint, undefined,
    'the portable export contains the artifact and evidence bundle rather than a forged identity field');
  assert.equal(exported.body.artifact.skill.skillId, 'http-portable-summary');
  assert.equal(exported.body.attestation.artifactFingerprint, fingerprint);
  assert.equal(exported.body.executable, false);

  const missingExecRoute = await request('/api/organism/synaptic-commons/' + fingerprint + '/execute', 'POST', { confirmed: true });
  assert.equal(missingExecRoute.response.status, 404,
    'the distribution API must not expose a direct skill execution route');

  console.log('SYNAPTIC_COMMONS_HTTP_ROUTE=PASS');
} finally {
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  if (child.exitCode === null && child.signalCode === null) {
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
  if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  await rm(stateDir, { recursive: true, force: true });
}
