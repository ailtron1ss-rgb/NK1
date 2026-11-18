import test from 'node:test';
import assert from 'node:assert/strict';
import { OrganismSystemFabric } from '../src/organism/core/OrganismSystemFabric.ts';
import {
  buildDevelopmentalGenome,
  inheritDevelopmentalGenome,
} from '../src/organism/system/DevelopmentalGenome.ts';
import {
  computeDevelopmentalGenomeExperimentEvidenceDigest,
  evaluateDevelopmentalGenomeExperiment,
  DEVELOPMENTAL_GENOME_EXPERIMENT_EVIDENCE_SCHEMA,
} from '../src/organism/developmental/DevelopmentalGenomeExperimentBridge.ts';

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
    evaluatorId: 'external-independent-evaluator',
    evaluatorVersion: '1.2.0',
    independent: true,
    holdoutDisjoint: true,
    parentDigest: parent.digest,
    candidateDigest: candidate.digest,
    independentEvidenceBundleDigest: 'a'.repeat(64),
    hostAttestationDigest: 'b'.repeat(64),
    baselineDatasetId: 'dataset-baseline-01',
    holdoutDatasetId: 'dataset-holdout-01',
    pairedSeedIds: ['seed-11', 'seed-29', 'seed-37', 'seed-41', 'seed-53'],
    pairedSeedDeltas01: [0.12, 0.10, 0.11, 0.09, 0.13],
    identityContinuity01: 0.96,
    rollbackPrepared: true,
    rollbackCheckpointDigest: 'sha256:' + 'c'.repeat(64),
    createdAt: 1_800_000_001_000,
    ...overrides,
  };
  return { ...payload, digest: computeDevelopmentalGenomeExperimentEvidenceDigest(payload) };
};

const makeInput = (overrides = {}) => {
  const parent = buildDevelopmentalGenome();
  const patches = [{ module: 'world', cadenceCycles: 2 }];
  const child = inheritDevelopmentalGenome(parent, patches);
  return {
    parent,
    patches,
    ancestors: [],
    p53Candidate: makeP53(),
    p63Plan: makeP63(),
    p60Decision: 'allow',
    evidence: makeEvidence(parent, child),
    ...overrides,
  };
};

test('P53/P63 bridge stages a bound genome proposal for human review only', () => {
  const input = makeInput();
  const report = evaluateDevelopmentalGenomeExperiment(input);
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
});

test('composition fabric exposes the P53/P63 bridge without owning either subsystem', () => {
  const fabric = new OrganismSystemFabric();
  assert.equal(typeof fabric.stageDevelopmentalGenomeExperiment, 'function');
  const report = fabric.stageDevelopmentalGenomeExperiment(makeInput());
  assert.equal(report.status, 'READY_FOR_HUMAN_REVIEW');
  assert.equal(report.activation, 'NOT_APPLIED');
});

test('P60 veto blocks the candidate and caution defers it', () => {
  const veto = evaluateDevelopmentalGenomeExperiment(makeInput({ p60Decision: 'veto' }));
  assert.equal(veto.status, 'BLOCKED');
  assert.ok(veto.issues.some(issue => issue.code === 'p60-veto'));
  const caution = evaluateDevelopmentalGenomeExperiment(makeInput({ p60Decision: 'caution' }));
  assert.equal(caution.status, 'NEEDS_REVIEW');
  assert.ok(caution.issues.some(issue => issue.code === 'p60-caution'));
});

test('P63 must choose experiment mode and require controlled holdout evidence', () => {
  const observe = evaluateDevelopmentalGenomeExperiment(makeInput({
    p63Plan: makeP63({ mode: 'observe' }),
  }));
  assert.equal(observe.status, 'NEEDS_REVIEW');
  const incomplete = evaluateDevelopmentalGenomeExperiment(makeInput({
    p63Plan: makeP63({ evidenceRequired: ['independent-outcome'] }),
  }));
  assert.equal(incomplete.status, 'BLOCKED');
});

test('P53 must be promotable and meet the original laboratory quality thresholds', () => {
  const pending = evaluateDevelopmentalGenomeExperiment(makeInput({
    p53Candidate: makeP53({ status: 'testing' }),
  }));
  assert.equal(pending.status, 'NEEDS_REVIEW');
  const weak = evaluateDevelopmentalGenomeExperiment(makeInput({
    p53Candidate: makeP53({ improvement01: 0.02 }),
  }));
  assert.equal(weak.status, 'BLOCKED');
  const alreadyPromoted = evaluateDevelopmentalGenomeExperiment(makeInput({
    p53Candidate: makeP53({ status: 'promoted' }),
  }));
  assert.equal(alreadyPromoted.status, 'BLOCKED');
});

