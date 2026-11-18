import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { NeuroPlasticAdapterRegistry, createNeuroPlasticApprovalSignature, verifyNeuroPlasticApprovalSignature, createNeuroPlasticEvaluationReceipt, verifyNeuroPlasticEvaluationSignature, verifyNeuroPlasticEvaluationReceiptSignature } from '../src/organism/learning/NeuroPlasticAdapterRegistry.ts';
import { buildVerifiedNeuroPlasticCorpus, toNeuroPlasticJsonl } from '../src/organism/learning/NeuroPlasticCorpusBuilder.ts';
import { NeuroPlasticInferenceAdapter } from '../src/organism/integration/local/NeuroPlasticInferenceAdapter.ts';
import { OpenAICompatibleLocalChatProvider } from '../src/organism/integration/local/OpenAICompatibleLocalChatProvider.ts';

const hash = (char) => char.repeat(64);
const approvalSecret = 'neuro-plastic-test-approval-secret-32-bytes-minimum';
const evaluatorSecret = 'neuro-plastic-test-evaluator-secret-held-outside-the-runtime';
function signedEvaluate(registry, adapterId, payload) {
  const receipt = createNeuroPlasticEvaluationReceipt(
    adapterId, payload, 'independent-evaluator-v1', 'evaluation-' + adapterId, evaluatorSecret,
  );
  return registry.evaluateCandidate(adapterId, { ...payload, receipt }, (verifiedReceipt) =>
    verifyNeuroPlasticEvaluationSignature(adapterId, payload, verifiedReceipt, evaluatorSecret));
}
function signedApproval(adapterId, reportId, approvalId) {
  const unsigned = { approvalId, actorId: 'operator', approvedAt: 1_800_000_000_200 };
  const context = { adapterId, reportId, baseModelFingerprint: hash('a') };
  return { ...unsigned, signature: createNeuroPlasticApprovalSignature(unsigned, context, approvalSecret) };
}
function verifyApproval(approval, context) {
  return verifyNeuroPlasticApprovalSignature(approval, context, approvalSecret);
}
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
    authority: 'independent-verifier',
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
const evaluationPayload = {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.82),
  evaluatedAt: 1_800_000_000_100,
};
const evaluationReceipt = createNeuroPlasticEvaluationReceipt(
  'kurisu-reasoning-v1', evaluationPayload, 'independent-evaluator-v1', 'evaluation-main', evaluatorSecret,
);
const tamperedEvaluation = { ...evaluationPayload, candidate: observations(0.91) };
assert.throws(() => registry.evaluateCandidate(
  'kurisu-reasoning-v1', { ...tamperedEvaluation, receipt: evaluationReceipt },
  (receipt) => verifyNeuroPlasticEvaluationSignature('kurisu-reasoning-v1', tamperedEvaluation, receipt, evaluatorSecret),
), /fingerprint|signature|receipt/i, 'changing holdout outcomes after evaluator signing must be rejected');
const report = signedEvaluate(registry, 'kurisu-reasoning-v1', evaluationPayload);
assert.equal(report.pairedN, 7);
assert.equal(report.eligible, true);
assert.ok(report.qualityCi95[0] > 0, 'promotion evidence must have a positive lower confidence bound');
assert.equal(registry.snapshot().adapters[0].status, 'eligible', 'holdout success must not activate weights');
const approval = signedApproval('kurisu-reasoning-v1', report.reportId, 'approval-1');
assert.equal(verifyApproval(approval, { adapterId: 'kurisu-reasoning-v1', reportId: report.reportId, baseModelFingerprint: hash('a') }), true);
assert.equal(verifyNeuroPlasticApprovalSignature(approval, { adapterId: 'kurisu-reasoning-v1', reportId: report.reportId, baseModelFingerprint: hash('a') }, 'wrong-secret'), false);
await assert.rejects(
  registry.activate('kurisu-reasoning-v1', approval, async () => false),
  /approval/,
  'the registry must require a host-verified human approval',
);
await registry.activate(
  'kurisu-reasoning-v1',
  approval,
  verifyApproval,
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
const unsafeReport = signedEvaluate(unsafeRegistry, 'kurisu-unsafe-v1', {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.9, { safety01: 0.7 }),
  evaluatedAt: 1_800_000_000_100,
});
assert.equal(unsafeReport.eligible, false, 'quality uplift must not override a safety regression');
assert.ok(unsafeReport.reasons.includes('safety-regression'));

