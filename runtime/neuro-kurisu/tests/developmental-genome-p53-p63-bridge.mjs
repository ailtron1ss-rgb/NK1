import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';
import {
  buildDevelopmentalGenome,
  inheritDevelopmentalGenome,
} from '../src/organism/system/DevelopmentalGenome.ts';
import {
  computeDevelopmentalGenomeExperimentEvidenceDigest,
  evaluateDevelopmentalGenomeExperiment,
  developmentalGenomeExperimentFamilyKey,
  developmentalGenomeExperimentTaskFingerprint,
  DEVELOPMENTAL_GENOME_EXPERIMENT_EVIDENCE_SCHEMA,
} from '../src/organism/developmental/DevelopmentalGenomeExperimentBridge.ts';
import {
  signOutcomePayloadForFixture,
} from '../src/organism/learning/VerifiedOutcomeArtifact.ts';
import { VerifiedOutcomeLedger } from '../src/organism/learning/VerifiedOutcomeLedger.ts';

const evaluatorId = 'external-independent-evaluator';
const evaluatorVersion = '1.2.0';
const verifier = generateKeyPairSync('ed25519');
const trustedVerifierKeys = new Map([
  [evaluatorId, verifier.publicKey.export({ type: 'spki', format: 'pem' }).toString()],
]);
const verifierPrivateKey = verifier.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

const makeP53 = (overrides = {}) => ({
  id: 'p53:120:verification:sample',
  createdAt: 1_800_000_000_000,
  tick: 120,
  knob: 'verification',
  delta: 0.04,
  reason: 'controlled-evidence',
  baseline01: 0.7,
  shadow01: 0.82,
  holdout01: 0.76,
  identityPreservation01: 0.96,
  stability01: 0.88,
  transfer01: 0.78,
  improvement01: 0.16,
  risk01: 0.08,
  evidenceCount: 3,
  status: 'promotable',
  lastAt: 1_800_000_000_500,
  ...overrides,
});

const makeP63 = (overrides = {}) => ({
  mode: 'experiment',
  priority01: 0.82,
  confidence01: 0.86,
  developmentBudget01: 0.42,
  actionBias: { verify: 0.1 },
  reasons: ['controlled-evaluation'],
  evidenceRequired: ['controlled-comparison', 'holdout-outcome'],
  ...overrides,
});

const makeEvidence = (parent, candidate, overrides = {}) => {
  const payload = {
    schemaVersion: DEVELOPMENTAL_GENOME_EXPERIMENT_EVIDENCE_SCHEMA,
    runId: 'genome-experiment-run-2026-11-18-01',
    evaluatorId,
    evaluatorVersion,
    independent: true,
    holdoutDisjoint: true,
    parentDigest: parent.digest,
    candidateDigest: candidate.digest,
    independentEvidenceBundleDigest: 'a'.repeat(64),
    hostAttestationDigest: 'b'.repeat(64),
    baselineDatasetId: 'dataset-baseline-01',
    holdoutDatasetId: 'dataset-holdout-01',
    pairedSeedIds: ['seed-11', 'seed-29', 'seed-37', 'seed-41', 'seed-53'],
    pairedSeedDeltas01: [0.2, 0.2, 0.2, 0.2, 0.2],
    identityContinuity01: 0.96,
    rollbackPrepared: true,
    rollbackCheckpointDigest: 'sha256:' + 'c'.repeat(64),
    createdAt: 1_800_000_001_000,
    ...overrides,
  };
  return { ...payload, digest: computeDevelopmentalGenomeExperimentEvidenceDigest(payload) };
};

