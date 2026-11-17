import assert from 'node:assert/strict';
import { NeuroPlasticAdapterRegistry } from '../src/organism/learning/NeuroPlasticAdapterRegistry.ts';
import { buildVerifiedNeuroPlasticCorpus, toNeuroPlasticJsonl } from '../src/organism/learning/NeuroPlasticCorpusBuilder.ts';
import { NeuroPlasticInferenceAdapter } from '../src/organism/integration/local/NeuroPlasticInferenceAdapter.ts';
import { OpenAICompatibleLocalChatProvider } from '../src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts';
import { P40ModelEcologyEngine } from '../src/organism/learning/P40ModelEcology.ts';

const hash = (char) => char.repeat(64);
const manifest = (adapterId = 'kurisu-reasoning-v1') => ({
  schemaVersion: 1,
  adapterId,
  domain: 'reasoning',
  method: 'lora',
  baseModel: {
    id: 'kurisu-7b',
    backendId: 'llama.cpp',
    servedModelAlias: 'kurisu-base',
    fingerprint: hash('a'),
  },
  tokenizerFingerprint: hash('b'),
  sourceDatasetFingerprint: hash('c'),
  holdoutPlanFingerprint: hash('d'),
  corpusFingerprint: hash('e'),
  artifact: {
    directory: 'adapter-store/' + adapterId,
    configSha256: hash('f'),
    weightsSha256: hash('1'),
    totalBytes: 8192,
  },
  trainer: { name: 'neuro-plastic-trainer', version: '1.0.0', seed: 41, completedAt: 1_800_000_000_000 },
  governance: {
    trainingOptIn: true,
    privacyReviewed: true,
    licenseApproved: true,
    piiScreening: 'passed',
    evidenceCount: 12,
    attestedBy: 'independent-data-steward',
    attestedAt: 1_800_000_000_000,
    licenseId: 'user-owned-or-approved',
  },
  servedModelAlias: 'kurisu-reasoning-lora',
});

function observations(quality01, overrides = {}) {
  return Array.from({ length: 7 }, (_, index) => ({
    pairId: 'task-' + (index + 1),
    seed: 100 + index,
    split: 'holdout',
    verifierId: 'independent-evaluator-v1',
    holdoutFingerprint: hash('d'),
    metrics: {
      quality01: quality01 + (index % 2 ? 0.005 : -0.005),
      safety01: 0.99,
      retention01: 0.99,
      cost01: 0.2,
      latencyMs: 900,
      safetyViolationCount: 0,
      ...overrides,
    },
  }));
}

const registry = new NeuroPlasticAdapterRegistry();
registry.stage(manifest());
const report = registry.evaluateCandidate('kurisu-reasoning-v1', {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.82),
  evaluatedAt: 1_800_000_000_100,
});
assert.equal(report.pairedN, 7);
assert.equal(report.eligible, true);
assert.ok(report.qualityCi95[0] > 0, 'promotion evidence must have a positive lower confidence bound');
assert.equal(registry.snapshot().adapters[0].status, 'eligible', 'holdout success must not activate weights');
await assert.rejects(
  registry.activate('kurisu-reasoning-v1', { approvalId: 'approval-1', actorId: 'operator', approvedAt: 1_800_000_000_200 }, async () => false),
  /approval/,
  'the registry must require a host-verified human approval',
);
await registry.activate(
  'kurisu-reasoning-v1',
  { approvalId: 'approval-1', actorId: 'operator', approvedAt: 1_800_000_000_200 },
  async (approval, context) => approval.actorId === 'operator' && context.adapterId === 'kurisu-reasoning-v1',
);
assert.equal(registry.snapshot().adapters[0].status, 'active');

const selected = registry.select({
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
});
assert.deepEqual(
  { useAdapter: selected.useAdapter, modelAlias: selected.modelAlias, adapterId: selected.adapterId },
  { useAdapter: true, modelAlias: 'kurisu-reasoning-lora', adapterId: 'kurisu-reasoning-v1' },
);
assert.equal(registry.select({
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('9'),
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
}).useAdapter, false, 'an adapter must never attach to a different base model');
assert.equal(registry.select({
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  backendSupportsModelAliases: true,
  confidence01: 0.2,
  risk01: 0.1,
}).useAdapter, false, 'low-confidence requests must use the base model');
assert.equal(registry.select({
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  backendSupportsModelAliases: false,
  confidence01: 0.9,
  risk01: 0.1,
}).useAdapter, false, 'unsupported backends must use the base model');