const malformedRegistry = new NeuroPlasticAdapterRegistry();
malformedRegistry.stage(manifest('kurisu-pairing-v1'));
assert.throws(() => signedEvaluate(malformedRegistry, 'kurisu-pairing-v1', {
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
signedEvaluate(inferenceRegistry, 'kurisu-runtime-v1', {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.82),
  evaluatedAt: 1_800_000_000_100,
});
const inferenceReport = inferenceRegistry.snapshot().adapters[0].evaluation;
await inferenceRegistry.activate(
  'kurisu-runtime-v1',
  signedApproval('kurisu-runtime-v1', inferenceReport.reportId, 'approval-runtime'),
  verifyApproval,
);
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
const inference = new NeuroPlasticInferenceAdapter(inferenceRegistry, (backendId) => backendId === 'llama.cpp', provider, async (artifact) => artifact.adapterId === 'kurisu-runtime-v1');
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
signedEvaluate(failedRegistry, 'kurisu-runtime-fallback-v1', {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.82),
  evaluatedAt: 1_800_000_000_100,
});
const failedReport = failedRegistry.snapshot().adapters[0].evaluation;
await failedRegistry.activate(
  'kurisu-runtime-fallback-v1',
  signedApproval('kurisu-runtime-fallback-v1', failedReport.reportId, 'approval-fallback'),
  verifyApproval,
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
let registryPersistCalls = 0;
const fallback = await new NeuroPlasticInferenceAdapter(failedRegistry, (backendId) => backendId === 'llama.cpp', fallbackProvider, async (artifact) => artifact.adapterId === 'kurisu-runtime-fallback-v1', () => { registryPersistCalls++; }).generate(
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
assert.equal(registryPersistCalls, 1, 'runtime adapter faults must persist the disable transition');

const artifactFailureRegistry = new NeuroPlasticAdapterRegistry();
artifactFailureRegistry.stage(manifest('kurisu-runtime-corrupt-v1'));
signedEvaluate(artifactFailureRegistry, 'kurisu-runtime-corrupt-v1', {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.82),
  evaluatedAt: 1_800_000_000_100,
});
const artifactFailureReport = artifactFailureRegistry.snapshot().adapters[0].evaluation;
await artifactFailureRegistry.activate(
  'kurisu-runtime-corrupt-v1',
  signedApproval('kurisu-runtime-corrupt-v1', artifactFailureReport.reportId, 'approval-corrupt'),
  verifyApproval,
);
const integrityCalls = [];
const integrityProvider = new OpenAICompatibleLocalChatProvider({
  baseUrl: 'http://127.0.0.1:43123/v1',
  model: 'kurisu-base',
  fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init.body));
    integrityCalls.push(body.model);
    return new Response(JSON.stringify({
      model: body.model,
      choices: [{ message: { content: 'baseline after artifact rejection' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
let integrityPersistCalls = 0;
const integrityFallback = await new NeuroPlasticInferenceAdapter(
  artifactFailureRegistry,
  (backendId) => backendId === 'llama.cpp',
  integrityProvider,
  async () => false,
  () => { integrityPersistCalls++; },
).generate({ system: 'system', user: 'prompt' }, {
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  baseModelAlias: 'kurisu-base',
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
});
assert.equal(integrityFallback.adapter.fallbackReason, 'adapter-artifact-integrity-failure');
assert.equal(integrityFallback.model, 'kurisu-base');
assert.deepEqual(integrityCalls, ['kurisu-base'], 'corrupt artifact must be rejected before an adapter request is sent');
assert.equal(artifactFailureRegistry.snapshot().adapters[0].status, 'disabled');
assert.equal(integrityPersistCalls, 1);


const aliasMismatchRegistry = new NeuroPlasticAdapterRegistry();
aliasMismatchRegistry.stage(manifest('kurisu-runtime-alias-mismatch-v1'));
signedEvaluate(aliasMismatchRegistry, 'kurisu-runtime-alias-mismatch-v1', {
  holdoutFingerprint: hash('d'),
  baseline: observations(0.62),
  candidate: observations(0.82),
  evaluatedAt: 1_800_000_000_100,
});
const aliasMismatchReport = aliasMismatchRegistry.snapshot().adapters[0].evaluation;
await aliasMismatchRegistry.activate(
  'kurisu-runtime-alias-mismatch-v1',
  signedApproval('kurisu-runtime-alias-mismatch-v1', aliasMismatchReport.reportId, 'approval-alias-mismatch'),
  verifyApproval,
);
const aliasMismatchCalls = [];
const aliasMismatchProvider = new OpenAICompatibleLocalChatProvider({
  baseUrl: 'http://127.0.0.1:43123/v1',
  model: 'kurisu-base',
  fetchImpl: async (_url, init) => {
    const body = JSON.parse(String(init.body));
    aliasMismatchCalls.push(body.model);
    // Simulate a local backend that silently serves the base model for an adapter alias.
    return new Response(JSON.stringify({
      model: 'kurisu-base',
      choices: [{ message: { content: 'base model served' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  },
});
const aliasMismatchFallback = await new NeuroPlasticInferenceAdapter(
  aliasMismatchRegistry,
  (backendId) => backendId === 'llama.cpp',
  aliasMismatchProvider,
  async () => true,
).generate({ system: 'system', user: 'prompt' }, {
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  baseModelAlias: 'kurisu-base',
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
});
assert.equal(aliasMismatchFallback.adapter.fallbackReason, 'adapter-runtime-failure');
assert.deepEqual(aliasMismatchCalls, ['kurisu-reasoning-lora', 'kurisu-base'],
  'the runtime must verify the backend actually served the requested adapter alias');
assert.equal(aliasMismatchRegistry.snapshot().adapters[0].status, 'disabled');

const activeSnapshot = inferenceRegistry.snapshot();
const restoredRegistry = new NeuroPlasticAdapterRegistry();
await restoredRegistry.restore(activeSnapshot);
assert.equal(restoredRegistry.select({
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
}).useAdapter, false, 'restart restore without an approval verifier must fail closed');
const approvalOnlyRestoreRegistry = new NeuroPlasticAdapterRegistry();
await approvalOnlyRestoreRegistry.restore(activeSnapshot, verifyApproval, (receipt, context) => verifyNeuroPlasticEvaluationReceiptSignature(context.adapterId, receipt, evaluatorSecret), () => true);
assert.equal(approvalOnlyRestoreRegistry.select({
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
}).useAdapter, false, 'restored evaluator evidence must also be verified before active state is trusted');
const tamperedEvaluationSnapshot = structuredClone(activeSnapshot);
tamperedEvaluationSnapshot.adapters[0].evaluation.evaluatorSignature = hash('9');
const tamperedRestoreRegistry = new NeuroPlasticAdapterRegistry();
await tamperedRestoreRegistry.restore(
  tamperedEvaluationSnapshot,
  verifyApproval,
  (receipt, context) => verifyNeuroPlasticEvaluationReceiptSignature(context.adapterId, receipt, evaluatorSecret),
  () => true,
);
assert.equal(tamperedRestoreRegistry.snapshot().adapters[0].status, 'staged', 'tampered evaluator evidence must be demoted on restore');
const tamperedMetricSnapshot = structuredClone(activeSnapshot);
tamperedMetricSnapshot.adapters[0].evaluation.qualityDeltaMean01 = 0.99;
const { reportId: _oldReportId, ...tamperedSummary } = tamperedMetricSnapshot.adapters[0].evaluation;
tamperedMetricSnapshot.adapters[0].evaluation.reportId = createHash('sha256')
  .update(JSON.stringify(tamperedSummary))
  .digest('hex');
const tamperedMetricRegistry = new NeuroPlasticAdapterRegistry();
await tamperedMetricRegistry.restore(
  tamperedMetricSnapshot,
  verifyApproval,
  (receipt, context) => verifyNeuroPlasticEvaluationReceiptSignature(context.adapterId, receipt, evaluatorSecret),
  () => true,
);
assert.equal(tamperedMetricRegistry.snapshot().adapters[0].status, 'staged',
  'changing a signed quality result and recomputing the plain report hash must still be rejected');
const signedRestoreRegistry = new NeuroPlasticAdapterRegistry();
await signedRestoreRegistry.restore(
  activeSnapshot,
  verifyApproval,
  (receipt, context) => verifyNeuroPlasticEvaluationReceiptSignature(context.adapterId, receipt, evaluatorSecret),
  () => true,
);
assert.equal(signedRestoreRegistry.select({
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
}).useAdapter, true, 'restart restore must preserve an active adapter only with a valid signed approval');
const artifactRejectedRestoreRegistry = new NeuroPlasticAdapterRegistry();
await artifactRejectedRestoreRegistry.restore(
  activeSnapshot,
  verifyApproval,
  (receipt, context) => verifyNeuroPlasticEvaluationReceiptSignature(context.adapterId, receipt, evaluatorSecret),
  () => false,
);
assert.equal(artifactRejectedRestoreRegistry.snapshot().adapters[0].status, 'disabled',
  'an artifact whose files no longer match the signed manifest must be disabled during restore');
assert.equal(artifactRejectedRestoreRegistry.select({
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
}).useAdapter, false);

const duplicatedSnapshot = structuredClone(activeSnapshot);
duplicatedSnapshot.adapters.push(structuredClone(duplicatedSnapshot.adapters[0]));
const duplicateRestoreRegistry = new NeuroPlasticAdapterRegistry();
await duplicateRestoreRegistry.restore(
  duplicatedSnapshot,
  verifyApproval,
  (receipt, context) => verifyNeuroPlasticEvaluationReceiptSignature(context.adapterId, receipt, evaluatorSecret),
  () => true,
);
assert.equal(duplicateRestoreRegistry.snapshot().adapters.length, 1,
  'duplicate persisted adapter IDs must be collapsed during restore');

const conflictRegistry = new NeuroPlasticAdapterRegistry();
conflictRegistry.stage(manifest('kurisu-reasoning-v2'));
signedEvaluate(conflictRegistry, 'kurisu-reasoning-v2', evaluationPayload);
const conflictReport = conflictRegistry.snapshot().adapters[0].evaluation;
await conflictRegistry.activate(
  'kurisu-reasoning-v2',
  signedApproval('kurisu-reasoning-v2', conflictReport.reportId, 'approval-conflict'),
  verifyApproval,
);
const conflictSnapshot = {
  schemaVersion: 1,
  adapters: [
    ...structuredClone(activeSnapshot.adapters),
    ...structuredClone(conflictRegistry.snapshot().adapters),
  ],
};
const conflictRestoreRegistry = new NeuroPlasticAdapterRegistry();
await conflictRestoreRegistry.restore(
  conflictSnapshot,
  verifyApproval,
  (receipt, context) => verifyNeuroPlasticEvaluationReceiptSignature(context.adapterId, receipt, evaluatorSecret),
  () => true,
);
assert.ok(conflictRestoreRegistry.snapshot().adapters.every(adapter => adapter.status === 'eligible'),
  'multiple active adapters for the same domain and base model must be demoted');
assert.equal(conflictRestoreRegistry.select({
  domain: 'reasoning',
  backendId: 'llama.cpp',
  baseModelFingerprint: hash('a'),
  backendSupportsModelAliases: true,
  confidence01: 0.9,
  risk01: 0.1,
}).useAdapter, false, 'conflicting restored adapters must never be selected');

await inferenceRegistry.rollback('kurisu-runtime-v1', 'operator requested rollback');
assert.equal(inferenceRegistry.snapshot().adapters[0].status, 'disabled');

console.log('NEURO_PLASTIC_CORE=PASS registry=8 pairedHoldout=7 safetyGate=PASS signedEvidence=PASS explicitApproval=PASS corpus=9 holdoutLeakage=0 artifactIntegrity=PASS aliasBinding=PASS inferenceFallback=PASS restartFailClosed=PASS');