function withSignedOutcomes(input, signedDeltas = input.evidence.pairedSeedDeltas01) {
  const child = inheritDevelopmentalGenome(input.parent, input.patches, input.ancestors ?? []);
  const family = developmentalGenomeExperimentFamilyKey(input, child);
  const manifest = Array.from({ length: 5 }, (_, index) => {
    const taskId = `genome-holdout-task-${index + 1}`;
    return {
      taskId,
      family,
      split: 'holdout',
      promptFingerprint: developmentalGenomeExperimentTaskFingerprint(family, taskId),
      verifierId: input.evidence.evaluatorId,
      version: input.evidence.evaluatorVersion,
    };
  });
  const manifestFingerprint = new VerifiedOutcomeLedger(manifest).manifestFingerprint();
  const seeds = input.evidence.pairedSeedIds.map(id => {
    const match = /^seed-(0|[1-9][0-9]*)$/.exec(id);
    if (!match) throw new Error('test seed id must be seed-N');
    return Number(match[1]);
  });
  const artifacts = [];
  for (let seedIndex = 0; seedIndex < seeds.length; seedIndex++) {
    const seed = seeds[seedIndex];
    const delta = signedDeltas[seedIndex] ?? 0;
    const baselinePasses = 2;
    const candidatePasses = delta > 0 ? 3 : delta < 0 ? 1 : 2;
    for (let taskIndex = 0; taskIndex < manifest.length; taskIndex++) {
      for (const [method, passCount] of [
        ['baseline', baselinePasses],
        ['candidate', candidatePasses],
      ]) {
        const payload = {
          schemaVersion: 1,
          artifactId: `genome-${method}-seed-${seed}-task-${taskIndex + 1}`,
          runId: `${input.evidence.runId}:${method}`,
          manifestFingerprint,
          taskId: manifest[taskIndex].taskId,
          taskVersion: input.evidence.evaluatorVersion,
          method,
          seed,
          attempt: 1,
          passed: taskIndex < passCount,
          verifierId: input.evidence.evaluatorId,
          observedAt: input.evidence.createdAt + seedIndex * 100 + taskIndex,
        };
        artifacts.push(signOutcomePayloadForFixture(payload, verifierPrivateKey));
      }
    }
  }
  return {
    ...input,
    signedOutcomes: {
      manifest,
      artifacts,
      baselineMethod: 'baseline',
      candidateMethod: 'candidate',
    },
  };
}

const makeInput = (overrides = {}) => {
  const parent = buildDevelopmentalGenome();
  const patches = [{ module: 'world', cadenceCycles: 2 }];
  const candidate = inheritDevelopmentalGenome(parent, patches);
  const base = {
    parent,
    patches,
    ancestors: [],
    p53Candidate: makeP53(),
    p63Plan: makeP63(),
    p60Decision: 'allow',
    evidence: makeEvidence(parent, candidate),
    ...overrides,
  };
  return base.evidence ? withSignedOutcomes(base) : base;
};

const evaluate = input => evaluateDevelopmentalGenomeExperiment(input, trustedVerifierKeys);

test('P53/P63 bridge stages a cryptographically verified, genome-bound proposal for human review only', () => {
  const input = makeInput();
  const report = evaluate(input);
  assert.equal(report.status, 'READY_FOR_HUMAN_REVIEW');
  assert.equal(report.activation, 'NOT_APPLIED');
  assert.equal(report.candidate.activation, 'NOT_APPLIED');
  assert.equal(report.genomeGate.status, 'APPROVED');
  assert.equal(report.receipt.parentDigest, input.parent.digest);
  assert.equal(report.receipt.candidateDigest, report.candidate.digest);
  assert.equal(report.receipt.p53CandidateId, input.p53Candidate.id);
  assert.equal(report.receipt.p63Mode, 'experiment');
  assert.ok(report.receipt.digest.startsWith('sha256:'));
  assert.ok(report.receipt.confidenceInterval.lower > 0);
  assert.equal(report.receipt.confidenceInterval.sampleCount, 5);
});

test('composition fabric requires host-configured verifier keys before a signed bridge can be ready', () => {
  const input = makeInput();
  const unconfigured = new OrganismSystemFabric();
  assert.equal(typeof unconfigured.stageDevelopmentalGenomeExperiment, 'function');
  assert.equal(unconfigured.stageDevelopmentalGenomeExperiment(input).status, 'NEEDS_REVIEW');

  const configured = new OrganismSystemFabric({ trustedGenomeEvaluatorKeys: trustedVerifierKeys });
  const report = configured.stageDevelopmentalGenomeExperiment(input);
  assert.equal(report.status, 'READY_FOR_HUMAN_REVIEW');
  assert.equal(report.activation, 'NOT_APPLIED');
});