const unsafeRegistry = new NeuroPlasticAdapterRegistry();
unsafeRegistry.stage(manifest('kurisu-unsafe-v1'));
const unsafeReport = unsafeRegistry.evaluateCandidate('kurisu-unsafe-v1', {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.9, { safety01: 0.7 }),
  evaluatedAt: 1_800_000_000_100,
});
assert.equal(unsafeReport.eligible, false, 'quality uplift must not override a safety regression');
assert.ok(unsafeReport.reasons.includes('safety-regression'));

const malformedRegistry = new NeuroPlasticAdapterRegistry();
malformedRegistry.stage(manifest('kurisu-pairing-v1'));
assert.throws(() => malformedRegistry.evaluateCandidate('kurisu-pairing-v1', {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.82).slice(1),
  evaluatedAt: 1_800_000_000_100,
}), /pair|complete|matching/i, 'missing paired holdout observations must be rejected');

const invalidManifestRegistry = new NeuroPlasticAdapterRegistry();
assert.throws(() => invalidManifestRegistry.stage({
  ...manifest('path-traversal-v1'),
  artifact: { ...manifest('path-traversal-v1').artifact, directory: '../base-model' },
}), /artifact|path|directory/i, 'artifact paths must not escape the adapter store');

const trainingRows = Array.from({ length: 6 }, (_, index) => ({
  schemaVersion: 1,
  exampleId: 'train-' + index,
  taskId: 'train-task-' + index,
  taskVersion: '1',
  family: 'reasoning',
  promptFingerprint: hash('2'),
  split: 'train',
  method: 'reference',
  seed: index + 1,
  attempt: 1,
  passed: true,
  authority: 'independent-verifier',
  verifierId: 'verifier-v1',
  evidenceRefDigest: hash('3'),
  observedAt: 1_800_000_000_000 + index,
}));
const validationRows = Array.from({ length: 3 }, (_, index) => ({
  ...trainingRows[index],
  exampleId: 'validation-' + index,
  taskId: 'validation-task-' + index,
  split: 'validation',
  seed: index + 20,
}));
const verifiedDataset = {
  schemaVersion: 1,
  manifestFingerprint: hash('4'),
  datasetFingerprint: hash('5'),
  training: trainingRows,
  validation: validationRows,
  holdoutAggregates: [{ split: 'holdout', family: 'reasoning', method: 'reference', outcomeCount: 9, passCount: 8, passRate: 8 / 9, independentSeedCount: 9 }],
  rejectedSelfReports: 0,
};
const resolver = (row) => ({
  domain: 'reasoning',
  prompt: 'Question ' + row.taskId + ': reason step by step.',
  completion: 'Verified answer for ' + row.taskId + '.',
  outcome: 'verified-success',
  consent: {
    trainingOptIn: true,
    privacyReviewed: true,
    licenseApproved: true,
    piiScreening: 'passed',
    attestedBy: 'reviewer',
    attestedAt: 1_800_000_000_000,
    licenseId: 'approved-fixture',
    provenanceDigest: hash('6'),
  },
});
const corpus = buildVerifiedNeuroPlasticCorpus(verifiedDataset, resolver, 'reasoning');
assert.equal(corpus.training.length, 6);
assert.equal(corpus.validation.length, 3);
assert.equal(corpus.holdoutPlanFingerprint, hash('4'));
assert.equal(Object.hasOwn(corpus, 'holdoutAggregates'), false, 'holdout values must never enter the trainer corpus');
assert.equal(corpus.training[0].prompt.startsWith('Question train-task-'), true);
assert.equal(toNeuroPlasticJsonl(corpus, 'train').trim().split('\n').length, 6);
assert.equal(toNeuroPlasticJsonl(corpus, 'validation').trim().split('\n').length, 3);

assert.throws(() => buildVerifiedNeuroPlasticCorpus(
  verifiedDataset,
  (row) => ({
    ...resolver(row),
    consent: { ...resolver(row).consent, trainingOptIn: false },
  }),
  'reasoning',
), /consent|opt-in|governance/i, 'training without explicit opt-in must be rejected');
assert.throws(() => buildVerifiedNeuroPlasticCorpus(
  verifiedDataset,
  (row) => ({ ...resolver(row), prompt: 'Contact admin@example.com for credentials.' }),
  'reasoning',
), /sensitive|pii|email|privacy/i, 'unredacted personal data must be rejected');