test('missing or under-replicated independent evidence remains review-only', () => {
  const missing = evaluateDevelopmentalGenomeExperiment(makeInput({ evidence: null }));
  assert.equal(missing.status, 'NEEDS_REVIEW');
  const input = makeInput();
  const candidate = inheritDevelopmentalGenome(input.parent, input.patches);
  const evidence = makeEvidence(input.parent, candidate, {
    pairedSeedIds: ['seed-1', 'seed-2', 'seed-3', 'seed-4'],
    pairedSeedDeltas01: [0.1, 0.1, 0.1, 0.1],
  });
  const underReplicated = evaluateDevelopmentalGenomeExperiment({ ...input, evidence });
  assert.equal(underReplicated.status, 'NEEDS_REVIEW');
});

test('evidence is bound to exact parent and candidate genome digests', () => {
  const input = makeInput();
  const wrongCandidate = {
    ...inheritDevelopmentalGenome(input.parent, input.patches),
    digest: 'sha256:' + 'f'.repeat(64),
  };
  const forged = makeEvidence(input.parent, wrongCandidate);
  const report = evaluateDevelopmentalGenomeExperiment({ ...input, evidence: forged });
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.issues.some(issue => issue.code === 'experiment-evidence-genome-binding-mismatch'));
});

test('evidence rejects dataset overlap, digest tampering and claimed independence failures', () => {
  const input = makeInput();
  const child = inheritDevelopmentalGenome(input.parent, input.patches);
  const overlapping = makeEvidence(input.parent, child, { holdoutDatasetId: 'dataset-baseline-01' });
  assert.equal(evaluateDevelopmentalGenomeExperiment({ ...input, evidence: overlapping }).status, 'BLOCKED');

  const tampered = { ...input.evidence, pairedSeedDeltas01: [0.01, 0.02, 0.03, 0.04, 0.05] };
  assert.equal(evaluateDevelopmentalGenomeExperiment({ ...input, evidence: tampered }).status, 'BLOCKED');

  const nonIndependent = makeEvidence(input.parent, child, { independent: false });
  assert.equal(evaluateDevelopmentalGenomeExperiment({ ...input, evidence: nonIndependent }).status, 'BLOCKED');
});

test('paired-seed confidence is computed locally and any regression blocks the proposal', () => {
  const input = makeInput();
  const child = inheritDevelopmentalGenome(input.parent, input.patches);
  const regression = makeEvidence(input.parent, child, {
    pairedSeedDeltas01: [0.12, 0.10, -0.01, 0.09, 0.13],
  });
  const report = evaluateDevelopmentalGenomeExperiment({ ...input, evidence: regression });
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.issues.some(issue => issue.code === 'paired-seed-regressions-detected'));
});

test('incomplete rollback and weak identity continuity block review', () => {
  const input = makeInput();
  const child = inheritDevelopmentalGenome(input.parent, input.patches);
  const noRollback = makeEvidence(input.parent, child, { rollbackPrepared: false });
  assert.equal(evaluateDevelopmentalGenomeExperiment({ ...input, evidence: noRollback }).status, 'BLOCKED');
  const weakIdentity = makeEvidence(input.parent, child, { identityContinuity01: 0.7 });
  assert.equal(evaluateDevelopmentalGenomeExperiment({ ...input, evidence: weakIdentity }).status, 'BLOCKED');
});

test('the same inputs produce the same child and receipt digest', () => {
  const input = makeInput();
  const first = evaluateDevelopmentalGenomeExperiment(input);
  const second = evaluateDevelopmentalGenomeExperiment(input);
  assert.equal(first.candidate.digest, second.candidate.digest);
  assert.equal(first.receipt.digest, second.receipt.digest);
});

test('cyclic objects and hostile accessors are rejected without executing getters', () => {
  const cyclic = makeInput();
  cyclic.untrusted = cyclic;
  assert.equal(evaluateDevelopmentalGenomeExperiment(cyclic).status, 'BLOCKED');

  const hostile = makeInput();
  let getterCalls = 0;
  Object.defineProperty(hostile, 'p60Decision', {
    enumerable: true,
    get() { getterCalls += 1; return 'allow'; },
  });
  assert.equal(evaluateDevelopmentalGenomeExperiment(hostile).status, 'BLOCKED');
  assert.equal(getterCalls, 0);
});

console.log('DEVELOPMENTAL_GENOME_P53_P63_BRIDGE_TESTS=DEFINED');