test('unsigned self-reported deltas can never reach READY_FOR_HUMAN_REVIEW', () => {
  const input = makeInput();
  const { signedOutcomes, ...unsigned } = input;
  const report = evaluateDevelopmentalGenomeExperiment(unsigned, trustedVerifierKeys);
  assert.equal(report.status, 'NEEDS_REVIEW');
  assert.ok(report.issues.some(issue => issue.code === 'signed-independent-outcomes-required'));
});

test('P60 veto blocks the candidate and caution defers it', () => {
  const veto = evaluate(makeInput({ p60Decision: 'veto' }));
  assert.equal(veto.status, 'BLOCKED');
  assert.ok(veto.issues.some(issue => issue.code === 'p60-veto'));
  const caution = evaluate(makeInput({ p60Decision: 'caution' }));
  assert.equal(caution.status, 'NEEDS_REVIEW');
  assert.ok(caution.issues.some(issue => issue.code === 'p60-caution'));
});

test('P63 must choose experiment mode and require controlled holdout evidence', () => {
  const observe = evaluate(makeInput({ p63Plan: makeP63({ mode: 'observe' }) }));
  assert.equal(observe.status, 'NEEDS_REVIEW');
  const incomplete = evaluate(makeInput({
    p63Plan: makeP63({ evidenceRequired: ['independent-outcome'] }),
  }));
  assert.equal(incomplete.status, 'BLOCKED');
});

test('P53 must be promotable and meet the original laboratory quality thresholds', () => {
  const pending = evaluate(makeInput({ p53Candidate: makeP53({ status: 'testing' }) }));
  assert.equal(pending.status, 'NEEDS_REVIEW');
  const weak = evaluate(makeInput({ p53Candidate: makeP53({ improvement01: 0.02 }) }));
  assert.equal(weak.status, 'BLOCKED');
  const alreadyPromoted = evaluate(makeInput({ p53Candidate: makeP53({ status: 'promoted' }) }));
  assert.equal(alreadyPromoted.status, 'BLOCKED');
});

test('missing or under-replicated independent evidence remains review-only', () => {
  const missing = evaluate(makeInput({ evidence: null }));
  assert.equal(missing.status, 'NEEDS_REVIEW');

  const input = makeInput();
  const candidate = inheritDevelopmentalGenome(input.parent, input.patches);
  const evidence = makeEvidence(input.parent, candidate, {
    pairedSeedIds: ['seed-1', 'seed-2', 'seed-3', 'seed-4'],
    pairedSeedDeltas01: [0.2, 0.2, 0.2, 0.2],
  });
  const underReplicated = evaluate(withSignedOutcomes({ ...input, evidence }, evidence.pairedSeedDeltas01));
  assert.equal(underReplicated.status, 'NEEDS_REVIEW');
});

test('evidence is bound to exact parent and candidate genome digests', () => {
  const input = makeInput();
  const wrongCandidate = {
    ...inheritDevelopmentalGenome(input.parent, input.patches),
    digest: 'sha256:' + 'f'.repeat(64),
  };
  const forged = makeEvidence(input.parent, wrongCandidate);
  const report = evaluate({ ...input, evidence: forged });
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.issues.some(issue => issue.code === 'experiment-evidence-genome-binding-mismatch'));
});

test('evidence rejects dataset overlap, digest tampering and claimed independence failures', () => {
  const input = makeInput();
  const child = inheritDevelopmentalGenome(input.parent, input.patches);
  const overlapping = makeEvidence(input.parent, child, { holdoutDatasetId: 'dataset-baseline-01' });
  assert.equal(evaluate({ ...input, evidence: overlapping }).status, 'BLOCKED');

  const tampered = { ...input.evidence, pairedSeedDeltas01: [0.01, 0.02, 0.03, 0.04, 0.05] };
  assert.equal(evaluate({ ...input, evidence: tampered }).status, 'BLOCKED');

  const nonIndependent = makeEvidence(input.parent, child, { independent: false });
  assert.equal(evaluate({ ...input, evidence: nonIndependent }).status, 'BLOCKED');
});

