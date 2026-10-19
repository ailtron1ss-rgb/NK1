import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { atomizeResearchClaim } from '../src/organism/system/ResearchClaimAssessment.ts';
import { assessClaimWithSemanticEntailment, HttpResearchNliBackend, validateResearchNliEndpoint } from '../src/organism/system/ResearchSemanticEntailment.ts';
import { EvidenceFirewallEngine } from '../src/organism/system/EvidenceFirewall.ts';
import { ProjectResearchSession } from '../src/organism/system/ProjectResearchSession.ts';

const claim = 'System is safe for deployment';
const revisionA = 'a'.repeat(40);
const revisionB = 'b'.repeat(40);
const scores = (label) => label === 'support'
  ? { entailment: .93, contradiction: .02, neutral: .05 }
  : label === 'refute'
    ? { entailment: .02, contradiction: .94, neutral: .04 }
    : { entailment: .15, contradiction: .12, neutral: .73 };
const fakeBackend = (resolve = () => 'support') => ({
  modelId: 'test-fixture-nli-v1',
  async evaluate(premise, hypothesis) {
    if (!premise || !hypothesis) return null;
    const verdict = resolve(premise, hypothesis);
    return { modelId: 'test-fixture-nli-v1', modelRevision: revisionA, scores: scores(verdict) };
  },
});
const candidate = (host, snippet, hash) => ({
  url: `https://${host}/release`, title: `Release ${host}`, documentKey: `https://${host}/release`,
  contentHash: hash.repeat(64).slice(0, 64), sourceKey: host, sourceLineageKey: `lineage:${host}`,
  snippet, fetchedAt: Date.now(), claim,
});

// Atomic splitting is intentionally conservative: adjective conjunctions remain intact.
assert.deepEqual(atomizeResearchClaim('System is safe for deployment and the backup process is recoverable').map(x => x.claim), [
  'System is safe for deployment', 'the backup process is recoverable',
]);
assert.equal(atomizeResearchClaim('The system is fast and reliable').length, 1);
assert.equal(atomizeResearchClaim('System is safe for deployment; the backup process is recoverable').length, 2);
assert.equal(atomizeResearchClaim('This is safe or not safe').length, 1, 'disjunction is not rewritten into two claims');

assert.equal(validateResearchNliEndpoint('http://127.0.0.1:8798/v1/nli').pathname, '/v1/nli');
assert.throws(() => validateResearchNliEndpoint('http://nli.example/v1/nli'), /HTTPS/);
assert.throws(() => validateResearchNliEndpoint('https://user:pass@nli.example/v1/nli'), /userinfo/);

const semSupport = await assessClaimWithSemanticEntailment(claim, candidate('a.example', 'The release owner confirms that the system is safe for deployment.', 'a'), fakeBackend());
assert.equal(semSupport.verdict, 'support');
assert.equal(semSupport.method, 'nli-cross-encoder-v1');
assert.equal(semSupport.scope, 'model-assisted-entailment');
assert.equal(semSupport.calibratedProbability, null, 'model softmax is not claimed to be calibrated');
assert.equal(semSupport.modelId, 'test-fixture-nli-v1');
assert.equal(semSupport.modelRevision, revisionA, 'exact model revision propagates to the claim assessment');
assert.equal(semSupport.quotes[0].semantic.modelRevision, revisionA, 'source quote keeps the model revision used to score it');
assert(semSupport.quotes[0].semantic.entailmentScore > .9);

let batchCallCount = 0;
const batchOnlyBackend = {
  modelId: 'batch-fixture-nli-v1',
  async evaluate() { throw new Error('single-pair endpoint should not be used when batch evaluation is available'); },
  async evaluateBatch(pairs) {
    batchCallCount++;
    return pairs.map(() => ({ modelId: 'batch-fixture-nli-v1', modelRevision: revisionA, scores: scores('support') }));
  },
};
const batchedAssessment = await assessClaimWithSemanticEntailment(
  claim,
  candidate('batch.example', 'The release owner confirms that the system is safe for deployment. The backup process is recoverable.', 'b'),
  batchOnlyBackend,
);
assert.equal(batchedAssessment.verdict, 'support');
assert.equal(batchCallCount, 1, 'claim evidence should use one positional batch request rather than N individual HTTP requests');