const inferenceRegistry = new NeuroPlasticAdapterRegistry();
inferenceRegistry.stage(manifest('kurisu-runtime-v1'));
inferenceRegistry.evaluateCandidate('kurisu-runtime-v1', {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.82),
  evaluatedAt: 1_800_000_000_100,
});
await inferenceRegistry.activate(
  'kurisu-runtime-v1',
  { approvalId: 'approval-runtime', actorId: 'operator', approvedAt: 1_800_000_000_200 },
  async () => true,
);
const ecology = new P40ModelEcologyEngine();
ecology.configure('llama.cpp', true);
const inferenceCalls = [];
const provider = new OpenAICompatibleLocalChatProvider({
  baseUrl: 'http://127.0.0.1:43123/v1',
  model: 'kurisu-base',
  fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init.body));
    inferenceCalls.push(body.model);
    return new Response(JSON.stringify({
      model: body.model,
      choices: [{ message: { content: 'served by ' + body.model } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
const inference = new NeuroPlasticInferenceAdapter(inferenceRegistry, ecology, provider);
const adaptedResponse = await inference.generate({ system: 'system', user: 'prompt' }, {
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  baseModelAlias: 'kurisu-base',
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
});
assert.equal(adaptedResponse.adapter.used, true);
assert.equal(adaptedResponse.model, 'kurisu-reasoning-lora');
assert.deepEqual(inferenceCalls, ['kurisu-reasoning-lora']);

const failedRegistry = new NeuroPlasticAdapterRegistry();
failedRegistry.stage(manifest('kurisu-runtime-fallback-v1'));
failedRegistry.evaluateCandidate('kurisu-runtime-fallback-v1', {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.82),
  evaluatedAt: 1_800_000_000_100,
});
await failedRegistry.activate(
  'kurisu-runtime-fallback-v1',
  { approvalId: 'approval-fallback', actorId: 'operator', approvedAt: 1_800_000_000_200 },
  async () => true,
);
const fallbackCalls = [];
const fallbackProvider = new OpenAICompatibleLocalChatProvider({
  baseUrl: 'http://127.0.0.1:43123/v1',
  model: 'kurisu-base',
  fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init.body));
    fallbackCalls.push(body.model);
    if (body.model === 'kurisu-reasoning-lora') {
      return new Response('adapter unavailable', { status: 503 });
    }
    return new Response(JSON.stringify({
      model: body.model,
      choices: [{ message: { content: 'baseline response' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
const fallback = await new NeuroPlasticInferenceAdapter(failedRegistry, ecology, fallbackProvider).generate(
  { system: 'system', user: 'prompt' },
  {
    domain: 'reasoning',
    backendId: 'llama.cpp',
    baseModelFingerprint: hash('a'),
    baseModelAlias: 'kurisu-base',
    backendSupportsModelAliases: true,
    confidence01: 0.9,
    risk01: 0.1,
  },
);
assert.equal(fallback.adapter.used, false);
assert.equal(fallback.adapter.fallbackReason, 'adapter-runtime-failure');
assert.equal(fallback.model, 'kurisu-base');
assert.deepEqual(fallbackCalls, ['kurisu-reasoning-lora', 'kurisu-base']);
assert.equal(failedRegistry.snapshot().adapters[0].status, 'disabled', 'runtime adapter faults must disable the adapter');

const activeSnapshot = inferenceRegistry.snapshot();
const restoredRegistry = new NeuroPlasticAdapterRegistry();
restoredRegistry.restore(activeSnapshot);
assert.equal(restoredRegistry.select({
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
}).useAdapter, false, 'restart restore must never silently reactivate an adapter without fresh approval');
await inferenceRegistry.rollback('kurisu-runtime-v1', 'operator requested rollback');
assert.equal(inferenceRegistry.snapshot().adapters[0].status, 'disabled');

console.log('NEURO_PLASTIC_CORE=PASS registry=7 pairedHoldout=7 safetyGate=PASS explicitApproval=PASS corpus=9 holdoutLeakage=0 inferenceFallback=PASS restartFailClosed=PASS');