test('paired-seed confidence is recomputed from signed holdout outcomes; any regression blocks', () => {
  const input = makeInput();
  const regressionEvidence = makeEvidence(input.parent, inheritDevelopmentalGenome(input.parent, input.patches), {
    pairedSeedDeltas01: [0.2, 0.2, -0.2, 0.2, 0.2],
  });
  const regression = evaluate(withSignedOutcomes({ ...input, evidence: regressionEvidence }, regressionEvidence.pairedSeedDeltas01));
  assert.equal(regression.status, 'BLOCKED');
  assert.ok(regression.issues.some(issue => issue.code === 'paired-seed-regressions-detected'));

  const forgedDeltas = { ...input.evidence, pairedSeedDeltas01: [0.8, 0.8, 0.8, 0.8, 0.8] };
  forgedDeltas.digest = computeDevelopmentalGenomeExperimentEvidenceDigest(
    Object.fromEntries(Object.entries(forgedDeltas).filter(([key]) => key !== 'digest')),
  );
  const mismatch = evaluate({ ...input, evidence: forgedDeltas });
  assert.equal(mismatch.status, 'BLOCKED');
  assert.ok(mismatch.issues.some(issue => issue.code === 'signed-outcome-delta-mismatch' ||
    issue.code === 'signed-outcome-manifest-binding-mismatch'));
});

test('incomplete rollback and weak identity continuity block review', () => {
  const input = makeInput();
  const candidate = inheritDevelopmentalGenome(input.parent, input.patches);
  const noRollback = makeEvidence(input.parent, candidate, { rollbackPrepared: false });
  assert.equal(evaluate({ ...input, evidence: noRollback }).status, 'BLOCKED');
  const weakIdentity = makeEvidence(input.parent, candidate, { identityContinuity01: 0.7 });
  assert.equal(evaluate({ ...input, evidence: weakIdentity }).status, 'BLOCKED');
});

test('untrusted evaluator key and altered signed artifacts are rejected', () => {
  const input = makeInput();
  const unconfigured = evaluateDevelopmentalGenomeExperiment(input, new Map());
  assert.equal(unconfigured.status, 'NEEDS_REVIEW');
  assert.ok(unconfigured.issues.some(issue => issue.code === 'trusted-evaluator-keys-not-configured'));
  const wrongTrustRoot = evaluateDevelopmentalGenomeExperiment(input, new Map([
    ['different-evaluator', trustedVerifierKeys.get(evaluatorId)],
  ]));
  assert.equal(wrongTrustRoot.status, 'NEEDS_REVIEW');
  assert.ok(wrongTrustRoot.issues.some(issue => issue.code === 'signed-outcome-untrusted-verifier'));

  const tampered = structuredClone(input);
  tampered.signedOutcomes.artifacts[0].payload.passed = !tampered.signedOutcomes.artifacts[0].payload.passed;
  const report = evaluate(tampered);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.issues.some(issue => issue.code === 'signed-outcome-artifact-rejected'));
});

test('incomplete signed task/seed coverage cannot be silently dropped from the paired sample', () => {
  const input = makeInput();
  input.signedOutcomes.artifacts.pop();
  const report = evaluate(input);
  assert.equal(report.status, 'NEEDS_REVIEW');
  assert.ok(report.issues.some(issue => issue.code === 'signed-outcome-pair-incomplete'));
});

test('manifest task family, holdout split and fingerprints bind the exact experiment', () => {
  const input = makeInput();
  input.signedOutcomes.manifest[0].family = 'unrelated-genome-family';
  const report = evaluate(input);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.issues.some(issue => issue.code === 'signed-outcome-manifest-binding-mismatch'));
});

test('the same inputs produce the same child and receipt digest', () => {
  const input = makeInput();
  const first = evaluate(input);
  const second = evaluate(input);
  assert.equal(first.candidate.digest, second.candidate.digest);
  assert.equal(first.receipt.digest, second.receipt.digest);
});

test('cyclic objects and hostile accessors are rejected without executing getters', () => {
  const cyclic = makeInput();
  cyclic.untrusted = cyclic;
  assert.equal(evaluate(cyclic).status, 'BLOCKED');

  const hostile = makeInput();
  let getterCalls = 0;
  Object.defineProperty(hostile, 'p60Decision', {
    enumerable: true,
    get() { getterCalls += 1; return 'allow'; },
  });
  assert.equal(evaluate(hostile).status, 'BLOCKED');
  assert.equal(getterCalls, 0);
});

console.log('DEVELOPMENTAL_GENOME_P53_P63_BRIDGE_TESTS=DEFINED');