const semRefute = await assessClaimWithSemanticEntailment(claim, candidate('b.example', 'The report says System is not safe for deployment.', 'b'), fakeBackend(() => 'refute'));
assert.equal(semRefute.verdict, 'refute');
const semUnknown = await assessClaimWithSemanticEntailment(claim, candidate('c.example', 'The rollout improved uptime and reduced incident volume.', 'c'), fakeBackend(() => 'unknown'));
assert.equal(semUnknown.verdict, 'unknown', 'neutral stays unknown');
const unavailable = await assessClaimWithSemanticEntailment(claim, candidate('d.example', 'System is safe for deployment.', 'd'), { modelId: 'offline', async evaluate() { return null; } });
assert.equal(unavailable.method, 'nli-cross-encoder-v1', 'configured NLI outage must not fall through to lexical baseline');
assert.equal(unavailable.scope, 'model-assisted-entailment');
assert.equal(unavailable.verdict, 'unknown');
assert.equal(unavailable.quotes.length, 0);
assert.match(unavailable.reason, /fail-closed/);
const throwingBackend = await assessClaimWithSemanticEntailment(claim, candidate('throw.example', 'System is safe for deployment.', 't'), { modelId: 'throwing-backend', async evaluate() { throw new Error('simulated transport failure'); } });
assert.equal(throwingBackend.verdict, 'unknown', 'thrown backend errors fail closed instead of escaping or falling back');
assert.equal(throwingBackend.method, 'nli-cross-encoder-v1');

const outageSession = new ProjectResearchSession(new EvidenceFirewallEngine());
outageSession.begin('outage-project', 'outage-project:claim');
outageSession.ingest({
  url: 'https://offline.example/release', finalUrl: 'https://offline.example/release', sourceHost: 'offline.example',
  independenceKey: 'offline.example', status: 200, ok: true, verified: true, externalEvidence: true,
  contentType: 'text/plain', title: 'Offline source', contentHash: 'o'.repeat(64), bytes: 60,
  snippet: 'The release owner confirms the system is safe for deployment.', fetchedAt: 5,
  trust01: .9, relevance01: .9, queryHash: 'f'.repeat(64), claim,
}, 'external-api');
await outageSession.assessLatestSemantically({ modelId: 'offline', async evaluate() { return null; } });
assert.equal(outageSession.snapshot().claimVerification.verdict, 'unknown');
assert.equal(outageSession.snapshot().claimVerification.scope, 'model-assisted-entailment');
const outageRestored = new ProjectResearchSession(new EvidenceFirewallEngine());
outageRestored.restore(outageSession.snapshot());
assert.equal(outageRestored.snapshot().claimVerification.verdict, 'unknown', 'NLI outage fail-closed state survives restart');
assert.equal(outageRestored.snapshot().claimVerification.scope, 'model-assisted-entailment');

const mixedAtoms = await assessClaimWithSemanticEntailment('System is safe for deployment but the backup process is recoverable', candidate('e.example', 'System is safe for deployment. The backup process is recoverable.', 'e'), fakeBackend((premise, hypothesis) => hypothesis.startsWith('System') ? 'support' : 'unknown'));
assert.equal(mixedAtoms.verdict, 'unknown', 'partial support must not certify an entire compound assertion');
assert.equal(mixedAtoms.atomAssessments.length, 2);

const versionDriftBackend = {
  modelId: 'rolling-model',
  async evaluate() { return null; },
  async evaluateBatch(pairs) { return pairs.map((_, index) => ({ modelId: 'rolling-model', modelRevision: index ? revisionB : revisionA, scores: scores(index ? 'refute' : 'support') })); },
};
const versionDrift = await assessClaimWithSemanticEntailment('System is safe for deployment; the backup process is recoverable', candidate('drift.example', 'System is safe for deployment. The backup process is recoverable.', 'v'), versionDriftBackend);
assert.equal(versionDrift.verdict, 'unknown', 'support/refutation from different model revisions must never be combined');
assert.equal(versionDrift.quotes.length, 0, 'version drift cannot leave reusable semantic quotes');
assert.match(versionDrift.reason, /model-identity-changed/);

// The HTTP protocol test uses a local loopback mock; it does not contact any provider.
let receivedAuth = '';
let omitHttpModelRevision = false;
let calibratedHttpFixture = false;
let malformedCalibrationFixture = false;
const fixtureCalibration = { method: 'temperature-scaling-from-softmax-v1', datasetSha256: 'd'.repeat(64), sampleCount: 120, temperature: 1.6 };
const httpServer = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  const data = JSON.parse(body);
  receivedAuth = req.headers.authorization || '';
  let response;
  if (req.url === '/v1/nli/batch') {
    assert(Array.isArray(data.pairs));
    response = { modelId: 'mock-nli-http-v1', ...(omitHttpModelRevision ? {} : { modelRevision: revisionA }), results: data.pairs.map(() => ({ modelId: 'mock-nli-http-v1', ...(omitHttpModelRevision ? {} : { modelRevision: revisionA }), scores: scores('support'), calibrated: calibratedHttpFixture, calibration: calibratedHttpFixture ? { ...fixtureCalibration, ...(malformedCalibrationFixture ? { datasetSha256: 'bad' } : {}) } : null })), calibrated: calibratedHttpFixture, calibration: calibratedHttpFixture ? { ...fixtureCalibration, ...(malformedCalibrationFixture ? { datasetSha256: 'bad' } : {}) } : null };
  } else {
    assert(data.premise && data.hypothesis);
    response = { modelId: 'mock-nli-http-v1', ...(omitHttpModelRevision ? {} : { modelRevision: revisionA }), scores: scores('support'), calibrated: calibratedHttpFixture, calibration: calibratedHttpFixture ? { ...fixtureCalibration, ...(malformedCalibrationFixture ? { datasetSha256: 'bad' } : {}) } : null };
  }
  const payload = JSON.stringify(response);
  res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
});
await new Promise(resolve => httpServer.listen(0, '127.0.0.1', resolve));
try {
  const port = httpServer.address().port;
  const httpBackend = new HttpResearchNliBackend({ endpoint: `http://127.0.0.1:${port}/v1/nli`, bearerToken: 'test-only-token', timeoutMs: 1000 });
  const httpResult = await httpBackend.evaluate('This sentence is long enough to serve as a premise.', 'This sentence is long enough to serve as a hypothesis.');
  assert.equal(receivedAuth, 'Bearer test-only-token');
  assert.equal(httpResult.modelId, 'mock-nli-http-v1');
  assert.equal(httpResult.modelRevision, revisionA);
  assert.equal(httpResult.scores.entailment, .93);
  const batchResults = await httpBackend.evaluateBatch([
    { premise: 'This first sentence is long enough to serve as premise.', hypothesis: 'This first hypothesis is sufficiently descriptive.' },
    { premise: 'This second sentence is long enough to serve as premise.', hypothesis: 'This second hypothesis is sufficiently descriptive.' },
  ]);
  assert.equal(batchResults.length, 2);
  assert.equal(batchResults[1].modelId, 'mock-nli-http-v1');
  assert.equal(batchResults[1].modelRevision, revisionA);
  assert.equal(batchResults[0].scores.entailment, .93);
  calibratedHttpFixture = true;
  const calibratedHttpResult = await httpBackend.evaluate('This premise sentence is long enough for NLI.', 'This hypothesis sentence is long enough for NLI.');
  assert.equal(calibratedHttpResult.calibrated, true);
  assert.equal(calibratedHttpResult.calibration.datasetSha256, 'd'.repeat(64));
  assert.equal(calibratedHttpResult.calibration.temperature, 1.6);
  malformedCalibrationFixture = true;
  const malformedCalibrationResult = await httpBackend.evaluate('This premise sentence is long enough for NLI.', 'This hypothesis sentence is long enough for NLI.');
  assert.equal(malformedCalibrationResult, null, 'malformed calibration metadata cannot be accepted as calibrated evidence');
  malformedCalibrationFixture = false;
  calibratedHttpFixture = false;
  omitHttpModelRevision = true;
  const unversionedHttpResult = await httpBackend.evaluate('This premise sentence is long enough for NLI.', 'This hypothesis sentence is long enough for NLI.');
  assert.equal(unversionedHttpResult, null, 'HTTP inference without exact model revision is not accepted as reproducible evidence');
  omitHttpModelRevision = false;
} finally {
  await new Promise(resolve => httpServer.close(resolve));
}

// Older loopback services may implement only /v1/nli. A missing batch route is
// backward-compatible, but an outage/overload must not fan out into extra requests.
let legacySingleCalls = 0;
const legacyServer = createServer(async (req, res) => {
  let body = ''; for await (const chunk of req) body += chunk;
  if (req.url === '/v1/nli/batch') { res.writeHead(404); res.end(''); return; }
  if (req.url === '/v1/nli') {
    legacySingleCalls++;
    const payload = JSON.stringify({ modelId: 'legacy-single-nli-v1', modelRevision: revisionA, scores: scores('support') });
    res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }); res.end(payload); return;
  }
  res.writeHead(404); res.end('');
});
await new Promise(resolve => legacyServer.listen(0, '127.0.0.1', resolve));
try {
  const legacyBackend = new HttpResearchNliBackend({ endpoint: `http://127.0.0.1:${legacyServer.address().port}/v1/nli`, timeoutMs: 1000 });
  const legacyResults = await legacyBackend.evaluateBatch([
    { premise: 'The release review confirms deployment is safe.', hypothesis: 'Deployment is safe according to the release review.' },
    { premise: 'The second independent report confirms deployment is safe.', hypothesis: 'Deployment is safe according to the second report.' },
  ]);
  assert.equal(legacyResults.length, 2);
  assert(legacyResults.every(result => result?.modelId === 'legacy-single-nli-v1' && result?.modelRevision === revisionA));
  assert.equal(legacySingleCalls, 2, '404 batch compatibility retries once per bounded pair on the old single endpoint');
} finally {
  await new Promise(resolve => legacyServer.close(resolve));
}

let overloadRequests = 0;
const overloadServer = createServer(async (req, res) => {
  overloadRequests++;
  let body = ''; for await (const chunk of req) body += chunk;
  res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"error":"busy"}');
});
await new Promise(resolve => overloadServer.listen(0, '127.0.0.1', resolve));
try {
  const overloadedBackend = new HttpResearchNliBackend({ endpoint: `http://127.0.0.1:${overloadServer.address().port}/v1/nli`, timeoutMs: 1000 });
  const overloadedResults = await overloadedBackend.evaluateBatch([
    { premise: 'The release review confirms deployment is safe.', hypothesis: 'Deployment is safe according to the release review.' },
    { premise: 'The second independent report confirms deployment is safe.', hypothesis: 'Deployment is safe according to the second report.' },
  ]);
  assert.deepEqual(overloadedResults, [null, null]);
  assert.equal(overloadRequests, 1, '503 overload must not fan out into individual requests');
} finally {
  await new Promise(resolve => overloadServer.close(resolve));
}

const session = new ProjectResearchSession(new EvidenceFirewallEngine());
session.begin('nli-project', 'nli-project:claim');
const source = (host, hash, snippet, at) => ({
  url: `https://${host}/release`, finalUrl: `https://${host}/release`, sourceHost: host,
  independenceKey: host, status: 200, ok: true, verified: true, externalEvidence: true,
  contentType: 'text/plain', title: `Release ${host}`, contentHash: hash.repeat(64).slice(0, 64),
  bytes: snippet.length, snippet, fetchedAt: at, trust01: .9, relevance01: .9,
  queryHash: 'f'.repeat(64), claim,
});
session.ingest(source('alpha.example', 'a', 'The release owner confirms the system is safe for deployment.', 1), 'external-api');
await session.assessLatestSemantically(fakeBackend());
assert.equal(session.snapshot().claimVerification.verdict, 'unknown', 'one source does not pass independent corroboration');
session.ingest(source('beta.example', 'b', 'An independent reviewer confirms the system is safe for deployment.', 2), 'external-api');
await session.assessLatestSemantically(fakeBackend());
assert.equal(session.snapshot().claimVerification.verdict, 'support');
assert.equal(session.snapshot().claimVerification.method, 'nli-cross-encoder-v1');
assert.deepEqual(session.snapshot().claimVerification.modelVersions, [{ modelId: 'test-fixture-nli-v1', modelRevision: revisionA }], 'aggregate exposes exact model version used for evidence');

const calibratedBackend = () => ({
  modelId: 'calibrated-fixture-v1',
  async evaluate(premise, hypothesis) {
    return { modelId: 'calibrated-fixture-v1', modelRevision: revisionA, calibrated: true,
      calibration: { method: 'temperature-scaling-from-softmax-v1', datasetSha256: 'e'.repeat(64), sampleCount: 120, temperature: 1.4 }, scores: scores('support') };
  },
  async evaluateBatch(pairs) {
    return pairs.map(() => ({ modelId: 'calibrated-fixture-v1', modelRevision: revisionA, calibrated: true,
      calibration: { method: 'temperature-scaling-from-softmax-v1', datasetSha256: 'e'.repeat(64), sampleCount: 120, temperature: 1.4 }, scores: scores('support') }));
  },
});
const calibratedSession = new ProjectResearchSession(new EvidenceFirewallEngine());
calibratedSession.begin('calibrated-project', 'calibrated-project:claim');
calibratedSession.ingest(source('alpha.example', 'e', 'The release owner confirms the system is safe for deployment.', 9), 'external-api');
await calibratedSession.assessLatestSemantically(calibratedBackend());
assert.equal(calibratedSession.snapshot().results[0].claimAssessment.calibration.datasetSha256, 'e'.repeat(64));
const tamperedCalibrationSnapshot = structuredClone(calibratedSession.snapshot());
const quoteWithCalibration = tamperedCalibrationSnapshot.results[0].claimAssessment.quotes.find((quote) => quote.semantic?.calibrated);
assert(quoteWithCalibration);
quoteWithCalibration.semantic.calibration.temperature = 4.9;
const restoredTamperedCalibration = new ProjectResearchSession(new EvidenceFirewallEngine());
restoredTamperedCalibration.restore(tamperedCalibrationSnapshot);
assert.equal(restoredTamperedCalibration.snapshot().results[0].claimAssessment.method, 'exact-text-anchor-v1', 'tampered calibration provenance must invalidate persisted semantic assessment');

const conflictSession = new ProjectResearchSession(new EvidenceFirewallEngine());
conflictSession.begin('conflict-project', 'conflict-project:claim');
conflictSession.ingest(source('alpha.example', 'c', 'The release owner confirms the system is safe for deployment.', 3), 'external-api');
await conflictSession.assessLatestSemantically(fakeBackend());
conflictSession.ingest(source('beta.example', 'd', 'The reviewer says the system is not safe for deployment.', 4), 'external-api');
await conflictSession.assessLatestSemantically(fakeBackend((premise) => /not safe/i.test(premise) ? 'refute' : 'support'));
assert.equal(conflictSession.snapshot().claimVerification.verdict, 'mixed');
const recovered = new ProjectResearchSession(new EvidenceFirewallEngine());
recovered.restore(conflictSession.snapshot());
assert.equal(recovered.snapshot().results[0].claimAssessment.method, 'nli-cross-encoder-v1', 'validated model evidence survives session restart');
assert.equal(recovered.snapshot().claimVerification.verdict, 'mixed', 'persisted conflicting NLI evidence remains quarantinable after restore');
assert.deepEqual(recovered.snapshot().claimVerification.modelVersions, [{ modelId: 'test-fixture-nli-v1', modelRevision: revisionA }], 'model provenance survives research-session recovery');
const tamperedSnapshot = structuredClone(conflictSession.snapshot());
const semanticQuote = tamperedSnapshot.results.find((row) => row.claimAssessment?.quotes?.some((quote) => quote.semantic))?.claimAssessment.quotes.find((quote) => quote.semantic);
assert(semanticQuote, 'fixture must contain a stored semantic quote');
semanticQuote.semantic.modelRevision = revisionB;
const tamperedRecovered = new ProjectResearchSession(new EvidenceFirewallEngine());
tamperedRecovered.restore(tamperedSnapshot);
assert.notEqual(tamperedRecovered.snapshot().results.find((row) => row.claimAssessment)?.claimAssessment?.method, 'nli-cross-encoder-v1', 'restored evidence whose quote revision conflicts with its assessment is rejected');

console.log('RESEARCH_SEMANTIC_ENTAILMENT=PASS cases=23 mode=mocked-nli-backend');
